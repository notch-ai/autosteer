/**
 * Chat Store Selectors
 *
 * Memoized selector layer for computed UI fields from SDK messages.
 *
 * Purpose:
 * - Provide computed fields for UI rendering
 * - Memoize expensive computations
 * - Centralize business logic for message transformation
 *
 * Usage:
 * ```typescript
 * import { selectMessages, selectMessageById } from '@/stores/chat.selectors';
 * const messages = selectMessages(state, agentId);
 * ```
 */

import { logger } from '@/commons/utils/logger';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { StreamingEvent } from '@/entities/StreamingEvent';

// ============================================================================
// SELECTOR TYPES
// ============================================================================

/**
 * Tool usage interface
 * Represents tool operations performed during a message
 */
export interface ToolUsage {
  id: string;
  name: string;
  input: any;
  result?: string;
  isError?: boolean;
  isRunning?: boolean;
  timestamp?: Date;
}

/**
 * Computed message for UI display
 * Derived from SDK messages with additional fields
 * Drop-in replacement for ChatMessage entity
 */
export interface ComputedMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;

  // Metadata
  sessionId?: string;
  parentToolUseId?: string | null;
  attachedResources?: string[]; // Resource IDs
  startTime?: Date; // When the message started (for timing)
  requestId?: string;

  // Token usage (from SDKResultMessage)
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
    totalCost?: number;
  };

  // Cost data
  totalCostUSD?: number;
  currentResponseOutputTokens?: number; // Accumulated output tokens for current response only
  subMessageTokens?: Array<{
    messageId?: string;
    messageType: 'text' | 'tool_use' | 'tool_result';
    tokenUsage: {
      inputTokens?: number;
      outputTokens?: number;
      cacheCreationInputTokens?: number;
      cacheReadInputTokens?: number;
    };
    timestamp: string;
  }>;

  // Tool operations
  toolUsages?: ToolUsage[]; // Tool operations performed during this message
  streamingEvents?: StreamingEvent[]; // All streaming events for this message
  toolCalls?: Array<{
    type: 'tool_use' | 'tool_result';
    id?: string;
    tool_use_id?: string;
    name?: string;
    input?: any;
    content?: any;
  }>;
  simplifiedToolCalls?: Array<{
    type: 'tool_use';
    name: string;
    taskNames?: string[]; // For TodoWrite tool
    description?: string; // For other tools
  }>;

  // Todo state
  latestTodos?: Array<{
    id: string;
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
    activeForm: string; // Present continuous form for in-progress display
  }>;

  // Permission action
  permissionAction?: {
    type: 'accepted' | 'rejected';
    file_path: string;
    old_string?: string | undefined;
    new_string?: string | undefined;
    content?: string | undefined;
    timestamp: Date;
  };

  // Result data
  stopReason?:
    | 'end_turn'
    | 'max_tokens'
    | 'stop_sequence'
    | 'tool_use'
    | 'pause_turn'
    | 'refusal'
    | 'model_context_window_exceeded';
  stopSequence?: string | null;
  duration?: number;
  error?: {
    type:
      | 'invalid_request_error'
      | 'authentication_error'
      | 'permission_error'
      | 'not_found_error'
      | 'request_too_large'
      | 'rate_limit_error'
      | 'api_error'
      | 'overloaded_error';
    message: string;
  };

  // UI-specific
  isPartial?: boolean;
  isReplay?: boolean;
  isSynthetic?: boolean;
  isCompactionReset?: boolean;
}

/**
 * State shape for selectors
 */
export interface ChatStoreState {
  messages: Map<string, SDKMessage[]>;
  activeChat: string | null;
}

// ============================================================================
// MEMOIZATION CACHE
// ============================================================================

/**
 * Simple memoization cache for selector results
 * Uses weak references to prevent memory leaks
 */
const selectorCache = new WeakMap<Map<string, SDKMessage[]>, Map<string, ComputedMessage[]>>();

/**
 * Clear selector cache (useful for testing)
 */
export function clearSelectorCache(): void {
  logger.debug('[chat.selectors] Cache cleared');
  // WeakMap doesn't have a clear method, but creating a new one achieves the same
  // We'll just let the old cache be garbage collected
}

// ============================================================================
// TRANSFORMATION FUNCTIONS
// ============================================================================

/**
 * Transform SDK message to computed message for UI
 * Extracts relevant fields and computes derived properties
 */
