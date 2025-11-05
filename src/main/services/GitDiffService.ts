import { FSWatcher, watch } from 'chokidar';
import fs from 'fs';
import { unlink } from 'fs/promises';
import parseDiff, { File as ParsedFile } from 'parse-diff';
import { join } from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import { spawnSync } from 'child_process';
import { log as logger } from './logger';

export interface DiffOptions {
  repoPath: string;
  from?: string; // Commit hash, branch, or 'HEAD'
  to?: string; // Commit hash, branch, or 'HEAD'
  filePath?: string; // Optional: specific file to diff
  contextLines?: number; // Number of context lines (default: 3)
}

export interface ConflictMarker {
  type: 'ours' | 'theirs' | 'base';
  startLine: number;
  endLine: number;
  content: string;
}

export interface DiffChange {
  type: 'add' | 'del' | 'normal';
  lineNumber?: number;
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
  isConflict?: boolean;
  conflictMarker?: ConflictMarker;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  changes: DiffChange[];
  hasConflicts: boolean;
}

export interface FileDiff {
  from: string;
  to: string;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
  isNew: boolean;
  isDeleted: boolean;
  isRenamed: boolean;
  hasConflicts: boolean;
}

export class GitDiffService {
  private git: SimpleGit;
  private repoPath: string;
  private watcher?: FSWatcher;

  constructor(repoPath: string) {
    this.git = simpleGit(repoPath);
    this.repoPath = repoPath;
  }

  /**
   * Get diff between two commits/branches
   */
  async getDiff(options: DiffOptions): Promise<FileDiff[]> {
    try {
      const { from = 'HEAD', to, filePath, contextLines = 3 } = options;

      const args = [
        `--unified=${contextLines}`, // Context lines
        '--no-color', // No ANSI colors
        '--no-ext-diff', // No external diff tools
        '--no-prefix', // Remove a/ b/ prefixes
      ];

      // Add commit range
      if (to) {
        args.push(`${from}..${to}`);
      } else {
        args.push(from);
      }

      // Add specific file if provided
      if (filePath) {
        args.push('--', filePath);
      }

      const diffOutput = await this.git.diff(args);

      if (!diffOutput) {
        return [];
      }

      const parsedFiles = parseDiff(diffOutput);
      return this.processFiles(parsedFiles);
    } catch (error) {
      logger.error('Failed to get diff:', error);
      throw error;
    }
  }

  /**
   * Get diff for uncommitted changes (working directory vs HEAD)
   */
  async getUncommittedDiff(filePath?: string): Promise<FileDiff[]> {
    try {
      // Check if file is untracked
      if (filePath) {
        const status = await this.git.status();
        const isUntracked = status.not_added.includes(filePath);

        if (isUntracked) {
          // For untracked files, show entire content as additions
          const args = [
            '--no-index', // Compare arbitrary files
            '--unified=3',
            '--no-color',
            '--no-ext-diff',
            '--no-prefix',
            '/dev/null', // Compare against empty file
            filePath,
          ];

          const diffOutput = await this.git.diff(args);
          if (!diffOutput) return [];

          logger.info(`[getUncommittedDiff] Untracked file diff output for ${filePath}:`, {
            firstLines: diffOutput.split('\n').slice(0, 10).join('\n'),
          });

          const parsedFiles = parseDiff(diffOutput);
          logger.info(`[getUncommittedDiff] Parsed files:`, {
            files: parsedFiles.map((f) => ({ from: f.from, to: f.to, new: f.new })),
          });

          // Fix: For untracked files, ensure file.to is set correctly
          const processedFiles = this.processFiles(parsedFiles);
          if (processedFiles.length > 0 && processedFiles[0].isNew && !processedFiles[0].to) {
            processedFiles[0].to = filePath;
          }

          return processedFiles;
        }
      }

      // For tracked files, use normal diff
      return this.getDiff({
        repoPath: this.repoPath,
        from: 'HEAD',
        ...(filePath && { filePath }),
      });
    } catch (error) {
      logger.error('Failed to get uncommitted diff:', error);
      throw error;
    }
  }

