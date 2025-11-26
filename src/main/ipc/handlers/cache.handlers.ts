/**
 * Cache Handlers - IPC handlers for session cache operations
 * Part of Smart Session Cache System
 *
 * Responsibilities:
 * - Session cache validation and loading
 * - Cache population and rebuilding
 * - Cache invalidation and cleanup
 * - Cache statistics and monitoring
 *
 * Success Criteria:
 * - Cache load <50ms
 * - Type-safe IPC channels
 * - Comprehensive error handling
 * - Logging throughout
 */

import { SessionCacheService } from '@/services/SessionCacheService';
import { IpcMainInvokeEvent } from 'electron';
import log from 'electron-log';
import { registerSafeHandler } from '../safeHandlerWrapper';

/**
 * Cache operation response type
 */
interface CacheResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * CacheHandlers class
 * Centralized handler for all session cache IPC operations
 */
export class CacheHandlers {
  private cacheService: SessionCacheService;

  constructor() {
    this.cacheService = SessionCacheService.getInstance();
  }

  /**
   * Register all Cache IPC handlers
   */
  registerHandlers(): void {
    this.registerCacheLoadHandlers();
    this.registerCacheManagementHandlers();
    this.registerCacheStatsHandlers();
  }

  /**
   * Cache Load Operations
   */
  private registerCacheLoadHandlers(): void {
    // Load session from cache
    registerSafeHandler(
      'cache:load',
      async (
        _event: IpcMainInvokeEvent,
        sessionId: string,
        worktreeId: string,
        agentId: string
      ): Promise<CacheResponse> => {
        try {
          const startTime = performance.now();

          // Get cache metadata first to check validity
          const metadata = await this.cacheService.getCacheMetadata(sessionId);

          if (!metadata) {
            log.debug('[MessageCacheHandlers] Cache miss - no metadata found', { sessionId });
            return { success: false, error: 'Cache not found' };
          }

          // Validate cache (SDK version will be checked internally)
          const isValid = await this.cacheService.validateCache(sessionId, metadata.lastJsonlMtime);

          if (!isValid) {
            log.debug('[MessageCacheHandlers] Cache invalid - needs rebuild', { sessionId });
            return { success: false, error: 'Cache invalid' };
          }

          // Load cache data (this will use readCache internally)
          const cache = await this.cacheService.loadFromCache(sessionId, worktreeId, agentId);

          const duration = performance.now() - startTime;

          log.info('[MessageCacheHandlers] Cache loaded successfully', {
            sessionId,
            duration: `${duration.toFixed(2)}ms`,
            messageCount: metadata.messageCount,
          });

          return {
            success: true,
            data: {
              messages: cache.messages,
              metadata: cache.metadata,
              loadTime: duration,
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load cache';
          log.error('[MessageCacheHandlers] Cache load failed:', {
            sessionId,
            error: errorMessage,
          });
          return { success: false, error: errorMessage };
        }
      },
      { operationName: 'Load session cache' }
    );

    // Validate cache without loading
    registerSafeHandler(
      'cache:validate',
      async (
        _event: IpcMainInvokeEvent,
        sessionId: string,
        jsonlMtime: number
      ): Promise<CacheResponse<boolean>> => {
        try {
          const isValid = await this.cacheService.validateCache(sessionId, jsonlMtime);

          log.debug('[MessageCacheHandlers] Cache validation result', { sessionId, isValid });

          return { success: true, data: isValid };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Validation failed';
          log.error('[MessageCacheHandlers] Cache validation error:', {
            sessionId,
            error: errorMessage,
          });
          return { success: false, data: false, error: errorMessage };
        }
      },
      { operationName: 'Validate cache' }
    );
  }

  /**
   * Cache Management Operations
   */
  private registerCacheManagementHandlers(): void {
    // Rebuild cache from messages
    registerSafeHandler(
      'cache:rebuild',
      async (
        _event: IpcMainInvokeEvent,
        sessionId: string,
        worktreeId: string,
        agentId: string,
        messages: any[]
      ): Promise<CacheResponse> => {
        try {
          const startTime = performance.now();

          await this.cacheService.rebuildCache(sessionId, worktreeId, agentId, messages);

          const duration = performance.now() - startTime;

          log.info('[MessageCacheHandlers] Cache rebuilt successfully', {
            sessionId,
            duration: `${duration.toFixed(2)}ms`,
            messageCount: messages.length,
          });

          return { success: true, data: { duration, messageCount: messages.length } };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to rebuild cache';
          log.error('[MessageCacheHandlers] Cache rebuild failed:', {
            sessionId,
            error: errorMessage,
          });
          return { success: false, error: errorMessage };
        }
      },
      { operationName: 'Rebuild cache' }
    );

    // Invalidate cache
    registerSafeHandler(
      'cache:invalidate',
      async (_event: IpcMainInvokeEvent, sessionId: string): Promise<CacheResponse> => {
        try {
          await this.cacheService.deleteCache(sessionId);

          log.info('[MessageCacheHandlers] Cache invalidated', { sessionId });

          return { success: true };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to invalidate';
          log.error('[MessageCacheHandlers] Cache invalidation failed:', {
            sessionId,
            error: errorMessage,
          });
          return { success: false, error: errorMessage };
        }
      },
      { operationName: 'Invalidate cache' }
    );

    // Clear all caches
    registerSafeHandler(
      'cache:clearAll',
      async (): Promise<CacheResponse> => {
        try {
          await this.cacheService.clearAllCaches();

          log.info('[MessageCacheHandlers] All caches cleared');

          return { success: true };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to clear caches';
          log.error('[MessageCacheHandlers] Clear all caches failed:', { error: errorMessage });
          return { success: false, error: errorMessage };
        }
      },
      { operationName: 'Clear all caches' }
    );

    // Clear worktree caches
    registerSafeHandler(
      'cache:clearWorktree',
      async (_event: IpcMainInvokeEvent, worktreeId: string): Promise<CacheResponse> => {
        try {
          await this.cacheService.clearWorktreeCache(worktreeId);

          log.info('[MessageCacheHandlers] Worktree caches cleared', { worktreeId });

          return { success: true };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to clear worktree cache';
          log.error('[MessageCacheHandlers] Clear worktree cache failed:', {
            worktreeId,
            error: errorMessage,
          });
          return { success: false, error: errorMessage };
        }
      },
      { operationName: 'Clear worktree cache' }
    );

    // Cleanup orphaned caches
    registerSafeHandler(
      'cache:cleanupOrphaned',
      async (_event: IpcMainInvokeEvent, activeSessions: string[]): Promise<CacheResponse> => {
        try {
          await this.cacheService.cleanupOrphanedCaches(activeSessions);

          log.info('[MessageCacheHandlers] Orphaned caches cleaned up', {
            activeSessionCount: activeSessions.length,
          });

          return { success: true };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to cleanup orphaned caches';
          log.error('[MessageCacheHandlers] Cleanup orphaned caches failed:', {
            error: errorMessage,
          });
          return { success: false, error: errorMessage };
        }
      },
      { operationName: 'Cleanup orphaned caches' }
    );
  }

  /**
   * Cache Statistics Operations
   */
  private registerCacheStatsHandlers(): void {
    // Get cache metadata
    registerSafeHandler(
      'cache:getMetadata',
      async (_event: IpcMainInvokeEvent, sessionId: string): Promise<CacheResponse> => {
        try {
          const metadata = await this.cacheService.getCacheMetadata(sessionId);

          if (!metadata) {
            return { success: false, error: 'Cache metadata not found' };
          }

          return { success: true, data: metadata };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to get cache metadata';
          log.error('[MessageCacheHandlers] Get cache metadata failed:', {
            sessionId,
            error: errorMessage,
          });
          return { success: false, error: errorMessage };
        }
      },
      { operationName: 'Get cache metadata' }
    );

    // Get cache size
    registerSafeHandler(
      'cache:getSize',
      async (_event: IpcMainInvokeEvent, sessionId: string): Promise<CacheResponse<number>> => {
        try {
          const size = await this.cacheService.getCacheSize(sessionId);

          return { success: true, data: size };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to get cache size';
          log.error('[MessageCacheHandlers] Get cache size failed:', {
            sessionId,
            error: errorMessage,
          });
          return { success: false, data: 0, error: errorMessage };
        }
      },
      { operationName: 'Get cache size' }
    );

    // Monitor cache size (warns if >100MB)
    registerSafeHandler(
      'cache:monitorSize',
      async (_event: IpcMainInvokeEvent, sessionId: string): Promise<CacheResponse> => {
        try {
          await this.cacheService.monitorCacheSize(sessionId);

          return { success: true };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to monitor size';
          log.error('[MessageCacheHandlers] Monitor cache size failed:', {
            sessionId,
            error: errorMessage,
          });
          return { success: false, error: errorMessage };
        }
      },
      { operationName: 'Monitor cache size' }
    );
  }

  /**
   * Cleanup cache service
   */
  async cleanup(): Promise<void> {
    try {
      // Cache service doesn't require explicit cleanup
      log.debug('[MessageCacheHandlers] Cache handlers cleanup complete');
    } catch (error) {
      log.error('[MessageCacheHandlers] Cleanup failed:', error);
      throw error;
    }
  }
}
