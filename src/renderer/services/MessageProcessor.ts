/**
 * MessageProcessor - Unified message transformation service
 * Converts SDK messages to ChatMessage format for both streaming and file loading
 *
 * NOTE: This now delegates to MessageConverter for all transformations
 */

import { ChatMessage } from '@/entities';
import { logger } from '@/commons/utils/logger';
import { MessageConverter } from '@/services/MessageConverter';
import type { SDKMessage } from '@/types/sdk.types';

/**
 * Result of processing an SDK message
 */
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
  static processSdkMessage(sdkMessage: SDKMessage): ProcessedMessage {
    logger.debug('[MessageProcessor] Processing SDK message:', {
      type: sdkMessage.type,
      uuid: sdkMessage.uuid,
    });

    // Delegate to MessageConverter for all transformations
    const converted = MessageConverter.convert(sdkMessage);

    if (converted.chatMessage) {
      return {
        type: 'content',
        chatMessage: converted.chatMessage,
      };
    }

    // Handle non-displayable messages
    switch (converted.sourceType) {
      case 'system':
        return { type: 'system' };
      case 'result':
        return { type: 'skip' };
      default:
        return { type: 'skip' };
    }
  }

  /**
   * Batch process multiple SDK messages
   * Useful for loading message history from files
   */
  static processSdkMessages(sdkMessages: SDKMessage[]): ChatMessage[] {
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
