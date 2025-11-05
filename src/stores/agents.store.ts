/**
 * Agents Store - Agent State Management
 *
 * Handles agent CRUD operations and selection with multi-agent session support (ADR-006)
 *
 * Key features:
 * - Agent creation, updates, deletion
 * - Agent selection state
 * - Multi-agent session isolation (up to 5 per worktree)
 * - Integration with Electron IPC for persistence
 * - Zustand devtools integration for debugging
 *
 * @see docs/guides-architecture.md - ADR-006 Multi-Agent Session Architecture
 */

import { logger } from '@/commons/utils/logger';
import { Agent, AgentStatus } from '@/entities';
import { AgentConfig } from '@/stores/types';
import { enableMapSet } from 'immer';
import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Enable MapSet plugin for Immer to work with Map objects
enableMapSet();

// DevTools configuration - only in development
const withDevtools = process.env.NODE_ENV === 'development' ? devtools : (f: any) => f;

/**
 * AgentsStore Interface
 * Defines all state and actions for agent management
 */
export interface AgentsStore {
  // ==================== STATE ====================

  // Agents State
  agents: Map<string, Agent>;
  selectedAgentId: string | null;
  agentsLoading: boolean;
  agentsError: string | null;

  // ==================== SELECTORS ====================

  getAgent: (id: string) => Agent | null;
  getSelectedAgent: () => Agent | null;

  // ==================== ACTIONS ====================

