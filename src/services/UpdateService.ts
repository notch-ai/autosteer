import { app, BrowserWindow } from 'electron';
import log from 'electron-log';
import Store from 'electron-store';
import { autoUpdater } from 'electron-updater';
import * as semver from 'semver';

export interface UpdateInfo {
  version: string;
  releaseNotes?: string | null;
  releaseDate?: string;
}

interface UpdateMetadata {
  lastCheckTime: number;
  lastCheckVersion: string;
  dismissedVersions: string[];
  updateCheckInterval: number;
  notificationShownFor: string[];
}

export class UpdateService {
  private store: Store<UpdateMetadata>;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    this.store = new Store<UpdateMetadata>({
      name: 'update-metadata',
      defaults: {
        lastCheckTime: 0,
        lastCheckVersion: app.getVersion(),
        dismissedVersions: [],
        updateCheckInterval: this.CHECK_INTERVAL,
        notificationShownFor: [],
      },
    });

    this.configureAutoUpdater();
  }

  private configureAutoUpdater(): void {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    if (process.env.GITHUB_RELEASES_URL) {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'notch-ai',
        repo: 'autosteer',
      });
    }
  }

  async initialize(mainWindow: BrowserWindow): Promise<void> {
    this.mainWindow = mainWindow;

    autoUpdater.on('checking-for-update', () => {
      this.sendToRenderer('update:checking');
    });

    autoUpdater.on('update-available', (info: any) => {
      this.handleUpdateAvailable(info);
    });

    autoUpdater.on('update-not-available', () => {
      this.updateLastCheckTime();
    });

    autoUpdater.on('error', (error: Error) => {
      this.handleUpdateError(error);
    });

    autoUpdater.on('download-progress', (progressObj: any) => {
      this.sendToRenderer('update:download-progress', progressObj);
    });

    autoUpdater.on('update-downloaded', () => {
      this.sendToRenderer('update:downloaded');
    });

    this.startPeriodicChecks();

    await this.checkForUpdates();
  }

  private startPeriodicChecks(): void {
    const interval = this.store.get('updateCheckInterval', this.CHECK_INTERVAL);

    this.checkInterval = setInterval(() => {
      this.checkForUpdates();
    }, interval);
  }

  async checkForUpdates(): Promise<void> {
    // Skip update checks in development mode
    if (!app.isPackaged) {
      log.info('Skipping update check in development mode');
      return;
    }

    const lastCheck = this.store.get('lastCheckTime', 0);
    const now = Date.now();
    const timeSinceLastCheck = now - lastCheck;

    if (timeSinceLastCheck < 5 * 60 * 1000) {
      // 5 minutes
      return;
    }

    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      this.handleUpdateError(error as Error);
    }
  }

  private handleUpdateAvailable(info: UpdateInfo): void {
    const currentVersion = app.getVersion();
    const newVersion = info.version;

    const dismissedVersions = this.store.get('dismissedVersions', []);
    if (dismissedVersions.includes(newVersion)) {
      return;
    }

    const notifiedVersions = this.store.get('notificationShownFor', []);
    if (notifiedVersions.includes(newVersion)) {
      return;
    }

    if (!semver.gt(newVersion, currentVersion)) {
      return;
    }

    this.store.set('notificationShownFor', [...notifiedVersions, newVersion]);

    this.sendToRenderer('update:available', {
      currentVersion,
      newVersion,
      releaseNotes: info.releaseNotes,
      releaseDate: info.releaseDate,
    });

    this.updateLastCheckTime();
  }

  private handleUpdateError(error: Error): void {
    log.error('Update check failed:', error);
    this.sendToRenderer('update:error', error.message);

    this.updateLastCheckTime();
  }

  private updateLastCheckTime(): void {
    this.store.set('lastCheckTime', Date.now());
    this.store.set('lastCheckVersion', app.getVersion());
  }

  async downloadUpdate(): Promise<void> {
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      this.handleUpdateError(error as Error);
    }
  }

  quitAndInstall(): void {
    autoUpdater.quitAndInstall();
  }

  dismissVersion(version: string): void {
    const dismissed = this.store.get('dismissedVersions', []);
    if (!dismissed.includes(version)) {
      this.store.set('dismissedVersions', [...dismissed, version]);
    }
  }

  private sendToRenderer(channel: string, data?: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    autoUpdater.removeAllListeners();
  }
}
