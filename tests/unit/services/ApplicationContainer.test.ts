import { ApplicationContainer } from '@/services/ApplicationContainer';
import { SettingsService, ServiceError } from '@/services/SettingsService';
import { app } from 'electron';

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
    jest.clearAllMocks();

    // Create mock instance
    mockSettingsService = {
      initialize: jest.fn(),
    } as any;

    MockSettingsService.mockImplementation(() => mockSettingsService);

    applicationContainer = new ApplicationContainer();
  });

  describe('initialize', () => {
    it('should initialize successfully', () => {
      applicationContainer.initialize();

      expect(MockSettingsService).toHaveBeenCalled();
      expect(mockSettingsService.initialize).toHaveBeenCalled();
    });

    it('should not initialize twice', () => {
      applicationContainer.initialize();
      applicationContainer.initialize();

      expect(MockSettingsService).toHaveBeenCalledTimes(1);
      expect(mockSettingsService.initialize).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors', () => {
      const error = new Error('Settings initialization failed');
      mockSettingsService.initialize.mockImplementation(() => {
        throw error;
      });

      expect(() => applicationContainer.initialize()).toThrow(ServiceError);
      expect(() => applicationContainer.initialize()).toThrow(
        'ApplicationContainer initialization failed'
      );
    });
  });

  describe('getSettingsService', () => {
    it('should return settings service when initialized', () => {
      applicationContainer.initialize();

      const service = applicationContainer.getSettingsService();

      expect(service).toBe(mockSettingsService);
    });

    it('should throw error when not initialized', () => {
      expect(() => applicationContainer.getSettingsService()).toThrow(ServiceError);
      expect(() => applicationContainer.getSettingsService()).toThrow(
        'ApplicationContainer not initialized'
      );
    });
  });

  describe('getAppVersion', () => {
    it('should return app version', () => {
      mockApp.getVersion.mockReturnValue('1.0.0');

      const version = applicationContainer.getAppVersion();

      expect(version).toBe('1.0.0');
      expect(mockApp.getVersion).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should cleanup successfully', () => {
      expect(() => applicationContainer.cleanup()).not.toThrow();
    });
  });

  describe('ensureInitialized', () => {
    it('should not throw when initialized', () => {
      applicationContainer.initialize();

      expect(() => applicationContainer.getSettingsService()).not.toThrow();
    });

    it('should throw when not initialized', () => {
      expect(() => applicationContainer.getSettingsService()).toThrow(ServiceError);
    });
  });
});
