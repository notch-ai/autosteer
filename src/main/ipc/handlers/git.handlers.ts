/**
 * Git Handlers - Consolidated IPC handlers for Git operations
 *
 * Consolidates:
 * - GitDiffHandlers.ts → git.handlers.ts
 *
 * Responsibilities:
 * - Git diff operations (diff, uncommitted, staged, conflicts)
 * - File content retrieval at specific refs
 * - Git change watching and notifications
 * - File and hunk discard operations
 * - Deleted file restoration
 *
 * Success Criteria:
 * - Type-safe IPC channels
 * - Comprehensive error handling
 * - Application logging throughout
 * - ~150 LoC target
 */

import { IpcMainInvokeEvent } from 'electron';
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

interface DiscardHunkParams {
  repoPath: string;
  filePath: string;
  hunk: DiffHunk;
}

interface DiscardLinesParams {
  repoPath: string;
  filePath: string;
  lines: Array<{ lineNumber: number; type: 'add' | 'del' }>;
}

// Store active watchers by repo path
const activeWatchers = new Map<string, { service: GitDiffService; cleanup: () => void }>();

/**
 * GitHandlers class
 * Centralized handler for all Git-related IPC operations
 */
export class GitHandlers {
  /**
   * Register all Git IPC handlers
   */
  registerHandlers(): void {
    logger.info('[GitHandlers] Registering Git IPC handlers');

    // Get diff between commits/branches
    registerSafeHandler(
      'git-diff:get-diff',
      async (__event: IpcMainInvokeEvent, params: GetDiffParams): Promise<FileDiff[]> => {
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
      { operationName: 'Get git diff' }
    );

    // Get uncommitted changes (working directory)
    registerSafeHandler(
      'git-diff:get-uncommitted',
      async (
        _event: IpcMainInvokeEvent,
        params: { repoPath: string; filePath?: string }
      ): Promise<FileDiff[]> => {
        const service = new GitDiffService(params.repoPath);
        return await service.getUncommittedDiff(params.filePath);
      },
      { operationName: 'Get uncommitted changes' }
    );

    // Get staged changes
    registerSafeHandler(
      'git-diff:get-staged',
      async (
        _event: IpcMainInvokeEvent,
        params: { repoPath: string; filePath?: string }
      ): Promise<FileDiff[]> => {
        const service = new GitDiffService(params.repoPath);
        return await service.getStagedDiff(params.filePath);
      },
      { operationName: 'Get staged changes' }
    );

    // Get list of conflicted files
    registerSafeHandler(
      'git-diff:get-conflicts',
      async (__event: IpcMainInvokeEvent, repoPath: string): Promise<string[]> => {
        const service = new GitDiffService(repoPath);
        return await service.getConflictedFiles();
      },
      { operationName: 'Get conflicted files' }
    );

    // Get file content at specific ref
    registerSafeHandler(
      'git-diff:get-file-content',
      async (__event: IpcMainInvokeEvent, params: GetFileContentParams): Promise<string> => {
        const service = new GitDiffService(params.repoPath);
        return await service.getFileContent(params.filePath, params.ref);
      },
      { operationName: 'Get file content' }
    );

    // Start watching for git changes
    registerSafeHandler(
      'git-diff:start-watching',
      async (event: IpcMainInvokeEvent, repoPath: string): Promise<void> => {
        logger.info('[GitHandlers] git-diff:start-watching called', {
          repoPath,
          timestamp: new Date().toISOString(),
        });

        // Stop existing watcher if any
        const existing = activeWatchers.get(repoPath);
        if (existing) {
          logger.info('[GitHandlers] Stopping existing watcher for:', repoPath);
          existing.cleanup();
          activeWatchers.delete(repoPath);
        }

        const service = new GitDiffService(repoPath);

        // Start watching and setup callback
        logger.info('[GitHandlers] Starting file watcher...');
        const cleanup = service.startWatching(() => {
          try {
            logger.info('[GitHandlers] File change detected, notifying renderer', {
              repoPath,
              timestamp: new Date().toISOString(),
            });
            // Notify renderer of changes
            event.sender.send('git-diff:changes-detected', { repoPath });
          } catch (error) {
            logger.error('Error in git watcher callback:', error);
          }
        });

        // Store watcher info
        activeWatchers.set(repoPath, { service, cleanup });

        logger.info(`[GitHandlers] Started watching git changes for: ${repoPath}`, {
          activeWatchersCount: activeWatchers.size,
        });
      },
      { operationName: 'Start watching git changes' }
    );

    // Stop watching for git changes
    registerSafeHandler(
      'git-diff:stop-watching',
      async (__event: IpcMainInvokeEvent, repoPath: string): Promise<void> => {
        logger.info('[GitHandlers] git-diff:stop-watching called', {
          repoPath,
          timestamp: new Date().toISOString(),
        });

        const watcher = activeWatchers.get(repoPath);
        if (watcher) {
          watcher.cleanup();
          activeWatchers.delete(repoPath);
          logger.info(`[GitHandlers] Stopped watching git changes for: ${repoPath}`, {
            activeWatchersCount: activeWatchers.size,
          });
        } else {
          logger.warn('[GitHandlers] No watcher found for:', repoPath);
        }
      },
      { operationName: 'Stop watching git changes' }
    );

    // Discard all changes in a file
    registerSafeHandler(
      'git-diff:discard-file',
      async (
        _event: IpcMainInvokeEvent,
        params: { repoPath: string; filePath: string }
      ): Promise<void> => {
        const service = new GitDiffService(params.repoPath);
        await service.discardFileChanges(params.filePath);
      },
      { operationName: 'Discard file changes' }
    );

    // Discard changes in a specific hunk
    registerSafeHandler(
      'git-diff:discard-hunk',
      async (__event: IpcMainInvokeEvent, params: DiscardHunkParams): Promise<void> => {
        logger.info('[GitHandlers] git-diff:discard-hunk called', {
          repoPath: params.repoPath,
          filePath: params.filePath,
          oldStart: params.hunk.oldStart,
          newStart: params.hunk.newStart,
        });
        const service = new GitDiffService(params.repoPath);
        await service.discardHunkChanges(params.filePath, params.hunk);
        logger.info('[GitHandlers] git-diff:discard-hunk completed successfully');
      },
      { operationName: 'Discard hunk changes' }
    );

    // Discard specific lines within a file
    registerSafeHandler(
      'git-diff:discard-lines',
      async (__event: IpcMainInvokeEvent, params: DiscardLinesParams): Promise<void> => {
        logger.info('[GitHandlers] git-diff:discard-lines called', {
          repoPath: params.repoPath,
          filePath: params.filePath,
          lineCount: params.lines.length,
        });
        const service = new GitDiffService(params.repoPath);
        await service.discardLineChanges(params.filePath, params.lines);
        logger.info('[GitHandlers] git-diff:discard-lines completed successfully');
      },
      { operationName: 'Discard line changes' }
    );

    // Restore a deleted file from HEAD
    registerSafeHandler(
      'git-diff:restore-file',
      async (
        _event: IpcMainInvokeEvent,
        params: { repoPath: string; filePath: string }
      ): Promise<void> => {
        const service = new GitDiffService(params.repoPath);
        await service.restoreDeletedFile(params.filePath);
      },
      { operationName: 'Restore deleted file' }
    );

    logger.info('[GitHandlers] Git IPC handlers registered successfully');
  }
}
