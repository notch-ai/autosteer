/**
 * Shared type definitions for Claude Code services
 */

export interface Attachment {
  type: 'image' | 'document' | 'code' | 'other';
  media_type: string;
  data: string; // base64
  filename?: string;
}

export interface ClaudeCodeQueryOptions {
  prompt: string;
  apiKey?: string;
  sessionId?: string;
  attachments?: Attachment[];
  options?: {
    maxTurns?: number;
    systemPrompt?: string;
    allowedTools?: string[];
    model?: string;
    cwd?: string;
    maxThinkingTokens?: number;
    permissionMode?: string;
    resume?: string;
  };
}

// Anthropic message format (nested in assistant messages)
export interface AnthropicMessage {
  id: string;
  type: 'message';
  role: 'user' | 'assistant' | 'system';
  model: string;
  content: Array<{
    type: 'text' | 'tool_use' | 'tool_result';
    text?: string;
    tool_use?: any;
    tool_result?: any;
  }>;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    output_tokens: number;
    service_tier?: string;
  };
}

// MCP Server info
export interface MCPServer {
  name: string;
  status: string;
}

export interface ClaudeCodeMessage {
  type: string;
  subtype?: string;
  role?: 'user' | 'assistant' | 'system';
  content?: string | Record<string, unknown>;
  session_id?: string;
  message?: string | Record<string, unknown> | AnthropicMessage;
  duration_ms?: number;
  is_error?: boolean;
  total_cost_usd?: number;
  thinking?: string;
  tool_calls?: any[];
  tool_results?: any[];
  error?: string | Record<string, unknown>;
  status?: string;
  metadata?: Record<string, unknown>;
  parent_tool_use_id?: string | null;
  result?: string;
  usage?: Record<string, unknown>;
  // Init message specific fields
  cwd?: string;
  tools?: string[];
  mcp_servers?: MCPServer[];
  model?: string;
  permissionMode?: string;
  apiKeySource?: string;
  slash_commands?: string[];
  output_style?: string;
  agents?: string[];
  // Result message specific fields
  num_turns?: number;
  server_tool_use?: {
    web_search_requests: number;
  };
  permission_denials?: Array<{
    tool_name: string;
    tool_use_id: string;
    tool_input: Record<string, unknown>;
  }>;
  modelUsage?: Record<string, any>;
  // Compact boundary message specific fields
  uuid?: string;
  compact_metadata?: {
    trigger: string;
    pre_tokens: number;
  };
}
