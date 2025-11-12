import { Agent, Resource } from '@/entities';
import { ComputedMessage } from '@/stores/chat.selectors';
import {} from '@/stores/chat.selectors';
import type {
  MessageBoxOptions,
  MessageBoxReturnValue,
  OpenDialogOptions,
  SaveDialogOptions,
  FileFilter,
} from 'electron';

// ============================================================================
// IPC Channel Names and Constants
// ============================================================================

/**
 * IPC channel names for legacy system compatibility
 * @deprecated Use IpcChannelNames enum for new code
 */
export const IPC_CHANNELS = {
  // Agent channels
  AGENTS_LOAD_ALL: 'agents:loadAll',
  AGENTS_LOAD_BY_PROJECT: 'agents:loadByProject',
  AGENTS_CREATE: 'agents:create',
  AGENTS_UPDATE: 'agents:update',
  AGENTS_DELETE: 'agents:delete',
  AGENTS_SEARCH: 'agents:search',
  AGENTS_LOAD_CHAT_HISTORY: 'agents:loadChatHistory',
  AGENTS_UPDATE_SESSION: 'agents:updateSession',

  // Resource channels
  RESOURCES_LOAD_BY_IDS: 'resources:loadByIds',
  RESOURCES_UPLOAD: 'resources:upload',
  RESOURCES_DELETE: 'resources:delete',
  RESOURCES_OPEN: 'resources:open',
  RESOURCES_PREVIEW: 'resources:preview',

  // File operations
  FILE_OPEN: 'file:open',
  FILE_SAVE: 'file:save',
  FILE_SAVE_AS: 'file:saveAs',
  FOLDER_OPEN: 'folder:open',

  // Dialog operations
  DIALOG_OPEN_FILE: 'dialog:openFile',
  DIALOG_SAVE_FILE: 'dialog:saveFile',
  DIALOG_MESSAGE: 'dialog:message',

  // Data persistence
  DATA_SAVE: 'data:save',
  DATA_LOAD: 'data:load',
  DATA_EXPORT: 'data:export',
  DATA_IMPORT: 'data:import',

  // Slash commands
  SLASH_COMMANDS_LOAD: 'slash-commands:load',

  // Test mode channels
  TEST_MODE_SET_COMPONENT: 'test-mode:setComponent',
  TEST_MODE_SET_THEME: 'test-mode:setTheme',
  TEST_MODE_GET_STATE: 'test-mode:getState',

  // Terminal channels
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_WRITE: 'terminal:write',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_DESTROY: 'terminal:destroy',
} as const;

/**
 * Modern typed channel registry with enum-based definitions
 */
export enum IpcChannelNames {
  // Agent Operations
  AGENT_CREATE = 'agent:create',
  AGENT_UPDATE = 'agent:update',
  AGENT_DELETE = 'agent:delete',
  AGENT_LIST = 'agent:list',
  AGENT_SEARCH = 'agent:search',
  AGENT_CHAT_HISTORY = 'agent:chat-history',

  // Resource Management
  RESOURCE_UPLOAD = 'resource:upload',
  RESOURCE_DELETE = 'resource:delete',
  RESOURCE_PREVIEW = 'resource:preview',
  RESOURCE_LOAD_BY_IDS = 'resource:load-by-ids',

  // File Operations
  FILE_OPEN = 'file:open',
  FILE_SAVE = 'file:save',
  FILE_SAVE_AS = 'file:save-as',
  FILE_FOLDER_OPERATIONS = 'file:folder-operations',

  // System Integration
  SYSTEM_SETTINGS = 'system:settings',
  SYSTEM_THEME = 'system:theme',
  SYSTEM_WINDOW = 'system:window',
  SYSTEM_SHELL = 'system:shell',

  // Data Persistence
  DATA_SAVE = 'data:save',
  DATA_LOAD = 'data:load',
  DATA_IMPORT = 'data:import',
  DATA_EXPORT = 'data:export',

  // Development Tools
  DEV_SLASH_COMMANDS = 'dev:slash-commands',
  DEV_TEST_MODE = 'dev:test-mode',
  DEV_MONITORING = 'dev:monitoring',

  // File System Operations
  FILE_LIST_DIRECTORY = 'file:list-directory',
  FILE_SEARCH_WORKSPACE = 'file:search-workspace',

  // Badge Operations
  BADGE_SHOW = 'badge:show',
  BADGE_HIDE = 'badge:hide',
  BADGE_IS_SUPPORTED = 'badge:isSupported',

