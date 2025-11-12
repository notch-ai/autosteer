/**
 * Fetch tracer for SDK subprocess
 *
 * IMPORTANT: This file runs in the SDK subprocess (not main process)
 * Environment variables are populated by main process via ClaudeCodeSDKService
 * using settings from src/config/settings.ts -> getSettingsAsEnv()
 *
 * All process.env access here reads values set by the main process's settings module
 */

// Use file-based logging to avoid corrupting SDK JSON output
// IMPORTANT: We MUST NOT use stdout/stderr (reserved for SDK JSON messages)
// Write all logs to file, only write to stderr if FETCH_TRACE_DEBUG is set

const fs = require('fs');
const os = require('os');
const path = require('path');
import { FetchCacheService } from '../../services/FetchCacheService';
import { getFetchTraceSettings, getFetchCacheSettings } from '../../config/settings';

// Load settings once (reads from process.env which was populated by main process)
const traceSettings = getFetchTraceSettings();
const cacheSettings = getFetchCacheSettings();

// Use ~/.autosteer/sessions directory for logs (same location as session manifest JSONs)
const logDir = path.join(os.homedir(), '.autosteer', 'sessions');
if (!fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (e) {
    // Silently fail - we'll fallback to stderr
  }
}

// Extract worktreeId from settings.cwd (basename of cwd), same as SessionManifestService
// Fallback to 'autosteer' if not available
const worktreeId = traceSettings.cwd ? path.basename(traceSettings.cwd) : 'autosteer';

// Extract sessionId from settings
// This allows one log file per Claude Code session
const sessionId = traceSettings.sessionId || 'unknown';

// Use timestamp from settings (generated once per app launch in main process)
// Falls back to generating new timestamp if not provided (shouldn't happen in normal operation)
const timestamp = traceSettings.timestamp || new Date().toISOString().replace(/[:.]/g, '-');

// Use consistent naming: {worktreeId}-{sessionId}-{timestamp}-fetch-trace.log
const logFile = path.join(logDir, `${worktreeId}-${sessionId}-${timestamp}-fetch-trace.log`);

// Only write to stderr if FETCH_TRACE_DEBUG is enabled to avoid corrupting SDK JSON output
const DEBUG = traceSettings.debug;

const fileLog = (level: string, message: string, ...args: any[]) => {
  const timestamp = new Date().toISOString();
  const data = args.length > 0 ? ` ${JSON.stringify(args)}` : '';
  const logLine = `[${timestamp}] [${level}] ${message}${data}\n`;

  // Write to file (always)
  try {
    fs.appendFileSync(logFile, logLine);
  } catch (e) {
    // Silently fail if file write fails
  }

  // Only write to stderr if DEBUG is enabled to avoid corrupting SDK JSON output
  if (DEBUG) {
    process.stderr.write(logLine);
  }
};

const log = {
  info: (message: string, ...args: any[]) => fileLog('INFO', message, ...args),
  warn: (message: string, ...args: any[]) => fileLog('WARN', message, ...args),
  error: (message: string, ...args: any[]) => fileLog('ERROR', message, ...args),
  debug: (message: string, ...args: any[]) => fileLog('DEBUG', message, ...args),
};

const SENSITIVE_HEADERS = ['x-api-key', 'authorization', 'cookie', 'set-cookie'];

let originalFetch: typeof fetch | null = null;
let isInstrumented = false;
let traceIncludes: string[] = [];
let traceExcludes: string[] = [];
let fetchCache: FetchCacheService | null = null;
let cacheIncludePatterns: string[] = [];

const generateCorrelationId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const redactHeaders = (headers: Headers): Record<string, string> => {
  const redacted: Record<string, string> = {};
  headers.forEach((value, key) => {
    redacted[key.toLowerCase()] = SENSITIVE_HEADERS.includes(key.toLowerCase())
      ? '[REDACTED]'
      : value;
  });
  return redacted;
};

