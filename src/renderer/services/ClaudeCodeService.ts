/**
 * Service for interacting with Claude Code SDK via IPC
 */

import { toastError } from '@/components/ui/sonner';
import { setupAutoBadgeClear, showBadgeIfNotFocused } from '@/renderer/utils/badgeUtils';
import {
  ConversationOptions,
  ResultMessage,
  StreamingChunk,
  SystemMessage,
  ToolResultMessage,
  ToolUseMessage,
} from '../../types/streaming.types';
import { logger } from './LoggerService';
import { MessageProcessor } from './MessageProcessor';
import { getTodoMonitor } from './TodoActivityMonitorManager';

// Type for IPC listener function - using any for event to avoid Electron dependency
type IpcListener = (event: any, ...args: unknown[]) => void;

export interface Attachment {
  type: 'image' | 'document' | 'code' | 'other';
  media_type: string;
  data: string; // base64
  filename?: string;
}

export interface ClaudeCodeOptions {
  apiKey?: string | undefined;
  abortController?: AbortController;
  sessionId?: string;
  conversationOptions?: ConversationOptions;
  attachments?: Attachment[];
  projectId?: string; // Add projectId for worktree context
  resume?: string; // Claude session ID to resume
  parentMessageId?: string; // ChatMessage ID for consistent todo ID generation
}

export interface ClaudeStreamingCallbacks {
  onChunk?: (chunk: StreamingChunk) => void;
  onSystem?: (message: SystemMessage) => void;
  onToolUse?: (message: ToolUseMessage) => void;
  onToolResult?: (message: ToolResultMessage) => void;
  onResult?: (message: ResultMessage) => void;
  onError?: (error: Error) => void;
  onComplete?: (finalContent: string) => void;
  onTrace?: (direction: 'to' | 'from', message: any) => void;
}

export class ClaudeCodeService {
  private activeQueries: Map<
    string,
    {
      callbacks: ClaudeStreamingCallbacks;
      cleanup: () => void;
      abortController?: AbortController;
      sessionId?: string; // Track which session this query belongs to
    }
  > = new Map();
  // Map agent/session IDs to their abort controllers (not worktree IDs)
  private agentAbortControllers: Map<string, AbortController> = new Map();
  private interruptedSessions: Map<string, number> = new Map();

  constructor() {
    // No need to set API key here, it will be passed with each query

    // Set up automatic badge clearing on window focus
    setupAutoBadgeClear();

    // Clean up old interrupted sessions every minute
    setInterval(() => {
      const now = Date.now();
      for (const [sessionId, timestamp] of this.interruptedSessions.entries()) {
        if (now - timestamp > 60000) {
          // Remove after 1 minute
          this.interruptedSessions.delete(sessionId);
        }
      }
    }, 60000);
  }

