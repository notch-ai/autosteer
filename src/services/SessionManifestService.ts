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
};

interface SessionManifest {
  agents: Record<string, string>; // agentId -> sessionId
  additionalDirectories?: Record<string, string[]>; // agentId -> additional directories
  lastUpdated: string;
}

export class SessionManifestService {
  private static instance: SessionManifestService;
  private sessionsDir: string;

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

  async updateAgentSession(worktreeId: string, agentId: string, sessionId: string): Promise<void> {
    try {
      await this.ensureSessionsDirectory();

      const manifestPath = this.getManifestPath(worktreeId);
      let manifest: SessionManifest;

      try {
        const content = await fsPromises.readFile(manifestPath, 'utf-8');
        manifest = JSON.parse(content);
      } catch (error) {
        // File doesn't exist or is corrupted, create new manifest
        manifest = {
          agents: {},
          lastUpdated: new Date().toISOString(),
        };
      }

      // Update the session for this agent
      manifest.agents[agentId] = sessionId;
      manifest.lastUpdated = new Date().toISOString();

      // Write atomically using temp file + rename
      const tempPath = `${manifestPath}.tmp.${Date.now()}`;
      await fsPromises.writeFile(tempPath, JSON.stringify(manifest, null, 2), 'utf-8');
      await fsPromises.rename(tempPath, manifestPath);

      logger.debug(`Updated session manifest for ${worktreeId}/${agentId}: ${sessionId}`);
    } catch (error) {
      logger.error('Failed to update session manifest:', error);
      throw error;
    }
  }

  async getAgentSession(worktreeId: string, agentId: string): Promise<string | undefined> {
    try {
      const manifestPath = this.getManifestPath(worktreeId);
      const content = await fsPromises.readFile(manifestPath, 'utf-8');
      const manifest: SessionManifest = JSON.parse(content);
      return manifest.agents[agentId];
    } catch (error) {
      logger.debug(`No session found for ${worktreeId}/${agentId}`);
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
      logger.debug(`No sessions found for worktree ${worktreeId}`);
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
    try {
      const manifestPath = this.getManifestPath(worktreeId);
      const content = await fsPromises.readFile(manifestPath, 'utf-8');
      const manifest: SessionManifest = JSON.parse(content);

      if (manifest.agents[agentId]) {
        delete manifest.agents[agentId];
        manifest.lastUpdated = new Date().toISOString();

        await fsPromises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
        logger.debug(`Deleted session for agent ${agentId} from worktree ${worktreeId}`);
      }
    } catch (error) {
      logger.debug(`Could not delete session for ${worktreeId}/${agentId}:`, error);
    }
  }

  async deleteWorktreeManifest(worktreeId: string): Promise<void> {
    try {
      const manifestPath = this.getManifestPath(worktreeId);
      await fsPromises.access(manifestPath);
      await fsPromises.rename(manifestPath, `${manifestPath}.deleted.${Date.now()}`);
      logger.debug(`Deleted manifest for worktree ${worktreeId}`);
    } catch (error) {
      logger.debug(`No manifest to delete for worktree ${worktreeId}`);
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

      logger.debug(`Updated additional directories for ${worktreeId}/${agentId}:`, directories);
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
      logger.debug(`No additional directories found for ${worktreeId}/${agentId}`);
      return [];
    }
  }
}
