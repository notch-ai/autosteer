/**
 * GlobalErrorHandler Test Suite
 * Tests the core error handling service including error categorization,
 * severity assessment, deduplication, and toast notifications
 */

import { toast } from 'sonner';

// Mock Sonner toast library
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
  },
}));

// Mock logger
jest.mock('@/commons/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import after mocks are set up
import { globalErrorHandler } from '@/renderer/services/GlobalErrorHandler';
import { logger } from '@/commons/utils/logger';

describe('GlobalErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the handler's internal state if it exists (real implementation)
    if ((globalErrorHandler as any).recentErrors) {
      (globalErrorHandler as any).recentErrors.clear();
    }
    if ((globalErrorHandler as any).errorCounts) {
      (globalErrorHandler as any).errorCounts.clear();
    }
  });

  describe('Error Handling', () => {
    it('should handle authentication errors with high severity', () => {
      const error = new Error('Authentication failed: Invalid API key');
      globalErrorHandler.handle(error, {
        subsystem: 'service',
        operation: 'api_call',
      });

      expect(logger.error).toHaveBeenCalledWith(
        '[GlobalErrorHandler] Error handled',
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Authentication failed: Invalid API key',
          }),
          context: expect.objectContaining({
            subsystem: 'service',
            operation: 'api_call',
          }),
        })
      );

      // High severity auth errors show error toast
      expect(toast.error).toHaveBeenCalled();
    });

    it('should handle network errors appropriately', () => {
      const error = new Error('ECONNREFUSED: Connection refused');
      globalErrorHandler.handle(error, {
        subsystem: 'service',
        operation: 'network_request',
      });

      expect(toast.error).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });


    it('should handle IPC errors as high severity', () => {
      const error = new Error('IPC channel error');
      globalErrorHandler.handle(error, {
        subsystem: 'ipc',
        operation: 'invoke',
        channel: 'test:channel',
      });

      // IPC errors are high severity
      expect(toast.error).toHaveBeenCalled();
    });

    it('should handle handler subsystem errors as critical', () => {
      const error = new Error('Critical system error');
      globalErrorHandler.handle(error, {
        subsystem: 'handler',
        operation: 'process',
      });

      // Handler subsystem errors are critical
      expect(toast.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          closeButton: true,
        })
      );
    });
  });

  describe('Error Deduplication', () => {
    it('should deduplicate identical errors within 5-second window', () => {
      const error = new Error('Duplicate error message');
      const context = { subsystem: 'service' as const, operation: 'test' };

      // First occurrence
      globalErrorHandler.handle(error, context);
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledTimes(1);

      // Second occurrence (should be deduplicated)
      globalErrorHandler.handle(error, context);
      expect(toast.error).toHaveBeenCalledTimes(1); // Still only 1 call
      expect(logger.debug).toHaveBeenCalledWith(
        '[GlobalErrorHandler] Duplicate error suppressed',
        expect.any(Object)
      );
    });

    it('should show different errors even within dedup window', () => {
      const error1 = new Error('First error');
      const error2 = new Error('Second error');
      const context = { subsystem: 'service' as const, operation: 'test' };

      globalErrorHandler.handle(error1, context);
      globalErrorHandler.handle(error2, context);

      expect(toast.error).toHaveBeenCalledTimes(2);
    });
  });

  describe('User-Friendly Messages', () => {

    it('should generate appropriate message for rate limit errors', () => {
      const error = new Error('429: Too Many Requests - Rate limit exceeded');
      globalErrorHandler.handle(error, {
        subsystem: 'service',
        operation: 'api_call',
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Too many requests'),
        expect.any(Object)
      );
    });

    it('should generate appropriate message for network errors', () => {
      const error = new Error('ETIMEDOUT: Connection timeout');
      globalErrorHandler.handle(error, {
        subsystem: 'service',
        operation: 'fetch',
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('timed out'),
        expect.any(Object)
      );
    });

    it('should handle permission errors', () => {
      const error = new Error('EACCES: Permission denied');
      globalErrorHandler.handle(error, {
        subsystem: 'store',
        operation: 'file_write',
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Permission'),
        expect.any(Object)
      );
    });
  });

  describe('Error Normalization', () => {
    it('should handle non-Error objects', () => {
      const notAnError = 'String error';

      globalErrorHandler.handle(notAnError as any, {
        subsystem: 'service',
        operation: 'test',
      });

      expect(logger.error).toHaveBeenCalledWith(
        '[GlobalErrorHandler] Error handled',
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'String error',
          }),
        })
      );
    });

    it('should handle objects with message property', () => {
      const errorLike = { message: 'Error-like object', code: 'TEST' };

      globalErrorHandler.handle(errorLike as any, {
        subsystem: 'service',
        operation: 'test',
      });

      expect(logger.error).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalled();
    });

    it('should handle null/undefined gracefully', () => {
      globalErrorHandler.handle(null as any, {
        subsystem: 'service',
        operation: 'test',
      });

      expect(logger.error).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalled();
    });
  });

  describe('Context Enhancement', () => {
    it('should include full context in error logs', () => {
      const error = new Error('Test error');

      globalErrorHandler.handle(error, {
        subsystem: 'service',
        operation: 'test_operation',
        service: 'TestService',
        metadata: {
          userId: '123',
          sessionId: 'abc',
        },
      });

      expect(logger.error).toHaveBeenCalledWith(
        '[GlobalErrorHandler] Error handled',
        expect.objectContaining({
          context: expect.objectContaining({
            subsystem: 'service',
            operation: 'test_operation',
            service: 'TestService',
            metadata: {
              userId: '123',
              sessionId: 'abc',
            },
          }),
        })
      );
    });
  });

  describe('SDK Error Format', () => {

    it('should handle session terminated errors', () => {
      const error = new Error('Session terminated. Please restart the conversation.');
      globalErrorHandler.handle(error, {
        subsystem: 'service',
        operation: 'session_check',
      });

      expect(toast.error).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Toast Duration', () => {
    it('should use longer duration for critical errors', () => {
      const error = new Error('Critical error');
      globalErrorHandler.handle(error, {
        subsystem: 'handler', // Handler subsystem = critical
        operation: 'test',
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          duration: 10000, // Critical = 10s
        })
      );
    });

    it('should use appropriate duration for React errors', () => {
      const error = new Error('React error');
      globalErrorHandler.handle(error, {
        subsystem: 'react', // React subsystem = low severity
        operation: 'render',
      });

      expect(toast.warning).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          duration: 3000, // Low = 3s
        })
      );
    });
  });
});