/**
 * Mock for better-sqlite3 for unit tests
 * Provides an in-memory implementation using Map for testing purposes
 */

interface MockRow {
  [key: string]: any;
}

class MockStatement {
  private sql: string;
  private db: MockDatabase;

  constructor(sql: string, db: MockDatabase) {
    this.sql = sql;
    this.db = db;
  }

  run(...params: any[]): { changes: number } {
    // Normalize SQL: trim, lowercase, collapse whitespace
    const sql = this.sql.trim().toLowerCase().replace(/\s+/g, ' ');

    if (sql.startsWith('insert or replace')) {
      // INSERT OR REPLACE INTO cache_entries (key, value, expires_at, last_accessed_at) VALUES (?, ?, ?, ?)
      const [key, value, expiresAt, lastAccessedAt] = params;
      this.db.data.set(key, { value, expires_at: expiresAt, last_accessed_at: lastAccessedAt });
      return { changes: 1 };
    }

    if (sql === 'delete from cache_entries') {
      // DELETE FROM cache_entries (clear all)
      const count = this.db.data.size;
      this.db.data.clear();
      return { changes: count };
    }

    if (sql.startsWith('delete from cache_entries where key =')) {
      // DELETE FROM cache_entries WHERE key = ?
      const [key] = params;
      const existed = this.db.data.has(key);
      this.db.data.delete(key);
      return { changes: existed ? 1 : 0 };
    }

    if (sql.startsWith('delete from cache_entries where expires_at')) {
      // DELETE FROM cache_entries WHERE expires_at < ?
      const [now] = params;
      let deleted = 0;
      for (const [key, row] of this.db.data.entries()) {
        if (row.expires_at < now) {
          this.db.data.delete(key);
          deleted++;
        }
      }
      return { changes: deleted };
    }

    if (sql.includes('delete from cache_entries where key in')) {
      // DELETE FROM cache_entries WHERE key IN (SELECT ... LIMIT ?)
      const [limit] = params;
      const entries = Array.from(this.db.data.entries());
      entries.sort((a, b) => a[1].last_accessed_at - b[1].last_accessed_at);

      let deleted = 0;
      for (let i = 0; i < Math.min(limit, entries.length); i++) {
        this.db.data.delete(entries[i][0]);
        deleted++;
      }
      return { changes: deleted };
    }

    if (sql.startsWith('update cache_entries set last_accessed_at')) {
      // UPDATE cache_entries SET last_accessed_at = ? WHERE key = ?
      let [lastAccessedAt] = params;
      const key = params[1];
      const row = this.db.data.get(key);
      if (row) {
        // Ensure unique timestamps for LRU ordering in tests
        // If new timestamp equals old, increment by 1 to ensure proper ordering
        if (lastAccessedAt <= row.last_accessed_at) {
          lastAccessedAt = row.last_accessed_at + 1;
        }
        row.last_accessed_at = lastAccessedAt;
        return { changes: 1 };
      }
      return { changes: 0 };
    }

    return { changes: 0 };
  }

  get(...params: any[]): MockRow | undefined {
    // Normalize SQL: trim, lowercase, collapse whitespace
    const sql = this.sql.trim().toLowerCase().replace(/\s+/g, ' ');

    if (sql.startsWith('select value, expires_at, last_accessed_at')) {
      // SELECT value, expires_at, last_accessed_at FROM cache_entries WHERE key = ?
      const [key] = params;
      return this.db.data.get(key);
    }

    if (sql.startsWith('select 1 from cache_entries where key')) {
      // SELECT 1 FROM cache_entries WHERE key = ? AND expires_at > ?
      const [key, now] = params;
      const row = this.db.data.get(key);
      if (row && row.expires_at > now) {
        return { 1: 1 };
      }
      return undefined;
    }

    if (sql.startsWith('select count(*)')) {
      // SELECT COUNT(*) as count FROM cache_entries
      return { count: this.db.data.size };
    }

    return undefined;
  }
}

class MockDatabase {
  public data: Map<string, MockRow> = new Map();
  private pragmas: Map<string, any> = new Map();

  constructor(_path: string) {
    // In-memory implementation, ignore path
  }

  exec(_sql: string): void {
    // CREATE TABLE, CREATE INDEX - no-op for mock
  }

  prepare(sql: string): MockStatement {
    return new MockStatement(sql, this);
  }

  pragma(pragma: string): any {
    const [key, value] = pragma.split('=').map((s) => s.trim());
    if (value) {
      this.pragmas.set(key, value);
    }
    return this.pragmas.get(key);
  }

  close(): void {
    this.data.clear();
  }
}

// Export mock as default
export default MockDatabase;

// Export types for compatibility with better-sqlite3 API
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Database {
  export type Database = MockDatabase;
  export type Statement = MockStatement;
}
