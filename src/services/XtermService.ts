import { TerminalCreateParams, TerminalData } from '@/types/terminal.types';
import { BrowserWindow, ipcMain } from 'electron';
import log from 'electron-log';
import { IPty, spawn as ptySpawn } from 'node-pty';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

export interface XtermTerminal {
  id: string;
  pid: number;
  pty: IPty;
  window: BrowserWindow;
  shell: string;
  cwd: string;
  isActive: boolean;
  size: { cols: number; rows: number };
  hasExited: boolean;
  disposables: Array<{ dispose: () => void }>;
}

/**
 * XTerm.js Service for Electron Main Process
 * Handles PTY-based terminal process management with full readline support
 */
export class XtermService {
  private static instance: XtermService;
  private terminals = new Map<string, XtermTerminal>();
  private readonly maxTerminals = 10;

  private constructor() {
    this.setupIpcHandlers();
  }

  static getInstance(): XtermService {
    if (!XtermService.instance) {
      XtermService.instance = new XtermService();
    }
    return XtermService.instance;
  }

  /**
   * Setup IPC handlers for terminal operations
   */
  private setupIpcHandlers(): void {
    // Write to terminal
    ipcMain.handle(
      'terminal:write',
      async (_event, params: { terminalId: string; data: string }) => {
        try {
          await this.writeToTerminal(params.terminalId, params.data);
          return { success: true };
        } catch (error) {
          log.error('[XtermService] IPC terminal:write error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to write to terminal',
          };
        }
      }
    );

    // Resize terminal
    ipcMain.handle(
      'terminal:resize',
      async (_event, params: { terminalId: string; cols: number; rows: number }) => {
        try {
          await this.resizeTerminal(params.terminalId, params.cols, params.rows);
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to resize terminal',
          };
        }
      }
    );
  }

  /**
   * Create new PTY terminal session
   */
  async createTerminal(
    window: BrowserWindow,
    params?: TerminalCreateParams
  ): Promise<TerminalData> {
    const ptyCount = this.terminals.size;

    if (ptyCount >= this.maxTerminals) {
      log.error(
        `[XtermService] Maximum terminal limit reached. Max: ${this.maxTerminals}, PTY count: ${ptyCount}. Active terminals:`,
        this.getAllTerminals()
      );
      throw new Error(`Maximum terminal limit reached (${this.maxTerminals})`);
    }

    const terminalId = uuidv4();
    const shell = params?.shell || this.getDefaultShell();
    const cwd = params?.cwd || os.homedir();
    const size = params?.size || { cols: 80, rows: 24 };
    const title = params?.title || 'Terminal';
    const env = this.getFilteredEnv();

    try {
      // Spawn PTY with persistent shell session
      const pty = ptySpawn(shell, [], {
        name: 'xterm-256color',
        cols: size.cols,
        rows: size.rows,
        cwd,
        env: {
          ...env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          FORCE_COLOR: '1',
        },
      });

      const terminal: XtermTerminal = {
        id: terminalId,
        pid: pty.pid,
        pty,
        window,
        shell,
        cwd,
        isActive: true,
        size,
        hasExited: false,
        disposables: [],
      };

      this.terminals.set(terminalId, terminal);

      // Setup PTY event handlers
      this.setupPtyHandlers(terminalId, pty, window);

      log.debug(
        `[XtermService] Created terminal ${terminalId} (pid: ${pty.pid}). PTY count: ${this.terminals.size}/${this.maxTerminals}`
      );

      const now = new Date();
      return {
        id: terminalId,
        pid: pty.pid,
        title,
        isActive: true,
        createdAt: now.toISOString(),
        lastAccessed: now.toISOString(),
        shell,
        cwd,
        size,
        status: 'running',
      };
    } catch (error) {
      log.error(`[XtermService] Failed to create PTY terminal. PTY count: ${ptyCount}`, error);
      throw error;
    }
  }

  /**
   * Setup PTY event handlers
   */
  private setupPtyHandlers(terminalId: string, pty: IPty, window: BrowserWindow): void {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      log.error(`Terminal ${terminalId} not found when setting up handlers`);
      return;
    }

    // Handle PTY data output
    const dataDisposable = pty.onData((data: string) => {
      if (!window.isDestroyed()) {
        window.webContents.send(`terminal:data:${terminalId}`, data);
      }
    });

    // Handle PTY exit
    const exitDisposable = pty.onExit(
      ({ exitCode, signal }: { exitCode: number; signal?: number }) => {
        const term = this.terminals.get(terminalId);
        if (term) {
          term.isActive = false;
          term.hasExited = true;

          // Cleanup disposables
          term.disposables.forEach((d) => {
            try {
              d.dispose();
            } catch (error) {
              log.error(`Failed to dispose terminal ${terminalId} listener:`, error);
            }
          });
        }

        if (!window.isDestroyed()) {
          window.webContents.send(`terminal:exit:${terminalId}`, {
            code: exitCode,
            signal,
          });
        }

        this.terminals.delete(terminalId);
        log.debug(
          `[XtermService] Terminal ${terminalId} exited (code: ${exitCode}, signal: ${signal}). PTY count: ${this.terminals.size}/${this.maxTerminals}`
        );
      }
    );

    // Store disposables for cleanup
    terminal.disposables.push(dataDisposable, exitDisposable);
  }

  /**
   * Write data to PTY
   */
  private async writeToTerminal(terminalId: string, data: string): Promise<void> {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      throw new Error(`Terminal not found: ${terminalId}`);
    }

    if (!terminal.isActive) {
      throw new Error('Terminal is not active');
    }

    try {
      terminal.pty.write(data);
    } catch (error) {
      log.error(`Failed to write to PTY terminal ${terminalId}:`, error);
      throw error;
    }
  }

  /**
   * Resize PTY dimensions
   */
  private async resizeTerminal(terminalId: string, cols: number, rows: number): Promise<void> {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      throw new Error(`Terminal not found: ${terminalId}`);
    }

    try {
      terminal.pty.resize(cols, rows);
      terminal.size = { cols, rows };
    } catch (error) {
      log.error(`Failed to resize PTY terminal ${terminalId}:`, error);
      throw error;
    }
  }

  /**
   * Kill PTY session with graceful shutdown
   */
  async killTerminal(terminalId: string): Promise<void> {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      throw new Error(`Terminal not found: ${terminalId}`);
    }

    // Remove from map immediately
    this.terminals.delete(terminalId);
    log.debug(
      `[XtermService] Removed terminal ${terminalId} from map. PTY count: ${this.terminals.size}/${this.maxTerminals}`
    );

    // Kill the PTY process
    await this.killTerminalPty(terminalId, terminal);
  }

  /**
   * Kill PTY process with graceful shutdown
   * This is separated to allow cleanup without map removal
   */
  private async killTerminalPty(terminalId: string, terminal: XtermTerminal): Promise<void> {
    try {
      // Step 1: Mark as inactive and cleanup disposables immediately
      terminal.isActive = false;

      // Cleanup disposables right away since terminal is removed from map
      // and onExit handler won't be able to find it
      terminal.disposables.forEach((d) => {
        try {
          d.dispose();
        } catch (error) {
          log.error(`Failed to dispose terminal ${terminalId} listener:`, error);
        }
      });

      // Step 2: Graceful shutdown (SIGTERM)
      terminal.pty.kill('SIGTERM');

      // Step 3: Force kill after 1s timeout if not exited
      setTimeout(() => {
        if (!terminal.hasExited) {
          log.warn(`Terminal ${terminalId} did not exit gracefully, forcing SIGKILL`);
          terminal.pty.kill('SIGKILL');

          // Final check after SIGKILL
          setTimeout(() => {
            if (!terminal.hasExited) {
              log.error(
                `Terminal ${terminalId} still hasn't exited after SIGKILL (pid: ${terminal.pid})`
              );
              terminal.hasExited = true; // Mark as exited to prevent further attempts
            }
          }, 2000);
        }
      }, 1000);
    } catch (error) {
      log.error(`Failed to kill PTY terminal ${terminalId}:`, error);
      // Ensure disposables are cleaned up even on error
      terminal.disposables.forEach((d) => {
        try {
          d.dispose();
        } catch (disposeError) {
          log.error(`Failed to dispose terminal ${terminalId} listener:`, disposeError);
        }
      });
      throw error;
    }
  }

  /**
   * Get all terminals
   */
  getAllTerminals(): Array<{
    id: string;
    shell: string;
    cwd: string;
    isActive: boolean;
    pid: number;
  }> {
    return Array.from(this.terminals.values()).map((terminal) => ({
      id: terminal.id,
      shell: terminal.shell,
      cwd: terminal.cwd,
      isActive: terminal.isActive,
      pid: terminal.pid,
    }));
  }

  /**
   * Get platform-appropriate default shell
   */
  private getDefaultShell(): string {
    const platform = os.platform();
    if (platform === 'win32') {
      return process.env.COMSPEC || 'powershell.exe';
    } else if (platform === 'darwin') {
      return process.env.SHELL || '/bin/zsh';
    } else {
      return process.env.SHELL || '/bin/bash';
    }
  }

  /**
   * Get filtered environment variables
   */
  private getFilteredEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    };

    // Remove sensitive variables
    delete env.NODE_AUTH_TOKEN;
    delete env.NPM_TOKEN;
    delete env.GITHUB_TOKEN;

    return env;
  }

  /**
   * Cleanup all terminals for a specific window
   * Used when window reloads or is destroyed
   */
  async cleanupWindowTerminals(window: BrowserWindow): Promise<void> {
    const windowId = window.id;
    const terminalsToKill: Array<{ id: string; terminal: XtermTerminal }> = [];

    // Find all terminals belonging to this window
    this.terminals.forEach((terminal, terminalId) => {
      if (terminal.window.id === windowId) {
        terminalsToKill.push({ id: terminalId, terminal });
      }
    });

    if (terminalsToKill.length === 0) {
      log.debug(`[XtermService] No terminals to cleanup for window ${windowId}`);
      return;
    }

    log.info(
      `[XtermService] Cleaning up ${terminalsToKill.length} terminals for window ${windowId}: ${terminalsToKill.map((t) => t.id).join(', ')}`
    );

    // CRITICAL: Remove from map immediately to free up capacity
    // This prevents hitting the max terminal limit during reload
    terminalsToKill.forEach(({ id }) => {
      this.terminals.delete(id);
    });

    log.debug(
      `[XtermService] Removed ${terminalsToKill.length} terminals from map. Remaining: ${this.terminals.size}`
    );

    // Kill PTY processes in background (async cleanup)
    const killPromises = terminalsToKill.map(({ id, terminal }) => {
      log.debug(`[XtermService] Killing PTY for terminal ${id}`);
      return this.killTerminalPty(id, terminal).catch((error) => {
        log.error(`[XtermService] Error killing PTY terminal ${id}:`, error);
      });
    });

    // Don't wait for PTY cleanup - it happens in background with timeouts
    Promise.allSettled(killPromises).then(() => {
      log.info(`[XtermService] All PTY processes cleaned up for window ${windowId}`);
    });

    log.info(`[XtermService] Cleanup complete. Remaining terminals: ${this.terminals.size}`);
  }

  /**
   * Cleanup all PTY sessions
   */
  async cleanup(): Promise<void> {
    const killPromises = Array.from(this.terminals.keys()).map((terminalId) => {
      return this.killTerminal(terminalId).catch((error) => {
        log.error(`Error killing PTY terminal ${terminalId}:`, error);
      });
    });

    await Promise.allSettled(killPromises);

    // Force cleanup after 3s timeout
    setTimeout(() => {
      this.terminals.forEach((terminal) => {
        if (!terminal.hasExited) {
          terminal.pty.kill('SIGKILL');
        }
      });
      this.terminals.clear();
    }, 3000);
  }
}
