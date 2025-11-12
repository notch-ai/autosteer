/**
 * Unit Tests for useFileDiff Hook
 *
 * Tests file diff fetching with IPC integration, loading states, and error handling.
 * Follows TDD approach with comprehensive coverage.
 *
 * Test Coverage:
 * - Hook initialization and default state
 * - File diff fetching from IPC
 * - Mock data mode for development
 * - Loading state management
 * - Error handling and logging
 * - Multiple file fetches
 *
 * Target Coverage: 80%+
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useFileDiff } from '@/hooks/useFileDiff';
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

describe('useFileDiff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    it('should initialize with empty diff and no loading state', () => {
      const { result } = renderHook(() =>
        useFileDiff({ workingDirectory: '/test/repo', useMockData: false })
      );

      expect(result.current.fileDiff).toEqual([]);
      expect(result.current.loadingDiff).toBe(false);
      expect(result.current.fetchFileDiff).toBeDefined();
    });
  });

  describe('File Diff Fetching', () => {
    it('should fetch file diff successfully', async () => {
      const mockDiff = [
        {
          oldFile: 'src/file1.ts',
          newFile: 'src/file1.ts',
          hunks: [
            {
              oldStart: 1,
              oldLines: 3,
              newStart: 1,
              newLines: 4,
              content: '@@ -1,3 +1,4 @@\n line1\n+line2\n line3',
            },
          ],
        },
      ];

      mockInvoke.mockResolvedValue(mockDiff);

      const { result } = renderHook(() =>
        useFileDiff({ workingDirectory: '/test/repo', useMockData: false })
      );

      await act(async () => {
        await result.current.fetchFileDiff('src/file1.ts');
      });

      await waitFor(() => {
        expect(result.current.loadingDiff).toBe(false);
      });

      expect(result.current.fileDiff).toEqual(mockDiff);

      expect(mockInvoke).toHaveBeenCalledWith('git-diff:get-uncommitted', {
        repoPath: '/test/repo',
        filePath: 'src/file1.ts',
      });

      expect(logger.debug).toHaveBeenCalledWith(
        '[useFileDiff] Fetching file diff',
        expect.objectContaining({ file: 'src/file1.ts' })
      );
    });

    it('should handle empty diff response', async () => {
      mockInvoke.mockResolvedValue([]);

      const { result } = renderHook(() =>
        useFileDiff({ workingDirectory: '/test/repo', useMockData: false })
      );

      await act(async () => {
        await result.current.fetchFileDiff('src/empty.ts');
      });

      await waitFor(() => {
        expect(result.current.loadingDiff).toBe(false);
      });

      expect(result.current.fileDiff).toEqual([]);
    });

    it('should handle undefined IPC result', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useFileDiff({ workingDirectory: '/test/repo', useMockData: false })
      );

      await act(async () => {
        await result.current.fetchFileDiff('src/file.ts');
      });

      await waitFor(() => {
        expect(result.current.loadingDiff).toBe(false);
      });

      expect(result.current.fileDiff).toEqual([]);
    });

    it('should handle IPC errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Git diff failed'));

      const { result } = renderHook(() =>
        useFileDiff({ workingDirectory: '/test/repo', useMockData: false })
      );

      await act(async () => {
        await result.current.fetchFileDiff('src/file.ts');
      });

      await waitFor(() => {
        expect(result.current.loadingDiff).toBe(false);
      });

      expect(result.current.fileDiff).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        '[useFileDiff] Error fetching file diff',
        expect.objectContaining({ error: 'Git diff failed' })
      );
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
        useFileDiff({ workingDirectory: '/test/repo', useMockData: true })
      );

      // Start the fetch
      let fetchPromise: Promise<void>;
      act(() => {
        fetchPromise = result.current.fetchFileDiff('src/components/Button.tsx');
      });

      // Advance timers to complete the setTimeout
      act(() => {
        jest.advanceTimersByTime(200);
      });

      // Wait for the promise to resolve
      await act(async () => {
        await fetchPromise!;
      });

      expect(result.current.loadingDiff).toBe(false);
      expect(mockInvoke).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        '[useFileDiff] Using mock data',
        expect.objectContaining({ file: 'src/components/Button.tsx' })
      );
    });

    it('should handle mock file not found', async () => {
      const { result } = renderHook(() =>
        useFileDiff({ workingDirectory: '/test/repo', useMockData: true })
      );

      // Start the fetch
      let fetchPromise: Promise<void>;
      act(() => {
        fetchPromise = result.current.fetchFileDiff('nonexistent/file.ts');
      });

      // Advance timers to complete the setTimeout
      act(() => {
        jest.advanceTimersByTime(200);
      });

      // Wait for the promise to resolve
      await act(async () => {
        await fetchPromise!;
      });

      expect(result.current.loadingDiff).toBe(false);
      expect(result.current.fileDiff).toEqual([]);
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
        useFileDiff({ workingDirectory: '/test/repo', useMockData: false })
      );

      // Start fetch
      act(() => {
        void result.current.fetchFileDiff('src/file.ts');
      });

      // Should be loading
      await waitFor(() => {
        expect(result.current.loadingDiff).toBe(true);
      });

      // Resolve promise
      await act(async () => {
        resolvePromise!([]);
      });

      // Should no longer be loading
      await waitFor(() => {
        expect(result.current.loadingDiff).toBe(false);
      });
    });
  });

  describe('No Working Directory', () => {
    it('should handle fetch without working directory', async () => {
      const { result } = renderHook(() =>
        useFileDiff({ workingDirectory: undefined, useMockData: false })
      );

      await act(async () => {
        await result.current.fetchFileDiff('src/file.ts');
      });

      await waitFor(() => {
        expect(result.current.loadingDiff).toBe(false);
      });

      expect(result.current.fileDiff).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith('[useFileDiff] No working directory provided');
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe('Multiple File Fetches', () => {
    it('should handle sequential fetches correctly', async () => {
      const mockDiff1 = [{ oldFile: 'file1.ts', newFile: 'file1.ts', hunks: [] }];
      const mockDiff2 = [{ oldFile: 'file2.ts', newFile: 'file2.ts', hunks: [] }];

      mockInvoke.mockResolvedValueOnce(mockDiff1).mockResolvedValueOnce(mockDiff2);

      const { result } = renderHook(() =>
        useFileDiff({ workingDirectory: '/test/repo', useMockData: false })
      );

      // Fetch first file
      await act(async () => {
        await result.current.fetchFileDiff('file1.ts');
      });

      expect(result.current.fileDiff).toEqual(mockDiff1);

      // Fetch second file
      await act(async () => {
        await result.current.fetchFileDiff('file2.ts');
      });

      expect(result.current.fileDiff).toEqual(mockDiff2);
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it('should replace previous diff when fetching new file', async () => {
      const mockDiff1 = [{ oldFile: 'file1.ts', newFile: 'file1.ts', hunks: [] }];
      const mockDiff2 = [{ oldFile: 'file2.ts', newFile: 'file2.ts', hunks: [] }];

      mockInvoke.mockResolvedValueOnce(mockDiff1).mockResolvedValueOnce(mockDiff2);

      const { result } = renderHook(() =>
        useFileDiff({ workingDirectory: '/test/repo', useMockData: false })
      );

      // Fetch first file
      await act(async () => {
        await result.current.fetchFileDiff('file1.ts');
      });

      expect(result.current.fileDiff).toEqual(mockDiff1);

      // Fetch second file - should replace first
      await act(async () => {
        await result.current.fetchFileDiff('file2.ts');
      });

      expect(result.current.fileDiff).toEqual(mockDiff2);
      expect(result.current.fileDiff).not.toEqual(mockDiff1);
    });
  });

  describe('Working Directory Changes', () => {
    it('should handle working directory changes', async () => {
      const mockDiff = [{ oldFile: 'file.ts', newFile: 'file.ts', hunks: [] }];

      mockInvoke.mockResolvedValue(mockDiff);

      const { result, rerender } = renderHook(
        ({ workingDirectory }) => useFileDiff({ workingDirectory, useMockData: false }),
        { initialProps: { workingDirectory: '/test/repo1' } }
      );

      await act(async () => {
        await result.current.fetchFileDiff('file.ts');
      });

      expect(mockInvoke).toHaveBeenCalledWith('git-diff:get-uncommitted', {
        repoPath: '/test/repo1',
        filePath: 'file.ts',
      });

      // Clear mock to reset call count
      mockInvoke.mockClear();

      // Change working directory
      rerender({ workingDirectory: '/test/repo2' });

      await act(async () => {
        await result.current.fetchFileDiff('file.ts');
      });

      expect(mockInvoke).toHaveBeenCalledWith('git-diff:get-uncommitted', {
        repoPath: '/test/repo2',
        filePath: 'file.ts',
      });
    });
  });
});