  /**
   * Get diff for staged changes
   */
  async getStagedDiff(filePath?: string): Promise<FileDiff[]> {
    try {
      const args = [
        '--cached', // Staged changes
        '--unified=3',
        '--no-color',
        '--no-ext-diff',
        '--no-prefix',
      ];

      if (filePath) {
        args.push('--', filePath);
      }

      const diffOutput = await this.git.diff(args);

      if (!diffOutput) {
        return [];
      }

      const parsedFiles = parseDiff(diffOutput);
      return this.processFiles(parsedFiles);
    } catch (error) {
      logger.error('Failed to get staged diff:', error);
      throw error;
    }
  }

  /**
   * Detect and parse merge conflicts
   * @deprecated Currently unused - reserved for future conflict resolution features
   */
  // @ts-expect-error - Reserved for future use
  private detectConflicts(content: string): ConflictMarker[] {
    const conflicts: ConflictMarker[] = [];
    const lines = content.split('\n');
    let currentConflict: ConflictMarker | null = null;
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;

      if (line.startsWith('<<<<<<<')) {
        // Start of conflict - "ours" section
        currentConflict = {
          type: 'ours',
          startLine: lineNumber,
          endLine: -1,
          content: '',
        };
      } else if (line.startsWith('=======') && currentConflict) {
        // End of "ours", start of "theirs"
        currentConflict.endLine = lineNumber - 1;
        conflicts.push(currentConflict);

        currentConflict = {
          type: 'theirs',
          startLine: lineNumber + 1,
          endLine: -1,
          content: '',
        };
      } else if (line.startsWith('>>>>>>>') && currentConflict) {
        // End of conflict
        currentConflict.endLine = lineNumber - 1;
        conflicts.push(currentConflict);
        currentConflict = null;
      } else if (currentConflict) {
        currentConflict.content += line + '\n';
      }
    }

