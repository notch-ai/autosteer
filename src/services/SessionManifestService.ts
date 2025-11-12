import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { logger } from '@/commons/utils/logger';

const fsPromises = {
  mkdir: promisify(fs.mkdir),
  readFile: promisify(fs.readFile),
  writeFile: promisify(fs.writeFile),
  access: promisify(fs.access),
  rename: promisify(fs.rename),
  unlink: promisify(fs.unlink),
};

interface SessionManifest {
  agents: Record<string, string>; // agentId -> sessionId
  additionalDirectories?: Record<string, string[]>; // agentId -> additional directories
  lastUpdated: string;
}

export class SessionManifestService {
  private static instance: SessionManifestService;
  private sessionsDir: string;
  private locks: Map<string, Promise<void>> = new Map();

  private constructor() {
    this.sessionsDir = path.join(app.getPath('home'), '.autosteer', 'sessions');
  }

  static getInstance(): SessionManifestService {
    if (!SessionManifestService.instance) {
      SessionManifestService.instance = new SessionManifestService();
    }
    return SessionManifestService.instance;
  }

  private async ensureSessionsDirectory(): Promise<void> {
    await fsPromises.mkdir(this.sessionsDir, { recursive: true });
  }

  private getManifestPath(worktreeId: string): string {
    return path.join(this.sessionsDir, `${worktreeId}.json`);
  }

  private async withLock<T>(worktreeId: string, fn: () => Promise<T>): Promise<T> {
    // Wait for any existing lock and get it before creating new one
    while (this.locks.has(worktreeId)) {
      await this.locks.get(worktreeId);
    }

    // Create new lock
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    this.locks.set(worktreeId, lockPromise);

    try {
      return await fn();
    } finally {
      // Release lock
      releaseLock!();
      this.locks.delete(worktreeId);
    }
  }

