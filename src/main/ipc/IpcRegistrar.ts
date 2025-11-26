import { ApplicationContainer } from '@/services/ApplicationContainer';
import { BrowserWindow, IpcMainInvokeEvent, ipcMain, shell, nativeTheme, dialog } from 'electron';
import log from 'electron-log';
import { FileDataStoreService } from '@/services/FileDataStoreService';
import { GitService } from '@/services/GitService';
import * as fs from 'fs';
import { promisify } from 'util';
import * as os from 'os';
import * as path from 'path';
import { ErrorHandler } from '../utils/errorHandler';

const fsPromises = {
  access: promisify(fs.access),
  rm: promisify(fs.rm),
};
import { convertToFolderName } from '../utils/folderName';
import {
  ClaudeHandlers,
  ProjectHandlers,
  GitHandlers,
  SystemHandlers,
  IdeHandlers,
} from './handlers';
import { CacheHandlers } from './handlers/cache.handlers';
import { registerClaudeCodeHandlers } from './claudeCodeHandlers';
import { registerGitHandlers } from './gitHandlers';
import { registerAttachmentHandlers } from './attachmentHandlers';
import { UpdateService } from '@/services/UpdateService';

// Migrated from 13 specialized handlers to 6 domain handlers:
// - ClaudeHandlers (Agent, MCP, SlashCommand)
// - ProjectHandlers (File, Resource)
// - GitHandlers (GitDiff)
// - SystemHandlers (Terminal, Badge, Config, Log, Store, Update)
// - CacheHandlers
// - IdeHandlers (IDE detection and file opening)

/**
 * Centralized IPC registrar that replaces SimplifiedIpcManager, IpcManager, and IpcMigrationManager
 * Implements flat handler registration with domain:action naming pattern
 */
export class IpcRegistrar {
  private fileDataStore: FileDataStoreService;
  private gitService: GitService;
  private claudeHandlers: ClaudeHandlers;
  private projectHandlers: ProjectHandlers;
  private gitHandlers: GitHandlers;
  private systemHandlers: SystemHandlers;
  private cacheHandlers: CacheHandlers;
  private ideHandlers: IdeHandlers;

  constructor(private applicationContainer: ApplicationContainer) {
    this.fileDataStore = FileDataStoreService.getInstance();
    this.gitService = GitService.getInstance();
    this.claudeHandlers = new ClaudeHandlers();
    this.projectHandlers = new ProjectHandlers();
    this.gitHandlers = new GitHandlers();
    this.systemHandlers = new SystemHandlers();
    this.cacheHandlers = new CacheHandlers();
    this.ideHandlers = new IdeHandlers();
  }

  initialize(): void {
    try {
      // Register base handlers (app, settings, window, shell, theme, worktree, test-mode)
      this.registerHandlers();

      // Register 6 consolidated domain handlers
      this.claudeHandlers.registerHandlers();
      this.projectHandlers.registerHandlers();
      this.gitHandlers.registerHandlers();
      this.systemHandlers.registerHandlers();
      this.cacheHandlers.registerHandlers();
      this.ideHandlers.registerHandlers();

      // Specialized utility handlers (separate from domain handler consolidation)
      // These handle specific SDK/utility operations not part of core IPC domains
      registerClaudeCodeHandlers();
      registerGitHandlers();
      registerAttachmentHandlers();
    } catch (error) {
      log.error('[IpcRegistrar] Failed to initialize IPC handlers:', error);
      throw error;
    }
  }

  /**
   * Set the update service (called after UpdateService is initialized)
   */
  setUpdateService(updateService: UpdateService): void {
    this.systemHandlers.setUpdateService(updateService);
  }

