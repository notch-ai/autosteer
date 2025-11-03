// ============================================================================
// NOTCH APP STATE MANAGEMENT TYPES
// Single source of truth for all store type definitions
// Based on TRD Section 2.3 - 3 Store Architecture (Core, UI, Settings)
// ============================================================================

// External imports
import { VimMode } from '@/features/chat/components/editor/vim-extension';
import { Agent, ChatMessage, Resource, StreamingEvent, ToolUsage } from '@/entities';
import { VimState } from '@/stores/vimStore';
import { WorktreeConfig } from '@/types/config.types';
import { SlashCommand } from '@/types/ipc.types';
import { ModelOption } from '@/types/model.types';
import { PermissionMode } from '@/types/permission.types';
import { Project } from '@/types/project.types';
import { Task } from '@/types/todo';

// ============================================================================
// BASE TYPES FOR ALL STORES
// ============================================================================

export interface StoreSlice<T> {
  getState: () => T;
  setState: (partial: T | Partial<T>) => void;
  subscribe: (listener: (state: T) => void) => () => void;
}

// Subscription helpers
export type StateSelector<T, U> = (state: T) => U;
export type EqualityFn<T> = (a: T, b: T) => boolean;

// ============================================================================
// CORE BUSINESS ENTITY TYPES
// ============================================================================

// Chat types
export interface PermissionRequest {
  tool_name: string;
  tool_use_id: string;
  file_path: string;
  old_string?: string;
  new_string?: string;
  content?: string;
  command?: string;
  url?: string;
  query?: string;
  message: string;
}

export interface StreamingMessage {
  id: string;
  chunks: string[];
  isComplete: boolean;
  toolCalls?: ToolCall[];
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  };
  resultData?: {
    usage?: any;
    total_cost_usd?: number;
    stop_reason?:
      | 'end_turn'
      | 'max_tokens'
      | 'stop_sequence'
      | 'tool_use'
      | 'pause_turn'
      | 'refusal'
      | 'model_context_window_exceeded';
    stop_sequence?: string | null;
    request_id?: string;
    error?: any;
  };
  permissionRequest?: PermissionRequest;
  // Additional properties for tool messages
  type?: string;
  timestamp?: string;
  tool_id?: string;
  tool_name?: string;
  tool_input?: any;
  parent_tool_use_id?: string | null;
}

export interface ToolCall {
  type: 'tool_use' | 'tool_result';
  id?: string;
  tool_use_id?: string;
  name?: string;
  input?: any;
  content?: any;
}

// Attachment types
export interface Attachment {
  id: string;
  resourceId: string;
  name: string;
  type: string;
  size: number;
}

// Agent config for creation
export interface AgentConfig {
  title: string;
  content: string;
  type: Agent['type'];
  status?: Agent['status'];
  tags?: string[];
  resourceIds?: string[];
  projectId?: string;
  metadata?: Record<string, unknown>;
}

// Project config for creation
export interface ProjectConfig {
  name: string;
  description?: string;
  githubRepo?: string;
  branchName?: string;
  localPath?: string;
}

// Stream chunk type
export interface StreamChunk {
  type: 'content' | 'tool_use' | 'tool_result' | 'error';
  content?: string;
  toolName?: string;
  toolInput?: any;
  toolResult?: string;
  isError?: boolean;
}

// Search result type
export interface SearchResult {
  id: string;
  title: string;
  type: 'agent' | 'project' | 'resource';
  preview: string;
}

// Theme type
export type Theme = 'light' | 'dark' | 'system';

// User preferences
export interface UserPreferences {
  theme: Theme;
  fontSize: number;
  fontFamily: string;
  autoSave: boolean;
  compactOnTokenLimit: boolean;
  maxTokens: number;
  badgeNotifications: boolean;
  maxTurns?: number | null; // Maximum turns per Claude Code session (null = unlimited, default: null)
  defaultModel?: ModelOption; // Default model for new conversations (see DEFAULT_MODEL in model.types.ts)
}

// Custom command
export interface CustomCommand {
  id: string;
  name: string;
  description: string;
  command: string;
  createdAt: Date;
}

// Worktree type (for project integration)
export interface Worktree {
  id: string;
  name: string;
  path: string;
  branch: string;
  config: WorktreeConfig;
  createdAt: number;
  lastUsed?: number;
}

