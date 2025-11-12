/**
 * @jest-environment jsdom
 */
import { FetchCacheService } from '@/services/FetchCacheService';

describe('FetchCacheService', () => {
  describe('Initialization', () => {
    it('should create cache with default options', () => {
      const cache = new FetchCacheService({ persistenceEnabled: false });
      expect(cache).toBeDefined();
    });

    it('should create cache with custom maxSize', () => {
      const cache = new FetchCacheService({ maxSize: 50, persistenceEnabled: false });
      expect(cache).toBeDefined();
    });

    it('should create cache with custom ttl', () => {
      const cache = new FetchCacheService({ ttl: 5000, persistenceEnabled: false });
      expect(cache).toBeDefined();
    });

    it('should create cache with both custom options', () => {
      const cache = new FetchCacheService({ maxSize: 50, ttl: 5000, persistenceEnabled: false });
      expect(cache).toBeDefined();
    });
  });

  describe('Cache Operations', () => {
    let cache: FetchCacheService;

    beforeEach(() => {
      cache = new FetchCacheService({ maxSize: 5, ttl: 1000, persistenceEnabled: false });
    });

    describe('set and get', () => {
      it('should set and retrieve a value', () => {
        cache.set('key1', 'value1');
        expect(cache.get('key1')).toBe('value1');
      });

      it('should return undefined for non-existent key', () => {
        expect(cache.get('non-existent')).toBeUndefined();
      });

      it('should overwrite existing key', () => {
        cache.set('key1', 'value1');
        cache.set('key1', 'value2');
        expect(cache.get('key1')).toBe('value2');
      });

      it('should store complex objects', () => {
        const complexValue = {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: { data: 'test' },
        };
        cache.set('key1', complexValue);
        expect(cache.get('key1')).toEqual(complexValue);
      });

      it('should store arrays', () => {
        const arrayValue = [1, 2, 3, 4, 5];
        cache.set('key1', arrayValue);
        expect(cache.get('key1')).toEqual(arrayValue);
      });
    });

    describe('LRU eviction', () => {
      it('should evict least recently used item when maxSize is exceeded', () => {
        // Fill cache to max capacity
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        cache.set('key3', 'value3');
        cache.set('key4', 'value4');
        cache.set('key5', 'value5');

        // Add one more item - should evict key1 (least recently used)
        cache.set('key6', 'value6');

        expect(cache.get('key1')).toBeUndefined();
        expect(cache.get('key2')).toBe('value2');
        expect(cache.get('key6')).toBe('value6');
      });

      it('should update LRU order on get', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        cache.set('key3', 'value3');
        cache.set('key4', 'value4');
        cache.set('key5', 'value5');

        // Access key1 to make it most recently used
        cache.get('key1');

        // Add one more item - should evict key2 (now least recently used)
        cache.set('key6', 'value6');

        expect(cache.get('key1')).toBe('value1');
        expect(cache.get('key2')).toBeUndefined();
      });
    });

    describe('TTL expiration', () => {
      it('should expire items after TTL', async () => {
        const shortTtlCache = new FetchCacheService({ ttl: 100, persistenceEnabled: false });
        shortTtlCache.set('key1', 'value1');

        // Value should exist immediately
        expect(shortTtlCache.get('key1')).toBe('value1');

        // Wait for TTL to expire
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Value should be expired
        expect(shortTtlCache.get('key1')).toBeUndefined();
      });

      it('should not expire items before TTL', async () => {
        const longTtlCache = new FetchCacheService({ ttl: 1000, persistenceEnabled: false });
        longTtlCache.set('key1', 'value1');

        // Wait a short time (less than TTL)
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Value should still exist
        expect(longTtlCache.get('key1')).toBe('value1');
      });
    });

    describe('clear', () => {
      it('should clear all cached items', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        cache.set('key3', 'value3');

        cache.clear();

        expect(cache.get('key1')).toBeUndefined();
        expect(cache.get('key2')).toBeUndefined();
        expect(cache.get('key3')).toBeUndefined();
      });

      it('should allow setting values after clear', () => {
        cache.set('key1', 'value1');
        cache.clear();
        cache.set('key2', 'value2');

        expect(cache.get('key1')).toBeUndefined();
        expect(cache.get('key2')).toBe('value2');
      });
    });

    describe('has', () => {
      it('should return true for existing key', () => {
        cache.set('key1', 'value1');
        expect(cache.has('key1')).toBe(true);
      });

      it('should return false for non-existent key', () => {
        expect(cache.has('non-existent')).toBe(false);
      });

      it('should return false for expired key', async () => {
        const shortTtlCache = new FetchCacheService({ ttl: 100, persistenceEnabled: false });
        shortTtlCache.set('key1', 'value1');

        expect(shortTtlCache.has('key1')).toBe(true);

        await new Promise((resolve) => setTimeout(resolve, 150));

        expect(shortTtlCache.has('key1')).toBe(false);
      });
    });

    describe('size', () => {
      it('should return 0 for empty cache', () => {
        expect(cache.size()).toBe(0);
      });

      it('should return correct size after adding items', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        cache.set('key3', 'value3');

        expect(cache.size()).toBe(3);
      });

      it('should not exceed maxSize', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        cache.set('key3', 'value3');
        cache.set('key4', 'value4');
        cache.set('key5', 'value5');
        cache.set('key6', 'value6');

        expect(cache.size()).toBe(5);
      });

      it('should return 0 after clear', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        cache.clear();

        expect(cache.size()).toBe(0);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle setting null values', () => {
      const cache = new FetchCacheService({ persistenceEnabled: false });
      cache.set('key1', null);
      expect(cache.get('key1')).toBe(null);
    });

    it('should handle setting undefined values', () => {
      const cache = new FetchCacheService({ persistenceEnabled: false });
      cache.set('key1', undefined);
      expect(cache.get('key1')).toBe(undefined);
    });

    it('should handle empty string keys', () => {
      const cache = new FetchCacheService({ persistenceEnabled: false });
      cache.set('', 'value1');
      expect(cache.get('')).toBe('value1');
    });

    it('should handle very large objects', () => {
      const cache = new FetchCacheService({ persistenceEnabled: false });
      const largeObject = {
        data: new Array(1000).fill(0).map((_, i) => ({ id: i, value: `item-${i}` })),
      };
      cache.set('large', largeObject);
      expect(cache.get('large')).toEqual(largeObject);
    });

    it('should handle maxSize of 1', () => {
      const cache = new FetchCacheService({ maxSize: 1, persistenceEnabled: false });
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
      expect(cache.size()).toBe(1);
    });
  });

  describe('Hash & URL Filtering (Work Package 2)', () => {
    let cache: FetchCacheService;

    beforeEach(() => {
      cache = new FetchCacheService({ maxSize: 10, ttl: 60000, persistenceEnabled: false });
      jest.clearAllMocks();
    });

    describe('generateCacheKey', () => {
      it('should generate consistent SHA-256 hash for same inputs', () => {
        const key1 = cache.generateCacheKey('GET', 'https://api.example.com/users', undefined);
        const key2 = cache.generateCacheKey('GET', 'https://api.example.com/users', undefined);

        expect(key1).toBe(key2);
        expect(key1).toMatch(/^[a-f0-9]{64}$/);
      });

      it('should generate different hashes for different methods', () => {
        const getKey = cache.generateCacheKey('GET', 'https://api.example.com/users', undefined);
        const postKey = cache.generateCacheKey('POST', 'https://api.example.com/users', undefined);

        expect(getKey).not.toBe(postKey);
      });

      it('should generate different hashes for different URLs', () => {
        const key1 = cache.generateCacheKey('GET', 'https://api.example.com/users', undefined);
        const key2 = cache.generateCacheKey('GET', 'https://api.example.com/posts', undefined);

        expect(key1).not.toBe(key2);
      });

      it('should include sorted JSON body in hash', () => {
        const body1 = { b: 2, a: 1 };
        const body2 = { a: 1, b: 2 };

        const key1 = cache.generateCacheKey('POST', 'https://api.example.com/users', body1);
        const key2 = cache.generateCacheKey('POST', 'https://api.example.com/users', body2);

        expect(key1).toBe(key2);
      });

      it('should generate different hashes for different bodies', () => {
        const body1 = { a: 1, b: 2 };
        const body2 = { a: 1, b: 3 };

        const key1 = cache.generateCacheKey('POST', 'https://api.example.com/users', body1);
        const key2 = cache.generateCacheKey('POST', 'https://api.example.com/users', body2);

        expect(key1).not.toBe(key2);
      });

      it('should handle null body', () => {
        const key = cache.generateCacheKey('GET', 'https://api.example.com/users', null);
        expect(key).toMatch(/^[a-f0-9]{64}$/);
      });

      it('should handle undefined body', () => {
        const key = cache.generateCacheKey('GET', 'https://api.example.com/users', undefined);
        expect(key).toMatch(/^[a-f0-9]{64}$/);
      });
    });

    describe('normalizeUrl', () => {
      it('should sort query parameters', () => {
        const url = 'https://api.example.com/users?z=1&a=2&m=3';
        const normalized = cache.normalizeUrl(url);

        expect(normalized).toBe('https://api.example.com/users?a=2&m=3&z=1');
      });

      it('should handle URL without query parameters', () => {
        const url = 'https://api.example.com/users';
        const normalized = cache.normalizeUrl(url);

        expect(normalized).toBe(url);
      });

      it('should preserve URL structure', () => {
        const url = 'https://api.example.com:8080/path/to/resource?b=2&a=1';
        const normalized = cache.normalizeUrl(url);

        expect(normalized).toBe('https://api.example.com:8080/path/to/resource?a=1&b=2');
      });

      it('should handle empty query parameter values', () => {
        const url = 'https://api.example.com/users?key=';
        const normalized = cache.normalizeUrl(url);

        expect(normalized).toBe('https://api.example.com/users?key=');
      });

      it('should handle multiple identical query parameters', () => {
        const url = 'https://api.example.com/users?tag=a&tag=b&tag=c';
        const normalized = cache.normalizeUrl(url);

        expect(normalized).toContain('tag=');
      });
    });

    describe('matchesIncludeFilter', () => {
      it('should match exact domain', () => {
        const result = cache.matchesIncludeFilter('https://anthropic.com/api/v1', [
          'anthropic.com',
        ]);
        expect(result).toBe(true);
      });

      it('should match subdomain with substring', () => {
        const result = cache.matchesIncludeFilter('https://api.anthropic.com/v1/messages', [
          'anthropic.com',
        ]);
        expect(result).toBe(true);
      });

      it('should match partial path', () => {
        const result = cache.matchesIncludeFilter('https://api.example.com/v1/users/123', [
          'v1/users',
        ]);
        expect(result).toBe(true);
      });

      it('should not match unrelated URL', () => {
        const result = cache.matchesIncludeFilter('https://example.com/api', [
          'anthropic.com',
          'openai.com',
        ]);
        expect(result).toBe(false);
      });

      it('should return true if any pattern matches', () => {
        const result = cache.matchesIncludeFilter('https://api.anthropic.com/v1/messages', [
          'openai.com',
          'anthropic.com',
          'google.com',
        ]);
        expect(result).toBe(true);
      });

      it('should return true for empty include patterns', () => {
        const result = cache.matchesIncludeFilter('https://any-url.com', []);
        expect(result).toBe(true);
      });

      it('should be case-sensitive', () => {
        const result = cache.matchesIncludeFilter('https://Anthropic.com/api', ['anthropic.com']);
        expect(result).toBe(false);
      });

      it('should handle URL with query parameters', () => {
        const result = cache.matchesIncludeFilter('https://api.anthropic.com/v1?key=value', [
          'anthropic.com',
        ]);
        expect(result).toBe(true);
      });
    });

    describe('matchesExcludeFilter', () => {
      it('should exclude exact domain', () => {
        const result = cache.matchesExcludeFilter('https://ads.example.com/api/v1', [
          'ads.example.com',
        ]);
        expect(result).toBe(true);
      });

      it('should exclude partial path', () => {
        const result = cache.matchesExcludeFilter('https://api.example.com/auth/login', ['/auth/']);
        expect(result).toBe(true);
      });

      it('should not exclude unrelated URL', () => {
        const result = cache.matchesExcludeFilter('https://api.example.com/users', [
          '/auth/',
          '/login',
        ]);
        expect(result).toBe(false);
      });

      it('should return true if any pattern matches', () => {
        const result = cache.matchesExcludeFilter('https://api.example.com/stream/events', [
          '/auth/',
          '/stream',
          '/admin',
        ]);
        expect(result).toBe(true);
      });

      it('should return false for empty exclude patterns', () => {
        const result = cache.matchesExcludeFilter('https://any-url.com', []);
        expect(result).toBe(false);
      });

      it('should be case-sensitive', () => {
        const result = cache.matchesExcludeFilter('https://api.example.com/Auth', ['/auth/']);
        expect(result).toBe(false);
      });

      it('should handle URL with query parameters', () => {
        const result = cache.matchesExcludeFilter('https://api.example.com/auth/login?redirect=/', [
          '/auth/',
        ]);
        expect(result).toBe(true);
      });

      it('should exclude streaming endpoints', () => {
        const result = cache.matchesExcludeFilter('https://api.example.com/v1/stream', [
          '/stream',
          '/sse',
        ]);
        expect(result).toBe(true);
      });
    });

    describe('CacheStats', () => {
      it('should initialize stats with zeros', () => {
        const stats = cache.getStats();

        expect(stats).toEqual({
          hits: 0,
          misses: 0,
          evictions: 0,
          hitRate: 0,
          missRate: 0,
        });
      });

      it('should track cache hits', () => {
        const key = 'test-key';
        cache.set(key, { data: 'test' });
        cache.get(key);
        cache.get(key);

        const stats = cache.getStats();
        expect(stats.hits).toBe(2);
        expect(stats.misses).toBe(0);
        expect(stats.hitRate).toBe(1);
      });

      it('should track cache misses', () => {
        cache.get('non-existent-key');
        cache.get('another-missing-key');

        const stats = cache.getStats();
        expect(stats.hits).toBe(0);
        expect(stats.misses).toBe(2);
        expect(stats.hitRate).toBe(0);
      });

      it('should calculate hit rate correctly', () => {
        const key1 = 'key1';
        const key2 = 'key2';

        cache.set(key1, { data: 'test1' });
        cache.get(key1);
        cache.get(key2);
        cache.get(key1);
        cache.get(key2);

        const stats = cache.getStats();
        expect(stats.hits).toBe(2);
        expect(stats.misses).toBe(2);
        expect(stats.hitRate).toBe(0.5);
      });

      it('should track evictions when cache is full', () => {
        const smallCache = new FetchCacheService({
          maxSize: 2,
          ttl: 60000,
          persistenceEnabled: false,
        });

        smallCache.set('key1', { data: 'test1' });
        smallCache.set('key2', { data: 'test2' });
        smallCache.set('key3', { data: 'test3' });

        const stats = smallCache.getStats();
        expect(stats.evictions).toBe(1);
      });

      it('should handle division by zero for hit rate', () => {
        const stats = cache.getStats();
        expect(stats.hitRate).toBe(0);
      });
    });

    // Note: FetchCacheService no longer logs directly - logging is handled by fetch-interceptor
    // to avoid corrupting SDK JSON protocol in subprocess

    describe('Integration - Hash + Filter', () => {
      it('should use generated cache key with filtering', () => {
        const url = 'https://api.anthropic.com/v1/messages';
        const body = { model: 'claude-3', messages: [] };

        const cacheKey = cache.generateCacheKey('POST', url, body);
        const matches = cache.matchesIncludeFilter(url, ['anthropic.com']);

        expect(matches).toBe(true);
        expect(cacheKey).toMatch(/^[a-f0-9]{64}$/);
      });

      it('should normalize URL before generating cache key', () => {
        const url1 = 'https://api.example.com/users?b=2&a=1';
        const url2 = 'https://api.example.com/users?a=1&b=2';

        const normalized1 = cache.normalizeUrl(url1);
        const normalized2 = cache.normalizeUrl(url2);

        const key1 = cache.generateCacheKey('GET', normalized1, undefined);
        const key2 = cache.generateCacheKey('GET', normalized2, undefined);

        expect(key1).toBe(key2);
      });
    });

    describe('Metadata Methods (getWithMetadata / setWithMetadata)', () => {
      it('should cache and retrieve values with metadata', () => {
        const method = 'POST';
        const url = 'https://api.example.com/users';
        const body = { name: 'John', age: 30 };
        const value = { status: 200, data: 'response' };

        cache.setWithMetadata(method, url, body, value);
        const result = cache.getWithMetadata(method, url, body);

        expect(result).toEqual(value);
      });

      it('should return undefined on cache miss with metadata', () => {
        const method = 'GET';
        const url = 'https://api.example.com/posts/123';
        const body = undefined;

        const result = cache.getWithMetadata(method, url, body);

        expect(result).toBeUndefined();
      });

      it('should handle null body in metadata methods', () => {
        const method = 'GET';
        const url = 'https://api.example.com/null-body';
        const body = null;
        const value = { status: 200 };

        cache.setWithMetadata(method, url, body, value);
        const result = cache.getWithMetadata(method, url, body);

        expect(result).toEqual(value);
      });

      it('should normalize URL in metadata methods', () => {
        const method = 'GET';
        const url1 = 'https://api.example.com/users?z=3&a=1';
        const url2 = 'https://api.example.com/users?a=1&z=3';
        const value = { status: 200 };

        cache.setWithMetadata(method, url1, undefined, value);
        const result = cache.getWithMetadata(method, url2, undefined);

        expect(result).toEqual(value);
      });

      it('should update stats correctly with metadata methods', () => {
        const method = 'POST';
        const url = 'https://api.example.com/stats';
        const body = { test: true };
        const value = { status: 200 };

        cache.setWithMetadata(method, url, body, value);
        cache.getWithMetadata(method, url, body); // HIT
        cache.getWithMetadata(method, url, { different: true }); // MISS

        const stats = cache.getStats();
        expect(stats.hits).toBe(1);
        expect(stats.misses).toBe(1);
        expect(stats.hitRate).toBe(0.5);
      });
    });
  });
});
