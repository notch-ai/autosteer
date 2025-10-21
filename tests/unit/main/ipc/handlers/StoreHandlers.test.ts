import { StoreHandlers } from '@/main/ipc/handlers/StoreHandlers';
import { FileDataStoreService } from '@/services/FileDataStoreService';
import { ErrorHandler } from '@/main/utils/errorHandler';
import { IpcMain, IpcMainInvokeEvent } from 'electron';
import { AutosteerConfig } from '@/types/config.types';

// Mock FileDataStoreService
jest.mock('@/services/FileDataStoreService');

// Mock ErrorHandler
jest.mock('@/main/utils/errorHandler');

// Mock electron-store
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    has: jest.fn(),
    clear: jest.fn(),
    store: {},
  }));
});

describe('StoreHandlers', () => {
  let storeHandlers: StoreHandlers;
  let mockIpcMain: jest.Mocked<IpcMain>;
  let mockFileDataStore: jest.Mocked<FileDataStoreService>;
  let handlers: Map<string, (...args: any[]) => any>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock IpcMain
    handlers = new Map();
    mockIpcMain = {
      handle: jest.fn((channel: string, handler: (...args: any[]) => any) => {
        handlers.set(channel, handler);
      }),
    } as any;

    // Create mock FileDataStoreService
    mockFileDataStore = {
      readConfig: jest.fn(),
      writeConfig: jest.fn(),
    } as any;

    // Mock FileDataStoreService.getInstance
    (FileDataStoreService.getInstance as jest.Mock).mockReturnValue(mockFileDataStore);

    // Mock ErrorHandler.log
    (ErrorHandler.log as jest.Mock).mockReturnValue('error message');

    // Create StoreHandlers instance
    storeHandlers = new StoreHandlers(mockIpcMain);
    storeHandlers.registerHandlers();
  });

  describe('registerHandlers', () => {
    it('should register all store handlers', () => {
      expect(mockIpcMain.handle).toHaveBeenCalledTimes(11); // 5 store + 2 export/import + 4 data handlers
      expect(handlers.has('store:get')).toBe(true);
      expect(handlers.has('store:set')).toBe(true);
      expect(handlers.has('store:delete')).toBe(true);
      expect(handlers.has('store:has')).toBe(true);
      expect(handlers.has('store:clear')).toBe(true);
      expect(handlers.has('store:export')).toBe(true);
      expect(handlers.has('store:import')).toBe(true);
      expect(handlers.has('data:save')).toBe(true);
      expect(handlers.has('data:load')).toBe(true);
      expect(handlers.has('data:export')).toBe(true);
      expect(handlers.has('data:import')).toBe(true);
    });
  });

  describe('store:get', () => {
    it('should return value from store', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
        store: { testKey: 'testValue' },
      } as any;
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);

      const handler = handlers.get('store:get')!;
      const event = {} as IpcMainInvokeEvent;
      const result = await handler(event, 'testKey');

      expect(result).toBe('testValue');
      expect(mockFileDataStore.readConfig).toHaveBeenCalled();
    });

    it('should return undefined for non-existent key', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
        store: {},
      } as any;
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);

      const handler = handlers.get('store:get')!;
      const event = {} as IpcMainInvokeEvent;
      const result = await handler(event, 'nonExistentKey');

      expect(result).toBeUndefined();
    });

    it('should initialize store if it does not exist', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
      };
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);

      const handler = handlers.get('store:get')!;
      const event = {} as IpcMainInvokeEvent;
      const result = await handler(event, 'testKey');

      expect(result).toBeUndefined();
    });

    it('should return undefined and log error on failure', async () => {
      const error = new Error('Read failed');
      mockFileDataStore.readConfig.mockRejectedValue(error);

      const handler = handlers.get('store:get')!;
      const event = {} as IpcMainInvokeEvent;
      const result = await handler(event, 'testKey');

      expect(result).toBeUndefined();
      expect(ErrorHandler.log).toHaveBeenCalledWith({
        operation: 'store get',
        error,
        context: { key: 'testKey' },
      });
    });
  });

  describe('store:set', () => {
    it('should set value in store', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
        store: {},
      } as any;
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);
      mockFileDataStore.writeConfig.mockResolvedValue(undefined);

      const handler = handlers.get('store:set')!;
      const event = {} as IpcMainInvokeEvent;
      await handler(event, 'newKey', 'newValue');

      expect(mockFileDataStore.writeConfig).toHaveBeenCalledWith({
        worktrees: [],
        settings: { vimMode: false },
        store: { newKey: 'newValue' },
      });
    });

    it('should initialize store if it does not exist', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
      };
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);
      mockFileDataStore.writeConfig.mockResolvedValue(undefined);

      const handler = handlers.get('store:set')!;
      const event = {} as IpcMainInvokeEvent;
      await handler(event, 'newKey', 'newValue');

      expect(mockFileDataStore.writeConfig).toHaveBeenCalledWith({
        worktrees: [],
        settings: { vimMode: false },
        store: { newKey: 'newValue' },
      });
    });

    it('should overwrite existing value', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
        store: { existingKey: 'oldValue' },
      } as any;
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);
      mockFileDataStore.writeConfig.mockResolvedValue(undefined);

      const handler = handlers.get('store:set')!;
      const event = {} as IpcMainInvokeEvent;
      await handler(event, 'existingKey', 'newValue');

      expect(mockFileDataStore.writeConfig).toHaveBeenCalledWith({
        worktrees: [],
        settings: { vimMode: false },
        store: { existingKey: 'newValue' },
      });
    });

    it('should throw and log error on failure', async () => {
      const error = new Error('Write failed');
      mockFileDataStore.readConfig.mockRejectedValue(error);

      const handler = handlers.get('store:set')!;
      const event = {} as IpcMainInvokeEvent;

      await expect(handler(event, 'key', 'value')).rejects.toThrow(error);
      expect(ErrorHandler.log).toHaveBeenCalledWith({
        operation: 'store set',
        error,
        context: { key: 'key' },
      });
    });
  });

  describe('store:delete', () => {
    it('should delete value from store', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
        store: { key1: 'value1', key2: 'value2' },
      } as any;
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);
      mockFileDataStore.writeConfig.mockResolvedValue(undefined);

      const handler = handlers.get('store:delete')!;
      const event = {} as IpcMainInvokeEvent;
      await handler(event, 'key1');

      expect(mockFileDataStore.writeConfig).toHaveBeenCalledWith({
        worktrees: [],
        settings: { vimMode: false },
        store: { key2: 'value2' },
      });
    });

    it('should do nothing if key does not exist', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
        store: { key1: 'value1' },
      } as any;
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);

      const handler = handlers.get('store:delete')!;
      const event = {} as IpcMainInvokeEvent;
      await handler(event, 'nonExistentKey');

      expect(mockFileDataStore.writeConfig).not.toHaveBeenCalled();
    });

    it('should do nothing if store does not exist', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
      };
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);

      const handler = handlers.get('store:delete')!;
      const event = {} as IpcMainInvokeEvent;
      await handler(event, 'key');

      expect(mockFileDataStore.writeConfig).not.toHaveBeenCalled();
    });

    it('should throw and log error on failure', async () => {
      const error = new Error('Delete failed');
      mockFileDataStore.readConfig.mockRejectedValue(error);

      const handler = handlers.get('store:delete')!;
      const event = {} as IpcMainInvokeEvent;

      await expect(handler(event, 'key')).rejects.toThrow(error);
      expect(ErrorHandler.log).toHaveBeenCalledWith({
        operation: 'store delete',
        error,
        context: { key: 'key' },
      });
    });
  });

  describe('store:has', () => {
    it('should return true if key exists', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
        store: { existingKey: 'value' },
      } as any;
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);

      const handler = handlers.get('store:has')!;
      const event = {} as IpcMainInvokeEvent;
      const result = await handler(event, 'existingKey');

      expect(result).toBe(true);
    });

    it('should return false if key does not exist', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
        store: { otherKey: 'value' },
      } as any;
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);

      const handler = handlers.get('store:has')!;
      const event = {} as IpcMainInvokeEvent;
      const result = await handler(event, 'nonExistentKey');

      expect(result).toBe(false);
    });

    it('should return false if store does not exist', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
      };
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);

      const handler = handlers.get('store:has')!;
      const event = {} as IpcMainInvokeEvent;
      const result = await handler(event, 'anyKey');

      expect(result).toBe(false);
    });

    it('should return false and log error on failure', async () => {
      const error = new Error('Read failed');
      mockFileDataStore.readConfig.mockRejectedValue(error);

      const handler = handlers.get('store:has')!;
      const event = {} as IpcMainInvokeEvent;
      const result = await handler(event, 'key');

      expect(result).toBe(false);
      expect(ErrorHandler.log).toHaveBeenCalledWith({
        operation: 'store has',
        error,
        context: { key: 'key' },
      });
    });
  });

  describe('store:clear', () => {
    it('should clear all values from store', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
        store: { key1: 'value1', key2: 'value2' },
      } as any;
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);
      mockFileDataStore.writeConfig.mockResolvedValue(undefined);

      const handler = handlers.get('store:clear')!;
      const event = {} as IpcMainInvokeEvent;
      await handler(event);

      expect(mockFileDataStore.writeConfig).toHaveBeenCalledWith({
        worktrees: [],
        settings: { vimMode: false },
        store: {},
      });
    });

    it('should set empty store even if store did not exist', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
      };
      mockFileDataStore.readConfig.mockResolvedValue(mockConfig);
      mockFileDataStore.writeConfig.mockResolvedValue(undefined);

      const handler = handlers.get('store:clear')!;
      const event = {} as IpcMainInvokeEvent;
      await handler(event);

      expect(mockFileDataStore.writeConfig).toHaveBeenCalledWith({
        worktrees: [],
        settings: { vimMode: false },
        store: {},
      });
    });

    it('should throw and log error on failure', async () => {
      const error = new Error('Clear failed');
      mockFileDataStore.readConfig.mockRejectedValue(error);

      const handler = handlers.get('store:clear')!;
      const event = {} as IpcMainInvokeEvent;

      await expect(handler(event)).rejects.toThrow(error);
      expect(ErrorHandler.log).toHaveBeenCalledWith({
        operation: 'store clear',
        error,
      });
    });
  });
});
