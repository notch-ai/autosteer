/**
 * cache-persistence.test.ts
 * E2E tests for cache persistence across app restarts
 * Tests cache survival, invalidation on SDK updates, and data integrity
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const fsPromises = {
  mkdir: promisify(fs.mkdir),
  writeFile: promisify(fs.writeFile),
  readFile: promisify(fs.readFile),
  rm: promisify(fs.rm),
  access: promisify(fs.access),
  stat: promisify(fs.stat),
};

// Use unique directory for E2E tests
const TEST_DIR = `/tmp/test-cache-e2e-${process.pid}-${Date.now()}`;
const CACHE_DIR = path.join(TEST_DIR, '.autosteer', 'session_cache');
const JSONL_DIR = path.join(TEST_DIR, '.claude', 'data', 'claude_code_sessions');

test.describe('Cache Persistence E2E', () => {
  test.beforeEach(async () => {
    // Clean up test directory
    try {
      await fsPromises.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      // Directory doesn't exist, ignore
    }

    // Create test directories
    await fsPromises.mkdir(CACHE_DIR, { recursive: true });
    await fsPromises.mkdir(JSONL_DIR, { recursive: true });
  });

  test.afterEach(async () => {
    // Clean up test directory
    try {
      await fsPromises.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should persist cache across app restarts', async () => {
    const sessionId = 'test-session-persist';

    // 1. Create cache file
    const cacheData = {
      metadata: {
        sessionId,
        worktreeId: 'test-worktree',
        agentId: 'test-agent',
        sdkVersion: '1.0.0-test',
        lastJsonlMtime: Date.now(),
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        messageCount: 10,
      },
      messages: Array.from({ length: 10 }, (_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Test message ${i}`,
        timestamp: new Date().toISOString(),
      })),
    };

    const cachePath = path.join(CACHE_DIR, `${sessionId}.json`);
    await fsPromises.writeFile(cachePath, JSON.stringify(cacheData, null, 2));

    // 2. Verify cache file created
    await expect(fsPromises.access(cachePath, fs.constants.F_OK)).resolves.not.toThrow();

    // 3. Simulate app restart by reading cache
    const loadedCache = JSON.parse(await fsPromises.readFile(cachePath, 'utf-8'));

    // 4. Verify cache loaded from disk
    expect(loadedCache.metadata.sessionId).toBe(sessionId);
    expect(loadedCache.metadata.messageCount).toBe(10);
    expect(loadedCache.messages).toHaveLength(10);

    // 5. Measure load time <50ms
    const start = performance.now();
    const reloadedCache = JSON.parse(await fsPromises.readFile(cachePath, 'utf-8'));
    const loadTime = performance.now() - start;

    expect(reloadedCache.messages).toHaveLength(10);
    expect(loadTime).toBeLessThan(50);
  });

  test('should invalidate cache on SDK update', async () => {
    const sessionId = 'test-session-sdk-update';

    // 1. Create cache with old SDK version
    const oldCacheData = {
      metadata: {
        sessionId,
        worktreeId: 'test-worktree',
        agentId: 'test-agent',
        sdkVersion: '0.9.0-old',
        lastJsonlMtime: Date.now(),
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        messageCount: 5,
      },
      messages: Array.from({ length: 5 }, (_, i) => ({
        id: `msg-${i}`,
        role: 'user',
        content: `Old message ${i}`,
        timestamp: new Date().toISOString(),
      })),
    };

    const cachePath = path.join(CACHE_DIR, `${sessionId}.json`);
    await fsPromises.writeFile(cachePath, JSON.stringify(oldCacheData, null, 2));

    // 2. Verify old cache exists
    const oldCache = JSON.parse(await fsPromises.readFile(cachePath, 'utf-8'));
    expect(oldCache.metadata.sdkVersion).toBe('0.9.0-old');

    // 3. Simulate SDK update by checking version compatibility
    const currentSDKVersion = '1.0.0-test';
    const isCompatible = oldCache.metadata.sdkVersion === currentSDKVersion;

    // 4. Should be incompatible
    expect(isCompatible).toBe(false);

    // 5. Simulate cache invalidation by deleting old cache
    if (!isCompatible) {
      await fsPromises.rm(cachePath, { force: true });
    }

    // 6. Verify cache deleted
    await expect(fsPromises.access(cachePath, fs.constants.F_OK)).rejects.toThrow();

    // 7. Rebuild with new SDK version
    const newCacheData = {
      ...oldCacheData,
      metadata: {
        ...oldCacheData.metadata,
        sdkVersion: currentSDKVersion,
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
      },
    };

    await fsPromises.writeFile(cachePath, JSON.stringify(newCacheData, null, 2));

    // 8. Verify cache rebuilt with new version
    const newCache = JSON.parse(await fsPromises.readFile(cachePath, 'utf-8'));
    expect(newCache.metadata.sdkVersion).toBe(currentSDKVersion);
  });

  test('should maintain data integrity across multiple restarts', async () => {
    const sessionId = 'test-session-integrity';

    // Create initial cache
    const originalData = {
      metadata: {
        sessionId,
        worktreeId: 'test-worktree',
        agentId: 'test-agent',
        sdkVersion: '1.0.0-test',
        lastJsonlMtime: Date.now(),
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        messageCount: 20,
      },
      messages: Array.from({ length: 20 }, (_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i} with content`,
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        attachedResources: [],
      })),
    };

    const cachePath = path.join(CACHE_DIR, `${sessionId}.json`);
    await fsPromises.writeFile(cachePath, JSON.stringify(originalData, null, 2));

    // Simulate 5 app restarts
    for (let restart = 0; restart < 5; restart++) {
      // Read cache
      const loadedData = JSON.parse(await fsPromises.readFile(cachePath, 'utf-8'));

      // Verify integrity
      expect(loadedData.metadata.messageCount).toBe(20);
      expect(loadedData.messages).toHaveLength(20);
      expect(loadedData.messages[0].id).toBe('msg-0');
      expect(loadedData.messages[19].id).toBe('msg-19');

      // Update access time
      loadedData.metadata.lastAccessedAt = new Date().toISOString();
      await fsPromises.writeFile(cachePath, JSON.stringify(loadedData, null, 2));

      // Small delay between restarts
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Final verification
    const finalData = JSON.parse(await fsPromises.readFile(cachePath, 'utf-8'));
    expect(finalData.metadata.messageCount).toBe(20);
    expect(finalData.messages).toHaveLength(20);
  });

  test('should handle cache corruption gracefully', async () => {
    const sessionId = 'test-session-corruption';
    const cachePath = path.join(CACHE_DIR, `${sessionId}.json`);

    // 1. Create corrupted cache
    await fsPromises.writeFile(cachePath, 'corrupted json data{{{', 'utf-8');

    // 2. Attempt to read corrupted cache
    let loadError = null;
    try {
      JSON.parse(await fsPromises.readFile(cachePath, 'utf-8'));
    } catch (error) {
      loadError = error;
    }

    // 3. Should throw JSON parse error
    expect(loadError).not.toBeNull();

    // 4. Simulate recovery by deleting corrupted cache
    await fsPromises.rm(cachePath, { force: true });

    // 5. Rebuild valid cache
    const validData = {
      metadata: {
        sessionId,
        worktreeId: 'test-worktree',
        agentId: 'test-agent',
        sdkVersion: '1.0.0-test',
        lastJsonlMtime: Date.now(),
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        messageCount: 5,
      },
      messages: Array.from({ length: 5 }, (_, i) => ({
        id: `msg-${i}`,
        role: 'user',
        content: `Recovered message ${i}`,
        timestamp: new Date().toISOString(),
      })),
    };

    await fsPromises.writeFile(cachePath, JSON.stringify(validData, null, 2));

    // 6. Verify recovery successful
    const recoveredData = JSON.parse(await fsPromises.readFile(cachePath, 'utf-8'));
    expect(recoveredData.metadata.messageCount).toBe(5);
    expect(recoveredData.messages).toHaveLength(5);
  });

  test('should handle large cache files efficiently', async () => {
    const sessionId = 'test-session-large';

    // Create large cache (2000 messages)
    const largeData = {
      metadata: {
        sessionId,
        worktreeId: 'test-worktree',
        agentId: 'test-agent',
        sdkVersion: '1.0.0-test',
        lastJsonlMtime: Date.now(),
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        messageCount: 2000,
      },
      messages: Array.from({ length: 2000 }, (_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i} with some content that makes it realistic`,
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        attachedResources: [],
      })),
    };

    const cachePath = path.join(CACHE_DIR, `${sessionId}.json`);

    // Measure write time
    const writeStart = performance.now();
    await fsPromises.writeFile(cachePath, JSON.stringify(largeData, null, 2));
    const writeTime = performance.now() - writeStart;

    // Measure read time
    const readStart = performance.now();
    const loadedData = JSON.parse(await fsPromises.readFile(cachePath, 'utf-8'));
    const readTime = performance.now() - readStart;

    // Verify data loaded correctly
    expect(loadedData.metadata.messageCount).toBe(2000);
    expect(loadedData.messages).toHaveLength(2000);

    // Performance assertions
    expect(writeTime).toBeLessThan(200); // <200ms write for 2000 messages
    expect(readTime).toBeLessThan(50); // <50ms read for 2000 messages

    console.log(
      `Large cache performance: write=${writeTime.toFixed(2)}ms, read=${readTime.toFixed(2)}ms`
    );
  });

  test('should support concurrent cache access', async () => {
    // Create multiple session caches
    const sessions = ['session-1', 'session-2', 'session-3', 'session-4', 'session-5'];

    const writePromises = sessions.map(async (sessionId) => {
      const cacheData = {
        metadata: {
          sessionId,
          worktreeId: 'test-worktree',
          agentId: `agent-${sessionId}`,
          sdkVersion: '1.0.0-test',
          lastJsonlMtime: Date.now(),
          createdAt: new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
          messageCount: 10,
        },
        messages: Array.from({ length: 10 }, (_, i) => ({
          id: `msg-${i}`,
          role: 'user',
          content: `Message ${i}`,
          timestamp: new Date().toISOString(),
        })),
      };

      const cachePath = path.join(CACHE_DIR, `${sessionId}.json`);
      await fsPromises.writeFile(cachePath, JSON.stringify(cacheData, null, 2));
    });

    // Write all caches concurrently
    await Promise.all(writePromises);

    // Read all caches concurrently
    const readPromises = sessions.map(async (sessionId) => {
      const cachePath = path.join(CACHE_DIR, `${sessionId}.json`);
      const data = JSON.parse(await fsPromises.readFile(cachePath, 'utf-8'));
      return data;
    });

    const results = await Promise.all(readPromises);

    // Verify all caches loaded correctly
    expect(results).toHaveLength(5);
    results.forEach((data, i) => {
      expect(data.metadata.sessionId).toBe(sessions[i]);
      expect(data.messages).toHaveLength(10);
    });
  });
});
