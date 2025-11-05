/**
 * useTerminal Hook Tests
 * Following TDD approach for Phase 3: UI Components and Integration
 */

import { renderHook, act } from '@testing-library/react';
import { useTerminal } from '@/hooks/useTerminal';

// Mock IPC
const mockInvoke = jest.fn();
const mockOn = jest.fn(() => jest.fn()); // Return a cleanup function
const mockRemoveAllListeners = jest.fn();

// Mock electron API
Object.defineProperty(window, 'electron', {
  value: {
    ipc: {
      invoke: mockInvoke,
      on: mockOn,
    },
    ipcRenderer: {
      removeAllListeners: mockRemoveAllListeners,
    },
  },
  writable: true,
});

describe('useTerminal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTerminal', () => {
    it('should create terminal with default parameters', async () => {
      const mockTerminalData = {
        id: 'terminal-1',
        pid: 1234,
        title: 'Terminal 1',
        isActive: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        lastAccessed: '2023-01-01T00:00:00.000Z',
        shell: '/bin/zsh',
        cwd: '/home/user',
        size: { cols: 80, rows: 24 },
        status: 'running',
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: mockTerminalData,
      });

      const { result } = renderHook(() => useTerminal());

      await act(async () => {
        const terminal = await result.current.createTerminal();
        expect(terminal).toEqual({
          ...mockTerminalData,
          createdAt: new Date('2023-01-01T00:00:00.000Z'),
          lastAccessed: new Date('2023-01-01T00:00:00.000Z'),
        });
      });

      expect(mockInvoke).toHaveBeenCalledWith('terminal:create', undefined);
    });

    it('should create terminal with custom parameters', async () => {
      const params = {
        shell: '/bin/bash',
        cwd: '/home/custom',
        size: { cols: 120, rows: 30 },
        title: 'Custom Terminal',
      };

      const mockTerminalData = {
        id: 'terminal-1',
        pid: 1234,
        title: 'Custom Terminal',
        isActive: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        lastAccessed: '2023-01-01T00:00:00.000Z',
        shell: '/bin/bash',
        cwd: '/home/custom',
        size: { cols: 120, rows: 30 },
        status: 'running',
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: mockTerminalData,
      });

      const { result } = renderHook(() => useTerminal());

      await act(async () => {
        await result.current.createTerminal(params);
      });

      expect(mockInvoke).toHaveBeenCalledWith('terminal:create', params);
    });

    it('should handle creation errors', async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        error: 'Maximum terminal limit reached',
      });

      const { result } = renderHook(() => useTerminal());

      await act(async () => {
        await expect(result.current.createTerminal()).rejects.toThrow(
          'Maximum terminal limit reached'
        );
      });
    });
  });

  describe('writeToTerminal', () => {
    it('should write data to terminal', async () => {
      mockInvoke.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useTerminal());

      await act(async () => {
        await result.current.writeToTerminal('terminal-1', 'ls -la\n');
      });

      expect(mockInvoke).toHaveBeenCalledWith('terminal:write', {
        terminalId: 'terminal-1',
        data: 'ls -la\n',
      });
    });

    it('should handle write errors', async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        error: 'Terminal not found',
      });

      const { result } = renderHook(() => useTerminal());

      await act(async () => {
        await expect(result.current.writeToTerminal('terminal-1', 'test')).rejects.toThrow(
          'Terminal not found'
        );
      });
    });
  });

  describe('resizeTerminal', () => {
    it('should resize terminal', async () => {
      mockInvoke.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useTerminal());

      await act(async () => {
        await result.current.resizeTerminal('terminal-1', 120, 30);
      });

      expect(mockInvoke).toHaveBeenCalledWith('terminal:resize', {
        terminalId: 'terminal-1',
        cols: 120,
        rows: 30,
      });
    });
  });

  describe('destroyTerminal', () => {
    it('should destroy terminal', async () => {
      mockInvoke.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useTerminal());

      await act(async () => {
        await result.current.destroyTerminal('terminal-1');
      });

      expect(mockInvoke).toHaveBeenCalledWith('terminal:destroy', 'terminal-1');
    });
  });

  describe('data event handling', () => {
    it('should set up data listeners for terminal', () => {
      const { result } = renderHook(() => useTerminal());

      act(() => {
        result.current.setupTerminalListeners('terminal-1', jest.fn(), jest.fn());
      });

      expect(mockOn).toHaveBeenCalledWith('terminal:data:terminal-1', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('terminal:exit:terminal-1', expect.any(Function));
    });

    it('should cleanup listeners on unmount', () => {
      const dataCleanup = jest.fn();
      const exitCleanup = jest.fn();

      // Configure mockOn to return cleanup functions in sequence
      let callCount = 0;
      mockOn.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return dataCleanup;
        if (callCount === 2) return exitCleanup;
        return jest.fn();
      });

      const { result, unmount } = renderHook(() => useTerminal());

      act(() => {
        result.current.setupTerminalListeners('terminal-1', jest.fn(), jest.fn());
      });

      unmount();

      // Verify cleanup functions were called
      expect(dataCleanup).toHaveBeenCalled();
      expect(exitCleanup).toHaveBeenCalled();
    });
  });
});