  /**
   * Query Claude Code SDK with streaming support
   */
  async queryWithStreaming(
    prompt: string,
    options: ClaudeCodeOptions,
    callbacks: ClaudeStreamingCallbacks
  ): Promise<string> {
    const ipcRenderer = window.electron.ipcRenderer;
    if (!ipcRenderer) {
      throw new Error(
        'IPC renderer not available. Make sure this is running in Electron renderer process.'
      );
    }

    // Force cleanup of any existing query for this session before starting a new one
    if (options.sessionId) {
      const existingQuery = Array.from(this.activeQueries.entries()).find(
        ([_, queryInfo]) => queryInfo.sessionId === options.sessionId
      );

      if (existingQuery) {
        const [queryId, queryInfo] = existingQuery;
        logger.debug('[ClaudeCodeService] Forcing cleanup of existing query for session:', {
          sessionId: options.sessionId,
          oldQueryId: queryId,
        });

        ipcRenderer?.invoke?.('claude-code:query-abort', queryId)?.catch?.(() => {
          // Ignore errors from abort
        });

        queryInfo.cleanup();

        if (queryInfo.abortController && !queryInfo.abortController.signal.aborted) {
          queryInfo.abortController.abort();
        }

        this.activeQueries.delete(queryId);
      }
    }

    // Set up logging context if we have project and session info
    if (options.projectId && options.sessionId) {
      // Get the branch name from the project config
      const config = await window.electron?.ipcRenderer?.invoke('config:read');
      const worktree = config?.worktrees?.find((w: any) => w.folder_name === options.projectId);
      const branchName = worktree?.branch_name || options.projectId;

      // Update logger context with branch-agent info
      logger.updateContext({
        branchName: branchName,
        agentId: options.sessionId,
        projectId: options.projectId,
      });

      logger.info('Starting Claude CLI query', {
        promptLength: prompt.length,
        hasAttachments: !!options.attachments?.length,
        resumeSession: !!options.resume,
      });
    }

    // Get the TodoActivityMonitor for this specific agent
    const todoMonitor = options.sessionId ? getTodoMonitor(options.sessionId) : null;

    const {
      abortController = new AbortController(),
      sessionId,
      conversationOptions,
      attachments,
      resume,
      parentMessageId,
    } = options;

    // Build query options for main process
    // Don't send API key for local Claude Code installations
    const queryOptions = {
      prompt,
      sessionId,
      attachments, // Pass attachments to main process
      options: {
        // Only set maxTurns if it's explicitly a number (null/undefined = unlimited, don't set)
        ...(typeof conversationOptions?.max_turns === 'number' && {
          maxTurns: conversationOptions.max_turns,
        }),
        ...(conversationOptions?.system_prompt && {
          systemPrompt: conversationOptions.system_prompt,
        }),
        ...(conversationOptions?.allowed_tools && {
          allowedTools: conversationOptions.allowed_tools,
        }),
        ...(conversationOptions?.model && { model: conversationOptions.model }),
        ...(conversationOptions?.cwd && { cwd: conversationOptions.cwd }),
        ...(conversationOptions?.max_thinking_tokens && {
          maxThinkingTokens: conversationOptions.max_thinking_tokens,
        }),
        ...(conversationOptions?.permission_mode && {
          permissionMode: conversationOptions.permission_mode,
        }),
        ...(resume && { resume }), // Pass the Claude session ID to resume
      },
    };

    // Log when "/" is entered as prompt
    if (prompt.startsWith('/')) {
      logger.debug('[ClaudeCodeService] ========== SLASH COMMAND DETECTED ==========');
      logger.debug('[ClaudeCodeService] Prompt:', prompt);
      logger.debug('[ClaudeCodeService] Session ID:', sessionId);
      logger.debug('[ClaudeCodeService] Working directory:', conversationOptions?.cwd);
      logger.debug(
        '[ClaudeCodeService] Full query options:',
        JSON.stringify(queryOptions, null, 2)
      );
    }

    return new Promise((resolve, reject) => {
      let finalContent = '';
      let currentContent = '';
      const startTime = Date.now();
      let isAborted = false;
      let hasReceivedErrorInResult = false;

      // Start query and get queryId
      logger.debug(
        '[DEBUG ClaudeCodeService] Invoking claude-code:query-start with:',
        queryOptions
      );
      ipcRenderer
        ?.invoke?.('claude-code:query-start', queryOptions)
        .then((queryId: string) => {
          logger.debug('[DEBUG ClaudeCodeService] Received queryId:', queryId);
          // Set up listeners for this query
          const messageListener = (_event: any, message: any) => {
            logger.debug('[DEBUG ClaudeCodeService] Message received:', {
              type: message.type,
              queryId,
              isAborted,
            });

            // Check if this is a result message with an error
            if (message.type === 'result' && (message.error || message.is_error)) {
              hasReceivedErrorInResult = true;
            }

            this.handleClaudeMessage(
              message,
              callbacks,
              currentContent,
              startTime,
              (content: string) => {
                currentContent = content;
              },
              todoMonitor,
              parentMessageId,
              options.sessionId
            );
          };

          const completeListener = async () => {
            logger.debug('[DEBUG ClaudeCodeService] Complete event received', {
              isAborted,
            });

            finalContent = currentContent;

            // Show badge notification if window is not focused (even if aborted)
            await showBadgeIfNotFocused();

            // Call onComplete callback to clear streaming state
            if (callbacks.onComplete) {
              callbacks.onComplete(finalContent);
            }

            cleanup();

            if (isAborted) {
              // Resolve with current content instead of rejecting
              // This allows the "[Request interrupted]" message to be displayed
              resolve(finalContent);
            } else {
              resolve(finalContent);
            }
          };

          const errorListener: IpcListener = (_event, ...args) => {
            const data = args[0] as { error: string };
            const error = new Error(data.error);

            // Only call onError if we haven't already handled an error in the result message
            // This prevents chatError from being set after onComplete has cleared it
            if (callbacks.onError && !hasReceivedErrorInResult) {
              callbacks.onError(error);
            }
          };

          const traceListener: IpcListener = (_event, ...args) => {
            const data = args[0] as { direction: 'to' | 'from'; message: any };
            if (callbacks.onTrace) {
              callbacks.onTrace(data.direction, data.message);
            }
          };

          const validationErrorListener: IpcListener = (_event, ...args) => {
            const data = args[0] as { error: string; details: string; validationMethod: string };
            logger.error('[ClaudeCodeService] Message validation error:', {
              error: data.error,
              details: data.details,
              validationMethod: data.validationMethod,
            });

            // Show error toast directly without breaking the chat flow
            toastError(`Validation Error: ${data.details}`, { duration: 5000 });
          };

          // Cleanup function
          const cleanup = () => {
            logger.debug('[DEBUG ClaudeCodeService] Cleanup called', {
              queryId,
              isAborted,
            });
            ipcRenderer?.removeListener?.(`claude-code:message:${queryId}`, messageListener);
            ipcRenderer?.removeListener?.(`claude-code:complete:${queryId}`, completeListener);
            ipcRenderer?.removeListener?.(`claude-code:error:${queryId}`, errorListener);
            ipcRenderer?.removeListener?.(`claude-code:trace:${queryId}`, traceListener);
            ipcRenderer?.removeListener?.(
              `claude-code:validation-error:${queryId}`,
              validationErrorListener
            );
            this.activeQueries.delete(queryId);
            // Clean up agent-specific abort controller if it matches
            if (options?.sessionId) {
              const storedController = this.agentAbortControllers.get(options.sessionId);
              if (storedController === abortController) {
                this.agentAbortControllers.delete(options.sessionId);
              }
            }
          };

          // Register listeners
          ipcRenderer?.on?.(`claude-code:message:${queryId}`, messageListener);
          ipcRenderer?.on?.(`claude-code:complete:${queryId}`, completeListener);
          ipcRenderer?.on?.(`claude-code:error:${queryId}`, errorListener);
          ipcRenderer?.on?.(`claude-code:trace:${queryId}`, traceListener);
          ipcRenderer?.on?.(`claude-code:validation-error:${queryId}`, validationErrorListener);

          // Store query info for abort capability
          this.activeQueries.set(queryId, {
            callbacks,
            cleanup,
            abortController,
            ...(options?.sessionId && { sessionId: options.sessionId }),
          });
          // Store abort controller by agent/session ID if provided
          if (options?.sessionId) {
            // Abort any existing controller for this specific agent
            const existingController = this.agentAbortControllers.get(options.sessionId);
            if (existingController) {
              existingController.abort();
            }
            this.agentAbortControllers.set(options.sessionId, abortController);
          }

          // Handle abort
          abortController.signal.addEventListener('abort', () => {
            logger.debug('[DEBUG ClaudeCodeService] Abort signal received');
            isAborted = true;
            // Tell main process to abort the query
            ipcRenderer?.invoke?.('claude-code:query-abort', queryId)?.catch?.(() => {
              // Ignore errors from abort
            });
            // Don't cleanup immediately - let the complete/error listeners handle it
            // This allows the SDK to send the "[Request interrupted by user]" message
            // and the result message before we tear down the listeners
          });
        })
        .catch((error) => {
          logger.error('[DEBUG ClaudeCodeService] Failed to invoke query-start:', error);
          if (callbacks.onError) {
            callbacks.onError(error instanceof Error ? error : new Error('Unknown error'));
          }
          reject(error);
        });
    });
  }

