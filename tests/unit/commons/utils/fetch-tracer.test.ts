import { instrumentFetchTracer, uninstrumentFetchTracer } from '@/infrastructure/fetch/tracer';

jest.mock('@/commons/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

import { logger } from '@/commons/utils/logger';

import {
  redactHeadersAdvanced,
  safeCloneRequest,
  safeCloneResponse,
  safeReadBody,
  captureRequestMetadata,
  captureResponseMetadata,
  DEFAULT_REDACTION_CONFIG,
} from '@/infrastructure/fetch/tracer';

// TODO: Update tests for file-based logging (no longer using electron-log)
// Log files now use naming convention: {worktreeId}-fetch-trace-{timestamp}-{pid}.log
describe.skip('fetch-tracer', () => {
  let originalFetch: typeof globalThis.fetch;
  let originalProcessEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalFetch = globalThis.fetch;
    originalProcessEnv = { ...process.env };
  });

  beforeEach(() => {
    jest.clearAllMocks();
    uninstrumentFetchTracer();
    globalThis.fetch = originalFetch;
    process.env = { ...originalProcessEnv };
    delete process.env.FETCH_TRACE_ENABLED;
    delete process.env.FETCH_TRACE_INCLUDES;
    delete process.env.FETCH_TRACE_EXCLUDES;

    globalThis.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({ result: 'success' }), {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }) as typeof fetch;
  });

  afterEach(() => {
    uninstrumentFetchTracer();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
    process.env = originalProcessEnv;
  });

  describe('instrumentFetchTracer', () => {
    it('should instrument fetch successfully', () => {
      process.env.FETCH_TRACE_ENABLED = 'true';
      const fetchBeforeInstrumentation = globalThis.fetch;

      instrumentFetchTracer();

      expect(globalThis.fetch).not.toBe(fetchBeforeInstrumentation);
      expect(logger.info).toHaveBeenCalledWith('[fetch-tracer] Fetch tracer instrumented', {
        filterPattern: expect.any(String),
      });
    });

    it('should skip instrumentation if already instrumented', () => {
      process.env.FETCH_TRACE_ENABLED = 'true';
      instrumentFetchTracer();
      jest.clearAllMocks();

      instrumentFetchTracer();

      expect(logger.warn).toHaveBeenCalledWith('[fetch-tracer] Already instrumented, skipping');
    });

    it('should handle missing global fetch', () => {
      const originalGlobalFetch = globalThis.fetch;
      delete (globalThis as any).fetch;

      instrumentFetchTracer();

      expect(logger.error).toHaveBeenCalledWith('[fetch-tracer] Global fetch not available');

      globalThis.fetch = originalGlobalFetch;
    });

    it('should initialize includes/excludes from environment variables', () => {
      process.env.FETCH_TRACE_ENABLED = 'true';
      process.env.FETCH_TRACE_INCLUDES = 'anthropic\\.com';

      instrumentFetchTracer();

      expect(logger.info).toHaveBeenCalledWith('[fetch-tracer] Fetch tracer instrumented', {
        filterPattern: 'anthropic\\.com',
      });
    });

    it('should handle invalid regex in includes/excludes patterns gracefully', () => {
      process.env.FETCH_TRACE_ENABLED = 'true';
      process.env.FETCH_TRACE_INCLUDES = '[invalid(regex';

      instrumentFetchTracer();

      expect(logger.info).toHaveBeenCalledWith('[fetch-tracer] Fetch tracer instrumented', {
        filterPattern: expect.any(String),
      });
    });

    it('should default to .* when no filter pattern provided', () => {
      process.env.FETCH_TRACE_ENABLED = 'true';

      instrumentFetchTracer();

      expect(logger.info).toHaveBeenCalledWith('[fetch-tracer] Fetch tracer instrumented', {
        filterPattern: '.*',
      });
    });
  });

  describe('uninstrumentFetchTracer', () => {
    it('should restore original fetch', () => {
      process.env.FETCH_TRACE_ENABLED = 'true';
      const originalGlobalFetch = globalThis.fetch;

      instrumentFetchTracer();
      expect(globalThis.fetch).not.toBe(originalGlobalFetch);

      uninstrumentFetchTracer();

      expect(globalThis.fetch).toBe(originalGlobalFetch);
      expect(logger.info).toHaveBeenCalledWith('[fetch-tracer] Fetch tracer uninstrumented');
    });

    it('should warn if not instrumented', () => {
      uninstrumentFetchTracer();

      expect(logger.warn).toHaveBeenCalledWith(
        '[fetch-tracer] Not instrumented, nothing to restore'
      );
    });

    it('should allow re-instrumentation after uninstrumenting', () => {
      process.env.FETCH_TRACE_ENABLED = 'true';

      instrumentFetchTracer();
      uninstrumentFetchTracer();
      jest.clearAllMocks();

      instrumentFetchTracer();

      expect(logger.info).toHaveBeenCalledWith('[fetch-tracer] Fetch tracer instrumented', {
        filterPattern: expect.any(String),
      });
      expect(logger.warn).not.toHaveBeenCalledWith('[fetch-tracer] Already instrumented, skipping');
    });
  });

  describe('Fetch interception', () => {
    it('should trace requests when enabled and URL matches filter', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';
      process.env.FETCH_TRACE_INCLUDES = 'api\\.example\\.com';

      instrumentFetchTracer();

      await globalThis.fetch('https://api.example.com/test');

      expect(logger.debug).toHaveBeenCalledWith('[fetch-tracer] Request started', {
        correlationId: expect.any(String),
        method: 'GET',
        url: 'https://api.example.com/test',
      });

      expect(logger.debug).toHaveBeenCalledWith('[fetch-tracer] Request completed', {
        correlationId: expect.any(String),
        method: 'GET',
        url: 'https://api.example.com/test',
        duration: expect.any(Number),
        status: 200,
        headers: expect.any(Object),
        isSSE: false,
      });
    });

    it('should not trace when FETCH_TRACE_ENABLED is false', async () => {
      process.env.FETCH_TRACE_ENABLED = 'false';

      instrumentFetchTracer();

      await globalThis.fetch('https://api.example.com/test');

      expect(logger.debug).not.toHaveBeenCalledWith(
        '[fetch-tracer] Request started',
        expect.any(Object)
      );
    });

    it('should not trace when FETCH_TRACE_ENABLED is not set', async () => {
      delete process.env.FETCH_TRACE_ENABLED;

      instrumentFetchTracer();

      await globalThis.fetch('https://api.example.com/test');

      expect(logger.debug).not.toHaveBeenCalledWith(
        '[fetch-tracer] Request started',
        expect.any(Object)
      );
    });

    it('should not trace requests that do not match filter', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';
      process.env.FETCH_TRACE_INCLUDES = 'anthropic\\.com';

      instrumentFetchTracer();

      await globalThis.fetch('https://api.example.com/test');

      expect(logger.debug).not.toHaveBeenCalledWith(
        '[fetch-tracer] Request started',
        expect.any(Object)
      );
    });

    it('should trace all requests when filter is .*', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';

      instrumentFetchTracer();

      await globalThis.fetch('https://api1.example.com/test');
      await globalThis.fetch('https://api2.example.com/test');

      expect(logger.debug).toHaveBeenCalledWith('[fetch-tracer] Request started', {
        correlationId: expect.any(String),
        method: 'GET',
        url: 'https://api1.example.com/test',
      });

      expect(logger.debug).toHaveBeenCalledWith('[fetch-tracer] Request started', {
        correlationId: expect.any(String),
        method: 'GET',
        url: 'https://api2.example.com/test',
      });
    });

    it('should capture different HTTP methods', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';

      instrumentFetchTracer();

      await globalThis.fetch('https://api.example.com/test', { method: 'POST' });
      await globalThis.fetch('https://api.example.com/test', { method: 'PUT' });
      await globalThis.fetch('https://api.example.com/test', { method: 'DELETE' });

      expect(logger.debug).toHaveBeenCalledWith('[fetch-tracer] Request started', {
        correlationId: expect.any(String),
        method: 'POST',
        url: 'https://api.example.com/test',
      });

      expect(logger.debug).toHaveBeenCalledWith('[fetch-tracer] Request started', {
        correlationId: expect.any(String),
        method: 'PUT',
        url: 'https://api.example.com/test',
      });

      expect(logger.debug).toHaveBeenCalledWith('[fetch-tracer] Request started', {
        correlationId: expect.any(String),
        method: 'DELETE',
        url: 'https://api.example.com/test',
      });
    });

    it('should handle Request object as input', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';

      const request = new Request('https://api.example.com/test', {
        method: 'POST',
      });

      globalThis.fetch = jest.fn(async () => {
        return new Response('{}', { status: 200 });
      }) as typeof fetch;

      instrumentFetchTracer();

      await globalThis.fetch(request);

      // Note: When passing a Request object, the fetch tracer extracts URL from request.url
      // but the method defaults to 'GET' since init is undefined
      expect(logger.debug).toHaveBeenCalledWith('[fetch-tracer] Request started', {
        correlationId: expect.any(String),
        method: 'GET', // Method from init?.method || 'GET', not from Request object
        url: 'https://api.example.com/test',
      });
    });

    it('should handle URL object as input', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';

      instrumentFetchTracer();

      const url = new URL('https://api.example.com/test');

      await globalThis.fetch(url);

      expect(logger.debug).toHaveBeenCalledWith('[fetch-tracer] Request started', {
        correlationId: expect.any(String),
        method: 'GET',
        url: 'https://api.example.com/test',
      });
    });
  });

  describe('Header redaction', () => {
    it('should redact sensitive headers in response', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';

      globalThis.fetch = jest.fn(async () => {
        return new Response('{}', {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'secret-api-key',
            Authorization: 'Bearer token',
            Cookie: 'session=abc123',
          },
        });
      }) as typeof fetch;

      instrumentFetchTracer();

      await globalThis.fetch('https://api.example.com/test');

      expect(logger.debug).toHaveBeenCalledWith('[fetch-tracer] Request completed', {
        correlationId: expect.any(String),
        method: 'GET',
        url: 'https://api.example.com/test',
        duration: expect.any(Number),
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-api-key': '[REDACTED]',
          authorization: '[REDACTED]',
          cookie: '[REDACTED]',
        },
        isSSE: false,
      });
    });

    it('should preserve non-sensitive headers', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';

      globalThis.fetch = jest.fn(async () => {
        return new Response('{}', {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': 'request-123',
            'User-Agent': 'test-agent',
          },
        });
      }) as typeof fetch;

      instrumentFetchTracer();

      await globalThis.fetch('https://api.example.com/test');

      expect(logger.debug).toHaveBeenCalledWith('[fetch-tracer] Request completed', {
        correlationId: expect.any(String),
        method: 'GET',
        url: 'https://api.example.com/test',
        duration: expect.any(Number),
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'request-123',
          'user-agent': 'test-agent',
        },
        isSSE: false,
      });
    });

    it('should handle case-insensitive header matching', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';

      globalThis.fetch = jest.fn(async () => {
        return new Response('{}', {
          status: 200,
          headers: {
            AUTHORIZATION: 'Bearer token',
            'X-API-KEY': 'secret',
          },
        });
      }) as typeof fetch;

      instrumentFetchTracer();

      await globalThis.fetch('https://api.example.com/test');

      expect(logger.debug).toHaveBeenCalledWith('[fetch-tracer] Request completed', {
        correlationId: expect.any(String),
        method: 'GET',
        url: 'https://api.example.com/test',
        duration: expect.any(Number),
        status: 200,
        headers: expect.objectContaining({
          authorization: '[REDACTED]',
          'x-api-key': '[REDACTED]',
        }),
        isSSE: false,
      });
    });
  });

  describe('SSE detection', () => {
    it('should detect server-sent events by content-type', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';

      globalThis.fetch = jest.fn(async () => {
        return new Response('data: test\n\n', {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
          },
        });
      }) as typeof fetch;

      instrumentFetchTracer();

      await globalThis.fetch('https://api.example.com/stream');

      expect(logger.debug).toHaveBeenCalledWith('[fetch-tracer] Request completed', {
        correlationId: expect.any(String),
        method: 'GET',
        url: 'https://api.example.com/stream',
        duration: expect.any(Number),
        status: 200,
        headers: {
          'content-type': 'text/event-stream',
        },
        isSSE: true,
      });
    });

    it('should not flag regular requests as SSE', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';

      globalThis.fetch = jest.fn(async () => {
        return new Response('{}', {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }) as typeof fetch;

      instrumentFetchTracer();

      await globalThis.fetch('https://api.example.com/test');

      expect(logger.debug).toHaveBeenCalledWith('[fetch-tracer] Request completed', {
        correlationId: expect.any(String),
        method: 'GET',
        url: 'https://api.example.com/test',
        duration: expect.any(Number),
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
        isSSE: false,
      });
    });
  });

  describe('Correlation ID', () => {
    it('should use same correlation ID for request start and completion', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';

      instrumentFetchTracer();

      await globalThis.fetch('https://api.example.com/test');

      const startCall = (logger.debug as jest.Mock).mock.calls.find(
        (call) => call[0] === '[fetch-tracer] Request started'
      );
      const completeCall = (logger.debug as jest.Mock).mock.calls.find(
        (call) => call[0] === '[fetch-tracer] Request completed'
      );

      expect(startCall).toBeDefined();
      expect(completeCall).toBeDefined();
      expect(startCall[1].correlationId).toBe(completeCall[1].correlationId);
    });

    it('should generate unique correlation IDs for different requests', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';

      instrumentFetchTracer();

      await globalThis.fetch('https://api.example.com/test1');
      await globalThis.fetch('https://api.example.com/test2');

      const startCalls = (logger.debug as jest.Mock).mock.calls.filter(
        (call) => call[0] === '[fetch-tracer] Request started'
      );

      expect(startCalls).toHaveLength(2);
      expect(startCalls[0][1].correlationId).not.toBe(startCalls[1][1].correlationId);
    });
  });

  describe('Error handling', () => {
    it('should log failed requests', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';

      const errorMessage = 'Network error';
      globalThis.fetch = jest.fn(async () => {
        throw new Error(errorMessage);
      }) as typeof fetch;

      instrumentFetchTracer();

      await expect(globalThis.fetch('https://api.example.com/test')).rejects.toThrow(errorMessage);

      expect(logger.error).toHaveBeenCalledWith('[fetch-tracer] Request failed', {
        correlationId: expect.any(String),
        method: 'GET',
        url: 'https://api.example.com/test',
        duration: expect.any(Number),
        error: `Error: ${errorMessage}`,
      });
    });

    it('should use same correlation ID for failed requests', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';

      globalThis.fetch = jest.fn(async () => {
        throw new Error('Network error');
      }) as typeof fetch;

      instrumentFetchTracer();

      await expect(globalThis.fetch('https://api.example.com/test')).rejects.toThrow();

      const startCall = (logger.debug as jest.Mock).mock.calls.find(
        (call) => call[0] === '[fetch-tracer] Request started'
      );
      const errorCall = (logger.error as jest.Mock).mock.calls.find(
        (call) => call[0] === '[fetch-tracer] Request failed'
      );

      expect(startCall).toBeDefined();
      expect(errorCall).toBeDefined();
      expect(startCall[1].correlationId).toBe(errorCall[1].correlationId);
    });

    it('should handle response clone failures gracefully', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';

      const mockResponse = new Response('test', { status: 200 });
      jest.spyOn(mockResponse, 'clone').mockImplementation(() => {
        throw new Error('Clone failed');
      });

      globalThis.fetch = jest.fn(async () => mockResponse) as typeof fetch;

      instrumentFetchTracer();

      await globalThis.fetch('https://api.example.com/test');

      expect(logger.warn).toHaveBeenCalledWith(
        '[fetch-tracer] Failed to clone response, logging without headers',
        {
          correlationId: expect.any(String),
          error: 'Error: Clone failed',
        }
      );

      expect(logger.debug).toHaveBeenCalledWith('[fetch-tracer] Request completed', {
        correlationId: expect.any(String),
        method: 'GET',
        url: 'https://api.example.com/test',
        duration: expect.any(Number),
        status: 200,
        headers: expect.any(Object),
        isSSE: false,
      });
    });
  });

  describe('Performance', () => {
    it('should calculate request duration', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';

      globalThis.fetch = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return new Response('{}', { status: 200 });
      }) as typeof fetch;

      instrumentFetchTracer();

      await globalThis.fetch('https://api.example.com/test');

      const completeCall = (logger.debug as jest.Mock).mock.calls.find(
        (call) => call[0] === '[fetch-tracer] Request completed'
      );

      expect(completeCall).toBeDefined();
      expect(completeCall[1].duration).toBeGreaterThanOrEqual(50);
      expect(completeCall[1].duration).toBeLessThan(200);
    });

    it('should have minimal overhead when tracing is disabled', async () => {
      process.env.FETCH_TRACE_ENABLED = 'false';

      instrumentFetchTracer();

      const start = performance.now();
      await globalThis.fetch('https://api.example.com/test');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('should have minimal overhead for non-matching URLs', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';
      process.env.FETCH_TRACE_INCLUDES = 'anthropic\\.com';

      instrumentFetchTracer();

      const start = performance.now();
      await globalThis.fetch('https://api.example.com/test');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
      expect(logger.debug).not.toHaveBeenCalledWith(
        '[fetch-tracer] Request started',
        expect.any(Object)
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle responses without content-type header', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';

      globalThis.fetch = jest.fn(async () => {
        return new Response('plain text', {
          status: 200,
        });
      }) as typeof fetch;

      instrumentFetchTracer();

      await globalThis.fetch('https://api.example.com/test');

      expect(logger.debug).toHaveBeenCalledWith('[fetch-tracer] Request completed', {
        correlationId: expect.any(String),
        method: 'GET',
        url: 'https://api.example.com/test',
        duration: expect.any(Number),
        status: 200,
        headers: expect.any(Object),
        isSSE: false,
      });
    });

    it('should handle empty response headers', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';

      globalThis.fetch = jest.fn(async () => {
        return new Response('', {
          status: 204,
        });
      }) as typeof fetch;

      instrumentFetchTracer();

      await globalThis.fetch('https://api.example.com/test');

      const completeCall = (logger.debug as jest.Mock).mock.calls.find(
        (call) => call[0] === '[fetch-tracer] Request completed'
      );

      expect(completeCall).toBeDefined();
      expect(completeCall[1].status).toBe(204);
      expect(completeCall[1].method).toBe('GET');
      expect(completeCall[1].url).toBe('https://api.example.com/test');
      expect(completeCall[1].isSSE).toBe(false);
    });

    it('should handle very long URLs', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';

      const longPath = '/api/' + 'x'.repeat(1000);
      const longUrl = `https://api.example.com${longPath}`;

      instrumentFetchTracer();

      await globalThis.fetch(longUrl);

      expect(logger.debug).toHaveBeenCalledWith('[fetch-tracer] Request started', {
        correlationId: expect.any(String),
        method: 'GET',
        url: longUrl,
      });
    });

    it('should handle concurrent requests', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';

      instrumentFetchTracer();

      await Promise.all([
        globalThis.fetch('https://api.example.com/test1'),
        globalThis.fetch('https://api.example.com/test2'),
        globalThis.fetch('https://api.example.com/test3'),
      ]);

      const startCalls = (logger.debug as jest.Mock).mock.calls.filter(
        (call) => call[0] === '[fetch-tracer] Request started'
      );

      expect(startCalls).toHaveLength(3);
    });
  });

  describe('Utility Functions', () => {
    describe('redactHeadersAdvanced', () => {
      it('should redact headers using advanced config', () => {
        const headers = new Headers({
          'x-api-key': 'secret',
          'Content-Type': 'application/json',
        });

        const result = redactHeadersAdvanced(headers);

        expect(result.headers['x-api-key']).toBe('[REDACTED]');
        expect(result.headers['content-type']).toBe('application/json');
        expect(result.redactedCount).toBe(1);
      });

      it('should work with plain objects', () => {
        const headers = {
          authorization: 'Bearer token',
          'User-Agent': 'test',
        };

        const result = redactHeadersAdvanced(headers);

        expect(result.headers.authorization).toBe('[REDACTED]');
        expect(result.headers['User-Agent']).toBe('test');
        expect(result.redactedCount).toBe(1);
      });
    });

    describe('safeCloneRequest', () => {
      it('should clone request successfully', async () => {
        const request = new Request('https://api.example.com/test', {
          method: 'POST',
          body: 'test data',
        });

        const result = await safeCloneRequest(request);

        expect(result.clone).not.toBeNull();
        expect(result.error).toBeNull();
        expect(result.isStreaming).toBe(false);
      });
    });

    describe('safeCloneResponse', () => {
      it('should clone response successfully', async () => {
        const response = new Response('test data', { status: 200 });

        const result = await safeCloneResponse(response);

        expect(result.clone).not.toBeNull();
        expect(result.error).toBeNull();
        expect(result.isStreaming).toBe(false);
      });
    });

    describe('safeReadBody', () => {
      it('should read JSON body', async () => {
        const data = { message: 'test' };
        const request = new Request('https://api.example.com/test', {
          method: 'POST',
          body: JSON.stringify(data),
        });

        const result = await safeReadBody(request, 'json');

        expect(result.body).toEqual(data);
        expect(result.error).toBeNull();
        expect(result.bodyType).toBe('json');
      });

      it('should read text body', async () => {
        const request = new Request('https://api.example.com/test', {
          method: 'POST',
          body: 'plain text',
        });

        const result = await safeReadBody(request, 'text');

        expect(result.body).toBe('plain text');
        expect(result.error).toBeNull();
        expect(result.bodyType).toBe('text');
      });

      it('should fallback to text when JSON parsing fails', async () => {
        const response = new Response('not json', { status: 200 });

        jest.spyOn(response, 'json').mockRejectedValueOnce(new Error('Unexpected token'));
        jest.spyOn(response, 'text').mockResolvedValueOnce('not json');

        const result = await safeReadBody(response, 'json');

        expect(result.body).toBe('not json');
        expect(result.error).toBeNull();
        expect(result.bodyType).toBe('text');
        expect(logger.debug).toHaveBeenCalledWith(
          '[fetch-tracer] Failed to parse as JSON, falling back to text',
          expect.objectContaining({ error: expect.any(String) })
        );
      });
    });

    describe('captureRequestMetadata', () => {
      it('should capture request metadata with headers and body', async () => {
        const request = new Request('https://api.example.com/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'secret',
          },
          body: JSON.stringify({ test: 'data' }),
        });

        const metadata = await captureRequestMetadata(request);

        expect(metadata.url).toBe('https://api.example.com/test');
        expect(metadata.method).toBe('POST');
        expect(metadata.headers['x-api-key']).toBe('[REDACTED]');
        expect(metadata.headers['content-type']).toBe('application/json');
        expect(metadata.redactedHeaderCount).toBe(1);
        expect(metadata.body).toBe('{"test":"data"}');
        expect(metadata.timestamp).toBeDefined();
      });

      it('should use custom redaction config', async () => {
        const request = new Request('https://api.example.com/test', {
          headers: { 'custom-secret': 'value' },
        });

        const config = {
          sensitiveHeaders: ['custom-secret'],
          redactedValue: '***',
        };

        const metadata = await captureRequestMetadata(request, config);

        expect(metadata.headers['custom-secret']).toBe('***');
        expect(metadata.redactedHeaderCount).toBe(1);
      });
    });

    describe('captureResponseMetadata', () => {
      it('should capture response metadata with duration', async () => {
        const requestTimestamp = Date.now() - 100;
        const response = new Response(JSON.stringify({ result: 'success' }), {
          status: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': 'session=abc',
          },
        });

        Object.defineProperty(response, 'url', {
          value: 'https://api.example.com/test',
          writable: false,
        });

        const metadata = await captureResponseMetadata(response, requestTimestamp);

        expect(metadata.url).toBe('https://api.example.com/test');
        expect(metadata.status).toBe(200);
        expect(metadata.statusText).toBe('OK');
        expect(metadata.headers['set-cookie']).toBe('[REDACTED]');
        expect(metadata.redactedHeaderCount).toBe(1);
        expect(metadata.body).toEqual({ result: 'success' });
        expect(metadata.duration).toBeGreaterThanOrEqual(100);
        expect(metadata.timestamp).toBeDefined();
      });

      it('should use custom redaction config', async () => {
        const requestTimestamp = Date.now();
        const response = new Response('{}', {
          headers: { 'custom-header': 'secret' },
        });

        Object.defineProperty(response, 'url', {
          value: 'https://api.example.com/test',
          writable: false,
        });

        const config = {
          sensitiveHeaders: ['custom-header'],
          redactedValue: 'HIDDEN',
        };

        const metadata = await captureResponseMetadata(response, requestTimestamp, config);

        expect(metadata.headers['custom-header']).toBe('HIDDEN');
        expect(metadata.redactedHeaderCount).toBe(1);
      });
    });

    describe('DEFAULT_REDACTION_CONFIG', () => {
      it('should have correct default values', () => {
        expect(DEFAULT_REDACTION_CONFIG.sensitiveHeaders).toEqual([
          'x-api-key',
          'authorization',
          'cookie',
          'set-cookie',
        ]);
        expect(DEFAULT_REDACTION_CONFIG.redactedValue).toBe('[REDACTED]');
      });
    });
  });

  describe('Cache Integration', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      uninstrumentFetchTracer();
      globalThis.fetch = originalFetch;
      process.env = { ...originalProcessEnv };
    });

    it('should check cache before making fetch request', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';
      process.env.FETCH_CACHE_ENABLED = 'true';

      globalThis.fetch = jest.fn(async () => {
        return new Response(JSON.stringify({ result: 'from-network' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch;

      instrumentFetchTracer();

      await globalThis.fetch('https://api.example.com/test');

      expect(logger.debug).toHaveBeenCalledWith('[fetch-tracer] Cache miss', expect.any(Object));
    });

    it('should return cached response on cache hit', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';
      process.env.FETCH_CACHE_ENABLED = 'true';

      globalThis.fetch = jest.fn(async () => {
        return new Response(JSON.stringify({ result: 'from-network' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch;

      instrumentFetchTracer();

      await globalThis.fetch('https://api.example.com/test');
      const response = await globalThis.fetch('https://api.example.com/test');

      const body = await response.json();
      expect(body).toEqual({ result: 'from-network' });
      expect(logger.debug).toHaveBeenCalledWith('[fetch-tracer] Cache hit', expect.any(Object));
    });

    it('should not cache SSE stream responses', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';
      process.env.FETCH_CACHE_ENABLED = 'true';

      globalThis.fetch = jest.fn(async () => {
        return new Response('data: test\n\n', {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        });
      }) as typeof fetch;

      instrumentFetchTracer();

      await globalThis.fetch('https://api.example.com/stream');
      await globalThis.fetch('https://api.example.com/stream');

      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      expect(logger.debug).not.toHaveBeenCalledWith('[fetch-tracer] Cache hit', expect.any(Object));
    });

    it('should not cache 4xx error responses', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';
      process.env.FETCH_CACHE_ENABLED = 'true';

      globalThis.fetch = jest.fn(async () => {
        return new Response('Not found', { status: 404 });
      }) as typeof fetch;

      instrumentFetchTracer();

      await globalThis.fetch('https://api.example.com/not-found');
      await globalThis.fetch('https://api.example.com/not-found');

      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      expect(logger.debug).not.toHaveBeenCalledWith('[fetch-tracer] Cache hit', expect.any(Object));
    });

    it('should not cache 5xx error responses', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';
      process.env.FETCH_CACHE_ENABLED = 'true';

      globalThis.fetch = jest.fn(async () => {
        return new Response('Server error', { status: 500 });
      }) as typeof fetch;

      instrumentFetchTracer();

      await globalThis.fetch('https://api.example.com/error');
      await globalThis.fetch('https://api.example.com/error');

      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      expect(logger.debug).not.toHaveBeenCalledWith('[fetch-tracer] Cache hit', expect.any(Object));
    });

    it('should respect URL include filter for caching', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';
      process.env.FETCH_CACHE_ENABLED = 'true';
      process.env.FETCH_TRACE_INCLUDES = 'anthropic\\.com';

      globalThis.fetch = jest.fn(async () => {
        return new Response('{}', { status: 200 });
      }) as typeof fetch;

      instrumentFetchTracer();

      await globalThis.fetch('https://api.example.com/test');
      await globalThis.fetch('https://api.example.com/test');

      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      expect(logger.debug).not.toHaveBeenCalledWith('[fetch-tracer] Cache hit', expect.any(Object));
    });

    it('should log cache statistics', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';
      process.env.FETCH_CACHE_ENABLED = 'true';

      globalThis.fetch = jest.fn(async () => {
        return new Response('{}', { status: 200 });
      }) as typeof fetch;

      instrumentFetchTracer();

      await globalThis.fetch('https://api.example.com/test');
      await globalThis.fetch('https://api.example.com/test');

      expect(logger.info).toHaveBeenCalledWith(
        '[fetch-tracer] Cache statistics',
        expect.objectContaining({
          hits: expect.any(Number),
          misses: expect.any(Number),
          hitRate: expect.any(Number),
        })
      );
    });

    it('should handle cache disabled state', async () => {
      process.env.FETCH_TRACE_ENABLED = 'true';
      process.env.FETCH_CACHE_ENABLED = 'false';

      globalThis.fetch = jest.fn(async () => {
        return new Response('{}', { status: 200 });
      }) as typeof fetch;

      instrumentFetchTracer();

      await globalThis.fetch('https://api.example.com/test');
      await globalThis.fetch('https://api.example.com/test');

      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      expect(logger.debug).not.toHaveBeenCalledWith('[fetch-tracer] Cache hit', expect.any(Object));
    });
  });
});
