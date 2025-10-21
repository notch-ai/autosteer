import { IpcMain, IpcMainInvokeEvent, dialog, app, BrowserWindow } from 'electron';
import { FileDataStoreService } from '@/services/FileDataStoreService';
import { ErrorHandler } from '../../utils/errorHandler';
import { Agent, Resource } from '@/entities';
import log from 'electron-log';
import Store from 'electron-store';
import * as fs from 'fs/promises';

interface AppDataStore {
  agents?: Agent[];
  resources?: Resource[];
  settings?: Record<string, unknown>;
  [key: string]: unknown;
}

interface ExportData {
  version: string;
  exportDate: string;
  agents: Agent[];
  resources: Resource[];
  settings: Record<string, unknown>;
  appData: AppDataStore;
}

/**
 * StoreHandlers - IPC handlers for general store operations and data persistence
 *
 * Handles general storage operations using ~/.autosteer/config.json
 * via FileDataStoreService. These handlers provide a generic store
 * interface for any data that needs to be persisted.
 *
 * Also includes merged functionality from DataHandlers for data export/import.
 */
export class StoreHandlers {
  private fileDataStore: FileDataStoreService;
  private store: Store<AppDataStore> | null = null;

  constructor(private ipcMain: IpcMain) {
    this.fileDataStore = FileDataStoreService.getInstance();
  }

  private getStore(): Store<AppDataStore> {
    if (!this.store) {
      this.store = new Store<AppDataStore>({
        name: 'app-data',
        defaults: {},
      });
    }
    return this.store;
  }

  registerHandlers(): void {
    // Get a value from the store section of config
    this.ipcMain.handle('store:get', async (_event: IpcMainInvokeEvent, key: string) => {
      try {
        const config = await this.fileDataStore.readConfig();

        // Initialize store section if it doesn't exist
        if (!config.store) {
          config.store = {};
        }

        return config.store[key];
      } catch (error) {
        ErrorHandler.log({
          operation: 'store get',
          error,
          context: { key },
        });
        return undefined;
      }
    });

    // Set a value in the store section of config
    this.ipcMain.handle(
      'store:set',
      async (_event: IpcMainInvokeEvent, key: string, value: unknown) => {
        try {
          const config = await this.fileDataStore.readConfig();

          // Initialize store section if it doesn't exist
          if (!config.store) {
            config.store = {};
          }

          config.store[key] = value;
          await this.fileDataStore.writeConfig(config);
        } catch (error) {
          ErrorHandler.log({
            operation: 'store set',
            error,
            context: { key },
          });
          throw error;
        }
      }
    );

    // Delete a value from the store section
    this.ipcMain.handle('store:delete', async (_event: IpcMainInvokeEvent, key: string) => {
      try {
        const config = await this.fileDataStore.readConfig();

        if (config.store && key in config.store) {
          delete config.store[key];
          await this.fileDataStore.writeConfig(config);
        }
      } catch (error) {
        ErrorHandler.log({
          operation: 'store delete',
          error,
          context: { key },
        });
        throw error;
      }
    });

    // Check if a key exists in the store section
    this.ipcMain.handle('store:has', async (_event: IpcMainInvokeEvent, key: string) => {
      try {
        const config = await this.fileDataStore.readConfig();
        return config.store ? key in config.store : false;
      } catch (error) {
        ErrorHandler.log({
          operation: 'store has',
          error,
          context: { key },
        });
        return false;
      }
    });

    // Clear all values from the store section
    this.ipcMain.handle('store:clear', async (_event: IpcMainInvokeEvent) => {
      try {
        const config = await this.fileDataStore.readConfig();
        config.store = {};
        await this.fileDataStore.writeConfig(config);
      } catch (error) {
        ErrorHandler.log({
          operation: 'store clear',
          error,
        });
        throw error;
      }
    });

    // Export data handler (merged from DataHandlers)
    this.ipcMain.handle('store:export', async (_event: IpcMainInvokeEvent) => {
      try {
        const config = await this.fileDataStore.readConfig();
        const exportData = {
          version: app.getVersion(),
          exportDate: new Date().toISOString(),
          ...config,
          appData: this.getStore().store,
        };
        return exportData;
      } catch (error) {
        log.error('Failed to export data:', error);
        throw error;
      }
    });

    // Import data handler (merged from DataHandlers)
    this.ipcMain.handle('store:import', async (_event: IpcMainInvokeEvent, data: any) => {
      try {
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid import data');
        }

        // Import to config
        const config = await this.fileDataStore.readConfig();
        Object.assign(config, data);
        await this.fileDataStore.writeConfig(config);

        // Import to electron-store if appData exists
        if (data.appData) {
          const store = this.getStore();
          store.clear();
          Object.entries(data.appData).forEach(([key, value]) => {
            store.set(key, value);
          });
        }

        log.info('Data imported successfully');
      } catch (error) {
        log.error('Failed to import data:', error);
        throw error;
      }
    });

