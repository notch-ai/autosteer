import { app } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { logger } from '@/commons/utils/logger';

const fsPromises = {
  mkdir: promisify(fs.mkdir),
  appendFile: promisify(fs.appendFile),
  writeFile: promisify(fs.writeFile),
  unlink: promisify(fs.unlink),
  stat: promisify(fs.stat),
  readdir: promisify(fs.readdir),
  rename: promisify(fs.rename),
  access: promisify(fs.access),
};

// 100MB rotation limit
const ROTATION_SIZE_LIMIT = 100 * 1024 * 1024;

interface TraceLogEntry {
  timestamp: string;
  sessionId: string;
  direction: 'to-claude' | 'from-claude';
  rawMessage: unknown;
  sdkVersion: string;
  correlationId: string;
  sequenceNumber: number;
  messageType?: string; // Pydantic message type (e.g., 'system', 'user', 'assistant', 'tool', 'result', 'error', 'stream_event')
  messageSubtype?: string; // Pydantic message subtype if applicable (e.g., 'init', 'compact_boundary' for system messages)
}

/**
 * TraceLogger - SDK message trace logging service
 *
 * Features:
 * - Async JSONL append for high performance
 * - Correlation ID tracking for request/response pairing
 * - Sequence number tracking per session
 * - Automatic file rotation at 100MB limit
 * - Session-based cleanup integration
 * - Pydantic message type tracking for debugging
 *
 * Trace file location: ~/.autosteer/traces/{sessionId}.trace.jsonl
 *
 * @example
 * ```typescript
 * const tracer = TraceLogger.getInstance();
 * await tracer.log(sessionId, 'to-claude', message, correlationId);
 * await tracer.deleteTraceFile(sessionId);
 * ```
 */
export class TraceLogger {
  private static instance: TraceLogger;
  private tracesDir: string;
  private sequenceCounters: Map<string, number> = new Map();
  private pendingWrites: Map<string, Promise<void>> = new Map();

  private constructor() {
    // Use app.getPath if available (production), otherwise use fallback for tests
    const homeDir = app?.getPath ? app.getPath('home') : os.homedir();
    this.tracesDir = path.join(homeDir, '.autosteer', 'traces');
    void this.ensureTracesDirectory();
  }

  static getInstance(): TraceLogger {
    if (!TraceLogger.instance) {
      TraceLogger.instance = new TraceLogger();
    }
    return TraceLogger.instance;
  }

  /**
   * Ensure the traces directory exists
   */
  private async ensureTracesDirectory(): Promise<void> {
    try {
      await fsPromises.mkdir(this.tracesDir, { recursive: true });
    } catch (error) {
      logger.error('[TraceLogger] Failed to create traces directory:', error);
    }
  }

  /**
   * Get trace file path for a session
   */
  private getTraceFilePath(sessionId: string): string {
    return path.join(this.tracesDir, `${sessionId}.trace.jsonl`);
  }

  /**
   * Get next sequence number for a session
   */
  private getNextSequenceNumber(sessionId: string): number {
    const current = this.sequenceCounters.get(sessionId) || 0;
    const next = current + 1;
    this.sequenceCounters.set(sessionId, next);
    return next;
  }

  /**
   * Reset sequence counter for a session (primarily for testing)
   */
  resetSequenceCounter(sessionId: string): void {
    this.sequenceCounters.delete(sessionId);
  }

  /**
   * Reset all sequence counters (primarily for testing)
   */
  resetAllSequenceCounters(): void {
    this.sequenceCounters.clear();
  }

  /**
   * Reset singleton instance (primarily for testing)
   * This ensures complete test isolation by clearing all state
   */
  static resetInstance(): void {
    TraceLogger.instance = null as unknown as TraceLogger;
  }

