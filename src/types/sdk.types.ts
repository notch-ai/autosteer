/**
 * Official SDK type definitions
 * Re-exported from @anthropic-ai/claude-agent-sdk for centralized access
 */

// Import official types from SDK
import type {
  SDKMessage,
  SDKAssistantMessage,
  SDKUserMessage,
  SDKUserMessageReplay,
  SDKResultMessage,
  SDKSystemMessage,
  SDKPartialAssistantMessage,
  SDKCompactBoundaryMessage,
  SDKPermissionDenial,
  PermissionMode,
} from '@anthropic-ai/claude-agent-sdk';

// Re-export for application use
export type {
  SDKMessage,
  SDKAssistantMessage,
  SDKUserMessage,
  SDKUserMessageReplay,
  SDKResultMessage,
  SDKSystemMessage,
  SDKPartialAssistantMessage,
  SDKCompactBoundaryMessage,
  SDKPermissionDenial,
  PermissionMode,
};

/**
 * Token usage type (from SDK but not exported)
 */
export type Usage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

/**
 * Non-nullable usage type (all fields required)
 */
export type NonNullableUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
};

/**
 * Tool input type (union of all tool input types)
 * This is a simplified version - add more specific types as needed
 */
export type ToolInput = Record<string, any>;

/**
 * Type guards for SDK messages
 * These enable TypeScript to narrow types in switch/if statements
 */

export function isAssistantMessage(msg: SDKMessage): msg is SDKAssistantMessage {
  return msg.type === 'assistant';
}

export function isUserMessage(msg: SDKMessage): msg is SDKUserMessage {
  return msg.type === 'user';
}

export function isResultMessage(msg: SDKMessage): msg is SDKResultMessage {
  return msg.type === 'result';
}

export function isSystemMessage(msg: SDKMessage): msg is SDKSystemMessage {
  return msg.type === 'system' && msg.subtype === 'init';
}

export function isCompactBoundaryMessage(msg: SDKMessage): msg is SDKCompactBoundaryMessage {
  return msg.type === 'system' && msg.subtype === 'compact_boundary';
}
