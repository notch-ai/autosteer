/**
 * MessageProcessor - Deprecated legacy message transformation service
 * DEPRECATED: This service is marked for removal in Work Package 4
 * Use chat.selectors.ts for message transformation instead
 *
 * Minimal implementation to maintain compatibility until full removal
 */

import { ComputedMessage } from '@/stores/chat.selectors';
import type { SDKMessage } from '@/types/sdk.types';

/**
 * Result of processing an SDK message
 */
export interface ProcessedMessage {
  chatMessage?: ComputedMessage;
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
   * Process SDK message and return ComputedMessage
   * Transforms SDK message format to UI-ready ComputedMessage
   * @param sdkMessage - Raw message from SDK or file
   * @returns ProcessedMessage with ComputedMessage
   */
  static processSdkMessage(sdkMessage: SDKMessage): ProcessedMessage {
    // Only process assistant and user messages that have a message property
    if (sdkMessage.type !== 'assistant' && sdkMessage.type !== 'user') {
      return { type: 'skip' };
    }

    const message = (sdkMessage as any).message;
    if (!message) {
      return { type: 'skip' };
    }

    // Extract content as string
    let content = '';
    if (Array.isArray(message.content)) {
      // Validate all content blocks
      for (const block of message.content) {
        if (block.type === 'text') {
          if (block.text === null || block.text === undefined) {
            throw new Error(
              `Invalid message: text block has null/undefined text. Block: ${JSON.stringify(block)}`
            );
          }
        } else if (block.type === 'tool_use') {
          if (!block.id || typeof block.name !== 'string' || typeof block.input !== 'object') {
            throw new Error(
              `Invalid message: tool_use block missing required fields (id, name, input). Block: ${JSON.stringify(block)}`
            );
          }
        }
      }

      const textBlocks = message.content.filter((block: any) => block.type === 'text');
      content = textBlocks.map((block: any) => block.text).join('\n');
    } else if (typeof message.content === 'string') {
      content = message.content;
    }

    // Create ComputedMessage
    const chatMessage: ComputedMessage = {
      id: (sdkMessage as any).uuid || message.id || `msg-${Date.now()}`,
      role: message.role as 'user' | 'assistant',
      content,
      timestamp: new Date(),
    };

    // Add token usage if available
    if (message.usage) {
      chatMessage.tokenUsage = {
        inputTokens: message.usage.input_tokens || 0,
        outputTokens: message.usage.output_tokens || 0,
        cacheCreationInputTokens: message.usage.cache_creation_input_tokens,
        cacheReadInputTokens: message.usage.cache_read_input_tokens,
      };
    }

    return {
      type: 'content',
      chatMessage,
    };
  }

  /**
   * Batch process multiple SDK messages
   * DEPRECATED: Minimal stub implementation
   */
  static processSdkMessages(_sdkMessages: SDKMessage[]): ComputedMessage[] {
    return [];
  }
}