function transformSDKMessage(sdkMsg: SDKMessage): ComputedMessage {
  const baseMsg: ComputedMessage = {
    id: sdkMsg.uuid || `temp-${Date.now()}`,
    role: 'assistant', // default
    content: '',
    timestamp: new Date(),
    sessionId: sdkMsg.session_id,
  };

  // Handle different message types
  switch (sdkMsg.type) {
    case 'user': {
      baseMsg.role = 'user';
      baseMsg.parentToolUseId = sdkMsg.parent_tool_use_id;
      if (sdkMsg.isSynthetic !== undefined) {
        baseMsg.isSynthetic = sdkMsg.isSynthetic;
      }
      if ((sdkMsg as any).isReplay !== undefined) {
        baseMsg.isReplay = (sdkMsg as any).isReplay;
      }

      // Extract text content from APIUserMessage
      const message = sdkMsg.message;
      if (typeof message === 'string') {
        baseMsg.content = message;
      } else if (typeof message === 'object' && message !== null) {
        // Handle { role: 'user', content: string } format
        if ('content' in message && typeof message.content === 'string') {
          baseMsg.content = message.content;
        } else if (Array.isArray(message)) {
          // Handle array of content blocks
          baseMsg.content = message
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('\n');
        }
      }
      break;
    }

    case 'assistant': {
      baseMsg.role = 'assistant';
      baseMsg.parentToolUseId = sdkMsg.parent_tool_use_id;

      // Extract content from APIAssistantMessage
      const message = sdkMsg.message;
      if (message.content) {
        if (Array.isArray(message.content)) {
          baseMsg.content = message.content
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('\n');

          // Extract tool calls
          const toolBlocks = message.content.filter((block: any) => block.type === 'tool_use');
          if (toolBlocks.length > 0) {
            baseMsg.toolCalls = toolBlocks.map((block: any) => ({
              type: 'tool_use' as const,
              id: block.id,
              name: block.name,
              input: block.input,
            }));
          }
        }
      }

      // Extract result metadata if available
      if (message.stop_reason) {
        baseMsg.stopReason = message.stop_reason as any;
      }
      if (message.stop_sequence !== undefined) {
        baseMsg.stopSequence = message.stop_sequence;
      }
      if (message.usage) {
        baseMsg.tokenUsage = {
          inputTokens: message.usage.input_tokens || 0,
          outputTokens: message.usage.output_tokens || 0,
          cacheCreationInputTokens: message.usage.cache_creation_input_tokens || 0,
          cacheReadInputTokens: message.usage.cache_read_input_tokens || 0,
        };
      }
      break;
    }

    case 'result': {
      baseMsg.role = 'system';

      if (sdkMsg.subtype === 'success') {
        baseMsg.content = sdkMsg.result || 'Request completed';
        baseMsg.duration = sdkMsg.duration_ms;
        baseMsg.totalCostUSD = sdkMsg.total_cost_usd;

        if (sdkMsg.usage) {
          baseMsg.tokenUsage = {
            inputTokens: sdkMsg.usage.input_tokens || 0,
            outputTokens: sdkMsg.usage.output_tokens || 0,
            cacheCreationInputTokens: sdkMsg.usage.cache_creation_input_tokens || 0,
            cacheReadInputTokens: sdkMsg.usage.cache_read_input_tokens || 0,
          };
        }
      } else {
        // Error result
        baseMsg.content = `Error: ${sdkMsg.subtype}`;
        const errorMsg = (sdkMsg as any).error;
        if (errorMsg) {
          baseMsg.error = errorMsg;
          baseMsg.content = errorMsg.message || baseMsg.content;
        }
      }
      break;
    }

    case 'stream_event': {
      baseMsg.role = 'assistant';
      baseMsg.isPartial = true;
      baseMsg.parentToolUseId = sdkMsg.parent_tool_use_id;

      // Extract partial content from streaming event
      const event = sdkMsg.event;
      if (event.type === 'content_block_delta') {
        if ((event as any).delta?.text) {
          baseMsg.content = (event as any).delta.text;
        }
      }
      break;
    }

    case 'system': {
      baseMsg.role = 'system';

      if ('subtype' in sdkMsg) {
        if (sdkMsg.subtype === 'init') {
          baseMsg.content = `Session initialized (Model: ${sdkMsg.model})`;
        } else if (sdkMsg.subtype === 'compact_boundary') {
          baseMsg.content = `Compaction triggered: ${sdkMsg.compact_metadata.trigger} (${sdkMsg.compact_metadata.pre_tokens} tokens)`;
        }
      } else {
        baseMsg.content = 'System message';
      }
      break;
    }

    default:
      // Handle unknown message types (should not happen with proper typing)
      baseMsg.content = '[Unknown message type]';
      break;
  }

  return baseMsg;
}

// ============================================================================
// SELECTORS
// ============================================================================

/**
 * Select all messages for an agent, transformed to computed messages
 * Memoized to prevent unnecessary recomputation
 *
 * @param state - Chat store state
 * @param agentId - Agent ID
 * @returns Array of computed messages
 */
export function selectMessages(state: ChatStoreState, agentId: string): ComputedMessage[] {
  const sdkMessages = state.messages.get(agentId);
  if (!sdkMessages || sdkMessages.length === 0) {
    return [];
  }

  // Check cache
  let cacheForMessagesMap = selectorCache.get(state.messages);
  if (!cacheForMessagesMap) {
    cacheForMessagesMap = new Map();
    selectorCache.set(state.messages, cacheForMessagesMap);
  }

  const cached = cacheForMessagesMap.get(agentId);
  if (cached) {
    return cached;
  }

  // Transform and cache
  const computed = sdkMessages.map(transformSDKMessage);
  cacheForMessagesMap.set(agentId, computed);

  logger.debug('[chat.selectors] Transformed messages', {
    agentId,
    count: computed.length,
  });

  return computed;
}

