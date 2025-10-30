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
   * Read and parse .gitignore file patterns
   */
  private async readGitignorePatterns(workspacePath: string): Promise<string[]> {
    const gitignorePath = path.join(workspacePath, '.gitignore');
    const baseIgnorePatterns = [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/out/**',
      '**/.vite/**',
    ];

    try {
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
      const gitignorePatterns = gitignoreContent
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((pattern) => {
          // Handle negation patterns - fast-glob uses ! prefix for negation
          if (pattern.startsWith('!')) {
            // Keep the ! prefix, it's handled by fast-glob
            const negatedPattern = pattern.slice(1);
            if (negatedPattern.endsWith('/')) {
              return `!**/${negatedPattern}**`;
            }
            if (negatedPattern.startsWith('/')) {
              return `!${negatedPattern.slice(1)}`;
            }
            if (!negatedPattern.includes('/')) {
              return `!**/${negatedPattern}`;
            }
            return `!${negatedPattern}`;
          }

          // Regular patterns
          if (pattern.endsWith('/')) {
            return `**/${pattern}**`;
          }
          if (pattern.startsWith('/')) {
            return pattern.slice(1);
          }
          if (!pattern.includes('/')) {
            return `**/${pattern}`;
          }
          return pattern;
        });

      log.debug('Loaded .gitignore patterns:', {
        count: gitignorePatterns.length,
        patterns: gitignorePatterns.slice(0, 10),
      });

      return [...baseIgnorePatterns, ...gitignorePatterns];
    } catch (error) {
      log.debug('No .gitignore found or error reading it, using base patterns only');
      return baseIgnorePatterns;
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

      log.debug('[FileHandlers] searchWorkspace called:', {
        workspacePath: normalizedPath,
        query: request.query,
        maxResults,
      });

      const patterns = query ? [`**/*${query}*`] : ['**/*'];

      const allPatterns = await this.readGitignorePatterns(normalizedPath);

      // Separate negation patterns (whitelist) from ignore patterns
      const ignorePatterns = allPatterns.filter((p) => !p.startsWith('!'));
      const negationPatterns = allPatterns.filter((p) => p.startsWith('!')).map((p) => p.slice(1)); // Remove the ! prefix to get the whitelist patterns

      log.debug('[FileHandlers] Using patterns:', {
        searchPatterns: patterns,
        ignorePatternCount: ignorePatterns.length,
        negationPatternCount: negationPatterns.length,
        firstFewIgnorePatterns: ignorePatterns.slice(0, 5),
        firstFewNegationPatterns: negationPatterns.slice(0, 5),
      });

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

      log.debug('[FileHandlers] Glob results:', {
        totalFound: results.length,
        maxResults,
        willBeLimited: results.length > maxResults,
        firstFewResults: results.slice(0, 5),
      });

      // Also search for whitelisted files (negation patterns) that might have been filtered
      let whitelistedResults: string[] = [];
      if (negationPatterns.length > 0) {
        // Search for whitelisted files using the negation patterns directly
        const rawWhitelistedResults = await fg(negationPatterns, {
          cwd: normalizedPath,
          ignore: [], // Don't apply ignore patterns to whitelisted files
          onlyFiles: true,
          markDirectories: false,
          absolute: false,
          suppressErrors: true,
          stats: false,
          dot: true, // Whitelisted files should always include hidden files
          caseSensitiveMatch: false,
        });

        // Filter by query if one exists
        whitelistedResults = query
          ? rawWhitelistedResults.filter((file) => file.toLowerCase().includes(query))
          : rawWhitelistedResults;

        log.debug('[FileHandlers] Whitelist results:', {
          whitelistedCount: whitelistedResults.length,
          whitelistedFiles: whitelistedResults.slice(0, 10),
        });
      }

      // Merge and deduplicate results
      const allResults = [...new Set([...results, ...whitelistedResults])];

      log.debug('[FileHandlers] Combined results:', {
        totalFound: allResults.length,
        fromMainSearch: results.length,
        fromWhitelist: whitelistedResults.length,
      });

      const limitedResults = allResults.slice(0, maxResults);
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

      log.debug('[FileHandlers] Returning entries:', {
        entriesCount: entries.length,
        totalFound: results.length,
        firstFewEntries: entries.slice(0, 5).map((e) => e.name),
      });

      return {
        entries,
        query: request.query,
        totalFound: allResults.length,
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
