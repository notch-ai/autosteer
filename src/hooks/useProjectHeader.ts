import { useCallback, useMemo } from 'react';
import { getFolderName } from '@/commons/utils/project/folder_name';
import { useProjectsStore } from '@/stores';

/**
 * useProjectHeader - Project header display and path copying
 *
 * Manages project header information including display name (branch or folder)
 * and clipboard path copying functionality.
 *
 * Key Features:
 * - Derives display name from branch name or folder name
 * - Provides clipboard copy functionality for project path
 * - Memoized values to prevent unnecessary re-renders
 *
 * Usage:
 * ```tsx
 * const { currentProject, displayName, handleCopyPath } = useProjectHeader(selectedProjectId);
 * ```
 */

export interface UseProjectHeaderParams {
  selectedProjectId: string | null;
}

export interface UseProjectHeaderReturn {
  currentProject: ReturnType<typeof useProjectsStore.getState>['projects'] extends Map<
    string,
    infer T
  >
    ? T | null
    : null;
  displayName: string | null;
  handleCopyPath: () => void;
}

export const useProjectHeader = (selectedProjectId: string | null): UseProjectHeaderReturn => {
  const projects = useProjectsStore((state) => state.projects);

  const currentProject = useMemo(
    () => (selectedProjectId ? (projects.get(selectedProjectId) ?? null) : null),
    [selectedProjectId, projects]
  );

  const displayName = useMemo(() => {
    if (!currentProject?.localPath) return null;
    const folderName = getFolderName(currentProject.localPath);
    return currentProject.branchName || folderName;
  }, [currentProject]);

  const handleCopyPath = useCallback(() => {
    if (currentProject?.localPath) {
      navigator.clipboard.writeText(currentProject.localPath).catch(console.error);
    }
  }, [currentProject]);

  return { currentProject, displayName, handleCopyPath };
};
