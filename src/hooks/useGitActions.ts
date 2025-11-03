/**
 * useGitActions Hook
 * React hook for git actions from GitStore
 */

import { useGitStore } from '@/stores';

/**
 * Hook for accessing git actions
 * Returns all git-related actions
 */
export function useGitActions() {
  const fetchGitStatus = useGitStore((state) => state.fetchGitStatus);
  const setGitStatus = useGitStore((state) => state.setGitStatus);
  const clearGitStatus = useGitStore((state) => state.clearGitStatus);
  const fetchDiff = useGitStore((state) => state.fetchDiff);
  const updateDiffCache = useGitStore((state) => state.updateDiffCache);
  const getDiff = useGitStore((state) => state.getDiff);
  const clearDiffCache = useGitStore((state) => state.clearDiffCache);
  const removeDiffFromCache = useGitStore((state) => state.removeDiffFromCache);
  const clearAll = useGitStore((state) => state.clearAll);

  return {
    fetchGitStatus,
    setGitStatus,
    clearGitStatus,
    fetchDiff,
    updateDiffCache,
    getDiff,
    clearDiffCache,
    removeDiffFromCache,
    clearAll,
  };
}
