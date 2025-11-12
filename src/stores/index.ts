// ============================================================================
// AUTOSTEER STORE EXPORTS
// New 3-Store Architecture (TRD Section 2.1.1)
//
// ARCHITECTURE OVERVIEW:
// - CoreStore: Business entities (agents, chat, projects, resources, tasks)
// - UIStore: Presentation state (layout, panels, search, vim mode)
// - SettingsStore: Configuration (preferences, API keys, commands)
//
// MIGRATION STATUS: ✅ All new stores implemented and exported
// LEGACY STATUS: ⚠️  useAppStore kept temporarily for backward compatibility
// ============================================================================

// ==================== NEW STORE ARCHITECTURE ====================
// Use these stores for all new development

/**
 * Agents Store - Dedicated store for agent management
 * Handles: agent CRUD operations, agent selection, multi-agent session support
 * Usage: const { agents, selectedAgentId, createAgent } = useAgentsStore();
 * Hooks: useAgents(), useAgentActions(), useAgent(id), useSelectedAgent()
 */
export { useAgentsStore } from './agents.store';
export type { AgentsStore } from './agents.store';

/**
 * Chat Store - Dedicated store for chat/messaging
 * Handles: messages, streaming, attachments, session management
 * Usage: const { messages, sendMessage, stopStreaming } = useChatStore();
 * Hooks: useChatMessages(), useChatActions(), useStreamingState()
 */
export { useChatStore } from './chat.store';
export type { ChatStore } from './chat.store';

/**
 * Projects Store - Dedicated store for project/worktree management
 * Handles: project CRUD, project selection, worktree operations
 * Usage: const { projects, selectedProjectId, createProject } = useProjectsStore();
 * Hooks: useProjects(), useProjectActions(), useSelectedProject()
 */
export { useProjectsStore } from './projects.store';
export type { ProjectsStore } from './projects.store';

/**
 * Resources Store - Dedicated store for resource management
 * Handles: resource uploads, resource metadata, resource attachments
 * Usage: const { resources, uploadResource } = useResourcesStore();
 * Hooks: useResources(), useResourceActions()
 */
export { useResourcesStore, attachResourceToChat, detachResourceFromChat } from './resources.store';
export type { ResourcesStore } from './resources.store';

/**
 * Git Store - Dedicated store for git operations
 * Handles: git status, diffs, branches, commits
 * Usage: const { gitStatus, refreshGitStatus } = useGitStore();
 * Hooks: useGitStatus(), useGitActions()
 */
export { useGitStore } from './git.store';
export type { GitStore, GitStatus, GitDiff, GitFileStatus } from './git.store';

/**
 * Terminal Store - Dedicated store for terminal management
 * Handles: terminal sessions, terminal I/O, process management
 * Usage: const { terminals, createTerminal } = useTerminalStore();
 * Hooks: useTerminals(), useTerminalActions()
 */
export { useTerminalStore, clearTerminalCaches } from './terminal.store';
export type { TerminalStore } from './terminal.store';

/**
 * Slash Commands Store - Dedicated store for slash commands
 * Handles: loading and managing slash commands per project
 * Usage: const { slashCommands, loadSlashCommands } = useSlashCommandsStore();
 * Hooks: useSlashCommands(), useSlashCommandActions()
 */
export { useSlashCommandsStore } from './slashcommands.store';
export type { SlashCommandsStore } from './slashcommands.store';

/**
 * Worktree Stats Store - Dedicated store for usage statistics
 * Handles: token tracking, cost tracking, timing stats per project
 * Usage: const { worktreeStats, updateWorktreeStats } = useWorktreeStatsStore();
 * Hooks: useWorktreeStats(), useWorktreeStatsActions()
 */
export { useWorktreeStatsStore } from './worktreestats.store';
export type { WorktreeStatsStore } from './worktreestats.store';

/**
 * Context Usage Store - Dedicated store for context window tracking
 * Handles: agent context usage per model, compaction detection
 * Usage: const { agentContextUsage, updateAgentContextUsage } = useContextUsageStore();
 * Hooks: useAgentContextUsage(), useContextUsageActions()
 */
export { useContextUsageStore } from './contextusage.store';
export type { ContextUsageStore } from './contextusage.store';

/**
 * MCP Store - Dedicated store for MCP servers
 * Handles: MCP server tracking per agent, server configurations
 * Usage: const { mcpServers, setMCPServers } = useMCPStore();
 * Hooks: useMCPServers(), useMCPActions()
 */
export { useMCPStore } from './mcp.store';
export type { MCPStore } from './mcp.store';

/**
 * Tasks Store - Dedicated store for task management
 * Handles: general app tasks, task status, focus tracking
 * Note: This is for app tasks, not TodoWrite todos (managed via TodoActivityMonitor)
 * Usage: const { tasks, addTask, updateTask } = useTasksStore();
 * Hooks: useTasks(), useTasksActions(), useHasActiveTasks()
 */
export { useTasksStore } from './tasks.store';
export type { TasksStore } from './tasks.store';

// Scroll Position Store
// Replaced by useChatScroll hook - browser handles scroll with z-index stacking
// See: autosteer/src/hooks/useChatScroll.ts

// ============================================================================
// LEGACY CORE STORE REMOVED
// All functionality has been migrated to domain-specific stores above.
// Components should now use the appropriate domain store instead.
// ============================================================================

/**
 * UI Presentation Store - UI state and presentation logic only
 * Handles: layout, panels, search, vim mode, view states
 * Usage: const { sidebarCollapsed, toggleSidebar, setActivePanel } = useUIStore();
 */
export { useUIStore } from './ui';

/**
 * Settings Configuration Store - User preferences and configuration
 * Handles: theme, font settings, API keys, slash commands, custom commands
 * Usage: const { theme, updatePreferences, setApiKey } = useSettingsStore();
 */
export {
  useSettingsStore,
  useTheme,
  useFontSettings,
  useSelectedProvider,
  useApiKeys,
  useCustomCommands,
  useSlashCommands,
  useSettingsInitialization,
} from './settings';

/**
 * Monitoring Store - Application monitoring and telemetry
 * Handles: performance metrics, error tracking, usage analytics
 */
export { useMonitoringStore } from './useMonitoringStore';

// ==================== UTILITY EXPORTS ====================

/**
 * Vim Slice - Used within stores, not a standalone store
 * Provides vim functionality to UI store
 */
export { createVimSlice } from './vimStore';
export type { VimSlice } from './vimStore';

// ==================== TYPE EXPORTS ====================

/**
 * All store types and interfaces
 * Includes CoreStore, UIStore, SettingsStore, and all supporting types
 */
export * from './types';

// ============================================================================
// Legacy useAppStore has been removed. All components now use the new stores.
// ============================================================================