  // Terminal Operations (Terminal Tab Integration)
  TERMINAL_CREATE = 'terminal:create',
  TERMINAL_WRITE = 'terminal:write',
  TERMINAL_RESIZE = 'terminal:resize',
  TERMINAL_DESTROY = 'terminal:destroy',
}

// ============================================================================
// Badge IPC Types
// ============================================================================

export interface BadgeIpcChannels {
  'badge:show': () => Promise<{ success: boolean; error?: string }>;
  'badge:hide': () => Promise<{ success: boolean; error?: string }>;
  'badge:isSupported': () => Promise<{ success: boolean; data?: boolean; error?: string }>;
}

// ============================================================================
// Core IPC Infrastructure Types
// ============================================================================

export interface IpcHandlerOptions {
  validateInput?: boolean;
  timeout?: number;
  retryCount?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface IpcPerformanceMetrics {
  requestId: string;
  channel: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  errorType?: string;
}

export interface IpcErrorContext {
  requestId: string;
  channel: string;
  timestamp: number;
  error: Error;
  requestPayload?: unknown;
  stackTrace: string;
}

export interface IpcChannelMetadata {
  category: 'agent' | 'resource' | 'file' | 'system' | 'data' | 'dev';
  description: string;
  version: string;
  deprecated?: boolean;
  migrationPath?: string;
}

/**
 * Core channel definition interface
 */
export interface IpcChannel<TRequest = unknown, TResponse = unknown> {
  readonly name: string;
  readonly requestSchema?: unknown; // JSON schema for validation
  readonly responseSchema?: unknown; // JSON schema for validation
  readonly metadata: IpcChannelMetadata;
  // These phantom fields ensure the type parameters are used
  readonly __requestType?: TRequest;
  readonly __responseType?: TResponse;
}

/**
 * Type-safe handler function interface
 */
export type IpcHandler<TRequest = unknown, TResponse = unknown> = (
  request: TRequest
) => Promise<TResponse>;

// ============================================================================
// Legacy Handler Type Definitions
// ============================================================================

// Test mode state interface
export interface TestModeState {
  isActive: boolean;
  currentComponent: string | null;
  componentProps: any;
  themeVariant: 'day' | 'night';
}

// Slash command interface
export interface SlashCommand {
  trigger: string; // The command trigger (e.g., 'pr', 'commit')
  description: string; // First non-empty line from the markdown file
  content: string; // Full markdown content for Claude Code
}

// File system interfaces for directory listing
export interface DirectoryListingRequest {
  path: string;
  includeHidden?: boolean;
}

export interface FileSystemEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
}

export interface DirectoryListingResponse {
  entries: FileSystemEntry[];
  currentPath: string;
}

export interface WorkspaceSearchRequest {
  query: string;
  workspacePath: string;
  maxResults?: number;
  includeHidden?: boolean;
}

export interface WorkspaceSearchResponse {
  entries: FileSystemEntry[];
  query: string;
  totalFound: number;
}

/**
 * Legacy type definitions for IPC handlers
 * @deprecated Migrate to typed channel definitions
 */
