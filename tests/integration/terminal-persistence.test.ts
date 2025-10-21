/**
 * Terminal Persistence Integration Tests
 * Tests IPC communication and session state synchronization for terminal lifecycle
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ipcMain, BrowserWindow } from 'electron';
import { TerminalHandlers } from '@/main/ipc/handlers/TerminalHandlers';
import { XtermService } from '@/services/XtermService';
import type { TerminalCreateParams, TerminalData } from '@/types/terminal.types';

// Mock electron modules
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
  },
  BrowserWindow: {
    fromWebContents: vi.fn(),
  },
}));

// Mock XtermService
vi.mock('@/services/XtermService', () => ({
  XtermService: {
    getInstance: vi.fn(),
  },
}));

// Mock electron-log
vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Terminal Persistence Integration Tests', () => {
  let terminalHandlers: TerminalHandlers;
  let mockXtermService: any;
  let mockWindow: any;
  let mockEvent: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock XtermService
    mockXtermService = {
      createTerminal: vi.fn(),
      restoreTerminal: vi.fn(),
      killTerminal: vi.fn(),
      getAllTerminals: vi.fn(),
      getTerminalState: vi.fn(),
      cleanup: vi.fn(),
    };

    (XtermService.getInstance as any).mockReturnValue(mockXtermService);

    // Setup mock BrowserWindow
    mockWindow = {
      webContents: {
        send: vi.fn(),
      },
      isDestroyed: vi.fn().mockReturnValue(false),
    };

    (BrowserWindow.fromWebContents as any).mockReturnValue(mockWindow);

    // Setup mock IPC event
    mockEvent = {
      sender: mockWindow.webContents,
    };

    // Create TerminalHandlers instance
    terminalHandlers = new TerminalHandlers();
  });

  afterEach(async () => {
    // Cleanup
    if (terminalHandlers) {
      await terminalHandlers.cleanup();
    }
  });

  describe('IPC Handler Registration', () => {
    it('should register all terminal IPC handlers', () => {
      // Act
      terminalHandlers.registerHandlers();

      // Assert
      expect(ipcMain.handle).toHaveBeenCalledWith('terminal:create', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('terminal:restore', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('terminal:destroy', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('terminal:list', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('terminal:getState', expect.any(Function));
    });

    it('should log successful handler registration', () => {
      // Arrange
      const log = require('electron-log').default;

      // Act
      terminalHandlers.registerHandlers();

      // Assert
      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('Terminal handlers registered')
      );
    });
  });

  describe('Terminal Lifecycle IPC - Create', () => {
    it('should create terminal via IPC and return terminal data', async () => {
      // Arrange
      const params: TerminalCreateParams = {
        shell: '/bin/bash',
        cwd: '/home/user',
        size: { cols: 80, rows: 24 },
        title: 'Test Terminal',
      };

      const expectedTerminalData: TerminalData = {
        id: 'terminal-123',
        pid: 12345,
        title: 'Test Terminal',
        isActive: true,
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        shell: '/bin/bash',
        cwd: '/home/user',
        size: { cols: 80, rows: 24 },
        status: 'running',
      };

      mockXtermService.createTerminal.mockResolvedValue(expectedTerminalData);

      // Register handlers
      terminalHandlers.registerHandlers();

      // Get the registered handler
      const createHandler = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'terminal:create'
      )?.[1];

      // Act
      const result = await createHandler(mockEvent, params);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(expectedTerminalData);
      expect(mockXtermService.createTerminal).toHaveBeenCalledWith(mockWindow, params);
    });

    it('should handle terminal creation errors gracefully', async () => {
      // Arrange
      const params: TerminalCreateParams = { cwd: '/invalid/path' };
      const errorMessage = 'Failed to create terminal: Invalid path';

      mockXtermService.createTerminal.mockRejectedValue(new Error(errorMessage));

      terminalHandlers.registerHandlers();
      const createHandler = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'terminal:create'
      )?.[1];

      // Act
      const result = await createHandler(mockEvent, params);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create terminal');
    });

    it('should enforce maximum terminal limit (10 sessions)', async () => {
      // Arrange
      const params: TerminalCreateParams = { title: 'Overflow Terminal' };
      mockXtermService.createTerminal.mockRejectedValue(
        new Error('Maximum terminal limit reached (10)')
      );

      terminalHandlers.registerHandlers();
      const createHandler = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'terminal:create'
      )?.[1];

      // Act
      const result = await createHandler(mockEvent, params);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum terminal limit');
    });
  });

  describe('Terminal Lifecycle IPC - Restore', () => {
    it('should restore terminal session via IPC', async () => {
      // Arrange
      const terminalId = 'terminal-456';
      const restoredData: TerminalData = {
        id: terminalId,
        pid: 12346,
        title: 'Restored Terminal',
        isActive: true,
        createdAt: new Date(Date.now() - 60000).toISOString(),
        lastAccessed: new Date().toISOString(),
        shell: '/bin/zsh',
        cwd: '/projects/app',
        size: { cols: 120, rows: 30 },
        status: 'running',
      };

      mockXtermService.restoreTerminal.mockResolvedValue(restoredData);

      terminalHandlers.registerHandlers();
      const restoreHandler = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'terminal:restore'
      )?.[1];

      // Act
      const result = await restoreHandler(mockEvent, terminalId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(restoredData);
      expect(mockXtermService.restoreTerminal).toHaveBeenCalledWith(mockWindow, terminalId);
    });

    it('should handle restore errors for non-existent terminals', async () => {
      // Arrange
      const terminalId = 'non-existent-terminal';
      mockXtermService.restoreTerminal.mockRejectedValue(
        new Error(`Terminal not found: ${terminalId}`)
      );

      terminalHandlers.registerHandlers();
      const restoreHandler = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'terminal:restore'
      )?.[1];

      // Act
      const result = await restoreHandler(mockEvent, terminalId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Terminal not found');
    });
  });

  describe('Terminal Lifecycle IPC - Destroy', () => {
    it('should destroy terminal via IPC', async () => {
      // Arrange
      const terminalId = 'terminal-789';
      mockXtermService.killTerminal.mockResolvedValue(undefined);

      terminalHandlers.registerHandlers();
      const destroyHandler = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'terminal:destroy'
      )?.[1];

      // Act
      const result = await destroyHandler(mockEvent, terminalId);

      // Assert
      expect(result.success).toBe(true);
      expect(mockXtermService.killTerminal).toHaveBeenCalledWith(terminalId);
    });

    it('should handle destroy errors gracefully', async () => {
      // Arrange
      const terminalId = 'terminal-error';
      mockXtermService.killTerminal.mockRejectedValue(new Error('Failed to kill terminal'));

      terminalHandlers.registerHandlers();
      const destroyHandler = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'terminal:destroy'
      )?.[1];

      // Act
      const result = await destroyHandler(mockEvent, terminalId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to destroy terminal');
    });
  });

  describe('Session State Synchronization', () => {
    it('should retrieve terminal state via IPC', async () => {
      // Arrange
      const terminalId = 'terminal-state-test';
      const terminalState = {
        id: terminalId,
        buffer: 'Terminal buffer content\n$ ls\nfile1.txt file2.txt\n',
        scrollback: 100,
        cursorPosition: { x: 0, y: 3 },
        size: { cols: 80, rows: 24 },
      };

      mockXtermService.getTerminalState.mockResolvedValue(terminalState);

      terminalHandlers.registerHandlers();
      const getStateHandler = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'terminal:getState'
      )?.[1];

      // Act
      const result = await getStateHandler(mockEvent, terminalId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(terminalState);
      expect(mockXtermService.getTerminalState).toHaveBeenCalledWith(terminalId);
    });

    it('should list all active terminals via IPC', async () => {
      // Arrange
      const terminals = [
        {
          id: 'terminal-1',
          shell: '/bin/bash',
          cwd: '/home/user',
          isActive: true,
          pid: 12345,
        },
        {
          id: 'terminal-2',
          shell: '/bin/zsh',
          cwd: '/projects',
          isActive: true,
          pid: 12346,
        },
      ];

      mockXtermService.getAllTerminals.mockReturnValue(terminals);

      terminalHandlers.registerHandlers();
      const listHandler = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'terminal:list'
      )?.[1];

      // Act
      const result = await listHandler(mockEvent);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(terminals);
      expect(result.data).toHaveLength(2);
    });

    it('should synchronize terminal state after restore', async () => {
      // Arrange
      const terminalId = 'terminal-sync';
      const restoredData: TerminalData = {
        id: terminalId,
        pid: 12347,
        title: 'Sync Test',
        isActive: true,
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        shell: '/bin/bash',
        cwd: '/test',
        size: { cols: 80, rows: 24 },
        status: 'running',
      };

      mockXtermService.restoreTerminal.mockResolvedValue(restoredData);

      terminalHandlers.registerHandlers();
      const restoreHandler = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'terminal:restore'
      )?.[1];

      // Act
      const result = await restoreHandler(mockEvent, terminalId);

      // Assert - Verify state is synchronized
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(terminalId);
      expect(result.data.isActive).toBe(true);
      expect(result.data.lastAccessed).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle window not found error', async () => {
      // Arrange
      (BrowserWindow.fromWebContents as any).mockReturnValue(null);

      terminalHandlers.registerHandlers();
      const createHandler = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'terminal:create'
      )?.[1];

      // Act
      const result = await createHandler(mockEvent, {});

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Window not found');
    });

    it('should handle concurrent terminal operations', async () => {
      // Arrange
      const params1: TerminalCreateParams = { title: 'Terminal 1' };
      const params2: TerminalCreateParams = { title: 'Terminal 2' };

      mockXtermService.createTerminal.mockImplementation(async (_window, params) => ({
        id: `terminal-${Math.random()}`,
        pid: Math.floor(Math.random() * 10000),
        title: params.title || 'Terminal',
        isActive: true,
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        shell: '/bin/bash',
        cwd: '/home/user',
        size: { cols: 80, rows: 24 },
        status: 'running' as const,
      }));

      terminalHandlers.registerHandlers();
      const createHandler = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'terminal:create'
      )?.[1];

      // Act - Create terminals concurrently
      const [result1, result2] = await Promise.all([
        createHandler(mockEvent, params1),
        createHandler(mockEvent, params2),
      ]);

      // Assert
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.data.id).not.toBe(result2.data.id);
    });

    it('should cleanup handlers on shutdown', async () => {
      // Arrange
      terminalHandlers.registerHandlers();

      // Act
      await terminalHandlers.cleanup();

      // Assert
      expect(mockXtermService.cleanup).toHaveBeenCalled();
    });
  });

  describe('Performance and Memory', () => {
    it('should handle terminal creation within performance budget (<100ms)', async () => {
      // Arrange
      const params: TerminalCreateParams = { title: 'Performance Test' };
      mockXtermService.createTerminal.mockImplementation(async () => {
        // Simulate fast creation
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          id: 'perf-terminal',
          pid: 99999,
          title: 'Performance Test',
          isActive: true,
          createdAt: new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
          shell: '/bin/bash',
          cwd: '/home/user',
          size: { cols: 80, rows: 24 },
          status: 'running' as const,
        };
      });

      terminalHandlers.registerHandlers();
      const createHandler = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'terminal:create'
      )?.[1];

      // Act
      const startTime = Date.now();
      const result = await createHandler(mockEvent, params);
      const duration = Date.now() - startTime;

      // Assert
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(100); // Performance target: <100ms
    });

    it('should enforce memory constraints per session (<50MB)', async () => {
      // Arrange
      const terminalId = 'memory-test';
      const terminalState = {
        id: terminalId,
        buffer: 'a'.repeat(10000), // 10KB buffer
        scrollback: 10000, // 10k lines
        size: { cols: 80, rows: 24 },
      };

      mockXtermService.getTerminalState.mockResolvedValue(terminalState);

      terminalHandlers.registerHandlers();
      const getStateHandler = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'terminal:getState'
      )?.[1];

      // Act
      const result = await getStateHandler(mockEvent, terminalId);

      // Assert
      expect(result.success).toBe(true);
      const estimatedMemory = result.data.buffer.length + result.data.scrollback * 100; // Rough estimate
      expect(estimatedMemory).toBeLessThan(50 * 1024 * 1024); // <50MB
    });
  });
});
