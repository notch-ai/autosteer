/**
 * useGitStatus Hook
 * React hook for accessing git status from GitStore
 */

import { useGitStore } from '@/stores';

/**
 * Hook for accessing git status for a specific project
 * @param projectId - Optional project ID to get status for
 */
export function useGitStatus(projectId?: string) {
  const gitStatuses = useGitStore((state) => state.gitStatuses);
  const isLoadingStatus = useGitStore((state) => state.isLoadingStatus);
  const statusError = useGitStore((state) => state.statusError);

  // Get specific project status if projectId provided
  const gitStatus = projectId ? gitStatuses.get(projectId) : undefined;

  return {
    gitStatus,
    gitStatuses,
    isLoadingStatus,
    statusError,
  };
}
