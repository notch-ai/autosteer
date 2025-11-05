/**
 * Unit Tests for ApplicationContainer
 * Tests dependency injection container functionality with mocked services
 * Target: 80%+ coverage
 */

import { ApplicationContainer } from '@/services/ApplicationContainer';
import { SettingsService, ServiceError } from '@/services/SettingsService';
import { app } from 'electron';
import log from 'electron-log';

// Mock electron
jest.mock('electron', () => ({
  app: {
    getVersion: jest.fn(),
  },
}));

// Mock electron-log
jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock SettingsService
jest.mock('@/services/SettingsService', () => {
  class MockServiceError extends Error {
    constructor(message: string, options?: { cause?: unknown }) {
      super(message);
      this.name = 'ServiceError';
      if (options?.cause) {
        this.cause = options.cause;
      }
    }
  }

  return {
    SettingsService: jest.fn(),
    ServiceError: MockServiceError,
  };
});

const mockApp = app as jest.Mocked<typeof app>;
const MockSettingsService = SettingsService as jest.MockedClass<typeof SettingsService>;

describe('ApplicationContainer', () => {
  let applicationContainer: ApplicationContainer;
  let mockSettingsService: jest.Mocked<SettingsService>;

  beforeEach(() => {
    console.log('[ApplicationContainer Test] Setting up test environment');
    jest.clearAllMocks();

    // Create mock instance
    mockSettingsService = {
      initialize: jest.fn(),
    } as any;

    MockSettingsService.mockImplementation(() => mockSettingsService);

    applicationContainer = new ApplicationContainer();
  });

  afterEach(() => {
    console.log('[ApplicationContainer Test] Cleaning up test environment');
  });

  describe('initialize', () => {
    it('should initialize successfully', () => {
      console.log('[Test] Initializing ApplicationContainer successfully');
      applicationContainer.initialize();

      expect(MockSettingsService).toHaveBeenCalled();
      expect(mockSettingsService.initialize).toHaveBeenCalled();
      expect(log.info).toHaveBeenCalledWith('Initializing ApplicationContainer...');
      expect(log.info).toHaveBeenCalledWith('ApplicationContainer initialized successfully');
    });

    it('should not initialize twice', () => {
      console.log('[Test] Preventing double initialization');
      applicationContainer.initialize();
      applicationContainer.initialize();

      expect(MockSettingsService).toHaveBeenCalledTimes(1);
      expect(mockSettingsService.initialize).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith('ApplicationContainer already initialized');
    });

    it('should handle initialization errors', () => {
      console.log('[Test] Handling initialization errors');
      const error = new Error('Settings initialization failed');
      mockSettingsService.initialize.mockImplementation(() => {
        throw error;
      });

      expect(() => applicationContainer.initialize()).toThrow(ServiceError);
      expect(() => applicationContainer.initialize()).toThrow(
        'ApplicationContainer initialization failed'
      );
      expect(log.error).toHaveBeenCalledWith('Failed to initialize ApplicationContainer:', error);
    });

    it('should handle ServiceError during initialization', () => {
      console.log('[Test] Handling ServiceError during initialization');
      const serviceError = new ServiceError('Settings service failed');
      mockSettingsService.initialize.mockImplementation(() => {
        throw serviceError;
      });

      expect(() => applicationContainer.initialize()).toThrow(ServiceError);
      expect(log.error).toHaveBeenCalled();
    });
  });

  describe('getSettingsService', () => {
    it('should return settings service when initialized', () => {
      console.log('[Test] Getting settings service when initialized');
      applicationContainer.initialize();

      const service = applicationContainer.getSettingsService();

      expect(service).toBe(mockSettingsService);
    });

    it('should throw error when not initialized', () => {
      console.log('[Test] Throwing error when getting service before initialization');
      expect(() => applicationContainer.getSettingsService()).toThrow(ServiceError);
      expect(() => applicationContainer.getSettingsService()).toThrow(
        'ApplicationContainer not initialized'
      );
    });

    it('should allow multiple calls after initialization', () => {
      console.log('[Test] Allowing multiple getSettingsService calls');
      applicationContainer.initialize();

      const service1 = applicationContainer.getSettingsService();
      const service2 = applicationContainer.getSettingsService();

      expect(service1).toBe(service2);
      expect(service1).toBe(mockSettingsService);
    });
  });

  describe('getAppVersion', () => {
    it('should return app version', () => {
      console.log('[Test] Getting app version');
      mockApp.getVersion.mockReturnValue('1.0.0');

      const version = applicationContainer.getAppVersion();

      expect(version).toBe('1.0.0');
      expect(mockApp.getVersion).toHaveBeenCalled();
    });

    it('should return correct version for different values', () => {
      console.log('[Test] Getting different app versions');
      mockApp.getVersion.mockReturnValue('2.5.3');

      const version = applicationContainer.getAppVersion();

      expect(version).toBe('2.5.3');
    });

    it('should not require initialization', () => {
      console.log('[Test] Getting app version without initialization');
      mockApp.getVersion.mockReturnValue('1.0.0');

      expect(() => applicationContainer.getAppVersion()).not.toThrow();
      expect(applicationContainer.getAppVersion()).toBe('1.0.0');
    });
  });

  describe('cleanup', () => {
    it('should cleanup successfully', () => {
      console.log('[Test] Cleaning up successfully');
      expect(() => applicationContainer.cleanup()).not.toThrow();
      expect(log.info).toHaveBeenCalledWith('Cleaning up ApplicationContainer...');
    });

    it('should cleanup after initialization', () => {
      console.log('[Test] Cleaning up after initialization');
      applicationContainer.initialize();
      expect(() => applicationContainer.cleanup()).not.toThrow();
    });

    it('should be safe to call multiple times', () => {
      console.log('[Test] Ensuring cleanup is idempotent');
      applicationContainer.cleanup();
      applicationContainer.cleanup();

      expect(log.info).toHaveBeenCalledTimes(2);
    });
  });

  describe('ensureInitialized', () => {
    it('should not throw when initialized', () => {
      console.log('[Test] Not throwing when initialized');
      applicationContainer.initialize();

      expect(() => applicationContainer.getSettingsService()).not.toThrow();
    });

    it('should throw when not initialized', () => {
      console.log('[Test] Throwing when not initialized');
      expect(() => applicationContainer.getSettingsService()).toThrow(ServiceError);
    });
  });

  describe('integration scenarios', () => {
    it('should handle full lifecycle: initialize -> use -> cleanup', () => {
      console.log('[Test] Testing full lifecycle');
      mockApp.getVersion.mockReturnValue('1.0.0');

      // Initialize
      applicationContainer.initialize();
      expect(mockSettingsService.initialize).toHaveBeenCalled();

      // Use services
      const settings = applicationContainer.getSettingsService();
      expect(settings).toBe(mockSettingsService);

      const version = applicationContainer.getAppVersion();
      expect(version).toBe('1.0.0');

      // Cleanup
      applicationContainer.cleanup();
      expect(log.info).toHaveBeenCalledWith('Cleaning up ApplicationContainer...');
    });

    it('should handle reinitialization after cleanup', () => {
      console.log('[Test] Reinitializing after cleanup');
      applicationContainer.initialize();
      applicationContainer.cleanup();

      // ApplicationContainer prevents double initialization
      // So it won't create a new SettingsService instance
      applicationContainer.initialize();
      expect(log.warn).toHaveBeenCalledWith('ApplicationContainer already initialized');
      expect(MockSettingsService).toHaveBeenCalledTimes(1); // Still only called once
    });
  });
});
