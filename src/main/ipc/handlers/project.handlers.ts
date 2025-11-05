import {
  DirectoryListingRequest,
  DirectoryListingResponse,
  FileSystemEntry,
  IPC_CHANNELS,
  IpcChannelNames,
  WorkspaceSearchRequest,
  WorkspaceSearchResponse,
} from '@/types/ipc.types';
import { Resource, ResourceType } from '@/entities';
import { BrowserWindow, IpcMainInvokeEvent, dialog, shell, app } from 'electron';
import log from 'electron-log';
import fg from 'fast-glob';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';
import { registerSafeHandler } from '../safeHandlerWrapper';

interface ResourceStore {
  resources: Resource[];
}

interface UploadMetadata {
  mimeType?: string;
  width?: number;
  height?: number;
  duration?: number;
  pages?: number;
  language?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * ProjectHandlers class
 * Consolidated IPC handler for project-related operations including file system
 * access and resource management.
 *
 * @remarks
 * This handler consolidates functionality from:
 * - FileHandlers.ts (file I/O, directory navigation, workspace search)
 * - ResourceHandlers.ts (file uploads, resource storage and retrieval)
 *
 * Key responsibilities:
 * - File operations (read, write, save dialogs)
 * - Directory listing and workspace search with .gitignore support
 * - Resource lifecycle management (upload, delete, preview)
 * - Native OS dialogs for file selection
 *
 * @example
 * ```typescript
 * const handlers = new ProjectHandlers();
 * handlers.registerHandlers();
 * ```
 */
export class ProjectHandlers {
  private store: Store<ResourceStore>;
  private _resourcesPath?: string;

  constructor() {
    this.store = new Store<ResourceStore>({
      name: 'resources',
      defaults: {
        resources: [],
      },
    });

    // Initialize resources directory asynchronously
    void this.ensureResourcesDirectory();
  }

  /**
   * Lazy getter for resources path (allows mocking in tests)
   */
  private get resourcesPath(): string {
    if (!this._resourcesPath) {
      this._resourcesPath = path.join(app.getPath('userData'), 'resources');
    }
    return this._resourcesPath;
  }

