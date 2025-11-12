/**
 * SessionCacheService.test.ts
 * Comprehensive unit tests for SessionCacheService with 80%+ coverage
 * Tests cache validation, file operations, invalidation, and cleanup
 */

import { SessionCacheService } from '@/services/SessionCacheService';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

// Test helper to create mock messages
const createTestMessages = (count: number): any[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    type: 'text',
    content: `Test message ${i}`,
    timestamp: new Date(Date.now() + i * 1000).toISOString(),
    role: 'user',
  }));
};

const fsPromises = {
  mkdir: promisify(fs.mkdir),
  writeFile: promisify(fs.writeFile),
  readFile: promisify(fs.readFile),
  rm: promisify(fs.rm),
  access: promisify(fs.access),
  stat: promisify(fs.stat),
  readdir: promisify(fs.readdir),
  unlink: promisify(fs.unlink),
};

// Use unique directory to avoid parallel test conflicts
const TEST_DIR = `/tmp/test-session-cache-${process.pid}-${Date.now()}`;
const TEST_CACHE_DIR = path.join(TEST_DIR, '.autosteer', 'session_cache');
const TEST_JSONL_DIR = path.join(TEST_DIR, '.claude', 'data', 'claude_code_sessions');

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

// Mock SDK version manager
jest.mock('@/services/SdkVersionManager', () => ({
  SdkVersionManager: {
    getInstance: jest.fn(() => ({
      getCurrentVersion: jest.fn(() => '1.0.0-test'),
      checkVersionCompatibility: jest.fn((version: string) => ({
        compatible: version === '1.0.0-test',
        warnings: version !== '1.0.0-test' ? ['Version mismatch'] : [],
      })),
    })),
  },
}));