  /**
   * Handle Claude message from main process
   */
  private handleClaudeMessage(
    message: any,
    callbacks: ClaudeStreamingCallbacks,
    currentContent: string,
    startTime: number,
    updateContent: (content: string) => void,
    todoMonitor?: any,
    parentMessageId?: string,
    sessionId?: string
  ): void {
    switch (message.type) {
      case 'system':
        if (callbacks.onSystem) {
          if (message.subtype === 'init') {
            callbacks.onSystem({
              type: 'system',
              subtype: 'init',
              data: message.content,
              session_id: message.session_id,
              // Pass through MCP servers list from init message
              ...(message.mcp_servers && {
                mcp_servers: message.mcp_servers,
              }),
            });
          } else if (message.subtype === 'compact_boundary') {
            callbacks.onSystem({
              type: 'system',
              subtype: 'compact_boundary',
              data: message.content,
              session_id: message.session_id,
              compact_metadata: message.compact_metadata,
            });
          }
        }
        break;

      case 'assistant':
        // Handle assistant messages using MessageProcessor
        logger.debug('[ClaudeCodeService] Assistant message received');

        // Clear interruption flag when we receive real content
        if (sessionId && this.interruptedSessions.has(sessionId)) {
          logger.debug('[ClaudeCodeService] Clearing interruption flag for session:', sessionId);
          this.interruptedSessions.delete(sessionId);
        }

        let assistantProcessed;
        try {
          assistantProcessed = MessageProcessor.processSdkMessage(message);
        } catch (error) {
          logger.error('[ClaudeCodeService] Message processing failed:', error);
          // Propagate error through onError callback to trigger ErrorBoundary
          if (callbacks.onError) {
            callbacks.onError(
              error instanceof Error
                ? error
                : new Error(`Message processing failed: ${String(error)}`)
            );
          }
          return; // Stop processing this message
        }

        if (assistantProcessed.chatMessage) {
          const chatMsg = assistantProcessed.chatMessage;

          // Send token data if available
          if (chatMsg.tokenUsage && callbacks.onChunk) {
            callbacks.onChunk({
              type: 'partial',
              content: currentContent,
              done: false,
              tokenUsage: chatMsg.tokenUsage,
              messageId: chatMsg.id,
              messageType: 'assistant',
            });
          }

          // Send text content if available
          if (chatMsg.content && callbacks.onChunk) {
            logger.debug('[ClaudeCodeService] Text content received:', {
              textLength: chatMsg.content.length,
              textPreview: chatMsg.content.substring(0, 100),
              isInterruptedMessage: chatMsg.content.includes('Request interrupted'),
            });

            callbacks.onChunk({
              type: 'partial',
              content: chatMsg.content,
              done: false,
              isNewMessage: true,
            });

            currentContent += chatMsg.content;
            updateContent(currentContent);
          }

          // Handle tool uses from message content
          if (message.message?.content && Array.isArray(message.message.content)) {
            const contentArray = message.message.content;
            for (const content of contentArray) {
              if (content.type === 'tool_use') {
                const toolData = content.tool_use || content;

                if (callbacks.onToolUse) {
                  callbacks.onToolUse({
                    type: 'tool_use',
                    tool_id: toolData.id,
                    tool_name: toolData.name,
                    tool_input: toolData.input,
                    parent_tool_use_id: message.parent_tool_use_id || null,
                  });
                }

                // Process all tool uses for the activity monitor
                if (todoMonitor && parentMessageId) {
                  todoMonitor.onMessage({
                    id: toolData.id,
                    type: 'tool_use',
                    timestamp: new Date().toISOString(),
                    tool_name: toolData.name,
                    tool_input: toolData.input,
                    parent_tool_use_id: message.parent_tool_use_id || null,
                    parent_message_id: parentMessageId,
                  });
                }
              }
            }
          }
        }
        break;

      case 'result':
        // Filter out error messages from recently interrupted sessions
        if (sessionId && message.subtype === 'error_during_execution') {
          const interruptedAt = this.interruptedSessions.get(sessionId);
          if (interruptedAt && Date.now() - interruptedAt < 15000) {
            logger.debug('[ClaudeCodeService] Filtering error message from interrupted session:', {
              sessionId,
              timeSinceInterrupt: Date.now() - interruptedAt,
            });
            return;
          }
        }

        // Final result message
        if (callbacks.onResult) {
          const duration = Date.now() - startTime;
          const resultMessage: ResultMessage = {
            type: 'result' as const,
            subtype: message.subtype,
            duration_ms: message.duration_ms || duration,
            is_error: message.is_error || false,
            total_cost_usd: message.total_cost_usd,
            usage: message.usage,
            modelUsage: message.modelUsage,
            session_id: message.session_id,
            stop_reason: message.stop_reason,
            stop_sequence: message.stop_sequence,
            request_id: message.request_id,
            ...(message.__permissionRequest && {
              __permissionRequest: message.__permissionRequest,
            }),
            ...(message.error && {
              error: message.error,
            }),
          };

          callbacks.onResult(resultMessage);

          // Log the result with structured logging
          logger.info('Claude CLI query completed', {
            duration: duration,
            isError: message.is_error || false,
            totalCost: message.total_cost_usd,
            tokenUsage: message.usage,
            sessionId: message.session_id,
          });

          // Log the formatted Claude response to file
          logger.logClaudeResponse({
            result: resultMessage,
            usage: message.usage,
            todos: todoMonitor?.getRecentTodos ? todoMonitor.getRecentTodos() : [],
          });
        }

        // Send final complete chunk
        if (callbacks.onChunk) {
          callbacks.onChunk({
            type: 'complete',
            content: currentContent,
            done: true,
          });
        }

        // Call onComplete
        if (callbacks.onComplete) {
          callbacks.onComplete(currentContent);
        }
        break;

      case 'tool_result':
        // Tool result received
        if (callbacks.onToolResult && message.message) {
          callbacks.onToolResult({
            type: 'tool_result',
            tool_use_id: message.parent_tool_use_id || message.message.tool_use_id || '',
            content: message.result || message.message.content || '',
            is_error: message.is_error || false,
          });
        }
        break;

      case 'user':
        // Handle user messages (e.g., "[Request interrupted by user]")
        logger.debug('[ClaudeCodeService] User message received');

        // Filter out "[Request interrupted by user]" messages from recently interrupted sessions
        if (sessionId && message.message?.content) {
          const interruptedAt = this.interruptedSessions.get(sessionId);
          if (interruptedAt && Date.now() - interruptedAt < 15000) {
            // Check if this is an interruption message
            const content = Array.isArray(message.message.content)
              ? message.message.content[0]?.text
              : message.message.content;
            if (content === '[Request interrupted by user]') {
              logger.debug('[ClaudeCodeService] Filtering interrupted user message:', {
                sessionId,
                timeSinceInterrupt: Date.now() - interruptedAt,
              });
              return;
            }
          }
        }

        // Extract and handle tool_result items from user message content
        if (message.message?.content && Array.isArray(message.message.content)) {
          for (const contentItem of message.message.content) {
            if (contentItem.type === 'tool_result' && callbacks.onToolResult) {
              callbacks.onToolResult({
                type: 'tool_result',
                tool_use_id: contentItem.tool_use_id || '',
                content: contentItem.content || '',
                is_error: contentItem.is_error || false,
              });
            }
          }
        }

        const userProcessed = MessageProcessor.processSdkMessage(message);
        logger.debug('[ClaudeCodeService] User message processed:', {
          hasMessage: !!userProcessed.chatMessage,
          content: userProcessed.chatMessage?.content,
          type: userProcessed.type,
        });

        if (userProcessed.chatMessage && callbacks.onChunk) {
          logger.debug('[ClaudeCodeService] Sending user message chunk:', {
            content: userProcessed.chatMessage.content,
            isNewMessage: true,
          });

          callbacks.onChunk({
            type: 'partial',
            content: userProcessed.chatMessage.content,
            done: false,
            isNewMessage: true,
            messageType: 'user',
          });
        } else {
          logger.debug('[ClaudeCodeService] Not sending chunk:', {
            hasMessage: !!userProcessed.chatMessage,
            hasCallback: !!callbacks.onChunk,
          });
        }
        break;

      default:
        // Unhandled message type
        logger.debug('[ClaudeCodeService] Unhandled message type:', message.type);
        break;
    }
  }

