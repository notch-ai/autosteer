/**
 * IPC Error Listener
 * Sets up listeners for IPC errors and main process errors
 */

import { globalErrorHandler } from '@/renderer/services/GlobalErrorHandler';

export function setupIpcErrorListener(): void {
  // Listen for IPC errors forwarded from preload using the ipc API
  window.electron?.ipc?.on('ipc-error', (_event: any, errorData: any) => {
    const error = new Error(errorData.error.message);
    error.name = errorData.error.name;
    error.stack = errorData.error.stack;

    globalErrorHandler.handle(error, {
      subsystem: 'ipc',
      channel: errorData.channel,
      args: errorData.args,
    });
  });

  // Listen for main process errors
  window.electron?.ipc?.on('main-process-error', (_event: any, errorData: any) => {
    const error = new Error(errorData.error.message);
    error.name = errorData.error.name;
    error.stack = errorData.error.stack;

    globalErrorHandler.handle(error, {
      subsystem: 'handler',
      type: errorData.type,
      source: 'main-process',
    });
  });
}
