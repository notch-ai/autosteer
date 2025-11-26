declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Fix Theme type
type Theme = 'light' | 'dark' | 'system';

// IPC Listener type
type IpcListener = (event: Electron.IpcRendererEvent, ...args: unknown[]) => void;

// Common response types
interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Electron API types based on actual preload.ts
interface Window {
  electron: {
    // App methods
    app: {
      getVersion: () => Promise<string>;
      getPlatform: () => Promise<string>;
    };

    // Logging methods
    log: {
      info: (message: string, ...args: any[]) => Promise<void>;
      warn: (message: string, ...args: any[]) => Promise<void>;
      error: (message: string, ...args: any[]) => Promise<void>;
      debug: (message: string, ...args: any[]) => Promise<void>;
    };

    // Settings methods
    settings: {
      get: (key: string) => Promise<any>;
      set: (key: string, value: unknown) => Promise<IpcResponse>;
      getAll: () => Promise<any>;
    };

    // Theme methods
    theme: {
      get: () => Promise<string>;
      set: (theme: 'light' | 'dark' | 'system') => Promise<void>;
      getSystemPreference: () => Promise<string>;
      onChange: (callback: (theme: 'light' | 'dark') => void) => () => void;
    };

    // Window methods
    window: {
      minimize: () => Promise<void>;
      maximize: () => Promise<void>;
      close: () => Promise<void>;
    };

    // IPC methods
    ipc: {
      send: (channel: string, ...args: unknown[]) => void;
      invoke: (channel: string, ...args: unknown[]) => Promise<any>;
      on: (channel: string, listener: IpcListener) => () => void;
      once: (channel: string, listener: IpcListener) => void;
    };

    // Resources methods
    resources: {
      uploadResources: (filePath: string, metadata?: unknown) => Promise<any>;
      deleteResource: (id: string) => Promise<IpcResponse>;
      openResource: (resourcePath: string) => Promise<IpcResponse>;
      getResources: (ids: string[]) => Promise<any>;
      previewResource: (id: string) => Promise<any>;
    };

    // File methods
    file: {
      open: (path: string) => Promise<string>;
      save: (path: string, content: string) => Promise<void>;
      saveAs: (content: string, defaultPath?: string) => Promise<string | null>;
      openFolder: (path: string) => Promise<void>;
      listDirectory: (request: any) => Promise<any>;
    };

    // Dialog methods
    dialog: {
      openFile: (options?: any) => Promise<any>;
      saveFile: (options?: any) => Promise<any>;
      message: (options: any) => Promise<any>;
    };

    // IpcRenderer direct access
    ipcRenderer: {
      invoke: (channel: string, ...args: unknown[]) => Promise<any>;
      send: (channel: string, ...args: unknown[]) => void;
      on: (channel: string, listener: IpcListener) => () => void;
      once: (channel: string, listener: IpcListener) => void;
      removeListener: (channel: string, listener: IpcListener) => void;
      removeAllListeners: (channel: string) => void;
    };

    // Monitoring methods
    monitoring: {
      initialize: (config?: any) => Promise<IpcResponse>;
      getActiveSession: () => Promise<IpcResponse>;
      getAllSessions: () => Promise<IpcResponse<any[]>>;
      startPolling: (intervalMs?: number) => Promise<IpcResponse>;
      stopPolling: () => Promise<IpcResponse>;
      onSessionUpdate: (callback: (data: any) => void) => () => void;
    };

    // Store methods
    store: {
      get: (key: string) => Promise<any>;
      set: (key: string, value: unknown) => Promise<void>;
      delete: (key: string) => Promise<void>;
      has: (key: string) => Promise<boolean>;
      clear: () => Promise<void>;
    };

    // Agent methods
    agents: {
      loadAll: () => Promise<any[]>;
      loadByProject: (projectId: string) => Promise<any[]>;
      create: (data: any) => Promise<any>;
      update: (id: string, updates: any) => Promise<any>;
      delete: (id: string) => Promise<void>;
      search: (query: string) => Promise<any[]>;
      loadChatHistory: (agentId: string) => Promise<any>;
    };

    // Worktree methods
    worktree: {
      getDataDirectory: () => Promise<string>;
      getCurrentDirectory: (projectPath?: string) => Promise<string>;
      create: (options: { githubRepo: string; branchName: string }) => Promise<any>;
      delete: (folderName: string) => Promise<IpcResponse>;
      getAll: () => Promise<any[]>;
      getRepoUrls: () => Promise<string[]>;
      getVimMode: () => Promise<boolean>;
      setVimMode: (enabled: boolean) => Promise<IpcResponse>;
      setActiveTab: (projectId: string, tabId: string) => Promise<IpcResponse>;
      getActiveTab: (projectId: string) => Promise<string | null>;
    };

    // Slash commands
    slashCommands: {
      load: (projectPath?: string) => Promise<any>;
    };

    // Update methods
    update: {
      check: () => Promise<any>;
      download: () => Promise<void>;
      install: () => Promise<void>;
      dismiss: (version: string) => Promise<void>;
      getReleaseNotes: (version: string) => Promise<string>;
      onUpdateAvailable: (callback: (info: any) => void) => void;
      onDownloadProgress: (callback: (progress: any) => void) => void;
      onUpdateDownloaded: (callback: () => void) => void;
      onUpdateError: (callback: (error: string) => void) => void;
    };

    // Shell methods
    shell: {
      openExternal: (url: string) => Promise<void>;
    };

    // Terminal methods for xterm.js
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

    // IDE methods
    ide: {
      detect: () => Promise<{
        editors: string[];
        preferred?: string;
      }>;
      setPreferred: (editor: string) => Promise<{ success: boolean }>;
      openFile: (request: {
        file: string;
        line?: number;
        column?: number;
        editor?: string;
      }) => Promise<{ success: boolean; error?: string }>;
    };

    // Environment variables
    env: {
      NODE_ENV: string;
      VISUAL_TEST_MODE: string;
      THEME_OVERRIDE: string;
      DEBUG_SUPPRESSED_ERRORS: string;
    };
  };
}
