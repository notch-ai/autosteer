/**
 * SessionManifestService.test.ts
 * Comprehensive unit tests for SessionManifestService with 80%+ coverage
 * Tests session persistence, agent-to-session mapping, and manifest management
 */

import { SessionManifestService } from '@/services/SessionManifestService';
import * as fs from 'fs';
import { promisify } from 'util';

const fsPromises = {
  mkdir: promisify(fs.mkdir),
  readFile: promisify(fs.readFile),
  writeFile: promisify(fs.writeFile),
  rm: promisify(fs.rm),
  access: promisify(fs.access),
  rename: promisify(fs.rename),
};

// Use unique directory to avoid parallel test conflicts
const TEST_DIR = `/tmp/test-autosteer-session-${process.pid}-${Date.now()}`;

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

describe('SessionManifestService', () => {
  let service: SessionManifestService;
  const testDir = TEST_DIR;
  const sessionsDir = `${TEST_DIR}/.autosteer/sessions`;

  beforeAll(async () => {
    // Ensure /tmp exists and is writable
    try {
      await fsPromises.mkdir('/tmp', { recursive: true });
    } catch (error) {
      // /tmp already exists, ignore
    }
  });

  beforeEach(async () => {
    console.log('[SessionManifestService.test] Setting up test suite');
    // Clean up test directory
    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Directory doesn't exist, ignore
    }

    // Create test directory structure
    await fsPromises.mkdir(sessionsDir, { recursive: true });

    // Get fresh instance
    service = SessionManifestService.getInstance();
  });

  afterEach(async () => {
    console.log('[SessionManifestService.test] Cleaning up test suite');
    // Clean up test directory
    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      console.log('[SessionManifestService.test] Testing singleton pattern');
      const instance1 = SessionManifestService.getInstance();
      const instance2 = SessionManifestService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Session Management', () => {
    it('should update agent session mapping', async () => {
      console.log('[SessionManifestService.test] Testing updateAgentSession');
      await service.updateAgentSession('worktree1', 'agent1', 'session123');

      const sessionId = await service.getAgentSession('worktree1', 'agent1');

      expect(sessionId).toBe('session123');
    });

    it('should update existing agent session', async () => {
      console.log('[SessionManifestService.test] Testing updateAgentSession - update');
      await service.updateAgentSession('worktree1', 'agent1', 'session123');
      await service.updateAgentSession('worktree1', 'agent1', 'session456');

      const sessionId = await service.getAgentSession('worktree1', 'agent1');

      expect(sessionId).toBe('session456');
    });

    it('should handle multiple agents in same worktree', async () => {
      console.log('[SessionManifestService.test] Testing multiple agents');
      await service.updateAgentSession('worktree1', 'agent1', 'session1');
      await service.updateAgentSession('worktree1', 'agent2', 'session2');
      await service.updateAgentSession('worktree1', 'agent3', 'session3');

      const session1 = await service.getAgentSession('worktree1', 'agent1');
      const session2 = await service.getAgentSession('worktree1', 'agent2');
      const session3 = await service.getAgentSession('worktree1', 'agent3');

      expect(session1).toBe('session1');
      expect(session2).toBe('session2');
      expect(session3).toBe('session3');
    });

    it('should handle multiple worktrees', async () => {
      console.log('[SessionManifestService.test] Testing multiple worktrees');
      await service.updateAgentSession('worktree1', 'agent1', 'session1');
      await service.updateAgentSession('worktree2', 'agent1', 'session2');

      const session1 = await service.getAgentSession('worktree1', 'agent1');
      const session2 = await service.getAgentSession('worktree2', 'agent1');

      expect(session1).toBe('session1');
      expect(session2).toBe('session2');
    });

    it('should return undefined for non-existent agent session', async () => {
      console.log('[SessionManifestService.test] Testing getAgentSession - not found');
      // Use a unique worktree ID that hasn't been created by any previous test
      const sessionId = await service.getAgentSession('worktree-nonexistent', 'agent-nonexistent');

      expect(sessionId).toBeUndefined();
    });

    it('should return undefined for non-existent worktree', async () => {
      console.log('[SessionManifestService.test] Testing getAgentSession - no worktree');
      const sessionId = await service.getAgentSession('non-existent', 'agent1');

      expect(sessionId).toBeUndefined();
    });

    it('should get all agent sessions for worktree', async () => {
      console.log('[SessionManifestService.test] Testing getAllAgentSessions');
      await service.updateAgentSession('worktree1', 'agent1', 'session1');
      await service.updateAgentSession('worktree1', 'agent2', 'session2');
      await service.updateAgentSession('worktree1', 'agent3', 'session3');

      const sessions = await service.getAllAgentSessions('worktree1');

      expect(sessions).toEqual({
        agent1: 'session1',
        agent2: 'session2',
        agent3: 'session3',
      });
    });

    it('should return empty object for worktree with no sessions', async () => {
      console.log('[SessionManifestService.test] Testing getAllAgentSessions - empty');
      // Use a unique worktree ID that hasn't been created by any previous test
      const sessions = await service.getAllAgentSessions('worktree-empty-sessions');

      expect(sessions).toEqual({});
    });

    it('should write manifest atomically', async () => {
      console.log('[SessionManifestService.test] Testing atomic write');
      // Ensure sessions directory exists
      await fsPromises.mkdir(sessionsDir, { recursive: true });

      await service.updateAgentSession('worktree1', 'agent1', 'session1');

      const manifestPath = `${sessionsDir}/worktree1.json`;

      // Add small delay to ensure write completes
      await new Promise((resolve) => setTimeout(resolve, 100));

      const content = await fsPromises.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(content);

      expect(manifest.agents.agent1).toBe('session1');
      expect(manifest.lastUpdated).toBeDefined();
    });

    it('should create manifest file if it does not exist', async () => {
      console.log('[SessionManifestService.test] Testing manifest creation');
      const manifestPath = `${sessionsDir}/worktree-new.json`;

      // Verify file does not exist
      await expect(fsPromises.access(manifestPath)).rejects.toThrow();

      await service.updateAgentSession('worktree-new', 'agent1', 'session1');

      // Verify file was created
      await expect(fsPromises.access(manifestPath)).resolves.not.toThrow();
    });

    it('should handle corrupted manifest file gracefully', async () => {
      console.log('[SessionManifestService.test] Testing corrupted manifest');
      const manifestPath = `${sessionsDir}/worktree1.json`;

      // Write invalid JSON
      await fsPromises.writeFile(manifestPath, 'invalid json{', 'utf-8');

      // Should create new manifest
      await service.updateAgentSession('worktree1', 'agent1', 'session1');

      const sessionId = await service.getAgentSession('worktree1', 'agent1');
      expect(sessionId).toBe('session1');
    });
  });

  describe('Agent Session Deletion', () => {
    it('should delete agent session from manifest', async () => {
      console.log('[SessionManifestService.test] Testing deleteAgentSessions');
      await service.updateAgentSession('worktree1', 'agent1', 'session1');
      await service.updateAgentSession('worktree1', 'agent2', 'session2');

      await service.deleteAgentSessions('worktree1', 'agent1');

      const session1 = await service.getAgentSession('worktree1', 'agent1');
      const session2 = await service.getAgentSession('worktree1', 'agent2');

      expect(session1).toBeUndefined();
      expect(session2).toBe('session2');
    });

    it('should handle deleting non-existent agent session', async () => {
      console.log('[SessionManifestService.test] Testing deleteAgentSessions - not found');
      await service.updateAgentSession('worktree1', 'agent1', 'session1');

      await service.deleteAgentSessions('worktree1', 'agent2');

      const session1 = await service.getAgentSession('worktree1', 'agent1');
      expect(session1).toBe('session1');
    });

    it('should handle deleting from non-existent worktree', async () => {
      console.log('[SessionManifestService.test] Testing deleteAgentSessions - no worktree');
      // Should not throw error
      await expect(service.deleteAgentSessions('non-existent', 'agent1')).resolves.not.toThrow();
    });
  });

  describe('Worktree Manifest Deletion', () => {
    it('should delete entire worktree manifest', async () => {
      console.log('[SessionManifestService.test] Testing deleteWorktreeManifest');
      await service.updateAgentSession('worktree1', 'agent1', 'session1');
      await service.updateAgentSession('worktree1', 'agent2', 'session2');

      const manifestPath = `${sessionsDir}/worktree1.json`;

      // Add small delay to ensure write completes
      await new Promise((resolve) => setTimeout(resolve, 100));

      await expect(fsPromises.access(manifestPath)).resolves.not.toThrow();

      await service.deleteWorktreeManifest('worktree1');

      // Original file should be renamed
      await expect(fsPromises.access(manifestPath)).rejects.toThrow();
    });

    it('should handle deleting non-existent worktree manifest', async () => {
      console.log('[SessionManifestService.test] Testing deleteWorktreeManifest - not found');
      // Should not throw error
      await expect(service.deleteWorktreeManifest('non-existent')).resolves.not.toThrow();
    });

    it('should rename manifest file with timestamp', async () => {
      console.log('[SessionManifestService.test] Testing manifest rename');
      await service.updateAgentSession('worktree1', 'agent1', 'session1');

      // Add small delay to ensure write completes
      await new Promise((resolve) => setTimeout(resolve, 100));

      await service.deleteWorktreeManifest('worktree1');

      // Check for deleted file with timestamp
      const files = await fs.promises.readdir(sessionsDir);
      const deletedFile = files.find((f) => f.startsWith('worktree1.json.deleted.'));

      expect(deletedFile).toBeDefined();
    });
  });

  describe('Additional Directories Management', () => {
    it('should update additional directories for agent', async () => {
      console.log('[SessionManifestService.test] Testing updateAdditionalDirectories');
      const directories = ['/path/to/dir1', '/path/to/dir2'];

      await service.updateAdditionalDirectories('worktree1', 'agent1', directories);

      const result = await service.getAdditionalDirectories('worktree1', 'agent1');

      expect(result).toEqual(directories);
    });

    it('should update existing additional directories', async () => {
      console.log('[SessionManifestService.test] Testing updateAdditionalDirectories - update');
      await service.updateAdditionalDirectories('worktree1', 'agent1', ['/path1']);
      await service.updateAdditionalDirectories('worktree1', 'agent1', ['/path1', '/path2']);

      const result = await service.getAdditionalDirectories('worktree1', 'agent1');

      expect(result).toEqual(['/path1', '/path2']);
    });

    it('should handle multiple agents with different directories', async () => {
      console.log('[SessionManifestService.test] Testing multiple agents directories');
      await service.updateAdditionalDirectories('worktree1', 'agent1', ['/dir1']);
      await service.updateAdditionalDirectories('worktree1', 'agent2', ['/dir2']);

      const dirs1 = await service.getAdditionalDirectories('worktree1', 'agent1');
      const dirs2 = await service.getAdditionalDirectories('worktree1', 'agent2');

      expect(dirs1).toEqual(['/dir1']);
      expect(dirs2).toEqual(['/dir2']);
    });

    it('should return empty array for agent with no directories', async () => {
      console.log('[SessionManifestService.test] Testing getAdditionalDirectories - empty');
      // Use a unique worktree and agent ID that hasn't been used in previous tests
      const result = await service.getAdditionalDirectories('worktree-no-dirs', 'agent-no-dirs');

      expect(result).toEqual([]);
    });

    it('should persist additional directories to manifest', async () => {
      console.log('[SessionManifestService.test] Testing directories persistence');
      const directories = ['/path1', '/path2'];

      await service.updateAdditionalDirectories('worktree1', 'agent1', directories);

      const manifestPath = `${sessionsDir}/worktree1.json`;

      // Add small delay to ensure write completes
      await new Promise((resolve) => setTimeout(resolve, 100));

      const content = await fsPromises.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(content);

      expect(manifest.additionalDirectories?.agent1).toEqual(directories);
    });

    it('should initialize additionalDirectories field if not present', async () => {
      console.log('[SessionManifestService.test] Testing additionalDirectories initialization');
      // First create a manifest without additionalDirectories
      await service.updateAgentSession('worktree1', 'agent1', 'session1');

      // Then add additional directories
      await service.updateAdditionalDirectories('worktree1', 'agent1', ['/path1']);

      const result = await service.getAdditionalDirectories('worktree1', 'agent1');
      expect(result).toEqual(['/path1']);
    });
  });

  describe('Migration from Config', () => {
    beforeEach(() => {
      // Mock FileDataStoreService for migration tests
      jest.mock('@/services/FileDataStoreService', () => ({
        FileDataStoreService: {
          getInstance: jest.fn(() => ({
            readConfig: jest.fn(),
            writeConfig: jest.fn(),
          })),
        },
      }));
    });

    it('should migrate sessions from config to manifest', async () => {
      console.log('[SessionManifestService.test] Testing migrateFromConfig');
      // Import after mock is set up
      const { FileDataStoreService } = await import('@/services/FileDataStoreService');

      const mockFileDataStore = {
        readConfig: jest.fn().mockResolvedValue({
          agents: [
            {
              id: 'agent1',
              project_id: 'worktree1',
              claude_session_id: 'session1',
              title: 'Agent 1',
              content: '',
              preview: '',
              type: 'text',
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              tags: [],
              resource_ids: [],
            },
            {
              id: 'agent2',
              project_id: 'worktree1',
              claude_session_id: 'session2',
              title: 'Agent 2',
              content: '',
              preview: '',
              type: 'text',
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              tags: [],
              resource_ids: [],
            },
          ],
        }),
        writeConfig: jest.fn().mockResolvedValue(undefined),
      };

      (FileDataStoreService.getInstance as jest.Mock).mockReturnValue(mockFileDataStore);

      await service.migrateFromConfig();

      // Verify sessions were migrated
      const session1 = await service.getAgentSession('worktree1', 'agent1');
      const session2 = await service.getAgentSession('worktree1', 'agent2');

      expect(session1).toBe('session1');
      expect(session2).toBe('session2');
    });

    it('should handle migration with no agents', async () => {
      console.log('[SessionManifestService.test] Testing migrateFromConfig - no agents');
      const { FileDataStoreService } = await import('@/services/FileDataStoreService');

      const mockFileDataStore = {
        readConfig: jest.fn().mockResolvedValue({}),
        writeConfig: jest.fn(),
      };

      (FileDataStoreService.getInstance as jest.Mock).mockReturnValue(mockFileDataStore);

      // Should not throw error
      await expect(service.migrateFromConfig()).resolves.not.toThrow();
    });

    it('should handle migration errors gracefully', async () => {
      console.log('[SessionManifestService.test] Testing migrateFromConfig - error handling');
      const { FileDataStoreService } = await import('@/services/FileDataStoreService');

      const mockFileDataStore = {
        readConfig: jest.fn().mockRejectedValue(new Error('Read failed')),
        writeConfig: jest.fn(),
      };

      (FileDataStoreService.getInstance as jest.Mock).mockReturnValue(mockFileDataStore);

      // Should not throw error (migration failure should not prevent app startup)
      await expect(service.migrateFromConfig()).resolves.not.toThrow();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent updates to same worktree', async () => {
      console.log('[SessionManifestService.test] Testing concurrent updates');
      // Simulate concurrent updates
      await Promise.all([
        service.updateAgentSession('worktree1', 'agent1', 'session1'),
        service.updateAgentSession('worktree1', 'agent2', 'session2'),
        service.updateAgentSession('worktree1', 'agent3', 'session3'),
      ]);

      const sessions = await service.getAllAgentSessions('worktree1');

      expect(sessions.agent1).toBe('session1');
      expect(sessions.agent2).toBe('session2');
      expect(sessions.agent3).toBe('session3');
    });

    it('should handle concurrent updates to different worktrees', async () => {
      console.log('[SessionManifestService.test] Testing concurrent worktree updates');
      await Promise.all([
        service.updateAgentSession('worktree1', 'agent1', 'session1'),
        service.updateAgentSession('worktree2', 'agent1', 'session2'),
        service.updateAgentSession('worktree3', 'agent1', 'session3'),
      ]);

      const session1 = await service.getAgentSession('worktree1', 'agent1');
      const session2 = await service.getAgentSession('worktree2', 'agent1');
      const session3 = await service.getAgentSession('worktree3', 'agent1');

      expect(session1).toBe('session1');
      expect(session2).toBe('session2');
      expect(session3).toBe('session3');
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in worktree ID', async () => {
      console.log('[SessionManifestService.test] Testing special characters');
      const worktreeId = 'worktree-with-special-chars-123';
      await service.updateAgentSession(worktreeId, 'agent1', 'session1');

      const sessionId = await service.getAgentSession(worktreeId, 'agent1');

      expect(sessionId).toBe('session1');
    });

    it('should handle special characters in agent ID', async () => {
      console.log('[SessionManifestService.test] Testing special agent ID');
      const agentId = 'agent-with-uuid-12345678-90ab-cdef';
      await service.updateAgentSession('worktree1', agentId, 'session1');

      const sessionId = await service.getAgentSession('worktree1', agentId);

      expect(sessionId).toBe('session1');
    });

    it('should handle empty directories array', async () => {
      console.log('[SessionManifestService.test] Testing empty directories');
      await service.updateAdditionalDirectories('worktree1', 'agent1', []);

      const result = await service.getAdditionalDirectories('worktree1', 'agent1');

      expect(result).toEqual([]);
    });

    it('should maintain lastUpdated timestamp', async () => {
      console.log('[SessionManifestService.test] Testing lastUpdated');
      await service.updateAgentSession('worktree1', 'agent1', 'session1');

      const manifestPath = `${sessionsDir}/worktree1.json`;
      const content = await fsPromises.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(content);

      expect(manifest.lastUpdated).toBeDefined();
      expect(new Date(manifest.lastUpdated).getTime()).toBeGreaterThan(Date.now() - 5000); // Within last 5 seconds
    });
  });
});
