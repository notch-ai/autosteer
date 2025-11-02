import { UpdateService } from '@/services/UpdateService';
import { ipcMain, IpcMainInvokeEvent } from 'electron';

/**
 * UpdateHandlers class
 * Handles all IPC communication for application auto-update functionality.
 *
 * @remarks
 * This handler manages the complete update lifecycle using Electron's autoUpdater:
 * - Update availability checking
 * - Update download management
 * - Installation and app restart
 * - Version dismissal (user opt-out)
 * - GitHub release notes fetching
 *
 * The update process follows this flow:
 * 1. Check for updates (manual or automatic)
 * 2. Download update in background
 * 3. Prompt user to install
 * 4. Install and restart application
 *
 * Key responsibilities:
 * - Bridge between renderer process and UpdateService
 * - Fetch release notes from GitHub API
 * - Handle user update preferences (dismiss version)
 * - Coordinate with Electron autoUpdater lifecycle events
 *
 * @example
 * ```typescript
 * const updateService = new UpdateService();
 * const handlers = new UpdateHandlers(updateService);
 * // Handlers are automatically registered in constructor
 * ```
 */
export class UpdateHandlers {
  constructor(private updateService: UpdateService) {
    this.registerHandlers();
  }

  /**
   * Register all IPC handlers for update operations
   * Sets up listeners for the complete update lifecycle and release notes fetching
   *
   * @remarks
   * Registered IPC channels:
   * - update:check: Check for available updates from GitHub releases
   * - update:download: Download pending update in background
   * - update:install: Quit application and install downloaded update
   * - update:dismiss: Mark a specific version as dismissed (user opt-out)
   * - update:getReleaseNotes: Fetch release notes from GitHub API
   *
   * Update flow:
   * 1. Frontend calls update:check
   * 2. UpdateService emits 'update-available' event
   * 3. Frontend calls update:download
   * 4. UpdateService emits 'update-downloaded' event
   * 5. Frontend shows install prompt
   * 6. User clicks install, frontend calls update:install
   * 7. App quits and installs update
   *
   * @private
   */
  private registerHandlers(): void {
    ipcMain.handle('update:check', async () => {
      await this.updateService.checkForUpdates();
    });

    ipcMain.handle('update:download', async () => {
      await this.updateService.downloadUpdate();
    });

    ipcMain.handle('update:install', () => {
      this.updateService.quitAndInstall();
    });

    ipcMain.handle('update:dismiss', async (_event: IpcMainInvokeEvent, version: string) => {
      this.updateService.dismissVersion(version);
    });

    ipcMain.handle(
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
      }
    );
  }
}
