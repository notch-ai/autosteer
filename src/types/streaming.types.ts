/**
 * Types for streaming communication
 */

import { PermissionRequest } from '@/stores/types';
import { PermissionMode } from './permission.types';

export interface StreamingChunk {
  type: 'partial' | 'complete' | 'error';
  content: string;
  done: boolean;
  chunk_index?: number;
  total_chunks?: number;
  // Token usage for this sub-message (if available)
  tokenUsage?:
    | {
        inputTokens?: number;
        outputTokens?: number;
        cacheCreationInputTokens?: number;
        cacheReadInputTokens?: number;
      }
    | undefined;
  messageId?: string;
  messageType?: 'text' | 'tool_use' | 'tool_result' | 'assistant' | 'user';
  isNewMessage?: boolean;
}

export interface SystemMessage {
  type: 'system';
  subtype: string;
  data: any;
  session_id?: string;
  // MCP servers list from init message
  mcp_servers?: Array<{ name: string; status: string }>;
  compact_metadata?: {
    trigger: string;
    pre_tokens: number;
  };
}

export interface ToolUseMessage {
  type: 'tool_use';
  tool_id: string;
  tool_name: string;
  tool_input: any;
  parent_tool_use_id?: string | null;
}

export interface ToolResultMessage {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error: boolean;
}

export type StopReason =
  | 'end_turn'
  | 'max_tokens'
  | 'stop_sequence'
  | 'tool_use'
  | 'pause_turn'
  | 'refusal'
  | 'model_context_window_exceeded';

export interface ClaudeError {
  type: 'error';
  error: {
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
  request_id?: string;
}

export interface ResultMessage {
  type: 'result';
  subtype: string;
  duration_ms: number;
  is_error: boolean;
  total_cost_usd?: number;
  usage?: any;
  modelUsage?: Record<string, any>;
  session_id?: string;
  stop_reason?: StopReason;
  stop_sequence?: string | null;
  request_id?: string;
  __permissionRequest?: PermissionRequest;
  error?: ClaudeError['error'];
}

export interface ConversationOptions {
  system_prompt?: string;
  allowed_tools?: string[];
  max_turns?: number;
  max_thinking_tokens?: number;
  permission_mode?: PermissionMode; // SDK permission mode (not frontend PermissionMode)
  model?: string;
  cwd?: string;
}
