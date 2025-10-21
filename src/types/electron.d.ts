import { Agent, Resource, ChatMessage } from '@/entities';
import { SessionBlock } from '@/entities/SessionBlock';
import { MonitoringConfig } from '@/monitoring/interfaces/types';
import { SlashCommand } from '@/types/ipc.types';

export interface ElectronAPI {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  on: (channel: string, callback: (...args: any[]) => void) => void;
  off: (channel: string, callback: (...args: any[]) => void) => void;

  app: {
    getVersion: () => Promise<string>;
    getPlatform: () => Promise<string>;
  };
  log: {
    info: (message: string, ...args: any[]) => Promise<void>;
    warn: (message: string, ...args: any[]) => Promise<void>;
    error: (message: string, ...args: any[]) => Promise<void>;
    debug: (message: string, ...args: any[]) => Promise<void>;
  };
  settings: {
    get: <T = any>(key: string) => Promise<T | undefined>;
    set: <T = any>(key: string, value: T) => Promise<void>;
    getAll: () => Promise<Record<string, any>>;
  };
  theme: {
    get: () => Promise<'light' | 'dark' | 'system'>;
    set: (theme: 'light' | 'dark' | 'system') => Promise<void>;
    onChange: (callback: (theme: 'light' | 'dark') => void) => () => void;
  };
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
  };
  ipc: {
    send: (channel: string, ...args: any[]) => void;
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    on: (channel: string, listener: (...args: any[]) => void) => () => void;
    once: (channel: string, listener: (...args: any[]) => void) => void;
  };
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    send: (channel: string, ...args: any[]) => void;
    on: (channel: string, listener: (...args: any[]) => void) => () => void;
    once: (channel: string, listener: (...args: any[]) => void) => void;
    removeListener: (channel: string, listener: (...args: any[]) => void) => void;
    removeAllListeners: (channel: string) => void;
  };
  monitoring: {
    initialize: (
      config?: Partial<MonitoringConfig>
    ) => Promise<{ success: boolean; error?: string }>;
    getActiveSession: () => Promise<{
      success: boolean;
      data?: SessionBlock | null;
      error?: string;
    }>;
    getAllSessions: () => Promise<{ success: boolean; data?: SessionBlock[]; error?: string }>;
    startPolling: (intervalMs?: number) => Promise<{ success: boolean; error?: string }>;
    stopPolling: () => Promise<{ success: boolean; error?: string }>;
    onSessionUpdate: (
      callback: (data: { type: string; session: SessionBlock }) => void
    ) => () => void;
  };
  store: {
    get: <T = any>(key: string) => Promise<T | undefined>;
    set: <T = any>(key: string, value: T) => Promise<void>;
    has: (key: string) => Promise<boolean>;
    delete: (key: string) => Promise<void>;
    clear: () => Promise<void>;
  };
  worktree: {
    getDataDirectory: () => Promise<string>;
    getCurrentDirectory: () => Promise<string>;
    create: (options: { githubRepo: string; branchName: string }) => Promise<{
      success: boolean;
      message: string;
      error?: string;
      folderName?: string;
      localPath?: string;
    }>;
    delete: (folderName: string) => Promise<{
      success: boolean;
      message: string;
      error?: string;
    }>;
    getAll: () => Promise<
      Array<{
        git_repo: string;
        branch_name: string;
        folder_name: string;
      }>
    >;
    getRepoUrls: () => Promise<string[]>;
    getVimMode: () => Promise<boolean>;
    setVimMode: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
  };
  slashCommands: {
    load: (projectPath?: string) => Promise<SlashCommand[]>;
  };
  update: {
    check: () => Promise<void>;
    download: () => Promise<void>;
    install: () => void;
    dismiss: (version: string) => Promise<void>;
    getReleaseNotes: (version: string) => Promise<string>;
    onUpdateAvailable: (callback: (info: any) => void) => void;
    onDownloadProgress: (callback: (progress: any) => void) => void;
    onUpdateDownloaded: (callback: () => void) => void;
    onUpdateError: (callback: (error: string) => void) => void;
  };
  shell: {
    openExternal: (url: string) => Promise<{ success: boolean }>;
  };
  badge: {
    show: () => Promise<{ success: boolean; error?: string }>;
    hide: () => Promise<{ success: boolean; error?: string }>;
    isSupported: () => Promise<{ success: boolean; data?: boolean; error?: string }>;
  };
  terminal: {
    create: (params?: {
      shell?: string;
      cwd?: string;
    }) => Promise<{ id: string; shell: string; cwd: string }>;
    write: (terminalId: string, data: string) => Promise<void>;
    resize: (terminalId: string, cols: number, rows: number) => Promise<void>;
    kill: (terminalId: string) => Promise<void>;
    list: () => Promise<Array<{ id: string; shell: string; cwd: string; isActive: boolean }>>;
    onData: (terminalId: string, callback: (data: string) => void) => () => void;
    onExit: (
      terminalId: string,
      callback: (info: { code: number | null; signal: string | null }) => void
    ) => () => void;
    onError: (terminalId: string, callback: (error: string) => void) => () => void;
  };
}

// Export to ensure this file is treated as a module
export {};

declare global {
  interface Window {
    electron: ElectronAPI & {
      // Extended API from IpcService
      agents: {
        loadAll: () => Promise<Agent[]>;
        loadByProject: (projectId: string) => Promise<Agent[]>;
        create: (data: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Agent>;
        update: (id: string, updates: Partial<Agent>) => Promise<void>;
        delete: (id: string) => Promise<void>;
        search: (query: string) => Promise<Agent[]>;
        loadChatHistory: (
          agentId: string
        ) => Promise<ChatMessage[] | { messages: ChatMessage[]; sessionId: string | null }>;
        updateAdditionalDirectories: (
          worktreeId: string,
          agentId: string,
          directories: string[]
        ) => Promise<{ success: boolean; error?: string }>;
        getAdditionalDirectories: (
          worktreeId: string,
          agentId: string
        ) => Promise<{ success: boolean; directories: string[]; error?: string }>;
      };
      // Session management
      updateAgentSession: (
        worktreeId: string,
        agentId: string,
        sessionId: string
      ) => Promise<{ success: boolean; error?: string }>;
      resources: {
        uploadResources: (filePath: string, metadata?: any) => Promise<Resource>;
        deleteResource: (id: string) => Promise<void>;
        openResource: (resourcePath: string) => Promise<void>;
        getResources: (ids: string[]) => Promise<Resource[]>;
        previewResource: (id: string) => Promise<string>;
      };
      file: {
        open: (path: string) => Promise<string>;
        save: (path: string, content: string) => Promise<void>;
        saveAs: (content: string, defaultPath?: string) => Promise<string | null>;
        openFolder: (path: string) => Promise<void>;
        listDirectory: (
          request: import('@/types/ipc.types').DirectoryListingRequest
        ) => Promise<import('@/types/ipc.types').DirectoryListingResponse>;
        // Get file path from File object (Electron 29+)
        getPathForFile: (file: File) => string;
      };
      dialog: {
        openFile: (options?: Electron.OpenDialogOptions) => Promise<string[] | null>;
        saveFile: (options?: Electron.SaveDialogOptions) => Promise<string | null>;
        message: (options: Electron.MessageBoxOptions) => Promise<Electron.MessageBoxReturnValue>;
      };
      data?: {
        save: (key: string, data: any) => Promise<void>;
        load: (key: string) => Promise<any>;
        export: (path?: string) => Promise<void>;
        import: (path?: string) => Promise<void>;
      };
    };
  }
}
