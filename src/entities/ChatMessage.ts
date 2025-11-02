export interface ToolUsage {
  id: string;
  name: string;
  input: any;
  result?: string;
  isError?: boolean;
  isRunning?: boolean;
  timestamp?: Date;
}

import { StreamingEvent } from './StreamingEvent';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachedResources?: string[]; // Resource IDs
  startTime?: Date; // When the message started (for timing)
  duration?: number; // Duration in milliseconds from result message
  currentResponseOutputTokens?: number; // Accumulated output tokens for current response only (resets on new message)
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
    totalCost?: number;
  };
  // Total cost from SDK result message (only available after completion)
  totalCostUSD?: number;
  // Token usage for sub-messages within this message (tool uses, etc.)
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
  toolUsages?: ToolUsage[]; // Tool operations performed during this message
  streamingEvents?: StreamingEvent[]; // All streaming events for this message
  toolCalls?: Array<{
    type: 'tool_use' | 'tool_result';
    id?: string;
    tool_use_id?: string;
    name?: string;
    input?: any;
    content?: any;
  }>; // Raw tool calls from JSONL
  simplifiedToolCalls?: Array<{
    type: 'tool_use';
    name: string;
    taskNames?: string[]; // For TodoWrite tool
    description?: string; // For other tools
  }>; // Simplified tool calls for JSONL display
  latestTodos?: Array<{
    id: string;
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
    activeForm: string; // Present continuous form for in-progress display
  }>; // Latest TODO state from JSONL
  permissionAction?: {
    type: 'accepted' | 'rejected';
    file_path: string;
    old_string?: string | undefined;
    new_string?: string | undefined;
    content?: string | undefined;
    timestamp: Date;
  }; // Permission action taken (for displaying accepted/rejected changes inline)
  stopReason?:
    | 'end_turn'
    | 'max_tokens'
    | 'stop_sequence'
    | 'tool_use'
    | 'pause_turn'
    | 'refusal'
    | 'model_context_window_exceeded';
  stopSequence?: string | null;
  requestId?: string;
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
  // Flag to indicate this message represents a compaction event that should reset context
  isCompactionReset?: boolean;
}
