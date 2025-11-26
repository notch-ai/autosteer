/**
 * Chat Store Selectors
 *
 * Simple selector layer for accessing already-transformed ComputedMessage[].
 * Messages are transformed at source (claude.handlers.ts or ClaudeCodeService.ts)
 *
 * Purpose:
 * - Provide typed access to store data
 * - Simple filtering/aggregation where needed
 * - NO transformation (done at source)
 *
 * Usage:
 * ```typescript
 * import { selectMessages, selectMessageById } from '@/stores/chat.selectors';
 * const messages = selectMessages(state, agentId);
 * ```
 */

import { logger } from '@/commons/utils/logger';
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
 * Note: messages are already ComputedMessage[] (transformed at source by claude.handlers.ts or ClaudeCodeService.ts)
 */
export interface ChatStoreState {
  messages: Map<string, ComputedMessage[]>;
  activeChat: string | null;
}

// ============================================================================
// SELECTORS
// ============================================================================
// Note: Transformation and filtering removed - messages are already ComputedMessage[]
// transformed and filtered at source (claude.handlers.ts and ClaudeCodeService.ts)

/**
 * Select all messages for an agent
 * Messages are already ComputedMessage[] (transformed at source)
 * Memoized to prevent unnecessary array allocations
 *
 * Note: Synthetic messages are filtered at the source:
 * - JSONL loading: claude.handlers.ts filters during parsing
 * - Streaming: ClaudeCodeService.ts filters before storing
 *
 * @param state - Chat store state
 * @param agentId - Agent ID
 * @returns Array of computed messages (already transformed)
 */
export function selectMessages(state: ChatStoreState, agentId: string): ComputedMessage[] {
  const messages = state.messages.get(agentId);
  if (!messages || messages.length === 0) {
    return [];
  }

  // Messages are already ComputedMessage[] - no transformation needed
  // Just return directly (memoization happens at store level via Map reference)
  return messages;
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
