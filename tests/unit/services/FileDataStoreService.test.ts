import { FileDataStoreService } from '@/services/FileDataStoreService';
import { AutosteerConfig } from '@/types/config.types';
import * as fs from 'fs';
import { promisify } from 'util';

const fsPromises = {
  mkdir: promisify(fs.mkdir),
  writeFile: promisify(fs.writeFile),
  rm: promisify(fs.rm),
};

// Mock electron app.getPath
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/tmp/test-autosteer'),
  },
}));

describe('FileDataStoreService', () => {
  let service: FileDataStoreService;
  const testDir = '/tmp/test-autosteer';

  beforeEach(async () => {
    // Clean up test directory
    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Directory doesn't exist, ignore
    }

    // Create test directory
    await fsPromises.mkdir(testDir, { recursive: true });

    // Get fresh instance
    service = FileDataStoreService.getInstance();
    await service.ensureDirectories();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('removeWorktree', () => {
    it('should remove worktree and associated agents from config', async () => {
      // Setup: Create a config with worktree and agents
      const initialConfig: AutosteerConfig = {
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
            content: 'Test agent 1',
            preview: 'Preview 1',
            type: 'text',
            status: 'draft',
            project_id: 'test-project', // Associated with test-project
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: [],
            resource_ids: [],
          },
          {
            id: 'agent-2',
            title: 'Agent 2',
            content: 'Test agent 2',
            preview: 'Preview 2',
            type: 'text',
            status: 'draft',
            project_id: 'other-project', // Associated with different project
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: [],
            resource_ids: [],
          },
        ],
        store: {
          projects: [
            { folderName: 'test-project', name: 'Test Project' },
            { folderName: 'other-project', name: 'Other Project' },
          ],
        },
        recentProjects: ['test-project', 'other-project'],
      };

      await service.writeConfig(initialConfig);

      // Act: Remove the worktree
      await service.removeWorktree('test-project');

      // Assert: Verify config was updated
      const updatedConfig = await service.readConfig();

      // Worktree should be removed
      expect(updatedConfig.worktrees).toHaveLength(0);

      // Only agent-1 should be removed (associated with test-project)
      expect(updatedConfig.agents).toHaveLength(1);
      expect(updatedConfig.agents![0].id).toBe('agent-2');
      expect(updatedConfig.agents![0].project_id).toBe('other-project');

      // Project should be removed from store
      expect(updatedConfig.store?.projects).toHaveLength(1);
      expect((updatedConfig.store?.projects as any[])[0].folderName).toBe('other-project');

      // Recent project should be removed
      expect(updatedConfig.recentProjects).toHaveLength(1);
      expect(updatedConfig.recentProjects![0]).toBe('other-project');
    });

    it('should handle config without agents', async () => {
      // Setup: Create a config without agents
      const initialConfig: AutosteerConfig = {
        worktrees: [
          {
            git_repo: 'https://github.com/test/repo.git',
            branch_name: 'main',
            folder_name: 'test-project',
          },
        ],
      };

      await service.writeConfig(initialConfig);

      // Act: Remove the worktree
      await service.removeWorktree('test-project');

      // Assert: Should not throw error
      const updatedConfig = await service.readConfig();
      expect(updatedConfig.worktrees).toHaveLength(0);
    });

    it('should clean up store keys containing folder name', async () => {
      // Setup: Create a config with store data
      const initialConfig: AutosteerConfig = {
        worktrees: [
          {
            git_repo: 'https://github.com/test/repo.git',
            branch_name: 'main',
            folder_name: 'test-project',
          },
        ],
        store: {
          'test-project-settings': { some: 'data' },
          'test-project-cache': { cached: 'value' },
          'other-data': { keep: 'this' },
        },
      };

      await service.writeConfig(initialConfig);

      // Act: Remove the worktree
      await service.removeWorktree('test-project');

      // Assert: Store keys with folder name should be removed
      const updatedConfig = await service.readConfig();
      expect(updatedConfig.store).toBeDefined();
      expect(updatedConfig.store!['test-project-settings']).toBeUndefined();
      expect(updatedConfig.store!['test-project-cache']).toBeUndefined();
      expect(updatedConfig.store!['other-data']).toBeDefined();
    });
  });
});