const shouldTrace = (url: string): boolean => {
  // Check if tracing is enabled via settings
  if (!traceSettings.enabled) {
    return false;
  }

  // If no filters configured, trace everything
  if (traceIncludes.length === 0 && traceExcludes.length === 0) {
    log.debug('[fetch-tracer] No filters configured, tracing everything', { url });
    return true;
  }

  // Check include filter first
  if (traceIncludes.length > 0) {
    const matchesInclude = traceIncludes.some((pattern) => {
      try {
        const regex = new RegExp(pattern);
        const matches = regex.test(url);
        log.debug('[fetch-tracer] Testing include pattern', {
          url,
          pattern,
          regex: regex.toString(),
          matches,
        });
        return matches;
      } catch {
        const matches = url.includes(pattern);
        log.debug('[fetch-tracer] Testing include pattern (substring)', { url, pattern, matches });
        return matches;
      }
    });
    if (!matchesInclude) {
      log.debug('[fetch-tracer] URL does not match any include patterns, skipping', {
        url,
        patterns: traceIncludes,
      });
      return false;
    }
  }

  // Then check exclude filter
  if (traceExcludes.length > 0) {
    const matchesExclude = traceExcludes.some((pattern) => {
      try {
        const regex = new RegExp(pattern);
        const matches = regex.test(url);
        log.debug('[fetch-tracer] Testing exclude pattern', {
          url,
          pattern,
          regex: regex.toString(),
          matches,
        });
        return matches;
      } catch {
        const matches = url.includes(pattern);
        log.debug('[fetch-tracer] Testing exclude pattern (substring)', { url, pattern, matches });
        return matches;
      }
    });
    if (matchesExclude) {
      log.debug('[fetch-tracer] URL matches exclude pattern, skipping', { url });
      return false;
    }
  }

  log.debug('[fetch-tracer] URL passed all filters, will trace', { url });
  return true;
};

const shouldCacheContentType = (contentType: string): boolean => {
  // Allow caching of JSON, text, and SSE responses
  const cacheableTypes = [
    'application/json',
    'text/',
    'application/javascript',
    'application/xml',
    'application/x-www-form-urlencoded',
  ];

  // Skip binary content types (images, videos, PDFs, etc.)
  const binaryTypes = [
    'image/',
    'video/',
    'audio/',
    'application/pdf',
    'application/zip',
    'application/octet-stream',
    'application/x-binary',
    'font/',
  ];

  // Check if it's a binary type
  const isBinary = binaryTypes.some((type) => contentType.includes(type));
  if (isBinary) {
    return false;
  }

  // Check if it's a cacheable type
  const isCacheable = cacheableTypes.some((type) => contentType.includes(type));
  return isCacheable;
};

const logRequestComplete = (entry: {
  url: string;
  method: string;
  request: {
    time: string;
    headers: Record<string, string>;
    body: any;
  };
  response: {
    time: string;
    headers: Record<string, string>;
    body: any;
    status: number;
    size?: number;
  };
  duration: number;
  correlationId: string;
}): void => {
  // Log in the requested format: {request, response, url, method}
  const logEntry = {
    url: entry.url,
    method: entry.method,
    request: entry.request,
    response: entry.response,
    duration: entry.duration,
    correlationId: entry.correlationId,
  };

  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [FETCH] ${JSON.stringify(logEntry, null, 2)}\n`;

  // Write to file (always)
  try {
    fs.appendFileSync(logFile, logLine);
  } catch (e) {
    // Silently fail if file write fails
  }

  // Only write to stderr if DEBUG is enabled
  if (DEBUG) {
    process.stderr.write(logLine);
  }
};

const logRequestError = (entry: {
  url: string;
  method: string;
  request: {
    time: string;
    headers: Record<string, string>;
    body: any;
  };
  duration: number;
  error: string;
  correlationId: string;
}): void => {
  const logEntry = {
    url: entry.url,
    method: entry.method,
    request: entry.request,
    error: entry.error,
    duration: entry.duration,
    correlationId: entry.correlationId,
  };

  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [FETCH-ERROR] ${JSON.stringify(logEntry, null, 2)}\n`;

  // Write to file (always)
  try {
    fs.appendFileSync(logFile, logLine);
  } catch (e) {
    // Silently fail if file write fails
  }

  // Only write to stderr if DEBUG is enabled
  if (DEBUG) {
    process.stderr.write(logLine);
  }
};

