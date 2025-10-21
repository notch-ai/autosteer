import { ErrorHandler, ErrorDetails } from '@/main/utils/errorHandler';

// Mock electron-log before using it
jest.mock('electron-log/main', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

import log from 'electron-log/main';

describe('ErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getErrorMessage', () => {
    it('should return message from Error object', () => {
      const error = new Error('Test error message');
      expect(ErrorHandler.getErrorMessage(error)).toBe('Test error message');
    });

    it('should return message from error with message property', () => {
      const error = { message: 'Custom error message' };
      expect(ErrorHandler.getErrorMessage(error)).toBe('Custom error message');
    });

    it('should return string error as is', () => {
      const error = 'String error message';
      expect(ErrorHandler.getErrorMessage(error)).toBe('String error message');
    });

    it('should handle null and undefined', () => {
      expect(ErrorHandler.getErrorMessage(null)).toBe('An unknown error occurred');
      expect(ErrorHandler.getErrorMessage(undefined)).toBe('An unknown error occurred');
    });

    it('should handle objects without message property', () => {
      const error = { code: 'ERROR_CODE', data: 'some data' };
      expect(ErrorHandler.getErrorMessage(error)).toBe('An unknown error occurred');
    });

    it('should convert non-string message property to string', () => {
      const error = { message: 123 };
      expect(ErrorHandler.getErrorMessage(error)).toBe('123');
    });
  });

  describe('log', () => {
    it('should log error with timestamp and return message', () => {
      const error = new Error('Test error');
      const details: ErrorDetails = {
        operation: 'testOperation',
        error,
        context: { key: 'value' },
      };

      const message = ErrorHandler.log(details);

      expect(message).toBe('Test error');
      expect(log.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] Error in testOperation:$/
        ),
        expect.objectContaining({
          message: 'Test error',
          error,
          context: { key: 'value' },
          stack: error.stack,
        })
      );
    });

    it('should handle non-Error objects', () => {
      const details: ErrorDetails = {
        operation: 'testOperation',
        error: 'string error',
      };

      const message = ErrorHandler.log(details);

      expect(message).toBe('string error');
      expect(log.error).toHaveBeenCalledWith(
        expect.stringMatching(/Error in testOperation:/),
        expect.objectContaining({
          message: 'string error',
          error: 'string error',
          stack: undefined,
        })
      );
    });

    it('should handle errors without context', () => {
      const error = new Error('Test error');
      const details: ErrorDetails = {
        operation: 'testOperation',
        error,
      };

      const message = ErrorHandler.log(details);

      expect(message).toBe('Test error');
      expect(log.error).toHaveBeenCalledWith(
        expect.stringMatching(/Error in testOperation:/),
        expect.objectContaining({
          message: 'Test error',
          error,
          context: undefined,
        })
      );
    });
  });

  describe('formatUserMessage', () => {
    it('should format generic error message', () => {
      const error = new Error('Generic error');
      const message = ErrorHandler.formatUserMessage('perform action', error);
      expect(message).toBe('Failed to perform action: Generic error');
    });

    it('should handle remote branch not found error', () => {
      const error = new Error('Remote branch feature/test not found');
      const message = ErrorHandler.formatUserMessage('fetch branch', error);
      expect(message).toBe('Branch does not exist in remote repository. It will be created.');
    });

    it('should handle connection errors', () => {
      const error = new Error('Could not resolve host: github.com');
      const message = ErrorHandler.formatUserMessage('clone repository', error);
      expect(message).toBe(
        'Unable to connect to repository. Please check your internet connection and repository URL.'
      );
    });

    it('should handle authentication errors', () => {
      const error1 = new Error('Permission denied (publickey)');
      const message1 = ErrorHandler.formatUserMessage('push changes', error1);
      expect(message1).toBe(
        'Authentication failed. Please check your Git credentials and repository permissions.'
      );

      const error2 = new Error('Authentication failed for repository');
      const message2 = ErrorHandler.formatUserMessage('fetch', error2);
      expect(message2).toBe(
        'Authentication failed. Please check your Git credentials and repository permissions.'
      );
    });

    it('should handle repository not found errors', () => {
      const error = new Error('Repository not found');
      const message = ErrorHandler.formatUserMessage('clone', error);
      expect(message).toBe(
        'Repository not found. Please check the URL is correct and you have access.'
      );
    });

    it('should handle already exists errors', () => {
      const error = new Error('Worktree already exists at path');
      const message = ErrorHandler.formatUserMessage('create worktree', error);
      expect(message).toBe('A worktree with this name already exists.');
    });

    it('should handle string errors', () => {
      const error = 'Simple string error';
      const message = ErrorHandler.formatUserMessage('do something', error);
      expect(message).toBe('Failed to do something: Simple string error');
    });

    it('should handle unknown error types', () => {
      const error = { code: 'UNKNOWN' };
      const message = ErrorHandler.formatUserMessage('process', error);
      expect(message).toBe('Failed to process: An unknown error occurred');
    });
  });
});
