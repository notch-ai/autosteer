/**
 * useProjectActions Hook
 * Provides access to project actions (load, create, select, delete)
 */

import { useProjectsStore } from '@/stores';
import { useCallback } from 'react';

export function useProjectActions() {
  const loadProjects = useProjectsStore((state) => state.loadProjects);
  const createProject = useProjectsStore((state) => state.createProject);
  const selectProject = useProjectsStore((state) => state.selectProject);
  const deleteProject = useProjectsStore((state) => state.deleteProject);

  return {
    loadProjects: useCallback(loadProjects, [loadProjects]),
    createProject: useCallback(createProject, [createProject]),
    selectProject: useCallback(selectProject, [selectProject]),
    deleteProject: useCallback(deleteProject, [deleteProject]),
  };
}