export interface IpcHandlers {
  // Agents
  [IPC_CHANNELS.AGENTS_LOAD_ALL]: () => Promise<Agent[]>;
  [IPC_CHANNELS.AGENTS_LOAD_BY_PROJECT]: (projectId: string) => Promise<Agent[]>;
  [IPC_CHANNELS.AGENTS_CREATE]: (
    data: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<Agent>;
  [IPC_CHANNELS.AGENTS_UPDATE]: (id: string, updates: Partial<Agent>) => Promise<void>;
  [IPC_CHANNELS.AGENTS_DELETE]: (id: string) => Promise<void>;
  [IPC_CHANNELS.AGENTS_SEARCH]: (query: string) => Promise<Agent[]>;
  [IPC_CHANNELS.AGENTS_LOAD_CHAT_HISTORY]: (
    agentId: string
  ) => Promise<ComputedMessage[] | { messages: ComputedMessage[]; sessionId: string | null }>;
  [IPC_CHANNELS.AGENTS_UPDATE_SESSION]: (
    worktreeId: string,
    agentId: string,
    sessionId: string
  ) => Promise<{ success: boolean; error?: string }>;

  // Resources
  [IPC_CHANNELS.RESOURCES_LOAD_BY_IDS]: (ids: string[]) => Promise<Resource[]>;
  [IPC_CHANNELS.RESOURCES_UPLOAD]: (filePath: string, metadata?: any) => Promise<Resource>;
  [IPC_CHANNELS.RESOURCES_DELETE]: (id: string) => Promise<void>;
  [IPC_CHANNELS.RESOURCES_OPEN]: (path: string) => Promise<void>;
  [IPC_CHANNELS.RESOURCES_PREVIEW]: (id: string) => Promise<string>;

  // File operations
  [IPC_CHANNELS.FILE_OPEN]: (path: string) => Promise<string>;
  [IPC_CHANNELS.FILE_SAVE]: (path: string, content: string) => Promise<void>;
  [IPC_CHANNELS.FILE_SAVE_AS]: (content: string, defaultPath?: string) => Promise<string | null>;
  [IPC_CHANNELS.FOLDER_OPEN]: (path: string) => Promise<void>;

  // Dialog operations
  [IPC_CHANNELS.DIALOG_OPEN_FILE]: (options?: OpenDialogOptions) => Promise<string[] | null>;
  [IPC_CHANNELS.DIALOG_SAVE_FILE]: (options?: SaveDialogOptions) => Promise<string | null>;
  [IPC_CHANNELS.DIALOG_MESSAGE]: (options: MessageBoxOptions) => Promise<MessageBoxReturnValue>;

  // Data persistence
  [IPC_CHANNELS.DATA_SAVE]: (key: string, data: any) => Promise<void>;
  [IPC_CHANNELS.DATA_LOAD]: (key: string) => Promise<any>;
  [IPC_CHANNELS.DATA_EXPORT]: (path?: string) => Promise<void>;
  [IPC_CHANNELS.DATA_IMPORT]: (path?: string) => Promise<void>;

  // Slash commands
  [IPC_CHANNELS.SLASH_COMMANDS_LOAD]: () => Promise<SlashCommand[]>;

  // Test mode
  [IPC_CHANNELS.TEST_MODE_SET_COMPONENT]: (componentName: string, props?: any) => Promise<void>;
  [IPC_CHANNELS.TEST_MODE_SET_THEME]: (themeVariant: 'day' | 'night') => Promise<void>;
  [IPC_CHANNELS.TEST_MODE_GET_STATE]: () => Promise<TestModeState>;
}

// ============================================================================
// Migration Manager Types
// ============================================================================

export interface MigrationConfig {
  enableLegacyMode: boolean;
  enableModernMode: boolean;
  migrationPhase: 'preparation' | 'dual' | 'modern' | 'cleanup';
  testingRatio: number; // Percentage of requests routed to new system
}

export interface MigrationMetrics {
  requestId: string;
  channel: string;
  handlerType: 'legacy' | 'modern';
  duration: number;
  success: boolean;
  timestamp: number;
}

export interface ComparisonResult {
  requestId: string;
  channel: string;
  modernResponse: unknown;
  legacyResponse: unknown;
  responsesMatch: boolean;
  modernDuration: number;
  legacyDuration: number;
  timestamp: number;
}

// ============================================================================
// Type-Safe Channel Definitions
// ============================================================================

/**
 * Type-safe channel definitions with request/response interfaces
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace IpcChannels {
  // Agent Configuration interface
  export interface AgentConfiguration {
    llmProvider: string;
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt?: string;
  }

  // File Upload interface
  export interface FileUploadInfo {
    path: string;
    name: string;
    size: number;
    type: string;
  }

  // Resource interfaces
  export interface ResourceInfo {
    id: string;
    name: string;
    path: string;
    size: number;
    type: string;
    createdAt: string;
  }

  export interface ResourceMetadata {
    title?: string;
    description?: string;
    tags?: string[];
  }

  export interface UploadError {
    file: string;
    error: string;
  }

  // Agent Operations
  export interface AgentCreateRequest {
    name: string;
    description: string;
    configuration: AgentConfiguration;
  }

  export interface AgentCreateResponse {
    agentId: string;
    createdAt: string;
    status: 'created' | 'error';
  }

  export const AgentCreate: IpcChannel<AgentCreateRequest, AgentCreateResponse> = {
    name: IpcChannelNames.AGENT_CREATE,
    metadata: {
      category: 'agent',
      description: 'Create a new AI agent',
      version: '1.0.0',
    },
  };

  export interface AgentUpdateRequest {
    agentId: string;
    updates: Partial<Agent>;
  }

  export interface AgentUpdateResponse {
    success: boolean;
    updatedAt: string;
  }

  export const AgentUpdate: IpcChannel<AgentUpdateRequest, AgentUpdateResponse> = {
    name: IpcChannelNames.AGENT_UPDATE,
    metadata: {
      category: 'agent',
      description: 'Update existing agent properties',
      version: '1.0.0',
    },
  };

  export interface AgentDeleteRequest {
    agentId: string;
  }

  export interface AgentDeleteResponse {
    success: boolean;
    deletedAt: string;
  }

  export const AgentDelete: IpcChannel<AgentDeleteRequest, AgentDeleteResponse> = {
    name: IpcChannelNames.AGENT_DELETE,
    metadata: {
      category: 'agent',
      description: 'Delete an agent',
      version: '1.0.0',
    },
  };

  export interface AgentListRequest {
    projectId?: string;
    includeArchived?: boolean;
  }

  export interface AgentListResponse {
    agents: Agent[];
    totalCount: number;
  }

  export const AgentList: IpcChannel<AgentListRequest, AgentListResponse> = {
    name: IpcChannelNames.AGENT_LIST,
    metadata: {
      category: 'agent',
      description: 'List all agents or agents for specific project',
      version: '1.0.0',
    },
  };

  // File Operations
  export interface FileOpenRequest {
    filePath?: string;
    filters?: FileFilter[];
    properties?: OpenDialogOptions;
  }

  export interface FileOpenResponse {
    filePath: string;
    content: string;
    encoding: string;
    success: boolean;
  }

  export const FileOpen: IpcChannel<FileOpenRequest, FileOpenResponse> = {
    name: IpcChannelNames.FILE_OPEN,
    metadata: {
      category: 'file',
      description: 'Open and read file contents',
      version: '1.0.0',
    },
  };

  export interface FileSaveRequest {
    filePath: string;
    content: string;
    encoding?: string;
  }

  export interface FileSaveResponse {
    success: boolean;
    savedAt: string;
  }

  export const FileSave: IpcChannel<FileSaveRequest, FileSaveResponse> = {
    name: IpcChannelNames.FILE_SAVE,
    metadata: {
      category: 'file',
      description: 'Save content to file',
      version: '1.0.0',
    },
  };

  // Resource Management
  export interface ResourceUploadRequest {
    files: FileUploadInfo[];
    metadata?: ResourceMetadata;
    targetFolder?: string;
  }

  export interface ResourceUploadResponse {
    uploadedResources: ResourceInfo[];
    failedUploads?: UploadError[];
    totalSize: number;
  }

  export const ResourceUpload: IpcChannel<ResourceUploadRequest, ResourceUploadResponse> = {
    name: IpcChannelNames.RESOURCE_UPLOAD,
    metadata: {
      category: 'resource',
      description: 'Upload resources to the system',
      version: '1.0.0',
    },
  };

  export interface ResourceLoadByIdsRequest {
    resourceIds: string[];
  }

  export interface ResourceLoadByIdsResponse {
    resources: Resource[];
    notFound: string[];
  }

  export const ResourceLoadByIds: IpcChannel<ResourceLoadByIdsRequest, ResourceLoadByIdsResponse> =
    {
      name: IpcChannelNames.RESOURCE_LOAD_BY_IDS,
      metadata: {
        category: 'resource',
        description: 'Load resources by their IDs',
        version: '1.0.0',
      },
    };

  // System Operations
  export interface SystemSettingsRequest {
    key?: string; // If provided, get specific setting; otherwise get all
  }

  export interface SystemSettingsResponse {
    settings: Record<string, unknown>;
  }

  export const SystemSettings: IpcChannel<SystemSettingsRequest, SystemSettingsResponse> = {
    name: IpcChannelNames.SYSTEM_SETTINGS,
    metadata: {
      category: 'system',
      description: 'Get or set system settings',
      version: '1.0.0',
    },
  };

  export interface SystemThemeRequest {
    theme?: 'light' | 'dark' | 'system';
  }

  export interface SystemThemeResponse {
    currentTheme: 'light' | 'dark' | 'system';
    systemPreference: 'light' | 'dark';
  }

  export const SystemTheme: IpcChannel<SystemThemeRequest, SystemThemeResponse> = {
    name: IpcChannelNames.SYSTEM_THEME,
    metadata: {
      category: 'system',
      description: 'Get or set application theme',
      version: '1.0.0',
    },
  };

  // Data Operations
  export interface DataSaveRequest {
    key: string;
    data: unknown;
  }

  export interface DataSaveResponse {
    success: boolean;
    savedAt: string;
  }

  export const DataSave: IpcChannel<DataSaveRequest, DataSaveResponse> = {
    name: IpcChannelNames.DATA_SAVE,
    metadata: {
      category: 'data',
      description: 'Save data to persistent storage',
      version: '1.0.0',
    },
  };

  export interface DataLoadRequest {
    key: string;
  }

  export interface DataLoadResponse {
    data: unknown;
    found: boolean;
  }

  export const DataLoad: IpcChannel<DataLoadRequest, DataLoadResponse> = {
    name: IpcChannelNames.DATA_LOAD,
    metadata: {
      category: 'data',
      description: 'Load data from persistent storage',
      version: '1.0.0',
    },
  };

  // Development Tools
  export interface DevSlashCommandsRequest {
    // No parameters needed for loading
  }

  export interface DevSlashCommandsResponse {
    commands: SlashCommand[];
  }

  export const DevSlashCommands: IpcChannel<DevSlashCommandsRequest, DevSlashCommandsResponse> = {
    name: IpcChannelNames.DEV_SLASH_COMMANDS,
    metadata: {
      category: 'dev',
      description: 'Load available slash commands',
      version: '1.0.0',
    },
  };
}

// ============================================================================
// Channel Registry
// ============================================================================

/**
 * Channel registry for runtime access and validation
 */
export class IpcChannelRegistry {
  private static channels = new Map<string, IpcChannel>();

