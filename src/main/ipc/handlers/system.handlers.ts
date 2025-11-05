/**
 * System Handlers - Consolidated IPC handlers for system operations
 * Phase 4: IPC Simplification - System Domain Handler
 *
 * Consolidates:
 * - TerminalHandlers.ts → system.handlers.ts (terminal operations)
 * - BadgeHandlers.ts → system.handlers.ts (badge notifications)
 * - ConfigHandlers.ts → system.handlers.ts (configuration management)
 * - LogHandlers.ts → system.handlers.ts (logging operations)
 * - StoreHandlers.ts → system.handlers.ts (store operations)
 * - UpdateHandlers.ts → system.handlers.ts (app updates)
 *
 * Responsibilities:
 * - Terminal lifecycle management
 * - Badge notification management
 * - Configuration file operations
 * - Logging operations
 * - Generic store operations
 * - Application update management
 *
 * Success Criteria:
 * - Type-safe IPC channels
 * - Comprehensive error handling
 * - Application logging throughout
 * - ~150 LoC target per domain
 */

import { IpcMainInvokeEvent, BrowserWindow } from 'electron';
import log from 'electron-log';
import { XtermService } from '@/services/XtermService';
import { BadgeService } from '../../services/BadgeService';
import { FileDataStoreService } from '@/services/FileDataStoreService';
import { UpdateService } from '@/services/UpdateService';
import { mainLogger } from '../../services/logger';
import { AutosteerConfig, CustomCommand } from '@/types/config.types';
import { TerminalCreateParams, TerminalResponse } from '@/types/terminal.types';
import { IPC_CHANNELS } from '@/types/ipc.types';
import { ErrorHandler } from '../../utils/errorHandler';
import { registerSafeHandler } from '../safeHandlerWrapper';

/**
 * SystemHandlers class
 * Centralized handler for all system-related IPC operations
 */
export class SystemHandlers {
  private xtermService: XtermService;
  private badgeService: BadgeService;
  private fileDataStore: FileDataStoreService;
  private updateService: UpdateService | undefined;

  constructor(updateService?: UpdateService) {
    this.xtermService = XtermService.getInstance();
    this.badgeService = BadgeService.getInstance();
    this.fileDataStore = FileDataStoreService.getInstance();
    this.updateService = updateService;
  }

  /**
   * Set the update service (called after UpdateService is initialized)
   */
  setUpdateService(updateService: UpdateService): void {
    this.updateService = updateService;
    this.registerUpdateHandlers();
    log.info('[SystemHandlers] Update service registered');
  }

  /**
   * Register all System IPC handlers
   */
  registerHandlers(): void {
    log.info('[SystemHandlers] Registering System IPC handlers');

    this.registerTerminalHandlers();
    this.registerBadgeHandlers();
    this.registerConfigHandlers();
    this.registerLogHandlers();
    this.registerStoreHandlers();

    // Only register update handlers if updateService is available
    if (this.updateService) {
      this.registerUpdateHandlers();
    }

    log.info('[SystemHandlers] System IPC handlers registered successfully');
  }

  /**
   * Terminal Operations
   */
  private registerTerminalHandlers(): void {
    // Create terminal
    registerSafeHandler(
      IPC_CHANNELS.TERMINAL_CREATE,
      async (
        event: IpcMainInvokeEvent,
        params?: TerminalCreateParams
      ): Promise<TerminalResponse> => {
        log.info('[SystemHandlers] terminal:create invoked', { params });

        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) {
          log.error('[SystemHandlers] Window not found for terminal creation');
          return { success: false, error: 'Window not found' };
        }

        try {
          const terminalData = await this.xtermService.createTerminal(window, params);
          log.info('[SystemHandlers] Terminal created successfully', {
            id: terminalData.id,
            pid: terminalData.pid,
          });

          return { success: true, data: terminalData };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create terminal';
          log.error('[SystemHandlers] Failed to create terminal:', error);
          return { success: false, error: errorMessage };
        }
      },
      { operationName: 'Create terminal' }
    );

    // Destroy terminal
    registerSafeHandler(
      IPC_CHANNELS.TERMINAL_DESTROY,
      async (_event: IpcMainInvokeEvent, terminalId: string): Promise<TerminalResponse> => {
        log.info('[SystemHandlers] terminal:destroy invoked', { terminalId });

        try {
          await this.xtermService.killTerminal(terminalId);
          log.info('[SystemHandlers] Terminal destroyed successfully', { terminalId });
          return { success: true };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to destroy terminal';
          log.error('[SystemHandlers] Failed to destroy terminal:', error);
          return { success: false, error: errorMessage };
        }
      },
      { operationName: 'Destroy terminal' }
    );