  private async cleanupTempFile(tempPath: string): Promise<void> {
    try {
      await fsPromises.unlink(tempPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  async updateAgentSession(worktreeId: string, agentId: string, sessionId: string): Promise<void> {
    return this.withLock(worktreeId, async () => {
      await this.ensureSessionsDirectory();

      const manifestPath = this.getManifestPath(worktreeId);
      const tempPath = `${manifestPath}.tmp.${Date.now()}`;

      try {
        let manifest: SessionManifest;

        try {
          const content = await fsPromises.readFile(manifestPath, 'utf-8');
          manifest = JSON.parse(content);
        } catch (error) {
          manifest = {
            agents: {},
            lastUpdated: new Date().toISOString(),
          };
        }

        manifest.agents[agentId] = sessionId;
        manifest.lastUpdated = new Date().toISOString();

        await fsPromises.writeFile(tempPath, JSON.stringify(manifest, null, 2), 'utf-8');
        await fsPromises.rename(tempPath, manifestPath);
      } catch (error) {
        await this.cleanupTempFile(tempPath);
        logger.error('Failed to update session manifest:', error);
        throw error;
      }
    });
  }

  async getAgentSession(worktreeId: string, agentId: string): Promise<string | undefined> {
    try {
      const manifestPath = this.getManifestPath(worktreeId);
      const content = await fsPromises.readFile(manifestPath, 'utf-8');
      const manifest: SessionManifest = JSON.parse(content);
      return manifest.agents[agentId];
    } catch (error) {
      return undefined;
    }
  }

  async getAllAgentSessions(worktreeId: string): Promise<Record<string, string>> {
    try {
      const manifestPath = this.getManifestPath(worktreeId);
      const content = await fsPromises.readFile(manifestPath, 'utf-8');
      const manifest: SessionManifest = JSON.parse(content);
      return manifest.agents;
    } catch (error) {
      return {};
    }
  }

  async migrateFromConfig(): Promise<void> {
    try {
      await this.ensureSessionsDirectory();

      // Import FileDataStoreService to read existing config
      const { FileDataStoreService } = await import('./FileDataStoreService');
      const fileDataStore = FileDataStoreService.getInstance();
      const config = await fileDataStore.readConfig();

      if (!config.agents) {
        return;
      }

      // Group agents by worktree and migrate their session IDs
      const worktreeManifests = new Map<string, SessionManifest>();

      for (const agent of config.agents) {
        if (agent.claude_session_id) {
          const worktreeId = agent.project_id;

          if (!worktreeManifests.has(worktreeId)) {
            worktreeManifests.set(worktreeId, {
              agents: {},
              lastUpdated: new Date().toISOString(),
            });
          }

          const manifest = worktreeManifests.get(worktreeId)!;
          manifest.agents[agent.id] = agent.claude_session_id;

          logger.info(`Migrating session for agent ${agent.id} in worktree ${worktreeId}`);
        }
      }

      // Write all manifests
      for (const [worktreeId, manifest] of worktreeManifests) {
        const manifestPath = this.getManifestPath(worktreeId);
        await fsPromises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
      }

      // Clean up session IDs from config
      let needsConfigUpdate = false;
      for (const agent of config.agents) {
        if (agent.claude_session_id) {
          delete agent.claude_session_id;
          needsConfigUpdate = true;
        }
      }

      if (needsConfigUpdate) {
        await fileDataStore.writeConfig(config);
        logger.info('Removed session IDs from config after migration');
      }

      logger.info('Session manifest migration completed');
    } catch (error) {
      logger.error('Failed to migrate sessions from config:', error);
      // Don't throw - migration failure shouldn't prevent app startup
    }
  }

  async deleteAgentSessions(worktreeId: string, agentId: string): Promise<void> {
    return this.withLock(worktreeId, async () => {
      try {
        const manifestPath = this.getManifestPath(worktreeId);
        const content = await fsPromises.readFile(manifestPath, 'utf-8');
        const manifest: SessionManifest = JSON.parse(content);

        if (manifest.agents[agentId]) {
          delete manifest.agents[agentId];
          manifest.lastUpdated = new Date().toISOString();

          const tempPath = `${manifestPath}.tmp.${Date.now()}`;
          await fsPromises.writeFile(tempPath, JSON.stringify(manifest, null, 2), 'utf-8');
          await fsPromises.rename(tempPath, manifestPath);
        }
      } catch (error) {
        // Session deletion is a best-effort operation
      }
    });
  }

  async deleteWorktreeManifest(worktreeId: string): Promise<void> {
    try {
      const manifestPath = this.getManifestPath(worktreeId);
      await fsPromises.access(manifestPath);
      // Soft-delete: rename with timestamp to preserve data
      const timestamp = Date.now();
      const deletedPath = manifestPath.replace('.json', `.json.deleted.${timestamp}`);
      await fsPromises.rename(manifestPath, deletedPath);

      // Clear cache for this worktree
      try {
        const { SessionCacheService } = await import('./SessionCacheService');
        const cacheService = SessionCacheService.getInstance();
        await cacheService.clearWorktreeCache(worktreeId);
        logger.debug('[SessionManifestService] Cleared cache for worktree', { worktreeId });
      } catch (cacheError) {
        // Don't fail if cache cleanup fails
        logger.warn('[SessionManifestService] Failed to clear worktree cache', {
          worktreeId,
          error: String(cacheError),
        });
      }
    } catch (error) {
      // No manifest to delete
    }
  }

  /**
   * Clean up old soft-deleted manifest files (*.deleted.*)
   * Called during app initialization to prevent accumulation
   */
  async cleanupDeletedManifests(): Promise<void> {
    try {
      await this.ensureSessionsDirectory();
      const dirents = fs.readdirSync(this.sessionsDir, { withFileTypes: true });

      let cleanedCount = 0;
      for (const dirent of dirents) {
        if (dirent.isFile() && dirent.name.includes('.deleted.')) {
          try {
            await fsPromises.unlink(path.join(this.sessionsDir, dirent.name));
            cleanedCount++;
          } catch (error) {
            logger.warn(`Failed to delete ${dirent.name}:`, error);
          }
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} deleted manifest files`);
      }
    } catch (error) {
      logger.error('Failed to cleanup deleted manifests:', error);
      // Don't throw - cleanup failure shouldn't prevent app startup
    }
  }

  /**
   * Update additional directories for an agent
   */
  async updateAdditionalDirectories(
    worktreeId: string,
    agentId: string,
    directories: string[]
  ): Promise<void> {
    try {
      await this.ensureSessionsDirectory();
      const manifestPath = this.getManifestPath(worktreeId);
      let manifest: SessionManifest;

      try {
        const content = await fsPromises.readFile(manifestPath, 'utf-8');
        manifest = JSON.parse(content);
      } catch (error) {
        manifest = {
          agents: {},
          additionalDirectories: {},
          lastUpdated: new Date().toISOString(),
        };
      }

      if (!manifest.additionalDirectories) {
        manifest.additionalDirectories = {};
      }

      manifest.additionalDirectories[agentId] = directories;
      manifest.lastUpdated = new Date().toISOString();

      const tempPath = `${manifestPath}.tmp.${Date.now()}`;
      await fsPromises.writeFile(tempPath, JSON.stringify(manifest, null, 2), 'utf-8');
      await fsPromises.rename(tempPath, manifestPath);
    } catch (error) {
      logger.error('Failed to update additional directories:', error);
      throw error;
    }
  }

  /**
   * Get additional directories for an agent
   */
  async getAdditionalDirectories(worktreeId: string, agentId: string): Promise<string[]> {
    try {
      const manifestPath = this.getManifestPath(worktreeId);
      const content = await fsPromises.readFile(manifestPath, 'utf-8');
      const manifest: SessionManifest = JSON.parse(content);
      return manifest.additionalDirectories?.[agentId] || [];
    } catch (error) {
      return [];
    }
  }
}
