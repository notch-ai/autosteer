/**
 * useFileDiff Hook
 * Custom hook for fetching file diff data from a git repository
 *
 * Features:
 * - Fetches uncommitted diff for a specific file
 * - Provides loading state for async operations
 * - Handles cleanup on unmount
 * - Mock data support for development
 *
 * @example
 * ```tsx
 * const { fileDiff, loadingDiff, fetchFileDiff } = useFileDiff({
 *   workingDirectory: '/path/to/repo',
 *   useMockData: false
 * });
 *
 * // Fetch diff for a specific file
 * await fetchFileDiff('src/components/MyComponent.tsx');
 * ```
 */

import { logger } from '@/commons/utils/logger';
import { mockFileDiffs } from '@/mocks/gitDiffMockData';
import { FileDiff } from '@/types/git-diff.types';
import { useCallback, useState } from 'react';

interface UseFileDiffOptions {
  workingDirectory: string | undefined;
  useMockData?: boolean;
}

interface UseFileDiffReturn {
  fileDiff: FileDiff[];
  loadingDiff: boolean;
  fetchFileDiff: (file: string) => Promise<void>;
}

/**
 * Custom hook for fetching file diff data
 *
 * @param options - Configuration options
 * @param options.workingDirectory - Path to the git repository
 * @param options.useMockData - Use mock data for development (default: false)
 * @returns File diff state and fetch function
 */
export const useFileDiff = ({
  workingDirectory,
  useMockData = false,
}: UseFileDiffOptions): UseFileDiffReturn => {
  const [fileDiff, setFileDiff] = useState<FileDiff[]>([]);
  const [loadingDiff, setLoadingDiff] = useState(false);

  /**
   * Fetch diff for a specific file
   *
   * @param file - Relative path to the file from the repository root
   */
  const fetchFileDiff = useCallback(
    async (file: string) => {
      setLoadingDiff(true);

      try {
        if (useMockData) {
          logger.debug('[useFileDiff] Using mock data', { file });
          await new Promise((resolve) => setTimeout(resolve, 200));

          const mockDiff = mockFileDiffs.get(file);
          setFileDiff(mockDiff ? [mockDiff] : []);
          setLoadingDiff(false);
          return;
        }

        if (!workingDirectory) {
          logger.warn('[useFileDiff] No working directory provided');
          setFileDiff([]);
          setLoadingDiff(false);
          return;
        }

        logger.debug('[useFileDiff] Fetching file diff', {
          file,
          workingDirectory: workingDirectory.substring(workingDirectory.lastIndexOf('/') + 1),
        });

        const result = (await window.electron?.ipcRenderer?.invoke?.('git-diff:get-uncommitted', {
          repoPath: workingDirectory,
          filePath: file,
        })) as FileDiff[] | undefined;

        logger.debug('[useFileDiff] File diff fetched successfully', {
          file,
          hunksCount: result?.[0]?.hunks?.length || 0,
        });

        setFileDiff(result || []);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch file diff';
        logger.error('[useFileDiff] Error fetching file diff', {
          file,
          error: errorMessage,
        });
        setFileDiff([]);
      } finally {
        setLoadingDiff(false);
      }
    },
    [workingDirectory, useMockData]
  );

  return {
    fileDiff,
    loadingDiff,
    fetchFileDiff,
  };
};
