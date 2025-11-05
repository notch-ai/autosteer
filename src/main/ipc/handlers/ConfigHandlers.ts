import { IpcMainInvokeEvent } from 'electron';
import { FileDataStoreService } from '@/services/FileDataStoreService';
import { AutosteerConfig, CustomCommand } from '@/types/config.types';
import { mainLogger } from '../../services/logger';
import { registerSafeHandler } from '../safeHandlerWrapper';

/**
 * ConfigHandlers class
 * Handles all IPC communication for application configuration management including settings,
 * API keys, custom commands, and project directory configuration.
 *
 * @remarks
 * This handler manages persistent configuration stored in two files:
 * - ~/.autosteer/config.json: User settings, API keys, custom commands, worktrees, agents
 * - ~/.autosteer/app.json: Application-level settings like project directory
 *
 * Key responsibilities:
 * - Configuration file read/write operations
 * - Settings management (vimMode, devMode, etc.)
 * - API key secure storage and retrieval
 * - Custom command CRUD operations
 * - Project directory configuration and validation
 * - Configuration section access utilities
 *
 * @example
 * ```typescript
 * const handlers = new ConfigHandlers(ipcMain);
 * handlers.register();
 * ```
 */
export class ConfigHandlers {
  private fileDataStore: FileDataStoreService;

  constructor() {
    this.fileDataStore = FileDataStoreService.getInstance();
  }

