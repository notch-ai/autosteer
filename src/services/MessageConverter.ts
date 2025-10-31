/**
 * MessageConverter - Unified message transformation service
 *
 * Centralizes all SDK message → UI format conversions
 * Replaces scattered logic in MessageProcessor, CoreStore, and ClaudeCodeSDKService
 */

import { ChatMessage } from '@/entities/ChatMessage';
import { logger } from '@/commons/utils/logger';
import type {
  SDKMessage,
  SDKAssistantMessage,
  SDKUserMessage,
  SDKResultMessage,
  Usage,
  ToolInput,
} from '@/types/sdk.types';
import type {
  ConvertedMessage,
  FormattedToolCall,
  ExtractedError,
  UITokenUsage,
} from '@/types/messageConversion.types';

export class MessageConverter {
  /**
   * Convert any SDK message to ChatMessage format
   * Returns null for messages that shouldn't be displayed in chat
   */
  static convert(sdkMessage: SDKMessage): ConvertedMessage {
    logger.debug('[MessageConverter] Converting SDK message:', {
      type: sdkMessage.type,
      uuid: sdkMessage.uuid,
    });

    switch (sdkMessage.type) {
      case 'assistant':
        return this.convertAssistantMessage(sdkMessage);

      case 'user':
        return this.convertUserMessage(sdkMessage);

      case 'system':
        // System messages don't display in chat
        return {
          chatMessage: null,
          sourceType: 'system',
          metadata: {
            sessionId: sdkMessage.session_id,
            uuid: sdkMessage.uuid,
          },
        };

      case 'result':
        // Result messages don't display in chat (metadata only)
        return {
          chatMessage: null,
          sourceType: 'result',
          metadata: {
            sessionId: sdkMessage.session_id,
            uuid: sdkMessage.uuid,
          },
        };

      default:
        logger.warn('[MessageConverter] Unknown message type:', sdkMessage);
        return {
          chatMessage: null,
          sourceType: 'system',
        };
    }
  }

  /**
   * Convert assistant message to ChatMessage
   */
  private static convertAssistantMessage(msg: SDKAssistantMessage): ConvertedMessage {
    const textContent = this.extractTextContent(msg.message.content);
    const simplifiedToolCalls = this.extractAndFormatToolCalls(msg.message.content);

    const chatMessage: ChatMessage = {
      id: msg.uuid,
      role: 'assistant',
      content: textContent,
      timestamp: new Date(),
      startTime: new Date(),
      ...(msg.message.usage && {
        tokenUsage: this.convertTokenUsage(msg.message.usage),
      }),
      ...(simplifiedToolCalls.length > 0 && {
        simplifiedToolCalls,
      }),
    };

    return {
      chatMessage,
      sourceType: 'assistant',
      metadata: {
        sessionId: msg.session_id,
        parentToolUseId: msg.parent_tool_use_id,
        uuid: msg.uuid as string | undefined,
      },
    };
  }

  /**
   * Convert user message to ChatMessage
   */
  private static convertUserMessage(msg: SDKUserMessage): ConvertedMessage {
    const textContent = this.extractTextContent(msg.message.content);

    const chatMessage: ChatMessage = {
      id: msg.uuid || `user-${Date.now()}`,
      role: 'user',
      content: textContent,
      timestamp: new Date(),
    };

    return {
      chatMessage,
      sourceType: 'user',
      metadata: {
        sessionId: msg.session_id,
        parentToolUseId: msg.parent_tool_use_id,
        uuid: msg.uuid as string | undefined,
      },
    };
  }

  /**
   * Extract text content from message content array
   */
  private static extractTextContent(contentArray: any): string {
    if (!Array.isArray(contentArray)) {
      return '';
    }

    return contentArray
      .filter((item) => item.type === 'text')
      .map((item) => item.text || '')
      .join('');
  }

  /**
   * Extract tool calls and format descriptions
   */
  private static extractAndFormatToolCalls(contentArray: any[]): FormattedToolCall[] {
    if (!Array.isArray(contentArray)) {
      return [];
    }

    const toolCalls: FormattedToolCall[] = [];

    for (const item of contentArray) {
      if (item.type !== 'tool_use') continue;

      const toolData = item.tool_use || item;

      // Skip TodoWrite - handled separately
      if (toolData.name === 'TodoWrite') continue;

      toolCalls.push({
        type: 'tool_use' as const,
        name: toolData.name,
        description: this.formatToolDescription(toolData.name, toolData.input),
        input: toolData.input,
      });
    }

    return toolCalls;
  }

  /**
   * Format tool description based on tool type and input
   * CENTRALIZED - Single source of truth for tool descriptions
   */
  static formatToolDescription(toolName: string, toolInput: any): string {
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

  /**
   * Convert token usage from SDK format (snake_case) to UI format (camelCase)
   */
  static convertTokenUsage(usage: Usage): UITokenUsage {
    return {
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
      cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
    };
  }

  /**
   * Extract error information from result message
   * Uses SDK's structured error subtypes instead of string matching
   */
  static extractError(resultMsg: SDKResultMessage): ExtractedError | null {
    if (!resultMsg.is_error) {
      return null;
    }

    // Use SDK's structured error subtypes first
    if (resultMsg.subtype === 'error_max_turns') {
      return {
        type: 'max_turns_error',
        message: `Maximum turns limit reached (${resultMsg.num_turns} turns)`,
        subtype: 'error_max_turns',
      };
    }

    if (resultMsg.subtype === 'error_during_execution') {
      const errorMessage =
        'result' in resultMsg ? String(resultMsg.result) : 'Unknown execution error';
      return {
        type: 'execution_error',
        message: errorMessage,
        subtype: 'error_during_execution',
      };
    }

    // Fallback to text-based inference only if SDK doesn't provide subtype
    if ('result' in resultMsg && resultMsg.result) {
      return {
        type: this.inferErrorTypeFromText(resultMsg.result),
        message: resultMsg.result,
      };
    }

    return {
      type: 'api_error',
      message: 'An error occurred',
    };
  }

  /**
   * Infer error type from error text (fallback only)
   * Only used when SDK doesn't provide structured error subtype
   */
  private static inferErrorTypeFromText(errorText: string): string {
    const text = errorText.toLowerCase();

    if (text.includes('invalid api key') || text.includes('please run /login')) {
      return 'authentication_error';
    }
    if (text.includes('rate limit')) {
      return 'rate_limit_error';
    }
    if (text.includes('overloaded') || text.includes('temporarily overloaded')) {
      return 'overloaded_error';
    }
    if (text.includes('permission')) {
      return 'permission_error';
    }
    if (text.includes('not found')) {
      return 'not_found_error';
    }
    if (text.includes('request too large') || text.includes('too large')) {
      return 'request_too_large';
    }
    if (text.includes('invalid request')) {
      return 'invalid_request_error';
    }

    return 'api_error';
  }

  /**
   * Format permission denial for display
   */
  static formatPermissionDenial(denial: {
    tool_name: string;
    tool_use_id: string;
    tool_input: ToolInput;
  }): {
    toolName: string;
    toolUseId: string;
    description: string;
    toolInput: ToolInput;
  } {
    return {
      toolName: denial.tool_name,
      toolUseId: denial.tool_use_id,
      description: this.formatToolDescription(denial.tool_name, denial.tool_input),
      toolInput: denial.tool_input,
    };
  }
}
