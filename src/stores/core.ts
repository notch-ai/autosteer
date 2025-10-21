import { logger } from '@/commons/utils/logger';
import { Task } from '@/components/features/TaskList';
import { Agent, AgentStatus, AgentType, ChatMessage, Resource } from '@/entities';
import {
  claudeCodeService,
  type Attachment as ClaudeAttachment,
} from '@/renderer/services/ClaudeCodeService';
import { getTodoMonitor } from '@/renderer/services/TodoActivityMonitorManager';
import { PermissionMode } from '@/types/permission.types';
import { Project } from '@/types/project.types';
import type { ConversationOptions } from '@/types/streaming.types';
import { enableMapSet } from 'immer';
import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { AgentConfig, Attachment, CoreStore, ProjectConfig, StreamChunk } from './types';
import { useSettingsStore } from './settings';

// Enable MapSet plugin for Immer to work with Map objects
enableMapSet();

// DevTools configuration
const withDevtools = process.env.NODE_ENV === 'development' ? devtools : (f: any) => f;

export const useCoreStore = create<CoreStore>()(
  withDevtools(
    immer<CoreStore>((set, get) => ({
      // State - Agents
      agents: new Map(),
      selectedAgentId: null,
      agentsLoading: false,
      agentsError: null,

      // State - Chat
      messages: new Map(),
      activeChat: null,
      streamingMessages: new Map(), // Per-agent streaming messages
      attachments: new Map(),
      streamingStates: new Map(), // Per-chat streaming states
      sessionIds: new Map(), // In-memory Claude session IDs per agent
      chatError: null,

      // State - Projects
      projects: new Map(),
      selectedProjectId: null,
      projectsLoading: false,
      projectsError: null,

      // State - Resources
      resources: new Map(),
      resourcesLoading: false,

      // State - Tasks/Todos
      tasks: [],
      focusedTodoId: null,

      // State - Slash Commands
      slashCommands: [],
      slashCommandsLoading: false,
      slashCommandsError: null,

      // State - Worktree Stats
      worktreeStats: {},

      // State - Context Usage
      agentContextUsage: new Map(),

      // State - MCP Servers
      mcpServers: new Map(),
      // State - Background Sync
      backgroundSyncInterval: null as NodeJS.Timeout | null,

      // Computed values
      getCurrentMessages: () => {
        const state = get();
        if (!state.activeChat) return [];
        return state.messages.get(state.activeChat) || [];
      },

      getSelectedAgent: () => {
        const state = get();
        if (!state.selectedAgentId) return null;
        return state.agents.get(state.selectedAgentId) || null;
      },

      getSelectedProject: () => {
        const state = get();
        if (!state.selectedProjectId) return null;
        return state.projects.get(state.selectedProjectId) || null;
      },

      hasActiveTasks: () => {
        const state = get();
        return state.tasks.some((task) => task.status === 'in-progress');
      },

      // Agent Actions
      loadAgents: async () => {
        set((state) => {
          state.agentsLoading = true;
          state.agentsError = null;
        });

        try {
          if (window.electron?.agents?.loadAll) {
            const agents = await window.electron.agents.loadAll();
            set((state) => {
              state.agents = new Map(agents.map((agent: Agent) => [agent.id, agent]));
              state.agentsLoading = false;
            });
          } else {
            // No electron API available, just set loading to false
            set((state) => {
              state.agentsLoading = false;
            });
          }
        } catch (error) {
          set((state) => {
            state.agentsError = error instanceof Error ? error.message : 'Failed to load agents';
            state.agentsLoading = false;
          });
        }
      },

      createAgent: async (config: AgentConfig) => {
        const newAgent: Agent = {
          id: nanoid(),
          title: config.title,
          content: config.content,
          preview: config.content.slice(0, 100),
          type: config.type,
          status: config.status || AgentStatus.DRAFT,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: config.tags || [],
          resourceIds: config.resourceIds || [],
          ...(config.projectId && { projectId: config.projectId }),
          ...(config.metadata && { metadata: config.metadata }),
        };

        try {
          let createdAgent = newAgent;
          if (window.electron?.agents?.create) {
            createdAgent = await window.electron.agents.create(newAgent);
          }

          set((state) => {
            state.agents.set(createdAgent.id, createdAgent);
          });

          return createdAgent;
        } catch (error) {
          set((state) => {
            state.agentsError = error instanceof Error ? error.message : 'Failed to create agent';
          });
          throw error;
        }
      },

      updateAgent: async (id: string, updates: Partial<Agent>) => {
        const currentAgent = get().agents.get(id);
        if (!currentAgent) {
          throw new Error(`Agent with id ${id} not found`);
        }

        const updatedAgent = {
          ...currentAgent,
          ...updates,
          updatedAt: new Date(),
        };

        try {
          if (window.electron?.agents?.update) {
            await window.electron.agents.update(id, updates);
          }

          set((state) => {
            state.agents.set(id, updatedAgent);
          });
        } catch (error) {
          set((state) => {
            state.agentsError = error instanceof Error ? error.message : 'Failed to update agent';
          });
          throw error;
        }
      },

      deleteAgent: async (id: string) => {
        try {
          if (window.electron?.agents?.delete) {
            await window.electron.agents.delete(id);
          }

          set((state) => {
            state.agents.delete(id);
            if (state.selectedAgentId === id) {
              state.selectedAgentId = null;
            }
            // Clear chat messages for this agent
            state.messages.delete(id);
            state.attachments.delete(id);
            // Clear context usage for this agent
            state.agentContextUsage.delete(id);
          });
        } catch (error) {
          set((state) => {
            state.agentsError = error instanceof Error ? error.message : 'Failed to delete agent';
          });
          throw error;
        }
      },

      selectAgent: async (id: string | null) => {
        set((state) => {
          if (state.activeChat && state.activeChat !== id) {
            const oldAgentIsStreaming = state.streamingStates.get(state.activeChat) || false;
            const oldStreamingMessage = state.streamingMessages.get(state.activeChat);
            const hasPendingPermission = oldStreamingMessage?.permissionRequest;

            // Only delete streaming message if not streaming AND no pending permission request
            if (!oldAgentIsStreaming && !hasPendingPermission && state.activeChat) {
              const newStreamingMessages = new Map(state.streamingMessages);
              newStreamingMessages.delete(state.activeChat);
              state.streamingMessages = newStreamingMessages;
            }
          }

          state.selectedAgentId = id;
          state.activeChat = id;
        });

        // Only load chat history if not already in memory
        if (id) {
          const state = get();
          const existingMessages = state.messages.get(id);

          // Only load from file if we don't have messages cached
          if (!existingMessages || existingMessages.length === 0) {
            await get().loadChatHistory(id);
          }
        }
      },

      // Chat Actions
      sendMessage: async (
        message: string,
        _attachments?: File[], // Keep for backward compatibility but unused
        resourceIds?: string[],
        options?: { permissionMode?: PermissionMode; model?: string }
      ): Promise<void> => {
        logger.debug(
          '[DEBUG sendMessage] Called with:',
          JSON.stringify({
            message,
            resourceIds,
            options,
          })
        );

        const state = get();
        const { activeChat, selectedAgentId } = state;
        logger.debug(
          '[DEBUG sendMessage] State:',
          JSON.stringify({
            activeChat,
            selectedAgentId,
            hasAgents: state.agents.size,
            hasProjects: state.projects.size,
          })
        );

        if (!activeChat || !selectedAgentId) {
          logger.error('[DEBUG sendMessage] Missing activeChat or selectedAgentId');
          throw new Error('No active chat or selected agent');
        }

        // Capture IDs as const for TypeScript
        const capturedSelectedAgentId: string = selectedAgentId;

        const messageId = nanoid();
        const chatMessage: ChatMessage = {
          id: messageId,
          role: 'user',
          content: message,
          timestamp: new Date(),
          attachedResources: [], // TODO: Process attachments for display
        };

        // Add user message immediately and prepare for streaming response
        const streamingMessageId = nanoid();
        // Capture the chat ID at the start - this won't change even if user switches worktrees
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
          // Create new array reference to ensure Zustand detects changes
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
          let claudeAttachments: ClaudeAttachment[] | undefined;

          if (resourceIds && resourceIds.length > 0) {
            claudeAttachments = [];

            for (const resourceId of resourceIds) {
              const resource = state.resources.get(resourceId);
              if (resource) {
                try {
                  const previewData =
                    await window.electron?.resources?.previewResource?.(resourceId);
                  if (previewData) {
                    // previewData is already a data URL like "data:image/png;base64,..."
                    const [mimeInfo, base64Data] = previewData.split(',');
                    const mimeType =
                      mimeInfo.match(/:(.*?);/)?.[1] ||
                      resource.mimeType ||
                      'application/octet-stream';

                    // Determine attachment type based on mime type
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

                    // The base64 data is already encoded, we just need to pass it directly
                    claudeAttachments.push({
                      type,
                      media_type: mimeType,
                      data: base64Data,
                      filename: resource.name,
                    });
                  }
                } catch (error) {
                  logger.error(`Failed to load resource ${resourceId}:`, error);
                }
              }
            }
          }

          // Get project context if available
          const selectedProject = state.getSelectedProject();
          const agent = state.getSelectedAgent();

          // Get maxTurns from settings store (default: 10)
          const maxTurns = useSettingsStore.getState().preferences.maxTurns || 10;

          // Always initialize conversationOptions with maxTurns
          const conversationOptions: ConversationOptions = {
            max_turns: maxTurns,
            ...(options?.permissionMode && { permission_mode: options.permissionMode }),
            ...(options?.model && { model: options.model }),
            // Add project-specific options if available
            ...(selectedProject && agent?.projectId && { cwd: selectedProject.localPath }),
          };

          // Check for in-memory session ID first, then fall back to persisted one
          const inMemorySessionId = state.sessionIds.get(capturedSelectedAgentId);
          const persistedSessionId = agent?.metadata?.claude_session_id as string | undefined;
          const resumeSessionId: string | undefined = inMemorySessionId || persistedSessionId;

          // If we have a Claude session ID, we'll pass it to resume the conversation
          // Otherwise, this is the first message and we'll capture the session ID in onSystem

          // Capture the message ID - the chat ID is already captured above
          const capturedStreamingMessageId = streamingMessageId; // Capture the message ID we created above

          // Call Claude Code service with streaming
          logger.debug('[DEBUG sendMessage] About to call claudeCodeService.queryWithStreaming');
          logger.debug(
            '[DEBUG sendMessage] Query params:',
            JSON.stringify({
              message,
              sessionId: capturedSelectedAgentId,
              hasAttachments: !!claudeAttachments?.length,
              projectId: selectedProject?.folderName,
              conversationOptions,
              resumeSessionId,
            })
          );

          await claudeCodeService.queryWithStreaming(
            message,
            {
              sessionId: capturedSelectedAgentId, // This is the agent ID, used as our internal session ID
              parentMessageId: capturedStreamingMessageId, // Pass ChatMessage ID for consistent todo IDs
              ...(claudeAttachments && { attachments: claudeAttachments }),
              ...(selectedProject?.folderName && { projectId: selectedProject.folderName }), // Use folderName as consistent worktree ID
              ...(conversationOptions && { conversationOptions }),
              ...(resumeSessionId && { resume: resumeSessionId }), // Pass Claude session ID to resume
            },
            {
              onChunk: (chunk) => {
                logger.debug('[DEBUG sendMessage] Received chunk:', JSON.stringify(chunk));
                // Debug: Track interrupted messages
                if (chunk.content && chunk.content.includes('Request interrupted')) {
                  logger.debug(
                    '[DEBUG INTERRUPTED MESSAGE] Found interrupted message in chunk:',
                    JSON.stringify({
                      chunkType: chunk.type,
                      contentLength: chunk.content.length,
                      fullContent: chunk.content,
                      isNewMessage: chunk.isNewMessage,
                      stackTrace: new Error().stack,
                    })
                  );
                }
                set((state) => {
                  const streamingMsg = state.streamingMessages.get(streamingChatId);

                  // Allow user messages even if streamingMsg is gone (e.g., "[Request interrupted]")
                  const shouldProcess =
                    chunk.type === 'partial' &&
                    chunk.content &&
                    (streamingMsg || chunk.messageType === 'user');

                  // Debug: Log chunk processing decision
                  // Serialize log data to avoid IPC cloning errors with electron-log
                  const logData = {
                    hasStreamingMsg: !!streamingMsg,
                    chunkType: chunk.type,
                    messageType: chunk.messageType,
                    shouldProcess,
                    isNewMessage: chunk.isNewMessage,
                    contentPreview: chunk.content?.substring(0, 100),
                    hasInterruptedText: chunk.content?.includes('Request interrupted'),
                  };
                  logger.debug('[DEBUG onChunk] Processing chunk:', JSON.stringify(logData));

                  if (shouldProcess) {
                    const messages = state.messages.get(streamingChatId) || [];

                    if (chunk.isNewMessage && chunk.content) {
                      // Determine message role from chunk messageType
                      const messageRole = chunk.messageType === 'user' ? 'user' : 'assistant';

                      // Debug: Log message creation
                      logger.debug(
                        '[DEBUG sendMessage] Creating/updating message with content:',
                        JSON.stringify({
                          contentPreview: chunk.content.substring(0, 100),
                          hasInterruptedText: chunk.content.includes('Request interrupted'),
                          messageType: chunk.messageType,
                          messageRole,
                          isUpdatingPlaceholder:
                            messages.length > 0 &&
                            messages[messages.length - 1]?.role === 'assistant' &&
                            messages[messages.length - 1]?.content === '',
                        })
                      );

                      // Update the existing placeholder message instead of creating a new one
                      const lastMessage = messages[messages.length - 1];
                      if (
                        lastMessage &&
                        lastMessage.role === 'assistant' &&
                        lastMessage.content === '' &&
                        messageRole === 'assistant'
                      ) {
                        // Update the empty placeholder (only for assistant messages)
                        lastMessage.content = chunk.content;
                        state.messages.set(streamingChatId, [...messages]);
                      } else {
                        // Create new message with appropriate role
                        const newMessage: ChatMessage = {
                          id: nanoid(),
                          role: messageRole,
                          content: chunk.content,
                          timestamp: new Date(),
                          startTime: new Date(),
                        };
                        const updatedMessages = [...messages, newMessage];
                        state.messages.set(streamingChatId, updatedMessages);
                      }
                      // Only update chunks if streamingMsg exists
                      if (streamingMsg) {
                        streamingMsg.chunks = [chunk.content];
                      }
                    }
                  }

                  // Update worktree stats for time tracking and tokens
                  if (agent?.projectId) {
                    const projectId = agent.projectId;
                    if (!state.worktreeStats[projectId]) {
                      state.worktreeStats[projectId] = {
                        projectId,
                        totalInputTokens: 0,
                        totalOutputTokens: 0,
                        totalCacheCreationTokens: 0,
                        totalCacheReadTokens: 0,
                        totalCost: 0,
                        messageCount: 0,
                        lastUpdated: new Date(),
                      };
                    }

                    const stats = state.worktreeStats[projectId];

                    // Track streaming duration in real-time
                    const streamingMsg = state.streamingMessages.get(streamingChatId);
                    if (streamingMsg) {
                      const messages = state.messages.get(streamingChatId) || [];
                      const streamingMsg = messages.find(
                        (m) => m.id === capturedStreamingMessageId
                      );
                      if (streamingMsg?.startTime) {
                        // Mark start time if this is the first chunk
                        if (!stats.currentStreamStartTime) {
                          stats.currentStreamStartTime = streamingMsg.startTime.getTime();
                        }
                        // Calculate current duration in milliseconds
                        const currentDuration = Date.now() - streamingMsg.startTime.getTime();
                        stats.lastRequestDuration = currentDuration;
                        stats.lastUpdated = new Date();
                      }
                    }

                    // Update token usage if provided
                    if (chunk.tokenUsage) {
                      const inputTokens = chunk.tokenUsage.inputTokens || 0;
                      const outputTokens = chunk.tokenUsage.outputTokens || 0;
                      const cacheCreationTokens = chunk.tokenUsage.cacheCreationInputTokens || 0;
                      const cacheReadTokens = chunk.tokenUsage.cacheReadInputTokens || 0;

                      // Only update if we have new tokens (avoid duplicate updates)
                      if (inputTokens > 0 || outputTokens > 0) {
                        stats.totalInputTokens += inputTokens;
                        stats.totalOutputTokens += outputTokens;
                        stats.totalCacheCreationTokens += cacheCreationTokens;
                        stats.totalCacheReadTokens += cacheReadTokens;

                        // Note: Cost is now updated from the result message which has the actual cost
                        // We don't calculate it manually anymore

                        stats.messageCount += 1;
                        stats.lastUpdated = new Date();

                        // Store last message tokens
                        const lastMessageTokens = inputTokens + outputTokens;
                        if (lastMessageTokens > 0) {
                          stats.lastMessageTokens = lastMessageTokens;
                        }

                        // Store token usage directly in the message using captured ID
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
                          // Accumulate output tokens for the current response only (resets on new message)
                          if (outputTokens > 0) {
                            messages[messageIndex].currentResponseOutputTokens =
                              (messages[messageIndex].currentResponseOutputTokens || 0) +
                              outputTokens;
                          }
                          // Accumulate tokens directly in the message for final totals
                          const usage = messages[messageIndex].tokenUsage;
                          if (usage) {
                            usage.inputTokens = (usage.inputTokens || 0) + inputTokens;
                            usage.outputTokens = (usage.outputTokens || 0) + outputTokens;
                            usage.cacheCreationInputTokens =
                              (usage.cacheCreationInputTokens || 0) + cacheCreationTokens;
                            usage.cacheReadInputTokens =
                              (usage.cacheReadInputTokens || 0) + cacheReadTokens;
                            // Cost is now captured from result message, not calculated here
                          }

                          // Create new array reference for change detection
                          state.messages.set(streamingChatId, [...messages]);
                        }

                        // Also store in streaming message for active view
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
                          // Accumulate tokens (they may come in multiple chunks)
                          const usage = streamingMsg.tokenUsage;
                          if (usage) {
                            usage.inputTokens += inputTokens;
                            usage.outputTokens += outputTokens;
                            usage.cacheCreationInputTokens =
                              (usage.cacheCreationInputTokens || 0) + cacheCreationTokens;
                            usage.cacheReadInputTokens =
                              (usage.cacheReadInputTokens || 0) + cacheReadTokens;
                            // Cost is now captured from result message, not calculated here
                          }
                        }
                      }
                    }
                  }
                });
              },
              onSystem: async (message) => {
                // Capture Claude session ID from init message
                if (message.subtype === 'init' && message.session_id) {
                  const sessionId = message.session_id; // Capture for TypeScript
                  // Always update the in-memory session ID for use with --resume flag
                  set((state) => {
                    state.sessionIds.set(capturedSelectedAgentId, sessionId);
                  });

                  // Capture MCP servers from init message
                  if (message.mcp_servers && Array.isArray(message.mcp_servers)) {
                    set((state) => {
                      state.mcpServers.set(capturedSelectedAgentId, message.mcp_servers || []);
                    });
                  }

                  // Update the session manifest with the new session ID
                  // This happens on EVERY message (since session IDs change every time)
                  const worktreeId = agent?.projectId;
                  if (worktreeId) {
                    // Use IPC to update the session manifest in the main process
                    await window.electron.ipcRenderer.invoke(
                      'agents:updateSession',
                      worktreeId,
                      capturedSelectedAgentId,
                      sessionId
                    );
                  }
                }

                // Handle compact_boundary message - reset context usage and display notification
                if (message.subtype === 'compact_boundary' && message.compact_metadata) {
                  logger.warn(
                    '[CoreStore] ⚠️ COMPACT_BOUNDARY MESSAGE RECEIVED - RESETTING CONTEXT USAGE'
                  );
                  logger.warn('[CoreStore] AgentId:', capturedSelectedAgentId);
                  logger.warn(
                    '[CoreStore] Current context before reset:',
                    JSON.stringify(get().agentContextUsage.get(capturedSelectedAgentId))
                  );

                  // Reset the agent's context usage to 0 since the context window was compacted
                  get().resetAgentContextUsage(capturedSelectedAgentId);

                  logger.warn('[CoreStore] Context usage RESET complete');
                  logger.warn(
                    '[CoreStore] New context after reset:',
                    JSON.stringify(get().agentContextUsage.get(capturedSelectedAgentId))
                  );

                  const compactText = `Compaction completed\n\nPre-compaction tokens: ${message.compact_metadata.pre_tokens}\n\nTrigger: ${message.compact_metadata.trigger}`;

                  set((state) => {
                    const messages = state.messages.get(streamingChatId) || [];
                    // Find the last empty assistant message (placeholder) and update it
                    const lastMessage = messages[messages.length - 1];
                    if (
                      lastMessage &&
                      lastMessage.role === 'assistant' &&
                      lastMessage.content === ''
                    ) {
                      // Update the placeholder with compaction content
                      lastMessage.content = compactText;
                      state.messages.set(streamingChatId, [...messages]);
                    } else {
                      // No placeholder found, create new message
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
                // Handle tool use messages
                set((state) => {
                  const streamingMsg = state.streamingMessages.get(streamingChatId);
                  if (streamingMsg) {
                    if (!streamingMsg.toolCalls) {
                      streamingMsg.toolCalls = [];
                    }
                    streamingMsg.toolCalls.push({
                      type: 'tool_use',
                      id: message.tool_id,
                      name: message.tool_name,
                      input: message.tool_input,
                    });

                    const streamingMessage: any = {
                      id: message.tool_id || `tool-${Date.now()}`,
                      type: 'tool_use',
                      timestamp: new Date().toISOString(),
                      tool_id: message.tool_id,
                      tool_name: message.tool_name,
                      tool_input: message.tool_input,
                      parent_tool_use_id: message.parent_tool_use_id || null,
                      parent_message_id: capturedStreamingMessageId, // Pass ChatMessage ID for consistent todo IDs
                    };
                    // Use worktree-specific monitor
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
                        // Ensure todos have unique IDs
                        const todosWithIds = message.tool_input.todos.map(
                          (todo: any, index: number) => ({
                            id: todo.id || `todo-${capturedStreamingMessageId}-${index}`,
                            content: todo.content || '',
                            status: todo.status || 'pending',
                            priority: todo.priority || 'medium',
                            activeForm: todo.activeForm || todo.content,
                          })
                        );
                        messages[messageIndex].latestTodos = todosWithIds;
                        state.messages.set(streamingChatId, [...messages]);
                      }
                    }
                  }
                });
              },
              onToolResult: (message) => {
                // Handle tool results
                set((state) => {
                  const streamingMsg = state.streamingMessages.get(streamingChatId);
                  if (streamingMsg) {
                    if (!streamingMsg.toolCalls) {
                      streamingMsg.toolCalls = [];
                    }
                    streamingMsg.toolCalls.push({
                      type: 'tool_result',
                      tool_use_id: message.tool_use_id,
                      content: message.content,
                    });
                  }
                });
              },
              onResult: (result: any) => {
                // If there's an error in the result, stop streaming immediately
                if (result.error || result.is_error) {
                  set((state) => {
                    if (streamingChatId) {
                      state.streamingStates = new Map(state.streamingStates).set(
                        streamingChatId,
                        false
                      );
                    }
                  });
                }

                // Detect session termination errors and create system messages
                if (
                  result.subtype === 'error_max_turns' ||
                  result.subtype === 'error_during_execution'
                ) {
                  logger.info('[Core Store] Detected session termination:', result.subtype);

                  set((state) => {
                    const messages = state.messages.get(streamingChatId) || [];
                    let systemMessage: ChatMessage;

                    if (result.subtype === 'error_max_turns') {
                      // Create max turns warning message
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
                      logger.info(
                        '[Core Store] Created error_max_turns system message:',
                        JSON.stringify(systemMessage)
                      );
                    } else {
                      // Create execution error warning message
                      const errorDetail = result.error?.message || result.result || 'Unknown error';
                      systemMessage = {
                        id: nanoid(),
                        role: 'assistant',
                        content: `⚠️ Session terminated: An error occurred during execution. ${errorDetail}`,
                        timestamp: new Date(),
                      };
                      logger.info(
                        '[Core Store] Created error_during_execution system message:',
                        JSON.stringify(systemMessage)
                      );
                    }

                    // Add system message to chat history
                    state.messages.set(streamingChatId, [...messages, systemMessage]);

                    // Stop streaming
                    state.streamingStates = new Map(state.streamingStates).set(
                      streamingChatId,
                      false
                    );
                  });
                }

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

                // Update agent context usage from modelUsage data
                if (result.modelUsage && capturedSelectedAgentId) {
                  get().updateAgentContextUsage(capturedSelectedAgentId, result.modelUsage);
                }

                // Store the result data for use in onComplete
                if (
                  result.usage ||
                  result.total_cost_usd ||
                  result.stop_reason ||
                  result.error ||
                  result.request_id
                ) {
                  set((state) => {
                    // Store the result data temporarily in streamingMessages for onComplete to use
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

                    // Apply the result data (cost and usage) if available
                    if (streamingMsg?.resultData) {
                      const resultData = streamingMsg.resultData;
                      message.tokenUsage = {
                        inputTokens: resultData.usage?.input_tokens || 0,
                        outputTokens: resultData.usage?.output_tokens || 0,
                        cacheCreationInputTokens:
                          resultData.usage?.cache_creation_input_tokens || 0,
                        cacheReadInputTokens: resultData.usage?.cache_read_input_tokens || 0,
                      };
                      // Store SDK's total cost separately
                      if (resultData.total_cost_usd !== undefined) {
                        message.totalCostUSD = resultData.total_cost_usd;
                      }

                      // Store stop_reason, error, and request_id
                      if (resultData.stop_reason) {
                        message.stopReason = resultData.stop_reason;
                      }
                      if (resultData.stop_sequence !== undefined) {
                        message.stopSequence = resultData.stop_sequence;
                      }
                      if (resultData.request_id) {
                        message.requestId = resultData.request_id;
                      }
                      if (resultData.error) {
                        message.error = resultData.error;
                        // Clear content since error will be displayed via ClaudeErrorDisplay
                        message.content = '';
                      }

                      // Update worktree stats with the actual cost
                      if (agent?.projectId && resultData.total_cost_usd) {
                        const projectId = agent.projectId;
                        const stats = state.worktreeStats[projectId];
                        if (stats) {
                          stats.totalCost = (stats.totalCost || 0) + resultData.total_cost_usd;
                          stats.lastUpdated = new Date();
                        }
                      }
                    }

                    if (streamingMsg?.toolCalls) {
                      message.toolCalls = streamingMsg.toolCalls;

                      let lastTodos = null;
                      for (const tc of streamingMsg.toolCalls) {
                        if (tc.type === 'tool_use' && tc.name === 'TodoWrite' && tc.input?.todos) {
                          lastTodos = tc.input.todos;
                        }
                      }
                      if (lastTodos) {
                        // Ensure todos have unique IDs
                        message.latestTodos = lastTodos.map((todo: any, index: number) => ({
                          id: todo.id || `todo-${message.id}-${index}`,
                          content: todo.content || '',
                          status: todo.status || 'pending',
                          priority: todo.priority || 'medium',
                        }));
                      }

                      message.simplifiedToolCalls = streamingMsg.toolCalls
                        .filter((tc) => tc.type === 'tool_use' && tc.name)
                        .map((tc) => {
                          if (tc.name === 'TodoWrite') return null;

                          let description = '';
                          if (tc.input) {
                            switch (tc.name) {
                              case 'Write':
                              case 'Read':
                              case 'Edit':
                              case 'MultiEdit':
                                description = tc.input.file_path || tc.input.path || '';
                                break;
                              case 'Grep':
                                description = `"${tc.input.pattern || ''}" in ${tc.input.path || '.'}`;
                                break;
                              case 'Glob':
                                description = `${tc.input.pattern || ''} in ${tc.input.path || '.'}`;
                                break;
                              case 'LS':
                                description = tc.input.path || '.';
                                break;
                              case 'Bash':
                                description = tc.input.command || '';
                                break;
                              case 'Task':
                                description = tc.input.description || '';
                                break;
                              default:
                                if (tc.input?.path) description = tc.input.path;
                                else if (tc.input?.file_path) description = tc.input.file_path;
                                else if (tc.input?.query) description = tc.input.query;
                            }
                          }

                          return {
                            type: 'tool_use' as const,
                            name: tc.name!,
                            ...(description && { description }),
                          };
                        })
                        .filter((tc): tc is NonNullable<typeof tc> => tc !== null);
                    }

                    // Token usage is already added directly to the message during streaming
                    // Just ensure it's preserved if not already there
                    const streamingMsg2 = state.streamingMessages.get(streamingChatId);
                    if (!message.tokenUsage && streamingMsg2?.tokenUsage) {
                      message.tokenUsage = streamingMsg2.tokenUsage;
                    }

                    // Calculate duration if startTime exists
                    if (message.startTime) {
                      message.duration = Date.now() - message.startTime.getTime();

                      // Update worktree stats with final time
                      if (agent?.projectId) {
                        const projectId = agent.projectId;
                        const stats = state.worktreeStats[projectId];
                        if (stats && stats.currentStreamStartTime) {
                          const streamDuration = Date.now() - stats.currentStreamStartTime;
                          stats.totalStreamingTime =
                            (stats.totalStreamingTime || 0) + streamDuration;
                          stats.lastRequestDuration = streamDuration;
                          delete stats.currentStreamStartTime; // Clear current stream marker
                          stats.lastUpdated = new Date();
                        }
                      }
                    }
                  }
                  // Don't update any message with finalContent
                  // Individual messages have already been created during streaming
                  state.messages.set(streamingChatId, [...messages]);

                  // ALWAYS clear streaming state regardless of activeChat
                  // This ensures the loading indicator is removed even if user switched chats
                  state.streamingStates = new Map(state.streamingStates).set(
                    streamingChatId,
                    false
                  );

                  // Also clear it for activeChat if it's different (belt and suspenders)
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

                  // Clear chatError when streaming completes - the error has been applied to the message
                  // and will be displayed via ClaudeErrorDisplay component
                  state.chatError = null;
                });
              },
            }
          );
        } catch (error) {
          // Note: After fixing ClaudeCodeService to not reject on abort,
          // this error handler should only catch actual errors, not aborts
          logger.error('[DEBUG sendMessage] Error in queryWithStreaming:', error);

          // Check if this is an abort error (user clicked stop) - though this shouldn't happen anymore
          if (error instanceof Error && error.message === 'Query aborted') {
            logger.debug('[DEBUG sendMessage] Query was aborted by user (legacy path)');
            // This is expected when user stops streaming, don't treat as error
            set((state) => {
              if (streamingChatId) {
                state.streamingStates = new Map(state.streamingStates).set(streamingChatId, false);
              }
              const newStreamingMessages = new Map(state.streamingMessages);
              newStreamingMessages.delete(streamingChatId);
              state.streamingMessages = newStreamingMessages;
              // Don't set chatError for aborts
            });
            return; // Don't re-throw abort errors
          }

          // Handle actual errors
          logger.error('[DEBUG sendMessage] Handling error, setting chatError');
          set((state) => {
            state.chatError = error instanceof Error ? error.message : 'Failed to send message';
            if (streamingChatId) {
              state.streamingStates = new Map(state.streamingStates).set(streamingChatId, false);
            }
            const newStreamingMessages = new Map(state.streamingMessages);
            newStreamingMessages.delete(streamingChatId);
            state.streamingMessages = newStreamingMessages;
          });
          throw error;
        }
      },

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
                  state.chatError = chunk.toolResult || 'Streaming error occurred';
                  break;
              }
            });
          }

          // Mark streaming as complete and update the existing streaming message
          set((state) => {
            if (!state.activeChat) return;
            const streamingMsg = state.streamingMessages.get(state.activeChat);
            if (!streamingMsg) return;

            const finalContent = streamingMsg.chunks.join('');
            const messages = state.messages.get(state.activeChat) || [];

            // Find and update the existing streaming message
            const messageIndex = messages.findIndex((m) => m.id === streamId);
            let updatedMessages;
            if (messageIndex !== -1) {
              // Create new array with updated message
              updatedMessages = [...messages];
              updatedMessages[messageIndex] = {
                ...messages[messageIndex],
                content: finalContent,
                timestamp: new Date(),
              };
            } else {
              // Fallback: add as new message if not found (shouldn't happen)
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
          set((state) => {
            state.chatError = error instanceof Error ? error.message : 'Streaming failed';
            if (state.activeChat) {
              state.streamingStates = new Map(state.streamingStates).set(state.activeChat, false);
              const newStreamingMessages = new Map(state.streamingMessages);
              newStreamingMessages.delete(state.activeChat);
              state.streamingMessages = newStreamingMessages;
            }
          });
        }
      },

      clearChat: (chatId: string) => {
        set((state) => {
          state.messages.delete(chatId);
          state.attachments.delete(chatId);
          // Clear context usage for this agent
          state.agentContextUsage.delete(chatId);
        });
      },

      stopStreaming: () => {
        // Get the current active agent ID
        const state = get();
        const activeAgentId = state.activeChat; // activeChat is the agent ID

        // Stop the Claude Code service streaming for this specific agent
        claudeCodeService.stopStreaming(activeAgentId || undefined);

        // Update state to reflect streaming has stopped
        set((state) => {
          // Remove the empty assistant message if streaming was interrupted
          if (state.activeChat) {
            const streamingMsg = state.streamingMessages.get(state.activeChat);
            if (streamingMsg) {
              const messages = state.messages.get(state.activeChat) || [];
              const messageIndex = messages.findIndex((m) => m.id === streamingMsg.id);

              // Remove the message if it's empty or has no content
              if (messageIndex !== -1) {
                const message = messages[messageIndex];
                if (!message.content || message.content.trim() === '') {
                  // Create new array without the empty message
                  const updatedMessages = messages.filter((_, index) => index !== messageIndex);
                  state.messages.set(state.activeChat, updatedMessages);
                }
              }
            }
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

      normalizeTodoStatuses: (
        todos:
          | Array<{
              id: string;
              content: string;
              status: 'pending' | 'in_progress' | 'completed';
              priority: 'low' | 'medium' | 'high';
              activeForm?: string;
            }>
          | undefined,
        isSessionActive: boolean
      ) => {
        if (!todos) return undefined;
        if (todos.length === 0) return [];

        logger.info(
          `[CoreStore] Normalizing todo statuses for ${todos.length} todos (session active: ${isSessionActive})`
        );

        return todos.map((todo) => {
          if (todo.status === 'in_progress' && !isSessionActive) {
            logger.debug(
              `[CoreStore] Resetting in_progress todo to pending: ${todo.id} - ${todo.content}`
            );
            return { ...todo, status: 'pending' as const };
          }
          return todo;
        });
      },

      loadChatHistory: async (chatId: string) => {
        try {
          if (window.electron?.agents?.loadChatHistory) {
            const result = await window.electron.agents.loadChatHistory(chatId);
            // Handle both return formats from the API
            const messages = Array.isArray(result) ? result : result.messages || [];
            const sessionId = !Array.isArray(result) ? result.sessionId : null;

            // Note: Messages are already in ChatMessage format from the file
            // If in the future we need to process raw SDK messages, we can use MessageProcessor
            // Example: const processedMessages = messages.map(msg =>
            //   MessageProcessor.processSdkMessage(msg).chatMessage || msg
            // );

            // Check if any message has the isCompactionReset flag
            // If so, reset the agent's context usage
            const hasCompactionReset = messages.some((msg: ChatMessage) => msg.isCompactionReset);
            if (hasCompactionReset) {
              logger.warn(
                '[CoreStore] Detected compaction reset in chat history - resetting context usage'
              );
              logger.warn('[CoreStore] AgentId:', chatId);
              get().resetAgentContextUsage(chatId);
            }

            // Detect incomplete/corrupted sessions: last assistant message with null stopReason
            // indicates the JSONL file never properly completed (app crash, improper shutdown, etc.)
            const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

            // Helper function to check for incomplete session (handles both formats)
            const hasIncompleteSession = (() => {
              if (!lastMessage || lastMessage.role !== 'assistant') return false;

              // Check camelCase format (ChatMessage interface)
              const hasCamelCase =
                'stopReason' in lastMessage && lastMessage.stopReason !== undefined;
              if (hasCamelCase && lastMessage.stopReason === null) return true;

              // Check snake_case format (raw JSONL - fallback)
              const rawMessage = lastMessage as Record<string, unknown>;
              const hasSnakeCase =
                'stop_reason' in rawMessage && rawMessage.stop_reason !== undefined;
              if (hasSnakeCase && rawMessage.stop_reason === null) return true;

              return false;
            })();

            if (hasIncompleteSession) {
              logger.warn(
                `[CoreStore] Detected incomplete session for agent ${chatId} - last message has null stop_reason. Resetting in_progress todos to pending.`
              );
            }

            // Check if session is actively streaming for this agent
            // Treat incomplete sessions as inactive (they are corrupted/orphaned)
            const isSessionActive =
              !hasIncompleteSession &&
              (get().streamingStates.get(chatId) || get().streamingMessages.has(chatId));

            // Normalize todo statuses in messages before adding to state
            const normalizedMessages = messages.map((msg: ChatMessage) => {
              if (msg.latestTodos && msg.latestTodos.length > 0) {
                const normalized = get().normalizeTodoStatuses(msg.latestTodos, isSessionActive);
                if (normalized) {
                  logger.info(
                    `[CoreStore] Normalizing todo statuses for message ${msg.id} (${msg.latestTodos.length} todos, session active: ${isSessionActive})`
                  );
                  return { ...msg, latestTodos: normalized };
                }
              }
              return msg;
            });

            set((state) => {
              const existingMessages = state.messages.get(chatId) || [];

              // Create a map of existing message IDs for O(1) lookup
              const existingIds = new Set(existingMessages.map((m) => m.id));

              // Only add messages that don't already exist in memory
              const newMessages = normalizedMessages.filter(
                (m: ChatMessage) => !existingIds.has(m.id)
              );

              // Merge and sort by timestamp to maintain chronological order
              const mergedMessages = [...existingMessages, ...newMessages].sort(
                (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
              );

              state.messages.set(chatId, mergedMessages);

              // Store the latest session ID from JSONL filename if available
              if (sessionId && chatId) {
                state.sessionIds.set(chatId, sessionId);
              }
            });

            // Load todos into TodoActivityMonitor for the right panel display
            // IMPORTANT: Use normalizedMessages (with todos reset to pending if session is inactive)
            const todoMonitor = getTodoMonitor(chatId);
            if (todoMonitor && normalizedMessages.length > 0) {
              // Find the LAST message with latestTodos to get the final todo state
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

              // Only load the last todo state if found
              if (lastTodoMessage && lastTodoMessage.latestTodos) {
                logger.info(
                  `[CoreStore] Loading ${lastTodoMessage.latestTodos.length} todos into TodoActivityMonitor with statuses: ${lastTodoMessage.latestTodos.map((t) => `${t.content}:${t.status}`).join(', ')}`
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
          logger.error('Failed to load chat history:', error);
          return [];
        }
      },

      compactHistory: (_chatId: string, _maxTokens: number) => {
        // TODO: Implement conversation compaction logic
      },

      // Project Actions
      loadProjects: async () => {
        set((state) => {
          state.projectsLoading = true;
          state.projectsError = null;
        });

        try {
          if (window.electron?.worktree?.getAll) {
            const projectsArray = await window.electron.worktree.getAll();
            // Get the data directory path to construct full paths
            const dataDir = await window.electron.worktree.getDataDirectory();
            const worktreesDir = `${dataDir}/worktrees`;

            set((state) => {
              // Transform worktree objects to Project objects
              // Filter out invalid worktrees (missing required fields)
              const projects = projectsArray
                .filter(
                  (worktree: any) =>
                    worktree.git_repo && worktree.branch_name && worktree.folder_name
                )
                .map(
                  (worktree: any): Project => ({
                    id: worktree.git_repo + '_' + worktree.branch_name, // Create ID from repo + branch
                    name: worktree.folder_name,
                    ...(worktree.description && { description: worktree.description }),
                    githubRepo: worktree.git_repo,
                    branchName: worktree.branch_name,
                    localPath: `${worktreesDir}/${worktree.folder_name}`,
                    folderName: worktree.folder_name,
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  })
                );
              state.projects = new Map(projects.map((project: Project) => [project.id, project]));
              state.projectsLoading = false;
            });
          }
        } catch (error) {
          set((state) => {
            state.projectsError =
              error instanceof Error ? error.message : 'Failed to load projects';
            state.projectsLoading = false;
          });
        }
      },

      createProject: async (config: ProjectConfig) => {
        try {
          // Create worktree using electron service
          if (window.electron?.worktree && config.githubRepo && config.branchName) {
            const result = await window.electron.worktree.create({
              githubRepo: config.githubRepo,
              branchName: config.branchName,
            });

            if (!result.success) {
              throw new Error(result.message);
            }

            // Create project object with worktree details
            const newProject: Project = {
              id: `${config.githubRepo}_${config.branchName}`,
              name: config.name,
              ...(config.description && { description: config.description }),
              githubRepo: config.githubRepo,
              branchName: config.branchName,
              localPath: result.localPath || '',
              folderName: result.folderName,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            set((state) => {
              state.projects.set(newProject.id, newProject);
            });

            // Create a default agent for this worktree with correct projectId
            const projectId = result.folderName;
            const agentData = {
              title: `${config.name} Session`,
              content: '',
              preview: '',
              type: AgentType.TEXT,
              status: AgentStatus.DRAFT,
              tags: [],
              resourceIds: [],
              projectId: projectId, // Use folderName as projectId
            };

            // Create agent via electron service
            if (window.electron?.agents) {
              const newAgent = await window.electron.agents.create(agentData);

              // Add agent to store and select the project/agent
              set((state) => {
                state.agents.set(newAgent.id, newAgent);
                state.selectedProjectId = newProject.id;
                state.selectedAgentId = newAgent.id;
                state.activeChat = newAgent.id;
              });

              // Load slash commands for the new project
              await get().loadSlashCommands();
            }

            return newProject;
          } else {
            // Fallback for missing worktree API
            const newProject: Project = {
              id: nanoid(),
              name: config.name,
              ...(config.description && { description: config.description }),
              ...(config.githubRepo && { githubRepo: config.githubRepo }),
              ...(config.branchName && { branchName: config.branchName }),
              localPath: config.localPath || '',
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            set((state) => {
              state.projects.set(newProject.id, newProject);
            });

            return newProject;
          }
        } catch (error) {
          set((state) => {
            state.projectsError =
              error instanceof Error ? error.message : 'Failed to create project';
          });
          throw error;
        }
      },

      selectProject: async (id: string, skipAgentSelection?: boolean) => {
        const previousProjectId = get().selectedProjectId;

        set((state) => {
          if (previousProjectId && previousProjectId !== id) {
            if (state.activeChat) {
              const isActivelyStreaming = state.streamingStates.get(state.activeChat) || false;
              const streamingMessage = state.streamingMessages.get(state.activeChat);
              const hasPendingPermission = streamingMessage?.permissionRequest;

              // Only delete streaming message if not streaming AND no pending permission request
              if (!isActivelyStreaming && !hasPendingPermission) {
                const newStreamingMessages = new Map(state.streamingMessages);
                newStreamingMessages.delete(state.activeChat);
                state.streamingMessages = newStreamingMessages;
              }
            }
          }
          state.selectedProjectId = id;
        });

        // No need to set worktree - each project has its own monitor instance

        // Load slash commands for the selected project
        await get().loadSlashCommands();

        // Skip automatic agent selection if requested (e.g., when manually selecting a specific agent)
        if (skipAgentSelection) {
          return;
        }

        // Find existing agent for this project
        const state = get();
        const project = state.projects.get(id);
        if (!project) return;

        // Find agent for this project (using folderName as projectId)
        const projectId = project.folderName || project.id;
        const projectAgents = Array.from(state.agents.values()).filter(
          (agent) => agent.projectId === projectId
        );

        if (projectAgents.length > 0) {
          // Only select the first agent if no agent is currently selected
          // or if the currently selected agent is not from this project
          const currentAgent = state.selectedAgentId
            ? state.agents.get(state.selectedAgentId)
            : null;
          if (!currentAgent || currentAgent.projectId !== projectId) {
            await get().selectAgent(projectAgents[0].id);
          }
        } else {
          // No agent exists - this shouldn't happen if worktree was created properly
          // But handle gracefully by creating one
          const newAgent = await get().createAgent({
            title: `${project.name} Session`,
            content: '',
            type: AgentType.TEXT,
            status: AgentStatus.DRAFT,
            projectId: projectId,
          });
          await get().selectAgent(newAgent.id);
        }
      },

      deleteProject: async (id: string) => {
        try {
          // Get the project to find its folderName
          const project = get().projects.get(id);
          if (!project || !project.folderName) {
            throw new Error('Project not found or missing folder name');
          }

          // Delete the worktree from disk and config
          if (window.electron?.worktree?.delete) {
            const result = await window.electron.worktree.delete(project.folderName);
            if (!result.success) {
              throw new Error(result.error || 'Failed to delete worktree');
            }
          }

          // Clean up terminal session for this project
          const { useTerminalStore } = await import('./terminal');
          const terminalStore = useTerminalStore.getState();
          const session = terminalStore.getTerminalSession(id);
          if (session) {
            // Destroy the terminal process via IPC
            try {
              await window.electron.ipc.invoke('terminal:destroy', session.terminalId);
            } catch (err) {
              logger.error('Failed to destroy terminal:', err);
            }
            // Remove the session from store (this will dispose XTerm instance)
            terminalStore.removeTerminalSession(id);
          }

          // Remove from local state
          set((state) => {
            state.projects.delete(id);
            if (state.selectedProjectId === id) {
              state.selectedProjectId = null;
              // Also clear selected agent when deleting the selected project
              state.selectedAgentId = null;
              state.activeChat = null;
            }
          });
        } catch (error) {
          set((state) => {
            state.projectsError =
              error instanceof Error ? error.message : 'Failed to delete project';
          });
          throw error;
        }
      },

      // Resource Actions
      loadResources: async () => {
        set((state) => {
          state.resourcesLoading = true;
        });

        try {
          // TODO: Load resources from service
          const resourcesArray: Resource[] = [];
          set((state) => {
            state.resources = new Map(resourcesArray.map((resource) => [resource.id, resource]));
            state.resourcesLoading = false;
          });
        } catch (error) {
          set((state) => {
            state.resourcesLoading = false;
          });
        }
      },

      uploadResource: async (file: File) => {
        try {
          if (!window.electron?.resources) {
            throw new Error('Electron IPC not available');
          }

          // Extract file path from File object
          const filePath = (file as any).path || file.name;
          const metadata = {
            mimeType: file.type,
            size: file.size,
            lastModified: file.lastModified,
          };

          const resource = await window.electron.resources?.uploadResources?.(filePath, metadata);

          // Store resource in the Map
          set((state) => {
            state.resources.set(resource.id, resource);
          });

          return resource;
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to upload resource');
        }
      },

      attachResource: (id: string, resource?: Resource) => {
        const state = get();
        const { activeChat } = state;
        if (!activeChat) {
          return;
        }

        // If resource is provided, store it first
        if (resource) {
          set((state) => {
            state.resources.set(id, resource);
          });
        }

        const resourceData = resource || state.resources.get(id);
        if (!resourceData) {
          return;
        }

        set((state) => {
          const attachments = state.attachments.get(activeChat) || [];
          const attachment: Attachment = {
            id: nanoid(),
            resourceId: id,
            name: resourceData.name,
            type: resourceData.type,
            size: resourceData.size,
          };
          attachments.push(attachment);
          state.attachments.set(activeChat, attachments);
        });
      },

      detachResource: (id: string) => {
        const state = get();
        const { activeChat } = state;
        if (!activeChat) return;

        set((state) => {
          const attachments = state.attachments.get(activeChat) || [];
          const filtered = attachments.filter((att: Attachment) => att.resourceId !== id);
          state.attachments.set(activeChat, filtered);
        });
      },

      // Task Actions
      addTask: (task: Task) => {
        set((state) => {
          state.tasks.push(task);
        });
      },

      updateTask: (id: string, updates: Partial<Task>) => {
        set((state) => {
          const taskIndex = state.tasks.findIndex((task: Task) => task.id === id);
          if (taskIndex !== -1) {
            const previousStatus = state.tasks[taskIndex].status;
            state.tasks[taskIndex] = { ...state.tasks[taskIndex], ...updates };

            // Trigger badge notification on task completion or failure
            // The badge will be shown if the window is not focused
            if (updates.status && previousStatus !== updates.status) {
              if (updates.status === 'completed' || updates.status === 'failed') {
                // Use type assertion to access badge API
                const electronWithBadge = window.electron as any;
                if (electronWithBadge.badge) {
                  electronWithBadge.badge.show().catch((error: any) => {
                    logger.error('Failed to show badge notification:', error);
                  });
                }
              }
            }
          }
        });
      },

      deleteTask: (id: string) => {
        set((state) => {
          state.tasks = state.tasks.filter((task: Task) => task.id !== id);
          if (state.focusedTodoId === id) {
            state.focusedTodoId = null;
          }
        });
      },

      setFocusedTodo: (id: string | null) => {
        set((state) => {
          state.focusedTodoId = id;
        });
      },

      // Slash Commands Actions
      loadSlashCommands: async () => {
        logger.debug('[CoreStore] ========== LOAD SLASH COMMANDS CALLED ==========');

        set((state) => {
          state.slashCommandsLoading = true;
          state.slashCommandsError = null;
        });

        try {
          if (window.electron?.slashCommands) {
            // Get the currently selected project's path
            const selectedProjectId = get().selectedProjectId;
            const project = get().projects.get(selectedProjectId || '');
            let commandsPath = project?.localPath;

            // If no project path but we have a selected project ID, construct the worktree path
            if (!commandsPath && selectedProjectId) {
              try {
                const autoSteerDir = await window.electron.worktree.getDataDirectory();
                commandsPath = `${autoSteerDir}/worktrees/${selectedProjectId}`;
                logger.debug('[CoreStore] Constructed worktree path:', commandsPath);
              } catch (error) {
                logger.error('[CoreStore] Error getting worktree directory:', error);
                commandsPath = undefined;
              }
            }

            // Pass the project path to load commands from the correct directory
            const commands = await window.electron.slashCommands.load(commandsPath);

            set((state) => {
              state.slashCommands = commands;
              state.slashCommandsLoading = false;
            });
          } else {
            logger.warn('[CoreStore] window.electron.slashCommands not available');
            set((state) => {
              state.slashCommandsLoading = false;
            });
          }
        } catch (error) {
          logger.error('[CoreStore] Error loading slash commands:', error);
          set((state) => {
            state.slashCommandsError =
              error instanceof Error ? error.message : 'Failed to load slash commands';
            state.slashCommandsLoading = false;
          });
        }
      },

      // Worktree Stats Actions
      updateWorktreeStats: (projectId, tokenUsage) => {
        set((state) => {
          if (!state.worktreeStats[projectId]) {
            state.worktreeStats[projectId] = {
              projectId,
              totalInputTokens: 0,
              totalOutputTokens: 0,
              totalCacheCreationTokens: 0,
              totalCacheReadTokens: 0,
              totalCost: 0,
              messageCount: 0,
              lastUpdated: new Date(),
            };
          }

          const stats = state.worktreeStats[projectId];
          stats.totalInputTokens += tokenUsage.inputTokens || 0;
          stats.totalOutputTokens += tokenUsage.outputTokens || 0;
          stats.totalCacheCreationTokens += tokenUsage.cacheCreationInputTokens || 0;
          stats.totalCacheReadTokens += tokenUsage.cacheReadInputTokens || 0;
          stats.messageCount += 1;
          stats.lastUpdated = new Date();

          if (tokenUsage.duration !== undefined) {
            stats.lastRequestDuration = tokenUsage.duration;
          }

          const lastMessageTokens = (tokenUsage.inputTokens || 0) + (tokenUsage.outputTokens || 0);
          if (lastMessageTokens > 0) {
            stats.lastMessageTokens = lastMessageTokens;
          }
        });
      },

      resetWorktreeStats: (projectId) => {
        set((state) => {
          if (state.worktreeStats[projectId]) {
            state.worktreeStats[projectId] = {
              projectId,
              totalInputTokens: 0,
              totalOutputTokens: 0,
              totalCacheCreationTokens: 0,
              totalCacheReadTokens: 0,
              totalCost: 0,
              messageCount: 0,
              lastUpdated: new Date(),
            };
          }
        });
      },

      // Context Usage Actions
      updateAgentContextUsage: (agentId, modelUsage) => {
        set((state) => {
          const existing = state.agentContextUsage.get(agentId);

          // Check if this is a zero-token update (like /context command that doesn't make API calls)
          // If so, skip the update to preserve the last known values
          const hasTokens = Object.values(modelUsage).some((usage: any) => {
            const total =
              (usage.inputTokens || 0) +
              (usage.cacheReadInputTokens || 0) +
              (usage.cacheCreationInputTokens || 0) +
              (usage.outputTokens || 0);
            return total > 0;
          });

          if (!hasTokens && existing) {
            // Skip update - this is a no-op command, keep existing values
            return;
          }

          if (!existing) {
            // First time seeing this agent - initialize with the modelUsage data
            const initialUsage: Record<string, any> = {};
            for (const [modelName, usage] of Object.entries(modelUsage)) {
              initialUsage[modelName] = {
                inputTokens: usage.inputTokens || 0,
                outputTokens: usage.outputTokens || 0,
                cacheReadInputTokens: usage.cacheReadInputTokens || 0,
                cacheCreationInputTokens: usage.cacheCreationInputTokens || 0,
                contextWindow: usage.contextWindow || 200000,
              };
            }

            state.agentContextUsage.set(agentId, {
              agentId,
              modelUsage: initialUsage,
              lastUpdated: new Date(),
            });
          } else {
            // Update with latest turn's values (NOT accumulate - each turn contains full context state)
            for (const [modelName, usage] of Object.entries(modelUsage)) {
              existing.modelUsage[modelName] = {
                inputTokens: usage.inputTokens || 0,
                outputTokens: usage.outputTokens || 0,
                cacheReadInputTokens: usage.cacheReadInputTokens || 0,
                cacheCreationInputTokens: usage.cacheCreationInputTokens || 0,
                contextWindow: usage.contextWindow || 200000,
              };
            }
            existing.lastUpdated = new Date();
          }
        });
      },

      resetAgentContextUsage: (agentId) => {
        set((state) => {
          state.agentContextUsage.delete(agentId);
        });
      },

      getAgentContextUsage: (agentId) => {
        return get().agentContextUsage.get(agentId);
      },

      // Background Sync Actions
      startBackgroundSync: () => {
        // Clear any existing interval
        const state = get();
        if (state.backgroundSyncInterval) {
          clearInterval(state.backgroundSyncInterval);
        }

        // Start new interval - sync every 5 seconds
        const syncInterval = setInterval(async () => {
          const currentState = get();
          const activeAgentId = currentState.activeChat;

          // Only sync when there's an active agent and it's NOT currently streaming
          if (activeAgentId && !currentState.streamingStates.get(activeAgentId)) {
            try {
              await get().loadChatHistory(activeAgentId);
            } catch (error) {
              logger.error('Background sync failed:', error);
            }
          }
        }, 5000);

        set((state) => {
          state.backgroundSyncInterval = syncInterval;
        });

        return syncInterval;
      },

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
    { name: 'core-store', trace: true }
  )
);