  static registerChannel<TRequest, TResponse>(channel: IpcChannel<TRequest, TResponse>): void {
    this.channels.set(channel.name, channel);
  }

  static getChannel(name: string): IpcChannel | undefined {
    return this.channels.get(name);
  }

  static getAllChannels(): IpcChannel[] {
    return Array.from(this.channels.values());
  }

  static getChannelsByCategory(category: IpcChannelMetadata['category']): IpcChannel[] {
    return Array.from(this.channels.values()).filter(
      (channel) => channel.metadata.category === category
    );
  }
}

// Initialize common channels
IpcChannelRegistry.registerChannel(IpcChannels.AgentCreate);
IpcChannelRegistry.registerChannel(IpcChannels.AgentUpdate);
IpcChannelRegistry.registerChannel(IpcChannels.AgentDelete);
IpcChannelRegistry.registerChannel(IpcChannels.AgentList);
IpcChannelRegistry.registerChannel(IpcChannels.FileOpen);
IpcChannelRegistry.registerChannel(IpcChannels.FileSave);
IpcChannelRegistry.registerChannel(IpcChannels.ResourceUpload);
IpcChannelRegistry.registerChannel(IpcChannels.ResourceLoadByIds);
IpcChannelRegistry.registerChannel(IpcChannels.SystemSettings);
IpcChannelRegistry.registerChannel(IpcChannels.SystemTheme);
IpcChannelRegistry.registerChannel(IpcChannels.DataSave);
IpcChannelRegistry.registerChannel(IpcChannels.DataLoad);
IpcChannelRegistry.registerChannel(IpcChannels.DevSlashCommands);

// ============================================================================
// Cache IPC Types 
// ============================================================================

/**
 * Cache operation response wrapper
 */
export interface CacheResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Cache metadata for session validation
 */
export interface CacheMetadata {
  sessionId: string;
  worktreeId: string;
  agentId: string;
  sdkVersion: string;
  lastJsonlMtime: number;
  createdAt: string;
  lastAccessedAt: string;
  messageCount: number;
}

/**
 * Loaded cache data with metadata
 */
export interface CacheData {
  messages: any[];
  metadata: CacheMetadata;
  loadTime: number;
}

/**
 * Cache IPC channel definitions
 */
export interface CacheIpcChannels {
  'cache:load': (
    sessionId: string,
    worktreeId: string,
    agentId: string
  ) => Promise<CacheResponse<CacheData>>;
  'cache:validate': (sessionId: string, jsonlMtime: number) => Promise<CacheResponse<boolean>>;
  'cache:rebuild': (
    sessionId: string,
    worktreeId: string,
    agentId: string,
    messages: any[]
  ) => Promise<CacheResponse<{ duration: number; messageCount: number }>>;
  'cache:invalidate': (sessionId: string) => Promise<CacheResponse>;
  'cache:clearAll': () => Promise<CacheResponse>;
  'cache:clearWorktree': (worktreeId: string) => Promise<CacheResponse>;
  'cache:cleanupOrphaned': (activeSessions: string[]) => Promise<CacheResponse>;
  'cache:getMetadata': (sessionId: string) => Promise<CacheResponse<CacheMetadata>>;
  'cache:getSize': (sessionId: string) => Promise<CacheResponse<number>>;
  'cache:monitorSize': (sessionId: string) => Promise<CacheResponse>;
}
