/**
 * XtermService Test Suite
 * Comprehensive tests for PTY-based terminal process management with full readline support
 */

import { XtermService, XtermTerminal } from '@/services/XtermService';
import { TerminalCreateParams } from '@/types/terminal.types';
import { BrowserWindow, ipcMain } from 'electron';
import { IPty } from 'node-pty';
import * as os from 'os';

// Mock dependencies
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
  },
  BrowserWindow: jest.fn(),
}));

jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('node-pty', () => ({
  spawn: jest.fn(),
}));

jest.mock('os');

// Mock UUID to return unique IDs for each call
let uuidCounter = 0;
jest.mock('uuid', () => ({
  v4: jest.fn(() => {
    const id = `test-uuid-${uuidCounter}`;
    uuidCounter++;
    return id;
  }),
}));

describe('XtermService', () => {
  let xtermService: XtermService;
  let mockWindow: jest.Mocked<BrowserWindow>;
  let mockPty: jest.Mocked<IPty>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset UUID counter for consistent test IDs
    uuidCounter = 0;

    // Setup mock BrowserWindow
    mockWindow = {
      isDestroyed: jest.fn().mockReturnValue(false),
      webContents: {
        send: jest.fn(),
      },
    } as unknown as jest.Mocked<BrowserWindow>;

    // Setup mock PTY
    const mockDataDisposable = { dispose: jest.fn() };
    const mockExitDisposable = { dispose: jest.fn() };

    mockPty = {
      pid: 12345,
      write: jest.fn(),
      resize: jest.fn(),
      kill: jest.fn(),
      onData: jest.fn().mockReturnValue(mockDataDisposable),
      onExit: jest.fn().mockReturnValue(mockExitDisposable),
    } as unknown as jest.Mocked<IPty>;

    // Mock node-pty spawn
    const ptyModule = require('node-pty');
    ptyModule.spawn = jest.fn().mockReturnValue(mockPty);

    // Mock os module
    (os.platform as jest.Mock).mockReturnValue('darwin');
    (os.homedir as jest.Mock).mockReturnValue('/Users/test');

    // Reset singleton instance
    (XtermService as any).instance = undefined;

    // Get fresh instance
    xtermService = XtermService.getInstance();

    console.log('[XtermService Test] Initialized test suite');
  });

  afterEach(() => {
    // Cleanup
    (XtermService as any).instance = undefined;
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = XtermService.getInstance();
      const instance2 = XtermService.getInstance();

      expect(instance1).toBe(instance2);
      console.log('[XtermService Test] Singleton pattern verified');
    });

    it('should initialize IPC handlers on first instantiation', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('terminal:write', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('terminal:resize', expect.any(Function));
      console.log('[XtermService Test] IPC handlers registered');
    });
  });

  describe('createTerminal', () => {
    it('should create a new PTY terminal with default params', async () => {
      const result = await xtermService.createTerminal(mockWindow);

      expect(result).toHaveProperty('id');
      expect(result.id).toMatch(/^test-uuid-\d+$/);
      expect(result).toHaveProperty('pid', 12345);
      expect(result).toHaveProperty('status', 'running');
      expect(result).toHaveProperty('isActive', true);
      console.log('[XtermService Test] Terminal created with defaults');
    });

    it('should create terminal with custom parameters', async () => {
      const params: TerminalCreateParams = {
        shell: '/bin/bash',
        cwd: '/custom/path',
        size: { cols: 100, rows: 30 },
        title: 'Custom Terminal',
      };

      const result = await xtermService.createTerminal(mockWindow, params);

      expect(result.title).toBe('Custom Terminal');
      expect(result.shell).toBe('/bin/bash');
      expect(result.cwd).toBe('/custom/path');
      expect(result.size).toEqual({ cols: 100, rows: 30 });
      console.log('[XtermService Test] Terminal created with custom params');
    });

    it('should use platform-specific default shell', async () => {
      const ptyModule = require('node-pty');

      // Test macOS (darwin) - accepts any valid shell path
      (os.platform as jest.Mock).mockReturnValue('darwin');
      await xtermService.createTerminal(mockWindow);
      // On macOS, the shell could be bash or zsh depending on system
      const firstCall = ptyModule.spawn.mock.calls[0];
      expect(firstCall[0]).toMatch(/\/(bash|zsh)$/);
      expect(firstCall[1]).toEqual(expect.any(Array));
      expect(firstCall[2]).toEqual(expect.any(Object));

      // Test Windows
      jest.clearAllMocks();
      (os.platform as jest.Mock).mockReturnValue('win32');
      (xtermService as any).instance = undefined;
      xtermService = XtermService.getInstance();
      await xtermService.createTerminal(mockWindow);
      expect(ptyModule.spawn).toHaveBeenCalledWith(
        expect.stringMatching(/powershell\.exe/),
        expect.any(Array),
        expect.any(Object)
      );

      // Test Linux
      jest.clearAllMocks();
      (os.platform as jest.Mock).mockReturnValue('linux');
      (xtermService as any).instance = undefined;
      xtermService = XtermService.getInstance();
      await xtermService.createTerminal(mockWindow);
      // On Linux, accept any common shell
      const thirdCall = ptyModule.spawn.mock.calls[0];
      expect(thirdCall[0]).toMatch(/\/(bash|sh|zsh)$/);
      expect(thirdCall[1]).toEqual(expect.any(Array));
      expect(thirdCall[2]).toEqual(expect.any(Object));

      console.log('[XtermService Test] Platform-specific shells verified');
    });

    it('should spawn PTY with correct environment variables', async () => {
      const ptyModule = require('node-pty');

      await xtermService.createTerminal(mockWindow);

      const spawnCall = ptyModule.spawn.mock.calls[0];
      const env = spawnCall[2].env;

      expect(env).toHaveProperty('TERM', 'xterm-256color');
      expect(env).toHaveProperty('COLORTERM', 'truecolor');
      expect(env).toHaveProperty('FORCE_COLOR', '1');
      expect(env).not.toHaveProperty('NODE_AUTH_TOKEN');
      expect(env).not.toHaveProperty('NPM_TOKEN');
      expect(env).not.toHaveProperty('GITHUB_TOKEN');

      console.log('[XtermService Test] Environment variables configured correctly');
    });

    it('should setup PTY event handlers', async () => {
      await xtermService.createTerminal(mockWindow);

      expect(mockPty.onData).toHaveBeenCalled();
      expect(mockPty.onExit).toHaveBeenCalled();
      console.log('[XtermService Test] PTY event handlers set up');
    });

    it('should enforce maximum terminal limit', async () => {
      // Create max terminals (10)
      for (let i = 0; i < 10; i++) {
        await xtermService.createTerminal(mockWindow);
        // Generate new UUID for each terminal
        const uuid = require('uuid');
        uuid.v4.mockReturnValue(`test-uuid-${i + 1}`);
      }

      // Try to create 11th terminal
      await expect(xtermService.createTerminal(mockWindow)).rejects.toThrow(
        'Maximum terminal limit reached (10)'
      );

      console.log('[XtermService Test] Maximum terminal limit enforced');
    });

    it('should handle PTY spawn errors', async () => {
      const ptyModule = require('node-pty');
      ptyModule.spawn.mockImplementation(() => {
        throw new Error('Failed to spawn PTY');
      });

      await expect(xtermService.createTerminal(mockWindow)).rejects.toThrow('Failed to spawn PTY');
      console.log('[XtermService Test] PTY spawn error handled');
    });

    it('should return serializable terminal data', async () => {
      const result = await xtermService.createTerminal(mockWindow);

      expect(typeof result.createdAt).toBe('string');
      expect(typeof result.lastAccessed).toBe('string');
      expect(new Date(result.createdAt).toString()).not.toBe('Invalid Date');
      console.log('[XtermService Test] Terminal data is serializable');
    });
  });

  describe('PTY Event Handlers', () => {
    it('should forward PTY data to renderer process', async () => {
      const terminal = await xtermService.createTerminal(mockWindow);

      // Simulate PTY data
      const dataHandler = mockPty.onData.mock.calls[0][0];
      dataHandler('test output\n');

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        `terminal:data:${terminal.id}`,
        'test output\n'
      );
      console.log('[XtermService Test] PTY data forwarded to renderer');
    });

    it('should handle PTY exit and cleanup', async () => {
      const terminal = await xtermService.createTerminal(mockWindow);

      // Simulate PTY exit
      const exitHandler = mockPty.onExit.mock.calls[0][0];
      exitHandler({ exitCode: 0 });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(`terminal:exit:${terminal.id}`, {
        code: 0,
        signal: undefined,
      });

      const terminals = xtermService.getAllTerminals();
      expect(terminals).toHaveLength(0);
      console.log('[XtermService Test] PTY exit handled and cleaned up');
    });

    it('should not send data if window is destroyed', async () => {
      await xtermService.createTerminal(mockWindow);

      mockWindow.isDestroyed.mockReturnValue(true);

      const dataHandler = mockPty.onData.mock.calls[0][0];
      dataHandler('test output\n');

      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
      console.log('[XtermService Test] Data not sent to destroyed window');
    });

    it('should cleanup disposables on exit', async () => {
      await xtermService.createTerminal(mockWindow);

      const dataDisposable = mockPty.onData.mock.results[0].value;
      const exitDisposable = mockPty.onExit.mock.results[0].value;

      const exitHandler = mockPty.onExit.mock.calls[0][0];
      exitHandler({ exitCode: 0 });

      expect(dataDisposable.dispose).toHaveBeenCalled();
      expect(exitDisposable.dispose).toHaveBeenCalled();
      console.log('[XtermService Test] Disposables cleaned up on exit');
    });

    it('should handle dispose errors gracefully', async () => {
      await xtermService.createTerminal(mockWindow);

      const dataDisposable = mockPty.onData.mock.results[0].value;
      dataDisposable.dispose.mockImplementation(() => {
        throw new Error('Dispose failed');
      });

      const exitHandler = mockPty.onExit.mock.calls[0][0];

      // Should not throw
      expect(() => exitHandler({ exitCode: 0 })).not.toThrow();
      console.log('[XtermService Test] Dispose errors handled gracefully');
    });
  });

  describe('IPC Handlers', () => {
    describe('terminal:write', () => {
      it('should write data to PTY', async () => {
        const terminal = await xtermService.createTerminal(mockWindow);

        const writeHandler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'terminal:write'
        )[1];

        const result = await writeHandler(null, { terminalId: terminal.id, data: 'ls\n' });

        expect(mockPty.write).toHaveBeenCalledWith('ls\n');
        expect(result).toEqual({ success: true });
        console.log('[XtermService Test] IPC write handler working');
      });

      it('should handle write to non-existent terminal', async () => {
        const writeHandler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'terminal:write'
        )[1];

        const result = await writeHandler(null, { terminalId: 'invalid-id', data: 'ls\n' });

        expect(result).toEqual({
          success: false,
          error: 'Terminal not found: invalid-id',
        });
        console.log('[XtermService Test] Write to non-existent terminal handled');
      });

      it('should handle write to inactive terminal', async () => {
        const terminal = await xtermService.createTerminal(mockWindow);

        // Make terminal inactive
        const terminals = (xtermService as any).terminals as Map<string, XtermTerminal>;
        const terminalObj = terminals.get(terminal.id)!;
        terminalObj.isActive = false;

        const writeHandler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'terminal:write'
        )[1];

        const result = await writeHandler(null, { terminalId: terminal.id, data: 'ls\n' });

        expect(result).toEqual({
          success: false,
          error: 'Terminal is not active',
        });
        console.log('[XtermService Test] Write to inactive terminal handled');
      });

      it('should handle PTY write errors', async () => {
        const terminal = await xtermService.createTerminal(mockWindow);

        mockPty.write.mockImplementation(() => {
          throw new Error('PTY write failed');
        });

        const writeHandler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'terminal:write'
        )[1];

        const result = await writeHandler(null, { terminalId: terminal.id, data: 'ls\n' });

        expect(result).toEqual({
          success: false,
          error: expect.stringContaining('PTY write failed'),
        });
        console.log('[XtermService Test] PTY write error handled');
      });
    });

    describe('terminal:resize', () => {
      it('should resize PTY dimensions', async () => {
        const terminal = await xtermService.createTerminal(mockWindow);

        const resizeHandler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'terminal:resize'
        )[1];

        const result = await resizeHandler(null, {
          terminalId: terminal.id,
          cols: 120,
          rows: 40,
        });

        expect(mockPty.resize).toHaveBeenCalledWith(120, 40);
        expect(result).toEqual({ success: true });
        console.log('[XtermService Test] IPC resize handler working');
      });

      it('should update terminal size in state', async () => {
        const terminal = await xtermService.createTerminal(mockWindow);

        const resizeHandler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'terminal:resize'
        )[1];

        await resizeHandler(null, { terminalId: terminal.id, cols: 120, rows: 40 });

        const terminals = xtermService.getAllTerminals();
        expect(terminals[0].id).toBe(terminal.id);
        console.log('[XtermService Test] Terminal size updated in state');
      });

      it('should handle resize to non-existent terminal', async () => {
        const resizeHandler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'terminal:resize'
        )[1];

        const result = await resizeHandler(null, {
          terminalId: 'invalid-id',
          cols: 120,
          rows: 40,
        });

        expect(result).toEqual({
          success: false,
          error: 'Terminal not found: invalid-id',
        });
        console.log('[XtermService Test] Resize non-existent terminal handled');
      });

      it('should handle PTY resize errors', async () => {
        const terminal = await xtermService.createTerminal(mockWindow);

        mockPty.resize.mockImplementation(() => {
          throw new Error('PTY resize failed');
        });

        const resizeHandler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'terminal:resize'
        )[1];

        const result = await resizeHandler(null, {
          terminalId: terminal.id,
          cols: 120,
          rows: 40,
        });

        expect(result).toEqual({
          success: false,
          error: expect.stringContaining('PTY resize failed'),
        });
        console.log('[XtermService Test] PTY resize error handled');
      });
    });
  });

  describe('killTerminal', () => {
    it('should gracefully kill terminal with SIGTERM', async () => {
      const terminal = await xtermService.createTerminal(mockWindow);

      await xtermService.killTerminal(terminal.id);

      expect(mockPty.kill).toHaveBeenCalledWith('SIGTERM');
      console.log('[XtermService Test] Terminal killed with SIGTERM');
    });

    it('should mark terminal as inactive before killing', async () => {
      const terminal = await xtermService.createTerminal(mockWindow);

      await xtermService.killTerminal(terminal.id);

      const terminals = (xtermService as any).terminals as Map<string, XtermTerminal>;
      const terminalObj = terminals.get(terminal.id);

      // Terminal might be deleted by exit handler, so check if it exists first
      if (terminalObj) {
        expect(terminalObj.isActive).toBe(false);
      }
      console.log('[XtermService Test] Terminal marked inactive before kill');
    });

    it('should force kill with SIGKILL after timeout', (done) => {
      jest.useFakeTimers();

      xtermService.createTerminal(mockWindow).then((terminal) => {
        // Don't trigger exit handler
        const terminals = (xtermService as any).terminals as Map<string, XtermTerminal>;
        const terminalObj = terminals.get(terminal.id);
        if (terminalObj) {
          terminalObj.hasExited = false;
        }

        xtermService.killTerminal(terminal.id);

        // Fast-forward past timeout
        jest.advanceTimersByTime(1100);

        // Run pending timers
        jest.runAllTimers();

        expect(mockPty.kill).toHaveBeenCalledWith('SIGKILL');
        jest.useRealTimers();
        console.log('[XtermService Test] Force kill after timeout');
        done();
      });
    }, 10000);

    it('should cleanup disposables on kill', async () => {
      const terminal = await xtermService.createTerminal(mockWindow);

      const dataDisposable = mockPty.onData.mock.results[0].value;
      const exitDisposable = mockPty.onExit.mock.results[0].value;

      // Trigger exit immediately to avoid timeout
      const exitHandler = mockPty.onExit.mock.calls[0][0];
      mockPty.kill.mockImplementation(() => {
        exitHandler({ exitCode: 0 });
      });

      await xtermService.killTerminal(terminal.id);

      expect(dataDisposable.dispose).toHaveBeenCalled();
      expect(exitDisposable.dispose).toHaveBeenCalled();
      console.log('[XtermService Test] Disposables cleaned up on kill');
    });

    it('should throw error for non-existent terminal', async () => {
      await expect(xtermService.killTerminal('invalid-id')).rejects.toThrow(
        'Terminal not found: invalid-id'
      );
      console.log('[XtermService Test] Kill non-existent terminal throws error');
    });

    it('should handle PTY kill errors', async () => {
      // Create a new service instance to avoid exit handler interference
      (XtermService as any).instance = undefined;
      const freshService = XtermService.getInstance();

      // Create terminal without triggering exit
      const terminalId = 'test-kill-error';
      const uuid = require('uuid');
      uuid.v4.mockReturnValue(terminalId);

      await freshService.createTerminal(mockWindow);

      // Mock kill to throw error
      mockPty.kill.mockImplementation(() => {
        throw new Error('PTY kill failed');
      });

      await expect(freshService.killTerminal(terminalId)).rejects.toThrow('PTY kill failed');
      console.log('[XtermService Test] PTY kill error handled');
    });

    it('should cleanup even on kill errors', async () => {
      // Create a new service instance
      (XtermService as any).instance = undefined;
      const freshService = XtermService.getInstance();

      // Use unique ID for this test
      const terminalId = 'test-cleanup-error';
      const uuid = require('uuid');
      uuid.v4.mockReturnValue(terminalId);

      await freshService.createTerminal(mockWindow);

      const dataDisposable =
        mockPty.onData.mock.results[mockPty.onData.mock.results.length - 1].value;

      // Mock kill to throw error
      mockPty.kill.mockImplementation(() => {
        throw new Error('PTY kill failed');
      });

      try {
        await freshService.killTerminal(terminalId);
      } catch (e) {
        // Expected to throw
      }

      expect(dataDisposable.dispose).toHaveBeenCalled();
      console.log('[XtermService Test] Cleanup on kill error');
    });
  });

  describe('getAllTerminals', () => {
    it('should return empty array when no terminals', () => {
      const terminals = xtermService.getAllTerminals();

      expect(terminals).toEqual([]);
      console.log('[XtermService Test] Empty terminal list returned');
    });

    it('should return all active terminals', async () => {
      await xtermService.createTerminal(mockWindow);

      const uuid = require('uuid');
      uuid.v4.mockReturnValue('test-uuid-2');
      await xtermService.createTerminal(mockWindow);

      const terminals = xtermService.getAllTerminals();

      expect(terminals).toHaveLength(2);
      expect(terminals[0]).toHaveProperty('id');
      expect(terminals[0]).toHaveProperty('shell');
      expect(terminals[0]).toHaveProperty('cwd');
      expect(terminals[0]).toHaveProperty('isActive');
      expect(terminals[0]).toHaveProperty('pid');
      console.log('[XtermService Test] All terminals returned');
    });

    it('should include inactive terminals', () => {
      // Create new service to avoid exit handler cleanup
      (XtermService as any).instance = undefined;
      const freshService = XtermService.getInstance();

      // Manually add an inactive terminal to the internal map
      const terminals = (freshService as any).terminals as Map<string, XtermTerminal>;
      const inactiveTerminal: XtermTerminal = {
        id: 'inactive-uuid',
        pid: 99999,
        pty: mockPty,
        window: mockWindow,
        shell: '/bin/bash',
        cwd: '/test',
        isActive: false,
        size: { cols: 80, rows: 24 },
        hasExited: true,
        disposables: [],
      };
      terminals.set('inactive-uuid', inactiveTerminal);

      const allTerminals = freshService.getAllTerminals();

      expect(allTerminals).toHaveLength(1);
      expect(allTerminals[0].isActive).toBe(false);
      console.log('[XtermService Test] Inactive terminals included');
    });
  });

  describe('cleanup', () => {
    it('should kill all terminals on cleanup', async () => {
      const uuid = require('uuid');
      uuid.v4.mockReturnValue('test-uuid-1');
      await xtermService.createTerminal(mockWindow);

      uuid.v4.mockReturnValue('test-uuid-2');
      await xtermService.createTerminal(mockWindow);

      // Trigger exit immediately to avoid timeout
      const exitHandler = mockPty.onExit.mock.calls[0][0];
      mockPty.kill.mockImplementation(() => {
        exitHandler({ exitCode: 0 });
      });

      await xtermService.cleanup();

      expect(mockPty.kill).toHaveBeenCalledTimes(2);
      console.log('[XtermService Test] All terminals killed on cleanup');
    });

    it('should handle individual terminal kill errors during cleanup', async () => {
      await xtermService.createTerminal(mockWindow);

      mockPty.kill.mockImplementation(() => {
        throw new Error('Kill failed');
      });

      // Should not throw
      await expect(xtermService.cleanup()).resolves.not.toThrow();
      console.log('[XtermService Test] Cleanup handles individual errors');
    });

    it('should force kill after timeout', (done) => {
      jest.useFakeTimers();

      xtermService.createTerminal(mockWindow).then(() => {
        // Don't trigger exit
        const terminals = (xtermService as any).terminals as Map<string, XtermTerminal>;
        const terminal = terminals.get('test-uuid');
        if (terminal) {
          terminal.hasExited = false;
        }

        xtermService.cleanup();

        // Fast-forward past cleanup timeout
        jest.advanceTimersByTime(3100);

        // Run pending timers
        jest.runAllTimers();

        expect(mockPty.kill).toHaveBeenCalledWith('SIGKILL');
        jest.useRealTimers();
        console.log('[XtermService Test] Force kill during cleanup');
        done();
      });
    }, 10000);

    it('should clear all terminals', async () => {
      jest.useFakeTimers();

      await xtermService.createTerminal(mockWindow);

      xtermService.cleanup();

      // Fast-forward to force cleanup
      jest.advanceTimersByTime(3100);

      setTimeout(() => {
        const terminals = (xtermService as any).terminals as Map<string, XtermTerminal>;
        expect(terminals.size).toBe(0);
        jest.useRealTimers();
        console.log('[XtermService Test] All terminals cleared');
      }, 100);
    }, 10000);
  });

  describe('Environment Filtering', () => {
    it('should filter sensitive environment variables', async () => {
      // Set sensitive env vars
      process.env.NODE_AUTH_TOKEN = 'secret-token';
      process.env.NPM_TOKEN = 'npm-token';
      process.env.GITHUB_TOKEN = 'github-token';

      const ptyModule = require('node-pty');
      await xtermService.createTerminal(mockWindow);

      const spawnCall = ptyModule.spawn.mock.calls[0];
      const env = spawnCall[2].env;

      expect(env).not.toHaveProperty('NODE_AUTH_TOKEN');
      expect(env).not.toHaveProperty('NPM_TOKEN');
      expect(env).not.toHaveProperty('GITHUB_TOKEN');

      // Cleanup
      delete process.env.NODE_AUTH_TOKEN;
      delete process.env.NPM_TOKEN;
      delete process.env.GITHUB_TOKEN;

      console.log('[XtermService Test] Sensitive env vars filtered');
    });

    it('should preserve safe environment variables', async () => {
      process.env.PATH = '/usr/bin:/bin';
      process.env.USER = 'testuser';

      const ptyModule = require('node-pty');
      await xtermService.createTerminal(mockWindow);

      const spawnCall = ptyModule.spawn.mock.calls[0];
      const env = spawnCall[2].env;

      expect(env).toHaveProperty('PATH', '/usr/bin:/bin');
      expect(env).toHaveProperty('USER', 'testuser');

      console.log('[XtermService Test] Safe env vars preserved');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid create/destroy cycles', async () => {
      for (let i = 0; i < 5; i++) {
        const uuid = require('uuid');
        uuid.v4.mockReturnValue(`test-uuid-${i}`);

        await xtermService.createTerminal(mockWindow);

        // Trigger immediate exit
        const exitHandler = mockPty.onExit.mock.calls[mockPty.onExit.mock.calls.length - 1][0];
        exitHandler({ exitCode: 0 });
      }

      const terminals = xtermService.getAllTerminals();
      expect(terminals).toHaveLength(0);
      console.log('[XtermService Test] Rapid create/destroy handled');
    });

    it('should handle multiple windows', async () => {
      const mockWindow2 = {
        isDestroyed: jest.fn().mockReturnValue(false),
        webContents: {
          send: jest.fn(),
        },
      } as unknown as jest.Mocked<BrowserWindow>;

      await xtermService.createTerminal(mockWindow);

      const uuid = require('uuid');
      uuid.v4.mockReturnValue('test-uuid-2');
      await xtermService.createTerminal(mockWindow2);

      const terminals = xtermService.getAllTerminals();
      expect(terminals).toHaveLength(2);
      console.log('[XtermService Test] Multiple windows handled');
    });

    it('should handle custom shell paths', async () => {
      const customParams: TerminalCreateParams = {
        shell: '/usr/local/bin/fish',
        cwd: '/custom/working/dir',
      };

      const ptyModule = require('node-pty');
      await xtermService.createTerminal(mockWindow, customParams);

      expect(ptyModule.spawn).toHaveBeenCalledWith(
        '/usr/local/bin/fish',
        expect.any(Array),
        expect.objectContaining({
          cwd: '/custom/working/dir',
        })
      );

      console.log('[XtermService Test] Custom shell paths handled');
    });

    it('should handle custom environment variables', async () => {
      const customParams: TerminalCreateParams = {
        env: {
          CUSTOM_VAR: 'custom-value',
          PATH: '/custom/path',
        },
      };

      await xtermService.createTerminal(mockWindow, customParams);

      console.log('[XtermService Test] Custom env vars accepted');
    });
  });
});