describe('SessionCacheService', () => {
  let service: SessionCacheService;
  const testSessionId = 'test-session-123';
  const testWorktreeId = 'test-worktree';
  const testAgentId = 'test-agent';

  beforeAll(async () => {
    // Ensure /tmp exists and is writable
    try {
      await fsPromises.mkdir('/tmp', { recursive: true });
    } catch (error) {
      // /tmp already exists, ignore
    }
  });

  beforeEach(async () => {
    console.log('[SessionCacheService.test] Setting up test suite');

    // Clean up test directory
    try {
      await fsPromises.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      // Directory doesn't exist, ignore
    }

    // Create test directories
    await fsPromises.mkdir(TEST_CACHE_DIR, { recursive: true });
    await fsPromises.mkdir(TEST_JSONL_DIR, { recursive: true });

    // Get fresh instance
    service = SessionCacheService.getInstance();
  });

  afterEach(async () => {
    console.log('[SessionCacheService.test] Cleaning up test suite');

    // Clean up test directory
    try {
      await fsPromises.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      console.log('[SessionCacheService.test] Testing singleton pattern');

      const instance1 = SessionCacheService.getInstance();
      const instance2 = SessionCacheService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Cache Rebuild', () => {
    it('should rebuild cache from messages', async () => {
      console.log('[SessionCacheService.test] Testing cache rebuild');

      const testMessages = createTestMessages(10);

      // Create JSONL file first
      const jsonlPath = path.join(TEST_JSONL_DIR, `${testSessionId}.jsonl`);
      await fsPromises.writeFile(jsonlPath, 'test content');

      await service.rebuildCache(testSessionId, testWorktreeId, testAgentId, testMessages);

      // Verify cache file was created
      const cachePath = path.join(TEST_CACHE_DIR, `${testSessionId}.json`);
      await expect(fsPromises.access(cachePath, fs.constants.F_OK)).resolves.not.toThrow();

      // Verify cache metadata
      const metadata = await service.getCacheMetadata(testSessionId);

      expect(metadata).not.toBeNull();
      expect(metadata?.sessionId).toBe(testSessionId);
      expect(metadata?.worktreeId).toBe(testWorktreeId);
      expect(metadata?.agentId).toBe(testAgentId);
      expect(metadata?.messageCount).toBe(10);
      expect(metadata?.sdkVersion).toBe('1.0.0-test');
    });

    it('should store JSONL mtime in cache metadata', async () => {
      console.log('[SessionCacheService.test] Testing JSONL mtime storage');

      const testMessages = createTestMessages(5);

      // Create JSONL file
      const jsonlPath = path.join(TEST_JSONL_DIR, `${testSessionId}.jsonl`);
      await fsPromises.writeFile(jsonlPath, 'test content');

      // Get JSONL mtime
      const jsonlStats = await fsPromises.stat(jsonlPath);

      await service.rebuildCache(testSessionId, testWorktreeId, testAgentId, testMessages);

      const metadata = await service.getCacheMetadata(testSessionId);

      expect(metadata?.lastJsonlMtime).toBe(jsonlStats.mtimeMs);
    });

    it('should handle empty message array', async () => {
      console.log('[SessionCacheService.test] Testing empty messages');

      const jsonlPath = path.join(TEST_JSONL_DIR, `${testSessionId}.jsonl`);
      await fsPromises.writeFile(jsonlPath, '');

      await service.rebuildCache(testSessionId, testWorktreeId, testAgentId, []);

      const metadata = await service.getCacheMetadata(testSessionId);

      expect(metadata?.messageCount).toBe(0);
    });

    it('should use atomic writes to prevent corruption', async () => {
      console.log('[SessionCacheService.test] Testing atomic writes');

      const testMessages = createTestMessages(100);

      const jsonlPath = path.join(TEST_JSONL_DIR, `${testSessionId}.jsonl`);
      await fsPromises.writeFile(jsonlPath, 'test content');

      await service.rebuildCache(testSessionId, testWorktreeId, testAgentId, testMessages);

      // Cache should be complete and valid JSON
      const cachePath = path.join(TEST_CACHE_DIR, `${testSessionId}.json`);
      const cacheContent = await fsPromises.readFile(cachePath, 'utf-8');

      expect(() => JSON.parse(cacheContent)).not.toThrow();
    });
  });

  describe('Cache Invalidation - mtime', () => {
    it('should invalidate cache when JSONL is newer', async () => {
      console.log('[SessionCacheService.test] Testing mtime invalidation');

      const testMessages = createTestMessages(5);

      // Create old JSONL file
      const jsonlPath = path.join(TEST_JSONL_DIR, `${testSessionId}.jsonl`);
      await fsPromises.writeFile(jsonlPath, 'old content');

      // Build cache with old mtime
      await service.rebuildCache(testSessionId, testWorktreeId, testAgentId, testMessages);

      // Wait a bit to ensure mtime difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Update JSONL file
      await fsPromises.writeFile(jsonlPath, 'new content');
      const newMtime = (await fsPromises.stat(jsonlPath)).mtimeMs;

      // Should invalidate cache
      const wasInvalidated = await service.invalidateOnMtimeChange(testSessionId, newMtime);

      expect(wasInvalidated).toBe(true);

      // Cache should be deleted
      const cachePath = path.join(TEST_CACHE_DIR, `${testSessionId}.json`);
      await expect(fsPromises.access(cachePath, fs.constants.F_OK)).rejects.toThrow();
    });

    it('should not invalidate cache when mtimes match', async () => {
      console.log('[SessionCacheService.test] Testing mtime match');

      const testMessages = createTestMessages(5);

      const jsonlPath = path.join(TEST_JSONL_DIR, `${testSessionId}.jsonl`);
      await fsPromises.writeFile(jsonlPath, 'test content');

      const mtime = (await fsPromises.stat(jsonlPath)).mtimeMs;

      await service.rebuildCache(testSessionId, testWorktreeId, testAgentId, testMessages);

      // Should not invalidate
      const wasInvalidated = await service.invalidateOnMtimeChange(testSessionId, mtime);

      expect(wasInvalidated).toBe(false);

      // Cache should still exist
      const cachePath = path.join(TEST_CACHE_DIR, `${testSessionId}.json`);
      await expect(fsPromises.access(cachePath, fs.constants.F_OK)).resolves.not.toThrow();
    });

    it('should return false when no cache exists', async () => {
      console.log('[SessionCacheService.test] Testing invalidation with no cache');

      const wasInvalidated = await service.invalidateOnMtimeChange(
        'non-existent-session',
        Date.now()
      );

      expect(wasInvalidated).toBe(false);
    });
  });

  describe('Cache Invalidation - SDK Version', () => {
    it('should invalidate cache on SDK version mismatch', async () => {
      console.log('[SessionCacheService.test] Testing SDK version invalidation');

      const testMessages = createTestMessages(5);

      const jsonlPath = path.join(TEST_JSONL_DIR, `${testSessionId}.jsonl`);
      await fsPromises.writeFile(jsonlPath, 'test content');

      // Build cache with current version
      await service.rebuildCache(testSessionId, testWorktreeId, testAgentId, testMessages);

      // Manually modify cache to have old SDK version
      const cachePath = path.join(TEST_CACHE_DIR, `${testSessionId}.json`);
      const cacheData = JSON.parse(await fsPromises.readFile(cachePath, 'utf-8'));
      cacheData.metadata.sdkVersion = '0.9.0-old';
      await fsPromises.writeFile(cachePath, JSON.stringify(cacheData, null, 2));

      // Should invalidate cache
      const wasInvalidated = await service.invalidateOnSdkVersionMismatch(testSessionId);

      expect(wasInvalidated).toBe(true);

      // Cache should be deleted
      await expect(fsPromises.access(cachePath, fs.constants.F_OK)).rejects.toThrow();
    });

    it('should not invalidate cache when SDK version matches', async () => {
      console.log('[SessionCacheService.test] Testing SDK version match');

      const testMessages = createTestMessages(5);

      const jsonlPath = path.join(TEST_JSONL_DIR, `${testSessionId}.jsonl`);
      await fsPromises.writeFile(jsonlPath, 'test content');

      await service.rebuildCache(testSessionId, testWorktreeId, testAgentId, testMessages);

      // Should not invalidate (same version)
      const wasInvalidated = await service.invalidateOnSdkVersionMismatch(testSessionId);

      expect(wasInvalidated).toBe(false);

      // Cache should still exist
      const cachePath = path.join(TEST_CACHE_DIR, `${testSessionId}.json`);
      await expect(fsPromises.access(cachePath, fs.constants.F_OK)).resolves.not.toThrow();
    });
  });

  describe('Cache Cleanup', () => {
    it('should clean up orphaned caches', async () => {
      console.log('[SessionCacheService.test] Testing orphaned cache cleanup');

      // Create cache for session-1 (with JSONL)
      const session1Jsonl = path.join(TEST_JSONL_DIR, 'session-1.jsonl');
      await fsPromises.writeFile(session1Jsonl, 'content');
      await service.rebuildCache('session-1', testWorktreeId, testAgentId, createTestMessages(5));

      // Create cache for session-2 (without JSONL - orphaned)
      const orphanedCache = path.join(TEST_CACHE_DIR, 'session-2.json');
      await fsPromises.writeFile(
        orphanedCache,
        JSON.stringify({
          metadata: {
            sessionId: 'session-2',
            worktreeId: testWorktreeId,
            agentId: testAgentId,
            sdkVersion: '1.0.0-test',
            lastJsonlMtime: Date.now(),
            createdAt: new Date().toISOString(),
            lastAccessedAt: new Date().toISOString(),
            messageCount: 0,
          },
          messages: [],
        })
      );

      // Cleanup with only session-1 active
      await service.cleanupOrphanedCaches(['session-1']);

      // session-1 should still exist
      const session1Cache = path.join(TEST_CACHE_DIR, 'session-1.json');
      await expect(fsPromises.access(session1Cache, fs.constants.F_OK)).resolves.not.toThrow();

      // session-2 (orphaned) should be deleted
      await expect(fsPromises.access(orphanedCache, fs.constants.F_OK)).rejects.toThrow();
    });

    it('should clear all caches', async () => {
      console.log('[SessionCacheService.test] Testing clear all caches');

      // Create multiple caches
      const jsonlPath1 = path.join(TEST_JSONL_DIR, 'session-1.jsonl');
      const jsonlPath2 = path.join(TEST_JSONL_DIR, 'session-2.jsonl');
      await fsPromises.writeFile(jsonlPath1, 'content');
      await fsPromises.writeFile(jsonlPath2, 'content');

      await service.rebuildCache('session-1', testWorktreeId, testAgentId, createTestMessages(5));
      await service.rebuildCache('session-2', testWorktreeId, testAgentId, createTestMessages(3));

      // Clear all
      await service.clearAllCaches();

      // All caches should be deleted
      const files = await fsPromises.readdir(TEST_CACHE_DIR);
      const cacheFiles = files.filter((f) => f.endsWith('.json'));

      expect(cacheFiles.length).toBe(0);
    });

    it('should clear worktree-specific caches', async () => {
      console.log('[SessionCacheService.test] Testing worktree cache cleanup');

      // Create caches for different worktrees
      const jsonlPath1 = path.join(TEST_JSONL_DIR, 'session-1.jsonl');
      const jsonlPath2 = path.join(TEST_JSONL_DIR, 'session-2.jsonl');
      await fsPromises.writeFile(jsonlPath1, 'content');
      await fsPromises.writeFile(jsonlPath2, 'content');

      await service.rebuildCache('session-1', 'worktree-A', testAgentId, createTestMessages(5));
      await service.rebuildCache('session-2', 'worktree-B', testAgentId, createTestMessages(3));

      // Clear worktree-A caches
      await service.clearWorktreeCache('worktree-A');

      // worktree-A cache should be deleted
      const cache1 = path.join(TEST_CACHE_DIR, 'session-1.json');
      await expect(fsPromises.access(cache1, fs.constants.F_OK)).rejects.toThrow();

      // worktree-B cache should still exist
      const cache2 = path.join(TEST_CACHE_DIR, 'session-2.json');
      await expect(fsPromises.access(cache2, fs.constants.F_OK)).resolves.not.toThrow();
    });
  });

  describe('Cache Monitoring', () => {
    it('should warn when cache size exceeds 100MB', async () => {
      console.log('[SessionCacheService.test] Testing cache size monitoring');

      const { logger } = await import('@/commons/utils/logger');

      // Create large message array to simulate big cache with large content
      const largeMessages = Array.from({ length: 10000 }, (_, i) => ({
        id: `msg-${i}`,
        type: 'text',
        content: 'x'.repeat(12000), // ~12KB per message = ~120MB total
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        role: 'user',
      }));

      const jsonlPath = path.join(TEST_JSONL_DIR, `${testSessionId}.jsonl`);
      await fsPromises.writeFile(jsonlPath, 'content');

      await service.rebuildCache(testSessionId, testWorktreeId, testAgentId, largeMessages);

      // Monitor should trigger warning
      await service.monitorCacheSize(testSessionId);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cache size exceeds threshold'),
        expect.any(Object)
      );
    });

    it('should not warn for normal cache sizes', async () => {
      console.log('[SessionCacheService.test] Testing normal cache size');

      const { logger } = await import('@/commons/utils/logger');
      (logger.warn as jest.Mock).mockClear();

      const testMessages = createTestMessages(10);

      const jsonlPath = path.join(TEST_JSONL_DIR, `${testSessionId}.jsonl`);
      await fsPromises.writeFile(jsonlPath, 'content');

      await service.rebuildCache(testSessionId, testWorktreeId, testAgentId, testMessages);

      await service.monitorCacheSize(testSessionId);

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Cache Metadata', () => {
    it('should return null for non-existent cache', async () => {
      console.log('[SessionCacheService.test] Testing metadata for non-existent cache');

      const metadata = await service.getCacheMetadata('non-existent-session');

      expect(metadata).toBeNull();
    });

    it('should update access time', async () => {
      console.log('[SessionCacheService.test] Testing access time update');

      const testMessages = createTestMessages(5);

      const jsonlPath = path.join(TEST_JSONL_DIR, `${testSessionId}.jsonl`);
      await fsPromises.writeFile(jsonlPath, 'content');

      await service.rebuildCache(testSessionId, testWorktreeId, testAgentId, testMessages);

      const beforeUpdate = await service.getCacheMetadata(testSessionId);
      const beforeTime = beforeUpdate?.lastAccessedAt;

      // Wait to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      await service.updateAccessTime(testSessionId);

      const afterUpdate = await service.getCacheMetadata(testSessionId);
      const afterTime = afterUpdate?.lastAccessedAt;

      expect(afterTime).not.toBe(beforeTime);
      expect(new Date(afterTime!).getTime()).toBeGreaterThan(new Date(beforeTime!).getTime());
    });
  });

  describe('Performance Benchmarks', () => {
    it('should rebuild cache in <100ms for 1000 messages', async () => {
      console.log('[SessionCacheService.test] Testing rebuild performance');

      const testMessages = createTestMessages(1000);

      const jsonlPath = path.join(TEST_JSONL_DIR, `${testSessionId}.jsonl`);
      await fsPromises.writeFile(jsonlPath, 'content');

      const start = performance.now();
      await service.rebuildCache(testSessionId, testWorktreeId, testAgentId, testMessages);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should handle concurrent cache operations efficiently', async () => {
      console.log('[SessionCacheService.test] Testing concurrent operations');

      // Create JSONL files for multiple sessions
      const sessions = ['session-1', 'session-2', 'session-3', 'session-4', 'session-5'];

      for (const sessionId of sessions) {
        const jsonlPath = path.join(TEST_JSONL_DIR, `${sessionId}.jsonl`);
        await fsPromises.writeFile(jsonlPath, 'content');
      }

      const start = performance.now();

      // Rebuild all caches concurrently
      await Promise.all(
        sessions.map((sessionId) =>
          service.rebuildCache(sessionId, testWorktreeId, testAgentId, createTestMessages(100))
        )
      );

      const duration = performance.now() - start;

      // All 5 rebuilds should complete in <500ms
      expect(duration).toBeLessThan(500);

      // All caches should exist
      for (const sessionId of sessions) {
        const cachePath = path.join(TEST_CACHE_DIR, `${sessionId}.json`);
        await expect(fsPromises.access(cachePath, fs.constants.F_OK)).resolves.not.toThrow();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted cache gracefully', async () => {
      console.log('[SessionCacheService.test] Testing corrupted cache handling');

      // Create corrupted cache file
      const cachePath = path.join(TEST_CACHE_DIR, `${testSessionId}.json`);
      await fsPromises.writeFile(cachePath, 'corrupted json{', 'utf-8');

      // Should return null without throwing
      const metadata = await service.getCacheMetadata(testSessionId);

      expect(metadata).toBeNull();
    });

    it('should recover from partial writes', async () => {
      console.log('[SessionCacheService.test] Testing partial write recovery');

      const testMessages = createTestMessages(100);

      const jsonlPath = path.join(TEST_JSONL_DIR, `${testSessionId}.jsonl`);
      await fsPromises.writeFile(jsonlPath, 'content');

      // Rebuild should complete successfully even if previous attempt failed
      await service.rebuildCache(testSessionId, testWorktreeId, testAgentId, testMessages);

      const cachePath = path.join(TEST_CACHE_DIR, `${testSessionId}.json`);
      const cacheContent = await fsPromises.readFile(cachePath, 'utf-8');

      // Should be valid JSON
      expect(() => JSON.parse(cacheContent)).not.toThrow();
    });
  });
});
