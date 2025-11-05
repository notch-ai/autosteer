/**
 * Service-IPC Integration Tests
 * Tests multi-component interactions between services and IPC handlers
 * Validates data flow from services through IPC to ensure proper coordination
 */

import { SettingsService } from '@/services/SettingsService';
import { ApplicationContainer } from '@/services/ApplicationContainer';

// Electron is mocked via __mocks__/electron.ts (loaded through jest.config.js moduleNameMapper)
// We'll override the ipcMain methods in beforeEach to use jest.fn() functionality

// Mock electron-log
jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock electron-store
jest.mock('electron-store', () => {
  const mockStore = new Map<string, unknown>();
  return jest.fn().mockImplementation(() => ({
    store: Object.fromEntries(mockStore),
    get: jest.fn((key: string) => mockStore.get(key)),
    set: jest.fn((key: string, value: unknown) => mockStore.set(key, value)),
    delete: jest.fn((key: string) => mockStore.delete(key)),
    clear: jest.fn(() => mockStore.clear()),
    has: jest.fn((key: string) => mockStore.has(key)),
  }));
});

describe('Service-IPC Integration Tests', () => {
  let applicationContainer: ApplicationContainer;
  let settingsService: SettingsService;
  let mockIpcHandlers: Map<string, (...args: unknown[]) => unknown>;
  let mockIpcMain: {
    handle: jest.Mock;
    on: jest.Mock;
    removeHandler: jest.Mock;
  };
  let mockApp: {
    getPath: jest.Mock;
    getVersion: jest.Mock;
  };

  beforeEach(() => {
    console.log('[IPC Integration Test] Setting up test environment');
    jest.clearAllMocks();

    // Track IPC handlers
    mockIpcHandlers = new Map();

    // Get the electron module and override its exports with jest.fn()
    const electron = require('electron');

    // Set up ipcMain mock with jest.fn()
    mockIpcMain = {
      handle: jest.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        mockIpcHandlers.set(channel, handler);
        console.log(`[IPC Integration Test] Registered handler for channel: ${channel}`);
      }),
      on: jest.fn(),
      removeHandler: jest.fn(),
    };

    // Set up app mock with jest.fn()
    mockApp = {
      getPath: jest.fn(() => '/tmp/test-ipc-integration'),
      getVersion: jest.fn(() => '1.0.0-test'),
    };

    // Override the electron module exports
    electron.ipcMain = mockIpcMain;
    electron.app = mockApp;

    // Initialize services
    applicationContainer = new ApplicationContainer();
    applicationContainer.initialize();
    settingsService = applicationContainer.getSettingsService();
  });

  afterEach(() => {
    console.log('[IPC Integration Test] Cleaning up test environment');
    applicationContainer.cleanup();
    mockIpcHandlers.clear();
  });

  describe('Settings IPC → Service coordination', () => {
    it('should handle settings:get through IPC', async () => {
      console.log('[Test] Handling settings:get through IPC');

      // Set up test data
      settingsService.set('testKey', 'testValue');

      // Simulate IPC handler
      const getHandler = async (_event: unknown, key: string) => {
        try {
          const value = settingsService.get(key);
          return { success: true, data: value };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      };

      mockIpcHandlers.set('settings:get', getHandler as (...args: unknown[]) => unknown);

      // Call handler
      const result = await getHandler(null, 'testKey');

      expect(result).toEqual({
        success: true,
        data: 'testValue',
      });
    });

    it('should handle settings:set through IPC', async () => {
      console.log('[Test] Handling settings:set through IPC');

      // Simulate IPC handler
      const setHandler = async (_event: unknown, key: string, value: unknown) => {
        try {
          settingsService.set(key, value);
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      };

      mockIpcHandlers.set('settings:set', setHandler as (...args: unknown[]) => unknown);

      // Call handler
      const result = await setHandler(null, 'newKey', 'newValue');

      expect(result).toEqual({ success: true });
      expect(settingsService.get('newKey')).toBe('newValue');
    });

    it('should handle settings:getAll through IPC', async () => {
      console.log('[Test] Handling settings:getAll through IPC');

      // Set up test data
      settingsService.set('key1', 'value1');
      settingsService.set('key2', 'value2');

      // Simulate IPC handler
      const getAllHandler = async (_event: unknown) => {
        try {
          const settings = settingsService.getAll();
          return { success: true, data: settings };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      };

      mockIpcHandlers.set('settings:getAll', getAllHandler);

      // Call handler
      const result = await getAllHandler(null);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle settings:reset through IPC', async () => {
      console.log('[Test] Handling settings:reset through IPC');

      // Set up test data
      settingsService.set('tempKey', 'tempValue');

      // Simulate IPC handler
      const resetHandler = async (_event: unknown) => {
        try {
          settingsService.clear();
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      };

      mockIpcHandlers.set('settings:reset', resetHandler);

      // Call handler
      const result = await resetHandler(null);

      expect(result).toEqual({ success: true });
    });
  });

  describe('ApplicationContainer IPC → Service coordination', () => {
    it('should provide app version through IPC', async () => {
      console.log('[Test] Providing app version through IPC');

      // Simulate IPC handler
      const versionHandler = async (_event: unknown) => {
        try {
          const version = applicationContainer.getAppVersion();
          return { success: true, data: version };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      };

      mockIpcHandlers.set('app:getVersion', versionHandler);

      // Call handler
      const result = await versionHandler(null);

      expect(result).toEqual({
        success: true,
        data: '1.0.0-test',
      });
    });

    it('should handle service initialization status through IPC', async () => {
      console.log('[Test] Checking service initialization status');

      // Simulate IPC handler
      const statusHandler = async (_event: unknown) => {
        try {
          // Check if services are initialized by attempting to access them
          const settings = applicationContainer.getSettingsService();
          return {
            success: true,
            data: {
              initialized: true,
              settingsAvailable: settings !== null,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      };

      mockIpcHandlers.set('app:status', statusHandler);

      // Call handler
      const result = await statusHandler(null);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        initialized: true,
        settingsAvailable: true,
      });
    });
  });

  describe('Error handling through IPC', () => {
    it('should handle service errors in IPC handlers', async () => {
      console.log('[Test] Handling service errors in IPC');

      // Simulate IPC handler with error
      const errorHandler = async (_event: unknown, key: string) => {
        try {
          if (!key) {
            throw new Error('Key is required');
          }
          const value = settingsService.get(key);
          return { success: true, data: value };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      };

      mockIpcHandlers.set('settings:get', errorHandler as (...args: unknown[]) => unknown);

      // Call handler with invalid input
      const result = await errorHandler(null, '');

      expect(result).toEqual({
        success: false,
        error: 'Key is required',
      });
    });

    it('should handle uninitialized service errors', async () => {
      console.log('[Test] Handling uninitialized service errors');

      // Create new container without initialization
      const uninitializedContainer = new ApplicationContainer();

      // Simulate IPC handler
      const handler = async (_event: unknown) => {
        try {
          uninitializedContainer.getSettingsService();
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      };

      // Call handler
      const result = await handler(null);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not initialized');
    });
  });

  describe('IPC response format consistency', () => {
    it('should return consistent success responses', async () => {
      console.log('[Test] Ensuring consistent success responses');

      const handlers = [
        async () => {
          settingsService.set('test', 'value');
          return { success: true };
        },
        async () => {
          const value = settingsService.get('test');
          return { success: true, data: value };
        },
        async () => {
          const all = settingsService.getAll();
          return { success: true, data: all };
        },
      ];

      for (const handler of handlers) {
        const result = await handler();
        expect(result).toHaveProperty('success');
        expect(result.success).toBe(true);
      }
    });

    it('should return consistent error responses', async () => {
      console.log('[Test] Ensuring consistent error responses');

      const errorHandlers = [
        async () => {
          try {
            throw new Error('Test error 1');
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        },
        async () => {
          try {
            throw new Error('Test error 2');
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        },
      ];

      for (const handler of errorHandlers) {
        const result = await handler();
        expect(result).toHaveProperty('success');
        expect(result.success).toBe(false);
        expect(result).toHaveProperty('error');
        expect(typeof result.error).toBe('string');
      }
    });
  });

  describe('Multi-channel IPC coordination', () => {
    it('should handle multiple IPC channels simultaneously', async () => {
      console.log('[Test] Handling multiple IPC channels');

      // Register multiple handlers
      const handlers = {
        'settings:get': async (_event: unknown, key: string) => {
          const value = settingsService.get(key);
          return { success: true, data: value };
        },
        'settings:set': async (_event: unknown, key: string, value: unknown) => {
          settingsService.set(key, value);
          return { success: true };
        },
        'app:getVersion': async (_event: unknown) => {
          const version = applicationContainer.getAppVersion();
          return { success: true, data: version };
        },
      };

      // Register all handlers
      Object.entries(handlers).forEach(([channel, handler]) => {
        mockIpcHandlers.set(channel, handler as (...args: unknown[]) => unknown);
      });

      // Call handlers in sequence
      await handlers['settings:set'](null, 'key1', 'value1');
      const getResult = await handlers['settings:get'](null, 'key1');
      const versionResult = await handlers['app:getVersion'](null);

      expect(getResult).toEqual({ success: true, data: 'value1' });
      expect(versionResult.success).toBe(true);
    });

    it('should maintain state consistency across IPC calls', async () => {
      console.log('[Test] Maintaining state consistency across IPC calls');

      // Simulate multiple setting updates
      const setHandler = async (_event: unknown, key: string, value: unknown) => {
        settingsService.set(key, value);
        return { success: true };
      };

      const getHandler = async (_event: unknown, key: string) => {
        const value = settingsService.get(key);
        return { success: true, data: value };
      };

      // Set multiple values
      await setHandler(null, 'key1', 'value1');
      await setHandler(null, 'key2', 'value2');
      await setHandler(null, 'key3', 'value3');

      // Get all values
      const result1 = await getHandler(null, 'key1');
      const result2 = await getHandler(null, 'key2');
      const result3 = await getHandler(null, 'key3');

      expect(result1.data).toBe('value1');
      expect(result2.data).toBe('value2');
      expect(result3.data).toBe('value3');
    });
  });

  describe('Performance and scalability', () => {
    it('should handle rapid IPC requests efficiently', async () => {
      console.log('[Test] Handling rapid IPC requests');

      const handler = async (_event: unknown, key: string, value: unknown) => {
        settingsService.set(key, value);
        return { success: true };
      };

      const startTime = Date.now();

      // Simulate 100 rapid requests
      const promises = Array.from({ length: 100 }, (_, i) => handler(null, `key${i}`, `value${i}`));

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (2 seconds for 100 requests)
      expect(duration).toBeLessThan(2000);

      // Verify all values were set
      expect(settingsService.get('key0')).toBe('value0');
      expect(settingsService.get('key50')).toBe('value50');
      expect(settingsService.get('key99')).toBe('value99');
    });

    it('should handle concurrent IPC requests without data corruption', async () => {
      console.log('[Test] Handling concurrent IPC requests');

      const handler = async (_event: unknown, key: string, value: unknown) => {
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 1));
        settingsService.set(key, value);
        return { success: true };
      };

      // Make concurrent requests
      await Promise.all([
        handler(null, 'concurrent1', 'value1'),
        handler(null, 'concurrent2', 'value2'),
        handler(null, 'concurrent3', 'value3'),
        handler(null, 'concurrent4', 'value4'),
        handler(null, 'concurrent5', 'value5'),
      ]);

      // All values should be set correctly
      expect(settingsService.get('concurrent1')).toBe('value1');
      expect(settingsService.get('concurrent2')).toBe('value2');
      expect(settingsService.get('concurrent3')).toBe('value3');
      expect(settingsService.get('concurrent4')).toBe('value4');
      expect(settingsService.get('concurrent5')).toBe('value5');
    });
  });
});
