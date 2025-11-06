/**
 * Projects Store - Project Management State
 *
 * Handles project/worktree management, selection, and lifecycle
 *
 * Key features:
 * - Project CRUD operations (load, create, delete)
 * - Project selection with agent management
 * - Terminal cleanup on project switch
 * - Slash command loading per project
 * - Integration with Electron worktree service
 *
 * @see docs/guides-architecture.md - Project/Worktree Architecture
 */

import { logger } from '@/commons/utils/logger';
import { generateSessionName } from '@/commons/utils/sessionNameGenerator';
import { TERMINAL_TAB_ID, CHANGES_TAB_ID } from '@/constants/tabs';
import { AgentStatus, AgentType } from '@/entities';
import { Project } from '@/types/project.types';
import { enableMapSet } from 'immer';
import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { ProjectConfig } from './types';

// Enable MapSet plugin for Immer to work with Map objects
enableMapSet();

// DevTools configuration - only in development
const withDevtools = process.env.NODE_ENV === 'development' ? devtools : (f: any) => f;

/**
 * ProjectsStore Interface
 * Defines all state and actions for project management
 */
export interface ProjectsStore {
  // ==================== STATE ====================

  projects: Map<string, Project>; // All projects indexed by ID
  selectedProjectId: string | null; // Currently selected project
  projectsLoading: boolean; // Loading state
  projectsError: string | null; // Error state

  // ==================== SELECTORS ====================

  getSelectedProject: () => Project | null;
  getProject: (id: string) => Project | undefined;

  // ==================== ACTIONS ====================

