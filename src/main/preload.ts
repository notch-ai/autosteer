import { contextBridge, ipcRenderer, webUtils } from 'electron';

// Type definitions for IPC listeners
type IpcListener = (event: Electron.IpcRendererEvent, ...args: unknown[]) => void;

// Define the API that will be exposed to the renderer process
const electronAPI = {
  // App methods
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
  },

  // Logging methods
  log: {
    info: (message: string, ...args: any[]) => ipcRenderer.invoke('log:info', message, ...args),
    warn: (message: string, ...args: any[]) => ipcRenderer.invoke('log:warn', message, ...args),
    error: (message: string, ...args: any[]) => ipcRenderer.invoke('log:error', message, ...args),
    debug: (message: string, ...args: any[]) => ipcRenderer.invoke('log:debug', message, ...args),
  },

  // Settings methods
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
  },

  // Theme methods
  theme: {
    get: () => ipcRenderer.invoke('theme:get'),
    set: (theme: 'light' | 'dark' | 'system') => ipcRenderer.invoke('theme:set', theme),
    getSystemPreference: () => ipcRenderer.invoke('theme:getSystemPreference'),
    onChange: (callback: (theme: 'light' | 'dark') => void) => {
      const listener: IpcListener = (_event, theme) => callback(theme as 'light' | 'dark');
      ipcRenderer.on('theme:changed', listener);
      return () => ipcRenderer.removeListener('theme:changed', listener);
    },
  },

  // Window methods
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },

  // Simplified IPC methods using domain:action pattern
  ipc: {
    invoke: async (channel: string, ...args: unknown[]) => {
      // Validate domain:action pattern
      if (!channel.includes(':')) {
        throw new Error(`Invalid channel format: ${channel}. Use 'domain:action' pattern.`);
      }
      try {
        return await ipcRenderer.invoke(channel, ...args);
      } catch (error) {
        // Send error to renderer's global handler via special channel
        ipcRenderer.send('ipc-error', {
          channel,
          error: {
            name: (error as Error).name || 'Error',
            message: (error as Error).message || String(error),
            stack: (error as Error).stack,
          },
          args: args.map((arg) => {
            // Sanitize sensitive data
            if (typeof arg === 'object' && arg !== null) {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { password, token, apiKey, ...safe } = arg as any;
              return safe;
            }
            return arg;
          }),
        });
        throw error;
      }
    },
    on: (channel: string, listener: IpcListener) => {
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
    once: (channel: string, listener: IpcListener) => {
      ipcRenderer.once(channel, listener);
    },
  },

  // Resource methods
  resources: {
    uploadResources: (filePath: string, metadata?: unknown) =>
      ipcRenderer.invoke('resources:upload', filePath, metadata),
    deleteResource: (id: string) => ipcRenderer.invoke('resources:delete', id),
    openResource: (resourcePath: string) => ipcRenderer.invoke('resources:open', resourcePath),
    getResources: (ids: string[]) => ipcRenderer.invoke('resources:loadByIds', ids),
    previewResource: (id: string) => ipcRenderer.invoke('resources:preview', id),
  },

  // File methods
  file: {
    open: (path: string) => ipcRenderer.invoke('file:open', path),
    save: (path: string, content: string) => ipcRenderer.invoke('file:save', path, content),
    saveAs: (content: string, defaultPath?: string) =>
      ipcRenderer.invoke('file:saveAs', content, defaultPath),
    openFolder: (path: string) => ipcRenderer.invoke('folder:open', path),
    listDirectory: (request: any) => ipcRenderer.invoke('file:list-directory', request),
    searchWorkspace: (request: any) => ipcRenderer.invoke('file:search-workspace', request),
    // Get file path from File object (for drag and drop in Electron 29+)
    getPathForFile: (file: File) => webUtils.getPathForFile(file),
  },

  // Dialog methods
  dialog: {
    openFile: (options?: any) => ipcRenderer.invoke('dialog:openFile', options),
    saveFile: (options?: any) => ipcRenderer.invoke('dialog:saveFile', options),
    message: (options: any) => ipcRenderer.invoke('dialog:message', options),
  },

  // Terminal methods for xterm.js
  terminal: {
    create: (params?: { shell?: string; cwd?: string }) =>
      ipcRenderer.invoke('terminal:create', params),
    write: (terminalId: string, data: string) =>
      ipcRenderer.invoke('terminal:write', terminalId, data),
    resize: (terminalId: string, cols: number, rows: number) =>
      ipcRenderer.invoke('terminal:resize', terminalId, cols, rows),
    kill: (terminalId: string) => ipcRenderer.invoke('terminal:kill', terminalId),
    list: () => ipcRenderer.invoke('terminal:list'),
    onData: (terminalId: string, callback: (data: string) => void) => {
      const channel = `terminal:data:${terminalId}`;
      const listener: IpcListener = (_event, data) => callback(data as string);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
    onExit: (
      terminalId: string,
      callback: (info: { code: number | null; signal: string | null }) => void
    ) => {
      const channel = `terminal:exit:${terminalId}`;
      const listener: IpcListener = (_event, info) => callback(info as any);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
    onError: (terminalId: string, callback: (error: string) => void) => {
      const channel = `terminal:error:${terminalId}`;
      const listener: IpcListener = (_event, error) => callback(error as string);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
  },

  // Expose ipcRenderer for IpcService
  ipcRenderer: {
    invoke: async (channel: string, ...args: unknown[]) => {
      try {
        return await ipcRenderer.invoke(channel, ...args);
      } catch (error) {
        // Send error to renderer's global handler
        ipcRenderer.send('ipc-error', {
          channel,
          error: {
            name: (error as Error).name || 'Error',
            message: (error as Error).message || String(error),
            stack: (error as Error).stack,
          },
          args: args.length > 0 ? ['[sanitized]'] : [],
        });
        throw error;
      }
    },
    send: (channel: string, ...args: unknown[]) => ipcRenderer.send(channel, ...args),
    on: (channel: string, listener: IpcListener) => {
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
    once: (channel: string, listener: IpcListener) => {
      ipcRenderer.once(channel, listener);
    },
    removeListener: (channel: string, listener: IpcListener) => {
      ipcRenderer.removeListener(channel, listener);
    },
    removeAllListeners: (channel: string) => {
      ipcRenderer.removeAllListeners(channel);
    },
  },

  // Store methods - includes data operations (merged DataHandlers)
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key),
    has: (key: string) => ipcRenderer.invoke('store:has', key),
    clear: () => ipcRenderer.invoke('store:clear'),
    // Data operations merged from DataHandlers
    export: () => ipcRenderer.invoke('store:export'),
    import: (filePath?: string) => ipcRenderer.invoke('store:import', filePath),
  },

  // Agent methods
  agents: {
    loadAll: () => ipcRenderer.invoke('agents:loadAll'),
    loadByProject: (projectId: string) => ipcRenderer.invoke('agents:loadByProject', projectId),
    create: (data: any) => ipcRenderer.invoke('agents:create', data),
    update: (id: string, updates: any) => ipcRenderer.invoke('agents:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('agents:delete', id),
    search: (query: string) => ipcRenderer.invoke('agents:search', query),
    loadChatHistory: (agentId: string) => ipcRenderer.invoke('agents:loadChatHistory', agentId),
    updateAdditionalDirectories: (worktreeId: string, agentId: string, directories: string[]) =>
      ipcRenderer.invoke('agents:updateAdditionalDirectories', worktreeId, agentId, directories),
    getAdditionalDirectories: (worktreeId: string, agentId: string) =>
      ipcRenderer.invoke('agents:getAdditionalDirectories', worktreeId, agentId),
  },

  // Session management
  updateAgentSession: (worktreeId: string, agentId: string, sessionId: string) =>
    ipcRenderer.invoke('agents:updateSession', worktreeId, agentId, sessionId),

  // Worktree methods
  worktree: {
    getDataDirectory: () => ipcRenderer.invoke('worktree:getDataDirectory'),
    getCurrentDirectory: (projectPath?: string) =>
      ipcRenderer.invoke('worktree:getCurrentDirectory', projectPath),
    create: (options: { githubRepo: string; branchName: string }) =>
      ipcRenderer.invoke('worktree:create', options),
    delete: (folderName: string) => ipcRenderer.invoke('worktree:delete', folderName),
    getAll: () => ipcRenderer.invoke('worktree:getAll'),
    getRepoUrls: () => ipcRenderer.invoke('worktree:getRepoUrls'),
    getVimMode: () => ipcRenderer.invoke('worktree:getVimMode'),
    setVimMode: (enabled: boolean) => ipcRenderer.invoke('worktree:setVimMode', enabled),
    setActiveTab: (projectId: string, tabId: string) =>
      ipcRenderer.invoke('worktree:setActiveTab', projectId, tabId),
    getActiveTab: (projectId: string) => ipcRenderer.invoke('worktree:getActiveTab', projectId),
  },

  // Slash commands
  slashCommands: {
    load: (projectPath?: string) => ipcRenderer.invoke('slash-commands:load', projectPath),
  },

  // Update methods
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    dismiss: (version: string) => ipcRenderer.invoke('update:dismiss', version),
    getReleaseNotes: (version: string) => ipcRenderer.invoke('update:getReleaseNotes', version),
    onUpdateAvailable: (callback: (info: any) => void) => {
      const listener: IpcListener = (_event, info) => callback(info);
      ipcRenderer.on('update:available', listener);
    },
    onDownloadProgress: (callback: (progress: any) => void) => {
      const listener: IpcListener = (_event, progress) => callback(progress);
      ipcRenderer.on('update:download-progress', listener);
    },
    onUpdateDownloaded: (callback: () => void) => {
      const listener: IpcListener = () => callback();
      ipcRenderer.on('update:downloaded', listener);
    },
    onUpdateError: (callback: (error: string) => void) => {
      const listener: IpcListener = (_event, error) => callback(error as string);
      ipcRenderer.on('update:error', listener);
    },
  },

  // Shell methods
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },

  // Badge methods
  badge: {
    show: () => ipcRenderer.invoke('badge:show'),
    hide: () => ipcRenderer.invoke('badge:hide'),
    isSupported: () => ipcRenderer.invoke('badge:isSupported'),
  },

  // Environment variables (safe subset)
  env: {
    NODE_ENV: process.env.NODE_ENV || 'development',
    VISUAL_TEST_MODE: process.env.VISUAL_TEST_MODE || 'false',
    THEME_OVERRIDE: process.env.THEME_OVERRIDE || '',
    DEBUG_SUPPRESSED_ERRORS: process.env.DEBUG_SUPPRESSED_ERRORS || 'false',
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electron', electronAPI);

// Type definitions for TypeScript
export type ElectronAPI = typeof electronAPI;
