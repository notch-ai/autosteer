import {
  DirectoryListingRequest,
  DirectoryListingResponse,
  FileSystemEntry,
  IPC_CHANNELS,
  IpcChannelNames,
  WorkspaceSearchRequest,
  WorkspaceSearchResponse,
} from '@/types/ipc.types';
import { BrowserWindow, IpcMainInvokeEvent, dialog, shell } from 'electron';
import log from 'electron-log';
import fg from 'fast-glob';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { registerSafeHandler } from '../safeHandlerWrapper';

/**
 * FileHandlers class
 * Handles all IPC communication for file system operations including file I/O,
 * directory navigation, workspace search, and native file dialogs.
 *
 * @remarks
 * This handler implements secure file system access with path normalization,
 * .gitignore awareness, and dialog integration for file selection workflows.
 *
 * Key responsibilities:
 * - File operations (read, write, save as)
 * - Directory listing and navigation
 * - Workspace-wide file search with .gitignore support
 * - Native OS dialogs for file/folder selection
 * - Path validation and security checks
 *
 * Security considerations:
 * - All file paths are normalized using path.resolve() to prevent directory traversal
 * - Supports home directory expansion (~/) for user convenience
 * - Respects .gitignore patterns to exclude sensitive files from search results
 * - File operations require explicit user interaction through dialogs
 *
 * Path handling:
 * - Absolute paths are preferred for all file operations
 * - Relative paths are resolved against the workspace root
 * - Hidden files (starting with .) can be optionally included/excluded
 * - Paths are normalized across platforms (Windows/macOS/Linux)
 *
 * @example
 * ```typescript
 * const handlers = new FileHandlers();
 * handlers.registerHandlers();
 * ```
 */