  loadProjects: () => Promise<void>;
  createProject: (config: ProjectConfig) => Promise<Project>;
  selectProject: (id: string, skipAgentSelection?: boolean) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

/**
 * Create ProjectsStore with Zustand + Immer + DevTools
 *
 * Uses:
 * - Zustand for reactive state management
 * - Immer for immutable updates with mutable syntax
 * - DevTools for debugging in development
 * - Map for O(1) project lookups by ID
 */
export const useProjectsStore = create<ProjectsStore>()(
  withDevtools(
    immer<ProjectsStore>((set, get) => ({
      // ==================== INITIAL STATE ====================

      projects: new Map(),
      selectedProjectId: null,
      projectsLoading: false,
      projectsError: null,

      // ==================== SELECTORS ====================

      /**
       * Get the currently selected project
       * @returns Selected project or null
       */
      getSelectedProject: () => {
        const state = get();
        if (!state.selectedProjectId) return null;
        return state.projects.get(state.selectedProjectId) || null;
      },

      /**
       * Get a project by ID
       * @param id - Project ID
       * @returns Project or undefined
       */
      getProject: (id: string) => {
        const state = get();
        return state.projects.get(id);
      },

      // ==================== ACTIONS ====================

      /**
       * Load all projects from Electron worktree service
       * Transforms worktree data to Project objects
       */
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

      /**
       * Create a new project/worktree
       * @param config - Project configuration
       * @returns Created project
       * @throws Error if creation fails
       */
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

            // Import agents store to create default agent
            const { useAgentsStore } = await import('./agents.store');
            const agentsStore = useAgentsStore.getState();

            // Generate a unique session name
            const existingNames = new Set(
              Array.from(agentsStore.agents.values())
                .filter((agent) => agent.projectId === projectId)
                .map((agent) => agent.title)
            );
            const sessionName = generateSessionName(existingNames);

            const agentData = {
              title: sessionName,
              content: '',
              type: AgentType.TEXT,
              status: AgentStatus.DRAFT,
              tags: [],
              resourceIds: [],
              projectId: projectId, // Use folderName as projectId
            };

            // Create agent via electron service
            if (window.electron?.agents) {
              const newAgent = await window.electron.agents.create(agentData);

              // Add agent to agents store and select the project/agent
              useAgentsStore.setState({
                agents: new Map(agentsStore.agents).set(newAgent.id, newAgent),
              });

              set((state) => {
                state.selectedProjectId = newProject.id;
              });

              // Select agent in agents store
              await agentsStore.selectAgent(newAgent.id);

              // Load slash commands for the new project
              const { useSlashCommandsStore } = await import('./slashcommands.store');
              await useSlashCommandsStore.getState().loadSlashCommands();
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

      /**
       * Select a project and optionally select an associated agent
       * Handles terminal cleanup and slash command loading
       * @param id - Project ID to select
       * @param skipAgentSelection - Skip automatic agent selection
       */
      selectProject: async (id: string, skipAgentSelection?: boolean) => {
        const previousProjectId = get().selectedProjectId;

        // NOTE: Terminal sessions are preserved across project switches
        // TerminalTab component handles terminal session management (save/restore)
        // Backend terminal processes remain alive and can be reconnected
        // This allows seamless switching between projects without losing terminal state

        // Clear streaming messages when switching projects (import chat store)
        if (previousProjectId && previousProjectId !== id) {
          const { useChatStore } = await import('./chat.store');
          const chatStore = useChatStore.getState();

          if (chatStore.activeChat) {
            const isActivelyStreaming =
              chatStore.streamingStates.get(chatStore.activeChat) || false;
            const streamingMessage = chatStore.streamingMessages.get(chatStore.activeChat);
            const hasPendingPermission = streamingMessage?.permissionRequest;

            // Only delete streaming message if not streaming AND no pending permission request
            if (!isActivelyStreaming && !hasPendingPermission) {
              useChatStore.setState({
                streamingMessages: new Map(
                  Array.from(chatStore.streamingMessages.entries()).filter(
                    ([key]) => key !== chatStore.activeChat
                  )
                ),
              });
            }
          }
        }

        set((state) => {
          state.selectedProjectId = id;
        });

        // Load slash commands for the selected project
        const { useSlashCommandsStore } = await import('./slashcommands.store');
        await useSlashCommandsStore.getState().loadSlashCommands();

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
        const { useAgentsStore } = await import('./agents.store');
        const agentsStore = useAgentsStore.getState();

        const projectAgents = Array.from(agentsStore.agents.values()).filter(
          (agent) => agent.projectId === projectId
        );

        if (projectAgents.length > 0) {
          // Only select an agent if no agent is currently selected
          // or if the currently selected agent is not from this project
          const currentAgent = agentsStore.selectedAgentId
            ? agentsStore.agents.get(agentsStore.selectedAgentId)
            : null;
          if (!currentAgent || currentAgent.projectId !== projectId) {
            // Try to load saved active tab first
            let agentToSelect = projectAgents[0].id; // Default to first agent
            try {
              const savedTabId = await window.electron.worktree.getActiveTab(projectId);
              // Verify the saved tab exists - check both agents and system tabs (terminal/changes)
              const isValidAgent =
                savedTabId && projectAgents.some((agent) => agent.id === savedTabId);
              const isSystemTab =
                savedTabId && (savedTabId === TERMINAL_TAB_ID || savedTabId === CHANGES_TAB_ID);

              if (isValidAgent || isSystemTab) {
                agentToSelect = savedTabId!;
              }
            } catch (error) {
              // Silently fall back to first agent
            }
            await agentsStore.selectAgent(agentToSelect);
          }
        } else {
          // No agent exists - this shouldn't happen if worktree was created properly
          // But handle gracefully by creating one
          const existingNames = new Set(
            Array.from(agentsStore.agents.values())
              .filter((agent) => agent.projectId === projectId)
              .map((agent) => agent.title)
          );
          const sessionName = generateSessionName(existingNames);

          const newAgent = await agentsStore.createAgent({
            title: sessionName,
            content: '',
            type: AgentType.TEXT,
            status: AgentStatus.DRAFT,
            projectId: projectId,
          });
          await agentsStore.selectAgent(newAgent.id);
        }
      },

      /**
       * Delete a project/worktree and clean up associated resources
       * @param id - Project ID to delete
       * @throws Error if deletion fails
       */
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
          const { useTerminalStore } = await import('./terminal.store');
          const terminalStore = useTerminalStore.getState();
          const session = terminalStore.getTerminalSession(id);
          if (session) {
            // Destroy the terminal process via IPC
            try {
              await window.electron.ipc.invoke('terminal:destroy', session.terminalId);
            } catch (err) {
              logger.error('[ProjectsStore] Failed to destroy terminal:', err);
            }
            // Remove the session from store (this will dispose XTerm instance)
            terminalStore.removeTerminalSession(id);
          }

          // Remove from local state
          set((state) => {
            state.projects.delete(id);
            if (state.selectedProjectId === id) {
              state.selectedProjectId = null;
            }
          });

          // Clear selected agent when deleting the selected project
          if (get().selectedProjectId === null) {
            const { useAgentsStore } = await import('./agents.store');
            await useAgentsStore.getState().selectAgent(null);
          }
        } catch (error) {
          set((state) => {
            state.projectsError =
              error instanceof Error ? error.message : 'Failed to delete project';
          });
          throw error;
        }
      },
    })),
    {
      name: 'projects-store',
      trace: process.env.NODE_ENV === 'development',
    }
  )
);
