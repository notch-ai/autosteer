/**
 * useGitStats Hook
 * Custom hook for fetching git statistics (changed files) from a repository
 *
 * Features:
 * - Fetches git diff stats for a working directory
 * - Supports polling with configurable interval
 * - Provides loading and error states
 * - Handles cleanup on unmount
 * - Mock data support for development
 *
 * @example
 * ```tsx
 * const { stats, loading, error, refetch } = useGitStats({
 *   workingDirectory: '/path/to/repo',
 *   polling: true,
 *   pollingInterval: 5000
 * });
 * ```
 */

import { logger } from '@/commons/utils/logger';
import { mockGitStats } from '@/mocks/gitDiffMockData';
import { useCallback, useEffect, useState } from 'react';

interface GitDiffStat {
  file: string;
  additions: number;
  deletions: number;
  binary?: boolean;
  status?: 'modified' | 'staged' | 'both' | 'untracked';
  isRenamed?: boolean;
  oldPath?: string;
}

interface GitDiffStatsResponse {
  success: boolean;
  stats: GitDiffStat[];
  error: string | null;
}

interface UseGitStatsOptions {
  workingDirectory: string | undefined;
  polling?: boolean;
  pollingInterval?: number;
  useMockData?: boolean;
}

interface UseGitStatsReturn {
  stats: GitDiffStat[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook for fetching git diff statistics
 *
 * @param options - Configuration options
 * @param options.workingDirectory - Path to the git repository
 * @param options.polling - Enable automatic polling (default: false)
 * @param options.pollingInterval - Polling interval in milliseconds (default: 5000)
 * @param options.useMockData - Use mock data for development (default: false)
 * @returns Git stats state and refetch function
 */
export const useGitStats = ({
  workingDirectory,
  polling = false,
  pollingInterval = 5000,
  useMockData = false,
}: UseGitStatsOptions): UseGitStatsReturn => {
  const [stats, setStats] = useState<GitDiffStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch git diff stats from IPC or mock data
   */
  const fetchGitStats = useCallback(async () => {
    if (useMockData) {
      logger.debug('[useGitStats] Using mock data');
      setLoading(true);
      setError(null);

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      setStats(mockGitStats);
      setLoading(false);
      return;
    }

    if (!workingDirectory) {
      setStats([]);
      setError('No working directory provided');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = (await window.electron?.ipcRenderer?.invoke?.(
        'git:diff-stats',
        workingDirectory
      )) as GitDiffStatsResponse | undefined;

      if (!result || !result.success) {
        throw new Error(result?.error || 'Failed to get git diff stats');
      }

      setStats(result.stats || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch git stats';
      logger.error('[useGitStats] Error fetching git stats', {
        error: errorMessage,
        workingDirectory: workingDirectory?.substring(workingDirectory.lastIndexOf('/') + 1),
      });
      setError(errorMessage);
      setStats([]);
    } finally {
      setLoading(false);
    }
  }, [workingDirectory, useMockData]);

  // Initial fetch on mount and when working directory changes
  useEffect(() => {
    logger.debug('[useGitStats] Initial fetch triggered', {
      workingDirectory:
        workingDirectory?.substring(workingDirectory.lastIndexOf('/') + 1) || 'none',
    });
    void fetchGitStats();
  }, [fetchGitStats]);

  // Polling effect
  useEffect(() => {
    if (!polling) {
      return undefined;
    }

    logger.debug('[useGitStats] Starting polling', {
      interval: pollingInterval,
    });

    const interval = setInterval(() => {
      void fetchGitStats();
    }, pollingInterval);

    return () => {
      logger.debug('[useGitStats] Stopping polling');
      clearInterval(interval);
    };
  }, [fetchGitStats, polling, pollingInterval]);

  return {
    stats,
    loading,
    error,
    refetch: fetchGitStats,
  };
};
