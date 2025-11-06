/**
 * useProjects Hook
 * React hook for accessing projects state from ProjectsStore
 * Automatically loads projects on mount
 */

import { useProjectsStore } from '@/stores';
import { useEffect } from 'react';

/**
 * Hook for accessing projects state
 * Returns current projects and selected project
 *
 * @param options.autoLoad - Automatically load projects on mount (default: true)
 */
export function useProjects(options: { autoLoad?: boolean } = { autoLoad: true }) {
  const projects = useProjectsStore((state) => state.projects);
  const selectedProjectId = useProjectsStore((state) => state.selectedProjectId);
  const projectsLoading = useProjectsStore((state) => state.projectsLoading);
  const projectsError = useProjectsStore((state) => state.projectsError);
  const loadProjects = useProjectsStore((state) => state.loadProjects);

  // Get selected project using selector
  const selectedProject = useProjectsStore((state) => state.getSelectedProject());

  // Convert Map to array for easier consumption
  const projectsArray = Array.from(projects.values());

  // Auto-load projects on mount
  useEffect(() => {
    if (options.autoLoad) {
      void loadProjects();
    }
  }, [loadProjects, options.autoLoad]);

  return {
    projects: projectsArray,
    projectsMap: projects,
    selectedProject,
    selectedProjectId,
    projectsLoading,
    projectsError,
    loadProjects,
  };
}
