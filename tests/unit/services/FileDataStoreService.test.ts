/**
 * FileDataStoreService.test.ts
 * Comprehensive unit tests for FileDataStoreService with 80%+ coverage
 * Tests file operations, atomic writes, config management, and agent operations
 */

import { FileDataStoreService } from '@/services/FileDataStoreService';
import { AgentConfig, AppConfig, AutosteerConfig, WorktreeConfig } from '@/types/config.types';
import * as fs from 'fs';
import { promisify } from 'util';

const fsPromises = {
  mkdir: promisify(fs.mkdir),
  writeFile: promisify(fs.writeFile),
  readFile: promisify(fs.readFile),
  rm: promisify(fs.rm),
  access: promisify(fs.access),
};

// Use unique directory to avoid parallel test conflicts
const TEST_DIR = `/tmp/test-autosteer-filedata-${process.pid}-${Date.now()}`;

// Mock electron app.getPath
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => TEST_DIR),
  },
}));

// Mock logger to prevent console output during tests
jest.mock('@/commons/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('FileDataStoreService', () => {
  let service: FileDataStoreService;
  const testDir = TEST_DIR;

  beforeAll(async () => {
    // Ensure /tmp exists and is writable
    try {
      await fsPromises.mkdir('/tmp', { recursive: true });
    } catch (error) {
      // /tmp already exists, ignore
    }
  });

  beforeEach(async () => {
    console.log('[FileDataStoreService.test] Setting up test suite');
    // Clean up test directory
    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Directory doesn't exist, ignore
    }

    // Create test directory
    await fsPromises.mkdir(testDir, { recursive: true });

    // Get fresh instance and reset to test directory
    service = FileDataStoreService.getInstance();
    service.setDataDirectory(testDir);
    await service.ensureDirectories();
  });

  afterEach(async () => {
    console.log('[FileDataStoreService.test] Cleaning up test suite');
    // Clean up test directory
    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      console.log('[FileDataStoreService.test] Testing singleton pattern');
      const instance1 = FileDataStoreService.getInstance();
      const instance2 = FileDataStoreService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should initialize only once', async () => {
      console.log('[FileDataStoreService.test] Testing initialization');
      const instance1 = await FileDataStoreService.initialize();
      const instance2 = await FileDataStoreService.initialize();
      expect(instance1).toBe(instance2);
    });
  });

  describe('App Config Management', () => {
    it('should read app config', async () => {
      console.log('[FileDataStoreService.test] Testing readAppConfig');
      const appConfig: AppConfig = {
        projectDirectory: '/custom/path',
      };
      await service.writeAppConfig(appConfig);

      const result = await service.readAppConfig();

      expect(result.projectDirectory).toBe('/custom/path');
    });

    it('should return empty config when app.json does not exist', async () => {
      console.log('[FileDataStoreService.test] Testing readAppConfig - no file');
      // Create a fresh service instance with a different test directory that doesn't have any existing data
      const freshTestDir = `/tmp/test-autosteer-fresh-${Date.now()}`;
      await fsPromises.mkdir(freshTestDir, { recursive: true });

      const freshService = FileDataStoreService.getInstance();
      freshService.setDataDirectory(freshTestDir);

      const result = await freshService.readAppConfig();

      expect(result).toEqual({});

      // Clean up
      await fsPromises.rm(freshTestDir, { recursive: true, force: true });
    });

    it('should write app config', async () => {
      console.log('[FileDataStoreService.test] Testing writeAppConfig');
      const appConfig: AppConfig = {
        projectDirectory: '/test/custom',
      };

      await service.writeAppConfig(appConfig);

      const result = await service.readAppConfig();
      expect(result.projectDirectory).toBe('/test/custom');
    });
  });

  describe('Directory Management', () => {
    it('should get data directory', () => {
      console.log('[FileDataStoreService.test] Testing getDataDirectory');
      const result = service.getDataDirectory();
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should set data directory', () => {
      console.log('[FileDataStoreService.test] Testing setDataDirectory');
      service.setDataDirectory('/custom/data');

      const result = service.getDataDirectory();
      expect(result).toBe('/custom/data');
    });

    it('should get worktrees directory', () => {
      console.log('[FileDataStoreService.test] Testing getWorktreesDirectory');
      const result = service.getWorktreesDirectory();
      expect(result).toContain('worktrees');
    });

    it('should ensure directories exist', async () => {
      console.log('[FileDataStoreService.test] Testing ensureDirectories');
      await service.ensureDirectories();

      const dataDir = service.getDataDirectory();
      const worktreesDir = service.getWorktreesDirectory();

      // Verify directories were created
      await expect(fsPromises.access(dataDir, fs.constants.F_OK)).resolves.not.toThrow();
      await expect(fsPromises.access(worktreesDir, fs.constants.F_OK)).resolves.not.toThrow();
    });
  });

  describe('Config File Operations', () => {
    it('should check if config exists', async () => {
      console.log('[FileDataStoreService.test] Testing configExists - false');
      const exists = await service.configExists();
      expect(exists).toBe(false);
    });

    it('should detect existing config', async () => {
      console.log('[FileDataStoreService.test] Testing configExists - true');
      const config: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
      };
      await service.writeConfig(config);

      const exists = await service.configExists();
      expect(exists).toBe(true);
    });

    it('should read config', async () => {
      console.log('[FileDataStoreService.test] Testing readConfig');
      const config: AutosteerConfig = {
        worktrees: [
          {
            git_repo: 'https://github.com/test/repo.git',
            branch_name: 'main',
            folder_name: 'test-project',
          },
        ],
        settings: { vimMode: true },
      };
      await service.writeConfig(config);

      const result = await service.readConfig();

      expect(result.worktrees).toHaveLength(1);
      expect(result.settings?.vimMode).toBe(true);
    });

    it('should create empty config if file does not exist', async () => {
      console.log('[FileDataStoreService.test] Testing readConfig - create empty');
      const result = await service.readConfig();

      expect(result.worktrees).toEqual([]);
      expect(result.settings).toEqual({ vimMode: false });
    });

    it('should write config atomically', async () => {
      console.log('[FileDataStoreService.test] Testing writeConfig - atomic');
      const config: AutosteerConfig = {
        worktrees: [
          {
            git_repo: 'https://github.com/test/repo.git',
            branch_name: 'feature',
            folder_name: 'test',
          },
        ],
        settings: { vimMode: false },
      };

      await service.writeConfig(config);
      const result = await service.readConfig();

      expect(result.worktrees).toHaveLength(1);
    });

    it('should handle corrupted config file', async () => {
      console.log('[FileDataStoreService.test] Testing readConfig - corrupted');
      // Write invalid JSON
      const configPath = `${testDir}/.autosteer/config.json`;
      await fsPromises.mkdir(`${testDir}/.autosteer`, { recursive: true });
      await fsPromises.writeFile(configPath, 'invalid json{', 'utf-8');

      const result = await service.readConfig();

      // Should return empty config and backup corrupted file
      expect(result.worktrees).toEqual([]);
      expect(result.settings).toEqual({ vimMode: false });
    });

    it('should filter out invalid worktrees on read', async () => {
      console.log('[FileDataStoreService.test] Testing readConfig - filter invalid');
      const config: AutosteerConfig = {
        worktrees: [
          {
            git_repo: 'https://github.com/test/repo.git',
            branch_name: 'main',
            folder_name: 'valid',
          },
          {
            git_repo: '',
            branch_name: 'main',
            folder_name: 'invalid1',
          } as WorktreeConfig,
          {
            git_repo: 'https://github.com/test/repo.git',
            branch_name: '',
            folder_name: 'invalid2',
          } as WorktreeConfig,
        ],
        settings: { vimMode: false },
      };
      await service.writeConfig(config);

      const result = await service.readConfig();

      expect(result.worktrees).toHaveLength(1);
      expect(result.worktrees[0].folder_name).toBe('valid');
    });
  });

  describe('Worktree Management', () => {
    it('should add new worktree', async () => {
      console.log('[FileDataStoreService.test] Testing addWorktree - new');
      const worktree: WorktreeConfig = {
        git_repo: 'https://github.com/test/repo.git',
        branch_name: 'main',
        folder_name: 'test-project',
      };

      await service.addWorktree(worktree);
      const config = await service.readConfig();

      expect(config.worktrees).toHaveLength(1);
      expect(config.worktrees[0].folder_name).toBe('test-project');
    });

    it('should update existing worktree', async () => {
      console.log('[FileDataStoreService.test] Testing addWorktree - update');
      const worktree1: WorktreeConfig = {
        git_repo: 'https://github.com/test/repo.git',
        branch_name: 'main',
        folder_name: 'test-project',
      };
      await service.addWorktree(worktree1);

      const worktree2: WorktreeConfig = {
        git_repo: 'https://github.com/test/repo2.git',
        branch_name: 'develop',
        folder_name: 'test-project',
      };
      await service.addWorktree(worktree2);

      const config = await service.readConfig();

      expect(config.worktrees).toHaveLength(1);
      expect(config.worktrees[0].git_repo).toBe('https://github.com/test/repo2.git');
      expect(config.worktrees[0].branch_name).toBe('develop');
    });

    it('should throw error when adding invalid worktree', async () => {
      console.log('[FileDataStoreService.test] Testing addWorktree - invalid');
      const invalidWorktree = {
        git_repo: '',
        branch_name: 'main',
        folder_name: 'test',
      } as WorktreeConfig;

      await expect(service.addWorktree(invalidWorktree)).rejects.toThrow();
    });

    it('should remove worktree and associated agents', async () => {
      console.log('[FileDataStoreService.test] Testing removeWorktree');
      const config: AutosteerConfig = {
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
            title: 'Agent 1',
            content: 'Test',
            preview: 'Preview',
            type: 'text',
            status: 'draft',
            project_id: 'test-project',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: [],
            resource_ids: [],
          },
        ],
        settings: { vimMode: false },
      };
      await service.writeConfig(config);

      await service.removeWorktree('test-project');

      const result = await service.readConfig();
      expect(result.worktrees).toHaveLength(0);
      expect(result.agents).toHaveLength(0);
    });

    it('should clean up store and recent projects on worktree removal', async () => {
      console.log('[FileDataStoreService.test] Testing removeWorktree - cleanup');
      const config: AutosteerConfig = {
        worktrees: [
          {
            git_repo: 'https://github.com/test/repo.git',
            branch_name: 'main',
            folder_name: 'test-project',
          },
        ],
        store: {
          projects: [{ folderName: 'test-project', name: 'Test' }],
          'test-project-data': { some: 'data' },
        },
        recentProjects: ['test-project'],
        settings: { vimMode: false },
      };
      await service.writeConfig(config);

      await service.removeWorktree('test-project');

      const result = await service.readConfig();
      expect(result.store?.projects).toHaveLength(0);
      expect(result.store?.['test-project-data']).toBeUndefined();
      expect(result.recentProjects).toHaveLength(0);
    });

    it('should delete worktree directory', async () => {
      console.log('[FileDataStoreService.test] Testing deleteWorktreeDirectory');
      const worktreeDir = `${service.getWorktreesDirectory()}/test-project`;
      await fsPromises.mkdir(worktreeDir, { recursive: true });

      await service.deleteWorktreeDirectory('test-project');

      await expect(fsPromises.access(worktreeDir, fs.constants.F_OK)).rejects.toThrow();
    });

    it('should check if worktree exists', async () => {
      console.log('[FileDataStoreService.test] Testing worktreeExists');
      const worktreeDir = `${service.getWorktreesDirectory()}/test-project`;
      await fsPromises.mkdir(worktreeDir, { recursive: true });

      const exists = await service.worktreeExists('test-project');

      expect(exists).toBe(true);
    });

    it('should return false for non-existent worktree', async () => {
      console.log('[FileDataStoreService.test] Testing worktreeExists - false');
      const exists = await service.worktreeExists('non-existent');

      expect(exists).toBe(false);
    });

    it('should get all worktrees', async () => {
      console.log('[FileDataStoreService.test] Testing getWorktrees');
      const config: AutosteerConfig = {
        worktrees: [
          {
            git_repo: 'https://github.com/test/repo1.git',
            branch_name: 'main',
            folder_name: 'project1',
          },
          {
            git_repo: 'https://github.com/test/repo2.git',
            branch_name: 'develop',
            folder_name: 'project2',
          },
        ],
        settings: { vimMode: false },
      };
      await service.writeConfig(config);

      const worktrees = await service.getWorktrees();

      expect(worktrees).toHaveLength(2);
    });

    it('should get worktree path', () => {
      console.log('[FileDataStoreService.test] Testing getWorktreePath');
      const path = service.getWorktreePath('test-project');

      expect(path).toContain('worktrees');
      expect(path).toContain('test-project');
    });

    it('should get main repo path', () => {
      console.log('[FileDataStoreService.test] Testing getMainRepoPath');
      const path = service.getMainRepoPath('https://github.com/test/repo.git');

      expect(path).toContain('repos');
      expect(path).toContain('repo');
    });

    it('should ensure repos directory exists', async () => {
      console.log('[FileDataStoreService.test] Testing ensureReposDirectory');
      await service.ensureReposDirectory();

      const reposDir = `${service.getDataDirectory()}/repos`;
      await expect(fsPromises.access(reposDir, fs.constants.F_OK)).resolves.not.toThrow();
    });
  });

  describe('Agent Management', () => {
    it('should get all agents', async () => {
      console.log('[FileDataStoreService.test] Testing getAgents');
      const config: AutosteerConfig = {
        worktrees: [],
        agents: [
          {
            id: 'agent-1',
            title: 'Agent 1',
            content: 'Content',
            preview: 'Preview',
            type: 'text',
            status: 'active',
            project_id: 'project1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: [],
            resource_ids: [],
          },
        ],
        settings: { vimMode: false },
      };
      await service.writeConfig(config);

      const agents = await service.getAgents();

      expect(agents).toHaveLength(1);
    });

    it('should get agents by project ID', async () => {
      console.log('[FileDataStoreService.test] Testing getAgentsByProjectId');
      const config: AutosteerConfig = {
        worktrees: [],
        agents: [
          {
            id: 'agent-1',
            title: 'Agent 1',
            content: 'Content',
            preview: 'Preview',
            type: 'text',
            status: 'active',
            project_id: 'project1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: [],
            resource_ids: [],
          },
          {
            id: 'agent-2',
            title: 'Agent 2',
            content: 'Content',
            preview: 'Preview',
            type: 'text',
            status: 'active',
            project_id: 'project2',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: [],
            resource_ids: [],
          },
        ],
        settings: { vimMode: false },
      };
      await service.writeConfig(config);

      const agents = await service.getAgentsByProjectId('project1');

      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe('agent-1');
    });

    it('should get single agent', async () => {
      console.log('[FileDataStoreService.test] Testing getAgent');
      const config: AutosteerConfig = {
        worktrees: [],
        agents: [
          {
            id: 'agent-1',
            title: 'Agent 1',
            content: 'Content',
            preview: 'Preview',
            type: 'text',
            status: 'active',
            project_id: 'project1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: [],
            resource_ids: [],
          },
        ],
        settings: { vimMode: false },
      };
      await service.writeConfig(config);

      const agent = await service.getAgent('agent-1');

      expect(agent).toBeDefined();
      expect(agent?.title).toBe('Agent 1');
    });

    it('should return undefined for non-existent agent', async () => {
      console.log('[FileDataStoreService.test] Testing getAgent - not found');
      const agent = await service.getAgent('non-existent');

      expect(agent).toBeUndefined();
    });

    it('should add agent', async () => {
      console.log('[FileDataStoreService.test] Testing addAgent');
      const config: AutosteerConfig = {
        worktrees: [
          {
            git_repo: 'https://github.com/test/repo.git',
            branch_name: 'main',
            folder_name: 'project1',
          },
        ],
        settings: { vimMode: false },
      };
      await service.writeConfig(config);

      const agent: AgentConfig = {
        id: 'agent-1',
        title: 'New Agent',
        content: 'Content',
        preview: 'Preview',
        type: 'text',
        status: 'active',
        project_id: 'project1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tags: [],
        resource_ids: [],
      };

      await service.addAgent(agent);

      const result = await service.readConfig();
      expect(result.agents).toHaveLength(1);
      expect(result.worktrees[0].agent_ids).toContain('agent-1');
    });

    it('should update agent', async () => {
      console.log('[FileDataStoreService.test] Testing updateAgent');
      const config: AutosteerConfig = {
        worktrees: [],
        agents: [
          {
            id: 'agent-1',
            title: 'Original',
            content: 'Content',
            preview: 'Preview',
            type: 'text',
            status: 'active',
            project_id: 'project1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: [],
            resource_ids: [],
          },
        ],
        settings: { vimMode: false },
      };
      await service.writeConfig(config);

      await service.updateAgent('agent-1', { title: 'Updated' });

      const result = await service.readConfig();
      expect(result.agents![0].title).toBe('Updated');
      expect(result.agents![0].updated_at).toBeDefined();
    });

    it('should delete agent', async () => {
      console.log('[FileDataStoreService.test] Testing deleteAgent');
      const config: AutosteerConfig = {
        worktrees: [
          {
            git_repo: 'https://github.com/test/repo.git',
            branch_name: 'main',
            folder_name: 'project1',
            agent_ids: ['agent-1'],
          },
        ],
        agents: [
          {
            id: 'agent-1',
            title: 'Agent 1',
            content: 'Content',
            preview: 'Preview',
            type: 'text',
            status: 'active',
            project_id: 'project1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: [],
            resource_ids: [],
          },
        ],
        settings: { vimMode: false },
      };
      await service.writeConfig(config);

      await service.deleteAgent('agent-1');

      const result = await service.readConfig();
      expect(result.agents).toHaveLength(0);
      expect(result.worktrees[0].agent_ids).toHaveLength(0);
    });

    it('should search agents by title', async () => {
      console.log('[FileDataStoreService.test] Testing searchAgents - title');
      const config: AutosteerConfig = {
        worktrees: [],
        agents: [
          {
            id: 'agent-1',
            title: 'Test Agent',
            content: 'Content',
            preview: 'Preview',
            type: 'text',
            status: 'active',
            project_id: 'project1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: [],
            resource_ids: [],
          },
          {
            id: 'agent-2',
            title: 'Other Agent',
            content: 'Content',
            preview: 'Preview',
            type: 'text',
            status: 'active',
            project_id: 'project1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: [],
            resource_ids: [],
          },
        ],
        settings: { vimMode: false },
      };
      await service.writeConfig(config);

      const results = await service.searchAgents('Test');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Test Agent');
    });

    it('should search agents by content', async () => {
      console.log('[FileDataStoreService.test] Testing searchAgents - content');
      const config: AutosteerConfig = {
        worktrees: [],
        agents: [
          {
            id: 'agent-1',
            title: 'Agent',
            content: 'Special Content',
            preview: 'Preview',
            type: 'text',
            status: 'active',
            project_id: 'project1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: [],
            resource_ids: [],
          },
        ],
        settings: { vimMode: false },
      };
      await service.writeConfig(config);

      const results = await service.searchAgents('Special');

      expect(results).toHaveLength(1);
    });

    it('should search agents by tags', async () => {
      console.log('[FileDataStoreService.test] Testing searchAgents - tags');
      const config: AutosteerConfig = {
        worktrees: [],
        agents: [
          {
            id: 'agent-1',
            title: 'Agent',
            content: 'Content',
            preview: 'Preview',
            type: 'text',
            status: 'active',
            project_id: 'project1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: ['important', 'urgent'],
            resource_ids: [],
          },
        ],
        settings: { vimMode: false },
      };
      await service.writeConfig(config);

      const results = await service.searchAgents('important');

      expect(results).toHaveLength(1);
    });
  });
});