  /**
   * Check if file needs rotation and rotate if necessary
   */
  private async checkAndRotate(sessionId: string, filePath: string): Promise<void> {
    try {
      const stats = await fsPromises.stat(filePath);

      if (stats.size >= ROTATION_SIZE_LIMIT) {
        const timestamp = Date.now();
        const rotatedPath = `${filePath}.rotated.${timestamp}`;

        logger.info('[TraceLogger] Rotating trace file', {
          sessionId,
          currentSize: stats.size,
          rotatedPath,
        });

        await fsPromises.rename(filePath, rotatedPath);

        logger.debug('[TraceLogger] Trace file rotated successfully', {
          sessionId,
          rotatedPath,
        });
      }
    } catch (error: unknown) {
      // File doesn't exist yet, no rotation needed
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error('[TraceLogger] Failed to check/rotate trace file:', {
          sessionId,
          error: String(error),
        });
      }
    }
  }

  /**
   * Log SDK message to trace file
   *
   * @param sessionId - Session identifier
   * @param direction - Message direction (to-claude or from-claude)
   * @param rawMessage - Raw SDK message object
   * @param correlationId - Correlation ID for request/response pairing
   */
  async log(
    sessionId: string,
    direction: 'to-claude' | 'from-claude',
    rawMessage: unknown,
    correlationId: string
  ): Promise<void> {
    // Ensure directory exists
    await this.ensureTracesDirectory();

    const filePath = this.getTraceFilePath(sessionId);

    // Check if rotation is needed before writing
    await this.checkAndRotate(sessionId, filePath);

    // Get SDK version from package.json
    const sdkVersion = this.getSdkVersion();

    // Extract Pydantic message type information
    const { type: messageType, subtype: messageSubtype } = this.extractMessageType(rawMessage);

    // Create trace log entry (conditionally add optional fields)
    const entry: TraceLogEntry = {
      timestamp: new Date().toISOString(),
      sessionId,
      direction,
      rawMessage,
      sdkVersion,
      correlationId,
      sequenceNumber: this.getNextSequenceNumber(sessionId),
      ...(messageType && { messageType }),
      ...(messageSubtype && { messageSubtype }),
    };

    // Serialize to JSONL format (one JSON object per line)
    const logLine = JSON.stringify(entry) + '\n';

    // Async append to file
    const writePromise = this.appendToFile(sessionId, filePath, logLine);

    // Store pending write promise for cleanup coordination
    this.pendingWrites.set(sessionId, writePromise);

    // Await write to ensure proper ordering
    try {
      await writePromise;
      logger.debug('[TraceLogger] Logged trace entry', {
        sessionId,
        direction,
        correlationId,
        sequenceNumber: entry.sequenceNumber,
      });
    } catch (error) {
      logger.error('[TraceLogger] Failed to write trace entry:', {
        sessionId,
        direction,
        correlationId,
        error: String(error),
      });
    } finally {
      // Clean up pending write
      if (this.pendingWrites.get(sessionId) === writePromise) {
        this.pendingWrites.delete(sessionId);
      }
    }
  }

  /**
   * Append log line to file with error handling
   */
  private async appendToFile(sessionId: string, filePath: string, logLine: string): Promise<void> {
    try {
      await fsPromises.appendFile(filePath, logLine, 'utf-8');
    } catch (error) {
      logger.error('[TraceLogger] Failed to append to trace file:', {
        sessionId,
        filePath,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get SDK version from package.json or environment
   */
  private getSdkVersion(): string {
    try {
      // Try to get version from @anthropic-ai/claude-agent-sdk package
      // This is a best-effort approach
      return process.env.CLAUDE_SDK_VERSION || 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Extract Pydantic message type and subtype from raw message
   */
  private extractMessageType(rawMessage: unknown): { type?: string; subtype?: string } {
    const result: { type?: string; subtype?: string } = {};

    try {
      if (typeof rawMessage === 'object' && rawMessage !== null) {
        const msg = rawMessage as Record<string, unknown>;
        if (typeof msg.type === 'string') {
          result.type = msg.type;
        }
        if (typeof msg.subtype === 'string') {
          result.subtype = msg.subtype;
        }
      }
    } catch (error) {
      // Ignore extraction errors - message type is optional debug info
    }

    return result;
  }

  /**
   * Delete trace file and all rotated files for a session
   *
   * @param sessionId - Session identifier
   */
  async deleteTraceFile(sessionId: string): Promise<void> {
    try {
      // Wait for any pending writes to complete
      const pendingWrite = this.pendingWrites.get(sessionId);
      if (pendingWrite) {
        await pendingWrite.catch(() => {
          // Ignore write errors during cleanup
        });
      }

      const filePath = this.getTraceFilePath(sessionId);

      // Delete main trace file
      try {
        await fsPromises.unlink(filePath);
        logger.debug('[TraceLogger] Deleted trace file', { sessionId, filePath });
      } catch (error: unknown) {
        // File doesn't exist, ignore
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          logger.warn('[TraceLogger] Failed to delete trace file:', {
            sessionId,
            filePath,
            error: String(error),
          });
        }
      }

      // Delete all rotated files for this session
      try {
        const files = await fsPromises.readdir(this.tracesDir);
        const rotatedFiles = files.filter((f) => f.startsWith(`${sessionId}.trace.jsonl.rotated.`));

        for (const rotatedFile of rotatedFiles) {
          const rotatedPath = path.join(this.tracesDir, rotatedFile);
          try {
            await fsPromises.unlink(rotatedPath);
            logger.debug('[TraceLogger] Deleted rotated trace file', {
              sessionId,
              rotatedPath,
            });
          } catch (error) {
            logger.warn('[TraceLogger] Failed to delete rotated trace file:', {
              sessionId,
              rotatedPath,
              error: String(error),
            });
          }
        }
      } catch (error) {
        logger.warn('[TraceLogger] Failed to read traces directory:', {
          sessionId,
          error: String(error),
        });
      }

      // Clean up sequence counter
      this.sequenceCounters.delete(sessionId);

      logger.info('[TraceLogger] Cleaned up trace files for session', { sessionId });
    } catch (error) {
      logger.error('[TraceLogger] Failed to delete trace file:', {
        sessionId,
        error: String(error),
      });
      // Don't throw - cleanup should be best-effort
    }
  }

  /**
   * Delete all trace files for multiple sessions
   * Used for project deletion cleanup
   *
   * @param sessionIds - Array of session identifiers
   */
  async deleteTraceFiles(sessionIds: string[]): Promise<void> {
    logger.info('[TraceLogger] Deleting trace files for sessions', {
      count: sessionIds.length,
    });

    // Delete all trace files in parallel
    await Promise.all(sessionIds.map((sessionId) => this.deleteTraceFile(sessionId)));

    logger.info('[TraceLogger] Completed trace files cleanup', {
      count: sessionIds.length,
    });
  }
}
