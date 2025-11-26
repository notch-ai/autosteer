/**
 * Message Transformation Utilities
 *
 * Centralized transformation and filtering for SDK messages.
 * Single source of truth for converting SDK messages to ComputedMessage format.
 *
 * Architecture:
 * - transformSDKMessage() - Main transformation with filtering (use this for chat messages)
 * - extractTextContent() - Utility for extracting text from content blocks
 * - extractToolCalls() - Utility for extracting tool uses
 * - mapTokenUsage() - Utility for token usage conversion
 *
 * Usage:
 * ```typescript
 * import { transformSDKMessage } from '@/commons/utils/message-transformers';
 *
 * // Transform SDK message (returns null if synthetic)
 * const msg = transformSDKMessage(sdkMessage, { calculateCost: true, model: 'claude-3-5-sonnet' });
 * if (msg) {
 *   // msg is ComputedMessage, synthetic messages filtered
 *   store.addMessage(msg);
 * }
 * ```
 */

import log from 'electron-log';
import { isSyntheticMessage } from './message-filters';

/**
 * Content block with text type
 */
interface TextBlock {
  type: 'text';
  text: string;
}

/**
 * Content block with tool_use type
 */
interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: any;
}

/**
 * Union of all content block types
 */
type ContentBlock = TextBlock | ToolUseBlock | { type: string; [key: string]: any };

/**
 * Tool call structure for ComputedMessage
 */
export interface ToolCall {
  type: 'tool_use';
  id: string;
  name: string;
  input: any;
}

/**
 * SDK usage structure from Anthropic API
 * Flexible interface that accepts any usage object with snake_case fields
 * Supports both undefined and null for optional fields (BetaUsage compatibility)
 */
export interface SDKUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  [key: string]: any; // Allow other fields from BetaUsage or similar types
}

/**
 * Token usage structure for ComputedMessage
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
}

/**
 * Extract text content from an array of content blocks
 *
 * Filters for 'text' type blocks and joins their text with newlines.
 * Non-text blocks (tool_use, etc.) are ignored.
 *
 * @param content - Array of content blocks from message
 * @returns Extracted text content, joined with newlines
 *
 * @example
 * const content = [
 *   { type: 'text', text: 'Hello' },
 *   { type: 'tool_use', id: 'tool-1', name: 'Read', input: {} },
 *   { type: 'text', text: 'World' }
 * ];
 * extractTextContent(content); // 'Hello\nWorld'
 */
