import { ipcMain } from 'electron';
import { DiffHunk, DiffOptions, FileDiff, GitDiffService } from '../../services/GitDiffService';
import { log as logger } from '../../services/logger';

interface GetDiffParams {
  repoPath: string;
  from?: string;
  to?: string;
  filePath?: string;
  contextLines?: number;
}

interface GetFileContentParams {
  repoPath: string;
  filePath: string;
  ref?: string;
}

// Store active watchers by repo path
const activeWatchers = new Map<string, { service: GitDiffService; cleanup: () => void }>();

export function registerGitDiffHandlers(): void {
  logger.info('[GitDiffHandlers] Registering Git Diff IPC handlers');

  /**
   * Get diff between commits/branches
   */
  ipcMain.handle(
    'git-diff:get-diff',
    async (_event, params: GetDiffParams): Promise<FileDiff[]> => {
      try {
        const service = new GitDiffService(params.repoPath);
        const options: DiffOptions = {
          repoPath: params.repoPath,
          ...(params.from && { from: params.from }),
          ...(params.to && { to: params.to }),
          ...(params.filePath && { filePath: params.filePath }),
          ...(params.contextLines !== undefined && { contextLines: params.contextLines }),
        };

        return await service.getDiff(options);
      } catch (error) {
        logger.error('git-diff:get-diff failed:', error);
        throw error;
      }
    }
  );

  /**
   * Get uncommitted changes (working directory)
   */
  ipcMain.handle(
    'git-diff:get-uncommitted',
    async (_event, params: { repoPath: string; filePath?: string }): Promise<FileDiff[]> => {
      try {
        const service = new GitDiffService(params.repoPath);
        return await service.getUncommittedDiff(params.filePath);
      } catch (error) {
        logger.error('git-diff:get-uncommitted failed:', error);
        throw error;
      }
    }
  );

  /**
   * Get staged changes
   */
  ipcMain.handle(
    'git-diff:get-staged',
    async (_event, params: { repoPath: string; filePath?: string }): Promise<FileDiff[]> => {
      try {
        const service = new GitDiffService(params.repoPath);
        return await service.getStagedDiff(params.filePath);
      } catch (error) {
        logger.error('git-diff:get-staged failed:', error);
        throw error;
      }
    }
  );

  /**
   * Get list of conflicted files
   */
  ipcMain.handle('git-diff:get-conflicts', async (_event, repoPath: string): Promise<string[]> => {
    try {
      const service = new GitDiffService(repoPath);
      return await service.getConflictedFiles();
    } catch (error) {
      logger.error('git-diff:get-conflicts failed:', error);
      throw error;
    }
  });

  /**
   * Get file content at specific ref
   */
  ipcMain.handle(
    'git-diff:get-file-content',
    async (_event, params: GetFileContentParams): Promise<string> => {
      try {
        const service = new GitDiffService(params.repoPath);
        return await service.getFileContent(params.filePath, params.ref);
      } catch (error) {
        logger.error('git-diff:get-file-content failed:', error);
        throw error;
      }
    }
  );

  /**
   * Start watching for git changes
   */
  ipcMain.handle('git-diff:start-watching', async (event, repoPath: string): Promise<void> => {
    try {
      logger.info('[GitDiffHandlers] git-diff:start-watching called', {
        repoPath,
        timestamp: new Date().toISOString(),
      });

      // Stop existing watcher if any
      const existing = activeWatchers.get(repoPath);
      if (existing) {
        logger.info('[GitDiffHandlers] Stopping existing watcher for:', repoPath);
        existing.cleanup();
        activeWatchers.delete(repoPath);
      }

      const service = new GitDiffService(repoPath);

      // Start watching and setup callback
      logger.info('[GitDiffHandlers] Starting file watcher...');
      const cleanup = service.startWatching(() => {
        try {
          logger.info('[GitDiffHandlers] File change detected, notifying renderer', {
            repoPath,
            timestamp: new Date().toISOString(),
          });
          // Notify renderer of changes - let it refresh its own data
          event.sender.send('git-diff:changes-detected', { repoPath });
        } catch (error) {
          logger.error('Error in git watcher callback:', error);
        }
      });

      // Store watcher info
      activeWatchers.set(repoPath, { service, cleanup });

      logger.info(`[GitDiffHandlers] Started watching git changes for: ${repoPath}`, {
        activeWatchersCount: activeWatchers.size,
      });
    } catch (error) {
      logger.error('[GitDiffHandlers] git-diff:start-watching failed:', error);
      throw error;
    }
  });

  /**
   * Stop watching for git changes
   */
  ipcMain.handle('git-diff:stop-watching', async (_event, repoPath: string): Promise<void> => {
    try {
      logger.info('[GitDiffHandlers] git-diff:stop-watching called', {
        repoPath,
        timestamp: new Date().toISOString(),
      });

      const watcher = activeWatchers.get(repoPath);
      if (watcher) {
        watcher.cleanup();
        activeWatchers.delete(repoPath);
        logger.info(`[GitDiffHandlers] Stopped watching git changes for: ${repoPath}`, {
          activeWatchersCount: activeWatchers.size,
        });
      } else {
        logger.warn('[GitDiffHandlers] No watcher found for:', repoPath);
      }
    } catch (error) {
      logger.error('[GitDiffHandlers] git-diff:stop-watching failed:', error);
      throw error;
    }
  });

  /**
   * Discard all changes in a file
   */
  ipcMain.handle(
    'git-diff:discard-file',
    async (_event, params: { repoPath: string; filePath: string }): Promise<void> => {
      try {
        const service = new GitDiffService(params.repoPath);
        await service.discardFileChanges(params.filePath);
      } catch (error) {
        logger.error('git-diff:discard-file failed:', error);
        throw error;
      }
    }
  );

  /**
   * Discard changes in a specific hunk
   */
  ipcMain.handle(
    'git-diff:discard-hunk',
    async (
      _event,
      params: {
        repoPath: string;
        filePath: string;
        hunk: DiffHunk;
      }
    ): Promise<void> => {
      logger.info('[GitDiffHandlers] git-diff:discard-hunk called', {
        repoPath: params.repoPath,
        filePath: params.filePath,
        oldStart: params.hunk.oldStart,
        newStart: params.hunk.newStart,
      });
      try {
        const service = new GitDiffService(params.repoPath);
        await service.discardHunkChanges(params.filePath, params.hunk);
        logger.info('[GitDiffHandlers] git-diff:discard-hunk completed successfully');
      } catch (error) {
        logger.error('[GitDiffHandlers] git-diff:discard-hunk failed:', error);
        throw error;
      }
    }
  );

  /**
   * Discard specific lines within a file
   */
  ipcMain.handle(
    'git-diff:discard-lines',
    async (
      _event,
      params: {
        repoPath: string;
        filePath: string;
        lines: Array<{ lineNumber: number; type: 'add' | 'del' }>;
      }
    ): Promise<void> => {
      logger.info('[GitDiffHandlers] git-diff:discard-lines called', {
        repoPath: params.repoPath,
        filePath: params.filePath,
        lineCount: params.lines.length,
      });
      try {
        const service = new GitDiffService(params.repoPath);
        await service.discardLineChanges(params.filePath, params.lines);
        logger.info('[GitDiffHandlers] git-diff:discard-lines completed successfully');
      } catch (error) {
        logger.error('[GitDiffHandlers] git-diff:discard-lines failed:', error);
        throw error;
      }
    }
  );

  /**
   * Restore a deleted file from HEAD
   */
  ipcMain.handle(
    'git-diff:restore-file',
    async (_event, params: { repoPath: string; filePath: string }): Promise<void> => {
      try {
        const service = new GitDiffService(params.repoPath);
        await service.restoreDeletedFile(params.filePath);
      } catch (error) {
        logger.error('git-diff:restore-file failed:', error);
        throw error;
      }
    }
  );

  logger.info('Git diff IPC handlers registered');
}
