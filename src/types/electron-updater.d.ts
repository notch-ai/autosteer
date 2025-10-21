declare module 'electron-updater' {
  export interface UpdateInfo {
    version: string;
    releaseNotes?: string | null;
    releaseDate?: string;
  }

  export interface ProgressInfo {
    bytesPerSecond: number;
    percent: number;
    transferred: number;
    total: number;
  }

  export interface AutoUpdater extends NodeJS.EventEmitter {
    autoDownload: boolean;
    autoInstallOnAppQuit: boolean;
    setFeedURL(options: { provider: string; owner: string; repo: string }): void;
    checkForUpdates(): Promise<any>;
    downloadUpdate(): Promise<any>;
    quitAndInstall(): void;
    on(event: 'checking-for-update', listener: () => void): this;
    on(event: 'update-available', listener: (info: UpdateInfo) => void): this;
    on(event: 'update-not-available', listener: (info: UpdateInfo) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'download-progress', listener: (progress: ProgressInfo) => void): this;
    on(event: 'update-downloaded', listener: (info: UpdateInfo) => void): this;
    removeAllListeners(event?: string): this;
  }

  export const autoUpdater: AutoUpdater;
}
