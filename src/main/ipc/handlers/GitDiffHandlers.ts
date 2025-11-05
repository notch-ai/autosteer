import { DiffHunk, DiffOptions, FileDiff, GitDiffService } from '../../services/GitDiffService';
import { log as logger } from '../../services/logger';
import { registerSafeHandler } from '../safeHandlerWrapper';

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
  registerSafeHandler(
    'git-diff:get-diff',
    async (_event, params: GetDiffParams): Promise<FileDiff[]> => {
      const service = new GitDiffService(params.repoPath);
      const options: DiffOptions = {
        repoPath: params.repoPath,
        ...(params.from && { from: params.from }),
        ...(params.to && { to: params.to }),
        ...(params.filePath && { filePath: params.filePath }),
        ...(params.contextLines !== undefined && { contextLines: params.contextLines }),
      };

      return await service.getDiff(options);
    },
    { operationName: 'Get Git Diff' }
  );

  /**
   * Get uncommitted changes (working directory)
   */
  registerSafeHandler(
    'git-diff:get-uncommitted',
    async (_event, params: { repoPath: string; filePath?: string }): Promise<FileDiff[]> => {
      const service = new GitDiffService(params.repoPath);
      return await service.getUncommittedDiff(params.filePath);
    },
    { operationName: 'Get Uncommitted Changes' }
  );

  /**
   * Get staged changes
   */
  registerSafeHandler(
    'git-diff:get-staged',
    async (_event, params: { repoPath: string; filePath?: string }): Promise<FileDiff[]> => {
      const service = new GitDiffService(params.repoPath);
      return await service.getStagedDiff(params.filePath);
    },
    { operationName: 'Get Staged Changes' }
  );

  /**
   * Get list of conflicted files
   */
  registerSafeHandler(
    'git-diff:get-conflicts',
    async (_event, repoPath: string): Promise<string[]> => {
      const service = new GitDiffService(repoPath);
      return await service.getConflictedFiles();
    },
    { operationName: 'Get Conflicted Files' }
  );

  /**
   * Get file content at specific ref
   */
  registerSafeHandler(
    'git-diff:get-file-content',
    async (_event, params: GetFileContentParams): Promise<string> => {
      const service = new GitDiffService(params.repoPath);
      return await service.getFileContent(params.filePath, params.ref);
    },
    { operationName: 'Get File Content' }
  );

  /**
   * Start watching for git changes
   */
  registerSafeHandler(
    'git-diff:start-watching',
    async (event, repoPath: string): Promise<void> => {
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
    },
    { operationName: 'Start Watching Git Changes' }
  );

  /**
   * Stop watching for git changes
   */
  registerSafeHandler(
    'git-diff:stop-watching',
    async (_event, repoPath: string): Promise<void> => {
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
    },
    { operationName: 'Stop Watching Git Changes' }
  );

  /**
   * Discard all changes in a file
   */
  registerSafeHandler(
    'git-diff:discard-file',
    async (_event, params: { repoPath: string; filePath: string }): Promise<void> => {
      const service = new GitDiffService(params.repoPath);
      await service.discardFileChanges(params.filePath);
    },
    { operationName: 'Discard File Changes' }
  );

  /**
   * Discard changes in a specific hunk
   */
  registerSafeHandler(
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
      const service = new GitDiffService(params.repoPath);
      await service.discardHunkChanges(params.filePath, params.hunk);
      logger.info('[GitDiffHandlers] git-diff:discard-hunk completed successfully');
    },
    { operationName: 'Discard Hunk Changes' }
  );

  /**
   * Discard specific lines within a file
   */
  registerSafeHandler(
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
      const service = new GitDiffService(params.repoPath);
      await service.discardLineChanges(params.filePath, params.lines);
      logger.info('[GitDiffHandlers] git-diff:discard-lines completed successfully');
    },
    { operationName: 'Discard Line Changes' }
  );

  /**
   * Restore a deleted file from HEAD
   */
  registerSafeHandler(
    'git-diff:restore-file',
    async (_event, params: { repoPath: string; filePath: string }): Promise<void> => {
      const service = new GitDiffService(params.repoPath);
      await service.restoreDeletedFile(params.filePath);
    },
    { operationName: 'Restore Deleted File' }
  );

  logger.info('Git diff IPC handlers registered');
}
