/**
 * Message Filtering Utilities
 *
 * Centralized filtering logic for synthetic messages across the application.
 * Synthetic messages are tool invocations and skill calls that should not appear in UI.
 *
 * Defense-in-depth approach with 5 synthetic indicators:
 * 1. sourceToolUseId - Messages created from tool outputs
 * 2. isSynthetic - Explicitly marked synthetic messages
 * 3. parentUuid - Messages with parent relationships
 * 4. parent_tool_use_id - Messages created from tool invocations (SDK field)
 * 5. Text content starting with <command-message> - Skill/command execution messages
 *
 * Usage:
 * ```typescript
 * import { isSyntheticMessage } from '@/commons/utils/message-filters';
 *
 * // JSONL path (main process)
 * if (isSyntheticMessage(data)) {
 *   continue;
 * }
 *
 * // Streaming path (renderer process)
 * if (isSyntheticMessage(message)) {
 *   return;
 * }
 * ```
 */
import log from 'electron-log';

/**
 * Type definition for message content
 */
export interface MessageContent {
  type?: string;
  text?: string;
  [key: string]: any;
}

/**
 * Type definition for messages with synthetic indicators
 * Supports both SDK messages and raw JSONL data
 */
export interface MessageWithSyntheticIndicators {
  type?: string;
  role?: string;
  sourceToolUseId?: string | null;
  isSynthetic?: boolean;
  parentUuid?: string | null;
  parent_tool_use_id?: string | null;
  message?: {
    content?: string | MessageContent | MessageContent[];
    [key: string]: any;
  };
  content?: string | MessageContent | MessageContent[];
}

/**
 * Helper function to extract text content from message
 * Handles both direct content and nested message.content
 */
function getMessageText(message: MessageWithSyntheticIndicators): string | null {
  // Check direct content field
  const content = message.content || message.message?.content;

  if (!content) {
    return null;
  }

  // Handle string content
  if (typeof content === 'string') {
    return content;
  }

  // Handle array of content blocks
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === 'text' && block.text) {
        return block.text;
      }
    }
  }

  // Handle single content block
  if (typeof content === 'object' && 'text' in content) {
    return content.text || null;
  }

  return null;
}

/**
 * Determines if a message is synthetic and should be filtered from UI
 *
 * Defense-in-depth approach checks 5 indicators:
 * 1. sourceToolUseId - Messages created from tool outputs (JSONL custom field)
 * 2. isSynthetic - Explicitly marked synthetic messages (official SDK field)
 * 3. parentUuid - Messages with parent relationships (JSONL custom field)
 * 4. parent_tool_use_id - Messages created from tool invocations (SDK field)
 * 5. Text content starting with <command-message> - Skill/command execution messages
 *
 * Only applies to user messages (type='user' or role='user')
 *
 * @param message - Message to check (SDK message or raw JSONL data)
 * @returns true if message is synthetic and should be filtered
 */
export function isSyntheticMessage(message: MessageWithSyntheticIndicators): boolean {
  // Early exit: Only check user messages
  if (message.type !== 'user' && message.role !== 'user') {
    return false;
  }

  // Check 1: sourceToolUseId (synthetic messages created from tool outputs)
  if (message.sourceToolUseId !== null && message.sourceToolUseId !== undefined) {
    return true;
  }

  // Check 2: isSynthetic flag (explicitly marked synthetic messages)
  if (message.isSynthetic === true) {
    return true;
  }

  // Check 3: parentUuid (messages with parent relationships are synthetic)
  if (message.parentUuid !== null && message.parentUuid !== undefined) {
    return true;
  }

  // Check 4: parent_tool_use_id (messages created from tool invocations)
  if (message.parent_tool_use_id !== null && message.parent_tool_use_id !== undefined) {
    return true;
  }

  // Check 5: Text content starting with <command-message> (skill/command execution)
  const text = getMessageText(message);
  if (text && text.trim().startsWith('<command-message>')) {
    return true;
  }

  log.info(`[MessageFilters] isSyntheticMessage FALSE: ${JSON.stringify(message, null, 2)}`);

  return false;
}
