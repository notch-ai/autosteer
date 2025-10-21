import {
  DirectoryListingRequest,
  DirectoryListingResponse,
  FileSystemEntry,
  IPC_CHANNELS,
  IpcChannelNames,
  WorkspaceSearchRequest,
  WorkspaceSearchResponse,
} from '@/types/ipc.types';
import { BrowserWindow, IpcMainInvokeEvent, dialog, ipcMain, shell } from 'electron';
import log from 'electron-log';
import fg from 'fast-glob';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

export class FileHandlers {
  /**
   * List all files and directories in the specified path
   */
  async listDirectory(
    _event: IpcMainInvokeEvent,
    request: DirectoryListingRequest
  ): Promise<DirectoryListingResponse> {
    try {
      const normalizedPath = path.resolve(request.path);
      const dirents = await fs.readdir(normalizedPath, { withFileTypes: true });

      const entries: FileSystemEntry[] = dirents
        .filter((dirent) => request.includeHidden || !dirent.name.startsWith('.'))
        .map((dirent) => ({
          name: dirent.name,
          path: path.join(normalizedPath, dirent.name),
          isDirectory: dirent.isDirectory(),
          isFile: dirent.isFile(),
        }))
        .sort((a, b) => {
          // Directories first
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          // Then alphabetical (case-insensitive)
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });

      return {
        entries,
        currentPath: normalizedPath,
      };
    } catch (error) {
      log.error('Failed to list directory:', error);
      throw error;
    }
  }

