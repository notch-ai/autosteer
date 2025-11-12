/**
 * Unified Fetch Interceptor - Combines logging and caching with SSE stream support
 *
 * IMPORTANT: This file runs in the SDK subprocess (not main process)
 * Environment variables are populated by main process via ClaudeCodeSDKService
 * using settings from src/config/settings.ts -> getSettingsAsEnv()
 *
 * All process.env access here reads values set by the main process's settings module
 */

// IMPORTANT: We MUST NOT use stdout/stderr (reserved for SDK JSON messages)

const fs = require('fs');
const os = require('os');
const path = require('path');

import { FetchCacheService } from '@/services/FetchCacheService';

// ============================================================================
// CONFIGURATION & SETUP
// ============================================================================

const logDir = path.join(os.homedir(), '.autosteer', 'sessions');
if (!fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (e) {
    // Silently fail
  }
}

const worktreeId = process.env.FETCH_TRACE_CWD
  ? path.basename(process.env.FETCH_TRACE_CWD)
  : 'autosteer';
const sessionId = process.env.FETCH_TRACE_SESSION_ID || 'unknown';
const timestamp =
  process.env.FETCH_TRACE_TIMESTAMP || new Date().toISOString().replace(/[:.]/g, '-');

// Unified log file for both tracing and caching
const traceLogFile = path.join(logDir, `${worktreeId}-${sessionId}-${timestamp}-fetch-trace.log`);

const DEBUG = process.env.FETCH_TRACE_DEBUG === 'true';

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

const fileLog = (logFile: string, level: string, message: string, ...args: any[]) => {
  const timestamp = new Date().toISOString();
  const data = args.length > 0 ? ` ${JSON.stringify(args)}` : '';
  const logLine = `[${timestamp}] [${level}] ${message}${data}\n`;

  try {
    fs.appendFileSync(logFile, logLine);
  } catch (e) {
    // Silently fail
  }

  if (DEBUG) {
    process.stderr.write(logLine);
  }
};

const traceLog = {
  info: (message: string, ...args: any[]) => fileLog(traceLogFile, 'INFO', message, ...args),
  warn: (message: string, ...args: any[]) => fileLog(traceLogFile, 'WARN', message, ...args),
  error: (message: string, ...args: any[]) => fileLog(traceLogFile, 'ERROR', message, ...args),
  debug: (message: string, ...args: any[]) => fileLog(traceLogFile, 'DEBUG', message, ...args),
};

// Cache logs now go to the same file as trace logs (unified logging)
const cacheLog = {
  info: (message: string, ...args: any[]) => fileLog(traceLogFile, 'INFO', message, ...args),
  debug: (message: string, ...args: any[]) => fileLog(traceLogFile, 'DEBUG', message, ...args),
};

// ============================================================================
// CONSTANTS & STATE
// ============================================================================

const SENSITIVE_HEADERS = ['x-api-key', 'authorization', 'cookie', 'set-cookie'];

let originalFetch: typeof fetch | null = null;
let isInstrumented = false;

// Trace state
let traceEnabled = false;
let traceIncludes: string[] = [];
let traceExcludes: string[] = [];

// Cache state
let cacheEnabled = false;
let fetchCache: FetchCacheService | null = null;
let cacheIncludes: string[] = [];
let cacheExcludes: string[] = [];
let cacheIgnoreHeaders = true;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
  if (!traceEnabled) return false;

  // If no filters configured, trace everything
  if (traceIncludes.length === 0 && traceExcludes.length === 0) {
    return true;
  }

  // Check include filter first
  if (traceIncludes.length > 0) {
    const matchesInclude = traceIncludes.some((pattern) => {
      try {
        const regex = new RegExp(pattern);
        return regex.test(url);
      } catch {
        return url.includes(pattern);
      }
    });
    if (!matchesInclude) return false;
  }

  // Then check exclude filter
  if (traceExcludes.length > 0) {
    const matchesExclude = traceExcludes.some((pattern) => {
      try {
        const regex = new RegExp(pattern);
        return regex.test(url);
      } catch {
        return url.includes(pattern);
      }
    });
    if (matchesExclude) return false;
  }

  return true;
};

const shouldCache = (url: string): boolean => {
  if (!cacheEnabled || !fetchCache) return false;

  // Check include filter
  if (!fetchCache.matchesIncludeFilter(url, cacheIncludes)) {
    return false;
  }

  // Check exclude filter
  if (fetchCache.matchesExcludeFilter(url, cacheExcludes)) {
    return false;
  }

  return true;
};

const isCacheable = (response: Response): boolean => {
  // Don't cache errors
  if (response.status >= 400) return false;

  // Optionally respect Cache-Control headers
  if (!cacheIgnoreHeaders) {
    const cacheControl = response.headers.get('cache-control') || '';
    if (cacheControl.includes('no-store') || cacheControl.includes('no-cache')) {
      return false;
    }
  }

  return true;
};

