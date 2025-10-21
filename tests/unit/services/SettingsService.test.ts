import { SettingsService, ServiceError } from '@/services/SettingsService';
import { DEFAULT_SETTINGS } from '@/entities/Settings';
import Store from 'electron-store';

// Mock electron-store
const mockStore = {
  store: {},
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  has: jest.fn(),
  reset: jest.fn(),
  openInEditor: jest.fn(),
  path: '/mock/settings.json',
  size: 0,
  onDidChange: jest.fn(),
  onDidAnyChange: jest.fn(),
  offDidChange: jest.fn(),
  offDidAnyChange: jest.fn(),
  iterator: jest.fn(),
  '*': Symbol.for('ElectronStore'),
};

jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => mockStore as any);
});

// Mock electron-log
jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('ServiceError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a ServiceError with default values', () => {
    const error = new ServiceError('Test error message');

    expect(error.name).toBe('ServiceError');
    expect(error.message).toBe('Test error message');
    expect(error.code).toBe('SERVICE_ERROR');
    expect(error.context).toEqual({});
    expect(error.timestamp).toBeInstanceOf(Date);
    expect(error.stack).toBeDefined();
  });

  it('should create a ServiceError with custom options', () => {
    const context = { key: 'value', nested: { data: 123 } };
    const cause = new Error('Root cause');

    const error = new ServiceError('Custom error', {
      code: 'CUSTOM_ERROR',
      context,
      cause,
    });

    expect(error.name).toBe('ServiceError');
    expect(error.message).toBe('Custom error');
    expect(error.code).toBe('CUSTOM_ERROR');
    expect(error.context).toEqual(context);
    expect(error.cause).toBe(cause);
    expect(error.timestamp).toBeInstanceOf(Date);
  });

  it('should serialize to JSON correctly', () => {
    const context = { setting: 'theme', value: 'dark' };
    const error = new ServiceError('JSON test', {
      code: 'JSON_ERROR',
      context,
    });

    const json = error.toJSON();

    expect(json).toEqual({
      name: 'ServiceError',
      message: 'JSON test',
      code: 'JSON_ERROR',
      context,
      timestamp: error.timestamp,
      stack: error.stack,
    });
  });

  it('should handle Error.captureStackTrace availability', () => {
    const originalCaptureStackTrace = Error.captureStackTrace;

    // Test when captureStackTrace is available
    Error.captureStackTrace = jest.fn();
    const error1 = new ServiceError('Stack trace test');
    expect(Error.captureStackTrace).toHaveBeenCalledWith(error1, ServiceError);

    // Test when captureStackTrace is not available
    delete (Error as any).captureStackTrace;
    const error2 = new ServiceError('No stack trace');
    expect(error2).toBeInstanceOf(ServiceError);

    // Restore
    Error.captureStackTrace = originalCaptureStackTrace;
  });
});

