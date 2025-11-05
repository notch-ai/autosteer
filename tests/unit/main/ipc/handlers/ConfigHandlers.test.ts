// Mock electron-log/main before any imports
jest.mock('electron-log/main', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock the main logger
jest.mock('@/main/services/logger', () => ({
  mainLogger: {
    setDevelopmentMode: jest.fn(),
  },
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { ConfigHandlers } from '@/main/ipc/handlers/ConfigHandlers';
import { FileDataStoreService } from '@/services/FileDataStoreService';
import { ErrorHandler } from '@/main/utils/errorHandler';
import { IpcMainInvokeEvent, ipcMain } from 'electron';
import { AutosteerConfig, CustomCommand } from '@/types/config.types';

// Mock electron
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
  },
  BrowserWindow: {
    fromWebContents: jest.fn(() => ({
      webContents: {
        isDestroyed: jest.fn(() => false),
        send: jest.fn()
      }
    })),
  },
}));

// Mock FileDataStoreService
jest.mock('@/services/FileDataStoreService');

// Mock ErrorHandler
jest.mock('@/main/utils/errorHandler');

describe('ConfigHandlers', () => {
  let configHandlers: ConfigHandlers;
  let mockFileDataStore: jest.Mocked<FileDataStoreService>;
  let handlers: Map<string, (...args: any[]) => any>;
  let mockEvent: IpcMainInvokeEvent;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Set up handler storage
    handlers = new Map();
    (ipcMain.handle as jest.Mock).mockImplementation((channel: string, handler: (...args: any[]) => any) => {
      handlers.set(channel, handler);
    });

    // Create mock FileDataStoreService
    mockFileDataStore = {
      readConfig: jest.fn(),
      writeConfig: jest.fn(),
      readAppConfig: jest.fn(),
      writeAppConfig: jest.fn(),
      getDataDirectory: jest.fn().mockReturnValue('/mock/home/.autosteer'),
      setDataDirectory: jest.fn(),
    } as any;

    // Mock FileDataStoreService.getInstance
    (FileDataStoreService.getInstance as jest.Mock).mockReturnValue(mockFileDataStore);

    // Mock ErrorHandler.log
    (ErrorHandler.log as jest.Mock).mockReturnValue('error message');

    // Create mock event
    mockEvent = {
      sender: {
        id: 1,
        isDestroyed: () => false,
      },
    } as unknown as IpcMainInvokeEvent;

    // Create ConfigHandlers instance
    configHandlers = new ConfigHandlers();
    configHandlers.register();
  });

  describe('register', () => {
    it('should register all config handlers', () => {
      expect(ipcMain.handle).toHaveBeenCalledTimes(15);
      expect(handlers.has('config:read')).toBe(true);
      expect(handlers.has('config:updateSettings')).toBe(true);
      expect(handlers.has('config:setApiKey')).toBe(true);
      expect(handlers.has('config:removeApiKey')).toBe(true);
      expect(handlers.has('config:clearApiKeys')).toBe(true);
      expect(handlers.has('config:addCustomCommand')).toBe(true);
      expect(handlers.has('config:updateCustomCommand')).toBe(true);
      expect(handlers.has('config:removeCustomCommand')).toBe(true);
      expect(handlers.has('config:clearCustomCommands')).toBe(true);
      expect(handlers.has('config:getSection')).toBe(true);
      expect(handlers.has('config:getDevMode')).toBe(true);
      expect(handlers.has('config:setDevMode')).toBe(true);
      expect(handlers.has('config:setSection')).toBe(true);
      expect(handlers.has('config:getProjectDirectory')).toBe(true);
      expect(handlers.has('config:setProjectDirectory')).toBe(true);
    });
  });

  describe('config:read', () => {
    it('should return config from fileDataStore', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: true },
      };
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);

      const handler = handlers.get('config:read')!;
      const result = await handler();

      expect(result).toEqual(mockConfig);
      expect(mockFileDataStore.readConfig).toHaveBeenCalled();
    });

    it('should return error object on failure', async () => {
      const error = new Error('Read failed');
      mockFileDataStore.readConfig.mockRejectedValue(error);

      const handler = handlers.get('config:read')!;
      const result = await handler(mockEvent);

      expect(result).toEqual({
        success: false,
        error: 'error message',
        message: undefined,
      });
      expect(ErrorHandler.log).toHaveBeenCalledWith({
        operation: 'read config',
        error,
        context: { channel: 'config:read', args: [] },
      });
    });
  });

  describe('config:updateSettings', () => {
    it('should update settings in config', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
      };
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);
      mockFileDataStore.writeConfig.mockResolvedValue(undefined);

      const handler = handlers.get('config:updateSettings')!;
      const event = {} as IpcMainInvokeEvent;
      const updates = { vimMode: true, theme: 'dark' };

      await handler(event, updates);

      expect(mockFileDataStore.writeConfig).toHaveBeenCalledWith({
        worktrees: [],
        settings: { vimMode: true, theme: 'dark' },
      });
    });

    it('should initialize settings if they do not exist', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
      } as any;
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);
      mockFileDataStore.writeConfig.mockResolvedValue(undefined);

      const handler = handlers.get('config:updateSettings')!;
      const event = {} as IpcMainInvokeEvent;
      const updates = { vimMode: true };

      await handler(event, updates);

      expect(mockFileDataStore.writeConfig).toHaveBeenCalledWith({
        worktrees: [],
        settings: { vimMode: true },
      });
    });

    it('should return error object on failure', async () => {
      const error = new Error('Write failed');
      mockFileDataStore.readConfig.mockRejectedValue(error);

      const handler = handlers.get('config:updateSettings')!;
      const updates = { vimMode: true };

      const result = await handler(mockEvent, updates);

      expect(result).toEqual({
        success: false,
        error: 'error message',
        message: undefined,
      });
      expect(ErrorHandler.log).toHaveBeenCalledWith({
        operation: 'update settings',
        error,
        context: { channel: 'config:updateSettings', args: [updates] },
      });
    });
  });

  describe('config:setApiKey', () => {
    it('should set API key in config', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
        apiKeys: { openai: 'old-key' },
      };
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);
      mockFileDataStore.writeConfig.mockResolvedValue(undefined);

      const handler = handlers.get('config:setApiKey')!;
      const event = {} as IpcMainInvokeEvent;

      await handler(event, 'anthropic', 'new-key');

      expect(mockFileDataStore.writeConfig).toHaveBeenCalledWith({
        worktrees: [],
        settings: { vimMode: false },
        apiKeys: { openai: 'old-key', anthropic: 'new-key' },
      });
    });

    it('should initialize apiKeys if they do not exist', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
      };
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);
      mockFileDataStore.writeConfig.mockResolvedValue(undefined);

      const handler = handlers.get('config:setApiKey')!;
      const event = {} as IpcMainInvokeEvent;

      await handler(event, 'openai', 'test-key');

      expect(mockFileDataStore.writeConfig).toHaveBeenCalledWith({
        worktrees: [],
        settings: { vimMode: false },
        apiKeys: { openai: 'test-key' },
      });
    });

    it('should not log the actual key on error', async () => {
      const error = new Error('Write failed');
      mockFileDataStore.readConfig.mockRejectedValue(error);

      const handler = handlers.get('config:setApiKey')!;

      const result = await handler(mockEvent, 'openai', 'secret-key');

      expect(result).toEqual({
        success: false,
        error: 'error message',
        message: undefined,
      });
      expect(ErrorHandler.log).toHaveBeenCalledWith({
        operation: 'set api key',
        error,
        context: { channel: 'config:setApiKey', args: ['openai', 'secret-key'] },
      });
    });
  });

  describe('config:removeApiKey', () => {
    it('should remove API key from config', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
        apiKeys: { openai: 'key1', anthropic: 'key2' },
      };
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);
      mockFileDataStore.writeConfig.mockResolvedValue(undefined);

      const handler = handlers.get('config:removeApiKey')!;
      const event = {} as IpcMainInvokeEvent;

      await handler(event, 'openai');

      expect(mockFileDataStore.writeConfig).toHaveBeenCalledWith({
        worktrees: [],
        settings: { vimMode: false },
        apiKeys: { anthropic: 'key2' },
      });
    });

    it('should do nothing if key does not exist', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
        apiKeys: { anthropic: 'key2' },
      };
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);

      const handler = handlers.get('config:removeApiKey')!;
      const event = {} as IpcMainInvokeEvent;

      await handler(event, 'openai');

      expect(mockFileDataStore.writeConfig).not.toHaveBeenCalled();
    });

    it('should handle missing apiKeys section', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
      };
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);

      const handler = handlers.get('config:removeApiKey')!;
      const event = {} as IpcMainInvokeEvent;

      await handler(event, 'openai');

      expect(mockFileDataStore.writeConfig).not.toHaveBeenCalled();
    });
  });

  describe('config:clearApiKeys', () => {
    it('should clear all API keys', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
        apiKeys: { openai: 'key1', anthropic: 'key2' },
      };
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);
      mockFileDataStore.writeConfig.mockResolvedValue(undefined);

      const handler = handlers.get('config:clearApiKeys')!;
      const event = {} as IpcMainInvokeEvent;

      await handler(event);

      expect(mockFileDataStore.writeConfig).toHaveBeenCalledWith({
        worktrees: [],
        settings: { vimMode: false },
        apiKeys: {},
      });
    });
  });

  describe('config:addCustomCommand', () => {
    it('should add custom command to config', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
        customCommands: [],
      };
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);
      mockFileDataStore.writeConfig.mockResolvedValue(undefined);

      const command: CustomCommand = {
        id: 'cmd1',
        name: 'Test Command',
        description: 'Test command description',
        command: 'echo test',
        createdAt: new Date(),
      };

      const handler = handlers.get('config:addCustomCommand')!;
      const event = {} as IpcMainInvokeEvent;

      await handler(event, command);

      expect(mockFileDataStore.writeConfig).toHaveBeenCalledWith({
        worktrees: [],
        settings: { vimMode: false },
        customCommands: [command],
      });
    });

    it('should initialize customCommands if they do not exist', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
      };
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);
      mockFileDataStore.writeConfig.mockResolvedValue(undefined);

      const command: CustomCommand = {
        id: 'cmd1',
        name: 'Test Command',
        description: 'Test command description',
        command: 'echo test',
        createdAt: new Date(),
      };

      const handler = handlers.get('config:addCustomCommand')!;
      const event = {} as IpcMainInvokeEvent;

      await handler(event, command);

      expect(mockFileDataStore.writeConfig).toHaveBeenCalledWith({
        worktrees: [],
        settings: { vimMode: false },
        customCommands: [command],
      });
    });
  });

  describe('config:updateCustomCommand', () => {
    it('should update existing custom command', async () => {
      const oldCommand: CustomCommand = {
        id: 'cmd1',
        name: 'Old Command',
        command: 'echo old',
        description: 'Description',
        createdAt: new Date(),
      };
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
        customCommands: [oldCommand],
      };
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);
      mockFileDataStore.writeConfig.mockResolvedValue(undefined);

      const updatedCommand: CustomCommand = {
        id: 'cmd1',
        name: 'Updated Command',
        command: 'echo updated',
        description: 'Description',
        createdAt: new Date(),
      };

      const handler = handlers.get('config:updateCustomCommand')!;
      const event = {} as IpcMainInvokeEvent;

      await handler(event, 'cmd1', updatedCommand);

      expect(mockFileDataStore.writeConfig).toHaveBeenCalledWith({
        worktrees: [],
        settings: { vimMode: false },
        customCommands: [updatedCommand],
      });
    });

    it('should return error if command not found', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
        customCommands: [],
      };
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);

      const updatedCommand: CustomCommand = {
        id: 'cmd1',
        name: 'Updated Command',
        command: 'echo updated',
        description: 'Description',
        createdAt: new Date(),
      };

      const handler = handlers.get('config:updateCustomCommand')!;

      const result = await handler(mockEvent, 'cmd1', updatedCommand);

      expect(result).toEqual({
        success: false,
        error: 'error message',
        message: undefined,
      });
    });

    it('should return error if no custom commands exist', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
      };
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);

      const updatedCommand: CustomCommand = {
        id: 'cmd1',
        name: 'Updated Command',
        command: 'echo updated',
        description: 'Description',
        createdAt: new Date(),
      };

      const handler = handlers.get('config:updateCustomCommand')!;

      const result = await handler(mockEvent, 'cmd1', updatedCommand);

      expect(result).toEqual({
        success: false,
        error: 'error message',
        message: undefined,
      });
    });
  });

  describe('config:removeCustomCommand', () => {
    it('should remove custom command from config', async () => {
      const command1: CustomCommand = {
        id: 'cmd1',
        name: 'Command 1',
        command: 'echo 1',
        description: 'Description',
        createdAt: new Date(),
      };
      const command2: CustomCommand = {
        id: 'cmd2',
        name: 'Command 2',
        command: 'echo 2',
        description: 'Description',
        createdAt: new Date(),
      };
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
        customCommands: [command1, command2],
      };
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);
      mockFileDataStore.writeConfig.mockResolvedValue(undefined);

      const handler = handlers.get('config:removeCustomCommand')!;
      const event = {} as IpcMainInvokeEvent;

      await handler(event, 'cmd1');

      expect(mockFileDataStore.writeConfig).toHaveBeenCalledWith({
        worktrees: [],
        settings: { vimMode: false },
        customCommands: [command2],
      });
    });

    it('should do nothing if customCommands does not exist', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
      };
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);

      const handler = handlers.get('config:removeCustomCommand')!;
      const event = {} as IpcMainInvokeEvent;

      await handler(event, 'cmd1');

      expect(mockFileDataStore.writeConfig).not.toHaveBeenCalled();
    });
  });

  describe('config:clearCustomCommands', () => {
    it('should clear all custom commands', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
        customCommands: [
          {
            id: 'cmd1',
            name: 'Command 1',
            command: 'echo 1',
            description: 'Desc 1',
            createdAt: new Date(),
          },
          {
            id: 'cmd2',
            name: 'Command 2',
            command: 'echo 2',
            description: 'Desc 2',
            createdAt: new Date(),
          },
        ],
      };
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);
      mockFileDataStore.writeConfig.mockResolvedValue(undefined);

      const handler = handlers.get('config:clearCustomCommands')!;
      const event = {} as IpcMainInvokeEvent;

      await handler(event);

      expect(mockFileDataStore.writeConfig).toHaveBeenCalledWith({
        worktrees: [],
        settings: { vimMode: false },
        customCommands: [],
      });
    });
  });

  describe('config:getSection', () => {
    it('should return specific config section', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [{ folder_name: 'test', git_repo: 'url', branch_name: 'main' }],
        settings: { vimMode: true },
      };
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);

      const handler = handlers.get('config:getSection')!;
      const event = {} as IpcMainInvokeEvent;

      const result = await handler(event, 'settings');

      expect(result).toEqual({ vimMode: true });
    });

    it('should return error on failure', async () => {
      const error = new Error('Read failed');
      mockFileDataStore.readConfig.mockRejectedValue(error);

      const handler = handlers.get('config:getSection')!;

      const result = await handler(mockEvent, 'settings');

      expect(result).toEqual({
        success: false,
        error: 'error message',
        message: undefined,
      });
      expect(ErrorHandler.log).toHaveBeenCalledWith({
        operation: 'get config section',
        error,
        context: { channel: 'config:getSection', args: ['settings'] },
      });
    });
  });

  describe('config:setSection', () => {
    it('should set config section', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
      };
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);
      mockFileDataStore.writeConfig.mockResolvedValue(undefined);

      const handler = handlers.get('config:setSection')!;
      const event = {} as IpcMainInvokeEvent;
      const newSettings = { vimMode: true, theme: 'dark' };

      await handler(event, 'settings', newSettings);

      expect(mockFileDataStore.writeConfig).toHaveBeenCalledWith({
        worktrees: [],
        settings: newSettings,
      });
    });

    it('should return error on failure', async () => {
      const error = new Error('Write failed');
      mockFileDataStore.readConfig.mockRejectedValue(error);

      const handler = handlers.get('config:setSection')!;

      const result = await handler(mockEvent, 'settings', {});

      expect(result).toEqual({
        success: false,
        error: 'error message',
        message: undefined,
      });
      expect(ErrorHandler.log).toHaveBeenCalledWith({
        operation: 'set config section',
        error,
        context: { channel: 'config:setSection', args: ['settings', {}] },
      });
    });
  });
});
