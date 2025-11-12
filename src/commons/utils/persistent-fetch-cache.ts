/**
 * Persistent Fetch Cache - SQLite-based cache that survives subprocess restarts
 *
 * Features:
 * - SQLite database at ~/.autosteer/cache/fetch-cache.db
 * - Hybrid TTL + LRU pruning strategy
 * - WAL mode for concurrent reads/writes
 * - Automatic pruning on startup, every 100 writes, or on size overflow
 *
 * Usage:
 *   const cache = new PersistentFetchCache({ maxSize: 1000, ttl: 21600000 });
 *   cache.set('key', value);
 *   const value = cache.get('key');
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import Database from 'better-sqlite3';
import { getFetchTraceSettings } from '../../config/settings';

export interface PersistentCacheOptions {
  maxSize?: number;
  ttl?: number;
  cacheDir?: string;
  persistenceEnabled?: boolean;
}

export class PersistentFetchCache {
  private db: Database.Database;
  private readonly maxSize: number;
  private readonly ttl: number;
  private readonly persistenceEnabled: boolean;
  private writeCount = 0;
  private readonly logFile: string;

  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  // Prepared statements for performance
  private getStmt!: Database.Statement;
  private setStmt!: Database.Statement;
  private hasStmt!: Database.Statement;
  private deleteExpiredStmt!: Database.Statement;
  private countStmt!: Database.Statement;
  private evictLRUStmt!: Database.Statement;

  constructor(options: PersistentCacheOptions = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.ttl = options.ttl ?? 21600000; // Default: 6 hours
    this.persistenceEnabled = options.persistenceEnabled ?? true;

    // Setup cache directory and log file
    let dbPath: string;
    if (this.persistenceEnabled) {
      const cacheDir = options.cacheDir ?? path.join(os.homedir(), '.autosteer', 'cache');
      dbPath = path.join(cacheDir, 'fetch-cache.db');

      // Setup log file in sessions directory (same as fetch-tracer)
      const settings = getFetchTraceSettings();
      const logDir = path.join(os.homedir(), '.autosteer', 'sessions');
      const worktreeId = settings.cwd ? path.basename(settings.cwd) : 'autosteer';
      const sessionId = settings.sessionId || 'unknown';
      const timestamp = settings.timestamp || new Date().toISOString().replace(/[:.]/g, '-');
      this.logFile = path.join(logDir, `${worktreeId}-${sessionId}-${timestamp}-fetch-trace.log`);

      // Ensure cache directory exists
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
    } else {
      // Use in-memory database for testing/non-persistent mode
      dbPath = ':memory:';
      this.logFile = '';
    }

    // Open database connection (file or in-memory)
    this.db = new Database(dbPath);

    // Enable WAL mode for concurrent access (only for file-based)
    if (this.persistenceEnabled && dbPath !== ':memory:') {
      this.db.pragma('journal_mode = WAL');
    }

    // Create schema
    this.initializeSchema();

    // Prepare statements
    this.prepareStatements();

    // Clean up expired entries on startup (only relevant for file-based)
    if (this.persistenceEnabled) {
      this.pruneCache();
    }

    // Log cache instance creation
    this.logToFile('info', '[PersistentFetchCache] Cache instance created [v2-RESTART-MODE]', {
      maxSize: this.maxSize,
      ttl: this.ttl,
      persistenceEnabled: this.persistenceEnabled,
      pid: process.pid,
      dbPath,
      walMode: 'RESTART',
      codeVersion: 'v2-cross-process-fix',
    });
  }

  /**
   * Initialize database schema with indexes
   */
  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache_entries (
        key TEXT PRIMARY KEY,
        value BLOB NOT NULL,
        expires_at INTEGER NOT NULL,
        last_accessed_at INTEGER NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      CREATE INDEX IF NOT EXISTS idx_expires_at
        ON cache_entries(expires_at);

      CREATE INDEX IF NOT EXISTS idx_last_accessed_at
        ON cache_entries(last_accessed_at);
    `);
  }

  /**
   * Prepare SQL statements for performance
   */
  private prepareStatements(): void {
    this.getStmt = this.db.prepare(`
      SELECT value, expires_at, last_accessed_at
      FROM cache_entries
      WHERE key = ?
    `);

    this.setStmt = this.db.prepare(`
      INSERT OR REPLACE INTO cache_entries (key, value, expires_at, last_accessed_at)
      VALUES (?, ?, ?, ?)
    `);

    this.hasStmt = this.db.prepare(`
      SELECT 1 FROM cache_entries
      WHERE key = ? AND expires_at > ?
    `);

    this.deleteExpiredStmt = this.db.prepare(`
      DELETE FROM cache_entries
      WHERE expires_at < ?
    `);

    this.countStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM cache_entries
    `);

    this.evictLRUStmt = this.db.prepare(`
      DELETE FROM cache_entries
      WHERE key IN (
        SELECT key FROM cache_entries
        ORDER BY last_accessed_at ASC
        LIMIT ?
      )
    `);
  }

  /**
   * Get value from cache
   * - Returns undefined if not found or expired
   * - Updates lastAccessedAt for LRU
   * - Handles Response object deserialization
   */
  get(key: string): any {
    try {
      const row = this.getStmt.get(key) as
        | { value: Buffer; expires_at: number; last_accessed_at: number }
        | undefined;

      if (!row) {
        this.stats.misses++;
        this.logToFile('debug', '[PersistentFetchCache] SQLite GET - NOT FOUND', {
          key,
          pid: process.pid,
        });
        return undefined;
      }

      // Check if expired
      const now = Date.now();
      if (row.expires_at < now) {
        // Delete expired entry
        this.db.prepare('DELETE FROM cache_entries WHERE key = ?').run(key);
        this.stats.misses++;
        this.logToFile('debug', '[PersistentFetchCache] SQLite GET - EXPIRED', {
          key,
          expiresAt: row.expires_at,
          now,
          pid: process.pid,
        });
        return undefined;
      }

      // Update access time for LRU
      this.db.prepare('UPDATE cache_entries SET last_accessed_at = ? WHERE key = ?').run(now, key);

      this.stats.hits++;
      this.logToFile('debug', '[PersistentFetchCache] SQLite GET - HIT', {
        key,
        valueSize: row.value.length,
        pid: process.pid,
      });

      // Deserialize value from Buffer
      const valueStr = row.value.toString('utf-8');
      const parsed = JSON.parse(valueStr);

      // If it's a serialized Response, deserialize it
      if (parsed && parsed.__isResponse) {
        return this.deserializeResponse(parsed);
      }

      return parsed;
    } catch (error) {
      this.stats.misses++;
      this.logToFile('error', '[PersistentFetchCache] SQLite GET - ERROR', {
        key,
        error: String(error),
      });
      return undefined;
    }
  }

  /**
   * Set value in cache
   * - Triggers pruning every 100 writes or on size overflow
   * - Handles Response object serialization
   */
  async set(key: string, value: any): Promise<void> {
    try {
      const now = Date.now();

      // Check for duplicate writes (key already exists with recent expiration)
      const existingRow = this.getStmt.get(key) as
        | { value: Buffer; expires_at: number; last_accessed_at: number }
        | undefined;
      const isDuplicate = existingRow && Math.abs(existingRow.expires_at - (now + this.ttl)) < 5000; // Within 5 seconds

      // Serialize value to Buffer
      let serializedValue: any;

      // Special handling for Response objects
      if (value instanceof Response) {
        serializedValue = await this.serializeResponse(value);
      } else {
        serializedValue = value;
      }

      const valueStr = JSON.stringify(serializedValue);
      const valueBuffer = Buffer.from(valueStr, 'utf-8');

      const result = this.setStmt.run(key, valueBuffer, now + this.ttl, now);

      // Log successful write to database
      if (this.persistenceEnabled) {
        this.logToFile(isDuplicate ? 'warn' : 'info', '[PersistentFetchCache] SQLite SET', {
          key,
          valueSize: valueBuffer.length,
          expiresAt: now + this.ttl,
          changes: result.changes,
          writeCount: this.writeCount + 1,
          isResponse: value instanceof Response,
          isDuplicate,
          existingExpiresAt: existingRow?.expires_at,
          pid: process.pid,
        });
      }

      // Increment write counter
      this.writeCount++;

      // Check current size
      const currentSize = this.size();

      // Prune if needed (every 100 writes or size overflow)
      if (this.writeCount % 100 === 0 || currentSize > this.maxSize) {
        this.pruneCache();
      }

      // Force WAL checkpoint to ensure writes are visible to other subprocess connections
      // RESTART mode forces readers to pick up new data (more aggressive than PASSIVE)
      if (this.persistenceEnabled) {
        const checkpointStart = Date.now();
        const result = this.db.pragma('wal_checkpoint(RESTART)', { simple: true }) as any;
        const checkpointDuration = Date.now() - checkpointStart;

        // Log checkpoint operation
        this.logToFile(
          'info',
          '[PersistentFetchCache] WAL checkpoint (RESTART) [v2-cross-process-fix]',
          {
            key,
            result,
            durationMs: checkpointDuration,
            writeCount: this.writeCount,
            pid: process.pid,
            mode: 'RESTART',
            codeVersion: 'v2-cross-process-fix',
          }
        );
      }
    } catch (error) {
      // Log error
      this.logToFile('error', '[PersistentFetchCache] SQLite SET failed', {
        key,
        error: String(error),
      });
    }
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    try {
      const now = Date.now();
      const row = this.hasStmt.get(key, now) as { 1: number } | undefined;
      return !!row;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get cache size
   */
  size(): number {
    try {
      const row = this.countStmt.get() as { count: number };
      return row.count;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    try {
      this.db.prepare('DELETE FROM cache_entries').run();
      this.stats = { hits: 0, misses: 0, evictions: 0 };
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      missRate: total > 0 ? this.stats.misses / total : 0,
    };
  }

  /**
   * Hybrid TTL + LRU pruning
   * Step 1: Remove expired entries (TTL)
   * Step 2: If still over maxSize, evict by LRU
   */
  private pruneCache(): void {
    try {
      const now = Date.now();

      // Step 1: Remove expired entries (TTL)
      const expiredResult = this.deleteExpiredStmt.run(now);
      const evictedByTTL = expiredResult.changes;
      this.stats.evictions += evictedByTTL;

      // Step 2: If still over maxSize, apply LRU eviction
      const currentSize = this.size();
      if (currentSize > this.maxSize) {
        const toEvict = currentSize - this.maxSize;
        const lruResult = this.evictLRUStmt.run(toEvict);
        const evictedByLRU = lruResult.changes;
        this.stats.evictions += evictedByLRU;
      }
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Serialize Response object to JSON-compatible format
   */
  private async serializeResponse(response: Response): Promise<any> {
    try {
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      // Read body as ArrayBuffer to handle binary data
      const cloned = response.clone();
      const arrayBuffer = await cloned.arrayBuffer();
      const bodyBase64 = Buffer.from(arrayBuffer).toString('base64');

      return {
        __isResponse: true,
        status: response.status,
        statusText: response.statusText,
        headers,
        body: bodyBase64,
        url: response.url,
      };
    } catch (error) {
      this.logToFile('error', '[PersistentFetchCache] Failed to serialize Response', {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Deserialize JSON-compatible format back to Response object
   */
  private deserializeResponse(data: any): Response {
    try {
      const bodyBuffer = Buffer.from(data.body, 'base64');

      return new Response(bodyBuffer, {
        status: data.status,
        statusText: data.statusText,
        headers: new Headers(data.headers),
      });
    } catch (error) {
      this.logToFile('error', '[PersistentFetchCache] Failed to deserialize Response', {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Log to file (same log file as fetch-tracer)
   */
  private logToFile(level: string, message: string, data?: any): void {
    if (!this.persistenceEnabled || !this.logFile) {
      return;
    }

    try {
      const timestamp = new Date().toISOString();
      const dataStr = data ? ` ${JSON.stringify(data)}` : '';
      const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}\n`;
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      // Silently fail if file write fails
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    try {
      this.db.close();
    } catch (error) {
      // Silently fail
    }
  }
}