// Worktree stats
export interface WorktreeStats {
  projectId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  totalCost: number;
  messageCount: number;
  lastUpdated: Date;
  lastRequestDuration?: number;
  lastMessageTokens?: number;
  totalStreamingTime?: number; // Total cumulative streaming time in ms
  currentStreamStartTime?: number; // Timestamp when current streaming started
}

// Context usage per model for an agent
export interface ModelContextUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  contextWindow: number;
}

// Context usage tracking per agent (accumulates across session)
export interface AgentContextUsage {
  agentId: string;
  modelUsage: Record<string, ModelContextUsage>; // Key is model name (e.g., "claude-sonnet-4-5-20250929")
  lastUpdated: Date;
}

// Trace entry for SDK message logging
export interface TraceEntry {
  id: string;
  timestamp: Date;
  direction: 'to' | 'from';
  message: any; // Raw SDK message
}

// ============================================================================
// NEW STORE INTERFACES (TRD Section 2.3.2)
// ============================================================================

/**
 * CoreStore - Business entities and operations
 * Handles agents, chat, projects, resources, and tasks
 */
export interface CoreStore {
  // ==================== STATE ====================

  // Agents State
  agents: Map<string, Agent>;
  selectedAgentId: string | null;
  agentsLoading: boolean;
  agentsError: string | null;

  // Chat State
  messages: Map<string, ChatMessage[]>;
  activeChat: string | null;
  streamingMessages: Map<string, StreamingMessage>; // Per-agent streaming messages
  attachments: Map<string, Attachment[]>;
  streamingStates: Map<string, boolean>; // Per-chat streaming states
  sessionIds: Map<string, string>; // In-memory Claude session IDs per agent (not persisted)
  chatError: string | null;
  pendingToolUses: Map<string, { id: string; name: string; input: any; timestamp: Date }>;

  // Projects State
  projects: Map<string, Project>;
  selectedProjectId: string | null;
  projectsLoading: boolean;
  projectsError: string | null;

  // Resources State
  resources: Map<string, Resource>;
  resourcesLoading: boolean;

  // Tasks/Todos State
  tasks: Task[];
  focusedTodoId: string | null;

  // Slash Commands State
  slashCommands: SlashCommand[];
  slashCommandsLoading: boolean;
  slashCommandsError: string | null;

  // Worktree Stats State
  worktreeStats: Record<string, WorktreeStats>;

  // Context Usage State
  agentContextUsage: Map<string, AgentContextUsage>;

  // MCP Servers State
  mcpServers: Map<string, Array<{ name: string; status: string }>>;
  // Background Sync State
  backgroundSyncInterval: NodeJS.Timeout | null;

  // Trace State
  traceEntries: Map<string, TraceEntry[]>; // Per-chat trace messages

  // ==================== COMPUTED VALUES ====================

  getCurrentMessages: () => ChatMessage[];
  getSelectedAgent: () => Agent | null;
  getSelectedProject: () => Project | null;
  hasActiveTasks: () => boolean;

  // ==================== ACTIONS ====================

  // Agent Actions
  loadAgents: () => Promise<void>;
  createAgent: (config: AgentConfig) => Promise<Agent>;
  updateAgent: (id: string, updates: Partial<Agent>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  selectAgent: (id: string | null) => Promise<void>;

  // Chat Actions
  sendMessage: (
    message: string,
    attachments?: File[],
    resourceIds?: string[],
    options?: { permissionMode?: PermissionMode }
  ) => Promise<void>;
  streamResponse: (response: AsyncIterable<StreamChunk>) => void;
  clearChat: (chatId: string) => void;
  stopStreaming: () => void;
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
  ) =>
    | Array<{
        id: string;
        content: string;
        status: 'pending' | 'in_progress' | 'completed';
        activeForm: string;
      }>
    | undefined;
  compactHistory: (chatId: string, maxTokens: number) => void;
  loadChatHistory: (chatId: string) => Promise<ChatMessage[]>;

  // Project Actions
  loadProjects: () => Promise<void>;
  createProject: (config: ProjectConfig) => Promise<Project>;
  selectProject: (id: string, skipAgentSelection?: boolean) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  // Resource Actions
  loadResources: () => Promise<void>;
  uploadResource: (file: File) => Promise<Resource>;
  attachResource: (id: string, resource?: Resource) => void;
  detachResource: (id: string) => void;

  // Task Actions
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  setFocusedTodo: (id: string | null) => void;

  // Slash Commands Actions
  loadSlashCommands: () => Promise<void>;

