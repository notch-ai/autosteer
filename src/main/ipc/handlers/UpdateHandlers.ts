import { UpdateService } from '@/services/UpdateService';
import { ipcMain, IpcMainInvokeEvent } from 'electron';

export class UpdateHandlers {
  constructor(private updateService: UpdateService) {
    this.registerHandlers();
  }

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
