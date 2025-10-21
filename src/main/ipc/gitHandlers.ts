/**
 * IPC handlers for Git operations
 */

import { exec } from 'child_process';
import { ipcMain } from 'electron';
import log from 'electron-log';
import { promisify } from 'util';

const execAsync = promisify(exec);

export function registerGitHandlers(): void {
  /**
   * Execute a git command in a specific directory
   */
  ipcMain.handle('git:execute', async (_event, command: string, cwd: string) => {
    try {
      // Validate that the command starts with 'git' for security
      if (!command.trim().startsWith('git')) {
        throw new Error('Only git commands are allowed');
      }

      // Only log errors, not every command execution

      const { stdout, stderr } = await execAsync(command, {
        cwd,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024, // 1MB buffer
      });

      if (stderr && !stderr.includes('warning:')) {
        log.warn(`[Git] Command stderr: ${stderr}`);
      }

      return {
        success: true,
        output: stdout,
        error: stderr,
      };
    } catch (error) {
      log.error('[Git] Command failed:', error);
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Git command failed',
      };
    }
  });

  /**
   * Get git diff stats for a working directory
   */
  ipcMain.handle('git:diff-stats', async (_event, cwd: string) => {
    try {
      // log.debug('[Git] git:diff-stats called', { cwd, timestamp: new Date().toISOString() });

      const stats: Array<{
        file: string;
        additions: number;
        deletions: number;
        binary?: boolean;
        status?: 'modified' | 'staged' | 'both' | 'untracked';
        isRenamed?: boolean;
        oldPath?: string;
      }> = [];

      // Get file status using git status --porcelain
      const { stdout: statusOutput } = await execAsync('git status --porcelain', {
        cwd,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
      });

      if (!statusOutput.trim()) {
        return {
          success: true,
          stats: [],
          error: null,
        };
      }

      const statusLines = statusOutput.split('\n').filter((line) => line.length > 0);
      const fileStatusMap = new Map<
        string,
        {
          staged: string | null;
          unstaged: string | null;
          oldPath?: string;
        }
      >();

      // Parse git status output
      for (const line of statusLines) {
        if (!line.trim()) continue;

        // Git status --porcelain format: XY<space>path
        // X = staged status, Y = unstaged status
        const stagedStatus = line[0] || ' ';
        const unstagedStatus = line[1] || ' ';

        // Find where the actual path starts (after the status codes and separator)
        // Standard format has status at 0-1, then the path starts after index 2
        let pathStart = 2;
        while (pathStart < line.length && line[pathStart] === ' ') {
          pathStart++;
        }

        let filePath = line.substring(pathStart).trim();
        let oldPath: string | undefined;

        // Handle renames: "R  old_path -> new_path"
        if (stagedStatus === 'R' || unstagedStatus === 'R') {
          const renameParts = filePath.split(' -> ');
          if (renameParts.length === 2) {
            oldPath = renameParts[0].trim();
            filePath = renameParts[1].trim();
          }
        }

        fileStatusMap.set(filePath, {
          staged: stagedStatus !== ' ' ? stagedStatus : null,
          unstaged: unstagedStatus !== ' ' ? unstagedStatus : null,
          oldPath,
        });
      }

      // Get numstat for staged changes
      const stagedStats = new Map<
        string,
        { additions: number; deletions: number; binary: boolean }
      >();
      try {
        const { stdout: stagedOutput } = await execAsync('git diff --cached --numstat', {
          cwd,
          encoding: 'utf8',
          maxBuffer: 1024 * 1024,
        });

        if (stagedOutput.trim()) {
          const lines = stagedOutput.trim().split('\n');
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 3) {
              const additions = parts[0];
              const deletions = parts[1];
              const file = parts.slice(2).join(' ');

              stagedStats.set(file, {
                additions: additions === '-' ? 0 : parseInt(additions, 10) || 0,
                deletions: deletions === '-' ? 0 : parseInt(deletions, 10) || 0,
                binary: additions === '-' || deletions === '-',
              });
            }
          }
        }
      } catch (err) {
        log.warn('[Git] Error getting staged numstat:', err);
      }

      // Get numstat for unstaged changes
      const unstagedStats = new Map<
        string,
        { additions: number; deletions: number; binary: boolean }
      >();
      try {
        const { stdout: diffOutput } = await execAsync('git diff --numstat', {
          cwd,
          encoding: 'utf8',
          maxBuffer: 1024 * 1024,
        });

        if (diffOutput.trim()) {
          const lines = diffOutput.trim().split('\n');
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 3) {
              const additions = parts[0];
              const deletions = parts[1];
              const file = parts.slice(2).join(' ');

              unstagedStats.set(file, {
                additions: additions === '-' ? 0 : parseInt(additions, 10) || 0,
                deletions: deletions === '-' ? 0 : parseInt(deletions, 10) || 0,
                binary: additions === '-' || deletions === '-',
              });
            }
          }
        }
      } catch (err) {
        log.warn('[Git] Error getting unstaged numstat:', err);
      }

      // Combine status and stats
      for (const [filePath, fileStatus] of fileStatusMap.entries()) {
        const { staged, unstaged, oldPath } = fileStatus;
        const stagedStat = stagedStats.get(filePath);
        const unstagedStat = unstagedStats.get(filePath);

        let status: 'modified' | 'staged' | 'both' | 'untracked' = 'modified';
        let additions = 0;
        let deletions = 0;
        let binary = false;

        // Determine status - check for untracked first
        if (staged === '?' && unstaged === '?') {
          // Untracked file
          status = 'untracked';
          // For untracked files, count lines using wc -l
          try {
            const { stdout: wcOutput } = await execAsync(`wc -l < "${filePath}"`, {
              cwd,
              encoding: 'utf8',
              maxBuffer: 1024 * 1024,
            });
            const lineCount = parseInt(wcOutput.trim(), 10);
            if (!isNaN(lineCount)) {
              additions = lineCount;
            }
          } catch {
            // If wc fails, try git diff as fallback
            try {
              const { stdout: diffOutput } = await execAsync(
                `git diff --no-index --numstat /dev/null "${filePath}"`,
                {
                  cwd,
                  encoding: 'utf8',
                  maxBuffer: 1024 * 1024,
                }
              );
              if (diffOutput.trim()) {
                const parts = diffOutput.trim().split(/\s+/);
                if (parts.length >= 1) {
                  additions = parts[0] === '-' ? 0 : parseInt(parts[0], 10) || 0;
                  binary = parts[0] === '-';
                }
              }
            } catch {
              // Ignore errors, file might be binary or inaccessible
            }
          }
        } else if (staged && unstaged && staged !== ' ' && unstaged !== ' ') {
          status = 'both';
          additions = (stagedStat?.additions || 0) + (unstagedStat?.additions || 0);
          deletions = (stagedStat?.deletions || 0) + (unstagedStat?.deletions || 0);
          binary = stagedStat?.binary || false || unstagedStat?.binary || false;
        } else if (staged && staged !== ' ') {
          status = 'staged';
          additions = stagedStat?.additions || 0;
          deletions = stagedStat?.deletions || 0;
          binary = stagedStat?.binary || false;
        } else {
          status = 'modified';
          additions = unstagedStat?.additions || 0;
          deletions = unstagedStat?.deletions || 0;
          binary = unstagedStat?.binary || false;
        }

        const statEntry: {
          file: string;
          additions: number;
          deletions: number;
          binary?: boolean;
          status?: 'modified' | 'staged' | 'both' | 'untracked';
          isRenamed?: boolean;
          oldPath?: string;
        } = {
          file: filePath,
          additions,
          deletions,
          binary,
          status,
        };

        // Handle renames
        if (oldPath) {
          statEntry.isRenamed = true;
          statEntry.oldPath = oldPath;
        }

        stats.push(statEntry);
      }

      // log.debug('[Git] Returning stats:', {
      //   statsCount: stats.length,
      //   files: stats.map((s) => s.file),
      //   timestamp: new Date().toISOString(),
      // });

      return {
        success: true,
        stats,
        error: null,
      };
    } catch (error) {
      log.error('[Git] Failed to get diff stats:', error);
      return {
        success: false,
        stats: [],
        error: error instanceof Error ? error.message : 'Failed to get git diff stats',
      };
    }
  });
}
