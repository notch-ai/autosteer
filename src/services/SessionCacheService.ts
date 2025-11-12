import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { logger } from '@/commons/utils/logger';
import { SdkVersionManager } from './SdkVersionManager';

const fsPromises = {
  mkdir: promisify(fs.mkdir),
  readFile: promisify(fs.readFile),
  writeFile: promisify(fs.writeFile),
  stat: promisify(fs.stat),
  access: promisify(fs.access),
  readdir: promisify(fs.readdir),
  unlink: promisify(fs.unlink),
  rename: promisify(fs.rename),
};

interface SessionCacheMetadata {
  sessionId: string;
  worktreeId: string;
  agentId: string;
  sdkVersion: string;
  lastJsonlMtime: number;
  createdAt: string;
  lastAccessedAt: string;
  messageCount: number;
}

interface SessionCacheData {
  metadata: SessionCacheMetadata;
  messages: any[];
}

const CACHE_SIZE_WARNING_THRESHOLD = 100 * 1024 * 1024; // 100MB in bytes

export class SessionCacheService {
  private static instance: SessionCacheService;
  private cacheDir: string;
  private sdkVersionManager: SdkVersionManager;

  private constructor() {
    this.cacheDir = path.join(app.getPath('home'), '.autosteer', 'session_cache');
    this.sdkVersionManager = SdkVersionManager.getInstance();
  }

  static getInstance(): SessionCacheService {
    if (!SessionCacheService.instance) {
      SessionCacheService.instance = new SessionCacheService();
    }
    return SessionCacheService.instance;
  }

  private async ensureCacheDirectory(): Promise<void> {
    await fsPromises.mkdir(this.cacheDir, { recursive: true });
  }

  private getCachePath(sessionId: string): string {
    return path.join(this.cacheDir, `${sessionId}.json`);
  }

  private getJsonlPath(sessionId: string): string {
    return path.join(
      app.getPath('home'),
      '.claude',
      'data',
      'claude_code_sessions',
      `${sessionId}.jsonl`
    );
  }

