/**
 * MessageErrorHandlers Tests
 *
 * Test suite for message error handling with toast notifications and error batching
 * Following TDD approach (Red-Green-Refactor)
 */

import { MessageErrorHandlers } from '@/services/MessageErrorHandlers';
import { logger } from '@/commons/utils/logger';

// Mock logger
jest.mock('@/commons/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('MessageErrorHandlers', () => {
  let errorHandlers: MessageErrorHandlers;
  let mockShowToast: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockShowToast = jest.fn();
    errorHandlers = new MessageErrorHandlers(mockShowToast);
  });

  describe('Error Logging', () => {
    it('should log validation errors with context', () => {
      const error = new Error('Invalid message format');

      errorHandlers.handleValidationError(error, {
        messageId: 'msg-123',
        agentId: 'agent-456',
      });

      expect(logger.error).toHaveBeenCalledWith(
        '[MessageErrorHandlers] Validation error',
        expect.objectContaining({
          error: error.message,
          messageId: 'msg-123',
          agentId: 'agent-456',
        })
      );
    });

    it('should log streaming errors with session context', () => {
      const error = new Error('Stream connection lost');

      errorHandlers.handleStreamingError(error, {
        sessionId: 'session-789',
        agentId: 'agent-456',
      });

      expect(logger.error).toHaveBeenCalledWith(
        '[MessageErrorHandlers] Streaming error',
        expect.objectContaining({
          error: error.message,
          sessionId: 'session-789',
          agentId: 'agent-456',
        })
      );
    });

    it('should log permission errors with tool context', () => {
      const error = new Error('Permission denied for tool: ReadFile');

      errorHandlers.handlePermissionError(error, {
        toolName: 'ReadFile',
        filePath: '/path/to/file.txt',
        agentId: 'agent-456',
      });

      expect(logger.error).toHaveBeenCalledWith(
        '[MessageErrorHandlers] Permission error',
        expect.objectContaining({
          error: error.message,
          toolName: 'ReadFile',
          filePath: '/path/to/file.txt',
        })
      );
    });
  });

  describe('Toast Notifications', () => {
    it('should show error toast for validation errors', () => {
      jest.useFakeTimers();
      const error = new Error('Invalid message format');

      errorHandlers.handleValidationError(error, { messageId: 'msg-123' });

      // Advance timer to trigger batch flush
      jest.advanceTimersByTime(1000);

      expect(mockShowToast).toHaveBeenCalledWith(
        'Invalid message format',
        'error',
        expect.any(Number)
      );
      jest.useRealTimers();
    });

    it('should show error toast for streaming errors', () => {
      const error = new Error('Stream connection lost');

      errorHandlers.handleStreamingError(error, { sessionId: 'session-789' });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Stream connection lost',
        'error',
        expect.any(Number)
      );
    });

    it('should use custom toast duration when provided', () => {
      jest.useFakeTimers();
      const error = new Error('Test error');

      errorHandlers.handleValidationError(error, {
        messageId: 'msg-123',
        toastDuration: 5000,
      });

      // Advance timer to trigger batch flush
      jest.advanceTimersByTime(1000);

      expect(mockShowToast).toHaveBeenCalledWith('Test error', 'error', 5000);
      jest.useRealTimers();
    });
  });

  describe('Error Batching', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should batch multiple validation errors within time window', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');
      const error3 = new Error('Error 3');

      errorHandlers.handleValidationError(error1, { messageId: 'msg-1' });
      errorHandlers.handleValidationError(error2, { messageId: 'msg-2' });
      errorHandlers.handleValidationError(error3, { messageId: 'msg-3' });

      // Advance timer to trigger batch flush
      jest.advanceTimersByTime(1000);

      // Should only show one batched toast
      expect(mockShowToast).toHaveBeenCalledTimes(1);
      expect(mockShowToast).toHaveBeenCalledWith(
        '3 validation errors occurred',
        'error',
        expect.any(Number)
      );
    });

    it('should flush batched errors after timeout', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      errorHandlers.handleValidationError(error1, { messageId: 'msg-1' });
      errorHandlers.handleValidationError(error2, { messageId: 'msg-2' });

      jest.advanceTimersByTime(2000); // Default batch window is 1000ms

      // Should have flushed the batch
      expect(mockShowToast).toHaveBeenCalledWith(
        '2 validation errors occurred',
        'error',
        expect.any(Number)
      );
    });

    it('should continue batching errors across flushes', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      errorHandlers.handleValidationError(error1, { messageId: 'msg-1' });
      jest.advanceTimersByTime(1000);

      // First error should be shown as single error
      expect(mockShowToast).toHaveBeenCalledWith('Error 1', 'error', expect.any(Number));

      mockShowToast.mockClear();

      errorHandlers.handleValidationError(error2, { messageId: 'msg-2' });
      jest.advanceTimersByTime(1000);

      // Second batch now has 2 total errors (first error still in batch for "View Details")
      expect(mockShowToast).toHaveBeenCalledWith(
        '2 validation errors occurred',
        'error',
        expect.any(Number)
      );
    });

    it('should provide "View Details" action for batched errors', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      errorHandlers.handleValidationError(error1, { messageId: 'msg-1' });
      errorHandlers.handleValidationError(error2, { messageId: 'msg-2' });

      const batchedErrors = errorHandlers.getBatchedErrors();
      expect(batchedErrors).toHaveLength(2);
      expect(batchedErrors[0]).toMatchObject({
        message: 'Error 1',
        context: { messageId: 'msg-1' },
      });
    });
  });

  describe('Error Context', () => {
    it('should include timestamp in error context', () => {
      const error = new Error('Test error');
      const now = Date.now();

      errorHandlers.handleValidationError(error, { messageId: 'msg-123' });

      expect(logger.error).toHaveBeenCalledWith(
        '[MessageErrorHandlers] Validation error',
        expect.objectContaining({
          timestamp: expect.any(Number),
        })
      );

      const loggedTimestamp = (logger.error as jest.Mock).mock.calls[0][1].timestamp;
      expect(loggedTimestamp).toBeGreaterThanOrEqual(now);
    });

    it('should preserve all context properties', () => {
      const error = new Error('Test error');
      const context = {
        messageId: 'msg-123',
        agentId: 'agent-456',
        customField: 'custom-value',
      };

      errorHandlers.handleValidationError(error, context);

      expect(logger.error).toHaveBeenCalledWith(
        '[MessageErrorHandlers] Validation error',
        expect.objectContaining({
          messageId: 'msg-123',
          agentId: 'agent-456',
          customField: 'custom-value',
        })
      );
    });
  });

  describe('Error Types', () => {
    it('should handle different error types', () => {
      const stringError = 'String error';
      const objectError = { message: 'Object error', code: 'ERR_001' };

      errorHandlers.handleValidationError(stringError, { messageId: 'msg-1' });
      errorHandlers.handleValidationError(objectError, { messageId: 'msg-2' });

      expect(logger.error).toHaveBeenCalledWith(
        '[MessageErrorHandlers] Validation error',
        expect.objectContaining({
          error: 'String error',
        })
      );

      expect(logger.error).toHaveBeenCalledWith(
        '[MessageErrorHandlers] Validation error',
        expect.objectContaining({
          error: 'Object error',
        })
      );
    });

    it('should extract error message from Error instances', () => {
      const error = new Error('Standard error');

      errorHandlers.handleValidationError(error, { messageId: 'msg-123' });

      expect(logger.error).toHaveBeenCalledWith(
        '[MessageErrorHandlers] Validation error',
        expect.objectContaining({
          error: 'Standard error',
        })
      );
    });

    it('should handle errors without messages', () => {
      const error = {} as Error;

      errorHandlers.handleValidationError(error, { messageId: 'msg-123' });

      expect(logger.error).toHaveBeenCalledWith(
        '[MessageErrorHandlers] Validation error',
        expect.objectContaining({
          error: 'Unknown error',
        })
      );
    });
  });

  describe('Chat Store Integration', () => {
    it('should track validation errors per agent', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      errorHandlers.handleValidationError(error1, { agentId: 'agent-1', messageId: 'msg-1' });
      errorHandlers.handleValidationError(error2, { agentId: 'agent-1', messageId: 'msg-2' });

      const agentErrors = errorHandlers.getErrorsForAgent('agent-1');
      expect(agentErrors).toHaveLength(2);
    });

    it('should clear errors for specific agent', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      errorHandlers.handleValidationError(error1, { agentId: 'agent-1', messageId: 'msg-1' });
      errorHandlers.handleValidationError(error2, { agentId: 'agent-2', messageId: 'msg-2' });

      errorHandlers.clearAgentErrors('agent-1');

      expect(errorHandlers.getErrorsForAgent('agent-1')).toHaveLength(0);
      expect(errorHandlers.getErrorsForAgent('agent-2')).toHaveLength(1);
    });

    it('should clear all errors', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      errorHandlers.handleValidationError(error1, { agentId: 'agent-1', messageId: 'msg-1' });
      errorHandlers.handleValidationError(error2, { agentId: 'agent-2', messageId: 'msg-2' });

      errorHandlers.clearAllErrors();

      expect(errorHandlers.getErrorsForAgent('agent-1')).toHaveLength(0);
      expect(errorHandlers.getErrorsForAgent('agent-2')).toHaveLength(0);
    });
  });

  describe('Performance', () => {
    it('should handle high volume of errors without memory leaks', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 1000; i++) {
        errorHandlers.handleValidationError(new Error(`Error ${i}`), { messageId: `msg-${i}` });
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Should not increase memory by more than 10MB for 1000 errors
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should batch errors efficiently', () => {
      jest.useFakeTimers();

      for (let i = 0; i < 100; i++) {
        errorHandlers.handleValidationError(new Error(`Error ${i}`), { messageId: `msg-${i}` });
      }

      // Advance timer to trigger batch flush
      jest.advanceTimersByTime(1000);

      // Should only call toast once for batched errors
      expect(mockShowToast).toHaveBeenCalledTimes(1);
      expect(mockShowToast).toHaveBeenCalledWith(
        '100 validation errors occurred',
        'error',
        expect.any(Number)
      );

      jest.useRealTimers();
    });
  });
});