  // Agent CRUD Operations
  loadAgents: () => Promise<void>;
  createAgent: (config: AgentConfig) => Promise<Agent>;
  updateAgent: (id: string, updates: Partial<Agent>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;

  // Agent Selection
  selectAgent: (id: string | null) => Promise<void>;
}

/**
 * Create AgentsStore with Zustand + Immer + DevTools
 *
 * Uses:
 * - Zustand for reactive state management
 * - Immer for immutable updates with mutable syntax
 * - DevTools for debugging in development
 * - Map for O(1) agent lookups
 */
export const useAgentsStore = create<AgentsStore>()(
  withDevtools(
    immer<AgentsStore>((set, get) => ({
      // ==================== INITIAL STATE ====================

      agents: new Map(),
      selectedAgentId: null,
      agentsLoading: false,
      agentsError: null,

      // ==================== SELECTORS ====================

      /**
       * Get agent by ID
       * @param id - Agent ID
       * @returns Agent object or null if not found
       */
      getAgent: (id: string) => {
        const state = get();
        if (!id) return null;
        return state.agents.get(id) || null;
      },

      /**
       * Get currently selected agent
       * @returns Selected agent or null
       */
      getSelectedAgent: () => {
        const state = get();
        if (!state.selectedAgentId) return null;
        return state.agents.get(state.selectedAgentId) || null;
      },

      // ==================== ACTIONS ====================

      /**
       * Load all agents from Electron IPC
       * Sets loading state during operation and handles errors
       */
      loadAgents: async () => {
        logger.info('[AgentsStore] Loading agents from Electron IPC');

        set((state) => {
          state.agentsLoading = true;
          state.agentsError = null;
        });

        try {
          if (window.electron?.agents?.loadAll) {
            const agents = await window.electron.agents.loadAll();
            logger.info(`[AgentsStore] Loaded ${agents.length} agents`);

            set((state) => {
              state.agents = new Map(agents.map((agent: Agent) => [agent.id, agent]));
              state.agentsLoading = false;
            });
          } else {
            // No electron API available (test environment)
            logger.warn('[AgentsStore] Electron API not available, skipping load');
            set((state) => {
              state.agentsLoading = false;
            });
          }
        } catch (error) {
          logger.error('[AgentsStore] Failed to load agents:', error);
          set((state) => {
            state.agentsError = error instanceof Error ? error.message : 'Failed to load agents';
            state.agentsLoading = false;
          });
        }
      },

      /**
       * Create a new agent
       * @param config - Agent configuration
       * @returns Created agent with generated ID and timestamps
       * @throws Error if creation fails
       */
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

        logger.info('[AgentsStore] Creating agent:', newAgent.id);

        try {
          let createdAgent = newAgent;

          if (window.electron?.agents?.create) {
            createdAgent = await window.electron.agents.create(newAgent);
            logger.info('[AgentsStore] Agent created via Electron IPC:', createdAgent.id);
          } else {
            logger.warn('[AgentsStore] Electron API not available, agent created in memory only');
          }

          set((state) => {
            state.agents.set(createdAgent.id, createdAgent);
          });

          console.log('Agent created', createdAgent.id);
          return createdAgent;
        } catch (error) {
          logger.error('[AgentsStore] Failed to create agent:', error);
          set((state) => {
            state.agentsError = error instanceof Error ? error.message : 'Failed to create agent';
          });
          throw error;
        }
      },

      /**
       * Update an existing agent
       * @param id - Agent ID
       * @param updates - Partial agent updates
       * @throws Error if agent not found or update fails
       */
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

        logger.info('[AgentsStore] Updating agent:', id);

        try {
          if (window.electron?.agents?.update) {
            await window.electron.agents.update(id, updates);
            logger.info('[AgentsStore] Agent updated via Electron IPC:', id);
          } else {
            logger.warn('[AgentsStore] Electron API not available, agent updated in memory only');
          }

          set((state) => {
            state.agents.set(id, updatedAgent);
          });
        } catch (error) {
          logger.error('[AgentsStore] Failed to update agent:', error);
          set((state) => {
            state.agentsError = error instanceof Error ? error.message : 'Failed to update agent';
          });
          throw error;
        }
      },

      /**
       * Delete an agent
       * @param id - Agent ID to delete
       * @throws Error if deletion fails
       * Clears selectedAgentId if deleting the selected agent
       */
      deleteAgent: async (id: string) => {
        logger.info('[AgentsStore] Deleting agent:', id);

        try {
          if (window.electron?.agents?.delete) {
            await window.electron.agents.delete(id);
            logger.info('[AgentsStore] Agent deleted via Electron IPC:', id);
          } else {
            logger.warn('[AgentsStore] Electron API not available, agent deleted in memory only');
          }

          set((state) => {
            state.agents.delete(id);
            if (state.selectedAgentId === id) {
              state.selectedAgentId = null;
              logger.info('[AgentsStore] Cleared selectedAgentId after deleting selected agent');
            }
          });
        } catch (error) {
          logger.error('[AgentsStore] Failed to delete agent:', error);
          set((state) => {
            state.agentsError = error instanceof Error ? error.message : 'Failed to delete session';
          });
          throw error;
        }
      },

      /**
       * Select an agent by ID
       * Sets both selectedAgentId and activeChat, loads chat history if needed
       * @param id - Agent ID to select, or null to deselect
       */
      selectAgent: async (id: string | null) => {
        logger.info('[AgentsStore] ========== SELECT AGENT START ==========');
        logger.info('[AgentsStore] Selecting agent:', id || 'none');

        // CRITICAL: Don't set selectedAgentId yet - wait until all async setup is complete
        // Otherwise React will render the component before the agent is fully initialized
        // causing effects to be skipped in Strict Mode

        // Update activeChat in chat store and load chat history
        const { useChatStore } = await import('./chat.store');
        const chatStore = useChatStore.getState();

        logger.info('[AgentsStore] Current activeChat before update:', chatStore.activeChat);
        logger.info(
          '[AgentsStore] Messages in chat store before load:',
          chatStore.messages.size,
          'chats'
        );
        if (id) {
          const existingMessages = chatStore.messages.get(id);
          logger.info(
            '[AgentsStore] Existing messages for agent',
            id,
            ':',
            existingMessages?.length || 0
          );
        }

        // Clear old streaming messages when switching agents
        if (chatStore.activeChat && chatStore.activeChat !== id) {
          const oldAgentIsStreaming = chatStore.streamingStates.get(chatStore.activeChat) || false;
          const oldStreamingMessage = chatStore.streamingMessages.get(chatStore.activeChat);
          const hasPendingPermission = oldStreamingMessage?.permissionRequest;

          // Only delete streaming message if not streaming AND no pending permission request
          if (!oldAgentIsStreaming && !hasPendingPermission) {
            useChatStore.setState({
              streamingMessages: new Map(
                Array.from(chatStore.streamingMessages.entries()).filter(
                  ([key]) => key !== chatStore.activeChat
                )
              ),
            });
          }
        }

        // Set activeChat in chat store
        logger.info('[AgentsStore] Setting activeChat to:', id);
        useChatStore.setState({ activeChat: id });
        logger.info('[AgentsStore] ActiveChat after update:', useChatStore.getState().activeChat);

        // Load chat history if not already in memory
        if (id) {
          const existingMessages = chatStore.messages.get(id);
          logger.info('[AgentsStore] Checking if we need to load history...');
          logger.info('[AgentsStore] Existing messages:', existingMessages?.length || 0);

          if (!existingMessages || existingMessages.length === 0) {
            logger.info('[AgentsStore] Loading chat history for agent:', id);
            await chatStore.loadChatHistory(id);

            // Verify messages were loaded
            const afterLoadMessages = useChatStore.getState().messages.get(id);
            logger.info(
              '[AgentsStore] Messages after loadChatHistory:',
              afterLoadMessages?.length || 0
            );
          } else {
            logger.info('[AgentsStore] Skipping load - messages already in memory');
          }
        }

        // Persist active tab to config.json
        if (id) {
          const { useProjectsStore } = await import('./projects.store');
          const projectsStore = useProjectsStore.getState();
          const selectedProjectId = projectsStore.selectedProjectId;
          const projects = projectsStore.projects;
          const currentProject = selectedProjectId ? projects.get(selectedProjectId) : undefined;
          const projectId = currentProject?.folderName || currentProject?.id;

          if (projectId && window.electron?.worktree?.setActiveTab) {
            try {
              await window.electron.worktree.setActiveTab(projectId, id);
              logger.info('[AgentsStore] Persisted active tab to config.json:', {
                projectId,
                tabId: id,
              });
            } catch (error) {
              logger.error('[AgentsStore] Failed to persist active tab:', error);
            }
          }
        }

        // NOW set selectedAgentId after all async setup is complete
        // This ensures React renders the component with all data ready
        set((state) => {
          state.selectedAgentId = id;
        });
        logger.info('[AgentsStore] Set selectedAgentId to:', id);

        logger.info('[AgentsStore] ========== SELECT AGENT END ==========');
      },
    })),
    {
      name: 'agents-store',
      trace: process.env.NODE_ENV === 'development',
    }
  )
);
