import type { SDKMessage } from '@/types/sdk.types';

export interface VirtualSession {
  sessionId: string;
  agentId: string;
  createdAt: Date;
  lastActivity: Date;
  sequenceNumber: number;
  isActive: boolean;
}

export interface SessionMetrics {
  messagesSent: number;
  messagesReceived: number;
  misrouted: number;
  validationErrors: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface QueryManagerStats {
  projectId: string;
  activeSessionCount: number;
  mcpInitialized: boolean;
  processId?: number;
  sessionMetrics: Record<string, SessionMetrics>;
}

export interface QueryManagerOptions {
  maxSessions?: number;
  sessionIdleTimeout?: number;
  mcpTimeout?: number;
}

/**
 * @deprecated - No longer used in simplified implementation
 */
export interface QueuedMessage {
  sessionId: string;
  correlationId: string;
  sequenceNumber: number;
  content: string;
  attachments: unknown[] | undefined;
  timestamp: number;
}

/**
 * @deprecated - No longer used in simplified implementation
 */
export interface SDKMessageWithSession {
  message: SDKMessage;
  session_id: string;
  correlation_id?: string;
}

/**
 * @deprecated - No longer used in simplified implementation
 */
export interface MessageQueueItem {
  message: QueuedMessage;
  resolve: () => void;
  reject: (error: Error) => void;
}

/**
 * @deprecated - No longer used in simplified implementation
 */
export interface SessionCacheEntry {
  sessionId: string;
  messages: any[];
  loadTimeMs: number;
  fromCache: boolean;
}

/**
 * Interface for QueryManager
 *
 * NOTE: Interface updated for simplified per-message approach
 * - Removed initialize() - no longer needed
 * - Changed sendMessage() to return AsyncIterable<SDKMessage>
 */
export interface IQueryManager {
  readonly projectId: string;
  readonly projectPath: string;

  getOrCreateSession(agentId: string, sessionId: string): Promise<string>;
  sendMessage(
    sessionId: string,
    content: string,
    attachments?: any[]
  ): Promise<AsyncIterable<SDKMessage>>;
  closeSession(sessionId: string): Promise<void>;
  getStats(): QueryManagerStats;
  destroy(): Promise<void>;
}