export const instrumentFetchTracer = (): void => {
  if (isInstrumented) {
    log.warn('[fetch-tracer] Already instrumented, skipping');
    return;
  }

  if (typeof globalThis.fetch !== 'function') {
    log.error('[fetch-tracer] Global fetch not available');
    return;
  }

  // Initialize trace includes/excludes filters from settings
  traceIncludes = traceSettings.includes;
  traceExcludes = traceSettings.excludes;

  log.info('[fetch-tracer] Trace filters initialized', {
    includes: traceIncludes,
    excludes: traceExcludes,
  });

  originalFetch = globalThis.fetch;
  isInstrumented = true;

  // Initialize cache if enabled
  if (cacheSettings.enabled) {
    // Use TTL in milliseconds from settings
    const ttlMs = cacheSettings.ttlMs;
    const maxSize = cacheSettings.maxSize;
    const persistenceEnabled = cacheSettings.persistenceEnabled;

    fetchCache = new FetchCacheService({ maxSize, ttl: ttlMs, persistenceEnabled });

    // Get include patterns from settings
    cacheIncludePatterns = cacheSettings.includes;

    log.info('[fetch-tracer] Cache initialized', {
      maxSize,
      ttlSeconds: cacheSettings.ttl,
      ttlMs,
      persistenceEnabled,
      includePatterns: cacheIncludePatterns,
    });
  }

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? 'GET';

    const shouldTraceResult = shouldTrace(url);
    if (!shouldTraceResult) {
      return originalFetch!(input, init);
    }

    const correlationId = generateCorrelationId();
    const requestTime = new Date().toISOString();
    const startTime = performance.now();

    // Capture request headers
    const requestHeaders: Record<string, string> = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          requestHeaders[key.toLowerCase()] = SENSITIVE_HEADERS.includes(key.toLowerCase())
            ? '[REDACTED]'
            : value;
        });
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([key, value]) => {
          requestHeaders[key.toLowerCase()] = SENSITIVE_HEADERS.includes(key.toLowerCase())
            ? '[REDACTED]'
            : value;
        });
      } else {
        Object.entries(init.headers).forEach(([key, value]) => {
          requestHeaders[key.toLowerCase()] = SENSITIVE_HEADERS.includes(key.toLowerCase())
            ? '[REDACTED]'
            : value;
        });
      }
    }

    // Capture request body (if available and not a stream)
    let requestBody: any = null;
    if (init?.body) {
      if (typeof init.body === 'string') {
        try {
          requestBody = JSON.parse(init.body);
        } catch {
          requestBody = init.body;
        }
      } else {
        requestBody = '[Non-string body]';
      }
    }

    // Check cache if enabled and URL matches include patterns
    if (fetchCache && fetchCache.matchesIncludeFilter(url, cacheIncludePatterns)) {
      const cacheKey = fetchCache.generateCacheKey(method, url, requestBody);
      const cachedResponse = fetchCache.getWithMetadata(method, url, requestBody);
      if (cachedResponse) {
        const duration = Math.round(performance.now() - startTime);
        log.info('[fetch-tracer] Cache HIT', {
          cacheKey,
          method,
          url,
          duration,
          correlationId,
        });

        // Log cache stats periodically
        const stats = fetchCache.getStats();
        log.debug('[fetch-tracer] Cache stats', stats);

        return cachedResponse;
      } else {
        // Cache MISS - log details for debugging
        log.info('[fetch-tracer] Cache MISS', {
          cacheKey,
          method,
          url,
          body: requestBody,
          correlationId,
        });
      }
    }

    try {
      const response = await originalFetch!(input, init);
      const responseTime = new Date().toISOString();
      const duration = Math.round(performance.now() - startTime);

      // Capture response headers
      const responseHeaders = redactHeaders(response.headers);
      const contentType = response.headers.get('content-type') || '';

      // Handle SSE streams - intercept and log chunks as they pass through
      if (contentType.includes('text/event-stream') && response.body) {
        const sseChunks: string[] = [];
        const decoder = new TextDecoder();

        // Create transform stream to intercept SSE chunks
        const transformStream = new TransformStream({
          transform(chunk, controller) {
            // Decode and log chunk
            const text = decoder.decode(chunk, { stream: true });
            sseChunks.push(text);

            // Pass through to application
            controller.enqueue(chunk);
          },
          flush() {
            // Log complete SSE stream when done
            const fullStream = sseChunks.join('');
            logRequestComplete({
              url,
              method,
              request: {
                time: requestTime,
                headers: requestHeaders,
                body: requestBody,
              },
              response: {
                time: responseTime,
                headers: responseHeaders,
                body: fullStream, // Full SSE stream content
                status: response.status,
                size: fullStream.length,
              },
              duration: Math.round(performance.now() - startTime),
              correlationId,
            });

            // Cache the complete SSE response after stream completes
            // Note: flush() is synchronous, so we fire-and-forget the async cache operation
            const shouldCache =
              fetchCache &&
              fetchCache.matchesIncludeFilter(url, cacheIncludePatterns) &&
              response.status >= 200 &&
              response.status < 300;

            log.debug('[fetch-tracer] SSE flush - cache decision', {
              shouldCache,
              hasFetchCache: !!fetchCache,
              matchesFilter: fetchCache?.matchesIncludeFilter(url, cacheIncludePatterns),
              status: response.status,
              streamSize: fullStream.length,
              correlationId,
            });

            if (shouldCache) {
              const cacheKey = fetchCache!.generateCacheKey(method, url, requestBody);
              log.debug('[fetch-tracer] SSE flush - creating cached response', {
                cacheKey,
                streamSize: fullStream.length,
                correlationId,
              });

              try {
                // Create a new Response object from the complete stream data
                const cachedResponse = new Response(fullStream, {
                  status: response.status,
                  statusText: response.statusText,
                  headers: response.headers,
                });

                log.debug(
                  '[fetch-tracer] SSE flush - cached response created, calling setWithMetadata',
                  {
                    cacheKey,
                    correlationId,
                  }
                );

                // Fire and forget - don't await in flush callback
                fetchCache!
                  .setWithMetadata(method, url, requestBody, cachedResponse)
                  .then(() => {
                    log.info('[fetch-tracer] Cache SET (SSE) - after flush SUCCESS', {
                      cacheKey,
                      method,
                      url,
                      status: response.status,
                      size: fullStream.length,
                      correlationId,
                    });
                  })
                  .catch((cacheError) => {
                    log.error('[fetch-tracer] Failed to cache SSE response in flush', {
                      correlationId,
                      url,
                      cacheKey,
                      error: String(cacheError),
                      errorName: cacheError instanceof Error ? cacheError.name : undefined,
                      stack: cacheError instanceof Error ? cacheError.stack : undefined,
                    });
                  });
              } catch (syncError) {
                log.error('[fetch-tracer] Synchronous error creating cached response', {
                  correlationId,
                  url,
                  cacheKey,
                  error: String(syncError),
                  stack: syncError instanceof Error ? syncError.stack : undefined,
                });
              }
            }
          },
        });

        // Pipe response body through transform stream
        const transformedBody = response.body.pipeThrough(transformStream);

        // Return new response with transformed stream
        return new Response(transformedBody, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      }

      // Handle non-streaming responses
      let responseBody: any = null;
      try {
        const clonedResponse = response.clone();

        if (contentType.includes('application/json')) {
          try {
            responseBody = await clonedResponse.json();
          } catch {
            responseBody = await clonedResponse.text();
          }
        } else if (contentType.includes('text/')) {
          responseBody = await clonedResponse.text();
        } else {
          responseBody = '[Binary data]';
        }
      } catch (cloneError) {
        log.warn('[fetch-tracer] Failed to clone/read response', {
          correlationId,
          error: String(cloneError),
        });
        responseBody = '[Unable to read body]';
      }

      // Calculate response size
      const contentLength = response.headers.get('content-length');
      const responseSize = contentLength ? parseInt(contentLength, 10) : 0;

      logRequestComplete({
        url,
        method,
        request: {
          time: requestTime,
          headers: requestHeaders,
          body: requestBody,
        },
        response: {
          time: responseTime,
          headers: responseHeaders,
          body: responseBody,
          status: response.status,
          size: responseSize,
        },
        duration,
        correlationId,
      });

      // Store in cache if enabled, URL matches patterns, and response is successful
      if (fetchCache) {
        const matchesFilter = fetchCache.matchesIncludeFilter(url, cacheIncludePatterns);
        const statusOk = response.status >= 200 && response.status < 300;

        // Only cache JSON and text responses (not images, PDFs, videos, etc.)
        // BUT always cache empty responses (size 0) regardless of content-type
        const isEmptyResponse = responseSize === 0;
        const isCacheableContentType = isEmptyResponse || shouldCacheContentType(contentType);

        // Check response size (only cache responses under 10MB)
        const maxCacheSize = 10 * 1024 * 1024; // 10MB
        const isUnderSizeLimit = responseSize <= maxCacheSize;

        log.debug('[fetch-tracer] Cache decision', {
          url,
          status: response.status,
          contentType,
          responseSize,
          isEmptyResponse,
          matchesFilter,
          statusOk,
          isCacheableContentType,
          isUnderSizeLimit,
          shouldCache: matchesFilter && statusOk && isCacheableContentType && isUnderSizeLimit,
          correlationId,
        });

        if (matchesFilter && statusOk && isCacheableContentType && isUnderSizeLimit) {
          try {
            const cacheKey = fetchCache.generateCacheKey(method, url, requestBody);
            const clonedForCache = response.clone();
            await fetchCache.setWithMetadata(method, url, requestBody, clonedForCache);
            log.info('[fetch-tracer] Cache SET', {
              cacheKey,
              method,
              url,
              status: response.status,
              contentType,
              responseBodyType: typeof responseBody,
              correlationId,
            });
          } catch (cacheError) {
            log.warn('[fetch-tracer] Failed to cache response', {
              correlationId,
              url,
              status: response.status,
              error: String(cacheError),
              stack: cacheError instanceof Error ? cacheError.stack : undefined,
            });
          }
        } else if (matchesFilter && statusOk && !isCacheableContentType) {
          log.debug('[fetch-tracer] Skipping cache - binary content-type', {
            url,
            contentType,
            correlationId,
          });
        } else if (matchesFilter && statusOk && !isUnderSizeLimit) {
          log.debug('[fetch-tracer] Skipping cache - response too large', {
            url,
            responseSize,
            maxCacheSize,
            correlationId,
          });
        }
      }

      return response;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);

      logRequestError({
        url,
        method,
        request: {
          time: requestTime,
          headers: requestHeaders,
          body: requestBody,
        },
        duration,
        error: String(error),
        correlationId,
      });

      throw error;
    }
  };
};

