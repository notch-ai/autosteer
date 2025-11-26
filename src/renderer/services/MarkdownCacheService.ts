import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { logger } from './LoggerService';

/**
 * Cache entry for parsed markdown
 */
interface CacheEntry {
  content: string;
  parsed: string;
  lastAccessed: number;
  sizeBytes: number;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  memoryUsageBytes: number;
}

/**
 * MarkdownCacheService - Global LRU cache for parsed markdown content
 *
 * Performance optimization service that caches parsed markdown to prevent
 * redundant parsing on every render cycle.
 *
 * Key Features:
 * - LRU eviction with 500 entry limit
 * - Cache warmup on chat load
 * - Memory-efficient string storage
 * - Cache hit rate monitoring
 * - Application logging integration
 *
 * Performance Targets:
 * - Cache hit rate >90% after warmup
 * - 5-10x markdown rendering speedup
 * - <5ms cache lookup time
 * - Memory leak prevention via LRU eviction
 *
 * @see docs/guides-architecture.md Service Layer
 */
export class MarkdownCacheService {
  private static instance: MarkdownCacheService;
  private static readonly MAX_CACHE_SIZE = 500;

  private cache: Map<string, CacheEntry>;
  private hits: number;
  private misses: number;
  private evictions: number;

  private constructor() {
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MarkdownCacheService {
    if (!MarkdownCacheService.instance) {
      MarkdownCacheService.instance = new MarkdownCacheService();
    }
    return MarkdownCacheService.instance;
  }

  /**
   * Get maximum cache size
   */
  getMaxSize(): number {
    return MarkdownCacheService.MAX_CACHE_SIZE;
  }

  /**
   * Parse markdown content with caching
   * @param content Raw markdown string
   * @returns Parsed HTML string
   */
  parse(content: string): string {
    if (content === '') {
      return '';
    }

    const existing = this.cache.get(content);
    if (existing) {
      existing.lastAccessed = Date.now();
      this.hits++;
      return existing.parsed;
    }

    this.misses++;

    const parsed = this.parseMarkdown(content);
    const sizeBytes = content.length + parsed.length;

    if (this.cache.size >= MarkdownCacheService.MAX_CACHE_SIZE) {
      this.evictLRU();
    }

    this.cache.set(content, {
      content,
      parsed,
      lastAccessed: Date.now(),
      sizeBytes,
    });

    return parsed;
  }

  /**
   * Warmup cache with array of markdown content
   * @param contents Array of markdown strings to pre-cache
   */
  warmup(contents: string[]): void {
    logger.info('[MarkdownCacheService] Starting cache warmup', {
      itemCount: contents.length,
    });

    const startTime = Date.now();
    let warmedCount = 0;

    for (const content of contents) {
      if (content && !this.cache.has(content)) {
        this.parse(content);
        warmedCount++;
      }
    }

    const duration = Date.now() - startTime;
    const stats = this.getStats();

    logger.info('[MarkdownCacheService] Cache warmup complete', {
      itemsWarmed: warmedCount,
      totalItems: contents.length,
      durationMs: duration,
      cacheSize: stats.size,
      hitRate: stats.hitRate,
    });
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    let memoryUsageBytes = 0;
    const entries = Array.from(this.cache.values());
    for (const entry of entries) {
      memoryUsageBytes += entry.sizeBytes;
    }

    return {
      size: this.cache.size,
      maxSize: MarkdownCacheService.MAX_CACHE_SIZE,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      evictions: this.evictions,
      memoryUsageBytes,
    };
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Normalize list syntax by ensuring blank lines before list markers
   * ReactMarkdown requires blank lines before lists to parse them correctly
   * @private
   */
  private normalizeListSyntax(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i];
      const prevLine = i > 0 ? lines[i - 1] : '';

      // Check if current line is a list marker (ordered or unordered)
      // Must start at beginning of line (no leading spaces) for top-level lists
      const isTopLevelListMarker = /^(\d+\.|-|\*)\s+\S/.test(currentLine);
      const isPrevLineBlank = prevLine.trim() === '';
      const isPrevLineList = /^(\d+\.|-|\*)\s+\S/.test(prevLine);

      // Insert blank line before top-level list if previous line is not blank and not a list
      if (isTopLevelListMarker && !isPrevLineBlank && !isPrevLineList && i > 0) {
        result.push('');
      }

      result.push(currentLine);
    }

    return result.join('\n');
  }

  /**
   * Parse markdown to HTML string
   * @private
   */
  private parseMarkdown(content: string): string {
    try {
      const normalized = this.normalizeListSyntax(content);
      const element = React.createElement(
        ReactMarkdown,
        {
          remarkPlugins: [remarkGfm, remarkBreaks],
        },
        normalized
      );

      return renderToStaticMarkup(element);
    } catch (error) {
      logger.error('[MarkdownCacheService] Failed to parse markdown', {
        error: String(error),
        contentLength: content.length,
      });
      return content;
    }
  }

  /**
   * Evict least recently used entry
   * @private
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.evictions++;
    }
  }
}
