import { createHash } from 'crypto';
import { PersistentFetchCache } from '../commons/utils/persistent-fetch-cache';

export interface FetchCacheOptions {
  maxSize?: number;
  ttl?: number;
  persistenceEnabled?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
  missRate: number;
}

export class FetchCacheService {
  private cache: PersistentFetchCache;
  private readonly maxSize: number;
  private readonly ttl: number;

  constructor(options: FetchCacheOptions = {}) {
    this.maxSize = options.maxSize ?? 100;
    this.ttl = options.ttl ?? 300000; // Default 5 minutes

    // Use persistent cache as backend
    this.cache = new PersistentFetchCache({
      maxSize: this.maxSize,
      ttl: this.ttl,
      persistenceEnabled: options.persistenceEnabled ?? true,
    });

    // Note: No logging here - FetchCacheService runs in SDK subprocess where console output corrupts JSON protocol
    // Logging is handled by fetch-interceptor using file-based logging
  }

  get(key: string): any {
    return this.cache.get(key);
  }

  getWithMetadata(method: string, url: string, body?: any): any {
    const normalizedUrl = this.normalizeUrl(url);
    const key = this.generateCacheKey(method, normalizedUrl, body);
    return this.cache.get(key);
  }

  async set(key: string, value: any): Promise<void> {
    await this.cache.set(key, value);
  }

  async setWithMetadata(method: string, url: string, body: any, value: any): Promise<void> {
    const normalizedUrl = this.normalizeUrl(url);
    const key = this.generateCacheKey(method, normalizedUrl, body);
    await this.cache.set(key, value);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
    // Note: No logging here - FetchCacheService runs in SDK subprocess where console output corrupts JSON protocol
  }

  size(): number {
    return this.cache.size();
  }

  generateCacheKey(method: string, url: string, body?: any): string {
    const bodyString = body != null ? JSON.stringify(this.sortObject(body)) : '';
    const input = `${method}:${url}:${bodyString}`;
    return createHash('sha256').update(input).digest('hex');
  }

  normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.search);
      const sortedParams = new URLSearchParams(
        Array.from(params.entries()).sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      );

      urlObj.search = sortedParams.toString();
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  matchesIncludeFilter(url: string, includePatterns: string[]): boolean {
    if (includePatterns.length === 0) {
      return true;
    }

    return includePatterns.some((pattern) => {
      try {
        const regex = new RegExp(pattern);
        return regex.test(url);
      } catch {
        // Fallback to substring match if invalid regex
        return url.includes(pattern);
      }
    });
  }

  matchesExcludeFilter(url: string, excludePatterns: string[]): boolean {
    if (excludePatterns.length === 0) {
      return false;
    }

    return excludePatterns.some((pattern) => {
      try {
        const regex = new RegExp(pattern);
        return regex.test(url);
      } catch {
        // Fallback to substring match if invalid regex
        return url.includes(pattern);
      }
    });
  }

  getStats(): CacheStats {
    return this.cache.getStats();
  }

  private sortObject(obj: any): any {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
      return obj;
    }

    const sorted: any = {};
    Object.keys(obj)
      .sort()
      .forEach((key) => {
        sorted[key] = this.sortObject(obj[key]);
      });

    return sorted;
  }
}