  private registerHandlers(): void {
    // App info handlers
    ipcMain.handle('app:getVersion', () => {
      return this.applicationContainer.getAppVersion();
    });

    ipcMain.handle('app:getPlatform', () => {
      return process.platform;
    });

    // Settings handlers
    ipcMain.handle('settings:get', (_event: IpcMainInvokeEvent, key: string) => {
      try {
        return this.applicationContainer.getSettingsService().get(key);
      } catch (error) {
        log.error('Failed to get setting:', error);
        throw error;
      }
    });

    ipcMain.handle('settings:set', (_event: IpcMainInvokeEvent, key: string, value: unknown) => {
      try {
        this.applicationContainer.getSettingsService().set(key, value);
      } catch (error) {
        log.error('Failed to set setting:', error);
        throw error;
      }
    });

    ipcMain.handle('settings:getAll', () => {
      try {
        return this.applicationContainer.getSettingsService().getAll();
      } catch (error) {
        log.error('Failed to get all settings:', error);
        throw error;
      }
    });

    // Window handlers
    ipcMain.handle('window:minimize', (event: IpcMainInvokeEvent) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) {
        window.minimize();
      }
    });

    ipcMain.handle('window:maximize', (event: IpcMainInvokeEvent) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) {
        if (window.isMaximized()) {
          window.unmaximize();
        } else {
          window.maximize();
        }
      }
    });

    ipcMain.handle('window:close', (event: IpcMainInvokeEvent) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) {
        window.close();
      }
    });

    // Shell handlers
    ipcMain.handle('shell:openExternal', async (_event: IpcMainInvokeEvent, url: string) => {
      try {
        await shell.openExternal(url);
        return { success: true };
      } catch (error) {
        log.error('Failed to open external URL:', error);
        throw error;
      }
    });

    // Theme handlers
    ipcMain.handle('theme:get', () => {
      try {
        return this.applicationContainer.getSettingsService().get('theme') || 'system';
      } catch (error) {
        log.error('Failed to get theme:', error);
        return 'system';
      }
    });

    ipcMain.handle(
      'theme:set',
      (_event: IpcMainInvokeEvent, theme: 'light' | 'dark' | 'system') => {
        try {
          this.applicationContainer.getSettingsService().set('theme', theme);
        } catch (error) {
          log.error('Failed to set theme:', error);
          throw error;
        }
      }
    );

    ipcMain.handle('theme:getSystemPreference', () => {
      try {
        return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
      } catch (error) {
        log.error('Failed to get system theme preference:', error);
        return 'light';
      }
    });

    // Config handlers are now handled by ConfigHandlers.register()
    // Removed duplicate config:getDevMode and config:setDevMode handlers

    // Worktree handlers
    ipcMain.handle('worktree:getDataDirectory', async () => {
      await this.fileDataStore.ensureDirectories();
      return this.fileDataStore.getDataDirectory();
    });

    ipcMain.handle(
      'worktree:getCurrentDirectory',
      async (_event: IpcMainInvokeEvent, cwd?: string) => {
        if (cwd) {
          const homedir = os.homedir();
          let resolvedCwd = cwd;

          if (resolvedCwd.startsWith('~')) {
            resolvedCwd = path.join(homedir, resolvedCwd.slice(1));
          }
          if (!path.isAbsolute(resolvedCwd)) {
            resolvedCwd = path.join(homedir, '.autosteer', 'worktrees', resolvedCwd);
          }

          const autosteerDir = path.join(homedir, '.autosteer');
          const worktreesDir = path.join(autosteerDir, 'worktrees');

          if (!fs.existsSync(autosteerDir)) {
            fs.mkdirSync(autosteerDir, { recursive: true });
          }
          if (!fs.existsSync(worktreesDir)) {
            fs.mkdirSync(worktreesDir, { recursive: true });
          }

          if (!fs.existsSync(resolvedCwd)) {
            if (fs.existsSync(worktreesDir)) {
              resolvedCwd = worktreesDir;
            } else {
              resolvedCwd = process.cwd();
            }
          }

          return resolvedCwd;
        }

        return process.cwd();
      }
    );

    ipcMain.handle(
      'worktree:create',
      async (_event: IpcMainInvokeEvent, options: { githubRepo: string; branchName: string }) => {
        log.info('[worktree:create] Starting worktree creation:', {
          githubRepo: options.githubRepo,
          branchName: options.branchName,
        });
        try {
          const { githubRepo, branchName } = options;

          if (!githubRepo || !branchName) {
            log.error('[worktree:create] Missing required fields:', { githubRepo, branchName });
            throw new Error('GitHub repository URL and branch name are required');
          }

          if (!this.gitService.isValidGitUrl(githubRepo)) {
            log.error('Invalid Git URL:', githubRepo);
            throw new Error(
              'Invalid Git repository URL. Please use a valid GitHub, GitLab, or Bitbucket URL'
            );
          }

          await this.fileDataStore.ensureDirectories();

          const folderName = convertToFolderName(githubRepo, branchName);
          const worktreePath = this.fileDataStore.getWorktreePath(folderName);
          const exists = await this.fileDataStore.worktreeExists(folderName);

          log.info('[worktree:create] Worktree details:', {
            folderName,
            worktreePath,
            exists,
          });

          if (exists) {
            log.info('[worktree:create] Worktree exists, pulling latest changes');

            const pullResult = await this.gitService.pullLatest(worktreePath, branchName);

            if (!pullResult.success) {
              const errorMessage = ErrorHandler.log({
                operation: 'git pull',
                error: pullResult.error,
                context: { worktreePath, branchName },
              });

              return {
                success: false,
                message: ErrorHandler.formatUserMessage('pull latest changes', pullResult.error),
                error: errorMessage,
              };
            }

            // Ensure worktree is in config (handles case where directory exists but config was cleaned)
            log.info('[worktree:create] Ensuring worktree is in config');
            await this.fileDataStore.addWorktree({
              git_repo: githubRepo,
              branch_name: branchName,
              folder_name: folderName,
            });
            log.info('[worktree:create] Worktree added to config successfully');

            return {
              success: true,
              message: 'Updated existing worktree with latest changes',
              folderName,
              localPath: worktreePath,
            };
          } else {
            log.info('[worktree:create] Creating new worktree');
            const mainRepoPath = this.fileDataStore.getMainRepoPath(githubRepo);

            const worktreeResult = await this.gitService.createWorktree({
              repoUrl: githubRepo,
              mainRepoPath,
              worktreePath,
              branchName,
            });

            log.info('[worktree:create] Git worktree creation result:', {
              success: worktreeResult.success,
              error: worktreeResult.error,
            });

            if (!worktreeResult.success) {
              const errorMessage = ErrorHandler.log({
                operation: 'create worktree',
                error: worktreeResult.error,
                context: { githubRepo, branchName, worktreePath, mainRepoPath },
              });

              return {
                success: false,
                message: ErrorHandler.formatUserMessage('create worktree', worktreeResult.error),
                error: errorMessage,
              };
            }

            const worktreeCreated = await this.fileDataStore.worktreeExists(folderName);
            log.info('[worktree:create] Verifying worktree directory exists:', worktreeCreated);

            if (!worktreeCreated) {
              const error = new Error(
                'Git worktree creation appeared to succeed but worktree directory was not created'
              );
              ErrorHandler.log({
                operation: 'verify worktree',
                error,
                context: { githubRepo, branchName, worktreePath },
              });

              return {
                success: false,
                message: 'Failed to create worktree: Directory was not created',
                error: error.message,
              };
            }

            log.info('[worktree:create] About to call addWorktree with:', {
              git_repo: githubRepo,
              branch_name: branchName,
              folder_name: folderName,
            });

            await this.fileDataStore.addWorktree({
              git_repo: githubRepo,
              branch_name: branchName,
              folder_name: folderName,
            });

            log.info('[worktree:create] addWorktree completed successfully');

            return {
              success: true,
              message: 'Successfully created new worktree',
              folderName,
              localPath: worktreePath,
            };
          }
        } catch (error) {
          const errorMessage = ErrorHandler.log({
            operation: 'create worktree',
            error,
            context: { options },
          });

          return {
            success: false,
            message: ErrorHandler.formatUserMessage('create worktree', error),
            error: errorMessage,
          };
        }
      }
    );

    ipcMain.handle('worktree:delete', async (event: IpcMainInvokeEvent, folderName: string) => {
      try {
        const config = await this.fileDataStore.readConfig();
        const worktree = config.worktrees.find((w) => w.folder_name === folderName);

        if (!worktree) {
          throw new Error('Worktree not found in config');
        }

        const worktreePath = this.fileDataStore.getWorktreePath(folderName);
        const mainRepoPath = this.fileDataStore.getMainRepoPath(worktree.git_repo);
        const branchName = worktree.branch_name;

        // Check if branch is protected
        const isProtected = this.gitService.isProtectedBranch(branchName);
        if (isProtected) {
          log.info(`[worktree:delete] Branch "${branchName}" is protected, will not delete branch`);
        }

        // Initialize deleteBranch flag - don't delete protected branches
        let deleteBranch = false;

        // Only check for user confirmation if branch is not protected
        if (!isProtected) {
          // Check if local branch exists
          const localBranchExists = await this.gitService.localBranchExists(
            mainRepoPath,
            branchName
          );

          if (localBranchExists) {
            // Check for unpushed commits
            const unpushedCount = await this.gitService.getUnpushedCommitCount(
              mainRepoPath,
              branchName
            );

            log.debug(
              `[worktree:delete] Branch "${branchName}" has ${unpushedCount} unpushed commits`
            );

            // Build confirmation message
            let confirmMessage = `Delete branch "${branchName}"?\n\n`;
            confirmMessage += `This will:\n`;
            confirmMessage += `• Remove the worktree\n`;
            confirmMessage += `• Delete the local branch "${branchName}"\n`;
            confirmMessage += `• Delete the remote branch "${branchName}" (if it exists)\n`;

            if (unpushedCount > 0) {
              confirmMessage += `\n⚠️ WARNING: This branch has ${unpushedCount} unpushed commit${unpushedCount > 1 ? 's' : ''} that will be lost!`;
            }

            // Get the browser window for the dialog
            const window = BrowserWindow.fromWebContents(event.sender);
            if (!window) {
              log.warn('[worktree:delete] No window found for confirmation dialog');
            } else {
              // Show confirmation dialog
              const result = await dialog.showMessageBox(window, {
                type: 'warning',
                title: 'Delete Branch',
                message: 'Are you sure?',
                detail: confirmMessage,
                buttons: ['Cancel', 'Force Delete'],
                defaultId: 0,
                cancelId: 0,
              });

              log.info(
                `[worktree:delete] User choice: ${result.response === 1 ? 'Force Delete' : 'Cancel'}`
              );

              // If user cancelled, abort deletion
              if (result.response === 0) {
                log.info(`[worktree:delete] User cancelled deletion of branch "${branchName}"`);
                return {
                  success: false,
                  message: 'Deletion cancelled by user',
                };
              }

              // User chose "Force Delete"
              deleteBranch = true;
              log.info(`[worktree:delete] User confirmed deletion of branch "${branchName}"`);
            }
          }
        }

        // Remove worktree with branch deletion if confirmed
        const removeResult = await this.gitService.removeWorktree({
          mainRepoPath,
          worktreePath,
          branchName,
          deleteBranch,
        });

        if (!removeResult.success) {
          log.warn('[worktree:delete] Git worktree remove failed:', removeResult.error);
        }

        // Delete trace files for all sessions in this worktree
        try {
          const { SessionManifestService } = await import('@/services/SessionManifestService');
          const { TraceLogger } = await import('@/services/TraceLogger');

          const sessionManifest = SessionManifestService.getInstance();
          const traceLogger = TraceLogger.getInstance();

          // Get all session IDs for this worktree
          const sessions = await sessionManifest.getAllAgentSessions(folderName);
          const sessionIds = Object.values(sessions);

          // Delete trace files for all sessions
          if (sessionIds.length > 0) {
            await traceLogger.deleteTraceFiles(sessionIds);
            log.info(
              `Deleted trace files for ${sessionIds.length} sessions in worktree: ${folderName}`
            );
          }

          // Delete session manifest for this worktree
          await sessionManifest.deleteWorktreeManifest(folderName);
        } catch (error) {
          log.warn('Failed to delete trace files and session manifest:', error);
          // Don't fail the entire deletion if cleanup fails
        }

        // Delete Claude Code chat history (JSONL files) for this worktree
        try {
          const os = await import('os');
          const homedir = os.homedir();
          const homedirFormatted = homedir.substring(1).replace(/[^a-zA-Z0-9]/g, '-');
          const projectDirName = `-${homedirFormatted}--autosteer-worktrees-${folderName}`;
          const claudeProjectsDir = path.join(homedir, '.claude', 'projects', projectDirName);

          // Check if directory exists before attempting to delete
          try {
            await fsPromises.access(claudeProjectsDir, fs.constants.F_OK);
            await fsPromises.rm(claudeProjectsDir, { recursive: true, force: true });
            log.info(`Deleted Claude Code chat history for worktree: ${folderName}`);
          } catch (err) {
            log.debug(`No Claude Code chat history to delete for worktree: ${folderName}`);
          }
        } catch (error) {
          log.warn('Failed to delete Claude Code chat history:', error);
          // Don't fail the entire deletion if chat history cleanup fails
        }

        await this.fileDataStore.removeWorktree(folderName);

        return {
          success: true,
          message: 'Successfully removed worktree',
        };
      } catch (error) {
        const errorMessage = ErrorHandler.log({
          operation: 'delete worktree',
          error,
          context: { folderName },
        });

        return {
          success: false,
          message: ErrorHandler.formatUserMessage('delete worktree', error),
          error: errorMessage,
        };
      }
    });

    ipcMain.handle('worktree:getAll', async () => {
      try {
        const config = await this.fileDataStore.readConfig();
        return config.worktrees;
      } catch (error) {
        ErrorHandler.log({
          operation: 'get all worktrees',
          error,
        });
        return [];
      }
    });

    ipcMain.handle('worktree:getRepoUrls', async () => {
      try {
        const config = await this.fileDataStore.readConfig();
        const repoUrls = [...new Set(config.worktrees.map((w) => w.git_repo))];
        return repoUrls;
      } catch (error) {
        ErrorHandler.log({
          operation: 'get repo urls',
          error,
        });
        return [];
      }
    });

    ipcMain.handle('worktree:getVimMode', async () => {
      try {
        const config = await this.fileDataStore.readConfig();
        return config.settings?.vimMode ?? false;
      } catch (error) {
        ErrorHandler.log({
          operation: 'get vim mode',
          error,
        });
        return false;
      }
    });

    ipcMain.handle('worktree:setVimMode', async (_event: IpcMainInvokeEvent, enabled: boolean) => {
      try {
        const config = await this.fileDataStore.readConfig();
        if (!config.settings) {
          config.settings = {};
        }
        config.settings.vimMode = enabled;
        await this.fileDataStore.writeConfig(config);
        return { success: true };
      } catch (error) {
        const errorMessage = ErrorHandler.log({
          operation: 'set vim mode',
          error,
        });
        return { success: false, error: errorMessage };
      }
    });

    ipcMain.handle(
      'worktree:setActiveTab',
      async (_event: IpcMainInvokeEvent, projectId: string, tabId: string) => {
        try {
          console.log('[IPC] worktree:setActiveTab called', {
            projectId,
            tabId,
            isToolsTab: tabId === 'tools-tab',
          });

          const config = await this.fileDataStore.readConfig();

          // Find the worktree by folder_name (projectId is the folder_name)
          const worktree = config.worktrees?.find((wt) => wt.folder_name === projectId);

          if (worktree) {
            const oldActiveTabId = worktree.activeTabId;
            // Store activeTabId directly in the worktree object
            worktree.activeTabId = tabId;
            await this.fileDataStore.writeConfig(config);

            console.log('[IPC] worktree:setActiveTab SUCCESS', {
              projectId,
              oldActiveTabId,
              newActiveTabId: tabId,
              isToolsTab: tabId === 'tools-tab',
            });

            return { success: true };
          } else {
            console.error('[IPC] worktree:setActiveTab FAILED - worktree not found', {
              projectId,
              tabId,
            });
            return { success: false, error: `Worktree not found: ${projectId}` };
          }
        } catch (error) {
          const errorMessage = ErrorHandler.log({
            operation: 'set active tab',
            error,
            context: { projectId, tabId },
          });
          return { success: false, error: errorMessage };
        }
      }
    );

    ipcMain.handle(
      'worktree:getActiveTab',
      async (_event: IpcMainInvokeEvent, projectId: string) => {
        try {
          console.log('[IPC] worktree:getActiveTab called', { projectId });
          const config = await this.fileDataStore.readConfig();

          // Find the worktree by folder_name (projectId is the folder_name)
          const worktree = config.worktrees?.find((wt) => wt.folder_name === projectId);

          const activeTabId = worktree?.activeTabId ?? null;
          console.log('[IPC] worktree:getActiveTab result', {
            projectId,
            activeTabId,
            isToolsTab: activeTabId === 'tools-tab',
            worktreeFound: !!worktree,
          });

          return activeTabId;
        } catch (error) {
          console.error('[IPC] worktree:getActiveTab ERROR', { projectId, error });
          ErrorHandler.log({
            operation: 'get active tab',
            error,
            context: { projectId },
          });
          return null;
        }
      }
    );

    // Test mode handlers - provide fallback when test mode is not active
    ipcMain.handle('test-mode:getState', () => {
      return {
        isActive: false,
        currentComponent: null,
        componentProps: {},
        themeVariant: 'day',
      };
    });

    // Dialog handlers are registered in FileHandlers
  }

  dispose(): void {
    // Cleanup if needed
  }
}
