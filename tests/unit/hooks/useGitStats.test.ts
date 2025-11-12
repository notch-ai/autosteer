/**
 * Unit Tests for useGitStats Hook
 *
 * Tests git statistics fetching with IPC integration, polling, and error handling.
 * Follows TDD approach with comprehensive coverage.
 *
 * Test Coverage:
 * - Hook initialization and default state
 * - Git stats fetching from IPC
 * - Mock data mode for development
 * - Polling mechanism with intervals
 * - Error handling and logging
 * - Cleanup on unmount
 * - Refetch functionality
 *
 * Target Coverage: 80%+
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useGitStats } from '@/hooks/useGitStats';
import { logger } from '@/commons/utils/logger';

// Mock logger
jest.mock('@/commons/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock IPC renderer
const mockInvoke = jest.fn();
const mockIpcRenderer = {
  invoke: mockInvoke,
};

// Set up window.electron mock
Object.defineProperty(window, 'electron', {
  writable: true,
  value: {
    ipcRenderer: mockIpcRenderer,
  },
});

describe('useGitStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    it('should initialize with mock data when enabled', async () => {
      jest.useFakeTimers();

      const { result } = renderHook(() =>
        useGitStats({ workingDirectory: '/test/repo', useMockData: true })
      );

      // Initially loading
      expect(result.current.loading).toBe(true);
      expect(result.current.stats).toEqual([]);
      expect(result.current.refetch).toBeDefined();

      // Advance timers for mock data delay
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Should have mock stats after delay
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.stats.length).toBeGreaterThan(0);
      });

      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('should not fetch when no working directory provided', async () => {
      const { result } = renderHook(() => useGitStats({ workingDirectory: undefined }));

      await waitFor(() => {
        expect(result.current.stats).toEqual([]);
        expect(result.current.error).toBe('No working directory provided');
        expect(result.current.loading).toBe(false);
      });

      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe('Git Stats Fetching', () => {
    it('should fetch git stats successfully', async () => {
      const mockStats = [
        { file: 'file1.ts', additions: 10, deletions: 5, status: 'modified' as const },
        { file: 'file2.ts', additions: 20, deletions: 3, status: 'modified' as const },
      ];

      mockInvoke.mockResolvedValue({
        success: true,
        stats: mockStats,
        error: null,
      });

      const { result } = renderHook(() =>
        useGitStats({ workingDirectory: '/test/repo', useMockData: false })
      );

      // Initially loading
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.stats).toEqual(mockStats);
        expect(result.current.error).toBe(null);
      });

      expect(mockInvoke).toHaveBeenCalledWith('git:diff-stats', '/test/repo');
      expect(logger.debug).toHaveBeenCalledWith(
        '[useGitStats] Initial fetch triggered',
        expect.any(Object)
      );
    });

    it('should handle IPC fetch errors', async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        stats: [],
        error: 'Git command failed',
      });

      const { result } = renderHook(() =>
        useGitStats({ workingDirectory: '/test/repo', useMockData: false })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.stats).toEqual([]);
      expect(result.current.error).toBe('Git command failed');

      expect(logger.error).toHaveBeenCalledWith(
        '[useGitStats] Error fetching git stats',
        expect.any(Object)
      );
    });

    it('should handle IPC rejection errors', async () => {
      mockInvoke.mockRejectedValue(new Error('IPC connection failed'));

      const { result } = renderHook(() =>
        useGitStats({ workingDirectory: '/test/repo', useMockData: false })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.stats).toEqual([]);
        expect(result.current.error).toBe('IPC connection failed');
      });
    });

    it('should handle undefined IPC result', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useGitStats({ workingDirectory: '/test/repo', useMockData: false })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe('Failed to get git diff stats');
      });
    });
  });

  describe('Mock Data Mode', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('should use mock data when enabled', async () => {
      const { result } = renderHook(() =>
        useGitStats({ workingDirectory: '/test/repo', useMockData: true })
      );

      expect(result.current.loading).toBe(true);

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.stats.length).toBeGreaterThan(0);
      });

      expect(mockInvoke).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('[useGitStats] Using mock data');
    });
  });

  describe('Refetch Functionality', () => {
    it('should refetch git stats on demand', async () => {
      const mockStats = [
        { file: 'file1.ts', additions: 10, deletions: 5, status: 'modified' as const },
      ];

      mockInvoke.mockResolvedValue({
        success: true,
        stats: mockStats,
        error: null,
      });

      const { result } = renderHook(() =>
        useGitStats({ workingDirectory: '/test/repo', useMockData: false })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockInvoke).toHaveBeenCalledTimes(1);

      // Refetch
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Polling Mechanism', () => {
    it('should poll when polling is enabled', async () => {
      const mockStats = [
        { file: 'file1.ts', additions: 10, deletions: 5, status: 'modified' as const },
      ];

      mockInvoke.mockResolvedValue({
        success: true,
        stats: mockStats,
        error: null,
      });

      const { result } = renderHook(() =>
        useGitStats({
          workingDirectory: '/test/repo',
          polling: true,
          pollingInterval: 1000, // Use shorter interval for faster test
          useMockData: false,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Initial fetch
      expect(mockInvoke).toHaveBeenCalledTimes(1);

      // Wait for polling interval
      await new Promise((resolve) => setTimeout(resolve, 1100));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledTimes(2);
      });

      expect(logger.debug).toHaveBeenCalledWith(
        '[useGitStats] Starting polling',
        expect.objectContaining({ interval: 1000 })
      );
    });

    it('should not poll when polling is disabled', async () => {
      const mockStats = [
        { file: 'file1.ts', additions: 10, deletions: 5, status: 'modified' as const },
      ];

      mockInvoke.mockResolvedValue({
        success: true,
        stats: mockStats,
        error: null,
      });

      const { result } = renderHook(() =>
        useGitStats({
          workingDirectory: '/test/repo',
          polling: false,
          useMockData: false,
        })
      );

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Only initial fetch, no polling
      expect(mockInvoke).toHaveBeenCalledTimes(1);

      // Wait to ensure no additional polling happens
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Still only initial fetch
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    it('should cleanup polling interval on unmount', async () => {
      const mockStats = [
        { file: 'file1.ts', additions: 10, deletions: 5, status: 'modified' as const },
      ];

      mockInvoke.mockResolvedValue({
        success: true,
        stats: mockStats,
        error: null,
      });

      const { unmount } = renderHook(() =>
        useGitStats({
          workingDirectory: '/test/repo',
          polling: true,
          pollingInterval: 5000,
          useMockData: false,
        })
      );

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledTimes(1);
      });

      unmount();

      expect(logger.debug).toHaveBeenCalledWith('[useGitStats] Stopping polling');
    });
  });

  describe('Working Directory Changes', () => {
    it('should refetch when working directory changes', async () => {
      const mockStats = [
        { file: 'file1.ts', additions: 10, deletions: 5, status: 'modified' as const },
      ];

      mockInvoke.mockResolvedValue({
        success: true,
        stats: mockStats,
        error: null,
      });

      const { rerender } = renderHook(
        ({ workingDirectory }) => useGitStats({ workingDirectory, useMockData: false }),
        { initialProps: { workingDirectory: '/test/repo1' } }
      );

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('git:diff-stats', '/test/repo1');
      });

      // Change working directory
      rerender({ workingDirectory: '/test/repo2' });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('git:diff-stats', '/test/repo2');
      });
    });
  });

  describe('Loading State Management', () => {
    it('should set loading to true during fetch', async () => {
      let resolvePromise: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockInvoke.mockReturnValue(fetchPromise);

      const { result } = renderHook(() =>
        useGitStats({ workingDirectory: '/test/repo', useMockData: false })
      );

      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolvePromise!({
          success: true,
          stats: [],
          error: null,
        });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });
});
