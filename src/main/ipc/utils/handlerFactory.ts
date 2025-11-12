/**
 * @fileoverview IPC Handler Factory Utilities
 *
 * Provides reusable utilities for creating type-safe IPC handlers with built-in
 * error handling, logging, and input validation.
 *
 * @module autosteer/src/main/ipc/utils/handlerFactory
 *
 * ## Key Features
 * - Standardized error handling across all IPC handlers
 * - Automatic logging of IPC operations
 * - Input validation utilities
 * - Consistent response formatting
 * - Type-safe handler wrappers
 *
 * ## Usage Example
 * ```typescript
 * import { createIpcHandler, formatSuccessResponse } from './handlerFactory';
 *
 * // Create a handler with automatic error handling
 * const handler = createIpcHandler(
 *   async (event, agentId: string) => {
 *     const agent = await getAgent(agentId);
 *     return formatSuccessResponse(agent);
 *   },
 *   { operation: 'agents:get' }
 * );
 *
 * // Register with IPC
 * ipcMain.handle('agents:get', handler);
 * ```
 *
 * @see {@link ClaudeHandlers} for usage in domain handlers
 * @see {@link IpcRegistrar} for handler registration patterns
 */

import { IpcMainInvokeEvent } from 'electron';
import { log } from '@/main/services/logger';

/**
 * Standard IPC response format
 */
export interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Options for configuring IPC handler behavior
 */
export interface IpcHandlerOptions {
  /**
   * Operation name for logging and error reporting
   */
  operation: string;

  /**
   * Optional validation function for input parameters
   * Should throw an error if validation fails
   */
  validateInput?: (input: any) => void;

  /**
   * Enable debug logging for handler calls
   * @default true
   */
  enableLogging?: boolean;

  /**
   * Custom error message to return instead of the actual error
   */
  errorMessage?: string;
}

/**
 * Type definition for IPC handler functions
 */
export type IpcHandler<TArgs extends any[] = any[], TResult = any> = (
  event: IpcMainInvokeEvent,
  ...args: TArgs
) => Promise<TResult>;

/**
 * Type definition for wrapped IPC handler functions that return IpcResponse
 */
export type WrappedIpcHandler<TArgs extends any[] = any[], TResult = any> = (
  event: IpcMainInvokeEvent,
  ...args: TArgs
) => Promise<IpcResponse<TResult>>;

/**
 * Formats a successful IPC response
 *
 * @param data - Optional data to include in the response
 * @returns Formatted success response
 *
 * @example
 * ```typescript
 * const response = formatSuccessResponse({ id: '123', name: 'Test' });
 * // { success: true, data: { id: '123', name: 'Test' } }
 * ```
 */
export function formatSuccessResponse<T>(data?: T): IpcResponse<T> {
  const response: IpcResponse<T> = {
    success: true,
  };

  // Only include data field if data is not undefined
  if (data !== undefined) {
    response.data = data;
  }

  return response;
}

/**
 * Formats an error IPC response
 *
 * @param error - Error object, string, or unknown error
 * @param customMessage - Optional custom error message to use instead of the error's message
 * @returns Formatted error response
 *
 * @example
 * ```typescript
 * const response = formatErrorResponse(new Error('Failed to save'));
 * // { success: false, error: 'Failed to save' }
 * ```
 */
export function formatErrorResponse(error: unknown, customMessage?: string): IpcResponse<never> {
  let errorMessage: string;

  if (customMessage) {
    errorMessage = customMessage;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    errorMessage = String((error as any).message);
  } else {
    errorMessage = 'An unknown error occurred';
  }

  return {
    success: false,
    error: errorMessage,
  };
}

/**
 * Validates input using the provided validator function
 *
 * @param input - Input to validate
 * @param validator - Validation function that should throw if validation fails
 * @throws Error if validation fails
 *
 * @example
 * ```typescript
 * const validator = (input: any) => {
 *   if (typeof input !== 'string') {
 *     throw new Error('Input must be a string');
 *   }
 * };
 * validateInput('valid', validator); // passes
 * validateInput(123, validator); // throws
 * ```
 */
export function validateInput(input: any, validator: (input: any) => void): void {
  validator(input);
}

/**
 * Extracts error message from unknown error type
 *
 * @param error - Error object or value
 * @returns Error message string
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'An unknown error occurred';
}

/**
 * Creates a wrapped IPC handler with error handling, validation, and logging
 *
 * This factory function wraps an IPC handler with standard error handling,
 * input validation, logging, and response formatting. It provides a consistent
 * pattern for IPC handlers across the application.
 *
 * Features:
 * - Automatic error catching and formatting
 * - Optional input validation
 * - Debug logging for handler calls and completion
 * - Standardized response format
 * - Context-aware error logging
 *
 * @param handler - The IPC handler function to wrap
 * @param options - Configuration options for the wrapper
 * @returns Wrapped handler function that returns IpcResponse
 *
 * @example
 * ```typescript
 * // Basic usage
 * const handler = createIpcHandler(
 *   async (_event, path: string) => {
 *     return fs.readFile(path, 'utf-8');
 *   },
 *   { operation: 'read file' }
 * );
 *
 * // With input validation
 * const validatedHandler = createIpcHandler(
 *   async (_event, path: string) => {
 *     return fs.readFile(path, 'utf-8');
 *   },
 *   {
 *     operation: 'read file',
 *     validateInput: (path) => {
 *       if (!path || typeof path !== 'string') {
 *         throw new Error('Path must be a non-empty string');
 *       }
 *     }
 *   }
 * );
 *
 * // With custom error message
 * const customErrorHandler = createIpcHandler(
 *   async (_event, data) => {
 *     await saveData(data);
 *   },
 *   {
 *     operation: 'save data',
 *     errorMessage: 'Failed to save data. Please try again.'
 *   }
 * );
 * ```
 */
export function createIpcHandler<TArgs extends any[], TResult>(
  handler: IpcHandler<TArgs, TResult>,
  options: IpcHandlerOptions
): WrappedIpcHandler<TArgs, TResult> {
  const { operation, validateInput: validator, enableLogging = true, errorMessage } = options;

  return async (event: IpcMainInvokeEvent, ...args: TArgs): Promise<IpcResponse<TResult>> => {
    try {
      // Log handler call if logging is enabled
      if (enableLogging) {
        log.debug(`[IPC] ${operation} called with args:`, args);
      }

      // Validate input if validator is provided
      if (validator && args.length > 0) {
        validateInput(args[0], validator);
      }

      // Execute the handler
      const result = await handler(event, ...args);

      // Log successful completion if logging is enabled
      if (enableLogging) {
        log.debug(`[IPC] ${operation} completed successfully`);
      }

      // Format and return success response
      return formatSuccessResponse(result);
    } catch (error) {
      // Extract error message
      const message = getErrorMessage(error);

      // Log error with context
      log.error(`[IPC] Error in ${operation}:`, {
        message,
        error,
        args: args.length > 0 ? args : undefined,
      });

      // Format and return error response
      return formatErrorResponse(error, errorMessage);
    }
  };
}
