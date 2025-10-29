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
    log.info('XtermService initialized with PTY support');
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
        log.debug('[XtermService] IPC terminal:write received:', {
          terminalId: params.terminalId,
          dataLength: params.data.length,
        });
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

    log.info('[XtermService] IPC handlers registered (write, resize)');
  }

  /**
   * Create new PTY terminal session
   */
  async createTerminal(
    window: BrowserWindow,
    params?: TerminalCreateParams
  ): Promise<TerminalData> {
    log.info(
      `Creating terminal. Current count: ${this.terminals.size}/${this.maxTerminals}. Active terminals:`,
      Array.from(this.terminals.keys())
    );

    if (this.terminals.size >= this.maxTerminals) {
      log.error(
        `Maximum terminal limit reached (${this.maxTerminals}). Active terminals:`,
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

      log.info(
        `Created PTY terminal ${terminalId} with PID ${pty.pid}, shell: ${shell}. Active terminals: ${this.terminals.size}/${this.maxTerminals}`
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
      log.error('Failed to create PTY terminal:', error);
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
        log.info(`PTY terminal ${terminalId} exited with code ${exitCode}, signal ${signal}`);
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
        log.info(
          `Terminal ${terminalId} removed from map. Active terminals: ${this.terminals.size}`
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
      log.debug(`Resized PTY terminal ${terminalId} to ${cols}x${rows}`);
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

    try {
      log.info(
        `Killing PTY terminal ${terminalId} (PID: ${terminal.pid}). Active terminals: ${this.terminals.size}/${this.maxTerminals}`
      );

      // Step 1: Mark as inactive
      terminal.isActive = false;

      // Step 2: Graceful shutdown (SIGTERM)
      terminal.pty.kill('SIGTERM');

      // Step 3: Force kill after 1s timeout if not exited
      const killTimeout = setTimeout(() => {
        if (!terminal.hasExited) {
          log.warn(`Terminal ${terminalId} did not exit gracefully, forcing SIGKILL`);
          terminal.pty.kill('SIGKILL');

          // Fallback cleanup if onExit doesn't fire within 2s
          setTimeout(() => {
            if (this.terminals.has(terminalId)) {
              log.error(`Terminal ${terminalId} still in map after SIGKILL, forcing cleanup`);
              const term = this.terminals.get(terminalId);
              if (term) {
                term.disposables.forEach((d) => {
                  try {
                    d.dispose();
                  } catch (error) {
                    log.error(`Failed to dispose terminal ${terminalId} listener:`, error);
                  }
                });
              }
              this.terminals.delete(terminalId);
              log.info(
                `Terminal ${terminalId} force removed. Active terminals: ${this.terminals.size}`
              );
            }
          }, 2000);
        } else {
          clearTimeout(killTimeout);
        }
      }, 1000);

      log.info(`Terminal ${terminalId} kill signal sent`);
    } catch (error) {
      log.error(`Failed to kill PTY terminal ${terminalId}:`, error);
      // Attempt cleanup even on error
      terminal.disposables.forEach((d) => {
        try {
          d.dispose();
        } catch (disposeError) {
          log.error(`Failed to dispose terminal ${terminalId} listener:`, disposeError);
        }
      });
      this.terminals.delete(terminalId);
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
   * Cleanup all PTY sessions
   */
  async cleanup(): Promise<void> {
    log.info('Cleaning up all PTY terminals');
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
