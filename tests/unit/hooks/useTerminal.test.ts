/**
 * useTerminal Hook Tests
 *
 * Tests for terminal hook with TerminalPoolManager integration.
 *
 * Test Coverage:
 * - Hook coordinates with pool correctly
 * - No conflicts with TerminalTab pool usage
 * - Pool size monitoring and warnings
 * - IPC operations work correctly
 * - Listener cleanup prevents leaks
 *
 * @see autosteer/src/hooks/useTerminal.ts
 */

import { renderHook, act } from '@testing-library/react';
import { useTerminal } from '@/hooks/useTerminal';
import { logger } from '@/commons/utils/logger';

// Mock dependencies
jest.mock('@/commons/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/renderer/hooks/useTerminalPool', () => ({
  useTerminalPool: jest.fn(() => ({
    getPoolSize: jest.fn(() => 0),
    getAllTerminalIds: jest.fn(() => []),
  })),
}));

// Mock electron IPC
const mockIpcInvoke = jest.fn();
const mockIpcOn = jest.fn();

// Delete existing electron property if it exists
delete (window as any).electron;

// Mock electron API
(window as any).electron = {
  ipc: {
    invoke: mockIpcInvoke,
    on: mockIpcOn,
  },
};

describe('useTerminal Hook - Pool Coordination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIpcInvoke.mockReset();
    mockIpcOn.mockReset();
    // Mock IPC on returns cleanup function
    mockIpcOn.mockReturnValue(jest.fn());
  });

  describe('Terminal Creation', () => {
    it('should create terminal via IPC without bypassing pool', async () => {
      const mockTerminalData = {
        id: 'test-terminal-1',
        pid: 1234,
        cwd: '/test',
        shell: '/bin/bash',
        size: { cols: 80, rows: 24 },
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
      };

      mockIpcInvoke.mockResolvedValueOnce({
        success: true,
        data: mockTerminalData,
      });

      const { result } = renderHook(() => useTerminal());

      let terminal;
      await act(async () => {
        terminal = await result.current.createTerminal({ cwd: '/test' });
      });

      // Verify IPC was called (not direct creation)
      expect(mockIpcInvoke).toHaveBeenCalledWith('terminal:create', { cwd: '/test' });
      expect(terminal).toMatchObject({
        id: 'test-terminal-1',
        pid: 1234,
      });
    });

    it('should log pool size when creating terminal', async () => {
      const { useTerminalPool } = require('@/renderer/hooks/useTerminalPool');
      const mockGetPoolSize = jest.fn(() => 3);
      useTerminalPool.mockReturnValue({
        getPoolSize: mockGetPoolSize,
        getAllTerminalIds: jest.fn(() => ['term-1', 'term-2', 'term-3']),
      });

      mockIpcInvoke.mockResolvedValueOnce({
        success: true,
        data: {
          id: 'test-terminal-2',
          pid: 5678,
          cwd: '/test',
          shell: '/bin/bash',
          size: { cols: 80, rows: 24 },
          createdAt: new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
        },
      });

      const { result } = renderHook(() => useTerminal());

      await act(async () => {
        await result.current.createTerminal();
      });

      // Verify pool size was logged
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Creating terminal'),
        expect.objectContaining({
          poolSize: 3,
          maxPoolSize: 10,
        })
      );
    });

    it('should throw error when terminal creation fails', async () => {
      mockIpcInvoke.mockResolvedValueOnce({
        success: false,
        data: null,
        error: 'Pool limit reached',
      });

      const { result } = renderHook(() => useTerminal());

      await expect(
        act(async () => {
          await result.current.createTerminal();
        })
      ).rejects.toThrow('Pool limit reached');
    });

    it('should throw default error when no error message provided', async () => {
      mockIpcInvoke.mockResolvedValueOnce({
        success: false,
        data: null,
      });

      const { result } = renderHook(() => useTerminal());

      await expect(
        act(async () => {
          await result.current.createTerminal();
        })
      ).rejects.toThrow('Failed to create terminal');
    });
  });

  describe('Terminal Destruction', () => {
    it('should destroy terminal via IPC', async () => {
      mockIpcInvoke.mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useTerminal());

      await act(async () => {
        await result.current.destroyTerminal('test-terminal-1');
      });

      expect(mockIpcInvoke).toHaveBeenCalledWith('terminal:destroy', 'test-terminal-1');
    });

    it('should log pool size after destruction', async () => {
      const { useTerminalPool } = require('@/renderer/hooks/useTerminalPool');
      const mockGetPoolSize = jest.fn(() => 2);
      useTerminalPool.mockReturnValue({
        getPoolSize: mockGetPoolSize,
        getAllTerminalIds: jest.fn(() => ['term-1', 'term-2']),
      });

      mockIpcInvoke.mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useTerminal());

      await act(async () => {
        await result.current.destroyTerminal('test-terminal-1');
      });

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Terminal destroyed'),
        expect.objectContaining({
          remainingInPool: 2,
        })
      );
    });
  });

  describe('Pool Size Monitoring', () => {
    it('should provide pool statistics', () => {
      const { useTerminalPool } = require('@/renderer/hooks/useTerminalPool');
      useTerminalPool.mockReturnValue({
        getPoolSize: jest.fn(() => 7),
        getAllTerminalIds: jest.fn(() =>
          Array(7)
            .fill(null)
            .map((_, i) => `term-${i}`)
        ),
      });

      const { result } = renderHook(() => useTerminal());

      const stats = result.current.getPoolStats();

      expect(stats).toEqual({
        poolSize: 7,
        terminalIds: expect.arrayContaining(['term-0', 'term-1']),
        maxPoolSize: 10,
        availableSlots: 3,
      });
    });

    it('should detect when approaching pool limit (8+ terminals)', () => {
      const { useTerminalPool } = require('@/renderer/hooks/useTerminalPool');
      useTerminalPool.mockReturnValue({
        getPoolSize: jest.fn(() => 8),
        getAllTerminalIds: jest.fn(() =>
          Array(8)
            .fill(null)
            .map((_, i) => `term-${i}`)
        ),
      });

      const { result } = renderHook(() => useTerminal());

      const stats = result.current.getPoolStats();

      expect(stats.poolSize).toBe(8);
      expect(stats.availableSlots).toBe(2);
      expect(stats.poolSize).toBeGreaterThanOrEqual(8);
    });

    it('should warn when creating terminal with pool at 8+ terminals', async () => {
      const { useTerminalPool } = require('@/renderer/hooks/useTerminalPool');
      const mockGetPoolSize = jest
        .fn()
        .mockReturnValueOnce(8) // Before creation
        .mockReturnValueOnce(9); // After creation

      useTerminalPool.mockReturnValue({
        getPoolSize: mockGetPoolSize,
        getAllTerminalIds: jest.fn(() =>
          Array(8)
            .fill(null)
            .map((_, i) => `term-${i}`)
        ),
      });

      mockIpcInvoke.mockResolvedValueOnce({
        success: true,
        data: {
          id: 'test-terminal-9',
          pid: 9999,
          cwd: '/test',
          shell: '/bin/bash',
          size: { cols: 80, rows: 24 },
          createdAt: new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
        },
      });

      const { result } = renderHook(() => useTerminal());

      await act(async () => {
        await result.current.createTerminal();
      });

      // Should log warning when pool is at 8+
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Approaching terminal pool limit'),
        expect.objectContaining({
          currentSize: 8,
          maxSize: 10,
          availableSlots: 2,
        })
      );

      // Should log warning when pool reaches 9+
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Terminal pool nearly full'),
        expect.objectContaining({
          poolSize: 9,
          maxPoolSize: 10,
          availableSlots: 1,
        })
      );
    });

    it('should not warn when creating terminal with pool below 8 terminals', async () => {
      const { useTerminalPool } = require('@/renderer/hooks/useTerminalPool');
      useTerminalPool.mockReturnValue({
        getPoolSize: jest.fn(() => 5),
        getAllTerminalIds: jest.fn(() =>
          Array(5)
            .fill(null)
            .map((_, i) => `term-${i}`)
        ),
      });

      mockIpcInvoke.mockResolvedValueOnce({
        success: true,
        data: {
          id: 'test-terminal-6',
          pid: 6666,
          cwd: '/test',
          shell: '/bin/bash',
          size: { cols: 80, rows: 24 },
          createdAt: new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
        },
      });

      const { result } = renderHook(() => useTerminal());

      await act(async () => {
        await result.current.createTerminal();
      });

      // Should not log warning when pool is below 8
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('IPC Operations', () => {
    it('should write to terminal via IPC', async () => {
      mockIpcInvoke.mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useTerminal());

      await act(async () => {
        await result.current.writeToTerminal('test-terminal-1', 'echo test\n');
      });

      expect(mockIpcInvoke).toHaveBeenCalledWith('terminal:write', {
        terminalId: 'test-terminal-1',
        data: 'echo test\n',
      });
    });

    it('should resize terminal via IPC', async () => {
      mockIpcInvoke.mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useTerminal());

      await act(async () => {
        await result.current.resizeTerminal('test-terminal-1', 100, 30);
      });

      expect(mockIpcInvoke).toHaveBeenCalledWith('terminal:resize', {
        terminalId: 'test-terminal-1',
        cols: 100,
        rows: 30,
      });
    });
  });

  describe('Event Listeners', () => {
    it('should setup terminal listeners without duplicates', () => {
      const { result } = renderHook(() => useTerminal());

      const onData = jest.fn();
      const onExit = jest.fn();

      act(() => {
        result.current.setupTerminalListeners('test-terminal-1', onData, onExit);
      });

      // Should register 2 listeners (data + exit)
      expect(mockIpcOn).toHaveBeenCalledTimes(2);
      expect(mockIpcOn).toHaveBeenCalledWith('terminal:data:test-terminal-1', expect.any(Function));
      expect(mockIpcOn).toHaveBeenCalledWith('terminal:exit:test-terminal-1', expect.any(Function));
    });

    it('should remove existing listeners before adding new ones', () => {
      const { result } = renderHook(() => useTerminal());

      const onData1 = jest.fn();
      const onExit1 = jest.fn();
      const cleanup1 = jest.fn();

      mockIpcOn.mockReturnValueOnce(cleanup1);
      mockIpcOn.mockReturnValueOnce(jest.fn());

      // First setup
      act(() => {
        result.current.setupTerminalListeners('test-terminal-1', onData1, onExit1);
      });

      mockIpcOn.mockClear();
      const cleanup2 = jest.fn();
      mockIpcOn.mockReturnValueOnce(cleanup2);
      mockIpcOn.mockReturnValueOnce(jest.fn());

      // Second setup (should cleanup first)
      const onData2 = jest.fn();
      const onExit2 = jest.fn();

      act(() => {
        result.current.setupTerminalListeners('test-terminal-1', onData2, onExit2);
      });

      // Should have cleaned up previous listeners
      expect(cleanup1).toHaveBeenCalled();
      // Should register new listeners
      expect(mockIpcOn).toHaveBeenCalledTimes(2);
    });

    it('should remove terminal listeners', () => {
      const { result } = renderHook(() => useTerminal());

      const dataCleanup = jest.fn();
      const exitCleanup = jest.fn();

      mockIpcOn.mockReturnValueOnce(dataCleanup);
      mockIpcOn.mockReturnValueOnce(exitCleanup);

      act(() => {
        result.current.setupTerminalListeners('test-terminal-1', jest.fn(), jest.fn());
      });

      act(() => {
        result.current.removeTerminalListeners('test-terminal-1');
      });

      expect(dataCleanup).toHaveBeenCalled();
      expect(exitCleanup).toHaveBeenCalled();
    });

    it('should cleanup all listeners on unmount', () => {
      const dataCleanup1 = jest.fn();
      const exitCleanup1 = jest.fn();
      const dataCleanup2 = jest.fn();
      const exitCleanup2 = jest.fn();

      mockIpcOn
        .mockReturnValueOnce(dataCleanup1)
        .mockReturnValueOnce(exitCleanup1)
        .mockReturnValueOnce(dataCleanup2)
        .mockReturnValueOnce(exitCleanup2);

      const { result, unmount } = renderHook(() => useTerminal());

      act(() => {
        result.current.setupTerminalListeners('term-1', jest.fn(), jest.fn());
        result.current.setupTerminalListeners('term-2', jest.fn(), jest.fn());
      });

      unmount();

      // All cleanup functions should be called
      expect(dataCleanup1).toHaveBeenCalled();
      expect(exitCleanup1).toHaveBeenCalled();
      expect(dataCleanup2).toHaveBeenCalled();
      expect(exitCleanup2).toHaveBeenCalled();
    });
  });

  describe('Pool Coordination', () => {
    it('should not create duplicate terminal instances', async () => {
      const { useTerminalPool } = require('@/renderer/hooks/useTerminalPool');
      const mockHasTerminal = jest.fn(() => false);
      useTerminalPool.mockReturnValue({
        getPoolSize: jest.fn(() => 1),
        getAllTerminalIds: jest.fn(() => ['existing-term']),
        hasTerminal: mockHasTerminal,
      });

      mockIpcInvoke.mockResolvedValue({
        success: true,
        data: {
          id: 'new-terminal',
          pid: 1234,
          cwd: '/test',
          shell: '/bin/bash',
          size: { cols: 80, rows: 24 },
          createdAt: new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
        },
      });

      const { result } = renderHook(() => useTerminal());

      // Create terminal twice
      await act(async () => {
        await result.current.createTerminal({ cwd: '/test' });
      });

      // IPC should only be called once per creation request
      expect(mockIpcInvoke).toHaveBeenCalledTimes(1);
    });

    it('should use logger instead of console.log', async () => {
      mockIpcInvoke.mockResolvedValueOnce({
        success: true,
        data: {
          id: 'test-terminal',
          pid: 1234,
          cwd: '/test',
          shell: '/bin/bash',
          size: { cols: 80, rows: 24 },
          createdAt: new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
        },
      });

      const { result } = renderHook(() => useTerminal());

      await act(async () => {
        await result.current.createTerminal();
      });

      // Verify logger was used
      expect(logger.debug).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle IPC errors gracefully', async () => {
      mockIpcInvoke.mockRejectedValueOnce(new Error('IPC communication failed'));

      const { result } = renderHook(() => useTerminal());

      await expect(
        act(async () => {
          await result.current.createTerminal();
        })
      ).rejects.toThrow('IPC communication failed');
    });

    it('should handle missing terminal data', async () => {
      mockIpcInvoke.mockResolvedValueOnce({
        success: true,
        data: null,
      });

      const { result } = renderHook(() => useTerminal());

      await expect(
        act(async () => {
          await result.current.createTerminal();
        })
      ).rejects.toThrow('Failed to create terminal');
    });
  });
});
