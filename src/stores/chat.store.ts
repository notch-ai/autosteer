/**
 * Chat Store - Chat State Management
 *
 * Handles chat messages, streaming, attachments, and session management
 *
 * Key features:
 * - Message history per agent/chat
 * - Real-time streaming message updates
 * - Attachment management
 * - Session ID tracking for Claude conversations
 * - Tool use and trace tracking
 * - Token usage and cost tracking
 * - Worktree statistics integration
 * - Background sync for chat history
 *
 * @see docs/guides-architecture.md - Multi-Agent Session Architecture
 */

import { logger } from '@/commons/utils/logger';
import { ChatMessage } from '@/entities';
import {
  claudeCodeService,
  type Attachment as ClaudeAttachment,
} from '@/renderer/services/ClaudeCodeService';
import { globalErrorHandler } from '@/renderer/services/GlobalErrorHandler';
import { getTodoMonitor } from '@/renderer/services/TodoActivityMonitorManager';
import { MessageConverter } from '@/services/MessageConverter';
import { PermissionMode } from '@/types/permission.types';
import type { ConversationOptions } from '@/types/streaming.types';
import { enableMapSet } from 'immer';
import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useAgentsStore } from './agents.store';
import { useSettingsStore } from './settings';
import { useWorktreeStatsStore } from './worktreestats.store';
import { useContextUsageStore } from './contextusage.store';
import { useProjectsStore } from './projects.store';
import { Attachment, StreamChunk, StreamingMessage } from './types';

// Enable MapSet plugin for Immer to work with Map objects
enableMapSet();

// DevTools configuration - only in development
const withDevtools = process.env.NODE_ENV === 'development' ? devtools : (f: any) => f;

// Streaming state batching configuration
const STREAMING_BATCH_WINDOW_MS = 50; // 50ms batching window for streaming updates
let streamingBatchTimeout: NodeJS.Timeout | null = null;
let pendingStreamingUpdates: Array<() => void> = [];

/**
 * Batch streaming state updates to reduce re-render frequency during streaming
 * Collects updates in a 50ms window and applies them together
 */
function batchStreamingUpdate(updateFn: () => void) {
  pendingStreamingUpdates.push(updateFn);

  if (streamingBatchTimeout) {
    return; // Already scheduled
  }

  streamingBatchTimeout = setTimeout(() => {
    const updates = [...pendingStreamingUpdates];
    pendingStreamingUpdates = [];
    streamingBatchTimeout = null;

    // Apply all batched updates in a single state update
    updates.forEach((fn) => fn());
  }, STREAMING_BATCH_WINDOW_MS);
}

/**
 * TraceEntry Interface
 * Represents a trace entry for debugging SDK communication
 */
interface TraceEntry {
  id: string;
  timestamp: Date;
  direction: 'to' | 'from';
  message: any;
}

/**
 * PendingToolUse Interface
 * Represents a tool use awaiting result
 */
interface PendingToolUse {
  id: string;
  name: string;
  input: any;
  timestamp: Date;
}

/**
 * ChatStore Interface
 * Defines all state and actions for chat management
 */
export interface ChatStore {
  // ==================== STATE ====================

  // Chat Messages State
  messages: Map<string, ChatMessage[]>; // Per-agent message history
  activeChat: string | null; // Currently active chat ID (agent ID)
  streamingMessages: Map<string, StreamingMessage>; // Per-agent streaming messages
  attachments: Map<string, Attachment[]>; // Per-agent attachments
  streamingStates: Map<string, boolean>; // Per-chat streaming states
  sessionIds: Map<string, string>; // In-memory Claude session IDs per agent
  chatError: string | null;
  pendingToolUses: Map<string, PendingToolUse>;
  traceEntries: Map<string, TraceEntry[]>; // Per-chat trace entries

  // Background Sync State
  backgroundSyncInterval: NodeJS.Timeout | null;

  // ==================== SELECTORS ====================

  getCurrentMessages: () => ChatMessage[];
  getMessages: (agentId: string) => ChatMessage[];
  getStreamingMessage: (agentId: string) => StreamingMessage | null;
  isStreaming: (agentId: string) => boolean;
  getAttachments: (agentId: string) => Attachment[];
  getSessionId: (agentId: string) => string | null;
  getTraceEntries: (agentId: string) => TraceEntry[];

  // ==================== ACTIONS ====================

  // Message Operations
  sendMessage: (
    message: string,
    attachments?: File[],
    resourceIds?: string[],
    options?: { permissionMode?: PermissionMode; model?: string }
  ) => Promise<void>;
  loadChatHistory: (chatId: string) => Promise<ChatMessage[]>;
  clearChat: (chatId: string) => void;
  addTraceEntry: (chatId: string, direction: 'to' | 'from', message: any) => void;
  hydrateTraceEntriesFromMessages: (chatId: string, messages: ChatMessage[]) => void;
  normalizeTodoStatuses: (
    todos:
      | Array<{
          id: string;
          content: string;
          status: 'pending' | 'in_progress' | 'completed';
          activeForm: string;
        }>
      | undefined,
    isSessionActive: boolean
  ) => Array<{ id: string; content: string; status: string; activeForm: string }> | undefined;

  // Streaming Operations
  streamResponse: (response: AsyncIterable<StreamChunk>) => Promise<void>;
  stopStreaming: () => void;

  // Background Sync
  startBackgroundSync: () => NodeJS.Timeout;
  stopBackgroundSync: () => void;
}

/**
 * Create ChatStore with Zustand + Immer + DevTools
 *
 * Uses:
 * - Zustand for reactive state management
 * - Immer for immutable updates with mutable syntax
 * - DevTools for debugging in development
 * - Map for O(1) message lookups by agent ID
 */