  /**
   * Register all IPC handlers for configuration operations
   * Sets up listeners for config read/write, settings management, API keys, and custom commands
   *
   * @remarks
   * Registered IPC channels:
   * - config:read: Read entire configuration file
   * - config:updateSettings: Update settings section (vimMode, etc.)
   * - config:setApiKey: Store API key for a service
   * - config:removeApiKey: Remove API key for a service
   * - config:clearApiKeys: Clear all stored API keys
   * - config:addCustomCommand: Add a new custom command
   * - config:updateCustomCommand: Update existing custom command
   * - config:removeCustomCommand: Remove a custom command
   * - config:clearCustomCommands: Clear all custom commands
   * - config:getSection: Get a specific configuration section
   * - config:getDevMode: Get development mode setting
   * - config:setDevMode: Set development mode and update logger
   * - config:setSection: Set a specific configuration section
   * - config:getProjectDirectory: Get project directory from app.json
   * - config:setProjectDirectory: Set and validate project directory
   *
   * @public
   */
  register(): void {
    // Read entire config file
    registerSafeHandler(
      'config:read',
      async (): Promise<AutosteerConfig> => {
        return await this.fileDataStore.readConfig();
      },
      { operationName: 'read config' }
    );

    // Update settings section in config
    registerSafeHandler(
      'config:updateSettings',
      async (_event: IpcMainInvokeEvent, updates: Record<string, any>): Promise<void> => {
        const config = await this.fileDataStore.readConfig();

        // Initialize settings if they don't exist
        if (!config.settings) {
          config.settings = {};
        }

        // Merge updates into settings
        config.settings = { ...config.settings, ...updates };

        await this.fileDataStore.writeConfig(config);
      },
      { operationName: 'update settings' }
    );

    // Set API key
    registerSafeHandler(
      'config:setApiKey',
      async (_event: IpcMainInvokeEvent, service: string, key: string): Promise<void> => {
        const config = await this.fileDataStore.readConfig();

        // Initialize apiKeys if they don't exist
        if (!config.apiKeys) {
          config.apiKeys = {};
        }

        config.apiKeys[service] = key;

        await this.fileDataStore.writeConfig(config);
      },
      { operationName: 'set api key' }
    );

    // Remove API key
    registerSafeHandler(
      'config:removeApiKey',
      async (_event: IpcMainInvokeEvent, service: string): Promise<void> => {
        const config = await this.fileDataStore.readConfig();

        if (config.apiKeys && config.apiKeys[service]) {
          delete config.apiKeys[service];
          await this.fileDataStore.writeConfig(config);
        }
      },
      { operationName: 'remove api key' }
    );

    // Clear all API keys
    registerSafeHandler(
      'config:clearApiKeys',
      async (_event: IpcMainInvokeEvent): Promise<void> => {
        const config = await this.fileDataStore.readConfig();
        config.apiKeys = {};
        await this.fileDataStore.writeConfig(config);
      },
      { operationName: 'clear api keys' }
    );

    // Add custom command
    registerSafeHandler(
      'config:addCustomCommand',
      async (_event: IpcMainInvokeEvent, command: CustomCommand): Promise<void> => {
        const config = await this.fileDataStore.readConfig();

        // Initialize customCommands if they don't exist
        if (!config.customCommands) {
          config.customCommands = [];
        }

        config.customCommands.push(command);

        await this.fileDataStore.writeConfig(config);
      },
      { operationName: 'add custom command' }
    );

    // Update custom command
    registerSafeHandler(
      'config:updateCustomCommand',
      async (
        _event: IpcMainInvokeEvent,
        id: string,
        updatedCommand: CustomCommand
      ): Promise<void> => {
        const config = await this.fileDataStore.readConfig();

        if (!config.customCommands) {
          throw new Error('No custom commands exist');
        }

        const commandIndex = config.customCommands.findIndex((cmd) => cmd.id === id);
        if (commandIndex === -1) {
          throw new Error('Custom command not found');
        }

        config.customCommands[commandIndex] = updatedCommand;

        await this.fileDataStore.writeConfig(config);
      },
      { operationName: 'update custom command' }
    );

    // Remove custom command
    registerSafeHandler(
      'config:removeCustomCommand',
      async (_event: IpcMainInvokeEvent, id: string): Promise<void> => {
        const config = await this.fileDataStore.readConfig();

        if (config.customCommands) {
          config.customCommands = config.customCommands.filter((cmd) => cmd.id !== id);
          await this.fileDataStore.writeConfig(config);
        }
      },
      { operationName: 'remove custom command' }
    );

    // Clear all custom commands
    registerSafeHandler(
      'config:clearCustomCommands',
      async (_event: IpcMainInvokeEvent): Promise<void> => {
        const config = await this.fileDataStore.readConfig();
        config.customCommands = [];
        await this.fileDataStore.writeConfig(config);
      },
      { operationName: 'clear custom commands' }
    );

    // Get config section (utility method for future use)
    registerSafeHandler(
      'config:getSection',
      async (_event: IpcMainInvokeEvent, section: keyof AutosteerConfig): Promise<any> => {
        const config = await this.fileDataStore.readConfig();
        return config[section];
      },
      { operationName: 'get config section' }
    );

    // Get dev mode setting
    registerSafeHandler(
      'config:getDevMode',
      async (): Promise<boolean> => {
        const config = await this.fileDataStore.readConfig();
        return config.settings?.devMode || false;
      },
      { operationName: 'get dev mode' }
    );

    // Set dev mode setting and update logger
    registerSafeHandler(
      'config:setDevMode',
      async (_event: IpcMainInvokeEvent, enabled: boolean): Promise<void> => {
        const config = await this.fileDataStore.readConfig();

        if (!config.settings) {
          config.settings = {};
        }

        config.settings.devMode = enabled;
        await this.fileDataStore.writeConfig(config);

        mainLogger.setDevelopmentMode(enabled);
      },
      { operationName: 'set dev mode' }
    );

    // Set config section (utility method for future use)
    registerSafeHandler(
      'config:setSection',
      async (
        _event: IpcMainInvokeEvent,
        section: keyof AutosteerConfig,
        value: any
      ): Promise<void> => {
        const config = await this.fileDataStore.readConfig();
        (config as any)[section] = value;
        await this.fileDataStore.writeConfig(config);
      },
      { operationName: 'set config section' }
    );

    // Get project directory setting (from app.json)
    registerSafeHandler(
      'config:getProjectDirectory',
      async (): Promise<string> => {
        const appConfig = await this.fileDataStore.readAppConfig();
        return appConfig.projectDirectory || this.fileDataStore.getDataDirectory();
      },
      { operationName: 'get project directory' }
    );

    // Set project directory setting (saves to app.json)
    registerSafeHandler(
      'config:setProjectDirectory',
      async (
        _event: IpcMainInvokeEvent,
        directory: string
      ): Promise<{ success: boolean; error?: string }> => {
        const path = await import('path');
        const fs = await import('fs/promises');
        const { app } = await import('electron');

        let expandedPath = directory.trim();

        // Expand ~ to user's home directory
        if (expandedPath.startsWith('~/')) {
          const homeDir = app.getPath('home');
          expandedPath = path.join(homeDir, expandedPath.slice(2));
        }

        // Check if directory exists
        try {
          const stats = await fs.stat(expandedPath);
          if (!stats.isDirectory()) {
            return {
              success: false,
              error: `Path "${expandedPath}" is not a directory`,
            };
          }
        } catch (error) {
          return {
            success: false,
            error: `Directory "${expandedPath}" does not exist. Please create it first.`,
          };
        }

        // Write to app.json (always at ~/.autosteer/app.json)
        const appConfig = await this.fileDataStore.readAppConfig();
        appConfig.projectDirectory = expandedPath;
        await this.fileDataStore.writeAppConfig(appConfig);

        // Update the FileDataStoreService to use the new directory
        this.fileDataStore.setDataDirectory(expandedPath);

        return { success: true };
      },
      { operationName: 'set project directory' }
    );
  }
}