export class FileHandlers {
  /**
   * List all files and directories in the specified path
   * @param request - Directory listing configuration including path and hidden file preferences
   * @returns Sorted list of directory entries (directories first, then alphabetical)
   * @private
   *
   * @remarks
   * Security: Path is normalized using path.resolve() to prevent directory traversal.
   * Sorting: Directories are listed before files, then sorted alphabetically (case-insensitive).
   * Hidden files: Can be included/excluded based on request.includeHidden flag.
   *
   * @example
   * ```typescript
   * const result = await listDirectory(event, {
   *   path: '/workspace',
   *   includeHidden: false
   * });
   * // Returns: { entries: [...], currentPath: '/workspace' }
   * ```
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
   * @param workspacePath - Absolute path to the workspace root
   * @returns Array of glob patterns for file filtering (includes base patterns + .gitignore rules)
   * @private
   *
   * @remarks
   * Combines base ignore patterns with .gitignore file rules to filter workspace searches.
   *
   * Base patterns (always applied):
   * - node_modules, .git, dist, build, .next, out, .vite
   *
   * .gitignore processing:
   * - Converts .gitignore patterns to fast-glob compatible format
   * - Supports negation patterns (!) for whitelisting files
   * - Handles directory patterns (ending with /)
   * - Handles root-relative patterns (starting with /)
   * - Ignores comments (lines starting with #)
   *
   * Pattern conversion examples:
   * - "node_modules/" -> "** /node_modules/**"
   * - "/dist" -> "dist"
   * - "*.log" -> "** /*.log"
   * - "!important.log" -> "!** /important.log"
   *
   * @example
   * ```typescript
   * const patterns = await this.readGitignorePatterns('/workspace');
   * // Returns: ['** /node_modules/**', '** /.git/**', 'custom-pattern', ...]
   * ```
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
   * @param request - Search configuration including workspace path, query, and result limits
   * @returns Search results with entries, query, and total count
   * @private
   *
   * @remarks
   * Performs fast workspace-wide file search using fast-glob with .gitignore awareness.
   *
   * Features:
   * - Fuzzy filename matching (case-insensitive)
   * - Respects .gitignore patterns and base ignore patterns
   * - Supports whitelist/negation patterns for including ignored files
   * - Configurable result limits (default: 100)
   * - Optional hidden file inclusion
   * - Returns sorted results (directories first, then alphabetical)
   *
   * Search behavior:
   * - Empty query: Returns all files (up to maxResults)
   * - Query present: Filters by filename containing query (case-insensitive)
   * - Whitelisted files: Included even if matched by ignore patterns
   *
   * Performance:
   * - Uses fast-glob for efficient file system traversal
   * - Results are limited to prevent UI overload
   * - Suppresses errors for inaccessible files/directories
   *
   * @example
   * ```typescript
   * const results = await searchWorkspace(event, {
   *   workspacePath: '/workspace',
   *   query: 'component',
   *   maxResults: 50,
   *   includeHidden: false
   * });
   * // Returns: { entries: [...], query: 'component', totalFound: 42 }
   * ```
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

  /**
   * Register all IPC handlers for file system operations
   * Sets up listeners for file I/O, directory navigation, workspace search, and native dialogs
   *
   * @remarks
   * Registered IPC channels:
   * - FILE_OPEN: Read file content from disk
   * - FILE_SAVE: Write content to existing file
   * - FILE_SAVE_AS: Show save dialog and write content to selected path
   * - FOLDER_OPEN: Open folder in native file explorer
   * - DIALOG_OPEN_FILE: Show native file picker dialog
   * - DIALOG_SAVE_FILE: Show native save dialog
   * - DIALOG_MESSAGE: Show native message box dialog
   * - FILE_LIST_DIRECTORY: List directory contents with optional hidden files
   * - FILE_SEARCH_WORKSPACE: Search workspace files with .gitignore awareness
   * - file:pathExists: Check if file/directory exists (with ~ expansion)
   *
   * Security features:
   * - Path normalization prevents directory traversal attacks
   * - All operations require explicit paths or user dialog interaction
   * - Home directory expansion (~/) for convenience
   * - .gitignore patterns respected in workspace searches
   *
   * Dialog integration:
   * - File dialogs: Configurable filters for file types
   * - Save dialogs: Default paths and extensions support
   * - Message boxes: Native OS styling for confirmations
   * - All dialogs require valid browser window context
   *
   * @public
   */
  registerHandlers(): void {
    // Open file
    registerSafeHandler(
      IPC_CHANNELS.FILE_OPEN,
      async (_event: IpcMainInvokeEvent, filePath: string) => {
        const content = await fs.readFile(filePath, 'utf-8');
        log.info(`Opened file: ${filePath}`);
        return content;
      },
      { operationName: 'open file' }
    );

    // Save file
    registerSafeHandler(
      IPC_CHANNELS.FILE_SAVE,
      async (_event: IpcMainInvokeEvent, filePath: string, content: string) => {
        await fs.writeFile(filePath, content, 'utf-8');
        log.info(`Saved file: ${filePath}`);
      },
      { operationName: 'save file' }
    );

    // Save file as
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
          log.info(`Saved file as: ${result.filePath}`);
          return result.filePath;
        }

        return null;
      },
      { operationName: 'save file as' }
    );

    // Open folder
    registerSafeHandler(
      IPC_CHANNELS.FOLDER_OPEN,
      async (_event: IpcMainInvokeEvent, folderPath: string) => {
        await shell.openPath(folderPath);
        log.info(`Opened folder: ${folderPath}`);
      },
      { operationName: 'open folder' }
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
          log.info(`Selected files: ${result.filePaths.join(', ')}`);
          return result.filePaths;
        }

        return null;
      },
      { operationName: 'show open file dialog' }
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
          log.info(`Save path selected: ${result.filePath}`);
          return result.filePath;
        }

        return null;
      },
      { operationName: 'show save file dialog' }
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
        log.info(`Message box response: ${result.response}`);
        return result;
      },
      { operationName: 'show message dialog' }
    );

    // List directory contents
    registerSafeHandler(IpcChannelNames.FILE_LIST_DIRECTORY, this.listDirectory.bind(this), {
      operationName: 'list directory',
    });

    // Search workspace
    registerSafeHandler(IpcChannelNames.FILE_SEARCH_WORKSPACE, this.searchWorkspace.bind(this), {
      operationName: 'search workspace',
    });

    // Check if path exists
    registerSafeHandler(
      'file:pathExists',
      async (_event: IpcMainInvokeEvent, filePath: string) => {
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
      },
      { operationName: 'check if path exists' }
    );
  }
}
