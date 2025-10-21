import Store from 'electron-store';
import { Settings, DEFAULT_SETTINGS } from '@/entities/Settings';
import log from 'electron-log';

// Enhanced ServiceError class for consistent error handling
export class ServiceError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    options: {
      code?: string;
      cause?: unknown;
      context?: Record<string, unknown>;
    } = {}
  ) {
    super(message);
    this.name = 'ServiceError';
    this.code = options.code || 'SERVICE_ERROR';
    this.context = options.context || {};
    this.timestamp = new Date();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ServiceError);
    }

    if (options.cause) {
      this.cause = options.cause;
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

export class SettingsService {
  private store: Store;
  private settings: Settings = DEFAULT_SETTINGS;
  private initialized = false;
  // Service-level caching for frequently accessed settings
  private cache = new Map<string, { value: any; timestamp: number }>();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  constructor() {
    // Direct electron-store instantiation (consolidation)
    const options: Store.Options<Record<string, unknown>> = {
      name: 'settings',
      defaults: {},
    };

    if (process.env.NODE_ENV === 'production') {
      options.encryptionKey = 'autosteer-settings-key';
    }

    this.store = new Store(options);
  }

  initialize(): void {
    try {
      const savedSettings = this.store.store;
      // Only pick known properties from saved settings to avoid legacy properties
      const cleanedSettings: Partial<Settings> = {};
      const knownKeys = Object.keys(DEFAULT_SETTINGS) as Array<keyof Settings>;

      for (const key of knownKeys) {
        if (key in savedSettings) {
          (cleanedSettings as any)[key] = savedSettings[key];
        }
      }

      this.settings = { ...DEFAULT_SETTINGS, ...cleanedSettings };

      // Initialize cache with current settings
      this.initializeCache();

      this.initialized = true;
      log.info('Settings loaded:', this.settings);
    } catch (error) {
      log.error('Failed to load settings, using defaults:', error);
      this.settings = DEFAULT_SETTINGS;
      this.handleError('initialize', error);
    }
  }

  get<T = unknown>(key: string): T | undefined {
    try {
      this.ensureInitialized();

      // Check cache first for performance
      const cached = this.getFromCache(key);
      if (cached !== null) {
        return cached as T;
      }

      // Direct store access (consolidated)
      const value = this.store.get(key) as T | undefined;

      if (value !== undefined) {
        this.updateCache(key, value);
      }

      return value;
    } catch (error) {
      return this.handleError('get', error);
    }
  }

  set<T = unknown>(key: string, value: T): void {
    try {
      this.ensureInitialized();

      // Direct store access (consolidated)
      this.store.set(key, value);

      // Update local cache if it's a known setting
      if (key in this.settings) {
        (this.settings as unknown as Record<string, unknown>)[key] = value;
      }

      // Update cache
      this.updateCache(key, value);

      log.debug('Setting updated successfully', { key, valueType: typeof value });
    } catch (error) {
      return this.handleError('set', error);
    }
  }

  delete(key: string): void {
    try {
      this.ensureInitialized();
      this.store.delete(key);
      this.invalidateCache(key);

      // Reset to default if it's a known setting
      if (key in DEFAULT_SETTINGS) {
        const defaultValue = (DEFAULT_SETTINGS as any)[key];
        (this.settings as any)[key] = defaultValue;
      }
    } catch (error) {
      return this.handleError('delete', error);
    }
  }

  clear(): void {
    try {
      this.store.clear();
      this.settings = DEFAULT_SETTINGS;
      this.cache.clear();

      // Save default settings
      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        this.store.set(key, value);
      }

      log.info('Settings cleared and reset to defaults');
    } catch (error) {
      return this.handleError('clear', error);
    }
  }

  has(key: string): boolean {
    try {
      this.ensureInitialized();
      return this.store.has(key);
    } catch (error) {
      log.error(`Failed to check setting existence: ${key}`, error);
      return false;
    }
  }

  getAll(): Settings {
    this.ensureInitialized();
    return { ...this.settings };
  }

  // Enhanced batch operations
  updateBatch(updates: Partial<Settings>): void {
    try {
      this.ensureInitialized();

      for (const [key, value] of Object.entries(updates)) {
        this.store.set(key, value);
        this.updateCache(key, value);

        if (key in this.settings) {
          (this.settings as any)[key] = value;
        }
      }

      log.info('Batch settings update completed', { updateCount: Object.keys(updates).length });
    } catch (error) {
      return this.handleError('updateBatch', error);
    }
  }

  // Legacy method for backward compatibility
  reset(): void {
    this.clear();
  }

  // Cache management methods
  private initializeCache(): void {
    for (const [key, value] of Object.entries(this.settings)) {
      this.updateCache(key, value);
    }
  }

  private updateCache(key: string, value: any): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  private getFromCache(key: string): unknown {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.value;
  }

  private invalidateCache(key: string): void {
    this.cache.delete(key);
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new ServiceError('SettingsService not initialized. Call initialize() first.');
    }
  }

  private handleError(operation: string, error: unknown): never {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error(`SettingsService.${operation} failed`, {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new ServiceError(`Settings ${operation} failed: ${errorMessage}`, { cause: error });
  }
}
