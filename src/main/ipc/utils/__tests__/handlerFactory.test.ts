// Mock electron-log/main before any imports
jest.mock('electron-log/main', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock the main logger
jest.mock('@/main/services/logger', () => ({
  mainLogger: {
    setDevelopmentMode: jest.fn(),
  },
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { log } from '@/main/services/logger';
import { IpcMainInvokeEvent } from 'electron';
import {
  createIpcHandler,
  validateInput,
  formatSuccessResponse,
  formatErrorResponse,
} from '../handlerFactory';

describe('handlerFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('formatSuccessResponse', () => {
    it('should format success response with data', () => {
      const data = { id: '123', name: 'Test' };
      const result = formatSuccessResponse(data);

      expect(result).toEqual({
        success: true,
        data,
      });
    });

    it('should format success response without data', () => {
      const result = formatSuccessResponse();

      expect(result).toEqual({
        success: true,
      });
    });

    it('should format success response with null data', () => {
      const result = formatSuccessResponse(null);

      expect(result).toEqual({
        success: true,
        data: null,
      });
    });
  });

  describe('formatErrorResponse', () => {
    it('should format error response from Error instance', () => {
      const error = new Error('Test error');
      const result = formatErrorResponse(error);

      expect(result).toEqual({
        success: false,
        error: 'Test error',
      });
    });

    it('should format error response from string', () => {
      const error = 'String error message';
      const result = formatErrorResponse(error);

      expect(result).toEqual({
        success: false,
        error: 'String error message',
      });
    });

    it('should format error response from unknown type', () => {
      const error = { custom: 'error object' };
      const result = formatErrorResponse(error);

      expect(result).toEqual({
        success: false,
        error: 'An unknown error occurred',
      });
    });

    it('should format error response with custom message', () => {
      const error = new Error('Original error');
      const result = formatErrorResponse(error, 'Custom error message');

      expect(result).toEqual({
        success: false,
        error: 'Custom error message',
      });
    });
  });

  describe('validateInput', () => {
    it('should pass validation for valid input', () => {
      const validator = (input: any) => {
        if (typeof input !== 'string') {
          throw new Error('Input must be a string');
        }
      };

      expect(() => validateInput('valid string', validator)).not.toThrow();
    });

    it('should throw error for invalid input', () => {
      const validator = (input: any) => {
        if (typeof input !== 'string') {
          throw new Error('Input must be a string');
        }
      };

      expect(() => validateInput(123, validator)).toThrow('Input must be a string');
    });

    it('should handle multiple validation rules', () => {
      const validator = (input: any) => {
        if (!input) {
          throw new Error('Input is required');
        }
        if (typeof input !== 'string') {
          throw new Error('Input must be a string');
        }
        if (input.length < 3) {
          throw new Error('Input must be at least 3 characters');
        }
      };

      expect(() => validateInput('ab', validator)).toThrow('Input must be at least 3 characters');
      expect(() => validateInput(null, validator)).toThrow('Input is required');
      expect(() => validateInput('valid', validator)).not.toThrow();
    });
  });

  describe('createIpcHandler', () => {
    const mockEvent = {} as IpcMainInvokeEvent;

    describe('basic functionality', () => {
      it('should wrap handler and return success response', async () => {
        const handler = async (_event: IpcMainInvokeEvent, input: string) => {
          return { result: input.toUpperCase() };
        };

        const wrappedHandler = createIpcHandler(handler, {
          operation: 'test operation',
        });

        const result = await wrappedHandler(mockEvent, 'hello');

        expect(result).toEqual({
          success: true,
          data: { result: 'HELLO' },
        });
      });

      it('should handle handler without return value', async () => {
        const handler = async (_event: IpcMainInvokeEvent) => {
          // void operation
        };

        const wrappedHandler = createIpcHandler(handler, {
          operation: 'void operation',
        });

        const result = await wrappedHandler(mockEvent);

        expect(result).toEqual({
          success: true,
        });
      });

      it('should handle handler with multiple arguments', async () => {
        const handler = async (_event: IpcMainInvokeEvent, a: number, b: number) => {
          return a + b;
        };

        const wrappedHandler = createIpcHandler(handler, {
          operation: 'add numbers',
        });

        const result = await wrappedHandler(mockEvent, 5, 3);

        expect(result).toEqual({
          success: true,
          data: 8,
        });
      });
    });

    describe('error handling', () => {
      it('should catch and format errors from handler', async () => {
        const handler = async (_event: IpcMainInvokeEvent) => {
          throw new Error('Handler error');
        };

        const wrappedHandler = createIpcHandler(handler, {
          operation: 'test operation',
        });

        const result = await wrappedHandler(mockEvent);

        expect(result).toEqual({
          success: false,
          error: 'Handler error',
        });
      });

      it('should log error details', async () => {
        const handler = async (_event: IpcMainInvokeEvent) => {
          throw new Error('Handler error');
        };

        const wrappedHandler = createIpcHandler(handler, {
          operation: 'test operation',
        });

        await wrappedHandler(mockEvent);

        expect(log.error).toHaveBeenCalledWith(
          '[IPC] Error in test operation:',
          expect.objectContaining({
            message: 'Handler error',
            error: expect.any(Error),
          })
        );
      });

      it('should include context in error logs', async () => {
        const handler = async (_event: IpcMainInvokeEvent, _input: string) => {
          throw new Error('Handler error');
        };

        const wrappedHandler = createIpcHandler(handler, {
          operation: 'test operation',
        });

        await wrappedHandler(mockEvent, 'test-input');

        expect(log.error).toHaveBeenCalledWith(
          '[IPC] Error in test operation:',
          expect.objectContaining({
            message: 'Handler error',
            error: expect.any(Error),
            args: ['test-input'],
          })
        );
      });

      it('should handle non-Error exceptions', async () => {
        const handler = async (_event: IpcMainInvokeEvent) => {
          throw 'String error';
        };

        const wrappedHandler = createIpcHandler(handler, {
          operation: 'test operation',
        });

        const result = await wrappedHandler(mockEvent);

        expect(result).toEqual({
          success: false,
          error: 'String error',
        });
      });

      it('should handle error objects with message property', async () => {
        const handler = async (_event: IpcMainInvokeEvent) => {
          // eslint-disable-next-line prefer-promise-reject-errors
          throw { message: 'Custom error object' };
        };

        const wrappedHandler = createIpcHandler(handler, {
          operation: 'test operation',
        });

        const result = await wrappedHandler(mockEvent);

        expect(result).toEqual({
          success: false,
          error: 'Custom error object',
        });
      });
    });

    describe('input validation', () => {
      it('should validate input before handler execution', async () => {
        const handler = async (_event: IpcMainInvokeEvent, _input: string) => {
          return _input.toUpperCase();
        };

        const validator = (input: any) => {
          if (typeof input !== 'string') {
            throw new Error('Input must be a string');
          }
        };

        const wrappedHandler = createIpcHandler(handler, {
          operation: 'test operation',
          validateInput: validator,
        });

        // @ts-expect-error - Testing validation with wrong type
        const result = await wrappedHandler(mockEvent, 123);

        expect(result).toEqual({
          success: false,
          error: 'Input must be a string',
        });
      });

      it('should not execute handler if validation fails', async () => {
        const handler = jest.fn().mockResolvedValue('result');

        const validator = (input: any) => {
          if (typeof input !== 'string') {
            throw new Error('Input must be a string');
          }
        };

        const wrappedHandler = createIpcHandler(handler, {
          operation: 'test operation',
          validateInput: validator,
        });

        await wrappedHandler(mockEvent, 123);

        expect(handler).not.toHaveBeenCalled();
      });

      it('should execute handler if validation passes', async () => {
        const handler = jest.fn().mockResolvedValue('result');

        const validator = (input: any) => {
          if (typeof input !== 'string') {
            throw new Error('Input must be a string');
          }
        };

        const wrappedHandler = createIpcHandler(handler, {
          operation: 'test operation',
          validateInput: validator,
        });

        const result = await wrappedHandler(mockEvent, 'valid');

        expect(handler).toHaveBeenCalledWith(mockEvent, 'valid');
        expect(result).toEqual({
          success: true,
          data: 'result',
        });
      });
    });

    describe('logging integration', () => {
      it('should log handler call when enabled', async () => {
        const handler = async (_event: IpcMainInvokeEvent, input: string) => {
          return input;
        };

        const wrappedHandler = createIpcHandler(handler, {
          operation: 'test operation',
          enableLogging: true,
        });

        await wrappedHandler(mockEvent, 'test-input');

        expect(log.debug).toHaveBeenCalledWith('[IPC] test operation called with args:', [
          'test-input',
        ]);
      });

      it('should not log handler call when disabled', async () => {
        const handler = async (_event: IpcMainInvokeEvent, _input: string) => {
          return _input;
        };

        const wrappedHandler = createIpcHandler(handler, {
          operation: 'test operation',
          enableLogging: false,
        });

        await wrappedHandler(mockEvent, 'test-input');

        expect(log.debug).not.toHaveBeenCalled();
      });

      it('should log by default when option not specified', async () => {
        const handler = async (_event: IpcMainInvokeEvent, input: string) => {
          return input;
        };

        const wrappedHandler = createIpcHandler(handler, {
          operation: 'test operation',
        });

        await wrappedHandler(mockEvent, 'test-input');

        expect(log.debug).toHaveBeenCalledWith('[IPC] test operation called with args:', [
          'test-input',
        ]);
      });

      it('should log successful completion', async () => {
        const handler = async (_event: IpcMainInvokeEvent) => {
          return 'success';
        };

        const wrappedHandler = createIpcHandler(handler, {
          operation: 'test operation',
          enableLogging: true,
        });

        await wrappedHandler(mockEvent);

        expect(log.debug).toHaveBeenCalledWith('[IPC] test operation completed successfully');
      });
    });

    describe('custom error messages', () => {
      it('should use custom error message from options', async () => {
        const handler = async (_event: IpcMainInvokeEvent) => {
          throw new Error('Internal error');
        };

        const wrappedHandler = createIpcHandler(handler, {
          operation: 'test operation',
          errorMessage: 'Custom error message',
        });

        const result = await wrappedHandler(mockEvent);

        expect(result).toEqual({
          success: false,
          error: 'Custom error message',
        });
      });

      it('should use handler error message when no custom message', async () => {
        const handler = async (_event: IpcMainInvokeEvent) => {
          throw new Error('Internal error');
        };

        const wrappedHandler = createIpcHandler(handler, {
          operation: 'test operation',
        });

        const result = await wrappedHandler(mockEvent);

        expect(result).toEqual({
          success: false,
          error: 'Internal error',
        });
      });
    });

    describe('edge cases', () => {
      it('should handle undefined return value', async () => {
        const handler = async (_event: IpcMainInvokeEvent) => {
          return undefined;
        };

        const wrappedHandler = createIpcHandler(handler, {
          operation: 'test operation',
        });

        const result = await wrappedHandler(mockEvent);

        expect(result).toEqual({
          success: true,
        });
      });

      it('should handle null return value', async () => {
        const handler = async (_event: IpcMainInvokeEvent) => {
          return null;
        };

        const wrappedHandler = createIpcHandler(handler, {
          operation: 'test operation',
        });

        const result = await wrappedHandler(mockEvent);

        expect(result).toEqual({
          success: true,
          data: null,
        });
      });

      it('should handle complex return objects', async () => {
        const handler = async (_event: IpcMainInvokeEvent) => {
          return {
            nested: {
              data: [1, 2, 3],
              meta: { count: 3 },
            },
          };
        };

        const wrappedHandler = createIpcHandler(handler, {
          operation: 'test operation',
        });

        const result = await wrappedHandler(mockEvent);

        expect(result).toEqual({
          success: true,
          data: {
            nested: {
              data: [1, 2, 3],
              meta: { count: 3 },
            },
          },
        });
      });
    });
  });
});