  // Worktree Stats Actions
  updateWorktreeStats: (
    projectId: string,
    tokenUsage: {
      inputTokens?: number;
      outputTokens?: number;
      cacheCreationInputTokens?: number;
      cacheReadInputTokens?: number;
      duration?: number;
    }
  ) => void;
  resetWorktreeStats: (projectId: string) => void;

  // Context Usage Actions
  updateAgentContextUsage: (agentId: string, modelUsage: Record<string, any>) => void;
  resetAgentContextUsage: (agentId: string) => void;
  getAgentContextUsage: (agentId: string) => AgentContextUsage | undefined;

  // Background Sync Actions
  startBackgroundSync: () => NodeJS.Timeout;
  stopBackgroundSync: () => void;
}

/**
 * UIStore - Presentation state only
 * Handles layout, panels, search, vim, and UI-only state
 */
export interface UIStore {
  // ==================== STATE ====================

  // Layout State
  sidebarCollapsed: boolean;
  detailPanelCollapsed: boolean;
  activeView: 'list' | 'grid' | 'board';
  leftPanelWidth: number;
  rightPanelWidth: number;

  // Panel State
  activePanel: 'chat' | 'agents' | 'projects' | 'settings';
  showProjectCreation: boolean;

  // Search State
  searchQuery: string;
  searchResults: SearchResult[];
  isSearching: boolean;

  // Vim State
  vimMode: VimState;
  vimEnabled: boolean;

  // ==================== ACTIONS ====================

  // Layout Actions
  toggleSidebar: () => void;
  toggleDetailPanel: () => void;
  setActiveView: (view: 'list' | 'grid' | 'board') => void;
  setPanelWidth: (panel: 'left' | 'right', width: number) => void;

  // Panel Actions
  setActivePanel: (panel: 'chat' | 'agents' | 'projects' | 'settings') => void;
  setShowProjectCreation: (show: boolean) => void;

  // Search Actions
  setSearchQuery: (query: string) => void;
  performSearch: (query: string) => Promise<void>;
  clearSearch: () => void;

  // Vim Actions
  updateVimState: (updates: Partial<VimState>) => void;
  toggleVimMode: () => void;
  setVimMode: (mode: VimMode) => void;
  resetVimState: () => void;
}

/**
 * SettingsStore - User configuration
 * Handles preferences, API keys, and slash commands
 */
export interface SettingsStore {
  // ==================== STATE ====================

  // User Preferences
  preferences: UserPreferences;

  // API Configuration
  apiKeys: Record<string, string>;
  selectedProvider: 'mock' | 'claude-code' | 'openai';

  // Commands State
  slashCommands: SlashCommand[];
  customCommands: CustomCommand[];
  slashCommandsLoading: boolean;
  slashCommandsError: string | null;

  // Initialization State
  isInitialized: boolean;
  initializationError: string | null;

  // ==================== ACTIONS ====================

  // Core Actions
  initialize: () => Promise<void>;

  // Preference Actions
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  resetPreferences: () => Promise<void>;

  // API Key Actions
  setApiKey: (service: string, key: string) => Promise<void>;
  removeApiKey: (service: string) => Promise<void>;
  clearAllApiKeys: () => Promise<void>;

  // Provider Actions
  setProvider: (provider: 'mock' | 'claude-code' | 'openai') => Promise<void>;

  // Command Actions
  loadSlashCommands: () => Promise<void>;
  addCustomCommand: (command: Omit<CustomCommand, 'id' | 'createdAt'>) => Promise<void>;
  updateCustomCommand: (
    id: string,
    updates: Partial<Omit<CustomCommand, 'id' | 'createdAt'>>
  ) => Promise<void>;
  removeCustomCommand: (id: string) => Promise<void>;
  clearCustomCommands: () => Promise<void>;

  // Utility Actions
  exportSettings: () => Promise<string>;
  importSettings: (settingsJson: string) => Promise<void>;
  reset: () => void;
}

// ============================================================================
// DEPRECATED TYPES (FOR MIGRATION COMPATIBILITY ONLY)
// TODO: Remove these after migration is complete
// ============================================================================

/**
 * @deprecated Use CoreStore, UIStore, and SettingsStore instead
 * Legacy monolithic store interface - will be removed after migration
 */
export interface AppState {
  // Agents
  agents: Agent[];
  selectedAgentId: string | null;
  agentsLoading: boolean;
  agentsError: string | null;

  // Chat History Cache
  chatHistoryCache: Map<string, ChatMessage[]>;

  // Resources
  resources: Record<string, Resource>;
  resourcesLoading: boolean;
  resourcesError: string | null;