    return conflicts;
  }

  /**
   * Process parsed diff files and detect conflicts
   */
  private processFiles(parsedFiles: ParsedFile[]): FileDiff[] {
    return parsedFiles.map((file) => {
      const hunks: DiffHunk[] = [];
      let hasFileConflicts = false;

      for (const chunk of file.chunks) {
        const changes: DiffChange[] = [];
        let hasHunkConflicts = false;

        // Track line numbers for when parse-diff doesn't provide them
        // For new files, oldStart might be 0, so ensure we start at 1
        let currentOldLine = chunk.oldStart || 1;
        let currentNewLine = chunk.newStart || 1;

        for (const change of chunk.changes) {
          let changeContent = change.content || '';

          // Strip leading +/- or space prefix if present (parse-diff sometimes includes it)
          // In unified diff format: '+' = addition, '-' = deletion, ' ' = context line
          if (
            changeContent.startsWith('+') ||
            changeContent.startsWith('-') ||
            changeContent.startsWith(' ')
          ) {
            changeContent = changeContent.slice(1);
          }

          // Detect conflict markers
          const isConflictMarker =
            changeContent.startsWith('<<<<<<<') ||
            changeContent.startsWith('=======') ||
            changeContent.startsWith('>>>>>>>');

          const isConflictContent =
            changeContent.includes('<<<<<<<') ||
            changeContent.includes('=======') ||
            changeContent.includes('>>>>>>>');

          if (isConflictMarker || isConflictContent) {
            hasHunkConflicts = true;
            hasFileConflicts = true;
          }

          // Calculate line numbers - parse-diff provides ln (old) and ln2 (new)
          // but they may be undefined, so we track them ourselves
          let oldLineNumber: number | undefined;
          let newLineNumber: number | undefined;

          if (change.type === 'add') {
            // For additions, only new line number exists
            oldLineNumber = undefined;
            newLineNumber = (change as any).ln2 ?? currentNewLine;
            currentNewLine++;
          } else if (change.type === 'del') {
            // For deletions, only old line number exists
            oldLineNumber = (change as any).ln ?? currentOldLine;
            newLineNumber = undefined;
            currentOldLine++;
          } else {
            // For normal lines, both line numbers exist
            oldLineNumber = (change as any).ln ?? currentOldLine;
            newLineNumber = (change as any).ln2 ?? currentNewLine;
            currentOldLine++;
            currentNewLine++;
          }

          const lineNumber = oldLineNumber ?? newLineNumber ?? 0;
          changes.push({
            type: change.type as 'add' | 'del' | 'normal',
            lineNumber,
            ...(oldLineNumber !== undefined && { oldLineNumber }),
            ...(newLineNumber !== undefined && { newLineNumber }),
            content: changeContent,
            isConflict: isConflictMarker || isConflictContent,
          });
        }

        hunks.push({
          oldStart: chunk.oldStart,
          oldLines: chunk.oldLines,
          newStart: chunk.newStart,
          newLines: chunk.newLines,
          changes,
          hasConflicts: hasHunkConflicts,
        });
      }

      return {
        from: file.from || '',
        to: file.to || '',
        hunks,
        additions: file.additions || 0,
        deletions: file.deletions || 0,
        isNew: file.new || false,
        isDeleted: file.deleted || false,
        isRenamed: file.from !== file.to && !file.new && !file.deleted,
        hasConflicts: hasFileConflicts,
      };
    });
  }

  /**
   * Get list of files with conflicts
   */
  async getConflictedFiles(): Promise<string[]> {
    try {
      const status = await this.git.status();
      return status.conflicted;
    } catch (error) {
      logger.error('Failed to get conflicted files:', error);
      throw error;
    }
  }

  /**
   * Get file content at specific ref
   */
  async getFileContent(filePath: string, ref: string = 'HEAD'): Promise<string> {
    try {
      return await this.git.show([`${ref}:${filePath}`]);
    } catch (error) {
      logger.error(`Failed to get file content for ${filePath} at ${ref}:`, error);
      throw error;
    }
  }

  /**
   * Start watching for git changes
   */
  startWatching(callback: () => void): () => void {
    logger.info('[GitDiffService] startWatching called', {
      repoPath: this.repoPath,
      timestamp: new Date().toISOString(),
    });

    const watchPaths = [
      `${this.repoPath}/.git/index`, // Staging changes
      `${this.repoPath}/.git/HEAD`, // Branch changes
      `${this.repoPath}/.git/refs/**`, // Commits
    ];

    logger.info('[GitDiffService] Setting up chokidar watcher for paths:', watchPaths);

    // Watch .git/index, .git/HEAD, and .git/refs for changes
    this.watcher = watch(watchPaths, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100,
      },
    });

    this.watcher.on('ready', () => {
      logger.info('[GitDiffService] Chokidar watcher ready', {
        watchedPaths: watchPaths,
        timestamp: new Date().toISOString(),
      });
    });

    this.watcher.on('error', (error) => {
      logger.error('[GitDiffService] Chokidar watcher error:', error);
    });

    this.watcher.on('change', (path) => {
      logger.info('[GitDiffService] Git change detected:', {
        path,
        timestamp: new Date().toISOString(),
      });
      callback();
    });

    this.watcher.on('add', (path) => {
      logger.info('[GitDiffService] Git file added:', {
        path,
        timestamp: new Date().toISOString(),
      });
      callback();
    });

    this.watcher.on('unlink', (path) => {
      logger.info('[GitDiffService] Git file removed:', {
        path,
        timestamp: new Date().toISOString(),
      });
      callback();
    });

    logger.info('[GitDiffService] Chokidar watcher configured, waiting for ready event');

    return () => this.stopWatching();
  }

  /**
   * Stop watching for git changes
   */
  stopWatching(): void {
    if (this.watcher) {
      logger.info('[GitDiffService] Stopping watcher', {
        repoPath: this.repoPath,
        timestamp: new Date().toISOString(),
      });
      void this.watcher.close();
      delete this.watcher;
      logger.info('[GitDiffService] Stopped watching git changes');
    } else {
      logger.warn('[GitDiffService] No watcher to stop');
    }
  }

  /**
   * Discard all changes in a file (restore to HEAD state or delete if untracked)
   * @param filePath - Relative path from repository root
   * @throws Error if file not found or git operation fails
   */
  async discardFileChanges(filePath: string): Promise<void> {
    try {
      // Check if the file is tracked by git
      const trackedFiles = await this.git.raw(['ls-files', filePath]);
      const isTracked = trackedFiles.trim().length > 0;
      if (isTracked) {
        // Tracked file: use git checkout to restore to HEAD
        await this.git.raw(['checkout', '--', filePath]);
        logger.info(`Discarded changes for tracked file: ${filePath}`);
      } else {
        // Untracked file: delete it from filesystem
        const absolutePath = join(this.repoPath, filePath);
        await unlink(absolutePath);
        logger.info(`Deleted untracked file: ${filePath}`);
      }
    } catch (error) {
      logger.error(`Failed to discard file changes for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Discard changes in a specific hunk using git apply --reverse
   * @param filePath - Relative path from repository root
   * @param hunk - Parsed diff hunk object
   * @throws Error if patch generation or apply fails
   */
  async discardHunkChanges(filePath: string, hunk: DiffHunk): Promise<void> {
    try {
      logger.info(`[discardHunkChanges] Starting for file: ${filePath}`, {
        oldStart: hunk.oldStart,
        newStart: hunk.newStart,
      });

      // Check if file is tracked - can't discard hunks from untracked files
      const trackedFiles = await this.git.raw(['ls-files', filePath]);
      const isTracked = trackedFiles.trim().length > 0;

      if (!isTracked) {
        throw new Error(
          `Cannot discard specific hunks from untracked file "${filePath}". Please discard the entire file instead.`
        );
      }

      // Get all hunks for this file AND the raw git diff BEFORE checkout
      const diffs = await this.getUncommittedDiff(filePath);
      if (diffs.length === 0) {
        throw new Error('No changes found for file');
      }

      const fileDiff = diffs[0];

      // Get the git diff string NOW (before checkout) to preserve the format
      const gitDiff = await this.git.diff(['HEAD', '--', filePath]);

      // Filter out the hunk to discard - keep all other hunks
      const hunksToKeep = fileDiff.hunks.filter(
        (h) => !(h.oldStart === hunk.oldStart && h.newStart === hunk.newStart)
      );

      logger.info(
        `[discardHunkChanges] Total hunks: ${fileDiff.hunks.length}, keeping: ${hunksToKeep.length}`
      );

      // Restore file from HEAD (this makes the file clean)
      await this.git.raw(['checkout', 'HEAD', '--', filePath]);
      logger.info(`[discardHunkChanges] Restored ${filePath} from HEAD`);

      // If there are hunks to keep, re-apply them using the diff we got earlier
      if (hunksToKeep.length > 0) {
        // Build patch with only the hunks we want to keep
        const patch = this.buildPatchFromHunks(filePath, gitDiff, hunksToKeep);
        logger.info(`[discardHunkChanges] Re-applying hunks:\n${patch}`);

        const result = spawnSync('git', ['apply', '--whitespace=nowarn'], {
          cwd: this.repoPath,
          input: patch,
          encoding: 'utf-8',
        });

        if (result.error || result.status !== 0) {
          const errorMessage = result.stderr || result.error?.message || 'Unknown error';
          logger.error(`[discardHunkChanges] Failed to re-apply hunks:`, {
            status: result.status,
            stderr: result.stderr,
            stdout: result.stdout,
          });
          throw new Error(`Failed to re-apply hunks: ${errorMessage}`);
        }
      }

      logger.info(`[discardHunkChanges] Successfully discarded hunk in ${filePath}`);
    } catch (error) {
      logger.error(`[discardHunkChanges] Failed to discard hunk changes for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Discard specific lines within a file
   * @param filePath - Relative path from repository root
   * @param lines - Array of line numbers and types to discard
   * @throws Error if patch generation or apply fails
   */
  async discardLineChanges(
    filePath: string,
    lines: Array<{ lineNumber: number; type: 'add' | 'del' }>
  ): Promise<void> {
    try {
      logger.info(`[discardLineChanges] Starting for file: ${filePath}`, {
        lineCount: lines.length,
      });

      // Check if file is tracked - can't discard lines from untracked files
      const trackedFiles = await this.git.raw(['ls-files', filePath]);
      const isTracked = trackedFiles.trim().length > 0;

      if (!isTracked) {
        throw new Error(
          `Cannot discard specific lines from untracked file "${filePath}". Please discard the entire file instead.`
        );
      }

      // Get the diff to understand what lines to discard
      const diffs = await this.getUncommittedDiff(filePath);
      if (diffs.length === 0) {
        throw new Error('No changes found for file');
      }

      const fileDiff = diffs[0];

      // Read file path and HEAD version
      const fullPath = join(this.repoPath, filePath);

      // Get HEAD version
      const headContent = await this.git.show([`HEAD:${filePath}`]);
      const headLines = headContent.split('\n');

      // Create a set of line identifiers to discard
      const linesToDiscard = new Set(lines.map((l) => `${l.lineNumber}-${l.type}`));

      // Build the final file content by processing all hunks
      const resultLines: string[] = [...headLines]; // Start with HEAD version
      let currentLineOffset = 0; // Track cumulative offset from additions/deletions

      // Process each hunk in order
      for (const hunk of fileDiff.hunks) {
        // Process changes in this hunk
        for (const change of hunk.changes) {
          const lineKey = `${change.lineNumber}-${change.type}`;
          const shouldDiscard = linesToDiscard.has(lineKey);

          if (change.type === 'add') {
            if (!shouldDiscard) {
              // Skip git metadata markers like "\ No newline at end of file"
              if (!change.content.startsWith('\\')) {
                // Keep this addition - insert it at the correct position
                const insertPos = change.newLineNumber! - 1 + currentLineOffset;
                resultLines.splice(insertPos, 0, change.content);
                currentLineOffset++;
              }
            }
            // If shouldDiscard, don't add this line (it's being discarded)
          } else if (change.type === 'del') {
            if (shouldDiscard) {
              // Discard this deletion - keep the line (it's already in resultLines from HEAD)
              // Do nothing - line stays
            } else {
              // Keep this deletion - remove the line
              const deletePos = change.oldLineNumber! - 1 + currentLineOffset;
              resultLines.splice(deletePos, 1);
              currentLineOffset--;
            }
          }
          // 'normal' lines are already in resultLines from HEAD
        }
      }

      // Write the modified content back
      await fs.promises.writeFile(fullPath, resultLines.join('\n'), 'utf-8');

      logger.info(
        `[discardLineChanges] Successfully discarded ${lines.length} lines in ${filePath}`
      );
    } catch (error) {
      logger.error(`[discardLineChanges] Failed to discard line changes for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Restore a deleted file from HEAD commit
   * @param filePath - Relative path from repository root
   * @throws Error if file not in HEAD or checkout fails
   */
  async restoreDeletedFile(filePath: string): Promise<void> {
    try {
      await this.git.raw(['checkout', 'HEAD', '--', filePath]);
      logger.info(`Restored deleted file: ${filePath}`);
    } catch (error) {
      logger.error(`Failed to restore deleted file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Generate unified diff patch for a hunk
   * @private
   */
  // @ts-expect-error - Reserved for future use
  private generateHunkPatch(filePath: string, hunk: DiffHunk): string {
    const lines: string[] = [];

    // Patch header
    lines.push('diff --git a/' + filePath + ' b/' + filePath);
    lines.push('--- a/' + filePath);
    lines.push('+++ b/' + filePath);

    // Hunk header
    lines.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);

    // Hunk changes
    for (const change of hunk.changes) {
      if (change.type === 'add') {
        lines.push('+' + change.content);
      } else if (change.type === 'del') {
        lines.push('-' + change.content);
      } else {
        lines.push(' ' + change.content);
      }
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Build patch from git diff containing only specified hunks
   * @private
   */
  // @ts-expect-error - filePath parameter reserved for future use
  private buildPatchFromHunks(filePath: string, gitDiff: string, hunks: DiffHunk[]): string {
    const lines = gitDiff.split('\n');
    const patchLines: string[] = [];
    let headerAdded = false;

    for (const hunk of hunks) {
      const hunkHeaderPattern = new RegExp(
        `@@ -${hunk.oldStart},[0-9]+ \\+${hunk.newStart},[0-9]+ @@`
      );

      let inTargetHunk = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Add file headers once
        if (!headerAdded) {
          if (line.startsWith('diff --git') || line.startsWith('---') || line.startsWith('+++')) {
            patchLines.push(line);
            if (line.startsWith('+++')) {
              headerAdded = true;
            }
            continue;
          }
        }

        // Check if this is our target hunk header
        if (line.match(hunkHeaderPattern)) {
          inTargetHunk = true;
          patchLines.push(line);
          continue;
        }

        // If we're in the target hunk, include lines until next hunk or end
        if (inTargetHunk) {
          // Stop if we hit another hunk header
          if (line.startsWith('@@') && !line.match(hunkHeaderPattern)) {
            break;
          }

          // Include the line if it's a diff line
          if (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ')) {
            patchLines.push(line);
          } else if (line.trim() === '') {
            // End of hunk
            break;
          }
        }
      }
    }

    return patchLines.join('\n') + '\n';
  }
}
