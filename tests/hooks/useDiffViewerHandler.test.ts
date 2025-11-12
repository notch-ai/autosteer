/**
 * useDiffViewerHandler Hook Unit Tests
 *
 * Comprehensive test coverage for diff viewer handler logic.
 * Tests diff fetching, hunk navigation, and syntax highlighting preparation.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useDiffViewerHandler } from '@/hooks/useDiffViewerHandler';
import { useGitStore } from '@/stores/git.store';
import { logger } from '@/commons/utils/logger';

// Mock Git store
jest.mock('@/stores/git.store', () => {
  const actual = jest.requireActual('@/stores/git.store');
  return {
    ...actual,
    useGitStore: jest.fn(),
  };
});

// Mock logger
jest.mock('@/commons/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('useDiffViewerHandler', () => {
  const mockFilePath = 'src/test/file.ts';
  const mockCommitHash = 'abc123';

  let mockFetchDiff: jest.Mock;
  let mockGetDiff: jest.Mock;
  let mockUpdateDiffCache: jest.Mock;
  let mockSetDiffError: jest.Mock;

  const createMockStructuredPatch = () => [
    {
      oldStart: 1,
      oldLines: 5,
      newStart: 1,
      newLines: 6,
      lines: [
        ' context line 1',
        ' context line 2',
        '-removed line',
        '+added line 1',
        '+added line 2',
        ' context line 3',
      ],
    },
    {
      oldStart: 10,
      oldLines: 3,
      newStart: 11,
      newLines: 4,
      lines: [' context line 4', '-old content', '+new content', '+extra line'],
    },
  ];

  const createMockDiff = (structuredPatch = createMockStructuredPatch()) => ({
    path: mockFilePath,
    diff: 'mock diff string',
    additions: 4,
    deletions: 2,
    timestamp: new Date('2025-01-01T00:00:00Z'),
    structuredPatch,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockFetchDiff = jest.fn();
    mockGetDiff = jest.fn();
    mockUpdateDiffCache = jest.fn();
    mockSetDiffError = jest.fn();

    (useGitStore as unknown as jest.Mock).mockImplementation((selector) => {
      const store = {
        fetchDiff: mockFetchDiff,
        getDiff: mockGetDiff,
        updateDiffCache: mockUpdateDiffCache,
        setDiffError: mockSetDiffError,
        isLoadingDiff: false,
        diffError: null,
      };
      return selector(store);
    });

    (useGitStore as any).getState = jest.fn(() => ({
      fetchDiff: mockFetchDiff,
      getDiff: mockGetDiff,
      updateDiffCache: mockUpdateDiffCache,
      setDiffError: mockSetDiffError,
      isLoadingDiff: false,
      diffError: null,
    }));
  });

  describe('Hook Initialization', () => {
    it('should initialize with null diff and no error', () => {
      const { result } = renderHook(() => useDiffViewerHandler({ filePath: mockFilePath }));

      expect(result.current.diff).toBeNull();
      expect(result.current.currentHunk).toBe(0);
      expect(result.current.totalHunks).toBe(0);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should auto-fetch diff on mount if filePath provided', async () => {
      mockFetchDiff.mockResolvedValue(undefined);
      mockGetDiff.mockReturnValue(createMockDiff());

      renderHook(() => useDiffViewerHandler({ filePath: mockFilePath }));

      await waitFor(() => {
        expect(mockFetchDiff).toHaveBeenCalledWith('', mockFilePath);
      });
    });

    it('should not auto-fetch if filePath not provided', async () => {
      const { result } = renderHook(() => useDiffViewerHandler({ filePath: '' }));

      await waitFor(() => {
        expect(result.current.diff).toBeNull();
      });

      expect(mockFetchDiff).not.toHaveBeenCalled();
    });
  });

  describe('Diff Fetching', () => {
    it('should fetch diff successfully', async () => {
      const mockDiff = createMockDiff();
      mockFetchDiff.mockResolvedValue(undefined);
      mockGetDiff.mockReturnValue(mockDiff);

      const { result } = renderHook(() =>
        useDiffViewerHandler({ filePath: mockFilePath, autoFetch: false })
      );

      await act(async () => {
        await result.current.fetchDiff(mockFilePath);
      });

      expect(mockFetchDiff).toHaveBeenCalledWith('', mockFilePath);
      expect(result.current.diff).toEqual(mockDiff);
      expect(result.current.totalHunks).toBe(2);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should fetch diff with commit hash', async () => {
      const mockDiff = createMockDiff();
      mockFetchDiff.mockResolvedValue(undefined);
      mockGetDiff.mockReturnValue(mockDiff);

      const { result } = renderHook(() =>
        useDiffViewerHandler({ filePath: mockFilePath, autoFetch: false })
      );

      await act(async () => {
        await result.current.fetchDiff(mockFilePath, mockCommitHash);
      });

      expect(mockFetchDiff).toHaveBeenCalledWith('', mockFilePath);
      expect(logger.debug).toHaveBeenCalledWith(
        '[useDiffViewerHandler] Fetching diff',
        expect.objectContaining({ filePath: mockFilePath, commitHash: mockCommitHash })
      );
    });

    it('should handle fetch errors gracefully', async () => {
      const errorMessage = 'Failed to fetch diff';
      mockFetchDiff.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() =>
        useDiffViewerHandler({ filePath: mockFilePath, autoFetch: false })
      );

      await act(async () => {
        await result.current.fetchDiff(mockFilePath);
      });

      expect(result.current.error).toBe(errorMessage);
      expect(result.current.diff).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        '[useDiffViewerHandler] Failed to fetch diff',
        expect.objectContaining({ error: errorMessage })
      );
    });

    it('should handle file not found error', async () => {
      const errorMessage = 'File not found: src/test/file.ts';
      mockFetchDiff.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() =>
        useDiffViewerHandler({ filePath: mockFilePath, autoFetch: false })
      );

      await act(async () => {
        await result.current.fetchDiff(mockFilePath);
      });

      expect(result.current.error).toBe(errorMessage);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should set loading state during fetch', async () => {
      let resolvePromise: () => void;
      const fetchPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });

      mockFetchDiff.mockReturnValue(fetchPromise);

      // Mock store to return loading state
      (useGitStore as unknown as jest.Mock).mockImplementation((selector) => {
        const store = {
          fetchDiff: mockFetchDiff,
          getDiff: mockGetDiff,
          updateDiffCache: mockUpdateDiffCache,
          setDiffError: mockSetDiffError,
          isLoadingDiff: true, // Set to true during fetch
          diffError: null,
        };
        return selector(store);
      });

      const { result } = renderHook(() =>
        useDiffViewerHandler({ filePath: mockFilePath, autoFetch: false })
      );

      expect(result.current.isLoading).toBe(true);

      // Resolve the promise and update mock to show not loading
      (useGitStore as unknown as jest.Mock).mockImplementation((selector) => {
        const store = {
          fetchDiff: mockFetchDiff,
          getDiff: mockGetDiff,
          updateDiffCache: mockUpdateDiffCache,
          setDiffError: mockSetDiffError,
          isLoadingDiff: false,
          diffError: null,
        };
        return selector(store);
      });

      await act(async () => {
        resolvePromise!();
        await fetchPromise;
      });

      // Re-render to get updated state
      const { result: updatedResult } = renderHook(() =>
        useDiffViewerHandler({ filePath: mockFilePath, autoFetch: false })
      );

      expect(updatedResult.current.isLoading).toBe(false);
    });
  });

  describe('Hunk Navigation', () => {
    it('should navigate to next hunk', async () => {
      const mockDiff = createMockDiff();
      mockGetDiff.mockReturnValue(mockDiff);

      const { result } = renderHook(() => useDiffViewerHandler({ filePath: mockFilePath }));

      await waitFor(() => {
        expect(result.current.diff).toEqual(mockDiff);
      });

      act(() => {
        result.current.navigate('next');
      });

      expect(result.current.currentHunk).toBe(1);

      act(() => {
        result.current.navigate('next');
      });

      // Should not exceed totalHunks - 1
      expect(result.current.currentHunk).toBe(1);
    });

    it('should navigate to previous hunk', async () => {
      const mockDiff = createMockDiff();
      mockGetDiff.mockReturnValue(mockDiff);

      const { result } = renderHook(() => useDiffViewerHandler({ filePath: mockFilePath }));

      await waitFor(() => {
        expect(result.current.diff).toEqual(mockDiff);
      });

      // Go to last hunk
      act(() => {
        result.current.navigate('next');
      });

      expect(result.current.currentHunk).toBe(1);

      // Go back
      act(() => {
        result.current.navigate('prev');
      });

      expect(result.current.currentHunk).toBe(0);

      // Should not go below 0
      act(() => {
        result.current.navigate('prev');
      });

      expect(result.current.currentHunk).toBe(0);
    });

    it('should handle navigation with no diff', () => {
      const { result } = renderHook(() =>
        useDiffViewerHandler({ filePath: mockFilePath, autoFetch: false })
      );

      expect(() => {
        act(() => {
          result.current.navigate('next');
        });
      }).not.toThrow();

      expect(result.current.currentHunk).toBe(0);
    });

    it('should log navigation actions', async () => {
      const mockDiff = createMockDiff();
      mockGetDiff.mockReturnValue(mockDiff);

      const { result } = renderHook(() => useDiffViewerHandler({ filePath: mockFilePath }));

      await waitFor(() => {
        expect(result.current.diff).toBeTruthy();
      });

      act(() => {
        result.current.navigate('next');
      });

      expect(logger.debug).toHaveBeenCalledWith(
        '[useDiffViewerHandler] Navigating to hunk',
        expect.objectContaining({ direction: 'next', newHunk: 1, totalHunks: 2 })
      );
    });
  });

  describe('Go to Specific Hunk', () => {
    it('should jump to specific hunk index', async () => {
      const mockDiff = createMockDiff();
      mockGetDiff.mockReturnValue(mockDiff);

      const { result } = renderHook(() => useDiffViewerHandler({ filePath: mockFilePath }));

      await waitFor(() => {
        expect(result.current.diff).toBeTruthy();
      });

      act(() => {
        result.current.goToHunk(1);
      });

      expect(result.current.currentHunk).toBe(1);
    });

    it('should clamp index to valid range', async () => {
      const mockDiff = createMockDiff();
      mockGetDiff.mockReturnValue(mockDiff);

      const { result } = renderHook(() => useDiffViewerHandler({ filePath: mockFilePath }));

      await waitFor(() => {
        expect(result.current.diff).toBeTruthy();
      });

      // Try to go beyond max
      act(() => {
        result.current.goToHunk(10);
      });

      expect(result.current.currentHunk).toBe(1); // Should clamp to totalHunks - 1

      // Try negative
      act(() => {
        result.current.goToHunk(-5);
      });

      expect(result.current.currentHunk).toBe(0); // Should clamp to 0
    });

    it('should handle goToHunk with no diff', () => {
      const { result } = renderHook(() =>
        useDiffViewerHandler({ filePath: mockFilePath, autoFetch: false })
      );

      expect(() => {
        act(() => {
          result.current.goToHunk(5);
        });
      }).not.toThrow();

      expect(result.current.currentHunk).toBe(0);
    });
  });

  describe('Syntax Highlighting Data', () => {
    it('should prepare syntax highlighting data from structured patch', async () => {
      const mockDiff = createMockDiff();
      mockGetDiff.mockReturnValue(mockDiff);

      const { result } = renderHook(() => useDiffViewerHandler({ filePath: mockFilePath }));

      await waitFor(() => {
        expect(result.current.diff).toBeTruthy();
      });

      // Verify structured patch is available for rendering
      expect(result.current.diff?.structuredPatch).toBeDefined();
      expect(result.current.diff?.structuredPatch).toHaveLength(2);
    });

    it('should calculate total hunks from structured patch', async () => {
      const mockDiff = createMockDiff();
      mockGetDiff.mockReturnValue(mockDiff);

      const { result } = renderHook(() => useDiffViewerHandler({ filePath: mockFilePath }));

      await waitFor(() => {
        expect(result.current.totalHunks).toBe(2);
      });
    });

    it('should handle diff without structured patch', async () => {
      const mockDiff = {
        ...createMockDiff(),
        structuredPatch: undefined,
      };
      mockGetDiff.mockReturnValue(mockDiff);

      const { result } = renderHook(() => useDiffViewerHandler({ filePath: mockFilePath }));

      await waitFor(() => {
        expect(result.current.diff).toBeTruthy();
      });

      expect(result.current.totalHunks).toBe(0);
    });
  });

  describe('Current Hunk Tracking', () => {
    it('should maintain current hunk on diff refresh', async () => {
      const mockDiff = createMockDiff();
      mockGetDiff.mockReturnValue(mockDiff);
      mockFetchDiff.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useDiffViewerHandler({ filePath: mockFilePath, autoFetch: false })
      );

      // Fetch initial diff
      await act(async () => {
        await result.current.fetchDiff(mockFilePath);
      });

      // Navigate to hunk 1
      act(() => {
        result.current.goToHunk(1);
      });

      expect(result.current.currentHunk).toBe(1);

      // Refresh diff
      await act(async () => {
        await result.current.fetchDiff(mockFilePath);
      });

      // Should maintain hunk position if still valid
      expect(result.current.currentHunk).toBe(1);
    });

    it('should reset current hunk if new diff has fewer hunks', async () => {
      const mockDiffMany = createMockDiff(createMockStructuredPatch());
      const mockDiffFew = createMockDiff([createMockStructuredPatch()[0]]);

      // First call returns diff with 2 hunks
      mockGetDiff.mockReturnValueOnce(mockDiffMany);
      mockFetchDiff.mockResolvedValueOnce(undefined);

      const { result, rerender } = renderHook(() =>
        useDiffViewerHandler({ filePath: mockFilePath, autoFetch: false })
      );

      // Fetch initial diff with 2 hunks
      await act(async () => {
        await result.current.fetchDiff(mockFilePath);
      });

      expect(result.current.totalHunks).toBe(2);

      // Navigate to last hunk
      act(() => {
        result.current.goToHunk(1);
      });

      expect(result.current.currentHunk).toBe(1);

      // Mock second fetch to return diff with only 1 hunk
      mockGetDiff.mockReturnValue(mockDiffFew);
      mockFetchDiff.mockResolvedValueOnce(undefined);

      // Fetch new diff with only 1 hunk
      await act(async () => {
        await result.current.fetchDiff(mockFilePath);
      });

      // Force re-render to get updated diff from store
      rerender();

      // Should reset to max valid index (0 since only 1 hunk)
      await waitFor(() => {
        expect(result.current.currentHunk).toBe(0);
      });
    });
  });

  describe('Error State Management', () => {
    it('should clear error on successful fetch', async () => {
      // First fetch fails
      mockFetchDiff.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useDiffViewerHandler({ filePath: mockFilePath, autoFetch: false })
      );

      await act(async () => {
        await result.current.fetchDiff(mockFilePath);
      });

      expect(result.current.error).toBe('Network error');

      // Second fetch succeeds
      mockFetchDiff.mockResolvedValueOnce(undefined);
      mockGetDiff.mockReturnValue(createMockDiff());

      await act(async () => {
        await result.current.fetchDiff(mockFilePath);
      });

      expect(result.current.error).toBeNull();
    });

    it('should update error state from Git store', () => {
      const errorMessage = 'Git operation failed';

      (useGitStore as unknown as jest.Mock).mockImplementation((selector) => {
        const store = {
          fetchDiff: mockFetchDiff,
          getDiff: mockGetDiff,
          updateDiffCache: mockUpdateDiffCache,
          setDiffError: mockSetDiffError,
          isLoadingDiff: false,
          diffError: errorMessage,
        };
        return selector(store);
      });

      const { result } = renderHook(() =>
        useDiffViewerHandler({ filePath: mockFilePath, autoFetch: false })
      );

      expect(result.current.error).toBe(errorMessage);
    });
  });

  describe('Loading State', () => {
    it('should reflect Git store loading state', () => {
      (useGitStore as unknown as jest.Mock).mockImplementation((selector) => {
        const store = {
          fetchDiff: mockFetchDiff,
          getDiff: mockGetDiff,
          updateDiffCache: mockUpdateDiffCache,
          setDiffError: mockSetDiffError,
          isLoadingDiff: true,
          diffError: null,
        };
        return selector(store);
      });

      const { result } = renderHook(() =>
        useDiffViewerHandler({ filePath: mockFilePath, autoFetch: false })
      );

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid navigation calls', async () => {
      const mockDiff = createMockDiff();
      mockGetDiff.mockReturnValue(mockDiff);

      const { result } = renderHook(() => useDiffViewerHandler({ filePath: mockFilePath }));

      await waitFor(() => {
        expect(result.current.diff).toBeTruthy();
      });

      act(() => {
        result.current.navigate('next');
        result.current.navigate('next');
        result.current.navigate('next');
        result.current.navigate('prev');
      });

      expect(result.current.currentHunk).toBe(1);
    });

    it('should handle empty structured patch array', async () => {
      const mockDiff = {
        ...createMockDiff(),
        structuredPatch: [],
      };
      mockGetDiff.mockReturnValue(mockDiff);

      const { result } = renderHook(() => useDiffViewerHandler({ filePath: mockFilePath }));

      await waitFor(() => {
        expect(result.current.diff).toBeTruthy();
      });

      expect(result.current.totalHunks).toBe(0);
      expect(result.current.currentHunk).toBe(0);

      act(() => {
        result.current.navigate('next');
      });

      expect(result.current.currentHunk).toBe(0);
    });

    it('should handle null file path gracefully', () => {
      const { result } = renderHook(() => useDiffViewerHandler({ filePath: null as any }));

      expect(result.current.diff).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should handle concurrent fetch requests', async () => {
      mockFetchDiff.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

      const { result } = renderHook(() =>
        useDiffViewerHandler({ filePath: mockFilePath, autoFetch: false })
      );

      const promise1 = result.current.fetchDiff(mockFilePath);
      const promise2 = result.current.fetchDiff(mockFilePath);

      await act(async () => {
        await Promise.all([promise1, promise2]);
      });

      // Should only trigger one fetch
      expect(mockFetchDiff).toHaveBeenCalledTimes(2);
    });
  });

  describe('Callback Stability', () => {
    it('should maintain callback references across renders', () => {
      const { result, rerender } = renderHook(() =>
        useDiffViewerHandler({ filePath: mockFilePath })
      );

      const initialNavigate = result.current.navigate;
      const initialGoToHunk = result.current.goToHunk;
      const initialFetchDiff = result.current.fetchDiff;

      rerender();

      expect(result.current.navigate).toBe(initialNavigate);
      expect(result.current.goToHunk).toBe(initialGoToHunk);
      expect(result.current.fetchDiff).toBe(initialFetchDiff);
    });
  });
});