  /**
   * Search for files and directories in the workspace matching a query
   */
  async searchWorkspace(
    _event: IpcMainInvokeEvent,
    request: WorkspaceSearchRequest
  ): Promise<WorkspaceSearchResponse> {
    try {
      const normalizedPath = path.resolve(request.workspacePath);
      const maxResults = request.maxResults || 100;
      const query = request.query.toLowerCase();

      const patterns = [`**/*${query}*`];

      const ignorePatterns = [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/out/**',
        '**/.vite/**',
        '**/.vscode/**',
        '**/.idea/**',
      ];

      const results = await fg(patterns, {
        cwd: normalizedPath,
        ignore: ignorePatterns,
        onlyFiles: true,
        markDirectories: false,
        absolute: false,
        suppressErrors: true,
        stats: false,
        dot: request.includeHidden !== false,
        caseSensitiveMatch: false,
      });

      const limitedResults = results.slice(0, maxResults);
      const entries: FileSystemEntry[] = [];

      for (const resultPath of limitedResults) {
        try {
          const absolutePath = path.join(normalizedPath, resultPath);
          const stat = await fs.stat(absolutePath);
          const relativePath = resultPath;

          entries.push({
            name: relativePath,
            path: absolutePath,
            isDirectory: stat.isDirectory(),
            isFile: stat.isFile(),
          });
        } catch (err) {
          log.debug(`Failed to stat ${resultPath}:`, err);
        }
      }

      entries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });

      return {
        entries,
        query: request.query,
        totalFound: results.length,
      };
    } catch (error) {
      log.error('Failed to search workspace:', error);
      throw error;
    }
  }

  registerHandlers(): void {
    // Open file
    ipcMain.handle(IPC_CHANNELS.FILE_OPEN, async (_event: IpcMainInvokeEvent, filePath: string) => {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        log.info(`Opened file: ${filePath}`);
        return content;
      } catch (error) {
        log.error('Failed to open file:', error);
        throw error;
      }
    });

    // Save file
    ipcMain.handle(
      IPC_CHANNELS.FILE_SAVE,
      async (_event: IpcMainInvokeEvent, filePath: string, content: string) => {
        try {
          await fs.writeFile(filePath, content, 'utf-8');
          log.info(`Saved file: ${filePath}`);
        } catch (error) {
          log.error('Failed to save file:', error);
          throw error;
        }
      }
    );

    // Save file as
    ipcMain.handle(
      IPC_CHANNELS.FILE_SAVE_AS,
      async (event: IpcMainInvokeEvent, content: string, defaultPath?: string) => {
        try {
          const window = BrowserWindow.fromWebContents(event.sender);
          if (!window) {
            throw new Error('No window found');
          }

          const options: Electron.SaveDialogOptions = {
            filters: [
              { name: 'Text Files', extensions: ['txt', 'md'] },
              { name: 'All Files', extensions: ['*'] },
            ],
          };

          if (defaultPath) {
            options.defaultPath = defaultPath;
          }

          const result = await dialog.showSaveDialog(window, options);

          if (!result.canceled && result.filePath) {
            await fs.writeFile(result.filePath, content, 'utf-8');
            log.info(`Saved file as: ${result.filePath}`);
            return result.filePath;
          }

          return null;
        } catch (error) {
          log.error('Failed to save file as:', error);
          throw error;
        }
      }
    );

    // Open folder
    ipcMain.handle(
      IPC_CHANNELS.FOLDER_OPEN,
      async (_event: IpcMainInvokeEvent, folderPath: string) => {
        try {
          await shell.openPath(folderPath);
          log.info(`Opened folder: ${folderPath}`);
        } catch (error) {
          log.error('Failed to open folder:', error);
          throw error;
        }
      }
    );

    // Dialog: Open file
    ipcMain.handle(
      IPC_CHANNELS.DIALOG_OPEN_FILE,
      async (event: IpcMainInvokeEvent, options?: Electron.OpenDialogOptions) => {
        try {
          const window = BrowserWindow.fromWebContents(event.sender);
          if (!window) {
            throw new Error('No window found');
          }

          const defaultOptions: Electron.OpenDialogOptions = {
            properties: ['openFile'],
            filters: [
              {
                name: 'All Supported',
                extensions: [
                  'txt',
                  'md',
                  'json',
                  'jpg',
                  'jpeg',
                  'png',
                  'gif',
                  'pdf',
                  'doc',
                  'docx',
                ],
              },
              { name: 'Documents', extensions: ['txt', 'md', 'pdf', 'doc', 'docx'] },
              { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'] },
              { name: 'All Files', extensions: ['*'] },
            ],
          };

          const result = await dialog.showOpenDialog(window, { ...defaultOptions, ...options });

          if (!result.canceled && result.filePaths.length > 0) {
            log.info(`Selected files: ${result.filePaths.join(', ')}`);
            return result.filePaths;
          }

          return null;
        } catch (error) {
          log.error('Failed to show open dialog:', error);
          throw error;
        }
      }
    );

    // Dialog: Save file
    ipcMain.handle(
      IPC_CHANNELS.DIALOG_SAVE_FILE,
      async (event: IpcMainInvokeEvent, options?: Electron.SaveDialogOptions) => {
        try {
          const window = BrowserWindow.fromWebContents(event.sender);
          if (!window) {
            throw new Error('No window found');
          }

          const defaultOptions: Electron.SaveDialogOptions = {
            filters: [
              { name: 'Text Files', extensions: ['txt', 'md'] },
              { name: 'JSON Files', extensions: ['json'] },
              { name: 'All Files', extensions: ['*'] },
            ],
          };

          const result = await dialog.showSaveDialog(window, { ...defaultOptions, ...options });

          if (!result.canceled && result.filePath) {
            log.info(`Save path selected: ${result.filePath}`);
            return result.filePath;
          }

          return null;
        } catch (error) {
          log.error('Failed to show save dialog:', error);
          throw error;
        }
      }
    );

    // Dialog: Message box
    ipcMain.handle(
      IPC_CHANNELS.DIALOG_MESSAGE,
      async (event: IpcMainInvokeEvent, options: Electron.MessageBoxOptions) => {
        try {
          const window = BrowserWindow.fromWebContents(event.sender);
          if (!window) {
            throw new Error('No window found');
          }

          const result = await dialog.showMessageBox(window, options);
          log.info(`Message box response: ${result.response}`);
          return result;
        } catch (error) {
          log.error('Failed to show message box:', error);
          throw error;
        }
      }
    );

    // List directory contents
    ipcMain.handle(IpcChannelNames.FILE_LIST_DIRECTORY, this.listDirectory.bind(this));

    // Search workspace
    ipcMain.handle(IpcChannelNames.FILE_SEARCH_WORKSPACE, this.searchWorkspace.bind(this));

    // Check if path exists
    ipcMain.handle('file:pathExists', async (_event: IpcMainInvokeEvent, filePath: string) => {
      try {
        // Expand ~ to home directory
        let expandedPath = filePath;
        if (filePath.startsWith('~')) {
          expandedPath = path.join(os.homedir(), filePath.slice(1));
        }

        await fs.access(expandedPath);
        return true;
      } catch (error) {
        return false;
      }
    });
  }
}