export function extractTextContent(content: ContentBlock[]): string {
  return content
    .filter((block): block is TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

/**
 * Extract tool calls from an array of content blocks
 *
 * Filters for 'tool_use' type blocks and maps them to the ToolCall structure.
 * Text blocks and other types are ignored.
 *
 * @param content - Array of content blocks from message
 * @returns Array of tool calls
 *
 * @example
 * const content = [
 *   { type: 'text', text: 'Let me read that file' },
 *   { type: 'tool_use', id: 'tool-1', name: 'Read', input: { file_path: '/foo' } }
 * ];
 * extractToolCalls(content); // [{ type: 'tool_use', id: 'tool-1', name: 'Read', input: {...} }]
 */
export function extractToolCalls(content: ContentBlock[]): ToolCall[] {
  return content
    .filter((block): block is ToolUseBlock => block.type === 'tool_use')
    .map((block) => ({
      type: 'tool_use' as const,
      id: block.id,
      name: block.name,
      input: block.input,
    }));
}

/**
 * Map SDK usage structure to ComputedMessage token usage format
 *
 * Converts the snake_case SDK format to camelCase ComputedMessage format.
 * Defaults to 0 for missing token counts.
 *
 * @param usage - SDK usage object from Anthropic API
 * @returns Token usage in ComputedMessage format
 *
 * @example
 * const sdkUsage = {
 *   input_tokens: 100,
 *   output_tokens: 50,
 *   cache_read_input_tokens: 200
 * };
 * mapTokenUsage(sdkUsage);
 * // {
 * //   inputTokens: 100,
 * //   outputTokens: 50,
 * //   cacheCreationInputTokens: 0,
 * //   cacheReadInputTokens: 200
 * // }
 */
export function mapTokenUsage(usage: SDKUsage): TokenUsage {
  return {
    inputTokens: usage.input_tokens || 0,
    outputTokens: usage.output_tokens || 0,
    cacheCreationInputTokens: usage.cache_creation_input_tokens || 0,
    cacheReadInputTokens: usage.cache_read_input_tokens || 0,
  };
}

/**
 * Model pricing for token cost calculation
 * Cost per million tokens (input/output)
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-5-sonnet-20240620': { input: 3.0, output: 15.0 },
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
  'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-3-5-haiku-20241022': { input: 1.0, output: 5.0 },
  'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
  'claude-opus-4-1-20250805': { input: 15.0, output: 75.0 },
  'claude-opus-4-5-20251101': { input: 5.0, output: 25.0 },
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
};

/**
 * Calculate token cost based on usage and model
 *
 * @param usage - Token usage object
 * @param model - Model identifier
 * @returns Total cost in USD (rounded to 6 decimal places)
 */
export function calculateTokenCost(usage: TokenUsage, model: string): number {
  const pricing = MODEL_PRICING[model] || { input: 15.0, output: 75.0 };

  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
  const cacheCreationCost = ((usage.cacheCreationInputTokens || 0) / 1_000_000) * pricing.input;
  const cacheReadCost = ((usage.cacheReadInputTokens || 0) / 1_000_000) * pricing.input;

  const totalCost = inputCost + outputCost + cacheCreationCost + cacheReadCost;
  return Math.round(totalCost * 1_000_000) / 1_000_000;
}

/**
 * SDK Message interface (flexible for both streaming and JSONL)
 */
export interface SDKMessage {
  uuid?: string;
  id?: string;
  type?: string;
  role?: 'user' | 'assistant';
  content?: ContentBlock[] | string;
  timestamp?: string | number;
  usage?: SDKUsage;
  message?: {
    id?: string;
    role?: 'user' | 'assistant';
    content?: ContentBlock[] | string;
    usage?: SDKUsage;
  };
  // Synthetic message indicators
  sourceToolUseId?: string | null;
  isSynthetic?: boolean;
  parentUuid?: string | null;
  [key: string]: any;
}

/**
 * ComputedMessage interface (output format)
 */
export interface ComputedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokenUsage?: TokenUsage;
  totalCostUSD?: number;
  toolCalls?: ToolCall[];
  [key: string]: any;
}

/**
 * Options for transformSDKMessage
 */
export interface TransformOptions {
  calculateCost?: boolean;
  model?: string;
}

/**
 * Transform SDK message to ComputedMessage with built-in synthetic filtering
 *
 * Single source of truth for SDK message transformation.
 * Filters synthetic messages (skill invocations) at transformation layer.
 *
 * @param sdkMsg - Raw SDK message from streaming or JSONL
 * @param options - Transformation options
 * @returns ComputedMessage or null if synthetic message filtered
 *
 * @example
 * // Streaming path
 * const msg = transformSDKMessage(sdkMessage);
 * if (msg) callbacks.onChunk({ content: msg.content });
 *
 * @example
 * // JSONL path with cost calculation
 * const msg = transformSDKMessage(sdkMessage, {
 *   calculateCost: true,
 *   model: 'claude-3-5-sonnet-20241022'
 * });
 * if (msg) messages.push(msg);
 */
export function transformSDKMessage(
  sdkMsg: SDKMessage,
  options?: TransformOptions
): ComputedMessage | null {
  // Defense-in-depth: Filter synthetic messages at transformation layer
  if (isSyntheticMessage(sdkMsg)) {
    log.debug('[transformSDKMessage] Filtering synthetic message', {
      uuid: sdkMsg.uuid,
      id: sdkMsg.id,
      type: sdkMsg.type,
      role: sdkMsg.role,
      sourceToolUseId: sdkMsg.sourceToolUseId,
      isSynthetic: sdkMsg.isSynthetic,
      parentUuid: sdkMsg.parentUuid,
    });
    return null;
  } else {
    log.debug(
      '[transformSDKMessage] PASSED Filtering synthetic message',
      JSON.stringify(sdkMsg, null, 2)
    );
  }

  // Extract role from type or role field
  let role: 'user' | 'assistant' = 'user';
  if (sdkMsg.message?.role === 'assistant' || sdkMsg.type === 'assistant') {
    role = 'assistant';
  } else if (sdkMsg.message?.role === 'user' || sdkMsg.type === 'user') {
    role = 'user';
  } else if (sdkMsg.role) {
    role = sdkMsg.role;
  }

  // Extract content - handle both direct content and nested message.content
  let contentBlocks: ContentBlock[] = [];
  const directContent = sdkMsg.content;
  const messageContent = sdkMsg.message?.content;

  if (Array.isArray(directContent)) {
    contentBlocks = directContent;
  } else if (Array.isArray(messageContent)) {
    contentBlocks = messageContent;
  } else if (typeof directContent === 'string') {
    return {
      id: sdkMsg.uuid || sdkMsg.id || `msg-${Date.now()}`,
      role,
      content: directContent,
      timestamp: new Date(sdkMsg.timestamp || Date.now()),
    };
  } else if (typeof messageContent === 'string') {
    return {
      id: sdkMsg.uuid || sdkMsg.message?.id || `msg-${Date.now()}`,
      role,
      content: messageContent,
      timestamp: new Date(sdkMsg.timestamp || Date.now()),
    };
  }

  // Extract text content using shared utility
  const content = extractTextContent(contentBlocks);

  // Extract tool calls using shared utility
  const toolCalls = extractToolCalls(contentBlocks);

  // Map token usage if available
  const usage = sdkMsg.usage || sdkMsg.message?.usage;
  const tokenUsage = usage ? mapTokenUsage(usage) : undefined;

  // Calculate cost if requested
  let totalCostUSD: number | undefined;
  if (options?.calculateCost && tokenUsage && options.model) {
    totalCostUSD = calculateTokenCost(tokenUsage, options.model);
  }

  // Create ComputedMessage
  const computedMessage: ComputedMessage = {
    id: sdkMsg.uuid || sdkMsg.message?.id || sdkMsg.id || `msg-${Date.now()}`,
    role,
    content,
    timestamp: new Date(sdkMsg.timestamp || Date.now()),
  };

  // Add optional fields if present
  if (tokenUsage) {
    computedMessage.tokenUsage = tokenUsage;
  }

  if (totalCostUSD !== undefined) {
    computedMessage.totalCostUSD = totalCostUSD;
  }

  if (toolCalls.length > 0) {
    computedMessage.toolCalls = toolCalls;
  }

  return computedMessage;
}
