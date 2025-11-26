/**
 * Application settings and configuration
 * SINGLE SOURCE OF TRUTH for all environment variables
 * All process.env access MUST happen in this file only
 */

import { logger } from '@/commons/utils/logger';

// ============================================================================
// INTERFACES
// ============================================================================

export interface AppSettings {
  claudeCodeMode: 'local' | 'api';
  aiServiceUrl: string;
}

export interface FetchTraceSettings {
  enabled: boolean;
  includes: string[];
  excludes: string[];
  debug: boolean;
  cwd: string | undefined;
  sessionId: string | undefined;
  timestamp: string | undefined;
}

export interface FetchCacheSettings {
  enabled: boolean;
  maxSize: number;
  ttl: number; // in seconds
  ttlMs: number; // in milliseconds (computed)
  ignoreHeaders: boolean;
  persistenceEnabled: boolean;
  includes: string[];
  excludes: string[];
}

export interface DevSettings {
  openDevTools: boolean;
}

export interface AllSettings {
  app: AppSettings;
  fetchTrace: FetchTraceSettings;
  fetchCache: FetchCacheSettings;
  dev: DevSettings;
}

// ============================================================================
// ENVIRONMENT VARIABLE PARSING (ONLY PLACE WHERE process.env IS ACCESSED)
// ============================================================================

/**
 * Parse boolean environment variable
 */
function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value === 'true';
}

/**
 * Parse integer environment variable
 */
