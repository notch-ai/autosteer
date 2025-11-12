/**
 * Trace logger types for SDK message logging
 */

export interface TraceLogEntry {
  timestamp: number;
  sessionId: string;
  messageId: string;
  messageType: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export interface TraceLogOptions {
  enableFileLogging?: boolean;
  logDirectory?: string;
  maxLogSize?: number; // In bytes
  maxLogFiles?: number; // Number of log files to retain
  includeMessageContent?: boolean; // Whether to include full message content
}

export interface TraceLogStats {
  totalMessages: number;
  byType: Record<string, number>;
  bySession: Record<string, number>;
  oldestLog?: number;
  newestLog?: number;
}

export interface TraceQueryOptions {
  sessionId?: string;
  messageType?: string;
  correlationId?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}