    // List all terminals
    registerSafeHandler(
      'terminal:list',
      async (): Promise<TerminalResponse> => {
        try {
          const terminals = this.xtermService.getAllTerminals();
          return { success: true, data: terminals };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to list terminals';
          log.error('[SystemHandlers] Failed to list terminals:', error);
          return { success: false, error: errorMessage };
        }
      },
      { operationName: 'List terminals' }
    );
  }

  /**
   * Badge Operations
   */
  private registerBadgeHandlers(): void {
    // Show badge
    registerSafeHandler(
      'badge:show',
      async () => {
        try {
          const startTime = Date.now();
          await this.badgeService.showBadge();
          const duration = Date.now() - startTime;

          if (duration > 5) {
            log.warn(`Badge show operation took ${duration}ms`);
          }

          return { success: true };
        } catch (error) {
          log.error('Failed to show badge:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to show badge',
          };
        }
      },
      { operationName: 'Show badge' }
    );

    // Hide badge
    registerSafeHandler(
      'badge:hide',
      async () => {
        try {
          const startTime = Date.now();
          await this.badgeService.hideBadge();
          const duration = Date.now() - startTime;

          if (duration > 5) {
            log.warn(`Badge hide operation took ${duration}ms`);
          }

          return { success: true };
        } catch (error) {
          log.error('Failed to hide badge:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to hide badge',
          };
        }
      },
      { operationName: 'Hide badge' }
    );

    // Check platform support
    registerSafeHandler(
      'badge:isSupported',
      async () => {
        try {
          const isSupported = this.badgeService.isSupported();
          return { success: true, data: isSupported };
        } catch (error) {
          log.error('Failed to check badge support:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to check badge support',
          };
        }
      },
      { operationName: 'Check badge support' }
    );
  }

  /**
   * Config Operations
   */
  private registerConfigHandlers(): void {
    // Read entire config file
    registerSafeHandler(
      'config:read',
      async (): Promise<AutosteerConfig> => {
        try {
          return await this.fileDataStore.readConfig();
        } catch (error) {
          ErrorHandler.log({ operation: 'read config', error });
          return { worktrees: [], settings: { vimMode: false } };
        }
      },
      { operationName: 'Read config' }
    );

    // Update settings section
    registerSafeHandler(
      'config:updateSettings',
      async (_event: IpcMainInvokeEvent, updates: Record<string, any>): Promise<void> => {
        try {
          const config = await this.fileDataStore.readConfig();

          if (!config.settings) {
            config.settings = {};
          }

          config.settings = { ...config.settings, ...updates };
          await this.fileDataStore.writeConfig(config);
        } catch (error) {
          ErrorHandler.log({ operation: 'update settings', error, context: { updates } });
          throw error;
        }
      },
      { operationName: 'Update settings' }
    );

    // Set API key
    registerSafeHandler(
      'config:setApiKey',
      async (_event: IpcMainInvokeEvent, service: string, key: string): Promise<void> => {
        try {
          const config = await this.fileDataStore.readConfig();

          if (!config.apiKeys) {
            config.apiKeys = {};
          }

          config.apiKeys[service] = key;
          await this.fileDataStore.writeConfig(config);
        } catch (error) {
          ErrorHandler.log({ operation: 'set api key', error, context: { service } });
          throw error;
        }
      },
      { operationName: 'Set API key' }
    );

    // Remove API key
    registerSafeHandler(
      'config:removeApiKey',
      async (_event: IpcMainInvokeEvent, service: string): Promise<void> => {
        try {
          const config = await this.fileDataStore.readConfig();

          if (config.apiKeys && config.apiKeys[service]) {
            delete config.apiKeys[service];
            await this.fileDataStore.writeConfig(config);
          }
        } catch (error) {
          ErrorHandler.log({ operation: 'remove api key', error, context: { service } });
          throw error;
        }
      },
      { operationName: 'Remove API key' }
    );

    // Clear all API keys
    registerSafeHandler(
      'config:clearApiKeys',
      async (): Promise<void> => {
        try {
          const config = await this.fileDataStore.readConfig();
          config.apiKeys = {};
          await this.fileDataStore.writeConfig(config);
        } catch (error) {
          ErrorHandler.log({ operation: 'clear api keys', error });
          throw error;
        }
      },
      { operationName: 'Clear API keys' }
    );

    // Add custom command
    registerSafeHandler(
      'config:addCustomCommand',
      async (_event: IpcMainInvokeEvent, command: CustomCommand): Promise<void> => {
        try {
          const config = await this.fileDataStore.readConfig();

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
      },
      { operationName: 'Add custom command' }
    );

    // Update custom command
    registerSafeHandler(
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
      },
      { operationName: 'Update custom command' }
    );

    // Remove custom command
    registerSafeHandler(
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
      },
      { operationName: 'Remove custom command' }
    );

    // Clear all custom commands
    registerSafeHandler(
      'config:clearCustomCommands',
      async (): Promise<void> => {
        try {
          const config = await this.fileDataStore.readConfig();
          config.customCommands = [];
          await this.fileDataStore.writeConfig(config);
        } catch (error) {
          ErrorHandler.log({ operation: 'clear custom commands', error });
          throw error;
        }
      },
      { operationName: 'Clear custom commands' }
    );

    // Get config section
    registerSafeHandler(
      'config:getSection',
      async (_event: IpcMainInvokeEvent, section: keyof AutosteerConfig): Promise<any> => {
        try {
          const config = await this.fileDataStore.readConfig();
          return config[section];
        } catch (error) {
          ErrorHandler.log({ operation: 'get config section', error, context: { section } });
          throw error;
        }
      },
      { operationName: 'Get config section' }
    );

    // Get dev mode setting
    registerSafeHandler(
      'config:getDevMode',
      async (): Promise<boolean> => {
        try {
          const config = await this.fileDataStore.readConfig();
          return config.settings?.devMode || false;
        } catch (error) {
          ErrorHandler.log({ operation: 'get dev mode', error });
          return false;
        }
      },
      { operationName: 'Get dev mode' }
    );

    // Set dev mode setting
    registerSafeHandler(
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
          ErrorHandler.log({ operation: 'set dev mode', error, context: { enabled } });
          throw error;
        }
      },
      { operationName: 'Set dev mode' }
    );

    // Set config section
    registerSafeHandler(
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
          ErrorHandler.log({ operation: 'set config section', error, context: { section } });
          throw error;
        }
      },
      { operationName: 'Set config section' }
    );

    // Get project directory setting
    registerSafeHandler(
      'config:getProjectDirectory',
      async (): Promise<string> => {
        try {
          const appConfig = await this.fileDataStore.readAppConfig();
          return appConfig.projectDirectory || this.fileDataStore.getDataDirectory();
        } catch (error) {
          ErrorHandler.log({ operation: 'get project directory', error });
          return this.fileDataStore.getDataDirectory();
        }
      },
      { operationName: 'Get project directory' }
    );

    // Set project directory setting
    registerSafeHandler(
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

          // Write to app.json
          const appConfig = await this.fileDataStore.readAppConfig();
          appConfig.projectDirectory = expandedPath;
          await this.fileDataStore.writeAppConfig(appConfig);

          // Update the FileDataStoreService
          this.fileDataStore.setDataDirectory(expandedPath);

          return { success: true };
        } catch (error) {
          ErrorHandler.log({ operation: 'set project directory', error, context: { directory } });
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to set project directory',
          };
        }
      },
      { operationName: 'Set project directory' }
    );
  }

  /**
   * Log Operations
   */
  private registerLogHandlers(): void {
    // Log info messages
    registerSafeHandler(
      'log:info',
      async (_event: IpcMainInvokeEvent, message: string, ...args: any[]) => {
        log.info(message, ...args);
      },
      { operationName: 'Log info' }
    );

    // Log warning messages
    registerSafeHandler(
      'log:warn',
      async (_event: IpcMainInvokeEvent, message: string, ...args: any[]) => {
        log.warn(message, ...args);
      },
      { operationName: 'Log warning' }
    );

    // Log error messages
    registerSafeHandler(
      'log:error',
      async (_event: IpcMainInvokeEvent, message: string, ...args: any[]) => {
        log.error(message, ...args);
      },
      { operationName: 'Log error' }
    );

    // Log debug messages
    registerSafeHandler(
      'log:debug',
      async (_event: IpcMainInvokeEvent, message: string, ...args: any[]) => {
        log.debug(message, ...args);
      },
      { operationName: 'Log debug' }
    );

    // Generic log handler
    registerSafeHandler(
      'log',
      async (_event: IpcMainInvokeEvent, level: string, message: string, ...args: any[]) => {
        switch (level) {
          case 'info':
            log.info(message, ...args);
            break;
          case 'warn':
            log.warn(message, ...args);
            break;
          case 'error':
            log.error(message, ...args);
            break;
          case 'debug':
            log.debug(message, ...args);
            break;
          default:
            log.info(message, ...args);
        }
      },
      { operationName: 'Log message' }
    );

    // Get log file path
    registerSafeHandler(
      'logs:getPath',
      async (): Promise<string> => {
        return mainLogger.getLogPath();
      },
      { operationName: 'Get log path' }
    );

    // Clean old logs
    registerSafeHandler(
      'logs:cleanOldLogs',
      async (_event: IpcMainInvokeEvent, daysToKeep: number = 7): Promise<void> => {
        await mainLogger.cleanOldLogs(daysToKeep);
      },
      { operationName: 'Clean old logs' }
    );

    // Get all log files
    registerSafeHandler(
      'logs:getLogFiles',
      async (): Promise<string[]> => {
        try {
          const path = await import('path');
          const fs = await import('fs');
          const { app } = await import('electron');

          const logPath = path.join(app.getPath('userData'), 'logs');
          const files = await fs.promises.readdir(logPath);
          return files.filter((file) => file.endsWith('.log') || file.endsWith('.log.gz'));
        } catch (error) {
          log.error('Failed to get log files:', error);
          return [];
        }
      },
      { operationName: 'Get log files' }
    );
  }

  /**
   * Store Operations
   */
  private registerStoreHandlers(): void {
    // Get value from store
    registerSafeHandler(
      'store:get',
      async (_event: IpcMainInvokeEvent, key: string) => {
        try {
          const config = await this.fileDataStore.readConfig();

          if (!config.store) {
            config.store = {};
          }

          return config.store[key];
        } catch (error) {
          ErrorHandler.log({ operation: 'store get', error, context: { key } });
          return undefined;
        }
      },
      { operationName: 'Get store value' }
    );

    // Set value in store
    registerSafeHandler(
      'store:set',
      async (_event: IpcMainInvokeEvent, key: string, value: unknown) => {
        try {
          const config = await this.fileDataStore.readConfig();

          if (!config.store) {
            config.store = {};
          }

          config.store[key] = value;
          await this.fileDataStore.writeConfig(config);
        } catch (error) {
          ErrorHandler.log({ operation: 'store set', error, context: { key } });
          throw error;
        }
      },
      { operationName: 'Set store value' }
    );

    // Delete value from store
    registerSafeHandler(
      'store:delete',
      async (_event: IpcMainInvokeEvent, key: string) => {
        try {
          const config = await this.fileDataStore.readConfig();

          if (config.store && key in config.store) {
            delete config.store[key];
            await this.fileDataStore.writeConfig(config);
          }
        } catch (error) {
          ErrorHandler.log({ operation: 'store delete', error, context: { key } });
          throw error;
        }
      },
      { operationName: 'Delete store value' }
    );

    // Check if key exists in store
    registerSafeHandler(
      'store:has',
      async (_event: IpcMainInvokeEvent, key: string) => {
        try {
          const config = await this.fileDataStore.readConfig();
          return config.store ? key in config.store : false;
        } catch (error) {
          ErrorHandler.log({ operation: 'store has', error, context: { key } });
          return false;
        }
      },
      { operationName: 'Check store key' }
    );

    // Clear all values from store
    registerSafeHandler(
      'store:clear',
      async () => {
        try {
          const config = await this.fileDataStore.readConfig();
          config.store = {};
          await this.fileDataStore.writeConfig(config);
        } catch (error) {
          ErrorHandler.log({ operation: 'store clear', error });
          throw error;
        }
      },
      { operationName: 'Clear store' }
    );
  }

  /**
   * Update Operations
   */
  private registerUpdateHandlers(): void {
    // Check for updates
    registerSafeHandler(
      'update:check',
      async () => {
        await this.updateService?.checkForUpdates();
      },
      { operationName: 'Check for updates' }
    );

    // Download update
    registerSafeHandler(
      'update:download',
      async () => {
        await this.updateService?.downloadUpdate();
      },
      { operationName: 'Download update' }
    );

    // Install update
    registerSafeHandler(
      'update:install',
      async () => {
        this.updateService?.quitAndInstall();
      },
      { operationName: 'Install update' }
    );

    // Dismiss version
    registerSafeHandler(
      'update:dismiss',
      async (_event: IpcMainInvokeEvent, version: string) => {
        this.updateService?.dismissVersion(version);
      },
      { operationName: 'Dismiss update version' }
    );

    // Get release notes
    registerSafeHandler(
      'update:getReleaseNotes',
      async (_event: IpcMainInvokeEvent, version: string) => {
        try {
          const response = await fetch(
            `https://api.github.com/repos/notch-ai/autosteer/releases/tags/v${version}`
          );
          const data = await response.json();
          return data.body || 'No release notes available';
        } catch (error) {
          return 'Failed to fetch release notes';
        }
      },
      { operationName: 'Get release notes' }
    );
  }

  /**
   * Cleanup terminal service
   */
  async cleanup(): Promise<void> {
    log.info('[SystemHandlers] Cleaning up system handlers');

    try {
      await this.xtermService.cleanup();
      log.info('[SystemHandlers] System handlers cleaned up successfully');
    } catch (error) {
      log.error('[SystemHandlers] Cleanup failed:', error);
      throw error;
    }
  }
}
