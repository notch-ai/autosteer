import log from 'electron-log/main';
import { BrowserWindow, Notification, WebContents } from 'electron';

export interface ErrorDetails {
  operation: string;
  error: unknown;
  context?: Record<string, any>;
}

export class ErrorHandler {
  static log(details: ErrorDetails): string {
    const timestamp = new Date().toISOString();
    const errorMessage = this.getErrorMessage(details.error);

    // Log to electron-log with full details
    log.error(`[${timestamp}] Error in ${details.operation}:`, {
      message: errorMessage,
      error: details.error,
      context: details.context,
      stack: details.error instanceof Error ? details.error.stack : undefined,
    });

    return errorMessage;
  }

  /**
   * Send error notification to user via renderer process toast or OS notification
   */
  static notifyUser(
    details: ErrorDetails,
    webContentsOrWindow?: WebContents | BrowserWindow
  ): void {
    const userMessage = this.formatUserMessage(details.operation, details.error);

    // Get WebContents from either WebContents or BrowserWindow
    let webContents: WebContents | undefined;
    if (webContentsOrWindow) {
      if ('webContents' in webContentsOrWindow) {
        webContents = webContentsOrWindow.webContents;
      } else {
        webContents = webContentsOrWindow;
      }
    }

    if (webContents && !webContents.isDestroyed()) {
      // Send to renderer for toast notification
      log.info('[ErrorHandler] Sending error notification to renderer:', userMessage);
      webContents.send('notification:error', {
        title: `Error: ${details.operation}`,
        message: userMessage,
      });
    } else {
      // Fallback to OS notification
      log.info('[ErrorHandler] Showing OS notification:', userMessage);
      new Notification({
        title: `Error: ${details.operation}`,
        body: userMessage,
        urgency: 'normal',
      }).show();
    }
  }

  static getErrorMessage(error: unknown): string {
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

  static formatUserMessage(operation: string, error: unknown): string {
    const errorMessage = this.getErrorMessage(error);

    // Make error messages more user-friendly
    if (errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
      if (errorMessage.includes('Filtering content')) {
        return `Operation timed out while downloading large files (Git LFS). This repository may have many large files. Please try again or check your network connection.`;
      }
      return `Operation timed out. This may be due to slow network or large repository. Please try again.`;
    }
    if (errorMessage.includes('Filtering content')) {
      return `Downloading large files via Git LFS. This may take several minutes depending on repository size and network speed.`;
    }
    if (errorMessage.includes('Remote branch') && errorMessage.includes('not found')) {
      return `Branch does not exist in remote repository. It will be created.`;
    }
    if (errorMessage.includes('Could not resolve host')) {
      return `Unable to connect to repository. Please check your internet connection and repository URL.`;
    }
    if (
      errorMessage.includes('Permission denied') ||
      errorMessage.includes('Authentication failed')
    ) {
      return `Authentication failed. Please check your Git credentials and repository permissions.`;
    }
    if (errorMessage.includes('Repository not found')) {
      return `Repository not found. Please check the URL is correct and you have access.`;
    }
    if (errorMessage.includes('already exists')) {
      return `A worktree with this name already exists.`;
    }

    return `Failed to ${operation}: ${errorMessage}`;
  }
}
