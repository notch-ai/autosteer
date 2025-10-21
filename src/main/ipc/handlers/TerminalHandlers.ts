import { IPC_CHANNELS } from '@/types/ipc.types';
import type { TerminalCreateParams, TerminalData, TerminalResponse } from '@/types/terminal.types';
import { BrowserWindow, IpcMainInvokeEvent, ipcMain } from 'electron';
import log from 'electron-log';
import { XtermService } from '@/services/XtermService';

/**
 * Terminal IPC Handlers for Terminal Lifecycle Management
 * Follows AgentHandlers pattern for consistency
 * Phase 3: Backend IPC Coordination
 */
export class TerminalHandlers {
  private xtermService: XtermService;

  constructor() {
    this.xtermService = XtermService.getInstance();
    log.info('[TerminalHandlers] Initialized with XtermService');
  }

  /**
   * Register all terminal IPC handlers
   * Implements: terminal:create, terminal:destroy, terminal:list
   */
  registerHandlers(): void {
    // Create terminal handler
    ipcMain.handle(
      IPC_CHANNELS.TERMINAL_CREATE,
      async (
        event: IpcMainInvokeEvent,
        params?: TerminalCreateParams
      ): Promise<TerminalResponse> => {
        log.info('[TerminalHandlers] terminal:create invoked', { params });

        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) {
          log.error('[TerminalHandlers] Window not found for terminal creation');
          return {
            success: false,
            error: 'Window not found',
          };
        }

        try {
          const terminalData = await this.createTerminal(window, params);
          log.info('[TerminalHandlers] Terminal created successfully', {
            id: terminalData.id,
            pid: terminalData.pid,
          });

          return {
            success: true,
            data: terminalData,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create terminal';
          log.error('[TerminalHandlers] Failed to create terminal:', error);

          return {
            success: false,
            error: errorMessage,
          };
        }
      }
    );

    // Destroy terminal handler
    ipcMain.handle(
      IPC_CHANNELS.TERMINAL_DESTROY,
      async (_event: IpcMainInvokeEvent, terminalId: string): Promise<TerminalResponse> => {
        log.info('[TerminalHandlers] terminal:destroy invoked', { terminalId });

        try {
          await this.destroyTerminal(terminalId);
          log.info('[TerminalHandlers] Terminal destroyed successfully', { terminalId });

          return {
            success: true,
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to destroy terminal';
          log.error('[TerminalHandlers] Failed to destroy terminal:', error);

          return {
            success: false,
            error: errorMessage,
          };
        }
      }
    );

    // List all terminals handler
    ipcMain.handle(
      'terminal:list',
      async (_event: IpcMainInvokeEvent): Promise<TerminalResponse> => {
        log.debug('[TerminalHandlers] terminal:list invoked');

        try {
          const terminals = await this.listTerminals();
          log.debug('[TerminalHandlers] Listed terminals', { count: terminals.length });

          return {
            success: true,
            data: terminals,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to list terminals';
          log.error('[TerminalHandlers] Failed to list terminals:', error);

          return {
            success: false,
            error: errorMessage,
          };
        }
      }
    );

    log.info('[TerminalHandlers] Terminal handlers registered successfully');
  }

  /**
   * Create a new terminal session
   * Delegates to XtermService for actual terminal creation
   */
  private async createTerminal(
    window: BrowserWindow,
    params?: TerminalCreateParams
  ): Promise<TerminalData> {
    log.info('[TerminalHandlers] Creating terminal', { params });

    try {
      // Delegate to XtermService which handles the heavy lifting
      const terminalData = await this.xtermService.createTerminal(window, params);

      log.info('[TerminalHandlers] Terminal created', {
        id: terminalData.id,
        pid: terminalData.pid,
        shell: terminalData.shell,
        cwd: terminalData.cwd,
      });

      return terminalData;
    } catch (error) {
      log.error('[TerminalHandlers] Terminal creation failed:', error);
      throw error;
    }
  }

  /**
   * Destroy a terminal session
   * Cleans up resources and removes from active sessions
   */
  private async destroyTerminal(terminalId: string): Promise<void> {
    log.info('[TerminalHandlers] Destroying terminal', { terminalId });

    try {
      await this.xtermService.killTerminal(terminalId);
      log.info('[TerminalHandlers] Terminal destroyed', { terminalId });
    } catch (error) {
      log.error('[TerminalHandlers] Terminal destruction failed:', error);
      throw error;
    }
  }

  /**
   * List all active terminal sessions
   * Returns basic terminal information for UI display
   */
  private async listTerminals(): Promise<
    Array<{ id: string; shell: string; cwd: string; isActive: boolean; pid: number }>
  > {
    log.debug('[TerminalHandlers] Listing terminals');

    try {
      const terminals = this.xtermService.getAllTerminals();
      log.debug('[TerminalHandlers] Terminals listed', { count: terminals.length });

      return terminals;
    } catch (error) {
      log.error('[TerminalHandlers] Failed to list terminals:', error);
      throw error;
    }
  }

  /**
   * Cleanup all terminal handlers and resources
   * Called on app shutdown
   */
  async cleanup(): Promise<void> {
    log.info('[TerminalHandlers] Cleaning up terminal handlers');

    try {
      await this.xtermService.cleanup();
      log.info('[TerminalHandlers] Terminal handlers cleaned up successfully');
    } catch (error) {
      log.error('[TerminalHandlers] Cleanup failed:', error);
      throw error;
    }
  }
}
