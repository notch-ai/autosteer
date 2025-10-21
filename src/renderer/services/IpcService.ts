import { IPC_CHANNELS, IpcHandlers } from '@/types/ipc.types';
import { Agent } from '@/entities';
import type { OpenDialogOptions, SaveDialogOptions, MessageBoxOptions } from 'electron';

class IpcService {
  // Generic invoke method with type safety
  private async invoke<K extends keyof IpcHandlers>(
    channel: K,
    ...args: Parameters<IpcHandlers[K]>
  ): Promise<Awaited<ReturnType<IpcHandlers[K]>>> {
    return window.electron.ipcRenderer.invoke(channel, ...args);
  }

  // Agent methods
  agents = {
    loadAll: () => this.invoke(IPC_CHANNELS.AGENTS_LOAD_ALL),
    create: (data: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) =>
      this.invoke(IPC_CHANNELS.AGENTS_CREATE, data),
    update: (id: string, updates: Partial<Agent>) =>
      this.invoke(IPC_CHANNELS.AGENTS_UPDATE, id, updates),
    delete: (id: string) => this.invoke(IPC_CHANNELS.AGENTS_DELETE, id),
    search: (query: string) => this.invoke(IPC_CHANNELS.AGENTS_SEARCH, query),
    loadChatHistory: (agentId: string) =>
      this.invoke(IPC_CHANNELS.AGENTS_LOAD_CHAT_HISTORY, agentId),
    updateAdditionalDirectories: (worktreeId: string, agentId: string, directories: string[]) =>
      window.electron.ipcRenderer.invoke(
        'agents:updateAdditionalDirectories',
        worktreeId,
        agentId,
        directories
      ),
    getAdditionalDirectories: (worktreeId: string, agentId: string) =>
      window.electron.ipcRenderer.invoke('agents:getAdditionalDirectories', worktreeId, agentId),
  };

  // Resource methods
  resources = {
    loadByIds: (ids: string[]) => window.electron.resources.getResources(ids),
    upload: async (file: File) => {
      // Convert File to path for IPC
      const filePath = (file as any).path || file.name;
      const metadata = {
        mimeType: file.type,
        size: file.size,
        lastModified: file.lastModified,
      };
      return window.electron.resources.uploadResources(filePath, metadata);
    },
    delete: (id: string) => window.electron.resources.deleteResource(id),
    open: (path: string) => window.electron.resources.openResource(path),
    preview: (id: string) => window.electron.resources.previewResource(id),
  };

  // File operations
  file = {
    open: (path: string) => this.invoke(IPC_CHANNELS.FILE_OPEN, path),
    save: (path: string, content: string) => this.invoke(IPC_CHANNELS.FILE_SAVE, path, content),
    saveAs: (content: string, defaultPath?: string) =>
      this.invoke(IPC_CHANNELS.FILE_SAVE_AS, content, defaultPath),
    openFolder: (path: string) => this.invoke(IPC_CHANNELS.FOLDER_OPEN, path),
  };

  // Dialog operations
  dialog = {
    openFile: (options?: OpenDialogOptions) => this.invoke(IPC_CHANNELS.DIALOG_OPEN_FILE, options),
    saveFile: (options?: SaveDialogOptions) => this.invoke(IPC_CHANNELS.DIALOG_SAVE_FILE, options),
    message: (options: MessageBoxOptions) => this.invoke(IPC_CHANNELS.DIALOG_MESSAGE, options),
  };

  // Data persistence
  data = {
    save: (key: string, data: any) => this.invoke(IPC_CHANNELS.DATA_SAVE, key, data),
    load: (key: string) => this.invoke(IPC_CHANNELS.DATA_LOAD, key),
    export: (path?: string) => this.invoke(IPC_CHANNELS.DATA_EXPORT, path),
    import: (path?: string) => this.invoke(IPC_CHANNELS.DATA_IMPORT, path),
  };

  // App info
  app = {
    getVersion: () => window.electron.ipcRenderer.invoke('app:getVersion'),
    getPlatform: () => window.electron.ipcRenderer.invoke('app:getPlatform'),
  };

  // Settings
  settings = {
    get: (key: string) => window.electron.ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: any) =>
      window.electron.ipcRenderer.invoke('settings:set', key, value),
    getAll: () => window.electron.ipcRenderer.invoke('settings:getAll'),
  };

  // Theme
  theme = {
    get: () => window.electron.ipcRenderer.invoke('theme:get'),
    set: (theme: 'light' | 'dark' | 'system') =>
      window.electron.ipcRenderer.invoke('theme:set', theme),
  };

  // Window controls
  window = {
    minimize: () => window.electron.ipcRenderer.invoke('window:minimize'),
    maximize: () => window.electron.ipcRenderer.invoke('window:maximize'),
    close: () => window.electron.ipcRenderer.invoke('window:close'),
  };
}

// Export singleton instance
export const ipcService = new IpcService();
