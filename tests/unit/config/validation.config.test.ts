/**
 * Unit tests for validation configuration
 *
 * @remarks
 * Tests environment-based validation toggling for production runtime optimization
 */

describe('ValidationConfig', () => {
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    // Save original NODE_ENV
    originalNodeEnv = process.env.NODE_ENV;

    // Clear module cache to ensure fresh config loading
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original NODE_ENV
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  describe('Environment Detection', () => {
    it('should detect development environment', () => {
      process.env.NODE_ENV = 'development';
      const { getValidationConfig } = require('@/config/validation.config');
      const config = getValidationConfig();

      expect(config.isDevelopment).toBe(true);
      expect(config.isProduction).toBe(false);
    });

    it('should detect production environment', () => {
      process.env.NODE_ENV = 'production';
      const { getValidationConfig } = require('@/config/validation.config');
      const config = getValidationConfig();

      expect(config.isDevelopment).toBe(false);
      expect(config.isProduction).toBe(true);
    });

    it('should default to development when NODE_ENV is undefined', () => {
      delete process.env.NODE_ENV;
      const { getValidationConfig } = require('@/config/validation.config');
      const config = getValidationConfig();

      expect(config.isDevelopment).toBe(true);
      expect(config.isProduction).toBe(false);
    });

    it('should treat test environment as development', () => {
      process.env.NODE_ENV = 'test';
      const { getValidationConfig } = require('@/config/validation.config');
      const config = getValidationConfig();

      expect(config.isDevelopment).toBe(true);
      expect(config.isProduction).toBe(false);
    });
  });

  describe('Validation Enablement', () => {
    it('should enable validation in development', () => {
      process.env.NODE_ENV = 'development';
      const { getValidationConfig } = require('@/config/validation.config');
      const config = getValidationConfig();

      expect(config.enableValidation).toBe(true);
    });

    it('should disable validation in production', () => {
      process.env.NODE_ENV = 'production';
      const { getValidationConfig } = require('@/config/validation.config');
      const config = getValidationConfig();

      expect(config.enableValidation).toBe(false);
    });

    it('should enable validation in test environment', () => {
      process.env.NODE_ENV = 'test';
      const { getValidationConfig } = require('@/config/validation.config');
      const config = getValidationConfig();

      expect(config.enableValidation).toBe(true);
    });
  });

  describe('Configuration Singleton', () => {
    it('should return same config instance on multiple calls', () => {
      process.env.NODE_ENV = 'development';
      const { getValidationConfig } = require('@/config/validation.config');

      const config1 = getValidationConfig();
      const config2 = getValidationConfig();

      expect(config1).toBe(config2);
    });

    it('should cache config values after first load', () => {
      process.env.NODE_ENV = 'development';
      const { getValidationConfig } = require('@/config/validation.config');

      getValidationConfig();

      // Change NODE_ENV after first load
      process.env.NODE_ENV = 'production';

      const config2 = getValidationConfig();

      // Should still return cached development config
      expect(config2.isDevelopment).toBe(true);
      expect(config2.enableValidation).toBe(true);
    });
  });

  describe('Helper Functions', () => {
    it('should provide isValidationEnabled function', () => {
      process.env.NODE_ENV = 'development';
      const { isValidationEnabled } = require('@/config/validation.config');

      expect(isValidationEnabled()).toBe(true);
    });

    it('should return correct validation status in production', () => {
      process.env.NODE_ENV = 'production';
      const { isValidationEnabled } = require('@/config/validation.config');

      expect(isValidationEnabled()).toBe(false);
    });
  });

  describe('Configuration Structure', () => {
    it('should expose all required configuration properties', () => {
      process.env.NODE_ENV = 'development';
      const { getValidationConfig } = require('@/config/validation.config');
      const config = getValidationConfig();

      expect(config).toHaveProperty('isDevelopment');
      expect(config).toHaveProperty('isProduction');
      expect(config).toHaveProperty('enableValidation');
      expect(config).toHaveProperty('environment');
    });

    it('should include environment string value', () => {
      process.env.NODE_ENV = 'production';
      const { getValidationConfig } = require('@/config/validation.config');
      const config = getValidationConfig();

      expect(config.environment).toBe('production');
    });
  });
});
