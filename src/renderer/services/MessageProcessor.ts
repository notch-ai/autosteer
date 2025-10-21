/**
 * MessageProcessor - Unified message transformation service
 * Converts SDK messages to ChatMessage format for both streaming and file loading
 */

import { nanoid } from 'nanoid';
import { ChatMessage } from '@/entities';
import { logger } from '@/commons/utils/logger';

export interface SdkMessage {
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'system' | 'result';
  message?: {
    role?: string;
    content?: any[];
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
    id?: string;
  };
  uuid?: string;
  timestamp?: string;
  parent_tool_use_id?: string | null;
  session_id?: string;
  result?: string;
  is_error?: boolean;
}

export interface ProcessedMessage {
  chatMessage?: ChatMessage;
  type: 'content' | 'tool_use' | 'tool_result' | 'system' | 'skip';
  toolUse?: {
    id: string;
    name: string;
    input: any;
    parentToolUseId?: string | null;
  };
  toolResult?: {
    toolUseId: string;
    content: string;
    isError: boolean;
  };
}

export class MessageProcessor {
  /**
   * Process SDK message and return ChatMessage or metadata
   * @param sdkMessage - Raw message from SDK or file
   * @returns ProcessedMessage with ChatMessage and/or metadata
   */
  static processSdkMessage(sdkMessage: SdkMessage): ProcessedMessage {
    logger.debug('[MessageProcessor] Processing SDK message:', {
      type: sdkMessage.type,
      hasMessage: !!sdkMessage.message,
      uuid: sdkMessage.uuid,
    });

    switch (sdkMessage.type) {
      case 'user':
      case 'assistant':
        return this.processContentMessage(sdkMessage);

      case 'tool_use':
        return this.processToolUse(sdkMessage);

      case 'tool_result':
        return this.processToolResult(sdkMessage);

      case 'system':
      case 'result':
        // System and result messages don't create chat messages
        return { type: 'skip' };

      default:
        logger.debug('[MessageProcessor] Unhandled message type:', sdkMessage.type);
        return { type: 'skip' };
    }
  }

  /**
   * Process user or assistant content message
   */
  private static processContentMessage(sdkMessage: SdkMessage): ProcessedMessage {
    logger.debug('[MessageProcessor] Processing content message:', {
      type: sdkMessage.type,
      hasMessage: !!sdkMessage.message,
      hasContent: !!sdkMessage.message?.content,
    });

    if (!sdkMessage.message || !sdkMessage.message.content) {
      logger.debug('[MessageProcessor] No message content found');
      return { type: 'skip' };
    }

    const role = sdkMessage.type === 'user' ? 'user' : 'assistant';
    const contentArray = sdkMessage.message.content;

    if (!Array.isArray(contentArray)) {
      logger.debug('[MessageProcessor] Content is not an array');
      return { type: 'skip' };
    }

    logger.debug('[MessageProcessor] Content array:', {
      length: contentArray.length,
      types: contentArray.map((c) => c.type),
    });

    // Extract text content
    const textContent = this.extractTextContent(contentArray);
    logger.debug('[MessageProcessor] Extracted text:', {
      length: textContent.length,
      preview: textContent.substring(0, 100),
    });

    // Extract tool uses (for assistant messages)
    const toolUses = this.extractToolUses(contentArray);

    // Create ChatMessage
    const chatMessage: ChatMessage = {
      id: sdkMessage.uuid || nanoid(),
      role: role as 'user' | 'assistant',
      content: textContent,
      timestamp: sdkMessage.timestamp ? new Date(sdkMessage.timestamp) : new Date(),
      ...(role === 'assistant' && { startTime: new Date() }),
      ...(sdkMessage.message.usage && {
        tokenUsage: this.mapTokenUsage(sdkMessage.message.usage),
      }),
      ...(toolUses.length > 0 && {
        simplifiedToolCalls: toolUses.map((tu) => ({
          type: 'tool_use' as const,
          name: tu.name,
          ...(tu.description && { description: tu.description }),
        })),
      }),
    };

    logger.debug('[MessageProcessor] Created chat message:', {
      id: chatMessage.id,
      role: chatMessage.role,
      contentLength: textContent.length,
      hasToolUses: toolUses.length > 0,
    });

    return {
      type: 'content',
      chatMessage,
    };
  }

  /**
   * Process tool_use message
   */
  private static processToolUse(_sdkMessage: SdkMessage): ProcessedMessage {
    // Tool uses are embedded in assistant messages, not separate messages
    // This handles the case where they come as separate events during streaming
    return { type: 'tool_use' };
  }

  /**
   * Process tool_result message
   */
  private static processToolResult(_sdkMessage: SdkMessage): ProcessedMessage {
    // Tool results are typically not displayed as separate messages
    return { type: 'tool_result' };
  }

  /**
   * Extract text content from content array
   */
  private static extractTextContent(contentArray: any[]): string {
    return contentArray
      .filter((c) => c.type === 'text')
      .map((c) => c.text || '')
      .join('');
  }

  /**
   * Extract tool uses from content array
   */
  private static extractToolUses(
    contentArray: any[]
  ): Array<{ name: string; description?: string }> {
    return contentArray
      .filter((c) => c.type === 'tool_use')
      .map((c) => {
        const toolData = c.tool_use || c;
        let description: string | undefined;

        // Extract description from tool input
        if (toolData.input) {
          switch (toolData.name) {
            case 'Read':
              description = toolData.input.file_path;
              break;
            case 'Write':
            case 'Edit':
              description = toolData.input.file_path;
              break;
            case 'Bash':
              description = toolData.input.command;
              break;
            case 'Grep':
              description = toolData.input.pattern;
              break;
            default:
              if (toolData.input.path) description = toolData.input.path;
              else if (toolData.input.file_path) description = toolData.input.file_path;
              else if (toolData.input.query) description = toolData.input.query;
          }
        }

        return {
          name: toolData.name,
          ...(description && { description }),
        };
      });
  }

  /**
   * Map SDK token usage to ChatMessage token usage format
   */
  private static mapTokenUsage(usage: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  }) {
    const result: {
      inputTokens?: number;
      outputTokens?: number;
      cacheCreationInputTokens?: number;
      cacheReadInputTokens?: number;
    } = {};

    if (usage.input_tokens !== undefined) result.inputTokens = usage.input_tokens;
    if (usage.output_tokens !== undefined) result.outputTokens = usage.output_tokens;
    if (usage.cache_creation_input_tokens !== undefined)
      result.cacheCreationInputTokens = usage.cache_creation_input_tokens;
    if (usage.cache_read_input_tokens !== undefined)
      result.cacheReadInputTokens = usage.cache_read_input_tokens;

    return result;
  }

  /**
   * Batch process multiple SDK messages
   * Useful for loading message history from files
   */
  static processSdkMessages(sdkMessages: SdkMessage[]): ChatMessage[] {
    const chatMessages: ChatMessage[] = [];

    for (const sdkMessage of sdkMessages) {
      const processed = this.processSdkMessage(sdkMessage);
      if (processed.chatMessage) {
        chatMessages.push(processed.chatMessage);
      }
    }

    logger.debug('[MessageProcessor] Batch processed messages:', {
      input: sdkMessages.length,
      output: chatMessages.length,
    });

    return chatMessages;
  }
}
