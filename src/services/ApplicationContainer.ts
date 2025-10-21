import { app } from 'electron';
import { SettingsService, ServiceError } from '@/services/SettingsService';
import log from 'electron-log';

export class ApplicationContainer {
  private settingsService!: SettingsService;
  private initialized = false;

  initialize(): void {
    if (this.initialized) {
      log.warn('ApplicationContainer already initialized');
      return;
    }

    try {
      log.info('Initializing ApplicationContainer...');

      // Initialize consolidated services (no repository dependencies)
      this.settingsService = new SettingsService();
      this.settingsService.initialize();

      this.initialized = true;
      log.info('ApplicationContainer initialized successfully');
    } catch (error) {
      log.error('Failed to initialize ApplicationContainer:', error);
      throw new ServiceError('ApplicationContainer initialization failed', { cause: error });
    }
  }

  cleanup(): void {
    log.info('Cleaning up ApplicationContainer...');
    // Add any cleanup logic here
  }

  getSettingsService(): SettingsService {
    this.ensureInitialized();
    return this.settingsService;
  }

  getAppVersion(): string {
    return app.getVersion();
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new ServiceError('ApplicationContainer not initialized. Call initialize() first.');
    }
  }
}
