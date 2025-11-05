/**
 * Safe IPC Handler Wrapper
 * Wraps IPC handlers with automatic error handling
 */

import { IpcMainInvokeEvent, ipcMain, BrowserWindow } from 'electron';
import { ErrorHandler } from '../utils/errorHandler';

type IpcHandler = (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any;

interface HandlerOptions {
  operationName?: string;
  suppressNotification?: boolean;
}

/**
 * Register an IPC handler with automatic error handling
 */
export function registerSafeHandler(
  channel: string,
  handler: IpcHandler,
  options?: HandlerOptions
): void {
  ipcMain.handle(channel, async (event: IpcMainInvokeEvent, ...args: any[]) => {
    try {
      return await handler(event, ...args);
    } catch (error) {
      // Log error
      const errorMessage = ErrorHandler.log({
        operation: options?.operationName || channel,
        error,
        context: { channel, args: sanitizeArgs(args) },
      });

      // Notify user unless suppressed
      if (!options?.suppressNotification) {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window) {
          ErrorHandler.notifyUser(
            {
              operation: options?.operationName || channel,
              error,
              context: { channel },
            },
            window
          );
        }
      }

      // Return structured error response
      return {
        success: false,
        error: errorMessage,
        message: ErrorHandler.formatUserMessage(options?.operationName || channel, error),
      };
    }
  });
}

/**
 * Sanitize arguments for logging (remove sensitive data)
 */
function sanitizeArgs(args: any[]): any[] {
  return args.map((arg) => {
    if (typeof arg === 'object' && arg !== null) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, token, apiKey, ...safe } = arg;
      return safe;
    }
    return arg;
  });
}