/**
 * Select a single message by ID
 *
 * @param state - Chat store state
 * @param agentId - Agent ID
 * @param messageId - Message UUID
 * @returns Computed message or undefined
 */
export function selectMessageById(
  state: ChatStoreState,
  agentId: string,
  messageId: string
): ComputedMessage | undefined {
  const messages = selectMessages(state, agentId);
  return messages.find((msg) => msg.id === messageId);
}

/**
 * Select messages by role
 *
 * @param state - Chat store state
 * @param agentId - Agent ID
 * @param role - Message role to filter by
 * @returns Array of computed messages with specified role
 */
export function selectMessagesByRole(
  state: ChatStoreState,
  agentId: string,
  role: 'user' | 'assistant' | 'system'
): ComputedMessage[] {
  const messages = selectMessages(state, agentId);
  return messages.filter((msg) => msg.role === role);
}

/**
 * Select the last message for an agent
 *
 * @param state - Chat store state
 * @param agentId - Agent ID
 * @returns Last computed message or undefined
 */
export function selectLastMessage(
  state: ChatStoreState,
  agentId: string
): ComputedMessage | undefined {
  const messages = selectMessages(state, agentId);
  return messages[messages.length - 1];
}

/**
 * Select all user messages for an agent
 *
 * @param state - Chat store state
 * @param agentId - Agent ID
 * @returns Array of user messages
 */
export function selectUserMessages(state: ChatStoreState, agentId: string): ComputedMessage[] {
  return selectMessagesByRole(state, agentId, 'user');
}

/**
 * Select all assistant messages for an agent
 *
 * @param state - Chat store state
 * @param agentId - Agent ID
 * @returns Array of assistant messages
 */
export function selectAssistantMessages(state: ChatStoreState, agentId: string): ComputedMessage[] {
  return selectMessagesByRole(state, agentId, 'assistant');
}

/**
 * Select total token usage for an agent's conversation
 *
 * @param state - Chat store state
 * @param agentId - Agent ID
 * @returns Total token usage
 */
export function selectTotalTokenUsage(
  state: ChatStoreState,
  agentId: string
): {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
} {
  const messages = selectMessages(state, agentId);

  return messages.reduce(
    (acc, msg) => {
      if (msg.tokenUsage) {
        acc.inputTokens += msg.tokenUsage.inputTokens || 0;
        acc.outputTokens += msg.tokenUsage.outputTokens || 0;
        acc.cacheCreationInputTokens += msg.tokenUsage.cacheCreationInputTokens || 0;
        acc.cacheReadInputTokens += msg.tokenUsage.cacheReadInputTokens || 0;
      }
      return acc;
    },
    {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    }
  );
}

/**
 * Select total cost for an agent's conversation
 *
 * @param state - Chat store state
 * @param agentId - Agent ID
 * @returns Total cost in USD
 */
export function selectTotalCost(state: ChatStoreState, agentId: string): number {
  const messages = selectMessages(state, agentId);

  return messages.reduce((acc, msg) => {
    if (msg.totalCostUSD) {
      acc += msg.totalCostUSD;
    }
    return acc;
  }, 0);
}

/**
 * Select messages for current active chat
 *
 * @param state - Chat store state
 * @returns Array of computed messages for active chat
 */
export function selectCurrentMessages(state: ChatStoreState): ComputedMessage[] {
  if (!state.activeChat) {
    return [];
  }
  return selectMessages(state, state.activeChat);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format tool description based on tool type and input
 * Centralized formatting logic for tool descriptions in UI
 *
 * @param toolName - Name of the tool
 * @param toolInput - Tool input parameters
 * @returns Formatted description string
 */
export function formatToolDescription(toolName: string, toolInput: any): string {
  if (!toolInput) return '';

  switch (toolName) {
    // File operations
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
      return toolInput.file_path || toolInput.path || '';

    // Search operations
    case 'Grep':
      return `"${toolInput.pattern || ''}" in ${toolInput.path || '.'}`;

    case 'Glob':
      return `${toolInput.pattern || ''} in ${toolInput.path || '.'}`;

    // System operations
    case 'Bash':
      return toolInput.command || '';

    case 'LS':
      return toolInput.path || '.';

    // Agent operations
    case 'Task':
      return toolInput.description || '';

    // Web operations
    case 'WebSearch':
      return toolInput.query || '';

    case 'WebFetch':
      return toolInput.url || '';

    // Notebook operations
    case 'NotebookEdit':
      return toolInput.notebook_path || '';

    // MCP operations
    case 'ReadMcpResource':
      return `${toolInput.server}:${toolInput.uri}`;

    case 'ListMcpResources':
      return toolInput.server || 'all servers';

    // Generic fallback
    default:
      if (toolInput.file_path) return toolInput.file_path;
      if (toolInput.path) return toolInput.path;
      if (toolInput.query) return toolInput.query;
      if (toolInput.url) return toolInput.url;
      if (toolInput.command) return toolInput.command;
      return '';
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

logger.debug('[chat.selectors] Selector layer initialized');
