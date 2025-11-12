/**
 * Validation configuration for conditional validation
 *
 * @remarks
 * This configuration enables/disables validation based on the environment:
 * - Development: Validation enabled for early warning and debugging
 * - Production: Validation disabled for performance optimization
 *
 * @example
 * ```typescript
 * import { isValidationEnabled } from '@/config/validation.config';
 *
 * if (isValidationEnabled()) {
 *   // Perform validation
 *   validateData(input);
 * }
 * ```
 */

import { logger } from '@/commons/utils/logger';

/**
 * Validation configuration interface
 */
export interface ValidationConfig {
  /**
   * Whether the app is running in development mode
   */
  isDevelopment: boolean;

  /**
   * Whether the app is running in production mode
   */
  isProduction: boolean;

  /**
   * Whether validation should be enabled
   * - true in development/test for early warnings
   * - false in production for performance
   */
  enableValidation: boolean;

  /**
   * Current environment name
   */
  environment: string;
}

/**
 * Load validation configuration from environment
 *
 * @remarks
 * Environment mode values:
 * - Main process: Uses process.env.NODE_ENV
 * - Renderer process: Uses import.meta.env.MODE
 * - 'production' → validation disabled
 * - 'development' → validation enabled
 * - 'test' → validation enabled
 * - undefined → defaults to development (validation enabled)
 */
function loadValidationConfig(): ValidationConfig {
  // Support both main process (Node.js/Jest) and renderer process (Vite)
  // Use process.env for all environments (works in Node, Jest, and Vite)
  const nodeEnv = (typeof process !== 'undefined' && process.env?.NODE_ENV) || 'development';
  const isDevelopment = nodeEnv !== 'production';
  const isProduction = nodeEnv === 'production';

  const config: ValidationConfig = {
    isDevelopment,
    isProduction,
    enableValidation: isDevelopment,
    environment: nodeEnv,
  };

  return config;
}

/**
 * Cached validation configuration (singleton)
 */
let cachedConfig: ValidationConfig | null = null;

/**
 * Get validation configuration (singleton)
 *
 * @remarks
 * Configuration is loaded once at startup and cached for performance.
 * The cached config is reused for all subsequent calls.
 *
 * @returns Validation configuration object
 */
export function getValidationConfig(): ValidationConfig {
  if (!cachedConfig) {
    cachedConfig = loadValidationConfig();
    logger.debug('[ValidationConfig] Configuration loaded:', {
      environment: cachedConfig.environment,
      enableValidation: cachedConfig.enableValidation,
    });
  }
  return cachedConfig;
}

/**
 * Check if validation is enabled
 *
 * @remarks
 * Convenience function that returns the validation enablement status.
 * Use this function in conditional validation checks.
 *
 * @returns true if validation is enabled, false otherwise
 *
 * @example
 * ```typescript
 * if (isValidationEnabled()) {
 *   // Perform validation
 *   const result = validateInput(data);
 *   if (!result.valid) {
 *     logger.warn('[Handler] Validation failed:', result.errors);
 *   }
 * }
 * ```
 */
export function isValidationEnabled(): boolean {
  return getValidationConfig().enableValidation;
}
