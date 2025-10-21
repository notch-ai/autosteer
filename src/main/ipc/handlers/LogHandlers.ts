import { ipcMain, IpcMainInvokeEvent } from 'electron';
import log from 'electron-log';
import { mainLogger } from '../../services/logger';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export class LogHandlers {
  static register(): void {
    // Log info messages
    ipcMain.handle(
      'log:info',
      async (_event: IpcMainInvokeEvent, message: string, ...args: any[]) => {
        log.info(message, ...args);
      }
    );

    // Log warning messages
    ipcMain.handle(
      'log:warn',
      async (_event: IpcMainInvokeEvent, message: string, ...args: any[]) => {
        log.warn(message, ...args);
      }
    );

    // Log error messages
    ipcMain.handle(
      'log:error',
      async (_event: IpcMainInvokeEvent, message: string, ...args: any[]) => {
        log.error(message, ...args);
      }
    );

    // Log debug messages
    ipcMain.handle(
      'log:debug',
      async (_event: IpcMainInvokeEvent, message: string, ...args: any[]) => {
        log.debug(message, ...args);
      }
    );

    // Generic log handler
    ipcMain.handle(
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
      }
    );

    // Get log file path
    ipcMain.handle('logs:getPath', async (): Promise<string> => {
      return mainLogger.getLogPath();
    });

    // Clean old logs (older than specified days)
    ipcMain.handle(
      'logs:cleanOldLogs',
      async (_event: IpcMainInvokeEvent, daysToKeep: number = 7): Promise<void> => {
        await mainLogger.cleanOldLogs(daysToKeep);
      }
    );

    // Get all log files
    ipcMain.handle('logs:getLogFiles', async (): Promise<string[]> => {
      try {
        const logPath = path.join(app.getPath('userData'), 'logs');
        const files = await fs.promises.readdir(logPath);
        return files.filter((file) => file.endsWith('.log') || file.endsWith('.log.gz'));
      } catch (error) {
        log.error('Failed to get log files:', error);
        return [];
      }
    });
  }
}
