/**
 * System Handlers Test Suite
 * Tests for IPC system handler operations including terminal, badge, config, log, store, and update
 * IPC Simplification - System Domain Handler Tests
 */

import { SystemHandlers } from '@/main/ipc/handlers/system.handlers';
import { XtermService } from '@/services/XtermService';
import { BadgeService } from '@/main/services/BadgeService';
import { FileDataStoreService } from '@/services/FileDataStoreService';
import { UpdateService } from '@/services/UpdateService';
import { IPC_CHANNELS } from '@/types/ipc.types';
import { ipcMain, BrowserWindow } from 'electron';
import log from 'electron-log';

// Mock dependencies
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
  },
  BrowserWindow: {
    fromWebContents: jest.fn(),
  },
  app: {
    getPath: jest.fn(() => '/mock/path'),
    getVersion: jest.fn(() => '1.0.0'),
  },
}));

jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('@/services/XtermService');
jest.mock('@/main/services/BadgeService');
jest.mock('@/services/FileDataStoreService');
jest.mock('@/services/UpdateService');
jest.mock('@/main/services/logger', () => ({
  mainLogger: {
    setDevelopmentMode: jest.fn(),
    getLogPath: jest.fn(() => '/mock/logs/main.log'),
    cleanOldLogs: jest.fn(),
  },
}));