export const uninstrumentFetchTracer = (): void => {
  if (!isInstrumented || !originalFetch) {
    log.warn('[fetch-tracer] Not instrumented, nothing to restore');
    return;
  }

  globalThis.fetch = originalFetch;
  originalFetch = null;
  isInstrumented = false;
};

export interface RedactionConfig {
  sensitiveHeaders: string[];
  redactedValue: string;
}

export const DEFAULT_REDACTION_CONFIG: RedactionConfig = {
  sensitiveHeaders: ['x-api-key', 'authorization', 'cookie', 'set-cookie'],
  redactedValue: '[REDACTED]',
};

export interface RedactedHeaders {
  headers: Record<string, string>;
  redactedCount: number;
}

export function redactHeadersAdvanced(
  headers: Headers | Record<string, string>,
  config: RedactionConfig = DEFAULT_REDACTION_CONFIG
): RedactedHeaders {
  const result: Record<string, string> = {};
  let redactedCount = 0;

  const normalizedSensitiveHeaders = config.sensitiveHeaders.map((h) => h.toLowerCase());

  const processHeader = (name: string, value: string) => {
    const lowerName = name.toLowerCase();
    if (normalizedSensitiveHeaders.includes(lowerName)) {
      result[name] = config.redactedValue;
      redactedCount++;
    } else {
      result[name] = value;
    }
  };

  if (headers instanceof Headers) {
    headers.forEach((value, name) => {
      processHeader(name, value);
    });
  } else {
    Object.entries(headers).forEach(([name, value]) => {
      processHeader(name, value);
    });
  }

  if (redactedCount > 0) {
    log.warn('[fetch-tracer] Redacted sensitive headers', { count: redactedCount });
  }

  return { headers: result, redactedCount };
}

