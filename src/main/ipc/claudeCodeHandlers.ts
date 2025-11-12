/**
 * IPC handlers for Claude Code SDK operations
 */

import { ClaudeCodeSDKService } from '@/services/ClaudeCodeSDKService';
import { MessageValidator } from '@/services/MessageValidator';
import type { ClaudeCodeMessage, ClaudeCodeQueryOptions } from '@/types/claudeCode.types';
import { ipcMain } from 'electron';
import log from 'electron-log/main';
import { v4 as uuidv4 } from 'uuid';

/**
 * Infer Pydantic classname from SDK message type/subtype
 * Maps to SDK types: SDKAssistantMessage, SDKResultMessage, etc.
 */
function inferPydanticClassname(message: ClaudeCodeMessage): string {
  const { type, subtype } = message;

  // Map based on type and subtype combinations
  if (type === 'system' && subtype === 'init') {
    return 'SDKSystemMessage';
  }
  if (type === 'system' && subtype === 'compact_boundary') {
    return 'SDKCompactBoundaryMessage';
  }
  if (type === 'message' || type === 'assistant') {
    return 'SDKAssistantMessage';
  }
  if (type === 'user') {
    return 'SDKUserMessage';
  }
  if (type === 'result') {
    return 'SDKResultMessage';
  }
  if (type === 'stream_event') {
    return 'SDKPartialAssistantMessage';
  }
  if (type === 'error') {
    return 'error';
  }

  // Fallback for unknown types
  return `unknown (type: ${type}, subtype: ${subtype || 'none'})`;
}
export function registerClaudeCodeHandlers(): void {
  try {
    const claudeService = ClaudeCodeSDKService.getInstance();

    /**
     * Start a Claude Code query with streaming
     */
    ipcMain.handle('claude-code:query-start', async (event, options: ClaudeCodeQueryOptions) => {
      const queryId = uuidv4();
      log.debug('[IPC Handler] QUERY START Options:', JSON.stringify(options, null, 2));

      // Start streaming in background
      setTimeout(async () => {
        try {
          // Send outgoing trace before starting query
          event.sender.send(`claude-code:trace:${queryId}`, {
            direction: 'to',
            message: {
              prompt: options.prompt,
              sessionId: options.sessionId,
              hasAttachments: !!(options.attachments && options.attachments.length > 0),
              conversationOptions: options.options,
            },
          });

          let messageCount = 0;
          for await (const message of claudeService.queryClaudeCode(queryId, options)) {
            messageCount++;

            // Infer Pydantic classname from message type/subtype
            const classname = inferPydanticClassname(message);

            // Streamlined one-line logging
            log.debug(
              `[IPC Handler] Message #${messageCount}: ${classname} (type=${message.type}, subtype=${message.subtype || 'none'}) | ${JSON.stringify(message)}`
            );

            // Validate message before sending to renderer
            const validationResult = MessageValidator.validate(message, {
              strict: false,
              enableFallback: true,
              trackSequenceNumbers: true,
            });

            // Block invalid messages AND partial extraction results
            if (!validationResult.isValid || validationResult.validationMethod === 'partial') {
              log.error('[IPC Handler] ❌ Message validation failed or partial:', {
                isValid: validationResult.isValid,
                validationMethod: validationResult.validationMethod,
                errors: validationResult.errors,
                warnings: validationResult.warnings,
                messageType: message.type,
                messagePreview: JSON.stringify(message).substring(0, 200),
              });

              // Send validation error to renderer
              event.sender.send(`claude-code:validation-error:${queryId}`, {
                error: 'Message validation failed',
                details:
                  validationResult.errors?.join(', ') ||
                  `Validation method: ${validationResult.validationMethod}`,
                validationMethod: validationResult.validationMethod,
              });

              // Continue processing - don't stop the stream
              continue;
            }

            // Log validation warnings (non-blocking)
            if (validationResult.warnings && validationResult.warnings.length > 0) {
              log.warn('[IPC Handler] ⚠️ Message validation warnings:', {
                warnings: validationResult.warnings,
                validationMethod: validationResult.validationMethod,
                messageType: message.type,
              });
            }

            // Send incoming trace for all SDK messages
            event.sender.send(`claude-code:trace:${queryId}`, {
              direction: 'from',
              message: message,
            });

            event.sender.send(`claude-code:message:${queryId}`, message);
          }
          log.debug('[IPC Handler] QUERY DONE total messages:', messageCount);
          // Send completion signal
          event.sender.send(`claude-code:complete:${queryId}`);
        } catch (error) {
          log.error('[IPC Handler] ❌ Error in queryClaudeCode:', error);
          log.error(
            '[IPC Handler] Error type:',
            error instanceof Error ? error.constructor.name : typeof error
          );
          log.error(
            '[IPC Handler] Error message:',
            error instanceof Error ? error.message : String(error)
          );
          log.error(
            '[IPC Handler] Error stack:',
            error instanceof Error ? error.stack : 'no stack'
          );
          event.sender.send(`claude-code:error:${queryId}`, {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          event.sender.send(`claude-code:complete:${queryId}`);
        }
      }, 0);

      return queryId;
    });

    /**
     * Abort a Claude Code query
     */
    ipcMain.handle('claude-code:query-abort', async (_event, queryId: string) => {
      claudeService.abortQuery(queryId);
      return { success: true };
    });

    /**
     * Get session ID for an entry
     */
    ipcMain.handle('claude-code:get-session', async (_event, entryId: string) => {
      return claudeService.getSessionId(entryId);
    });

    /**
     * Clear all sessions
     */
    ipcMain.handle('claude-code:clear-sessions', async () => {
      claudeService.clearSessions();
      return { success: true };
    });

    /**
     * Clear session for a specific entry
     */
    ipcMain.handle('claude-code:clear-session-for-entry', async (_event, entryId: string) => {
      const cleared = claudeService.clearSessionForEntry(entryId);
      return { success: true, cleared };
    });
  } catch (error) {
    log.error('[ClaudeCode Handlers] Failed to register handlers:', error);
    throw error;
  }
}