describe('SystemHandlers', () => {
  let systemHandlers: SystemHandlers;
  let mockXtermService: jest.Mocked<XtermService>;
  let mockBadgeService: jest.Mocked<BadgeService>;
  let mockFileDataStore: jest.Mocked<FileDataStoreService>;
  let mockUpdateService: jest.Mocked<UpdateService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock instances
    mockXtermService = {
      createTerminal: jest.fn(),
      killTerminal: jest.fn(),
      getAllTerminals: jest.fn(),
      cleanup: jest.fn(),
    } as unknown as jest.Mocked<XtermService>;

    mockBadgeService = {
      showBadge: jest.fn(),
      hideBadge: jest.fn(),
      isSupported: jest.fn(),
    } as unknown as jest.Mocked<BadgeService>;

    mockFileDataStore = {
      readConfig: jest.fn(),
      writeConfig: jest.fn(),
      readAppConfig: jest.fn(),
      writeAppConfig: jest.fn(),
      getDataDirectory: jest.fn(() => '/mock/data'),
      setDataDirectory: jest.fn(),
    } as unknown as jest.Mocked<FileDataStoreService>;

    mockUpdateService = {
      checkForUpdates: jest.fn(),
      downloadUpdate: jest.fn(),
      quitAndInstall: jest.fn(),
      dismissVersion: jest.fn(),
    } as unknown as jest.Mocked<UpdateService>;

    // Mock getInstance methods
    (XtermService.getInstance as jest.Mock) = jest.fn(() => mockXtermService);
    (BadgeService.getInstance as jest.Mock) = jest.fn(() => mockBadgeService);
    (FileDataStoreService.getInstance as jest.Mock) = jest.fn(() => mockFileDataStore);

    systemHandlers = new SystemHandlers(mockUpdateService);
  });

  describe('registerHandlers', () => {
    it('should register all system IPC handlers', () => {
      systemHandlers.registerHandlers();

      // Terminal handlers
      expect(ipcMain.handle).toHaveBeenCalledWith(
        IPC_CHANNELS.TERMINAL_CREATE,
        expect.any(Function)
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        IPC_CHANNELS.TERMINAL_DESTROY,
        expect.any(Function)
      );
      expect(ipcMain.handle).toHaveBeenCalledWith('terminal:list', expect.any(Function));

      // Badge handlers
      expect(ipcMain.handle).toHaveBeenCalledWith('badge:show', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('badge:hide', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('badge:isSupported', expect.any(Function));

      // Config handlers
      expect(ipcMain.handle).toHaveBeenCalledWith('config:read', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('config:updateSettings', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('config:setApiKey', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('config:getDevMode', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('config:setDevMode', expect.any(Function));

      // Log handlers
      expect(ipcMain.handle).toHaveBeenCalledWith('log:info', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('log:error', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('logs:getPath', expect.any(Function));

      // Store handlers
      expect(ipcMain.handle).toHaveBeenCalledWith('store:get', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('store:set', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('store:delete', expect.any(Function));

      // Update handlers
      expect(ipcMain.handle).toHaveBeenCalledWith('update:check', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('update:download', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('update:install', expect.any(Function));
    });
  });

  describe('Terminal Operations', () => {
    describe('terminal:create', () => {
      it('should create a new terminal', async () => {
        const mockTerminalData = {
          id: 'term-1',
          pid: 12345,
          title: 'Terminal 1',
          isActive: true,
          createdAt: new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
          shell: '/bin/bash',
          cwd: '/home/user',
          size: { rows: 24, cols: 80 },
          status: 'running' as const,
        };
        mockXtermService.createTerminal.mockResolvedValue(mockTerminalData);

        const mockWindow = {} as BrowserWindow;
        (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(mockWindow);

        systemHandlers.registerHandlers();
        const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.TERMINAL_CREATE
        )[1];

        const mockEvent = { sender: {} };
        const result = await handler(mockEvent, { shell: '/bin/bash' });

        expect(mockXtermService.createTerminal).toHaveBeenCalledWith(mockWindow, {
          shell: '/bin/bash',
        });
        expect(result).toEqual({
          success: true,
          data: mockTerminalData,
        });
      });

      it('should handle window not found error', async () => {
        (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(null);

        systemHandlers.registerHandlers();
        const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.TERMINAL_CREATE
        )[1];

        const mockEvent = { sender: {} };
        const result = await handler(mockEvent);

        expect(result).toEqual({
          success: false,
          error: 'Window not found',
        });
      });
    });

    describe('terminal:destroy', () => {
      it('should destroy a terminal', async () => {
        mockXtermService.killTerminal.mockResolvedValue(undefined);

        systemHandlers.registerHandlers();
        const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.TERMINAL_DESTROY
        )[1];

        const result = await handler(null, 'term-1');

        expect(mockXtermService.killTerminal).toHaveBeenCalledWith('term-1');
        expect(result).toEqual({ success: true });
      });
    });

    describe('terminal:list', () => {
      it('should list all terminals', async () => {
        const mockTerminals = [
          { id: 'term-1', shell: '/bin/bash', cwd: '/home', isActive: true, pid: 123 },
          { id: 'term-2', shell: '/bin/zsh', cwd: '/tmp', isActive: false, pid: 456 },
        ];
        mockXtermService.getAllTerminals.mockReturnValue(mockTerminals);

        systemHandlers.registerHandlers();
        const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'terminal:list'
        )[1];

        const result = await handler(null);

        expect(result).toEqual({
          success: true,
          data: mockTerminals,
        });
      });
    });
  });

  describe('Badge Operations', () => {
    describe('badge:show', () => {
      it('should show badge', async () => {
        mockBadgeService.showBadge.mockResolvedValue(undefined);

        systemHandlers.registerHandlers();
        const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'badge:show'
        )[1];

        const result = await handler();

        expect(mockBadgeService.showBadge).toHaveBeenCalled();
        expect(result).toEqual({ success: true });
      });

      it('should log warning if badge operation exceeds 5ms', async () => {
        mockBadgeService.showBadge.mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 10))
        );

        systemHandlers.registerHandlers();
        const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'badge:show'
        )[1];

        await handler();

        expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('Badge show operation took'));
      });
    });

    describe('badge:isSupported', () => {
      it('should check badge support', async () => {
        mockBadgeService.isSupported.mockReturnValue(true);

        systemHandlers.registerHandlers();
        const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'badge:isSupported'
        )[1];

        const result = await handler();

        expect(result).toEqual({ success: true, data: true });
      });
    });
  });

  describe('Config Operations', () => {
    describe('config:read', () => {
      it('should read config file', async () => {
        const mockConfig = {
          worktrees: [],
          settings: { vimMode: false },
        };
        mockFileDataStore.readConfig.mockResolvedValue(mockConfig);

        systemHandlers.registerHandlers();
        const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'config:read'
        )[1];

        const result = await handler();

        expect(mockFileDataStore.readConfig).toHaveBeenCalled();
        expect(result).toEqual(mockConfig);
      });

      it('should return default config on error', async () => {
        mockFileDataStore.readConfig.mockRejectedValue(new Error('File not found'));

        systemHandlers.registerHandlers();
        const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'config:read'
        )[1];

        const result = await handler();

        expect(result).toEqual({
          worktrees: [],
          settings: { vimMode: false },
        });
      });
    });

    describe('config:updateSettings', () => {
      it('should update settings', async () => {
        const mockConfig = {
          worktrees: [],
          settings: { vimMode: false },
        };
        mockFileDataStore.readConfig.mockResolvedValue(mockConfig);
        mockFileDataStore.writeConfig.mockResolvedValue(undefined);

        systemHandlers.registerHandlers();
        const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'config:updateSettings'
        )[1];

        await handler(null, { vimMode: true });

        expect(mockFileDataStore.writeConfig).toHaveBeenCalledWith({
          worktrees: [],
          settings: { vimMode: true },
        });
      });
    });

    describe('config:setApiKey', () => {
      it('should set API key', async () => {
        const mockConfig = {
          worktrees: [],
          settings: {},
        };
        mockFileDataStore.readConfig.mockResolvedValue(mockConfig);
        mockFileDataStore.writeConfig.mockResolvedValue(undefined);

        systemHandlers.registerHandlers();
        const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'config:setApiKey'
        )[1];

        await handler(null, 'anthropic', 'sk-test-key');

        expect(mockFileDataStore.writeConfig).toHaveBeenCalledWith({
          worktrees: [],
          settings: {},
          apiKeys: { anthropic: 'sk-test-key' },
        });
      });
    });
  });

  describe('Log Operations', () => {
    describe('log:info', () => {
      it('should log info messages', async () => {
        systemHandlers.registerHandlers();
        const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'log:info'
        )[1];

        await handler(null, 'Test message', { data: 'test' });

        expect(log.info).toHaveBeenCalledWith('Test message', { data: 'test' });
      });
    });

    describe('logs:getPath', () => {
      it('should get log file path', async () => {
        systemHandlers.registerHandlers();
        const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'logs:getPath'
        )[1];

        const result = await handler();

        expect(result).toBe('/mock/logs/main.log');
      });
    });
  });

  describe('Store Operations', () => {
    describe('store:get', () => {
      it('should get value from store', async () => {
        const mockConfig = {
          worktrees: [],
          settings: {},
          store: { testKey: 'testValue' },
        };
        mockFileDataStore.readConfig.mockResolvedValue(mockConfig);

        systemHandlers.registerHandlers();
        const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'store:get'
        )[1];

        const result = await handler(null, 'testKey');

        expect(result).toBe('testValue');
      });
    });

    describe('store:set', () => {
      it('should set value in store', async () => {
        const mockConfig = {
          worktrees: [],
          settings: {},
        };
        mockFileDataStore.readConfig.mockResolvedValue(mockConfig);
        mockFileDataStore.writeConfig.mockResolvedValue(undefined);

        systemHandlers.registerHandlers();
        const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'store:set'
        )[1];

        await handler(null, 'newKey', 'newValue');

        expect(mockFileDataStore.writeConfig).toHaveBeenCalledWith({
          worktrees: [],
          settings: {},
          store: { newKey: 'newValue' },
        });
      });
    });
  });

  describe('Update Operations', () => {
    describe('update:check', () => {
      it('should check for updates', async () => {
        mockUpdateService.checkForUpdates.mockResolvedValue(undefined);

        systemHandlers.registerHandlers();
        const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'update:check'
        )[1];

        await handler();

        expect(mockUpdateService.checkForUpdates).toHaveBeenCalled();
      });
    });

    describe('update:download', () => {
      it('should download update', async () => {
        mockUpdateService.downloadUpdate.mockResolvedValue(undefined);

        systemHandlers.registerHandlers();
        const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'update:download'
        )[1];

        await handler();

        expect(mockUpdateService.downloadUpdate).toHaveBeenCalled();
      });
    });

    describe('update:install', () => {
      it('should quit and install update', async () => {
        mockUpdateService.quitAndInstall.mockReturnValue(undefined);

        systemHandlers.registerHandlers();
        const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'update:install'
        )[1];

        handler();

        expect(mockUpdateService.quitAndInstall).toHaveBeenCalled();
      });
    });

    describe('update:dismiss', () => {
      it('should dismiss version', async () => {
        mockUpdateService.dismissVersion.mockReturnValue(undefined);

        systemHandlers.registerHandlers();
        const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'update:dismiss'
        )[1];

        await handler(null, '1.2.3');

        expect(mockUpdateService.dismissVersion).toHaveBeenCalledWith('1.2.3');
      });
    });
  });

  describe('cleanup', () => {
    it('should cleanup terminal service', async () => {
      mockXtermService.cleanup.mockResolvedValue(undefined);

      await systemHandlers.cleanup();

      expect(mockXtermService.cleanup).toHaveBeenCalled();
    });
  });
});