  /**
   * Get cache file size in bytes
   */
  private async getCacheSize(sessionId: string): Promise<number> {
    try {
      const cachePath = this.getCachePath(sessionId);
      const stats = await fsPromises.stat(cachePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get JSONL file modification time
   */
  private async getJsonlMtime(sessionId: string): Promise<number> {
    try {
      const jsonlPath = this.getJsonlPath(sessionId);
      const stats = await fsPromises.stat(jsonlPath);
      return stats.mtimeMs;
    } catch (error) {
      logger.debug('[SessionCacheService] JSONL file not found', { sessionId });
      return 0;
    }
  }

  /**
   * Read cache data from disk
   */
  private async readCache(sessionId: string): Promise<SessionCacheData | null> {
    try {
      const cachePath = this.getCachePath(sessionId);
      const content = await fsPromises.readFile(cachePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  /**
   * Write cache data to disk atomically
   */
  private async writeCache(sessionId: string, data: SessionCacheData): Promise<void> {
    await this.ensureCacheDirectory();

    const cachePath = this.getCachePath(sessionId);
    const tempPath = `${cachePath}.tmp.${Date.now()}`;

    try {
      // Write to temporary file first
      await fsPromises.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');

      // Atomic rename
      await fsPromises.rename(tempPath, cachePath);

      logger.debug('[SessionCacheService] Cache written successfully', {
        sessionId,
        messageCount: data.messages.length,
        size: (await this.getCacheSize(sessionId)) / 1024,
      });
    } catch (error) {
      // Clean up temp file on error
      try {
        await fsPromises.unlink(tempPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Invalidate cache if JSONL file has been modified
   * @returns true if cache was invalidated, false otherwise
   */
  async invalidateOnMtimeChange(sessionId: string, currentMtime: number): Promise<boolean> {
    try {
      const cache = await this.readCache(sessionId);
      if (!cache) {
        logger.debug('[SessionCacheService] No cache to invalidate (mtime check)', { sessionId });
        return false;
      }

      if (cache.metadata.lastJsonlMtime < currentMtime) {
        logger.info('[SessionCacheService] Invalidating cache due to JSONL modification', {
          sessionId,
          cachedMtime: new Date(cache.metadata.lastJsonlMtime).toISOString(),
          currentMtime: new Date(currentMtime).toISOString(),
        });

        await this.deleteCache(sessionId);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('[SessionCacheService] Failed to invalidate cache on mtime change', {
        sessionId,
        error: String(error),
      });
      return false;
    }
  }

  /**
   * Invalidate cache if SDK version has changed
   * @returns true if cache was invalidated, false otherwise
   */
  async invalidateOnSdkVersionMismatch(sessionId: string): Promise<boolean> {
    try {
      const cache = await this.readCache(sessionId);
      if (!cache) {
        logger.debug('[SessionCacheService] No cache to invalidate (SDK version check)', {
          sessionId,
        });
        return false;
      }

      const currentVersion = this.sdkVersionManager.getCurrentVersion();
      const cachedVersion = cache.metadata.sdkVersion;

      // Check if versions are different
      if (cachedVersion !== currentVersion) {
        const { compatible, warnings } =
          this.sdkVersionManager.checkVersionCompatibility(cachedVersion);

        if (!compatible || warnings.length > 0) {
          logger.info('[SessionCacheService] Invalidating cache due to SDK version mismatch', {
            sessionId,
            cachedVersion,
            currentVersion,
            warnings,
          });

          await this.deleteCache(sessionId);
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('[SessionCacheService] Failed to invalidate cache on SDK version mismatch', {
        sessionId,
        error: String(error),
      });
      return false;
    }
  }

  /**
   * Rebuild cache from JSONL file
   * This is an atomic operation that won't corrupt existing cache on failure
   */
  async rebuildCache(
    sessionId: string,
    worktreeId: string,
    agentId: string,
    messages: any[]
  ): Promise<void> {
    try {
      const jsonlMtime = await this.getJsonlMtime(sessionId);
      const currentVersion = this.sdkVersionManager.getCurrentVersion();

      const cacheData: SessionCacheData = {
        metadata: {
          sessionId,
          worktreeId,
          agentId,
          sdkVersion: currentVersion,
          lastJsonlMtime: jsonlMtime,
          createdAt: new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
          messageCount: messages.length,
        },
        messages,
      };

      // Atomic write - won't corrupt existing cache on failure
      await this.writeCache(sessionId, cacheData);

      // Monitor cache size after rebuild
      await this.monitorCacheSize(sessionId);

      logger.info('[SessionCacheService] Cache rebuilt successfully', {
        sessionId,
        messageCount: messages.length,
        sdkVersion: currentVersion,
      });
    } catch (error) {
      logger.error('[SessionCacheService] Failed to rebuild cache', {
        sessionId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Monitor cache size and warn if exceeds threshold
   */
  async monitorCacheSize(sessionId: string): Promise<void> {
    try {
      const size = await this.getCacheSize(sessionId);

      if (size > CACHE_SIZE_WARNING_THRESHOLD) {
        logger.warn('[SessionCacheService] Cache size exceeds threshold', {
          sessionId,
          sizeBytes: size,
          sizeMB: (size / (1024 * 1024)).toFixed(2),
          thresholdMB: CACHE_SIZE_WARNING_THRESHOLD / (1024 * 1024),
        });
      }
    } catch (error) {
      logger.debug('[SessionCacheService] Failed to monitor cache size', {
        sessionId,
        error: String(error),
      });
      // Don't throw - monitoring failures shouldn't break the app
    }
  }

  /**
   * Clean up orphaned cache files (sessions that no longer exist)
   * @param activeSessions - Array of currently active session IDs
   */
  async cleanupOrphanedCaches(activeSessions: string[]): Promise<void> {
    try {
      await this.ensureCacheDirectory();

      const files = await fsPromises.readdir(this.cacheDir);
      const cacheFiles = files.filter((f) => f.endsWith('.json'));

      let removedCount = 0;

      for (const file of cacheFiles) {
        const sessionId = path.basename(file, '.json');

        // Skip if session is active
        if (activeSessions.includes(sessionId)) {
          continue;
        }

        // Check if JSONL file exists
        const jsonlPath = this.getJsonlPath(sessionId);
        try {
          await fsPromises.access(jsonlPath);
          // JSONL exists - keep cache
        } catch (error) {
          // JSONL doesn't exist - orphaned cache
          const cachePath = path.join(this.cacheDir, file);
          await fsPromises.unlink(cachePath);
          removedCount++;

          logger.debug('[SessionCacheService] Removed orphaned cache', {
            sessionId,
            file,
          });
        }
      }

      if (removedCount > 0) {
        logger.info('[SessionCacheService] Cleaned up orphaned caches', {
          removedCount,
          totalCaches: cacheFiles.length,
        });
      }
    } catch (error) {
      logger.error('[SessionCacheService] Failed to cleanup orphaned caches', {
        error: String(error),
      });
      // Don't throw - cleanup failures shouldn't break the app
    }
  }

  /**
   * Clear all caches (for testing/debugging)
   */
  async clearAllCaches(): Promise<void> {
    try {
      await this.ensureCacheDirectory();

      const files = await fsPromises.readdir(this.cacheDir);
      const cacheFiles = files.filter((f) => f.endsWith('.json'));

      for (const file of cacheFiles) {
        const cachePath = path.join(this.cacheDir, file);
        await fsPromises.unlink(cachePath);
      }

      logger.info('[SessionCacheService] All caches cleared', {
        count: cacheFiles.length,
      });
    } catch (error) {
      logger.error('[SessionCacheService] Failed to clear all caches', {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Clear cache for a specific worktree
   * @param worktreeId - The worktree ID to clear caches for
   */
  async clearWorktreeCache(worktreeId: string): Promise<void> {
    try {
      await this.ensureCacheDirectory();

      const files = await fsPromises.readdir(this.cacheDir);
      const cacheFiles = files.filter((f) => f.endsWith('.json'));

      let removedCount = 0;

      for (const file of cacheFiles) {
        const cachePath = path.join(this.cacheDir, file);
        const cache = await this.readCache(path.basename(file, '.json'));

        if (cache && cache.metadata.worktreeId === worktreeId) {
          await fsPromises.unlink(cachePath);
          removedCount++;

          logger.debug('[SessionCacheService] Removed worktree cache', {
            worktreeId,
            sessionId: cache.metadata.sessionId,
          });
        }
      }

      if (removedCount > 0) {
        logger.info('[SessionCacheService] Cleared worktree cache', {
          worktreeId,
          removedCount,
        });
      }
    } catch (error) {
      logger.error('[SessionCacheService] Failed to clear worktree cache', {
        worktreeId,
        error: String(error),
      });
      // Don't throw - cleanup failures shouldn't break the app
    }
  }

  /**
   * Delete a specific cache file
   */
  private async deleteCache(sessionId: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(sessionId);
      await fsPromises.unlink(cachePath);

      logger.debug('[SessionCacheService] Cache deleted', { sessionId });
    } catch (error) {
      // Ignore errors if cache doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error('[SessionCacheService] Failed to delete cache', {
          sessionId,
          error: String(error),
        });
      }
    }
  }

  /**
   * Get cache metadata without reading full messages
   */
  async getCacheMetadata(sessionId: string): Promise<SessionCacheMetadata | null> {
    try {
      const cache = await this.readCache(sessionId);
      return cache?.metadata || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Update cache access time
   */
  async updateAccessTime(sessionId: string): Promise<void> {
    try {
      const cache = await this.readCache(sessionId);
      if (cache) {
        cache.metadata.lastAccessedAt = new Date().toISOString();
        await this.writeCache(sessionId, cache);
      }
    } catch (error) {
      // Ignore access time update failures
      logger.debug('[SessionCacheService] Failed to update access time', {
        sessionId,
        error: String(error),
      });
    }
  }
}
