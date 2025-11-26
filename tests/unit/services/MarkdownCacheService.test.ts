import { MarkdownCacheService } from '@/renderer/services/MarkdownCacheService';

describe('MarkdownCacheService', () => {
  let service: MarkdownCacheService;

  beforeEach(() => {
    service = MarkdownCacheService.getInstance();
    service.clear();
  });

  afterEach(() => {
    service.clear();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MarkdownCacheService.getInstance();
      const instance2 = MarkdownCacheService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Cache Operations', () => {
    it('should cache markdown content', () => {
      const markdown = '# Hello World\n\nThis is a test.';
      const result = service.parse(markdown);

      expect(result).toBeDefined();
      expect(result).toContain('Hello World');
    });

    it('should return cached result on subsequent calls', () => {
      const markdown = '# Test\n\nContent';
      const result1 = service.parse(markdown);
      const result2 = service.parse(markdown);

      expect(result1).toBe(result2);
    });

    it('should track cache hits', () => {
      const markdown = '# Test';
      service.parse(markdown);
      const statsBefore = service.getStats();

      service.parse(markdown);
      const statsAfter = service.getStats();

      expect(statsAfter.hits).toBe(statsBefore.hits + 1);
    });

    it('should track cache misses', () => {
      const statsBefore = service.getStats();
      service.parse('# New content');
      const statsAfter = service.getStats();

      expect(statsAfter.misses).toBe(statsBefore.misses + 1);
    });

    it('should calculate hit rate correctly', () => {
      service.clear();

      service.parse('# Content 1');
      service.parse('# Content 1');
      service.parse('# Content 2');
      service.parse('# Content 1');

      const stats = service.getStats();
      expect(stats.hitRate).toBeCloseTo(0.5, 1);
    });
  });

  describe('LRU Eviction', () => {
    it('should enforce maximum cache size', () => {
      const maxSize = service.getMaxSize();

      for (let i = 0; i < maxSize + 10; i++) {
        service.parse(`# Content ${i}`);
      }

      const stats = service.getStats();
      expect(stats.size).toBeLessThanOrEqual(maxSize);
    });

    it('should evict least recently used entries', () => {
      const maxSize = service.getMaxSize();

      for (let i = 0; i < maxSize; i++) {
        service.parse(`# Content ${i}`);
      }

      const oldContent = '# Content 0';
      service.parse(oldContent);

      service.parse('# New content that triggers eviction');

      const stats = service.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
    });

    it('should update access time on cache hit', () => {
      service.clear();
      const maxSize = service.getMaxSize();

      const firstContent = '# First';
      service.parse(firstContent);

      for (let i = 0; i < maxSize - 1; i++) {
        service.parse(`# Content ${i}`);
      }

      service.parse(firstContent);

      service.parse('# Trigger eviction');

      const result = service.parse(firstContent);
      expect(result).toBeDefined();
    });
  });

  describe('Cache Management', () => {
    it('should clear all entries', () => {
      service.parse('# Content 1');
      service.parse('# Content 2');
      service.parse('# Content 3');

      service.clear();

      const stats = service.getStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should return current cache size', () => {
      service.clear();

      expect(service.getStats().size).toBe(0);

      service.parse('# Content 1');
      expect(service.getStats().size).toBe(1);

      service.parse('# Content 2');
      expect(service.getStats().size).toBe(2);
    });

    it('should return max size', () => {
      const maxSize = service.getMaxSize();
      expect(maxSize).toBe(500);
    });
  });

  describe('Statistics', () => {
    it('should provide comprehensive statistics', () => {
      service.clear();

      service.parse('# Content 1');
      service.parse('# Content 1');
      service.parse('# Content 2');

      const stats = service.getStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('evictions');
      expect(stats).toHaveProperty('memoryUsageBytes');
    });

    it('should calculate memory usage', () => {
      service.clear();

      service.parse('# Small content');

      const stats = service.getStats();
      expect(stats.memoryUsageBytes).toBeGreaterThan(0);
    });

    it('should track eviction count', () => {
      service.clear();
      const maxSize = service.getMaxSize();

      for (let i = 0; i < maxSize + 5; i++) {
        service.parse(`# Content ${i}`);
      }

      const stats = service.getStats();
      expect(stats.evictions).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string', () => {
      const result = service.parse('');
      expect(result).toBe('');
    });

    it('should handle very long content', () => {
      const longContent = '# Title\n\n' + 'Lorem ipsum dolor sit amet. '.repeat(1000);
      const result = service.parse(longContent);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle special markdown characters', () => {
      const specialContent = '# Hello\n\n**bold** *italic* `code` [link](url)';
      const result = service.parse(specialContent);
      expect(result).toBeDefined();
    });

    it('should handle code blocks', () => {
      const codeContent = '```javascript\nconst x = 1;\n```';
      const result = service.parse(codeContent);
      expect(result).toBeDefined();
    });

    it('should handle unicode content', () => {
      const unicodeContent = '# 你好世界 🚀\n\nTest content';
      const result = service.parse(unicodeContent);
      expect(result).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should parse markdown quickly', () => {
      const content = '# Test\n\nSome content';

      const start = performance.now();
      service.parse(content);
      const end = performance.now();

      expect(end - start).toBeLessThan(50);
    });

    it('should retrieve cached content very quickly', () => {
      const content = '# Test\n\nSome content';
      service.parse(content);

      const start = performance.now();
      service.parse(content);
      const end = performance.now();

      expect(end - start).toBeLessThan(5);
    });
  });

  describe('Warmup', () => {
    it('should warmup cache with array of content', () => {
      service.clear();

      const contents = ['# Content 1', '# Content 2', '# Content 3'];

      service.warmup(contents);

      const stats = service.getStats();
      expect(stats.size).toBe(3);
      expect(stats.misses).toBe(3);
    });

    it('should not duplicate entries during warmup', () => {
      service.clear();

      const contents = ['# Same', '# Same', '# Different'];

      service.warmup(contents);

      const stats = service.getStats();
      expect(stats.size).toBe(2);
    });

    it('should handle empty warmup array', () => {
      service.clear();
      service.warmup([]);

      const stats = service.getStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('List Normalization', () => {
    it('should parse content successfully', () => {
      const content = 'My list:\n1. First\n2. Second';
      const result = service.parse(content);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should cache normalized list content', () => {
      service.clear();

      const content = 'Items:\n- Apple\n- Banana';

      const result1 = service.parse(content);
      const result2 = service.parse(content);

      expect(result1).toBe(result2);

      const stats = service.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should maintain cache performance with varied content', () => {
      service.clear();

      const content1 = 'List:\n1. First\n2. Second';
      const content2 = 'Items:\n- Apple\n- Banana';
      const content3 = 'Steps:\n1. Do this\n2. Then that';

      service.parse(content1);
      service.parse(content1);
      service.parse(content2);
      service.parse(content1);
      service.parse(content3);
      service.parse(content2);

      const stats = service.getStats();
      expect(stats.hitRate).toBeGreaterThan(0.4);
    });
  });
});