function parseInt(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse comma-separated list
 */
function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Load all settings from environment variables
 * This is the ONLY function that accesses process.env
 */
function loadSettings(): AllSettings {
  const settings: AllSettings = {
    // App settings
    app: {
      claudeCodeMode: (process.env.CLAUDE_CODE_MODE as 'local' | 'api') || 'local',
      aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8001',
    },

    // Fetch trace settings
    fetchTrace: {
      enabled: parseBool(process.env.FETCH_TRACE_ENABLED, false),
      includes: parseList(process.env.FETCH_TRACE_INCLUDES),
      excludes: parseList(process.env.FETCH_TRACE_EXCLUDES),
      debug: parseBool(process.env.FETCH_TRACE_DEBUG, false),
      cwd: process.env.FETCH_TRACE_CWD,
      sessionId: process.env.FETCH_TRACE_SESSION_ID,
      timestamp: process.env.FETCH_TRACE_TIMESTAMP,
    },

    // Fetch cache settings
    fetchCache: {
      enabled: parseBool(process.env.FETCH_CACHE_ENABLED, false),
      maxSize: parseInt(process.env.FETCH_CACHE_MAX_SIZE, 1000),
      ttl: parseInt(process.env.FETCH_CACHE_TTL, 21600), // 6 hours in seconds
      ttlMs: 0, // computed below
      ignoreHeaders: parseBool(process.env.FETCH_CACHE_IGNORE_HEADERS, true),
      persistenceEnabled: parseBool(process.env.FETCH_CACHE_PERSISTENCE_ENABLED, true),
      includes: parseList(process.env.FETCH_CACHE_INCLUDES),
      excludes: parseList(process.env.FETCH_CACHE_EXCLUDES),
    },

    // Dev settings
    dev: {
      openDevTools: parseBool(process.env.OPEN_DEV_TOOLS, false),
    },
  };

  // Compute TTL in milliseconds
  settings.fetchCache.ttlMs = settings.fetchCache.ttl * 1000;

  return settings;
}

// ============================================================================
// SINGLETON SETTINGS INSTANCE
// ============================================================================

let cachedSettings: AllSettings | null = null;

/**
 * Get application settings (singleton)
 * Settings are loaded once and cached
 */
export function getSettings(): AllSettings {
  if (!cachedSettings) {
    cachedSettings = loadSettings();
  }
  return cachedSettings;
}

/**
 * Get app-specific settings
 */
export function getAppSettings(): AppSettings {
  return getSettings().app;
}

/**
 * Get fetch trace settings
 */
export function getFetchTraceSettings(): FetchTraceSettings {
  return getSettings().fetchTrace;
}

/**
 * Get fetch cache settings
 */
export function getFetchCacheSettings(): FetchCacheSettings {
  return getSettings().fetchCache;
}

/**
 * Get dev settings
 */
export function getDevSettings(): DevSettings {
  return getSettings().dev;
}

/**
 * Update runtime settings (for passing to subprocess)
 */
export function updateRuntimeSettings(updates: {
  cwd?: string;
  sessionId?: string;
  timestamp?: string;
}): void {
  const settings = getSettings();
  if (updates.cwd !== undefined) {
    settings.fetchTrace.cwd = updates.cwd;
  }
  if (updates.sessionId !== undefined) {
    settings.fetchTrace.sessionId = updates.sessionId;
  }
  if (updates.timestamp !== undefined) {
    settings.fetchTrace.timestamp = updates.timestamp;
  }
}

/**
 * Get current NODE_OPTIONS from environment
 * This is needed to preserve existing Node.js runtime flags when spawning subprocesses
 */
export function getNodeOptions(): string {
  return process.env.NODE_OPTIONS || '';
}

/**
 * Get settings as environment variables (for subprocess)
 */
export function getSettingsAsEnv(): Record<string, string> {
  const settings = getSettings();

  return {
    // App settings
    CLAUDE_CODE_MODE: settings.app.claudeCodeMode,
    AI_SERVICE_URL: settings.app.aiServiceUrl,

    // Fetch trace settings
    FETCH_TRACE_ENABLED: settings.fetchTrace.enabled.toString(),
    FETCH_TRACE_INCLUDES: settings.fetchTrace.includes.join(','),
    FETCH_TRACE_EXCLUDES: settings.fetchTrace.excludes.join(','),
    FETCH_TRACE_DEBUG: settings.fetchTrace.debug.toString(),
    ...(settings.fetchTrace.cwd && { FETCH_TRACE_CWD: settings.fetchTrace.cwd }),
    ...(settings.fetchTrace.sessionId && { FETCH_TRACE_SESSION_ID: settings.fetchTrace.sessionId }),
    ...(settings.fetchTrace.timestamp && { FETCH_TRACE_TIMESTAMP: settings.fetchTrace.timestamp }),

    // Fetch cache settings
    FETCH_CACHE_ENABLED: settings.fetchCache.enabled.toString(),
    FETCH_CACHE_MAX_SIZE: settings.fetchCache.maxSize.toString(),
    FETCH_CACHE_TTL: settings.fetchCache.ttl.toString(),
    FETCH_CACHE_IGNORE_HEADERS: settings.fetchCache.ignoreHeaders.toString(),
    FETCH_CACHE_PERSISTENCE_ENABLED: settings.fetchCache.persistenceEnabled.toString(),
    FETCH_CACHE_INCLUDES: settings.fetchCache.includes.join(','),
    FETCH_CACHE_EXCLUDES: settings.fetchCache.excludes.join(','),
  };
}

/**
 * Log settings at application startup
 */
export function logSettingsAtStartup(): void {
  const settings = getSettings();

  logger.info('[Settings] Application configuration loaded:');
  logger.info('[Settings] Environment:', {
    userDataDir: process.env.ELECTRON_USER_DATA_DIR || 'default',
    vitePort: process.env.VITE_PORT || '5173 (auto-detect)',
    viteDevServerUrl: process.env.VITE_DEV_SERVER_URL || 'not set',
  });
  logger.info('[Settings] App:', {
    claudeCodeMode: settings.app.claudeCodeMode,
    aiServiceUrl: settings.app.aiServiceUrl,
  });
  logger.info('[Settings] Fetch Trace:', {
    enabled: settings.fetchTrace.enabled,
    includes: settings.fetchTrace.includes,
    excludes: settings.fetchTrace.excludes,
    debug: settings.fetchTrace.debug,
  });
  logger.info('[Settings] Fetch Cache:', {
    enabled: settings.fetchCache.enabled,
    maxSize: settings.fetchCache.maxSize,
    ttlSeconds: settings.fetchCache.ttl,
    ttlMs: settings.fetchCache.ttlMs,
    persistenceEnabled: settings.fetchCache.persistenceEnabled,
    includes: settings.fetchCache.includes,
    excludes: settings.fetchCache.excludes,
  });
  logger.info('[Settings] Dev:', {
    openDevTools: settings.dev.openDevTools,
  });
}

// Default export for backward compatibility
export const DEFAULT_SETTINGS: AppSettings = {
  claudeCodeMode: 'local',
  aiServiceUrl: 'http://localhost:8001',
};