// ============================================================================
// LOGGING FUNCTIONS
// ============================================================================

const logRequestComplete = (entry: {
  url: string;
  method: string;
  request: { time: string; headers: Record<string, string>; body: any };
  response: { time: string; headers: Record<string, string>; body: any; status: number };
  duration: number;
  correlationId: string;
}): void => {
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

  try {
    fs.appendFileSync(traceLogFile, logLine);
  } catch (e) {
    // Silently fail
  }

  if (DEBUG) {
    process.stderr.write(logLine);
  }
};

const logRequestError = (entry: {
  url: string;
  method: string;
  request: { time: string; headers: Record<string, string>; body: any };
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

  try {
    fs.appendFileSync(traceLogFile, logLine);
  } catch (e) {
    // Silently fail
  }

  if (DEBUG) {
    process.stderr.write(logLine);
  }
};

// ============================================================================
// MAIN INTERCEPTOR
// ============================================================================

export const instrumentFetchInterceptor = (): void => {
  if (isInstrumented) {
    traceLog.warn('[fetch-interceptor] Already instrumented, skipping');
    return;
  }

  if (typeof globalThis.fetch !== 'function') {
    traceLog.error('[fetch-interceptor] Global fetch not available');
    return;
  }

  // Initialize tracing
  // NOTE: Must use process.env here - this code runs in SDK subprocess, not main process
  traceEnabled = process.env.FETCH_TRACE_ENABLED === 'true';
  if (traceEnabled) {
    traceIncludes = (process.env.FETCH_TRACE_INCLUDES || '').split(',').filter(Boolean);
    traceExcludes = (process.env.FETCH_TRACE_EXCLUDES || '').split(',').filter(Boolean);
  }

  // Initialize caching
  cacheEnabled = process.env.FETCH_CACHE_ENABLED === 'true';
  if (cacheEnabled) {
    // Parse TTL in seconds and convert to milliseconds
    const ttlSeconds = parseInt(process.env.FETCH_CACHE_TTL || '21600'); // Default: 6 hours
    const ttlMs = ttlSeconds * 1000;

    const persistenceEnabled = process.env.FETCH_CACHE_PERSISTENCE_ENABLED !== 'false'; // Default: true

    fetchCache = new FetchCacheService({
      maxSize: parseInt(process.env.FETCH_CACHE_MAX_SIZE || '1000'),
      ttl: ttlMs,
      persistenceEnabled,
    });
    cacheIncludes = (process.env.FETCH_CACHE_INCLUDES || '').split(',').filter(Boolean);
    cacheExcludes = (process.env.FETCH_CACHE_EXCLUDES || '').split(',').filter(Boolean);
    cacheIgnoreHeaders = process.env.FETCH_CACHE_IGNORE_HEADERS !== 'false'; // Default: true
  }

  originalFetch = globalThis.fetch;
  isInstrumented = true;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? 'GET';

    // Parse request body
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

    // Check cache first
    const cacheable = shouldCache(url);
    if (cacheable) {
      // Generate cache key for logging
      const cacheKey = fetchCache!.generateCacheKey(
        method,
        fetchCache!.normalizeUrl(url),
        requestBody
      );
      const bodyString = requestBody != null ? JSON.stringify(requestBody) : '';

      // Log cache state BEFORE checking
      const keyExists = fetchCache!.has(cacheKey);
      const currentCacheSize = fetchCache!.size();

      cacheLog.debug('[CACHE CHECK]', {
        key: cacheKey,
        keyExists,
        currentCacheSize,
      });

      const cached = fetchCache!.getWithMetadata(method, url, requestBody);
      if (cached) {
        // For HIT: truncate body to 200 chars
        const truncatedBody =
          bodyString.length > 200 ? bodyString.substring(0, 200) + '...' : bodyString;
        cacheLog.info('[CACHE HIT]', {
          method,
          url,
          key: cacheKey,
          body: truncatedBody,
        });
        return cached;
      }
      // For MISS: show full body (not truncated)
      cacheLog.info('[CACHE MISS]', {
        method,
        url,
        key: cacheKey,
        body: bodyString,
        currentCacheSize,
      });
    }

    const shouldTraceRequest = shouldTrace(url);

    // If neither tracing nor caching, pass through
    if (!shouldTraceRequest && !cacheable) {
      return originalFetch!(input, init);
    }

    const correlationId = generateCorrelationId();
    const requestTime = new Date().toISOString();
    const startTime = performance.now();

    // Capture request headers (for tracing)
    const requestHeaders: Record<string, string> = {};
    if (shouldTraceRequest && init?.headers) {
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

    try {
      const response = await originalFetch!(input, init);
      const responseTime = new Date().toISOString();
      const duration = Math.round(performance.now() - startTime);

      const responseHeaders = shouldTraceRequest ? redactHeaders(response.headers) : {};
      const contentType = response.headers.get('content-type') || '';

      // Handle SSE streams - intercept, log, AND cache complete stream
      if (contentType.includes('text/event-stream') && response.body) {
        const sseChunks: string[] = [];
        const decoder = new TextDecoder();

        const transformStream = new TransformStream({
          transform(chunk, controller) {
            const text = decoder.decode(chunk, { stream: true });
            sseChunks.push(text);
            controller.enqueue(chunk);
          },
          flush() {
            const fullStream = sseChunks.join('');

            // Log complete stream
            if (shouldTraceRequest) {
              logRequestComplete({
                url,
                method,
                request: { time: requestTime, headers: requestHeaders, body: requestBody },
                response: {
                  time: responseTime,
                  headers: responseHeaders,
                  body: fullStream,
                  status: response.status,
                },
                duration: Math.round(performance.now() - startTime),
                correlationId,
              });
            }

            // Cache complete stream (if cacheable)
            if (cacheable && isCacheable(response)) {
              // Create a new Response with the complete stream content
              const cachedResponse = new Response(fullStream, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
              });

              const cacheKey = fetchCache!.generateCacheKey(
                method,
                fetchCache!.normalizeUrl(url),
                requestBody
              );
              const sizeBeforeSet = fetchCache!.size();

              fetchCache!.setWithMetadata(method, url, requestBody, cachedResponse);

              const sizeAfterSet = fetchCache!.size();
              const keyNowExists = fetchCache!.has(cacheKey);

              cacheLog.info('[CACHE SET] (SSE)', {
                key: cacheKey,
                method,
                url,
                status: response.status,
                sizeBeforeSet,
                sizeAfterSet,
                keyNowExists,
                stored: keyNowExists && sizeAfterSet > sizeBeforeSet,
              });
            }
          },
        });

        const transformedBody = response.body.pipeThrough(transformStream);

        return new Response(transformedBody, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      }

      // Handle non-streaming responses
      let responseBody: any = null;

      if (shouldTraceRequest) {
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
          traceLog.warn('[fetch-interceptor] Failed to clone/read response', {
            correlationId,
            error: String(cloneError),
          });
          responseBody = '[Unable to read body]';
        }

        logRequestComplete({
          url,
          method,
          request: { time: requestTime, headers: requestHeaders, body: requestBody },
          response: {
            time: responseTime,
            headers: responseHeaders,
            body: responseBody,
            status: response.status,
          },
          duration,
          correlationId,
        });
      }

      // Cache non-streaming responses
      if (cacheable && isCacheable(response)) {
        const clonedForCache = response.clone();
        const cacheKey = fetchCache!.generateCacheKey(
          method,
          fetchCache!.normalizeUrl(url),
          requestBody
        );
        const sizeBeforeSet = fetchCache!.size();

        fetchCache!.setWithMetadata(method, url, requestBody, clonedForCache);

        const sizeAfterSet = fetchCache!.size();
        const keyNowExists = fetchCache!.has(cacheKey);

        cacheLog.info('[CACHE SET]', {
          key: cacheKey,
          method,
          url,
          status: response.status,
          sizeBeforeSet,
          sizeAfterSet,
          keyNowExists,
          stored: keyNowExists && sizeAfterSet > sizeBeforeSet,
        });
      } else if (cacheable) {
        // Log why it wasn't cached
        const cacheControl = response.headers.get('cache-control') || '';
        const hasNoCacheHeader =
          cacheControl.includes('no-store') || cacheControl.includes('no-cache');

        cacheLog.debug('[CACHE SKIP]', {
          method,
          url,
          reason: response.status >= 400 ? 'error status' : 'cache-control header',
          status: response.status,
          cacheControl,
          hasNoCacheHeader,
          ignoreHeaders: cacheIgnoreHeaders,
        });
      }

      return response;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);

      if (shouldTraceRequest) {
        logRequestError({
          url,
          method,
          request: { time: requestTime, headers: requestHeaders, body: requestBody },
          duration,
          error: String(error),
          correlationId,
        });
      }

      throw error;
    }
  };

  // Log once on startup
  if (traceEnabled || cacheEnabled) {
    const features = [];
    if (traceEnabled) features.push('trace');
    if (cacheEnabled)
      features.push(
        `cache(max=${fetchCache?.['maxSize'] || 0},ttl=${(fetchCache?.['ttl'] || 0) / 1000}s)`
      );
  }
};

export const uninstrumentFetchInterceptor = (): void => {
  if (!isInstrumented || !originalFetch) {
    traceLog.warn('[fetch-interceptor] Not instrumented, nothing to restore');
    return;
  }

  globalThis.fetch = originalFetch;
  originalFetch = null;
  isInstrumented = false;

  traceLog.info('[fetch-interceptor] Uninstrumented');
};

// Backward compatibility exports
export const instrumentFetchTracer = instrumentFetchInterceptor;
export const uninstrumentFetchTracer = uninstrumentFetchInterceptor;