describe('SettingsService', () => {
  let settingsService: SettingsService;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    originalNodeEnv = process.env.NODE_ENV;

    // Remove any property descriptors that might have been set
    const storeDescriptor = Object.getOwnPropertyDescriptor(mockStore, 'store');
    if (storeDescriptor && (storeDescriptor.get || storeDescriptor.set)) {
      delete (mockStore as any).store;
    }

    // Reset mock store properties
    mockStore.store = {};

    // Reset all mock functions
    Object.keys(mockStore).forEach((key) => {
      if (typeof mockStore[key as keyof typeof mockStore] === 'function') {
        (mockStore[key as keyof typeof mockStore] as jest.Mock).mockReset();
      }
    });

    // Reset Store mock
    (Store as jest.MockedClass<typeof Store>).mockImplementation(() => mockStore as any);

    settingsService = new SettingsService();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('constructor', () => {
    it('should create Store with default options in non-production', () => {
      process.env.NODE_ENV = 'development';

      new SettingsService();

      expect(Store).toHaveBeenCalledWith({
        name: 'settings',
        defaults: {},
      });
    });

    it('should create Store with encryption in production', () => {
      process.env.NODE_ENV = 'production';

      new SettingsService();

      expect(Store).toHaveBeenCalledWith({
        name: 'settings',
        defaults: {},
        encryptionKey: 'autosteer-settings-key',
      });
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      mockStore.store = { theme: 'dark', vimMode: true };
    });

    it('should initialize with saved settings', () => {
      settingsService.initialize();

      expect(settingsService.getAll()).toEqual({
        ...DEFAULT_SETTINGS,
        theme: 'dark',
        vimMode: true,
      });
    });

    it('should filter out unknown properties from saved settings', () => {
      mockStore.store = {
        theme: 'dark',
        unknownProperty: 'should-be-filtered',
        vimMode: false,
        anotherUnknown: 123,
      };

      settingsService.initialize();

      const settings = settingsService.getAll();
      expect(settings).not.toHaveProperty('unknownProperty');
      expect(settings).not.toHaveProperty('anotherUnknown');
      expect(settings).toHaveProperty('theme', 'dark');
      expect(settings).toHaveProperty('vimMode', false);
    });

    it('should handle initialization errors gracefully', () => {
      // Make store.store throw an error
      Object.defineProperty(mockStore, 'store', {
        get: () => {
          throw new Error('Store access error');
        },
        configurable: true,
      });

      expect(() => settingsService.initialize()).toThrow(ServiceError);
      expect(() => settingsService.initialize()).toThrow('Settings initialize failed');

      // Clean up the property descriptor
      delete (mockStore as any).store;
      mockStore.store = {};
    });

    it('should initialize cache with current settings', () => {
      mockStore.store = { theme: 'dark' };

      settingsService.initialize();

      // Verify cache is working by checking get method doesn't call store
      settingsService.get('theme');
      expect(mockStore.get).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    beforeEach(() => {
      settingsService.initialize();
    });

    it('should throw error when not initialized', () => {
      const uninitializedService = new SettingsService();

      expect(() => uninitializedService.get('theme')).toThrow(ServiceError);
      expect(() => uninitializedService.get('theme')).toThrow('SettingsService not initialized');
    });

    it('should return cached value when available and fresh', () => {
      // First, set cache by calling initialize with some data
      mockStore.store = { theme: 'light' };
      settingsService.initialize();

      mockStore.get.mockReturnValue('light');

      const value1 = settingsService.get('theme');
      const value2 = settingsService.get('theme');

      expect(value1).toBe('light');
      expect(value2).toBe('light');
      // Should use cache, not call store.get
      expect(mockStore.get).toHaveBeenCalledTimes(0);
    });

    it('should fetch from store when cache is expired', () => {
      // Set a very short cache TTL for testing
      (settingsService as any).CACHE_TTL = 1;

      mockStore.get.mockReturnValue('light');

      settingsService.get('theme');

      // Wait for cache to expire
      setTimeout(() => {
        settingsService.get('theme');
        expect(mockStore.get).toHaveBeenCalledTimes(2);
      }, 10);
    });

    it('should return undefined for non-existent keys', () => {
      mockStore.get.mockReturnValue(undefined);

      const value = settingsService.get('nonexistent');

      expect(value).toBeUndefined();
      expect(mockStore.get).toHaveBeenCalledWith('nonexistent');
    });

    it('should handle store errors gracefully', () => {
      // Clear cache first so it calls the store
      (settingsService as any).cache.clear();

      mockStore.get.mockImplementation(() => {
        throw new Error('Store read error');
      });

      expect(() => settingsService.get('theme')).toThrow(ServiceError);
      expect(() => settingsService.get('theme')).toThrow('Settings get failed');
    });
  });

  describe('set', () => {
    beforeEach(() => {
      settingsService.initialize();
    });

    it('should throw error when not initialized', () => {
      const uninitializedService = new SettingsService();

      expect(() => uninitializedService.set('theme', 'dark')).toThrow(ServiceError);
      expect(() => uninitializedService.set('theme', 'dark')).toThrow(
        'SettingsService not initialized'
      );
    });

    it('should set value in store and update cache', () => {
      settingsService.set('theme', 'dark');

      expect(mockStore.set).toHaveBeenCalledWith('theme', 'dark');
      expect(settingsService.getAll().theme).toBe('dark');
    });

    it('should update cache for known settings', () => {
      settingsService.set('theme', 'custom');

      // Verify cache is updated by checking get doesn't call store
      mockStore.get.mockClear();
      const value = settingsService.get('theme');

      expect(value).toBe('custom');
      expect(mockStore.get).not.toHaveBeenCalled();
    });

    it('should handle unknown settings', () => {
      settingsService.set('unknownSetting', 'value');

      expect(mockStore.set).toHaveBeenCalledWith('unknownSetting', 'value');
    });

    it('should handle store errors gracefully', () => {
      mockStore.set.mockImplementation(() => {
        throw new Error('Store write error');
      });

      expect(() => settingsService.set('theme', 'dark')).toThrow(ServiceError);
      expect(() => settingsService.set('theme', 'dark')).toThrow('Settings set failed');
    });

    it('should handle different value types', () => {
      const testCases = [
        ['string', 'test'],
        ['number', 42],
        ['boolean', true],
        ['object', { nested: 'value' }],
        ['array', [1, 2, 3]],
        ['null', null],
      ];

      testCases.forEach(([type, value]) => {
        settingsService.set(`test_${type}`, value);
        expect(mockStore.set).toHaveBeenCalledWith(`test_${type}`, value);
      });
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      settingsService.initialize();
    });

    it('should throw error when not initialized', () => {
      const uninitializedService = new SettingsService();

      expect(() => uninitializedService.delete('theme')).toThrow(ServiceError);
      expect(() => uninitializedService.delete('theme')).toThrow('SettingsService not initialized');
    });

    it('should delete from store and invalidate cache', () => {
      settingsService.delete('theme');

      expect(mockStore.delete).toHaveBeenCalledWith('theme');
    });

    it('should reset to default value for known settings', () => {
      settingsService.delete('theme');

      expect(settingsService.getAll().theme).toBe(DEFAULT_SETTINGS.theme);
    });

    it('should handle unknown settings', () => {
      settingsService.delete('unknownSetting');

      expect(mockStore.delete).toHaveBeenCalledWith('unknownSetting');
    });

    it('should handle store errors gracefully', () => {
      mockStore.delete.mockImplementation(() => {
        throw new Error('Store delete error');
      });

      expect(() => settingsService.delete('theme')).toThrow(ServiceError);
      expect(() => settingsService.delete('theme')).toThrow('Settings delete failed');
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      settingsService.initialize();
    });

    it('should clear store and reset to defaults', () => {
      settingsService.clear();

      expect(mockStore.clear).toHaveBeenCalled();
      expect(settingsService.getAll()).toEqual(DEFAULT_SETTINGS);

      // Verify defaults are saved to store
      Object.entries(DEFAULT_SETTINGS).forEach(([key, value]) => {
        expect(mockStore.set).toHaveBeenCalledWith(key, value);
      });
    });

    it('should handle store errors gracefully', () => {
      mockStore.clear.mockImplementation(() => {
        throw new Error('Store clear error');
      });

      expect(() => settingsService.clear()).toThrow(ServiceError);
      expect(() => settingsService.clear()).toThrow('Settings clear failed');
    });
  });

  describe('has', () => {
    beforeEach(() => {
      settingsService.initialize();
    });

    it('should return false when not initialized', () => {
      const uninitializedService = new SettingsService();

      // has() method returns false on error instead of throwing
      expect(uninitializedService.has('theme')).toBe(false);
    });

    it('should return true for existing keys', () => {
      mockStore.has.mockReturnValue(true);

      const result = settingsService.has('theme');

      expect(result).toBe(true);
      expect(mockStore.has).toHaveBeenCalledWith('theme');
    });

    it('should return false for non-existing keys', () => {
      mockStore.has.mockReturnValue(false);

      const result = settingsService.has('nonexistent');

      expect(result).toBe(false);
      expect(mockStore.has).toHaveBeenCalledWith('nonexistent');
    });

    it('should handle store errors gracefully', () => {
      mockStore.has.mockImplementation(() => {
        throw new Error('Store has error');
      });

      const result = settingsService.has('theme');

      expect(result).toBe(false);
    });
  });

  describe('getAll', () => {
    beforeEach(() => {
      mockStore.store = { theme: 'dark', autoStart: true };
      settingsService.initialize();
    });

    it('should throw error when not initialized', () => {
      const uninitializedService = new SettingsService();

      expect(() => uninitializedService.getAll()).toThrow(ServiceError);
      expect(() => uninitializedService.getAll()).toThrow('SettingsService not initialized');
    });

    it('should return copy of all settings', () => {
      const settings = settingsService.getAll();

      expect(settings).toEqual({
        ...DEFAULT_SETTINGS,
        theme: 'dark',
        autoStart: true,
      });

      // Verify it returns a copy, not the original object
      (settings as any).theme = 'modified';
      expect(settingsService.getAll().theme).toBe('dark');
    });
  });

  describe('updateBatch', () => {
    beforeEach(() => {
      settingsService.initialize();
    });

    it('should throw error when not initialized', () => {
      const uninitializedService = new SettingsService();

      expect(() => uninitializedService.updateBatch({ theme: 'dark' })).toThrow(ServiceError);
      expect(() => uninitializedService.updateBatch({ theme: 'dark' })).toThrow(
        'SettingsService not initialized'
      );
    });

    it('should update multiple settings at once', () => {
      const updates = { theme: 'dark' as const, vimMode: false };

      settingsService.updateBatch(updates);

      expect(mockStore.set).toHaveBeenCalledWith('theme', 'dark');
      expect(mockStore.set).toHaveBeenCalledWith('vimMode', false);

      const allSettings = settingsService.getAll();
      expect(allSettings.theme).toBe('dark');
      expect(allSettings.vimMode).toBe(false);
    });

    it('should handle empty updates', () => {
      settingsService.updateBatch({});

      expect(mockStore.set).not.toHaveBeenCalled();
    });

    it('should handle store errors gracefully', () => {
      mockStore.set.mockImplementation(() => {
        throw new Error('Store batch error');
      });

      expect(() => settingsService.updateBatch({ theme: 'dark' })).toThrow(ServiceError);
      expect(() => settingsService.updateBatch({ theme: 'dark' })).toThrow(
        'Settings updateBatch failed'
      );
    });
  });

  describe('reset (legacy method)', () => {
    beforeEach(() => {
      settingsService.initialize();
    });

    it('should call clear method', () => {
      const clearSpy = jest.spyOn(settingsService, 'clear');

      settingsService.reset();

      expect(clearSpy).toHaveBeenCalled();
    });
  });

  describe('cache management', () => {
    beforeEach(() => {
      settingsService.initialize();
    });

    it('should initialize cache with current settings', () => {
      mockStore.store = { theme: 'dark', telemetry: true };
      settingsService.initialize();

      // Cache should be populated, so get shouldn't call store
      mockStore.get.mockClear();
      settingsService.get('theme');

      expect(mockStore.get).not.toHaveBeenCalled();
    });

    it('should update cache when setting values', () => {
      settingsService.set('theme', 'light');

      // Should get cached value without calling store
      mockStore.get.mockClear();
      const value = settingsService.get('theme');

      expect(value).toBe('light');
      expect(mockStore.get).not.toHaveBeenCalled();
    });

    it('should invalidate cache when deleting values', () => {
      // Set a value first
      settingsService.set('theme', 'custom');
      mockStore.get.mockClear();

      // Delete should invalidate cache
      settingsService.delete('theme');

      // Next get should call store
      mockStore.get.mockReturnValue('default');
      settingsService.get('theme');

      expect(mockStore.get).toHaveBeenCalledWith('theme');
    });

    it('should clear cache when clearing all settings', () => {
      settingsService.set('theme', 'light' as const);
      settingsService.clear();

      // Cache should be cleared, settings should be reset to defaults
      expect(settingsService.getAll().theme).toBe(DEFAULT_SETTINGS.theme);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      settingsService.initialize();
    });

    it('should handle various error types in handleError', () => {
      const testError = new Error('Test error message');

      // Clear cache first so it calls the store
      (settingsService as any).cache.clear();

      mockStore.get.mockImplementation(() => {
        throw testError;
      });

      expect(() => settingsService.get('theme')).toThrow(ServiceError);
      expect(() => settingsService.get('theme')).toThrow('Settings get failed: Test error message');
    });

    it('should handle non-Error objects in handleError', () => {
      // Clear cache first so it calls the store
      (settingsService as any).cache.clear();

      mockStore.get.mockImplementation(() => {
        throw 'String error';
      });

      expect(() => settingsService.get('theme')).toThrow(ServiceError);
      expect(() => settingsService.get('theme')).toThrow('Settings get failed: Unknown error');
    });

    it('should include cause in ServiceError', () => {
      const originalError = new Error('Original error');

      mockStore.set.mockImplementation(() => {
        throw originalError;
      });

      try {
        settingsService.set('theme', 'dark');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceError);
        expect((error as ServiceError).cause).toBe(originalError);
      }
    });
  });
});
