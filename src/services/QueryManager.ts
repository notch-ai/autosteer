import type {
  QueryManagerOptions,
  QueryManagerStats,
  SessionMetrics,
  VirtualSession,
} from '@/types/query-manager.types';
import { query, type Options, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { EventEmitter } from 'node:events';
import log from 'electron-log';
import { nanoid } from 'nanoid';

const DEFAULT_MAX_SESSIONS = 10;
const DEFAULT_SESSION_IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const DEFAULT_MCP_TIMEOUT = 5000; // 5 seconds

/**
 * QueryManager - Manages SDK queries with session abstraction
 *
 * CURRENT LIMITATION (SDK Architecture):
 * Due to SDK constraints, each message creates a new Agent instance and sends
 * an init message, recreating the prompt cache (~28K tokens per message).
 *
 * This is a KNOWN LIMITATION of the current SDK design. The architecture is
 * kept simple and ready for future upgrade when SDK adds proper session
 * management (AsyncIterable prompt support).
 *
 * Performance Impact:
 * - Message 1: init sent, cache created (28K tokens)
 * - Message 2+: init sent, cache created (28K tokens) ← unavoidable with current SDK
 *
 * TODO: When SDK adds proper session management:
 * - Expected performance: 60% faster, no cache recreation
 *
 */
export class QueryManager extends EventEmitter {
  private readonly projectId: string;
  private readonly projectPath: string;
  private readonly options: Required<QueryManagerOptions>;

  private virtualSessions: Map<string, VirtualSession> = new Map();
  private sessionMetrics: Map<string, SessionMetrics> = new Map();
  private sdkSessionIds: Map<string, string> = new Map(); // virtual sessionId → SDK session_id

  constructor(projectId: string, projectPath: string, options: QueryManagerOptions = {}) {
    super();
    this.projectId = projectId;
    this.projectPath = projectPath;
    this.options = {
      maxSessions: options.maxSessions ?? DEFAULT_MAX_SESSIONS,
      sessionIdleTimeout: options.sessionIdleTimeout ?? DEFAULT_SESSION_IDLE_TIMEOUT,
      mcpTimeout: options.mcpTimeout ?? DEFAULT_MCP_TIMEOUT,
    };

    log.info('[QueryManager] 🚀 Created manager for project', {
      projectId: this.projectId,
      projectPath: this.projectPath,
      maxSessions: this.options.maxSessions,
    });
  }

  /**
   * Get or create a virtual session
   *
   * Sessions are lightweight - just metadata tracking.
   * The actual SDK session (Agent instance) is created per-message.
   */
  async getOrCreateSession(agentId: string, sessionId: string): Promise<string> {
    // Check session limit
    if (
      !this.virtualSessions.has(sessionId) &&
      this.virtualSessions.size >= this.options.maxSessions
    ) {
      await this.evictLRUSession();
    }

    // Get or create virtual session
    let session = this.virtualSessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        agentId,
        createdAt: new Date(),
        lastActivity: new Date(),
        sequenceNumber: 0,
        isActive: true,
      };
      this.virtualSessions.set(sessionId, session);

      // Initialize metrics
      this.sessionMetrics.set(sessionId, {
        messagesSent: 0,
        messagesReceived: 0,
        misrouted: 0,
        validationErrors: 0,
        cacheHits: 0,
        cacheMisses: 0,
      });

      log.info('[QueryManager] 📝 Created virtual session', {
        projectId: this.projectId,
        sessionId,
        agentId,
      });
    } else {
      // Update last activity
      session.lastActivity = new Date();
    }

    return sessionId;
  }

  /**
   * Send a message and get SDK message stream
   *
   * PERFORMANCE NOTE:
   * Each call creates a new Agent instance → sends init → recreates cache.
   * This is unavoidable with current SDK architecture.
   *
   * The `resume` parameter loads conversation history from disk but still
   * creates a new Agent and sends init.
   *
   * @returns AsyncIterable of SDK messages for this query
   */
  async sendMessage(
    sessionId: string,
    content: string,
    attachments?: unknown[]
  ): Promise<AsyncIterable<SDKMessage>> {
    const session = this.virtualSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Update session activity
    session.lastActivity = new Date();
    session.sequenceNumber++;

    const correlationId = nanoid();

    // Update metrics
    const metrics = this.sessionMetrics.get(sessionId);
    if (metrics) {
      metrics.messagesSent++;
    }

    log.info('[QueryManager] 📤 Sending message', {
      projectId: this.projectId,
      sessionId,
      correlationId,
      sequenceNumber: session.sequenceNumber,
      contentLength: content.length,
      hasAttachments: !!attachments?.length,
    });

    // Build SDK options
    const sdkOptions: Options = {
      cwd: this.projectPath,
      settingSources: ['project', 'local', 'user'],
      env: {
        ...process.env,
        MCP_TIMEOUT: String(this.options.mcpTimeout),
      },
    };

    // Add resume parameter if we have an SDK session ID from previous messages
    const sdkSessionId = this.sdkSessionIds.get(sessionId);
    if (sdkSessionId) {
      sdkOptions.resume = sdkSessionId;
      log.debug('[QueryManager] 🔄 Resuming SDK session', {
        projectId: this.projectId,
        virtualSessionId: sessionId,
        sdkSessionId,
      });
    }

    // Create query (this creates a new Agent instance)
    // TODO: When SDK supports AsyncIterable, switch to persistent Agent per session
    const messageQuery = query({
      prompt: content,
      options: sdkOptions,
    });

    // Wrap the query to:
    // 1. Capture SDK session ID from init message
    // 2. Add virtual session_id for routing
    // 3. Update metrics
    return this.wrapQuery(sessionId, correlationId, messageQuery);
  }

  /**
   * Wrap SDK query to capture session ID and add virtual routing metadata
   */
  private async *wrapQuery(
    virtualSessionId: string,
    correlationId: string,
    sdkQuery: AsyncIterable<SDKMessage>
  ): AsyncGenerator<SDKMessage, void, unknown> {
    let messageCount = 0;
    const metrics = this.sessionMetrics.get(virtualSessionId);

    try {
      for await (const sdkMessage of sdkQuery) {
        messageCount++;

        // Capture SDK session ID from init message (first message)
        if (sdkMessage.type === 'system' && (sdkMessage as any).subtype === 'init') {
          const sdkSessionId = (sdkMessage as any).session_id;
          if (sdkSessionId) {
            this.sdkSessionIds.set(virtualSessionId, sdkSessionId);
            log.info('[QueryManager] 💾 Stored SDK session ID', {
              projectId: this.projectId,
              virtualSessionId,
              sdkSessionId,
            });
          }
        }

        // Add virtual routing metadata
        (sdkMessage as any).session_id = virtualSessionId;
        (sdkMessage as any).correlation_id = correlationId;

        // Update metrics
        if (metrics) {
          metrics.messagesReceived++;

          // Track cache usage from usage data
          if (sdkMessage.type === 'result' && (sdkMessage as any).usage) {
            const usage = (sdkMessage as any).usage;
            if (usage.cache_read_input_tokens > 0) {
              metrics.cacheHits++;
            }
            if (usage.cache_creation_input_tokens > 0) {
              metrics.cacheMisses++;
            }
          }
        }

        log.debug('[QueryManager] 📡 Yielding SDK message', {
          projectId: this.projectId,
          virtualSessionId,
          correlationId,
          messageType: sdkMessage.type,
          messageNumber: messageCount,
        });

        yield sdkMessage;
      }

      log.info('[QueryManager] ✅ Query completed', {
        projectId: this.projectId,
        virtualSessionId,
        correlationId,
        totalMessages: messageCount,
      });
    } catch (error) {
      log.error('[QueryManager] ❌ Query error', {
        projectId: this.projectId,
        virtualSessionId,
        correlationId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Close a session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.virtualSessions.get(sessionId);
    if (!session) {
      log.warn('[QueryManager] Session not found for close', {
        projectId: this.projectId,
        sessionId,
      });
      return;
    }

    session.isActive = false;

    // Clean up session data
    this.virtualSessions.delete(sessionId);
    this.sessionMetrics.delete(sessionId);
    this.sdkSessionIds.delete(sessionId);

    // Emit session-closed event
    this.emit(`session-closed:${sessionId}`);

    log.info('[QueryManager] 🔒 Closed session', {
      projectId: this.projectId,
      sessionId,
    });
  }

  /**
   * Get current stats
   */
  getStats(): QueryManagerStats {
    return {
      projectId: this.projectId,
      activeSessionCount: this.virtualSessions.size,
      mcpInitialized: true, // Always true with per-message approach
      sessionMetrics: Object.fromEntries(this.sessionMetrics),
    };
  }

  /**
   * Destroy manager and cleanup all sessions
   */
  async destroy(): Promise<void> {
    log.info('[QueryManager] 🧹 Destroying manager', {
      projectId: this.projectId,
      sessionCount: this.virtualSessions.size,
    });

    // Close all sessions
    for (const sessionId of Array.from(this.virtualSessions.keys())) {
      await this.closeSession(sessionId);
    }

    // Clear state
    this.virtualSessions.clear();
    this.sessionMetrics.clear();
    this.sdkSessionIds.clear();

    // Remove all event listeners
    this.removeAllListeners();

    log.info('[QueryManager] ✅ Destroyed successfully', { projectId: this.projectId });
  }

  /**
   * Evict least recently used session when at capacity
   */
  private async evictLRUSession(): Promise<void> {
    let lruSessionId: string | null = null;
    let oldestActivity: Date | null = null;

    for (const [sessionId, session] of this.virtualSessions) {
      if (!session.isActive) {
        continue;
      }

      if (!oldestActivity || session.lastActivity < oldestActivity) {
        oldestActivity = session.lastActivity;
        lruSessionId = sessionId;
      }
    }

    if (lruSessionId) {
      log.info('[QueryManager] ♻️ Evicting LRU session', {
        projectId: this.projectId,
        sessionId: lruSessionId,
        lastActivity: oldestActivity,
      });
      await this.closeSession(lruSessionId);
    }
  }
}