export interface SafeCloneResult<T> {
  clone: T | null;
  error: Error | null;
  isStreaming: boolean;
}

export async function safeCloneRequest(request: Request): Promise<SafeCloneResult<Request>> {
  try {
    const clonedRequest = request.clone();
    return {
      clone: clonedRequest,
      error: null,
      isStreaming: false,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.warn('[fetch-tracer] Failed to clone request', {
      url: request.url,
      method: request.method,
      error: err.message,
    });

    return {
      clone: null,
      error: err,
      isStreaming: false,
    };
  }
}

export async function safeCloneResponse(response: Response): Promise<SafeCloneResult<Response>> {
  try {
    const clonedResponse = response.clone();
    return {
      clone: clonedResponse,
      error: null,
      isStreaming: false,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const isStreamingError =
      err.message.includes('disturbed') ||
      err.message.includes('locked') ||
      err.message.includes('already read');

    log.warn('[fetch-tracer] Failed to clone response', {
      url: response.url,
      status: response.status,
      isStreaming: isStreamingError,
      error: err.message,
    });

    return {
      clone: null,
      error: err,
      isStreaming: isStreamingError,
    };
  }
}

export interface SafeBodyResult {
  body: any;
  error: Error | null;
  bodyType: 'text' | 'json' | 'blob' | 'arrayBuffer' | 'formData' | 'unavailable';
}

export async function safeReadBody(
  source: Request | Response,
  preferredType: 'text' | 'json' = 'text'
): Promise<SafeBodyResult> {
  try {
    if (preferredType === 'json') {
      try {
        const body = await source.json();
        return {
          body,
          error: null,
          bodyType: 'json',
        };
      } catch (jsonError) {
        const text = await source.text();
        return {
          body: text,
          error: null,
          bodyType: 'text',
        };
      }
    } else {
      const body = await source.text();
      return {
        body,
        error: null,
        bodyType: 'text',
      };
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.warn('[fetch-tracer] Failed to read body', {
      sourceType: source instanceof Request ? 'Request' : 'Response',
      error: err.message,
    });

    return {
      body: null,
      error: err,
      bodyType: 'unavailable',
    };
  }
}

export interface RequestMetadata {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: any;
  timestamp: number;
  redactedHeaderCount: number;
}

export interface ResponseMetadata {
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
  timestamp: number;
  duration: number;
  redactedHeaderCount: number;
}

export async function captureRequestMetadata(
  request: Request,
  config?: RedactionConfig
): Promise<RequestMetadata> {
  const timestamp = Date.now();
  const { clone: clonedRequest, error: cloneError } = await safeCloneRequest(request);

  const { headers: redactedHeaders, redactedCount } = redactHeadersAdvanced(
    request.headers,
    config
  );

  let body: any = null;
  if (clonedRequest && !cloneError) {
    const { body: requestBody } = await safeReadBody(clonedRequest, 'text');
    body = requestBody;
  }

  return {
    url: request.url,
    method: request.method,
    headers: redactedHeaders,
    body,
    timestamp,
    redactedHeaderCount: redactedCount,
  };
}

export async function captureResponseMetadata(
  response: Response,
  requestTimestamp: number,
  config?: RedactionConfig
): Promise<ResponseMetadata> {
  const timestamp = Date.now();
  const duration = timestamp - requestTimestamp;

  const { clone: clonedResponse, error: cloneError } = await safeCloneResponse(response);

  const { headers: redactedHeaders, redactedCount } = redactHeadersAdvanced(
    response.headers,
    config
  );

  let body: any = null;
  if (clonedResponse && !cloneError) {
    const { body: responseBody } = await safeReadBody(clonedResponse, 'json');
    body = responseBody;
  }

  return {
    url: response.url,
    status: response.status,
    statusText: response.statusText,
    headers: redactedHeaders,
    body,
    timestamp,
    duration,
    redactedHeaderCount: redactedCount,
  };
}
