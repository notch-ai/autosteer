/**
 * Project Factory
 * Creates mock Project objects for testing with customizable properties
 */

import { Project } from '@/types/project.types';

/**
 * Default project configuration
 */
const DEFAULT_PROJECT: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'Test Project',
  folderName: 'test-project',
  localPath: '/Users/test/projects/test-project',
  description: 'Test project for development',
  isActive: true,
};

/**
 * Create a test project with optional overrides
 * @param overrides - Partial project properties to override defaults
 * @returns Complete Project object
 *
 * @example
 * ```typescript
 * const project = createTestProject({ name: 'My Project' });
 * ```
 */
export function createTestProject(overrides?: Partial<Project>): Project {
  const now = new Date();
  const id =
    overrides?.id || `test-project-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  const project: Project = {
    ...DEFAULT_PROJECT,
    id,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };

  console.log('[Project Factory] Created test project:', project.id);
  return project;
}

/**
 * Create multiple test projects
 * @param count - Number of projects to create
 * @param overrides - Partial project properties to override defaults
 * @returns Array of Project objects
 *
 * @example
 * ```typescript
 * const projects = createTestProjects(3);
 * ```
 */
export function createTestProjects(count: number, overrides?: Partial<Project>): Project[] {
  console.log(`[Project Factory] Creating ${count} test projects`);
  return Array.from({ length: count }, (_, index) => {
    const timestamp = new Date(Date.now() + index * 1000);
    return createTestProject({
      id: `test-project-${index}`,
      name: `Test Project ${index}`,
      folderName: `test-project-${index}`,
      localPath: `/Users/test/projects/test-project-${index}`,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...overrides,
    });
  });
}

/**
 * Create an active project
 * @param overrides - Partial project properties to override defaults
 * @returns Active Project
 */
export function createActiveProject(overrides?: Partial<Project>): Project {
  return createTestProject({
    ...overrides,
    isActive: true,
  });
}

/**
 * Create a project with custom folder name
 * @param folderName - Folder name for the project
 * @param overrides - Partial project properties to override defaults
 * @returns Project with custom folder name
 */
export function createProjectWithFolder(folderName: string, overrides?: Partial<Project>): Project {
  return createTestProject({
    ...overrides,
    folderName,
    name: folderName.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    localPath: `/Users/test/projects/${folderName}`,
  });
}
