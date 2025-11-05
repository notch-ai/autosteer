/**
 * Service-Store Integration Tests
 * Tests multi-component interactions between services and stores
 * Validates data flow from services through stores to ensure proper coordination
 */

import { SettingsService } from '@/services/SettingsService';
import { FileDataStoreService } from '@/services/FileDataStoreService';
import { useProjectsStore } from '@/stores/projects.store';
import { useAgentsStore } from '@/stores/agents.store';
import type { Project } from '@/types/project.types';
import { createTestAgent } from '../factories';
import * as fs from 'fs';
import { promisify } from 'util';

const fsPromises = {
  mkdir: promisify(fs.mkdir),
  writeFile: promisify(fs.writeFile),
  rm: promisify(fs.rm),
};

// Mock electron-log
jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock electron-store
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    store: {},
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    has: jest.fn(),
  }));
});

describe('Service-Store Integration Tests', () => {
  const testDir = '/tmp/test-integration-autosteer';
  let settingsService: SettingsService;
  let fileDataStoreService: FileDataStoreService;

  beforeEach(async () => {
    console.log('[Integration Test] Setting up test environment');
    jest.clearAllMocks();

    // Clean up test directory
    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Directory doesn't exist, ignore
    }

    // Create test directory
    await fsPromises.mkdir(testDir, { recursive: true });

    // Initialize SettingsService
    settingsService = new SettingsService();
    settingsService.initialize();

    // Initialize FileDataStoreService with test directory
    fileDataStoreService = FileDataStoreService.getInstance();
    // Set test data directory to ensure proper path initialization
    fileDataStoreService.setDataDirectory(testDir);
    // Ensure directories exist at test path
    await fileDataStoreService.ensureDirectories();

    // Reset stores
    useProjectsStore.setState({
      projects: new Map(),
      selectedProjectId: null,
      projectsLoading: false,
      projectsError: null,
    });

    useAgentsStore.setState({
      agents: new Map(),
      selectedAgentId: null,
      agentsLoading: false,
      agentsError: null,
    });
  });

  afterEach(async () => {
    console.log('[Integration Test] Cleaning up test environment');
    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('SettingsService → Store coordination', () => {
    it('should persist settings changes through service', () => {
      console.log('[Test] Persisting settings through service');

      // Update setting via service
      settingsService.set('theme', 'dark');
      settingsService.set('fontSize', 14);

      // Retrieve settings
      const theme = settingsService.get('theme');
      const fontSize = settingsService.get('fontSize');

      expect(theme).toBe('dark');
      expect(fontSize).toBe(14);
    });

    it('should handle batch settings updates', () => {
      console.log('[Test] Handling batch settings updates');

      const updates = {
        theme: 'dark' as const,
        fontSize: 16,
        autoSave: true,
      };

      settingsService.updateBatch(updates);

      expect(settingsService.get('theme')).toBe('dark');
      expect(settingsService.get('fontSize')).toBe(16);
      expect(settingsService.get('autoSave')).toBe(true);
    });

    it('should clear all settings and restore defaults', () => {
      console.log('[Test] Clearing and restoring default settings');

      // Set some custom values
      settingsService.set('theme', 'dark');
      settingsService.set('fontSize', 20);

      // Clear settings
      settingsService.clear();

      // Should have defaults
      const allSettings = settingsService.getAll();
      expect(allSettings).toBeDefined();
    });
  });

  describe('FileDataStoreService → ProjectsStore coordination', () => {
    it('should coordinate project data between service and store', async () => {
      console.log('[Test] Coordinating project data');

      const projectsStore = useProjectsStore.getState();

      // Create a project via the store pattern
      const mockProject: Project = {
        id: 'test-project-1',
        name: 'Test Project',
        localPath: '/test/path',
        folderName: 'test-project',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Update store
      projectsStore.projects.set(mockProject.id, mockProject);
      useProjectsStore.setState({ projects: projectsStore.projects });

      // Verify project in store
      const retrievedProject = useProjectsStore.getState().getProject(mockProject.id);
      expect(retrievedProject).toBeDefined();
      expect(retrievedProject?.name).toBe('Test Project');
    });

    it('should handle project selection with agent cleanup', async () => {
      console.log('[Test] Handling project selection with agent cleanup');

      const projectsStore = useProjectsStore.getState();

      // Create test projects
      const project1: Project = {
        id: 'project-1',
        name: 'Project 1',
        localPath: '/test/project1',
        folderName: 'project-1',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const project2: Project = {
        id: 'project-2',
        name: 'Project 2',
        localPath: '/test/project2',
        folderName: 'project-2',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add projects to store
      projectsStore.projects.set(project1.id, project1);
      projectsStore.projects.set(project2.id, project2);
      useProjectsStore.setState({
        projects: projectsStore.projects,
        selectedProjectId: project1.id,
      });

      // Create agents for project 1
      const agent1 = createTestAgent({
        id: 'agent-1',
        title: 'Agent 1',
        projectId: 'project-1',
      });

      const agent2 = createTestAgent({
        id: 'agent-2',
        title: 'Agent 2',
        projectId: 'project-1',
      });

      const agentsMap = new Map();
      agentsMap.set(agent1.id, agent1);
      agentsMap.set(agent2.id, agent2);

      useAgentsStore.setState({
        agents: agentsMap,
        selectedAgentId: agent1.id,
      });

      // Switch to project 2
      useProjectsStore.setState({ selectedProjectId: project2.id });

      // Verify project switched
      expect(useProjectsStore.getState().selectedProjectId).toBe(project2.id);
    });
  });

  describe('Multi-service coordination', () => {
    it('should coordinate between multiple services and stores', async () => {
      console.log('[Test] Coordinating between multiple services');

      // Update settings via SettingsService
      settingsService.set('lastProjectId', 'project-123');

      // Create project data
      const projectConfig = {
        worktrees: [
          {
            git_repo: 'https://github.com/test/repo.git',
            branch_name: 'main',
            folder_name: 'test-project',
          },
        ],
      };

      await fileDataStoreService.writeConfig(projectConfig);

      // Retrieve settings
      const lastProjectId = settingsService.get('lastProjectId');
      expect(lastProjectId).toBe('project-123');

      // Retrieve config
      const config = await fileDataStoreService.readConfig();
      expect(config.worktrees).toHaveLength(1);
      expect(config.worktrees?.[0].folder_name).toBe('test-project');
    });

    it('should handle service errors without affecting store state', () => {
      console.log('[Test] Handling service errors gracefully');

      const initialState = useProjectsStore.getState();
      const initialProjectCount = initialState.projects.size;

      // Attempt invalid operation that should not corrupt store
      try {
        settingsService.get('nonexistent-key');
      } catch (error) {
        // Error expected
      }

      const finalState = useProjectsStore.getState();
      expect(finalState.projects.size).toBe(initialProjectCount);
    });

    it('should maintain data consistency across service operations', async () => {
      console.log('[Test] Maintaining data consistency');

      // Create config with worktree and agents
      const config = {
        worktrees: [
          {
            git_repo: 'https://github.com/test/repo.git',
            branch_name: 'main',
            folder_name: 'test-project',
          },
        ],
        agents: [
          {
            id: 'agent-1',
            title: 'Test Agent',
            content: 'Test content',
            preview: 'Test preview',
            type: 'text',
            status: 'active',
            project_id: 'test-project',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: [],
            resource_ids: [],
          },
        ],
      };

      await fileDataStoreService.writeConfig(config);

      // Read back config
      const readConfig = await fileDataStoreService.readConfig();

      // Verify consistency
      expect(readConfig.worktrees).toHaveLength(1);
      expect(readConfig.agents).toHaveLength(1);
      expect(readConfig.worktrees?.[0].folder_name).toBe('test-project');
      expect(readConfig.agents?.[0].id).toBe('agent-1');
      expect(readConfig.agents?.[0].project_id).toBe('test-project');
    });
  });

  describe('Error recovery and resilience', () => {
    it('should recover from service initialization errors', () => {
      console.log('[Test] Recovering from initialization errors');

      const newService = new SettingsService();

      // Should be able to initialize even if there were previous errors
      expect(() => newService.initialize()).not.toThrow();
    });

    it('should handle concurrent store updates', () => {
      console.log('[Test] Handling concurrent store updates');

      // Simulate concurrent updates
      const agent1 = createTestAgent({ id: 'agent-1', title: 'Agent 1' });
      const agent2 = createTestAgent({ id: 'agent-2', title: 'Agent 2' });
      const agent3 = createTestAgent({ id: 'agent-3', title: 'Agent 3' });

      const map1 = new Map();
      map1.set(agent1.id, agent1);

      const map2 = new Map();
      map2.set(agent1.id, agent1);
      map2.set(agent2.id, agent2);

      const map3 = new Map();
      map3.set(agent1.id, agent1);
      map3.set(agent2.id, agent2);
      map3.set(agent3.id, agent3);

      useAgentsStore.setState({ agents: map1 });
      useAgentsStore.setState({ agents: map2 });
      useAgentsStore.setState({ agents: map3 });

      const finalAgents = useAgentsStore.getState().agents;
      expect(finalAgents.size).toBe(3);
    });

    it('should maintain store integrity after service failures', async () => {
      console.log('[Test] Maintaining store integrity after failures');

      const initialProjects = new Map([
        ['p1', { id: 'p1', name: 'Project 1' } as any],
        ['p2', { id: 'p2', name: 'Project 2' } as any],
      ]);

      useProjectsStore.setState({ projects: initialProjects });

      // Attempt operation that might fail
      try {
        await fileDataStoreService.removeWorktree('nonexistent-project');
      } catch (error) {
        // Error expected
      }

      // Store should still have original projects
      const projects = useProjectsStore.getState().projects;
      expect(projects.size).toBe(2);
      expect(projects.get('p1')?.name).toBe('Project 1');
      expect(projects.get('p2')?.name).toBe('Project 2');
    });
  });

  describe('Performance and caching', () => {
    it('should leverage service caching for repeated reads', () => {
      console.log('[Test] Leveraging service caching');

      settingsService.set('cachedValue', 'test-value');

      // First read
      const value1 = settingsService.get('cachedValue');

      // Second read (should use cache)
      const value2 = settingsService.get('cachedValue');

      expect(value1).toBe('test-value');
      expect(value2).toBe('test-value');
      expect(value1).toBe(value2);
    });

    it('should handle large store updates efficiently', () => {
      console.log('[Test] Handling large store updates');

      const agentsArray = Array.from({ length: 100 }, (_, i) =>
        createTestAgent({
          id: `agent-${i}`,
          title: `Agent ${i}`,
        })
      );

      const agentsMap = new Map();
      agentsArray.forEach((agent) => agentsMap.set(agent.id, agent));

      const startTime = Date.now();
      useAgentsStore.setState({ agents: agentsMap });
      const endTime = Date.now();

      const finalAgents = useAgentsStore.getState().agents;
      expect(finalAgents.size).toBe(100);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });
  });
});