  /**
   * Ensure the resources directory exists
   */
  private async ensureResourcesDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.resourcesPath, { recursive: true });
    } catch (error) {
      log.error('[ProjectHandlers] Failed to create resources directory:', error as Error);
    }
  }

  /**
   * Determine resource type based on MIME type and file extension
   */
  private getResourceType(mimeType: string, extension: string): ResourceType {
    if (mimeType.startsWith('image/')) return ResourceType.IMAGE;
    if (mimeType.startsWith('video/')) return ResourceType.VIDEO;
    if (mimeType.startsWith('audio/')) return ResourceType.AUDIO;

    const codeExtensions = [
      '.js',
      '.ts',
      '.tsx',
      '.jsx',
      '.py',
      '.java',
      '.cpp',
      '.c',
      '.h',
      '.css',
      '.html',
      '.json',
      '.xml',
    ];
    if (codeExtensions.includes(extension)) return ResourceType.CODE;

    const documentExtensions = ['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf'];
    if (documentExtensions.includes(extension)) return ResourceType.DOCUMENT;

    const archiveExtensions = ['.zip', '.rar', '.7z', '.tar', '.gz'];
    if (archiveExtensions.includes(extension)) return ResourceType.ARCHIVE;

    return ResourceType.OTHER;
  }

  /**
   * List all files and directories in the specified path
   */
  async listDirectory(
    __event: IpcMainInvokeEvent,
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
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });

      return {
        entries,
        currentPath: normalizedPath,
      };
    } catch (error) {
      log.error('[ProjectHandlers] Failed to list directory:', error);
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
          if (pattern.startsWith('!')) {
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

      log.debug('[ProjectHandlers] Loaded .gitignore patterns:', {
        count: gitignorePatterns.length,
        patterns: gitignorePatterns.slice(0, 10),
      });

      return [...baseIgnorePatterns, ...gitignorePatterns];
    } catch (error) {
      log.debug(
        '[ProjectHandlers] No .gitignore found or error reading it, using base patterns only'
      );
      return baseIgnorePatterns;
    }
  }

  /**
   * Search for files and directories in the workspace matching a query
   */
  async searchWorkspace(
    __event: IpcMainInvokeEvent,
    request: WorkspaceSearchRequest
  ): Promise<WorkspaceSearchResponse> {
    try {
      const normalizedPath = path.resolve(request.workspacePath);
      const maxResults = request.maxResults || 100;
      const query = request.query.toLowerCase();

      log.debug('[ProjectHandlers] searchWorkspace called:', {
        workspacePath: normalizedPath,
        query: request.query,
        maxResults,
      });

      const patterns = query ? [`**/*${query}*`] : ['**/*'];
      const allPatterns = await this.readGitignorePatterns(normalizedPath);

      const ignorePatterns = allPatterns.filter((p) => !p.startsWith('!'));
      const negationPatterns = allPatterns.filter((p) => p.startsWith('!')).map((p) => p.slice(1));

      log.debug('[ProjectHandlers] Using patterns:', {
        searchPatterns: patterns,
        ignorePatternCount: ignorePatterns.length,
        negationPatternCount: negationPatterns.length,
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

      log.debug('[ProjectHandlers] Glob results:', {
        totalFound: results.length,
        maxResults,
        willBeLimited: results.length > maxResults,
      });

      let whitelistedResults: string[] = [];
      if (negationPatterns.length > 0) {
        const rawWhitelistedResults = await fg(negationPatterns, {
          cwd: normalizedPath,
          ignore: [],
          onlyFiles: true,
          markDirectories: false,
          absolute: false,
          suppressErrors: true,
          stats: false,
          dot: true,
          caseSensitiveMatch: false,
        });

        whitelistedResults = query
          ? rawWhitelistedResults.filter((file) => file.toLowerCase().includes(query))
          : rawWhitelistedResults;

        log.debug('[ProjectHandlers] Whitelist results:', {
          whitelistedCount: whitelistedResults.length,
        });
      }

      const allResults = [...new Set([...results, ...whitelistedResults])];
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
          log.debug(`[ProjectHandlers] Failed to stat ${resultPath}:`, err);
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
        totalFound: allResults.length,
      };
    } catch (error) {
      log.error('[ProjectHandlers] Failed to search workspace:', error);
      throw error;
    }
  }

  /**
   * Register all IPC handlers for project operations
   */
  registerHandlers(): void {
    // File: Open file
    registerSafeHandler(
      IPC_CHANNELS.FILE_OPEN,
      async (__event: IpcMainInvokeEvent, filePath: string) => {
        const content = await fs.readFile(filePath, 'utf-8');
        log.info(`[ProjectHandlers] Opened file: ${filePath}`);
        return content;
      },
      { operationName: 'Open file' }
    );

    // File: Save file
    registerSafeHandler(
      IPC_CHANNELS.FILE_SAVE,
      async (__event: IpcMainInvokeEvent, filePath: string, content: string) => {
        await fs.writeFile(filePath, content, 'utf-8');
        log.info(`[ProjectHandlers] Saved file: ${filePath}`);
      },
      { operationName: 'Save file' }
    );

    // File: Save file as
    registerSafeHandler(
      IPC_CHANNELS.FILE_SAVE_AS,
      async (event: IpcMainInvokeEvent, content: string, defaultPath?: string) => {
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
          log.info(`[ProjectHandlers] Saved file as: ${result.filePath}`);
          return result.filePath;
        }

        return null;
      },
      { operationName: 'Save file as' }
    );

    // File: Open folder
    registerSafeHandler(
      IPC_CHANNELS.FOLDER_OPEN,
      async (__event: IpcMainInvokeEvent, folderPath: string) => {
        await shell.openPath(folderPath);
        log.info(`[ProjectHandlers] Opened folder: ${folderPath}`);
      },
      { operationName: 'Open folder' }
    );

    // Dialog: Open file
    registerSafeHandler(
      IPC_CHANNELS.DIALOG_OPEN_FILE,
      async (event: IpcMainInvokeEvent, options?: Electron.OpenDialogOptions) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) {
          throw new Error('No window found');
        }

        const defaultOptions: Electron.OpenDialogOptions = {
          properties: ['openFile'],
          filters: [
            {
              name: 'All Supported',
              extensions: ['txt', 'md', 'json', 'jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx'],
            },
            { name: 'Documents', extensions: ['txt', 'md', 'pdf', 'doc', 'docx'] },
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        };

        const result = await dialog.showOpenDialog(window, { ...defaultOptions, ...options });

        if (!result.canceled && result.filePaths.length > 0) {
          log.info(`[ProjectHandlers] Selected files: ${result.filePaths.join(', ')}`);
          return result.filePaths;
        }

        return null;
      },
      { operationName: 'Open file dialog' }
    );

    // Dialog: Save file
    registerSafeHandler(
      IPC_CHANNELS.DIALOG_SAVE_FILE,
      async (event: IpcMainInvokeEvent, options?: Electron.SaveDialogOptions) => {
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
          log.info(`[ProjectHandlers] Save path selected: ${result.filePath}`);
          return result.filePath;
        }

        return null;
      },
      { operationName: 'Save file dialog' }
    );

    // Dialog: Message box
    registerSafeHandler(
      IPC_CHANNELS.DIALOG_MESSAGE,
      async (event: IpcMainInvokeEvent, options: Electron.MessageBoxOptions) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) {
          throw new Error('No window found');
        }

        const result = await dialog.showMessageBox(window, options);
        log.info(`[ProjectHandlers] Message box response: ${result.response}`);
        return result;
      },
      { operationName: 'Show message box' }
    );

    // File: List directory contents
    registerSafeHandler(IpcChannelNames.FILE_LIST_DIRECTORY, this.listDirectory.bind(this), {
      operationName: 'List directory',
    });

    // File: Search workspace
    registerSafeHandler(IpcChannelNames.FILE_SEARCH_WORKSPACE, this.searchWorkspace.bind(this), {
      operationName: 'Search workspace',
    });

    // File: Check if path exists
    registerSafeHandler(
      'file:pathExists',
      async (__event: IpcMainInvokeEvent, filePath: string) => {
        try {
          let expandedPath = filePath;
          if (filePath.startsWith('~')) {
            expandedPath = path.join(os.homedir(), filePath.slice(1));
          }

          await fs.access(expandedPath);
          return true;
        } catch (error) {
          return false;
        }
      },
      { operationName: 'Check path exists' }
    );

    // Resource: Load resources by IDs
    registerSafeHandler(
      IPC_CHANNELS.RESOURCES_LOAD_BY_IDS,
      async (_event: IpcMainInvokeEvent, ids: string[]): Promise<Resource[]> => {
        const allResources = this.store.get('resources', []);
        const resources = allResources.filter((r) => ids.includes(r.id));
        log.info(`[ProjectHandlers] Loaded ${resources.length} resources`);
        return resources;
      },
      { operationName: 'Load resources by IDs' }
    );

    // Resource: Upload resource
    registerSafeHandler(
      IPC_CHANNELS.RESOURCES_UPLOAD,
      async (
        _event: IpcMainInvokeEvent,
        filePath: string,
        metadata?: UploadMetadata
      ): Promise<Resource> => {
        const stats = await fs.stat(filePath);
        const fileName = path.basename(filePath);
        const extension = path.extname(filePath).toLowerCase();
        const mimeType = metadata?.mimeType || 'application/octet-stream';

        const resourceId = uuidv4();
        const resourceFileName = `${resourceId}${extension}`;
        const resourcePath = path.join(this.resourcesPath, resourceFileName);

        await fs.copyFile(filePath, resourcePath);

        const newResource: Resource = {
          id: resourceId,
          name: fileName,
          type: this.getResourceType(mimeType, extension),
          path: resourcePath,
          size: stats.size,
          mimeType,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: metadata || {},
        };

        const resources = this.store.get('resources', []);
        resources.push(newResource);
        this.store.set('resources', resources);

        log.info(`[ProjectHandlers] Uploaded resource: ${newResource.id}`);
        return newResource;
      },
      { operationName: 'Upload resource' }
    );

    // Resource: Delete resource
    registerSafeHandler(
      IPC_CHANNELS.RESOURCES_DELETE,
      async (__event: IpcMainInvokeEvent, id: string): Promise<void> => {
        const resources = this.store.get('resources', []);
        const resource = resources.find((r) => r.id === id);

        if (!resource) {
          throw new Error(`Resource not found: ${id}`);
        }

        try {
          await fs.unlink(resource.path);
        } catch (error) {
          log.warn('[ProjectHandlers] Failed to delete resource file', error as Error);
        }

        const filtered = resources.filter((r) => r.id !== id);
        this.store.set('resources', filtered);

        log.info(`[ProjectHandlers] Deleted resource: ${id}`);
        return;
      },
      { operationName: 'Delete resource' }
    );

    // Resource: Open resource
    registerSafeHandler(
      IPC_CHANNELS.RESOURCES_OPEN,
      async (__event: IpcMainInvokeEvent, resourcePath: string): Promise<void> => {
        await shell.openPath(resourcePath);
        log.info(`[ProjectHandlers] Opened resource: ${resourcePath}`);
      },
      { operationName: 'Open resource' }
    );

    // Resource: Preview resource (return base64 for images)
    registerSafeHandler(
      IPC_CHANNELS.RESOURCES_PREVIEW,
      async (__event: IpcMainInvokeEvent, id: string): Promise<string> => {
        const resources = this.store.get('resources', []);
        const resource = resources.find((r) => r.id === id);

        if (!resource) {
          throw new Error(`Resource not found: ${id}`);
        }

        const buffer = await fs.readFile(resource.path);
        const base64 = buffer.toString('base64');
        return `data:${resource.mimeType};base64,${base64}`;
      },
      { operationName: 'Preview resource' }
    );
  }
}
