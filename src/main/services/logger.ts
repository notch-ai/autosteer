import { FileDataStoreService } from '@/services/FileDataStoreService';
import { app } from 'electron';
import log from 'electron-log/main';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';

class MainProcessLogger {
  private initialized = false;
  private fileLoggingEnabled: boolean;

  constructor() {
    this.fileLoggingEnabled = process.env.FILE_APP_LOGGING === 'true';
  }

  async initialize() {
    if (this.initialized) return;
    this.initialized = true;

    this.initializeLogger();

    try {
      const fileDataStore = FileDataStoreService.getInstance();
      await fileDataStore.ensureDirectories();

      const configExists = await fileDataStore.configExists();
      if (configExists) {
        const config = await fileDataStore.readConfig();
        const devMode = config.settings?.devMode || false;
        this.setDevelopmentMode(devMode);
      }
    } catch (error) {
      // Config not available during initialization
    }
  }

  setConsoleOutput(enabled: boolean) {
    log.transports.console.level = enabled ? 'debug' : false;
    log.info(`Console output ${enabled ? 'enabled' : 'disabled'}`);
  }

  private initializeLogger() {
    // Always enable console logging (stdout/stderr)
    log.transports.console.level = 'debug';
    log.transports.console.format = '[{h}:{i}:{s}.{ms}] [{level}] {text}';

    // Configure file logging based on environment flag
    if (this.fileLoggingEnabled) {
      const logPath = path.join(app.getPath('userData'), 'logs');
      log.transports.file.resolvePathFn = () => path.join(logPath, 'app.log');
      log.transports.file.format =
        '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{processType}] [{level}] {text}';
      log.transports.file.maxSize = 5 * 1024 * 1024;
      log.transports.file.level = 'warn';

      log.transports.file.archiveLogFn = (oldLogFile: any) => {
        const oldPath = oldLogFile.toString();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const newPath = oldPath.replace('.log', `-${timestamp}.log.gz`);

        this.compressLogFile(oldPath, newPath).catch((error) => {
          log.error('Failed to compress log file:', error);
        });

        return newPath;
      };

      log.info(`File logging enabled - Log directory: ${logPath}`);
    } else {
      // Disable file transport completely
      log.transports.file.level = false;
      log.info('File logging disabled (FILE_APP_LOGGING=false)');
    }

    log.catchErrors({
      showDialog: false,
      onError: (error) => {
        log.error('Unhandled error:', error);
      },
    });

    log.info(`App started - Version: ${app.getVersion()}`);
  }

  private async compressLogFile(sourcePath: string, destPath: string): Promise<void> {
    try {
      const source = fs.createReadStream(sourcePath);
      const destination = fs.createWriteStream(destPath);
      const gzip = createGzip({ level: 9 });

      await pipeline(source, gzip, destination);

      fs.unlinkSync(sourcePath);
      log.info(`Compressed log file: ${path.basename(destPath)}`);
    } catch (error) {
      log.error('Failed to compress log file:', error);
      throw error;
    }
  }

  setDevelopmentMode(enabled: boolean) {
    // File logging respects FILE_APP_LOGGING flag
    if (this.fileLoggingEnabled) {
      log.transports.file.level = enabled ? 'silly' : 'warn';
    }

    // Console logging always enabled in dev mode, disabled in production
    log.transports.console.level = enabled ? 'debug' : false;

    log.info(`Log level set to ${enabled ? 'development' : 'production'} mode`);
  }

  async cleanOldLogs(daysToKeep: number = 7): Promise<void> {
    if (!this.fileLoggingEnabled) {
      return;
    }

    try {
      const logPath = path.join(app.getPath('userData'), 'logs');
      const files = await fs.promises.readdir(logPath);
      const now = Date.now();
      const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (file.endsWith('.log.gz')) {
          const filePath = path.join(logPath, file);
          const stats = await fs.promises.stat(filePath);
          const age = now - stats.mtime.getTime();

          if (age > maxAge) {
            await fs.promises.unlink(filePath);
            log.info(`Deleted old log file: ${file}`);
          }
        }
      }
    } catch (error) {
      log.error('Failed to clean old logs:', error);
    }
  }

  getLogPath(): string {
    return log.transports.file.getFile()?.path || 'Unknown';
  }
}

export const mainLogger = new MainProcessLogger();
export { log };
