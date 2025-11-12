/**
 * Cache type definitions for Smart Session Cache System
 *
 * These types define the structure of cached session data, metadata,
 * and the cache index for the desktop app.
 */

/**
 * Metadata about a cached session
 */
export interface CacheMetadata {
  /**
   * Version of the Anthropic SDK used when cache was created
   * Format: semver string (e.g., "0.65.0")
   */
  sdkVersion: string;

  /**
   * Modification time of the JSONL file (Unix timestamp in milliseconds)
   * Used to detect if the source file has changed
   */
  mtime: number;

  /**
   * Timestamp when the cache was created (Unix timestamp in milliseconds)
   */
  cachedAt: number;

  /**
   * Total number of messages in the cached session
   */
  messageCount: number;
}

/**
 * Cached session data structure
 */
export interface SessionCache {
  /**
   * Unique identifier for the session
   */
  sessionId: string;

  /**
   * Worktree ID this session belongs to
   */
  worktreeId: string;

  /**
   * Agent ID associated with this session
   */
  agentId: string;

  /**
   * Cache metadata for validation
   */
  metadata: CacheMetadata;

  /**
   * Cached messages indexed by ISO date strings (YYYY-MM-DD)
   * Each key contains an array of messages for that day
   * This structure optimizes for date-based queries
   */
  messages: Record<string, any[]>;
}

/**
 * Cache index structure for tracking all cached sessions
 */
export interface CacheIndex {
  /**
   * Cache format version for future compatibility
   * Current version: "1.0.0"
   */
  version: string;

  /**
   * Map of session IDs to their metadata
   * Used for quick cache validation without loading full cache
   */
  sessions: Record<string, CacheMetadata>;
}