  // Search
  searchQuery: string;
  searchResults: Agent[];
  isSearching: boolean;

  // Chat
  chatLoading: boolean;
  chatError: string | null;
  attachedResourceIds: string[];
  isCompactingConversation: boolean;
  pendingCompactResult: string | null;

  // Streaming
  isStreaming: boolean; // Deprecated - use streamingStates Map instead (kept for backward compatibility)
  streamingMessageId: string | null;
  streamingContent: string;
  streamingToolUsages: ToolUsage[];
  streamingEvents: StreamingEvent[];

  // UI State
  sidebarCollapsed: boolean;
  detailPanelCollapsed: boolean;
  activeView: 'list' | 'grid' | 'timeline';
  leftPanelWidth: number;
  rightPanelWidth: number;

  // Tasks
  tasks: Task[];
  focusedTodoId: string | null;

  // Vim
  vim: VimState;

  // Projects
  projects: Project[];
  selectedProjectId: string | null;
  projectsLoading: boolean;
  projectsError: string | null;
  showProjectCreation: boolean;

  // Slash commands
  slashCommands: SlashCommand[];
  slashCommandsLoading: boolean;
  slashCommandsError: string | null;

  // Worktree stats
  worktreeStats: Record<string, WorktreeStats>;
}

/**
 * @deprecated Use individual store actions instead
 * Legacy monolithic store actions - will be removed after migration
 */
export interface AppActions {
  // Agent actions
  loadAgents: () => Promise<void>;
  createAgent: (agent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Agent>;
  updateAgent: (id: string, updates: Partial<Agent>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  selectAgent: (id: string | null) => void;

  // Resource actions
  loadResources: (resourceIds: string[]) => Promise<void>;
  uploadResource: (file: File) => Promise<Resource>;
  deleteResource: (id: string) => Promise<void>;
  openResource: (id: string) => Promise<void>;

  // Search actions
  searchAgents: (query: string) => Promise<void>;
  clearSearch: () => void;

  // Chat actions
  sendMessage: (content: string, options?: { permissionMode?: PermissionMode }) => Promise<void>;
  sendStreamingMessage: (
    content: string,
    options?: { permissionMode?: PermissionMode }
  ) => Promise<void>;
  attachResourceToChat: (resourceId: string) => void;
  removeAttachedResource: (resourceId: string) => void;
  clearAttachedResources: () => void;
  loadChatHistory: (agentId: string) => Promise<ChatMessage[]>;

  // Streaming actions
  stopStreaming: () => void;
  addToolUsage: (tool: ToolUsage) => void;
  updateToolUsage: (toolId: string, updates: Partial<ToolUsage>) => void;
  clearStreamingToolUsages: () => void;
  addStreamingEvent: (event: StreamingEvent) => void;
  clearStreamingEvents: () => void;

  // Chat management
  clearChat: () => Promise<void>;

  // UI actions
  toggleSidebar: () => void;
  toggleDetailPanel: () => void;
  setActiveView: (view: 'list' | 'grid' | 'timeline') => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  setFocusedTodo: (todoId: string | null) => void;

  // Task actions
  addTask: (content: string) => void;
  toggleTask: (taskId: string) => void;
  clearTasks: () => void;
  updateTasksFromMessage: (message: string) => void;

  // Vim actions
  setVimMode: (mode: VimMode) => void;
  resetVimState: () => void;
  updateVimState: (updates: Partial<VimState>) => void;

  // Utility actions
  reset: () => void;

  // Project actions
  loadProjects: () => Promise<void>;
  createProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Project>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  selectProject: (id: string | null, skipAgentSelection?: boolean) => Promise<void>;
  setShowProjectCreation: (show: boolean) => void;

  // Slash command actions
  loadSlashCommands: () => Promise<void>;

  // Stats actions
  updateWorktreeStats: (
    projectId: string,
    tokenUsage: {
      inputTokens?: number;
      outputTokens?: number;
      cacheCreationInputTokens?: number;
      cacheReadInputTokens?: number;
      duration?: number; // Duration in milliseconds
    }
  ) => void;
  resetWorktreeStats: (projectId: string) => void;
}

/**
 * @deprecated Use individual stores instead
 * Legacy combined store type - will be removed after migration
 */
export type AppStore = AppState & AppActions;

// ============================================================================
// PUBLIC API - All types are automatically exported as interfaces above
// This file serves as the single source of truth for all store types
// ============================================================================
