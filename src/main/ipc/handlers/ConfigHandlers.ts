import { IpcMain, IpcMainInvokeEvent } from 'electron';
import { FileDataStoreService } from '@/services/FileDataStoreService';
import { ErrorHandler } from '../../utils/errorHandler';
import { AutosteerConfig, CustomCommand } from '@/types/config.types';
import { mainLogger } from '../../services/logger';

/**
 * ConfigHandlers - IPC handlers for configuration management
 *
 * Handles all config-related IPC calls for the SettingsStore.
 * All operations are performed on ~/.autosteer/config.json via FileDataStoreService.
 */
export class ConfigHandlers {
  private fileDataStore: FileDataStoreService;

  constructor(private ipcMain: IpcMain) {
    this.fileDataStore = FileDataStoreService.getInstance();
  }

  register(): void {
    // Read entire config file
    this.ipcMain.handle('config:read', async (): Promise<AutosteerConfig> => {
      try {
        return await this.fileDataStore.readConfig();
      } catch (error) {
        ErrorHandler.log({
          operation: 'read config',
          error,
        });
        // Return default config on error
        return {
          worktrees: [],
          settings: { vimMode: false },
        };
      }
    });

    // Update settings section in config
    this.ipcMain.handle(
      'config:updateSettings',
      async (_event: IpcMainInvokeEvent, updates: Record<string, any>): Promise<void> => {
        try {
          const config = await this.fileDataStore.readConfig();

          // Initialize settings if they don't exist
          if (!config.settings) {
            config.settings = {};
          }

          // Merge updates into settings
          config.settings = { ...config.settings, ...updates };

          await this.fileDataStore.writeConfig(config);
        } catch (error) {
          ErrorHandler.log({
            operation: 'update settings',
            error,
            context: { updates },
          });
          throw error;
        }
      }
    );

    // Set API key
    this.ipcMain.handle(
      'config:setApiKey',
      async (_event: IpcMainInvokeEvent, service: string, key: string): Promise<void> => {
        try {
          const config = await this.fileDataStore.readConfig();

          // Initialize apiKeys if they don't exist
          if (!config.apiKeys) {
            config.apiKeys = {};
          }

          config.apiKeys[service] = key;

          await this.fileDataStore.writeConfig(config);
        } catch (error) {
          ErrorHandler.log({
            operation: 'set api key',
            error,
            context: { service }, // Don't log the actual key for security
          });
          throw error;
        }
      }
    );

    // Remove API key
    this.ipcMain.handle(
      'config:removeApiKey',
      async (_event: IpcMainInvokeEvent, service: string): Promise<void> => {
        try {
          const config = await this.fileDataStore.readConfig();

          if (config.apiKeys && config.apiKeys[service]) {
            delete config.apiKeys[service];
            await this.fileDataStore.writeConfig(config);
          }
        } catch (error) {
          ErrorHandler.log({
            operation: 'remove api key',
            error,
            context: { service },
          });
          throw error;
        }
      }
    );

    // Clear all API keys
    this.ipcMain.handle(
      'config:clearApiKeys',
      async (_event: IpcMainInvokeEvent): Promise<void> => {
        try {
          const config = await this.fileDataStore.readConfig();
          config.apiKeys = {};
          await this.fileDataStore.writeConfig(config);
        } catch (error) {
          ErrorHandler.log({
            operation: 'clear api keys',
            error,
          });
          throw error;
        }
      }
    );

    // Add custom command
    this.ipcMain.handle(
      'config:addCustomCommand',
      async (_event: IpcMainInvokeEvent, command: CustomCommand): Promise<void> => {
        try {
          const config = await this.fileDataStore.readConfig();

          // Initialize customCommands if they don't exist
          if (!config.customCommands) {
            config.customCommands = [];
          }

          config.customCommands.push(command);

          await this.fileDataStore.writeConfig(config);
        } catch (error) {
          ErrorHandler.log({
            operation: 'add custom command',
            error,
            context: { commandId: command.id, commandName: command.name },
          });
          throw error;
        }
      }
    );

    // Update custom command
    this.ipcMain.handle(
      'config:updateCustomCommand',
      async (
        _event: IpcMainInvokeEvent,
        id: string,
        updatedCommand: CustomCommand
      ): Promise<void> => {
        try {
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
        } catch (error) {
          ErrorHandler.log({
            operation: 'update custom command',
            error,
            context: { commandId: id },
          });
          throw error;
        }
      }
    );

    // Remove custom command
    this.ipcMain.handle(
      'config:removeCustomCommand',
      async (_event: IpcMainInvokeEvent, id: string): Promise<void> => {
        try {
          const config = await this.fileDataStore.readConfig();

          if (config.customCommands) {
            config.customCommands = config.customCommands.filter((cmd) => cmd.id !== id);
            await this.fileDataStore.writeConfig(config);
          }
        } catch (error) {
          ErrorHandler.log({
            operation: 'remove custom command',
            error,
            context: { commandId: id },
          });
          throw error;
        }
      }
    );

    // Clear all custom commands
    this.ipcMain.handle(
      'config:clearCustomCommands',
      async (_event: IpcMainInvokeEvent): Promise<void> => {
        try {
          const config = await this.fileDataStore.readConfig();
          config.customCommands = [];
          await this.fileDataStore.writeConfig(config);
        } catch (error) {
          ErrorHandler.log({
            operation: 'clear custom commands',
            error,
          });
          throw error;
        }
      }
    );

    // Get config section (utility method for future use)
    this.ipcMain.handle(
      'config:getSection',
      async (_event: IpcMainInvokeEvent, section: keyof AutosteerConfig): Promise<any> => {
        try {
          const config = await this.fileDataStore.readConfig();
          return config[section];
        } catch (error) {
          ErrorHandler.log({
            operation: 'get config section',
            error,
            context: { section },
          });
          throw error;
        }
      }
    );

    // Get dev mode setting
    this.ipcMain.handle('config:getDevMode', async (): Promise<boolean> => {
      try {
        const config = await this.fileDataStore.readConfig();
        return config.settings?.devMode || false;
      } catch (error) {
        ErrorHandler.log({
          operation: 'get dev mode',
          error,
        });
        return false;
      }
    });

    // Set dev mode setting and update logger
    this.ipcMain.handle(
      'config:setDevMode',
      async (_event: IpcMainInvokeEvent, enabled: boolean): Promise<void> => {
        try {
          const config = await this.fileDataStore.readConfig();

          if (!config.settings) {
            config.settings = {};
          }

          config.settings.devMode = enabled;
          await this.fileDataStore.writeConfig(config);

          mainLogger.setDevelopmentMode(enabled);
        } catch (error) {
          ErrorHandler.log({
            operation: 'set dev mode',
            error,
            context: { enabled },
          });
          throw error;
        }
      }
    );

    // Set config section (utility method for future use)
    this.ipcMain.handle(
      'config:setSection',
      async (
        _event: IpcMainInvokeEvent,
        section: keyof AutosteerConfig,
        value: any
      ): Promise<void> => {
        try {
          const config = await this.fileDataStore.readConfig();
          (config as any)[section] = value;
          await this.fileDataStore.writeConfig(config);
        } catch (error) {
          ErrorHandler.log({
            operation: 'set config section',
            error,
            context: { section },
          });
          throw error;
        }
      }
    );

    // Get project directory setting (from app.json)
    this.ipcMain.handle('config:getProjectDirectory', async (): Promise<string> => {
      try {
        const appConfig = await this.fileDataStore.readAppConfig();
        return appConfig.projectDirectory || this.fileDataStore.getDataDirectory();
      } catch (error) {
        ErrorHandler.log({
          operation: 'get project directory',
          error,
        });
        return this.fileDataStore.getDataDirectory();
      }
    });

    // Set project directory setting (saves to app.json)
    this.ipcMain.handle(
      'config:setProjectDirectory',
      async (
        _event: IpcMainInvokeEvent,
        directory: string
      ): Promise<{ success: boolean; error?: string }> => {
        try {
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
        } catch (error) {
          ErrorHandler.log({
            operation: 'set project directory',
            error,
            context: { directory },
          });
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to set project directory',
          };
        }
      }
    );
  }
}
