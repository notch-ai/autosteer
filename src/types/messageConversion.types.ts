/**
 * Types for message conversion between SDK and UI formats
 */

import type { ChatMessage } from '@/entities/ChatMessage';
import type { SDKMessage } from './sdk.types';

/**
 * Result of processing an SDK message
 */
export interface ConvertedMessage {
  /**
   * The converted ChatMessage (null if message shouldn't be displayed)
   */
  chatMessage: ChatMessage | null;

  /**
   * Additional metadata extracted from the message
   */
  metadata?: {
    sessionId?: string;
    parentToolUseId?: string | null;
    uuid?: string | undefined;
  };

  /**
   * Type of the original SDK message
   */
  sourceType: SDKMessage['type'];
}

/**
 * Tool call with formatted description
 */
export interface FormattedToolCall {
  type: 'tool_use';
  name: string;
  description?: string;
  input?: any;
}

/**
 * Error information extracted from result message
 */
export interface ExtractedError {
  type: string;
  message: string;
  subtype?: 'error_max_turns' | 'error_during_execution';
}

/**
 * Token usage in UI format (camelCase for React components)
 */
export interface UITokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}
