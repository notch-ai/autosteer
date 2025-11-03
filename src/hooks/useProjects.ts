/**
 * useProjects Hook
 * React hook for accessing projects state from ProjectsStore
 */

import { useProjectsStore } from '@/stores';

/**
 * Hook for accessing projects state
 * Returns current projects and selected project
 */
export function useProjects() {
  const projects = useProjectsStore((state) => state.projects);
  const selectedProjectId = useProjectsStore((state) => state.selectedProjectId);
  const projectsLoading = useProjectsStore((state) => state.projectsLoading);
  const projectsError = useProjectsStore((state) => state.projectsError);

  // Get selected project using selector
  const selectedProject = useProjectsStore((state) => state.getSelectedProject());

  // Convert Map to array for easier consumption
  const projectsArray = Array.from(projects.values());

  return {
    projects: projectsArray,
    projectsMap: projects,
    selectedProject,
    selectedProjectId,
    projectsLoading,
    projectsError,
  };
}