  /**
   * Get Claude session ID for an entry ID
   */
  async getSessionId(entryId: string): Promise<string | undefined> {
    const ipcRenderer = window.electron.ipcRenderer;
    if (!ipcRenderer) {
      throw new Error(
        'IPC renderer not available. Make sure this is running in Electron renderer process.'
      );
    }
    return await ipcRenderer?.invoke?.('claude-code:get-session', entryId);
  }

  /**
   * Clear session mapping
   */
  async clearSessions(): Promise<void> {
    const ipcRenderer = window.electron.ipcRenderer;
    if (!ipcRenderer) {
      throw new Error(
        'IPC renderer not available. Make sure this is running in Electron renderer process.'
      );
    }
    await ipcRenderer?.invoke?.('claude-code:clear-sessions');
  }

  /**
   * Clear session for a specific entry
   */
  async clearSessionForEntry(entryId: string): Promise<boolean> {
    const ipcRenderer = window.electron.ipcRenderer;
    if (!ipcRenderer) {
      throw new Error(
        'IPC renderer not available. Make sure this is running in Electron renderer process.'
      );
    }
    const result = await ipcRenderer?.invoke?.('claude-code:clear-session-for-entry', entryId);
    return result.cleared;
  }

  /**
   * Stop the streaming query for a specific agent
   * @param agentId - The ID of the agent/session to stop streaming for
   */
  stopStreaming(agentId?: string): void {
    logger.debug('[DEBUG stopStreaming] Called with agentId:', agentId);
    logger.debug(
      '[DEBUG stopStreaming] Available controllers:',
      Array.from(this.agentAbortControllers.keys())
    );

    if (agentId) {
      // Mark session as interrupted
      this.interruptedSessions.set(agentId, Date.now());

      // Stop streaming for specific agent
      const controller = this.agentAbortControllers.get(agentId);
      if (controller) {
        logger.debug('[DEBUG stopStreaming] Found controller for agent, aborting:', agentId);
        controller.abort();
        this.agentAbortControllers.delete(agentId);
      }
    } else {
      // Fallback: stop all streaming (backward compatibility)
      // This shouldn't be used but kept for safety
      logger.debug('[DEBUG stopStreaming] No agentId provided, aborting all controllers');
      this.agentAbortControllers.forEach((controller) => controller.abort());
      this.agentAbortControllers.clear();
    }
  }
}

// Export singleton instance
export const claudeCodeService = new ClaudeCodeService();
