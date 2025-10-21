/**
 * IPC handlers for Claude Code SDK operations
 */

import { ClaudeCodeSDKService } from '@/services/ClaudeCodeSDKService';
import type { ClaudeCodeQueryOptions } from '@/types/claudeCode.types';
import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import log from 'electron-log/main';

export function registerClaudeCodeHandlers(): void {
  log.info('[ClaudeCode Handlers] Starting handler registration');

  try {
    const claudeService = ClaudeCodeSDKService.getInstance();
    log.info('[ClaudeCode Handlers] Successfully got ClaudeCodeSDKService instance');

    /**
     * Start a Claude Code query with streaming
     */
    ipcMain.handle('claude-code:query-start', async (event, options: ClaudeCodeQueryOptions) => {
      const queryId = uuidv4();
      log.debug('[IPC Handler] ========== QUERY START ==========');
      log.debug('[IPC Handler] Query ID:', queryId);
      log.debug('[IPC Handler] Options:', JSON.stringify(options, null, 2));
      log.debug('[IPC Handler] claudeService type:', typeof claudeService);
      log.debug(
        '[IPC Handler] claudeService.queryClaudeCode type:',
        typeof claudeService.queryClaudeCode
      );

      // Start streaming in background
      setTimeout(async () => {
        try {
          log.debug('[IPC Handler] ========== CALLING SDK SERVICE ==========');
          log.debug('[IPC Handler] About to call claudeService.queryClaudeCode');
          let messageCount = 0;
          for await (const message of claudeService.queryClaudeCode(queryId, options)) {
            messageCount++;
            log.debug('[IPC Handler] ========== Message #' + messageCount + ' ==========');
            log.debug('[IPC Handler] Message type:', message.type);
            log.debug('[IPC Handler] Message:', JSON.stringify(message, null, 2));
            // Send each message to renderer
            log.debug(
              '[IPC Handler] Sending to renderer on channel:',
              `claude-code:message:${queryId}`
            );
            event.sender.send(`claude-code:message:${queryId}`, message);
            log.debug('[IPC Handler] Message sent to renderer');
          }
          log.debug('[IPC Handler] ========== STREAM COMPLETE ==========');
          log.debug('[IPC Handler] Total messages:', messageCount);
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

    log.info('[ClaudeCode Handlers] Successfully registered all Claude Code IPC handlers');
  } catch (error) {
    log.error('[ClaudeCode Handlers] Failed to register handlers:', error);
    throw error;
  }
}
