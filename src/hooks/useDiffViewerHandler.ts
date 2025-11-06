import { logger } from '@/commons/utils/logger';
import { useGitStore, type GitDiff } from '@/stores/git.store';
import { useCallback, useEffect, useState } from 'react';

/**
 *
 * Business logic handler for diff viewer component operations.
 *
 * Key Features:
 * - Diff data fetching from Git service
 * - Hunk navigation (prev/next)
 * - Syntax highlighting data preparation
 * - Current hunk position tracking
 * - File path handling and error management
 *
 * Architecture:
 * - Extracted from DiffViewer.tsx for separation of concerns
 * - Integrates with GitStore for diff data management
 * - Provides navigation and state management
 *
 * Usage:
 * ```tsx
 * const {
 *   diff,
 *   currentHunk,
 *   totalHunks,
 *   isLoading,
 *   error,
 *   navigate,
 *   goToHunk,
 *   fetchDiff,
 * } = useDiffViewerHandler({
 *   filePath: 'src/file.ts',
 *   commitHash: 'abc123',
 * });
 * ```
 *
 * @see docs/guides-architecture.md Handler Pattern
 */

export interface UseDiffViewerHandlerProps {
  filePath: string;
  commitHash?: string;
  autoFetch?: boolean;
}

export interface UseDiffViewerHandlerReturn {
  diff: GitDiff | null;
  currentHunk: number;
  totalHunks: number;
  isLoading: boolean;
  error: string | null;
  navigate: (direction: 'prev' | 'next') => void;
  goToHunk: (hunkIndex: number) => void;
  fetchDiff: (filePath: string, commitHash?: string) => Promise<void>;
}

export const useDiffViewerHandler = ({
  filePath,
  commitHash,
  autoFetch = true,
}: UseDiffViewerHandlerProps): UseDiffViewerHandlerReturn => {
  const [currentHunk, setCurrentHunk] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);

  // Git store integration
  const fetchDiffFromStore = useGitStore((state) => state.fetchDiff);
  const getDiffFromStore = useGitStore((state) => state.getDiff);
  const isLoadingDiff = useGitStore((state) => state.isLoadingDiff);
  const storeError = useGitStore((state) => state.diffError);

  // Get diff data from store (convert undefined to null)
  const diff = getDiffFromStore(filePath) ?? null;

  // Calculate total hunks from structured patch
  const totalHunks = diff?.structuredPatch?.length ?? 0;

  // Combined error state (local or store error)
  const error = localError || storeError;

  /**
   * fetchDiff - Fetch diff data for a file
   *
   * Flow:
   * 1. Clear previous errors
   * 2. Call Git store to fetch diff
   * 3. Update diff cache
   * 4. Handle errors
   *
   * Error Cases:
   * - File not found
   * - Git operation failure
   * - Network issues
   */
  const fetchDiff = useCallback(
    async (targetFilePath: string, targetCommitHash?: string): Promise<void> => {
      try {
        setLocalError(null);

        logger.debug('[useDiffViewerHandler] Fetching diff', {
          filePath: targetFilePath,
          commitHash: targetCommitHash,
        });

        // Fetch diff from Git service via store
        // projectId is empty string for now - can be enhanced later
        await fetchDiffFromStore('', targetFilePath);

        const fetchedDiff = getDiffFromStore(targetFilePath);

        if (fetchedDiff) {
          logger.debug('[useDiffViewerHandler] Diff fetched successfully', {
            filePath: targetFilePath,
            hunks: fetchedDiff.structuredPatch?.length ?? 0,
            additions: fetchedDiff.additions,
            deletions: fetchedDiff.deletions,
          });
        }

        // Reset hunk position if current position is out of bounds after fetch
        const newTotalHunks = fetchedDiff?.structuredPatch?.length ?? 0;
        if (currentHunk >= newTotalHunks) {
          setCurrentHunk(Math.max(0, newTotalHunks - 1));
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch diff';
        setLocalError(errorMessage);

        logger.error('[useDiffViewerHandler] Failed to fetch diff', {
          filePath: targetFilePath,
          error: errorMessage,
        });
      }
    },
    [fetchDiffFromStore, getDiffFromStore, currentHunk]
  );

  /**
   * navigate - Navigate between hunks
   *
   * Flow:
   * 1. Calculate new hunk index based on direction
   * 2. Clamp to valid range [0, totalHunks - 1]
   * 3. Update current hunk state
   *
   * Boundaries:
   * - prev: stops at 0
   * - next: stops at totalHunks - 1
   */
  const navigate = useCallback(
    (direction: 'prev' | 'next'): void => {
      if (!diff || totalHunks === 0) {
        return;
      }

      let newHunk = currentHunk;

      if (direction === 'next') {
        newHunk = Math.min(currentHunk + 1, totalHunks - 1);
      } else if (direction === 'prev') {
        newHunk = Math.max(currentHunk - 1, 0);
      }

      if (newHunk !== currentHunk) {
        logger.debug('[useDiffViewerHandler] Navigating to hunk', {
          direction,
          oldHunk: currentHunk,
          newHunk,
          totalHunks,
        });

        setCurrentHunk(newHunk);
      }
    },
    [diff, currentHunk, totalHunks]
  );

  /**
   * goToHunk - Jump to specific hunk by index
   *
   * Flow:
   * 1. Clamp index to valid range
   * 2. Update current hunk state
   * 3. Log navigation
   *
   * Boundaries:
   * - Negative indices clamped to 0
   * - Indices >= totalHunks clamped to totalHunks - 1
   */
  const goToHunk = useCallback(
    (hunkIndex: number): void => {
      if (!diff || totalHunks === 0) {
        return;
      }

      // Clamp to valid range
      const clampedIndex = Math.max(0, Math.min(hunkIndex, totalHunks - 1));

      if (clampedIndex !== currentHunk) {
        logger.debug('[useDiffViewerHandler] Going to hunk', {
          requestedIndex: hunkIndex,
          clampedIndex,
          totalHunks,
        });

        setCurrentHunk(clampedIndex);
      }
    },
    [diff, currentHunk, totalHunks]
  );

  // Auto-fetch diff on mount if filePath provided
  useEffect(() => {
    if (autoFetch && filePath) {
      fetchDiff(filePath, commitHash);
    }
  }, [autoFetch, filePath, commitHash, fetchDiff]);

  return {
    diff,
    currentHunk,
    totalHunks,
    isLoading: isLoadingDiff,
    error,
    navigate,
    goToHunk,
    fetchDiff,
  };
};