export const useChatStore = create<ChatStore>()(
  withDevtools(
    immer<ChatStore>((set, get) => ({
      // ==================== INITIAL STATE ====================

      messages: new Map(),
      activeChat: null,
      streamingMessages: new Map(),
      attachments: new Map(),
      streamingStates: new Map(),
      sessionIds: new Map(),
      chatError: null,
      pendingToolUses: new Map(),
      traceEntries: new Map(),
      backgroundSyncInterval: null,

      // ==================== SELECTORS ====================

      /**
       * Get messages for the currently active chat
       * @returns Array of messages for active chat or empty array
       */
      getCurrentMessages: () => {
        const state = get();
        if (!state.activeChat) return [];
        return state.messages.get(state.activeChat) || [];
      },

      /**
       * Get messages for a specific agent
       * @param agentId - Agent ID
       * @returns Array of messages for the agent or empty array
       */
      getMessages: (agentId: string) => {
        const state = get();
        return state.messages.get(agentId) || [];
      },

      /**
       * Get streaming message for a specific agent
       * @param agentId - Agent ID
       * @returns Streaming message or null
       */
      getStreamingMessage: (agentId: string) => {
        const state = get();
        return state.streamingMessages.get(agentId) || null;
      },

      /**
       * Check if an agent is currently streaming
       * @param agentId - Agent ID
       * @returns True if streaming, false otherwise
       */
      isStreaming: (agentId: string) => {
        const state = get();
        return state.streamingStates.get(agentId) || false;
      },

      /**
       * Get attachments for a specific agent
       * @param agentId - Agent ID
       * @returns Array of attachments or empty array
       */
      getAttachments: (agentId: string) => {
        const state = get();
        return state.attachments.get(agentId) || [];
      },

      /**
       * Get Claude session ID for a specific agent
       * @param agentId - Agent ID
       * @returns Session ID or null
       */
      getSessionId: (agentId: string) => {
        const state = get();
        return state.sessionIds.get(agentId) || null;
      },

      /**
       * Get trace entries for a specific chat
       * @param agentId - Agent ID
       * @returns Array of trace entries or empty array
       */
      getTraceEntries: (agentId: string) => {
        const state = get();
        return state.traceEntries.get(agentId) || [];
      },

      // ==================== ACTIONS ====================

      /**
       * Add a trace entry for debugging SDK communication
       * @param chatId - Chat ID (agent ID)
       * @param direction - Direction of message ('to' or 'from')
       * @param message - Message payload
       */
      addTraceEntry: (chatId: string, direction: 'to' | 'from', message: any) => {
        set((state) => {
          const entries = state.traceEntries.get(chatId) || [];
          entries.push({
            id: nanoid(),
            timestamp: new Date(),
            direction,
            message,
          });
          state.traceEntries.set(chatId, entries);
        });
      },

      /**
       * Hydrate trace entries from chat messages (for JSONL rehydration)
       * @param chatId - Chat ID (agent ID)
       * @param messages - Array of chat messages
       */
      hydrateTraceEntriesFromMessages: (chatId: string, messages: ChatMessage[]) => {
        const traceEntries: TraceEntry[] = [];

        for (const msg of messages) {
          // User messages → reconstruct as 'to' trace (outgoing prompt)
          if (msg.role === 'user') {
            traceEntries.push({
              id: `trace-${msg.id}`,
              timestamp: msg.timestamp,
              direction: 'to',
              message: {
                prompt: msg.content,
                sessionId: chatId,
                timestamp: msg.timestamp.toISOString(),
              },
            });
          }

          // Assistant messages → reconstruct as 'from' trace (incoming SDK messages)
          if (msg.role === 'assistant') {
            // Reconstruct message event
            traceEntries.push({
              id: `trace-${msg.id}-message`,
              timestamp: msg.timestamp,
              direction: 'from',
              message: {
                type: 'message',
                role: 'assistant',
                content: msg.content,
                session_id: chatId,
              },
            });

            // Reconstruct tool_use events from toolCalls
            if (msg.toolCalls && msg.toolCalls.length > 0) {
              for (const toolCall of msg.toolCalls) {
                if (toolCall.type === 'tool_use') {
                  traceEntries.push({
                    id: `trace-${msg.id}-tool-${toolCall.id}`,
                    timestamp: msg.timestamp,
                    direction: 'from',
                    message: {
                      type: 'tool',
                      subtype: 'call',
                      tool_calls: [toolCall],
                      session_id: chatId,
                    },
                  });
                } else if (toolCall.type === 'tool_result') {
                  traceEntries.push({
                    id: `trace-${msg.id}-result-${toolCall.tool_use_id}`,
                    timestamp: msg.timestamp,
                    direction: 'from',
                    message: {
                      type: 'tool',
                      subtype: 'result',
                      tool_results: [toolCall],
                      parent_tool_use_id: toolCall.tool_use_id,
                      session_id: chatId,
                    },
                  });
                }
              }
            }

            // Reconstruct result message with usage/cost data
            if (msg.tokenUsage || msg.totalCostUSD || msg.stopReason || msg.error) {
              traceEntries.push({
                id: `trace-${msg.id}-result`,
                timestamp: msg.timestamp,
                direction: 'from',
                message: {
                  type: 'result',
                  subtype: msg.error ? 'error_during_execution' : 'success',
                  session_id: chatId,
                  usage: msg.tokenUsage
                    ? {
                        input_tokens: msg.tokenUsage.inputTokens,
                        output_tokens: msg.tokenUsage.outputTokens,
                        cache_creation_input_tokens: msg.tokenUsage.cacheCreationInputTokens,
                        cache_read_input_tokens: msg.tokenUsage.cacheReadInputTokens,
                      }
                    : undefined,
                  total_cost_usd: msg.totalCostUSD,
                  stop_reason: msg.stopReason,
                  stop_sequence: msg.stopSequence,
                  request_id: msg.requestId,
                  is_error: !!msg.error,
                  error: msg.error,
                  duration_ms: msg.duration,
                },
              });
            }
          }
        }

        set((state) => {
          state.traceEntries.set(chatId, traceEntries);
        });

        logger.info(
          `[ChatStore] Hydrated ${traceEntries.length} trace entries from ${messages.length} chat messages`
        );
      },

      /**
       * Normalize todo statuses based on session state
       * Resets in_progress todos to pending if session is not active
       * @param todos - Array of todos to normalize
       * @param isSessionActive - Whether the session is currently active
       * @returns Normalized todos or undefined
       */
      normalizeTodoStatuses: (
        todos:
          | Array<{
              id: string;
              content: string;
              status: 'pending' | 'in_progress' | 'completed';
              activeForm: string;
            }>
          | undefined,
        isSessionActive: boolean
      ) => {
        if (!todos) return undefined;
        if (todos.length === 0) return [];

        logger.info(
          `[ChatStore] Normalizing todo statuses for ${todos.length} todos (session active: ${isSessionActive})`
        );

        return todos.map((todo) => {
          if (todo.status === 'in_progress' && !isSessionActive) {
            logger.debug(
              `[ChatStore] Resetting in_progress todo to pending: ${todo.id} - ${todo.content}`
            );
            return { ...todo, status: 'pending' as const };
          }
          return todo;
        });
      },

      /**
       * Send a message to Claude and stream the response
       * @param message - Message text
       * @param _attachments - File attachments (deprecated, unused)
       * @param resourceIds - Resource IDs to attach
       * @param options - Optional settings (permission mode, model)
       * @throws Error if no active chat or selected agent
       */
      sendMessage: async (
        message: string,
        _attachments?: File[],
        resourceIds?: string[],
        options?: { permissionMode?: PermissionMode; model?: string }
      ): Promise<void> => {
        logger.debug('[ChatStore] sendMessage called:', { message, resourceIds, options });

        const state = get();
        const activeChat = state.activeChat;
        const selectedAgentId = useAgentsStore.getState().selectedAgentId;

        if (!activeChat || !selectedAgentId) {
          logger.error('[ChatStore] Missing activeChat or selectedAgentId');
          throw new Error('No active chat or selected agent');
        }

        const capturedSelectedAgentId: string = selectedAgentId;
        const messageId = nanoid();
        const chatMessage: ChatMessage = {
          id: messageId,
          role: 'user',
          content: message,
          timestamp: new Date(),
          attachedResources: [],
        };

        // Add user message and prepare streaming response
        const streamingMessageId = nanoid();
        const streamingChatId = activeChat;

        set((state) => {
          const existingMessages = state.messages.get(activeChat) || [];
          const messages = [...existingMessages, chatMessage];

          // Add placeholder assistant message for streaming indicator
          const streamingAssistantMessage: ChatMessage = {
            id: streamingMessageId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            startTime: new Date(),
          };
          state.messages.set(activeChat, [...messages, streamingAssistantMessage]);
          state.streamingStates = new Map(state.streamingStates).set(activeChat, true);
          const newStreamingMessages = new Map(state.streamingMessages);
          newStreamingMessages.set(activeChat, {
            id: streamingMessageId,
            chunks: [],
            isComplete: false,
          });
          state.streamingMessages = newStreamingMessages;
          state.chatError = null;
        });

        try {
          // Process resource attachments if provided
          let claudeAttachments: ClaudeAttachment[] | undefined;

          if (resourceIds && resourceIds.length > 0) {
            // Import resources store dynamically to access resources
            const { useResourcesStore } = await import('./resources.store');
            const resourcesState = useResourcesStore.getState();
            claudeAttachments = [];

            for (const resourceId of resourceIds) {
              const resource = resourcesState.resources.get(resourceId);
              if (resource) {
                try {
                  const previewData =
                    await window.electron?.resources?.previewResource?.(resourceId);
                  if (previewData) {
                    const [mimeInfo, base64Data] = previewData.split(',');
                    const mimeType =
                      mimeInfo.match(/:(.*?);/)?.[1] ||
                      resource.mimeType ||
                      'application/octet-stream';

                    let type: ClaudeAttachment['type'] = 'other';
                    if (mimeType.startsWith('image/')) {
                      type = 'image';
                    } else if (
                      mimeType.startsWith('text/') ||
                      mimeType.includes('javascript') ||
                      mimeType.includes('json')
                    ) {
                      type = 'document';
                    } else if (
                      mimeType.includes('code') ||
                      resource.name.match(/\.(js|ts|py|java|c|cpp|cs|rb|go|rs|swift|kt)$/)
                    ) {
                      type = 'code';
                    }

                    claudeAttachments.push({
                      type,
                      media_type: mimeType,
                      data: base64Data,
                      filename: resource.name,
                    });
                  }
                } catch (error) {
                  logger.error(`[ChatStore] Failed to load resource ${resourceId}:`, error);
                }
              }
            }
          }

          // Get project context and configuration
          const projectsState = useProjectsStore.getState();
          const selectedProject = projectsState.getSelectedProject();
          const agent = useAgentsStore.getState().getSelectedAgent();
          const maxTurns = useSettingsStore.getState().preferences.maxTurns ?? null;

          const conversationOptions: ConversationOptions = {
            ...(maxTurns !== null && { max_turns: maxTurns }),
            ...(options?.permissionMode && { permission_mode: options.permissionMode }),
            ...(options?.model && { model: options.model }),
            ...(selectedProject && agent?.projectId && { cwd: selectedProject.localPath }),
          };

          // Get session ID for resuming conversation
          const inMemorySessionId = state.sessionIds.get(capturedSelectedAgentId);
          const persistedSessionId = agent?.metadata?.claude_session_id as string | undefined;
          const resumeSessionId: string | undefined = inMemorySessionId || persistedSessionId;

          const capturedStreamingMessageId = streamingMessageId;

          logger.debug('[ChatStore] Calling claudeCodeService.queryWithStreaming');

          // Call Claude Code service with streaming callbacks
          await claudeCodeService.queryWithStreaming(
            message,
            {
              sessionId: capturedSelectedAgentId,
              parentMessageId: capturedStreamingMessageId,
              ...(claudeAttachments && { attachments: claudeAttachments }),
              ...(selectedProject?.folderName && { projectId: selectedProject.folderName }),
              ...(conversationOptions && { conversationOptions }),
              ...(resumeSessionId && { resume: resumeSessionId }),
            },
            {
              onTrace: (direction, message) => {
                get().addTraceEntry(streamingChatId, direction, message);
              },
              onChunk: (chunk) => {
                logger.debug('[ChatStore] Received chunk:', chunk.type);

                // Batch streaming updates to reduce re-render frequency
                batchStreamingUpdate(() =>
                  set((state) => {
                    const streamingMsg = state.streamingMessages.get(streamingChatId);
                    const shouldProcess =
                      chunk.type === 'partial' &&
                      chunk.content &&
                      (streamingMsg || chunk.isNewMessage);

                    if (shouldProcess) {
                      const messages = state.messages.get(streamingChatId) || [];

                      if (chunk.isNewMessage && chunk.content) {
                        const messageRole = chunk.messageType === 'user' ? 'user' : 'assistant';

                        // Update existing placeholder or create new message
                        const lastMessage = messages[messages.length - 1];
                        if (
                          lastMessage &&
                          lastMessage.role === 'assistant' &&
                          lastMessage.content === '' &&
                          messageRole === 'assistant'
                        ) {
                          lastMessage.content = chunk.content;
                          state.messages.set(streamingChatId, [...messages]);
                        } else {
                          const newMessage: ChatMessage = {
                            id: nanoid(),
                            role: messageRole,
                            content: chunk.content,
                            timestamp: new Date(),
                            startTime: new Date(),
                          };
                          state.messages.set(streamingChatId, [...messages, newMessage]);
                        }
                        if (streamingMsg) {
                          streamingMsg.chunks = [chunk.content];
                        }
                      }
                    }

                    // Update worktree stats for time tracking and tokens
                    if (agent?.projectId) {
                      const worktreeStatsStore = useWorktreeStatsStore.getState();
                      const projectId = agent.projectId;

                      // Track streaming duration
                      const streamingMsg = state.streamingMessages.get(streamingChatId);
                      if (streamingMsg) {
                        const messages = state.messages.get(streamingChatId) || [];
                        const activeMsg = messages.find((m) => m.id === capturedStreamingMessageId);
                        if (activeMsg?.startTime) {
                          const stats = worktreeStatsStore.worktreeStats[projectId];
                          if (!stats?.currentStreamStartTime) {
                            worktreeStatsStore.markStreamStart(
                              projectId,
                              activeMsg.startTime.getTime()
                            );
                          }
                        }
                      }

                      // Update token usage
                      if (chunk.tokenUsage) {
                        const inputTokens = chunk.tokenUsage.inputTokens || 0;
                        const outputTokens = chunk.tokenUsage.outputTokens || 0;
                        const cacheCreationTokens = chunk.tokenUsage.cacheCreationInputTokens || 0;
                        const cacheReadTokens = chunk.tokenUsage.cacheReadInputTokens || 0;

                        if (inputTokens > 0 || outputTokens > 0) {
                          worktreeStatsStore.updateWorktreeStats(projectId, {
                            inputTokens,
                            outputTokens,
                            cacheCreationInputTokens: cacheCreationTokens,
                            cacheReadInputTokens: cacheReadTokens,
                          });
                        }

                        // Store token usage in message
                        const messages = state.messages.get(streamingChatId) || [];
                        const messageIndex = messages.findIndex(
                          (m) => m.id === capturedStreamingMessageId
                        );
                        if (messageIndex !== -1) {
                          if (!messages[messageIndex].tokenUsage) {
                            messages[messageIndex].tokenUsage = {
                              inputTokens: 0,
                              outputTokens: 0,
                              cacheCreationInputTokens: 0,
                              cacheReadInputTokens: 0,
                            };
                          }
                          if (outputTokens > 0) {
                            messages[messageIndex].currentResponseOutputTokens =
                              (messages[messageIndex].currentResponseOutputTokens || 0) +
                              outputTokens;
                          }
                          const usage = messages[messageIndex].tokenUsage;
                          if (usage) {
                            usage.inputTokens = (usage.inputTokens || 0) + inputTokens;
                            usage.outputTokens = (usage.outputTokens || 0) + outputTokens;
                            usage.cacheCreationInputTokens =
                              (usage.cacheCreationInputTokens || 0) + cacheCreationTokens;
                            usage.cacheReadInputTokens =
                              (usage.cacheReadInputTokens || 0) + cacheReadTokens;
                          }
                          state.messages.set(streamingChatId, [...messages]);
                        }

                        // Store in streaming message
                        const streamingMsg = state.streamingMessages.get(streamingChatId);
                        if (streamingMsg) {
                          if (!streamingMsg.tokenUsage) {
                            streamingMsg.tokenUsage = {
                              inputTokens: 0,
                              outputTokens: 0,
                              cacheCreationInputTokens: 0,
                              cacheReadInputTokens: 0,
                            };
                          }
                          const usage = streamingMsg.tokenUsage;
                          if (usage) {
                            usage.inputTokens += inputTokens;
                            usage.outputTokens += outputTokens;
                            usage.cacheCreationInputTokens =
                              (usage.cacheCreationInputTokens || 0) + cacheCreationTokens;
                            usage.cacheReadInputTokens =
                              (usage.cacheReadInputTokens || 0) + cacheReadTokens;
                          }
                        }
                      }
                    }
                  })
                );
              },
              onSystem: async (message) => {
                // Capture Claude session ID from init message
                if (message.subtype === 'init' && message.session_id) {
                  const sessionId = message.session_id;
                  set((state) => {
                    state.sessionIds.set(capturedSelectedAgentId, sessionId);
                  });

                  // Capture MCP servers from init message
                  if (message.mcp_servers && Array.isArray(message.mcp_servers)) {
                    const { useMCPStore } = await import('./mcp.store');
                    // Type assertion needed because message.mcp_servers has loose types from SDK
                    useMCPStore
                      .getState()
                      .setMCPServers(capturedSelectedAgentId, message.mcp_servers as any);
                  }

                  // Update session manifest
                  const worktreeId = agent?.projectId;
                  if (worktreeId) {
                    await window.electron.ipcRenderer.invoke(
                      'agents:updateSession',
                      worktreeId,
                      capturedSelectedAgentId,
                      sessionId
                    );
                  }
                }

                // Handle compact_boundary message
                if (message.subtype === 'compact_boundary' && message.compact_metadata) {
                  logger.warn('[ChatStore] COMPACT_BOUNDARY MESSAGE RECEIVED');

                  const { useContextUsageStore } = await import('./contextusage.store');
                  useContextUsageStore.getState().resetAgentContextUsage(capturedSelectedAgentId);

                  const compactText = `Compaction completed\n\nPre-compaction tokens: ${message.compact_metadata.pre_tokens}\n\nTrigger: ${message.compact_metadata.trigger}`;

                  set((state) => {
                    const messages = state.messages.get(streamingChatId) || [];
                    const lastMessage = messages[messages.length - 1];
                    if (
                      lastMessage &&
                      lastMessage.role === 'assistant' &&
                      lastMessage.content === ''
                    ) {
                      lastMessage.content = compactText;
                      state.messages.set(streamingChatId, [...messages]);
                    } else {
                      const compactionMessage: ChatMessage = {
                        id: nanoid(),
                        role: 'assistant',
                        content: compactText,
                        timestamp: new Date(),
                      };
                      state.messages.set(streamingChatId, [...messages, compactionMessage]);
                    }
                  });
                }
              },
              onToolUse: (message) => {
                set((state) => {
                  const pendingTool = {
                    id: message.tool_id,
                    name: message.tool_name,
                    input: message.tool_input,
                    timestamp: new Date(),
                  };
                  const newPendingToolUses = new Map(state.pendingToolUses);
                  newPendingToolUses.set(message.tool_id, pendingTool);
                  state.pendingToolUses = newPendingToolUses;

                  // Handle TodoWrite tool monitoring
                  const streamingMessage: any = {
                    id: message.tool_id || `tool-${Date.now()}`,
                    type: 'tool_use',
                    timestamp: new Date().toISOString(),
                    tool_id: message.tool_id,
                    tool_name: message.tool_name,
                    tool_input: message.tool_input,
                    parent_tool_use_id: message.parent_tool_use_id || null,
                    parent_message_id: capturedStreamingMessageId,
                  };

                  const projectsState = useProjectsStore.getState();
                  const selectedProject = projectsState.getSelectedProject();
                  const worktreeId = selectedProject?.folderName || selectedProject?.id;
                  if (worktreeId) {
                    const monitor = getTodoMonitor(worktreeId);
                    if (monitor) {
                      monitor.onMessage(streamingMessage);
                    }
                  }

                  if (message.tool_name === 'TodoWrite' && message.tool_input?.todos) {
                    const messages = state.messages.get(streamingChatId) || [];
                    const messageIndex = messages.findIndex(
                      (m) => m.id === capturedStreamingMessageId
                    );
                    if (messageIndex !== -1 && messages[messageIndex]) {
                      const todosWithIds = message.tool_input.todos.map(
                        (todo: any, index: number) => ({
                          id: todo.id || `todo-${capturedStreamingMessageId}-${index}`,
                          content: todo.content || '',
                          status: todo.status || 'pending',
                          activeForm: todo.activeForm || todo.content,
                        })
                      );
                      messages[messageIndex].latestTodos = todosWithIds;
                      state.messages.set(streamingChatId, [...messages]);
                    }
                  }
                });
              },
              onToolResult: (message) => {
                set((state) => {
                  const pendingTool = state.pendingToolUses.get(message.tool_use_id);
                  if (pendingTool) {
                    const toolMessage: ChatMessage = {
                      id: nanoid(),
                      role: 'assistant',
                      content: '',
                      toolCalls: [
                        {
                          type: 'tool_use',
                          id: pendingTool.id,
                          name: pendingTool.name,
                          input: pendingTool.input,
                        },
                        {
                          type: 'tool_result',
                          tool_use_id: message.tool_use_id,
                          content: message.content,
                        },
                      ],
                      timestamp: new Date(),
                    };

                    const messages = state.messages.get(streamingChatId) || [];
                    state.messages.set(streamingChatId, [...messages, toolMessage]);

                    const newPendingToolUses = new Map(state.pendingToolUses);
                    newPendingToolUses.delete(message.tool_use_id);
                    state.pendingToolUses = newPendingToolUses;
                  }
                });
              },
              onResult: (result: any) => {
                // Stop streaming when we receive any result message (success or error)
                // The result message indicates the stream has ended
                set((state) => {
                  if (streamingChatId) {
                    state.streamingStates = new Map(state.streamingStates).set(
                      streamingChatId,
                      false
                    );
                  }
                });

                // Handle API errors that come through as "success" with error flag
                if (result.is_error && result.subtype === 'success' && result.error?.message) {
                  const apiError = new Error(result.error.message);
                  globalErrorHandler.handle(apiError, {
                    subsystem: 'service',
                    operation: 'api_response',
                    metadata: {
                      sessionId: streamingChatId,
                      isApiError: true,
                      errorType: result.error.type,
                      totalCost: result.total_cost_usd,
                      numTurns: result.num_turns,
                    },
                  });

                  // Show error in chat UI
                  set((state) => {
                    const messages = state.messages.get(streamingChatId) || [];
                    const errorMessage: ChatMessage = {
                      id: nanoid(),
                      role: 'assistant',
                      content: result.error.message,
                      timestamp: new Date(),
                    };
                    state.messages.set(streamingChatId, [...messages, errorMessage]);
                  });

                  // Don't process further for API errors
                  return;
                }

                // Handle session termination errors
                if (
                  result.subtype === 'error_max_turns' ||
                  result.subtype === 'error_during_execution'
                ) {
                  logger.info('[ChatStore] Detected session termination:', result.subtype);

                  set((state) => {
                    const messages = state.messages.get(streamingChatId) || [];
                    let systemMessage: ChatMessage;

                    if (result.subtype === 'error_max_turns') {
                      const maxTurns = useSettingsStore.getState().preferences.maxTurns ?? null;
                      const turnCount = result.turn_count || maxTurns;
                      const maxTurnsContent =
                        `⚠️ Session terminated: Maximum turns limit reached (${turnCount} turns). ` +
                        `The conversation has ended to prevent excessive API usage. ` +
                        `You can continue by starting a new message.`;

                      systemMessage = {
                        id: nanoid(),
                        role: 'assistant',
                        content: maxTurnsContent,
                        timestamp: new Date(),
                      };
                    } else {
                      const errorDetail = result.error?.message || result.result || 'Unknown error';
                      systemMessage = {
                        id: nanoid(),
                        role: 'assistant',
                        content: `⚠️ Session terminated: An error occurred during execution. ${errorDetail}`,
                        timestamp: new Date(),
                      };
                    }

                    state.messages.set(streamingChatId, [...messages, systemMessage]);
                    state.streamingStates = new Map(state.streamingStates).set(
                      streamingChatId,
                      false
                    );
                  });
                }

                // Handle permission requests
                if (result.__permissionRequest) {
                  set((state) => {
                    const streamingMsg = state.streamingMessages.get(streamingChatId);
                    if (streamingMsg) {
                      const newStreamingMessages = new Map(state.streamingMessages);
                      newStreamingMessages.set(streamingChatId, {
                        ...streamingMsg,
                        permissionRequest: result.__permissionRequest,
                      });
                      state.streamingMessages = newStreamingMessages;
                    }
                  });
                }

                // Update agent context usage
                if (result.modelUsage && capturedSelectedAgentId) {
                  useContextUsageStore
                    .getState()
                    .updateAgentContextUsage(capturedSelectedAgentId, result.modelUsage);
                }

                // Store result data for onComplete
                if (
                  result.usage ||
                  result.total_cost_usd ||
                  result.stop_reason ||
                  result.error ||
                  result.request_id
                ) {
                  set((state) => {
                    const streamingMsg = state.streamingMessages.get(streamingChatId);
                    if (streamingMsg) {
                      streamingMsg.resultData = streamingMsg.resultData || {};
                      if (result.usage) {
                        streamingMsg.resultData.usage = result.usage;
                      }
                      if (result.total_cost_usd !== undefined) {
                        streamingMsg.resultData.total_cost_usd = result.total_cost_usd;
                      }
                      if (result.stop_reason) {
                        streamingMsg.resultData.stop_reason = result.stop_reason;
                      }
                      if (result.stop_sequence !== undefined) {
                        streamingMsg.resultData.stop_sequence = result.stop_sequence;
                      }
                      if (result.request_id) {
                        streamingMsg.resultData.request_id = result.request_id;
                      }
                      if (result.error) {
                        streamingMsg.resultData.error = result.error;
                      }
                    }
                  });
                }
              },
              onError: (error) => {
                // Show toast notification for user awareness
                globalErrorHandler.handle(error, {
                  subsystem: 'service',
                  operation: 'streamResponse',
                  metadata: {
                    sessionId: streamingChatId,
                    isStreamingError: true,
                  },
                });

                // Still set state for UI display
                set((state) => {
                  if (streamingChatId) {
                    state.streamingStates = new Map(state.streamingStates).set(
                      streamingChatId,
                      false
                    );
                  }
                  state.chatError = error.message;
                });
              },
              onComplete: (_finalContent) => {
                set((state) => {
                  const messages = state.messages.get(streamingChatId) || [];
                  const lastAssistantMessageIndex = messages.length - 1;

                  if (lastAssistantMessageIndex >= 0 && messages[lastAssistantMessageIndex]) {
                    const message = messages[lastAssistantMessageIndex];
                    const streamingMsg = state.streamingMessages.get(streamingChatId);

                    // Apply result data
                    if (streamingMsg?.resultData) {
                      const resultData = streamingMsg.resultData;
                      message.tokenUsage = {
                        inputTokens: resultData.usage?.input_tokens || 0,
                        outputTokens: resultData.usage?.output_tokens || 0,
                        cacheCreationInputTokens:
                          resultData.usage?.cache_creation_input_tokens || 0,
                        cacheReadInputTokens: resultData.usage?.cache_read_input_tokens || 0,
                      };
                      if (resultData.total_cost_usd !== undefined) {
                        message.totalCostUSD = resultData.total_cost_usd;
                      }
                      if (resultData.stop_reason) {
                        const validStopReasons = [
                          'end_turn',
                          'max_tokens',
                          'stop_sequence',
                          'tool_use',
                          'pause_turn',
                          'refusal',
                          'model_context_window_exceeded',
                        ];
                        if (validStopReasons.includes(resultData.stop_reason)) {
                          message.stopReason = resultData.stop_reason as
                            | 'end_turn'
                            | 'max_tokens'
                            | 'stop_sequence'
                            | 'tool_use'
                            | 'pause_turn'
                            | 'refusal'
                            | 'model_context_window_exceeded';
                        }
                      }
                      if (resultData.stop_sequence !== undefined) {
                        message.stopSequence = resultData.stop_sequence;
                      }
                      if (resultData.request_id) {
                        message.requestId = resultData.request_id;
                      }
                      if (resultData.error) {
                        message.error = resultData.error;
                        message.content = '';
                      }

                      // Update worktree stats with actual cost
                      if (agent?.projectId && resultData.total_cost_usd) {
                        const worktreeStatsStore = useWorktreeStatsStore.getState();
                        const projectId = agent.projectId;
                        worktreeStatsStore.updateWorktreeCost(projectId, resultData.total_cost_usd);
                      }
                    }

                    // Handle tool calls
                    if (streamingMsg?.toolCalls) {
                      message.toolCalls = streamingMsg.toolCalls;

                      let lastTodos = null;
                      for (const tc of streamingMsg.toolCalls) {
                        if (tc.type === 'tool_use' && tc.name === 'TodoWrite' && tc.input?.todos) {
                          lastTodos = tc.input.todos;
                        }
                      }
                      if (lastTodos) {
                        message.latestTodos = lastTodos.map((todo: any, index: number) => ({
                          id: todo.id || `todo-${message.id}-${index}`,
                          content: todo.content || '',
                          status: todo.status || 'pending',
                          activeForm: todo.activeForm || todo.content || '',
                        }));
                      }

                      message.simplifiedToolCalls = streamingMsg.toolCalls
                        .filter((tc) => tc.type === 'tool_use' && tc.name)
                        .map((tc) => {
                          if (tc.name === 'TodoWrite') return null;

                          const description = MessageConverter.formatToolDescription(
                            tc.name!,
                            tc.input
                          );

                          return {
                            type: 'tool_use' as const,
                            name: tc.name!,
                            ...(description && { description }),
                          };
                        })
                        .filter((tc): tc is NonNullable<typeof tc> => tc !== null);
                    }

                    // Calculate duration
                    if (message.startTime) {
                      message.duration = Date.now() - message.startTime.getTime();

                      if (agent?.projectId) {
                        const worktreeStatsStore = useWorktreeStatsStore.getState();
                        const projectId = agent.projectId;
                        const stats = worktreeStatsStore.worktreeStats[projectId];
                        if (stats && stats.currentStreamStartTime) {
                          const streamDuration = Date.now() - stats.currentStreamStartTime;
                          stats.totalStreamingTime =
                            (stats.totalStreamingTime || 0) + streamDuration;
                          stats.lastRequestDuration = streamDuration;
                          delete stats.currentStreamStartTime;
                          stats.lastUpdated = new Date();
                        }
                      }
                    }
                  }

                  state.messages.set(streamingChatId, [...messages]);

                  // Clear streaming state
                  state.streamingStates = new Map(state.streamingStates).set(
                    streamingChatId,
                    false
                  );

                  if (state.activeChat && state.activeChat !== streamingChatId) {
                    state.streamingStates = new Map(state.streamingStates).set(
                      state.activeChat,
                      false
                    );
                  }

                  const streamingMsgForCheck = state.streamingMessages.get(streamingChatId);
                  if (!streamingMsgForCheck?.permissionRequest) {
                    const newStreamingMessages = new Map(state.streamingMessages);
                    newStreamingMessages.delete(streamingChatId);
                    state.streamingMessages = newStreamingMessages;
                  }

                  state.chatError = null;
                });
              },
            }
          );
        } catch (error) {
          logger.error('[ChatStore] Error in sendMessage:', error);

          // Check if abort error
          if (error instanceof Error && error.message === 'Query aborted') {
            logger.debug('[ChatStore] Query was aborted by user');
            set((state) => {
              if (streamingChatId) {
                state.streamingStates = new Map(state.streamingStates).set(streamingChatId, false);
              }
              const newStreamingMessages = new Map(state.streamingMessages);
              newStreamingMessages.delete(streamingChatId);
              state.streamingMessages = newStreamingMessages;
            });
            return;
          }

          // Handle actual errors
          // Show toast notification (before rethrowing)
          globalErrorHandler.handle(error as Error, {
            subsystem: 'service',
            operation: 'sendMessage',
            metadata: {
              agentId: streamingChatId,
              hasAttachments: !!(_attachments && _attachments.length > 0),
            },
          });

          set((state) => {
            state.chatError = error instanceof Error ? error.message : 'Failed to send message';
            if (streamingChatId) {
              state.streamingStates = new Map(state.streamingStates).set(streamingChatId, false);
            }
            const newStreamingMessages = new Map(state.streamingMessages);
            newStreamingMessages.delete(streamingChatId);
            state.streamingMessages = newStreamingMessages;
          });
          throw error; // Still rethrow for upstream handling
        }
      },

      /**
       * Load chat history from disk for a specific agent
       * @param chatId - Chat ID (agent ID)
       * @returns Array of loaded messages
       */
      loadChatHistory: async (chatId: string) => {
        try {
          logger.info(`[ChatStore] Loading chat history for chatId: ${chatId}`);
          if (window.electron?.agents?.loadChatHistory) {
            const result = await window.electron.agents.loadChatHistory(chatId);
            const messages = Array.isArray(result) ? result : result.messages || [];
            const sessionId = !Array.isArray(result) ? result.sessionId : null;

            logger.info(`[ChatStore] Parsed ${messages.length} messages from JSONL`);

            // Check for compaction reset
            const hasCompactionReset = messages.some((msg: ChatMessage) => msg.isCompactionReset);
            if (hasCompactionReset) {
              logger.warn('[ChatStore] Detected compaction reset - resetting context usage');
              const { useContextUsageStore } = await import('./contextusage.store');
              useContextUsageStore.getState().resetAgentContextUsage(chatId);
            }

            // Detect incomplete session
            const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
            const hasIncompleteSession = (() => {
              if (!lastMessage || lastMessage.role !== 'assistant') return false;

              const hasCamelCase =
                'stopReason' in lastMessage && lastMessage.stopReason !== undefined;
              if (hasCamelCase && lastMessage.stopReason === null) return true;

              const rawMessage = lastMessage as Record<string, unknown>;
              const hasSnakeCase =
                'stop_reason' in rawMessage && rawMessage.stop_reason !== undefined;
              if (hasSnakeCase && rawMessage.stop_reason === null) return true;

              return false;
            })();

            if (hasIncompleteSession) {
              logger.warn(
                `[ChatStore] Detected incomplete session for agent ${chatId} - resetting in_progress todos`
              );
            }

            const isSessionActive =
              !hasIncompleteSession &&
              (get().streamingStates.get(chatId) || get().streamingMessages.has(chatId));

            // Normalize todo statuses
            const normalizedMessages = messages.map((msg: ChatMessage) => {
              if (msg.latestTodos && msg.latestTodos.length > 0) {
                const normalized = get().normalizeTodoStatuses(msg.latestTodos, isSessionActive);
                if (normalized) {
                  return { ...msg, latestTodos: normalized };
                }
              }
              return msg;
            });

            set((state) => {
              const existingMessages = state.messages.get(chatId) || [];
              const existingIds = new Set(existingMessages.map((m) => m.id));
              const newMessages = normalizedMessages.filter(
                (m: ChatMessage) => !existingIds.has(m.id)
              );

              const mergedMessages = [...existingMessages, ...newMessages].sort(
                (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
              );

              state.messages.set(chatId, mergedMessages);

              if (sessionId && chatId) {
                state.sessionIds.set(chatId, sessionId);
              }
            });

            // Hydrate trace entries
            get().hydrateTraceEntriesFromMessages(chatId, normalizedMessages);

            // Load todos into monitor
            const todoMonitor = getTodoMonitor(chatId);
            if (todoMonitor && normalizedMessages.length > 0) {
              let lastTodoMessage: ChatMessage | null = null;
              for (let i = normalizedMessages.length - 1; i >= 0; i--) {
                if (
                  normalizedMessages[i].latestTodos &&
                  normalizedMessages[i].latestTodos.length > 0
                ) {
                  lastTodoMessage = normalizedMessages[i];
                  break;
                }
              }

              if (lastTodoMessage && lastTodoMessage.latestTodos) {
                logger.info(
                  `[ChatStore] Loading ${lastTodoMessage.latestTodos.length} todos into monitor`
                );
                const messageWithToolCall = {
                  ...lastTodoMessage,
                  toolCalls: [
                    {
                      id: `todo-${lastTodoMessage.id}`,
                      name: 'TodoWrite',
                      input: { todos: lastTodoMessage.latestTodos },
                      parent_tool_use_id: null,
                    },
                  ],
                };
                todoMonitor.loadFromJSONL('', [messageWithToolCall]);
              }
            }

            return messages;
          }
          return [];
        } catch (error) {
          logger.error('[ChatStore] Failed to load chat history:', error);
          return [];
        }
      },

      /**
       * Clear chat messages and attachments for a specific agent
       * @param chatId - Chat ID (agent ID)
       */
      clearChat: (chatId: string) => {
        set((state) => {
          state.messages.delete(chatId);
          state.attachments.delete(chatId);

          // Also clear context usage in context usage store
          useContextUsageStore.getState().agentContextUsage.delete(chatId);
        });
      },

      /**
       * Stream response from async iterable (legacy method)
       * @param response - Async iterable of stream chunks
       */
      streamResponse: async (response: AsyncIterable<StreamChunk>) => {
        const streamId = nanoid();

        set((state) => {
          const activeChat = state.activeChat;
          if (activeChat) {
            state.streamingStates = new Map(state.streamingStates).set(activeChat, true);
            const newStreamingMessages = new Map(state.streamingMessages);
            newStreamingMessages.set(activeChat, {
              id: streamId,
              chunks: [],
              isComplete: false,
              toolCalls: [],
            });
            state.streamingMessages = newStreamingMessages;
          }
        });

        try {
          for await (const chunk of response) {
            set((state) => {
              if (!state.activeChat) return;
              const streamingMsg = state.streamingMessages.get(state.activeChat);
              if (!streamingMsg) return;

              switch (chunk.type) {
                case 'content':
                  if (chunk.content) {
                    streamingMsg.chunks.push(chunk.content);
                  }
                  break;
                case 'tool_use':
                  if (chunk.toolName && chunk.toolInput) {
                    if (!streamingMsg.toolCalls) streamingMsg.toolCalls = [];
                    streamingMsg.toolCalls.push({
                      type: 'tool_use',
                      name: chunk.toolName,
                      input: chunk.toolInput,
                    });
                  }
                  break;
                case 'tool_result':
                  if (chunk.toolResult) {
                    if (!streamingMsg.toolCalls) streamingMsg.toolCalls = [];
                    streamingMsg.toolCalls.push({
                      type: 'tool_result',
                      content: chunk.toolResult,
                    });
                  }
                  break;
                case 'error':
                  // Create error object for GlobalErrorHandler
                  const streamError = new Error(chunk.toolResult || 'Streaming error occurred');

                  // Show toast notification
                  globalErrorHandler.handle(streamError, {
                    subsystem: 'service',
                    operation: 'processChunk',
                    metadata: {
                      chunkType: 'error',
                      activeChat: state.activeChat,
                    },
                  });

                  // Still set state for UI display
                  state.chatError = chunk.toolResult || 'Streaming error occurred';
                  break;
              }
            });
          }

          set((state) => {
            if (!state.activeChat) return;
            const streamingMsg = state.streamingMessages.get(state.activeChat);
            if (!streamingMsg) return;

            const finalContent = streamingMsg.chunks.join('');
            const messages = state.messages.get(state.activeChat) || [];

            const messageIndex = messages.findIndex((m) => m.id === streamId);
            let updatedMessages;
            if (messageIndex !== -1) {
              updatedMessages = [...messages];
              updatedMessages[messageIndex] = {
                ...messages[messageIndex],
                content: finalContent,
                timestamp: new Date(),
              };
            } else {
              const finalMessage: ChatMessage = {
                id: streamId,
                role: 'assistant',
                content: finalContent,
                timestamp: new Date(),
              };
              updatedMessages = [...messages, finalMessage];
            }

            state.messages.set(state.activeChat, updatedMessages);
            streamingMsg.isComplete = true;
            if (state.activeChat) {
              state.streamingStates = new Map(state.streamingStates).set(state.activeChat, false);
              const newStreamingMessages = new Map(state.streamingMessages);
              newStreamingMessages.delete(state.activeChat);
              state.streamingMessages = newStreamingMessages;
            }
          });
        } catch (error) {
          // Show toast notification
          globalErrorHandler.handle(error as Error, {
            subsystem: 'service',
            operation: 'streamResponse',
            metadata: {
              activeChat: get().activeChat,
              isLegacyStream: true,
            },
          });

          set((state) => {
            state.chatError = error instanceof Error ? error.message : 'Streaming failed';
            if (state.activeChat) {
              state.streamingStates = new Map(state.streamingStates).set(state.activeChat, false);
              const newStreamingMessages = new Map(state.streamingMessages);
              newStreamingMessages.delete(state.activeChat);
              state.streamingMessages = newStreamingMessages;
            }
          });

          // Add throw for consistency with other error handlers
          throw error;
        }
      },

      /**
       * Stop streaming for the currently active chat
       * Aborts the Claude Code service streaming and cleans up state
       */
      stopStreaming: () => {
        const state = get();
        const activeAgentId = state.activeChat;

        claudeCodeService.stopStreaming(activeAgentId || undefined);

        set((state) => {
          if (state.activeChat) {
            const streamingMsg = state.streamingMessages.get(state.activeChat);
            if (streamingMsg) {
              const messages = state.messages.get(state.activeChat) || [];
              const messageIndex = messages.findIndex((m) => m.id === streamingMsg.id);

              if (messageIndex !== -1) {
                const message = messages[messageIndex];
                if (!message.content || message.content.trim() === '') {
                  const updatedMessages = messages.filter((_, index) => index !== messageIndex);
                  state.messages.set(state.activeChat, updatedMessages);
                }
              }
            }

            // Immediately add interrupted message for instant UI feedback
            const messages = state.messages.get(state.activeChat) || [];
            const interruptedMessage: ChatMessage = {
              id: nanoid(),
              role: 'user',
              content: '[Request interrupted by user]',
              timestamp: new Date(),
            };
            state.messages.set(state.activeChat, [...messages, interruptedMessage]);
          }

          if (state.activeChat) {
            state.streamingStates = new Map(state.streamingStates).set(state.activeChat, false);
            const newStreamingMessages = new Map(state.streamingMessages);
            newStreamingMessages.delete(state.activeChat);
            state.streamingMessages = newStreamingMessages;
          }
          state.chatError = null;
        });
      },

      /**
       * Start background sync interval
       * Syncs chat history every 5 seconds when not streaming
       * @returns Interval handle
       */
      startBackgroundSync: () => {
        const state = get();
        if (state.backgroundSyncInterval) {
          clearInterval(state.backgroundSyncInterval);
        }

        const syncInterval = setInterval(async () => {
          const currentState = get();
          const activeAgentId = currentState.activeChat;

          if (activeAgentId && !currentState.streamingStates.get(activeAgentId)) {
            try {
              await get().loadChatHistory(activeAgentId);
            } catch (error) {
              logger.error('[ChatStore] Background sync failed:', error);
            }
          }
        }, 5000);

        set((state) => {
          state.backgroundSyncInterval = syncInterval;
        });

        return syncInterval;
      },

      /**
       * Stop background sync interval
       */
      stopBackgroundSync: () => {
        const state = get();
        if (state.backgroundSyncInterval) {
          clearInterval(state.backgroundSyncInterval);
          set((state) => {
            state.backgroundSyncInterval = null;
          });
        }
      },
    })),
    {
      name: 'chat-store',
      trace: process.env.NODE_ENV === 'development',
    }
  )
);
