import { ApplicationContainer } from '@/services/ApplicationContainer';
import { BrowserWindow, IpcMainInvokeEvent, ipcMain, shell, nativeTheme } from 'electron';
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
import { AgentHandlers } from './handlers/AgentHandlers';
import { StoreHandlers } from './handlers/StoreHandlers';
import { SlashCommandHandlers } from './handlers/SlashCommandHandlers';
import { FileHandlers } from './handlers/FileHandlers';
import { ResourceHandlers } from './handlers/ResourceHandlers';
import { ConfigHandlers } from './handlers/ConfigHandlers';
import { BadgeHandlers } from './handlers/BadgeHandlers';
import { TerminalHandlers } from './handlers/TerminalHandlers';
import { McpHandlers } from './handlers/McpHandlers';
import { registerClaudeCodeHandlers } from './claudeCodeHandlers';
import { registerGitHandlers } from './gitHandlers';
import { registerAttachmentHandlers } from './attachmentHandlers';
import { registerGitDiffHandlers } from './handlers/GitDiffHandlers';

/**
 * Centralized IPC registrar that replaces SimplifiedIpcManager, IpcManager, and IpcMigrationManager
 * Implements flat handler registration with domain:action naming pattern
 */
export class IpcRegistrar {
  private fileDataStore: FileDataStoreService;
  private gitService: GitService;
  private agentHandlers: AgentHandlers;
  private storeHandlers: StoreHandlers;
  private slashCommandHandlers: SlashCommandHandlers;
  private fileHandlers: FileHandlers;
  private resourceHandlers: ResourceHandlers;
  private configHandlers: ConfigHandlers;
  private badgeHandlers: BadgeHandlers;
  private terminalHandlers: TerminalHandlers;
  private mcpHandlers: McpHandlers;

  constructor(private applicationContainer: ApplicationContainer) {
    this.fileDataStore = FileDataStoreService.getInstance();
    this.gitService = GitService.getInstance();
    this.agentHandlers = new AgentHandlers();
    this.storeHandlers = new StoreHandlers(ipcMain);
    this.slashCommandHandlers = new SlashCommandHandlers();
    this.fileHandlers = new FileHandlers();
    this.resourceHandlers = new ResourceHandlers();
    this.configHandlers = new ConfigHandlers(ipcMain);
    this.badgeHandlers = new BadgeHandlers();
    this.terminalHandlers = new TerminalHandlers();
    this.mcpHandlers = new McpHandlers();
  }

  initialize(): void {
    try {
      this.registerHandlers();

      // Register additional handlers
      this.agentHandlers.registerHandlers();
      this.storeHandlers.registerHandlers();
      this.slashCommandHandlers.registerHandlers();
      this.fileHandlers.registerHandlers();
      this.resourceHandlers.registerHandlers();
      this.configHandlers.register();
      this.badgeHandlers.registerHandlers(); // Register Badge handlers
      this.terminalHandlers.registerHandlers(); // Register Terminal handlers
      this.mcpHandlers.registerHandlers(); // Register MCP handlers
      registerClaudeCodeHandlers(); // Register Claude Code handlers
      registerGitHandlers(); // Register Git handlers
      registerGitDiffHandlers(); // Register Git Diff handlers
      registerAttachmentHandlers(); // Register Attachment handlers
      // LogHandlers.register() is already called in main.ts before app ready

      log.info('All IPC handlers registered');
    } catch (error) {
      log.error('Failed to initialize IPC handlers:', error);
      throw error;
    }
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

    ipcMain.handle('worktree:delete', async (_event: IpcMainInvokeEvent, folderName: string) => {
      try {
        const config = await this.fileDataStore.readConfig();
        const worktree = config.worktrees.find((w) => w.folder_name === folderName);

        if (!worktree) {
          throw new Error('Worktree not found in config');
        }

        const worktreePath = this.fileDataStore.getWorktreePath(folderName);
        const mainRepoPath = this.fileDataStore.getMainRepoPath(worktree.git_repo);

        const removeResult = await this.gitService.removeWorktree({
          mainRepoPath,
          worktreePath,
          branchName: worktree.branch_name,
        });

        if (!removeResult.success) {
          log.warn('Git worktree remove failed:', removeResult.error);
        }

        // Delete session manifest for this worktree
        try {
          const { SessionManifestService } = await import('@/services/SessionManifestService');
          const sessionManifest = SessionManifestService.getInstance();
          await sessionManifest.deleteWorktreeManifest(folderName);
        } catch (error) {
          log.warn('Failed to delete session manifest:', error);
          // Don't fail the entire deletion if session cleanup fails
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
          const config = await this.fileDataStore.readConfig();

          // Find the worktree by folder_name (projectId is the folder_name)
          const worktree = config.worktrees?.find((wt) => wt.folder_name === projectId);

          if (worktree) {
            // Store activeTabId directly in the worktree object
            worktree.activeTabId = tabId;
            await this.fileDataStore.writeConfig(config);
            return { success: true };
          } else {
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
          const config = await this.fileDataStore.readConfig();

          // Find the worktree by folder_name (projectId is the folder_name)
          const worktree = config.worktrees?.find((wt) => wt.folder_name === projectId);

          return worktree?.activeTabId ?? null;
        } catch (error) {
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
    log.debug('IpcRegistrar disposed');
  }
}