    // Data persistence handlers (merged from DataHandlers)
    // Save data
    this.ipcMain.handle('data:save', (_event: IpcMainInvokeEvent, key: string, data: unknown) => {
      try {
        this.getStore().set(key, data);
        log.info(`Saved data for key: ${key}`);
      } catch (error) {
        log.error('Failed to save data:', error);
        throw error;
      }
    });

    // Load data
    this.ipcMain.handle('data:load', (_event: IpcMainInvokeEvent, key: string) => {
      try {
        const data = this.getStore().get(key);
        log.info(`Loaded data for key: ${key}`);
        return data;
      } catch (error) {
        log.error('Failed to load data:', error);
        throw error;
      }
    });

    // Export data
    this.ipcMain.handle('data:export', async (event: IpcMainInvokeEvent, exportPath?: string) => {
      try {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) {
          throw new Error('No window found');
        }

        let filePath = exportPath;

        if (!filePath) {
          const result = await dialog.showSaveDialog(window, {
            defaultPath: `notch-export-${new Date().toISOString().split('T')[0]}.json`,
            filters: [
              { name: 'JSON Files', extensions: ['json'] },
              { name: 'All Files', extensions: ['*'] },
            ],
          });

          if (result.canceled || !result.filePath) {
            return;
          }

          filePath = result.filePath;
        }

        // Gather all data
        const exportData: ExportData = {
          version: app.getVersion(),
          exportDate: new Date().toISOString(),
          agents: (this.getStore().store.agents as Agent[]) || [],
          resources: (this.getStore().store.resources as Resource[]) || [],
          settings: (this.getStore().store.settings as Record<string, unknown>) || {},
          appData: this.getStore().store,
        };

        await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
        log.info(`Exported data to: ${filePath}`);
      } catch (error) {
        log.error('Failed to export data:', error);
        throw error;
      }
    });

    // Import data
    this.ipcMain.handle('data:import', async (event: IpcMainInvokeEvent, importPath?: string) => {
      try {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) {
          throw new Error('No window found');
        }

        let filePath = importPath;

        if (!filePath) {
          const result = await dialog.showOpenDialog(window, {
            properties: ['openFile'],
            filters: [
              { name: 'JSON Files', extensions: ['json'] },
              { name: 'All Files', extensions: ['*'] },
            ],
          });

          if (result.canceled || result.filePaths.length === 0) {
            return;
          }

          filePath = result.filePaths[0];
        }

        const content = await fs.readFile(filePath, 'utf-8');
        const importData = JSON.parse(content) as ExportData;

        // Validate import data
        if (!importData.version || !importData.exportDate) {
          throw new Error('Invalid import file format');
        }

        // Show confirmation dialog
        const confirmResult = await dialog.showMessageBox(window, {
          type: 'warning',
          title: 'Import Data',
          message: 'This will replace all existing data. Are you sure?',
          buttons: ['Cancel', 'Import'],
          defaultId: 0,
          cancelId: 0,
        });

        if (confirmResult.response === 1) {
          // Import confirmed
          if (importData.agents) {
            const agentsStore = new Store({ name: 'agents' });
            agentsStore.set('agents', importData.agents);
          }

          if (importData.resources) {
            const resourcesStore = new Store({ name: 'resources' });
            resourcesStore.set('resources', importData.resources);
          }

          if (importData.settings) {
            const settingsStore = new Store({ name: 'settings' });
            Object.entries(importData.settings).forEach(([key, value]) => {
              settingsStore.set(key, value);
            });
          }

          // Import app data
          if (importData.appData) {
            Object.entries(importData.appData).forEach(([key, value]) => {
              if (!['agents', 'resources', 'settings'].includes(key)) {
                this.getStore().set(key, value);
              }
            });
          }

          log.info(`Imported data from: ${filePath}`);
        }
      } catch (error) {
        log.error('Failed to import data:', error);
        throw error;
      }
    });
  }
}
