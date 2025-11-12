import { exec, spawn } from 'child_process';
import log from 'electron-log/main';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Execute a command with streaming output for real-time progress
 */
function execWithStreaming(
  command: string,
  options: { cwd?: string; timeout?: number }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(' ');
    const child = spawn(cmd, args, {
      cwd: options.cwd,
      shell: true,
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    // Set timeout if specified
    const timeoutHandle = options.timeout
      ? setTimeout(() => {
          killed = true;
          child.kill('SIGTERM');
          reject(new Error(`Command timed out after ${options.timeout}ms: ${command}`));
        }, options.timeout)
      : null;

    // Stream stdout in real-time
    child.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      stdout += output;
      // Log progress lines in real-time
      output.split('\n').forEach((line) => {
        if (line.trim()) {
          log.info(`[GitService] ${line.trim()}`);
        }
      });
    });

    // Stream stderr in real-time
    child.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      stderr += output;
      // Log error lines in real-time
      output.split('\n').forEach((line) => {
        if (line.trim()) {
          log.info(`[GitService] ${line.trim()}`);
        }
      });
    });

    child.on('error', (error) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (!killed) reject(error);
    });

    child.on('close', (code) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (killed) return; // Already rejected due to timeout

      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`Command failed: ${command}\n${stderr || stdout}`);
        reject(error);
      }
    });
  });
}
const fsPromises = {
  access: promisify(fs.access),
  mkdir: promisify(fs.mkdir),
  rm: promisify(fs.rm),
};

export interface GitOperationResult {
  success: boolean;
  message: string;
  error?: string;
}

export interface GitCloneOptions {
  repoUrl: string;
  targetPath: string;
  branchName?: string;
}

export class GitService {
  private static instance: GitService;

  private constructor() {}

  static getInstance(): GitService {
    if (!GitService.instance) {
      GitService.instance = new GitService();
    }
    return GitService.instance;
  }

  async isGitRepository(directoryPath: string): Promise<boolean> {
    try {
      const gitPath = path.join(directoryPath, '.git');
      await fsPromises.access(gitPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async clone(options: GitCloneOptions): Promise<GitOperationResult> {
    try {
      const { repoUrl, targetPath, branchName } = options;

      // Ensure parent directory exists
      const parentDir = path.dirname(targetPath);
      await execAsync(`mkdir -p "${parentDir}"`);

      // First try to clone with the specific branch if provided
      if (branchName) {
        try {
          const command = `git clone "${repoUrl}" "${targetPath}" --branch "${branchName}"`;
          log.info('[GitService] Executing:', command);
          const result = await execAsync(command, {
            timeout: 300000, // 5 minute timeout for large repos
          });
          log.info('[GitService] Clone successful:', result.stdout);

          return {
            success: true,
            message: `Successfully cloned repository to ${targetPath}`,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          log.error('[GitService] Clone with branch failed:', errorMessage);

          // Check if the error is because the branch doesn't exist
          if (errorMessage.includes('Remote branch') && errorMessage.includes('not found')) {
            log.info('[GitService] Branch not found, cloning default branch');
            // Clone without specifying branch (gets default branch)
            await execAsync(`git clone "${repoUrl}" "${targetPath}"`, {
              timeout: 300000,
            });

            // Create and checkout the new branch
            await execAsync(`git checkout -b "${branchName}"`, {
              cwd: targetPath,
            });

            // Push the new branch to origin
            await execAsync(`git push -u origin "${branchName}"`, {
              cwd: targetPath,
              timeout: 60000, // 1 minute timeout
            });

            return {
              success: true,
              message: `Successfully cloned repository, created new branch '${branchName}', and pushed to origin`,
            };
          }

          // Some other error occurred
          throw error;
        }
      } else {
        // No branch specified, clone default
        const command = `git clone "${repoUrl}" "${targetPath}"`;
        log.info('[GitService] Executing:', command);
        const result = await execAsync(command, {
          timeout: 300000,
        });
        log.info('[GitService] Clone successful:', result.stdout);

        return {
          success: true,
          message: `Successfully cloned repository to ${targetPath}`,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('[GitService] Clone failed:', errorMessage);
      return {
        success: false,
        message: 'Failed to clone repository',
        error: errorMessage,
      };
    }
  }

  async createBranch(repoPath: string, branchName: string): Promise<GitOperationResult> {
    try {
      // Check if branch already exists
      const { stdout: branches } = await execAsync('git branch -a', {
        cwd: repoPath,
      });

      if (branches.includes(branchName)) {
        // Checkout existing branch
        await execAsync(`git checkout "${branchName}"`, {
          cwd: repoPath,
        });
        return {
          success: true,
          message: `Switched to existing branch: ${branchName}`,
        };
      }

      // Create and checkout new branch
      await execAsync(`git checkout -b "${branchName}"`, {
        cwd: repoPath,
      });

      return {
        success: true,
        message: `Created and switched to new branch: ${branchName}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: 'Failed to create branch',
        error: errorMessage,
      };
    }
  }

  async pullLatest(repoPath: string, branchName?: string): Promise<GitOperationResult> {
    try {
      // Ensure we're on the correct branch if specified
      if (branchName) {
        await execAsync(`git checkout "${branchName}"`, {
          cwd: repoPath,
        });
      }

      // Pull latest changes
      await execAsync('git pull', {
        cwd: repoPath,
        timeout: 120000, // 2 minute timeout
      });

      return {
        success: true,
        message: 'Successfully pulled latest changes',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: 'Failed to pull latest changes',
        error: errorMessage,
      };
    }
  }

  async getCurrentBranch(repoPath: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: repoPath,
      });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  async getRemoteUrl(repoPath: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync('git config --get remote.origin.url', {
        cwd: repoPath,
      });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  convertRepoUrlToSsh(url: string): string {
    // Convert HTTPS URLs to SSH format
    if (url.startsWith('https://github.com/')) {
      return url.replace('https://github.com/', 'git@github.com:').replace(/\.git$/, '') + '.git';
    }
    // Already SSH or other format
    return url;
  }

  /**
   * Creates a worktree setup: clones main repo if needed, then creates a worktree
   *
   * Handles two scenarios intelligently:
   * 1. Existing remote branch: Creates worktree tracking the remote branch
   * 2. New branch: Creates worktree with new branch from default branch, then pushes to remote
   *
   * @param options - Worktree creation options
   * @param options.repoUrl - Git repository URL (HTTPS or SSH)
   * @param options.mainRepoPath - Path where main repository is/will be cloned
   * @param options.worktreePath - Path where worktree will be created
   * @param options.branchName - Branch name for the worktree
   * @returns Operation result with success status and message
   *
   * Process flow:
   * 1. Ensures main repository exists (clones if needed)
   * 2. Fetches latest changes from origin
   * 3. Detects default branch (main/master/develop)
   * 4. Checks if target branch exists on remote
   * 5. Creates worktree with appropriate git command
   * 6. Pushes to remote if new branch was created
   */
  async createWorktree(options: {
    repoUrl: string;
    mainRepoPath: string;
    worktreePath: string;
    branchName: string;
  }): Promise<GitOperationResult> {
    try {
      const { repoUrl, mainRepoPath, worktreePath, branchName } = options;

      // Step 1: Ensure main repo exists
      const mainRepoExists = await this.repoExists(mainRepoPath);
      if (!mainRepoExists) {
        log.info('[GitService] Main repo does not exist, cloning...');
        const cloneResult = await this.clone({
          repoUrl,
          targetPath: mainRepoPath,
        });

        if (!cloneResult.success) {
          return cloneResult;
        }
      } else {
        log.info('[GitService] Main repo exists, fetching latest...');
        // Fetch latest changes in main repo
        await execAsync('git fetch --all', {
          cwd: mainRepoPath,
          timeout: 120000,
        });
      }

      // Always fetch origin before creating a new worktree to ensure we have latest branches
      log.info('[GitService] Fetching origin to get latest branches...');
      await execWithStreaming('git fetch origin', {
        cwd: mainRepoPath,
        timeout: 120000,
      });

      // Step 2: Detect the default branch
      log.info('[GitService] Detecting default branch...');
      const defaultBranch = await this.getDefaultBranch(mainRepoPath);
      log.info(`[GitService] Default branch is: ${defaultBranch}`);

      // Step 3: Force update the remote tracking branch to ensure absolute latest
      // This ensures origin/${defaultBranch} points to the most recent commit
      // even if there's a race condition between fetch and worktree creation
      log.info(
        `[GitService] Force-updating remote tracking branch refs/remotes/origin/${defaultBranch}...`
      );
      await execAsync(`git fetch origin ${defaultBranch}:refs/remotes/origin/${defaultBranch}`, {
        cwd: mainRepoPath,
        timeout: 120000,
      });

      // Step 4: Check if the branch exists remotely
      // This determines whether we track an existing remote branch or create a new one
      log.info(`[GitService] Checking if branch "${branchName}" exists on remote...`);
      const remoteBranchExists = await this.remoteBranchExists(mainRepoPath, branchName);

      // Step 4.1: Check for branch naming conflicts
      // Git doesn't allow both 'foo' and 'foo/bar' to exist simultaneously
      if (!remoteBranchExists) {
        const conflictingBranch = await this.checkBranchNameConflict(mainRepoPath, branchName);
        if (conflictingBranch) {
          return {
            success: false,
            message: `Cannot create branch '${branchName}' due to naming conflict`,
            error: `A branch named '${conflictingBranch}' already exists. Git does not allow both '${branchName}' and '${conflictingBranch}' because they would conflict in the refs namespace. Please choose a different branch name.`,
          };
        }
      }

      // Step 4.5: If remote branch exists, fetch it to create local remote tracking branch
      // This ensures origin/${branchName} reference exists locally
      if (remoteBranchExists) {
        log.info(
          `[GitService] Fetching remote branch "${branchName}" to create tracking branch...`
        );
        await execAsync(`git fetch origin ${branchName}:refs/remotes/origin/${branchName}`, {
          cwd: mainRepoPath,
          timeout: 120000,
        });
      }

      // Step 5: Create the worktree
      // Two scenarios handled:
      // A) Remote branch exists: Create worktree that tracks the existing remote branch
      //    Command: git worktree add -b <branch> <path> origin/<branch>
      //    Result: Worktree checks out remote branch, local branch created to track it
      //
      // B) New branch: Create worktree with new branch based on latest default branch
      //    Command: git worktree add -b <branch> <path> origin/<default>
      //    Result: New branch created from origin/main (or master/develop)
      //    Note: New branch will be pushed to remote in Step 6
      let worktreeCommand;
      if (remoteBranchExists) {
        log.info(
          `[GitService] Branch "${branchName}" exists on remote, creating worktree to track it`
        );
        // Create worktree tracking the remote branch
        // This creates a local branch that tracks origin/branchName
        worktreeCommand = `git worktree add -b "${branchName}" "${worktreePath}" "origin/${branchName}"`;
      } else {
        log.info(
          `[GitService] Branch "${branchName}" does not exist, creating new branch from ${defaultBranch}`
        );
        worktreeCommand = `git worktree add -b "${branchName}" "${worktreePath}" "origin/${defaultBranch}"`;
      }

      log.info('[GitService] Creating worktree:', worktreeCommand);
      log.info('[GitService] Worktree command details:', {
        cwd: mainRepoPath,
        worktreePath,
        branchName,
        remoteBranchExists,
        timeout: 120000,
      });

      const startTime = Date.now();
      try {
        // Use streaming execution for real-time progress updates
        const result = await execWithStreaming(worktreeCommand, {
          cwd: mainRepoPath,
          timeout: 600000, // 10 minutes for large repos with LFS
        });
        const duration = Date.now() - startTime;
        log.info(`[GitService] Worktree created successfully in ${duration}ms`);
        if (result.stdout.includes('Filtering content')) {
          log.info('[GitService] Large file filtering (LFS) completed');
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error(`[GitService] Worktree creation failed after ${duration}ms:`, errorMessage);

        // Check if it's a timeout during LFS filtering
        if (errorMessage.includes('Filtering content')) {
          log.error(
            '[GitService] Timeout occurred during Git LFS filtering - consider increasing timeout or disabling LFS'
          );
        }
        throw error;
      }

      // Step 6: If we created a new branch, push it to remote
      if (!remoteBranchExists) {
        log.info('[GitService] Pushing new branch to remote...');
        await execAsync(`git push -u origin "${branchName}"`, {
          cwd: worktreePath,
          timeout: 120000,
        });
      }

      return {
        success: true,
        message: `Successfully created worktree at ${worktreePath}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('[GitService] Create worktree failed:', errorMessage);
      return {
        success: false,
        message: 'Failed to create worktree',
        error: errorMessage,
      };
    }
  }

  /**
   * Removes a worktree (but keeps the main repo)
   */
  async removeWorktree(options: {
    mainRepoPath: string;
    worktreePath: string;
    branchName?: string;
  }): Promise<GitOperationResult> {
    try {
      const { mainRepoPath, worktreePath, branchName } = options;

      // Remove the worktree from git tracking
      await execAsync(`git worktree remove --force "${worktreePath}"`, {
        cwd: mainRepoPath,
        timeout: 60000,
      });

      // Always delete the physical directory after successful git removal
      // Note: git worktree remove only removes git tracking, not the directory itself
      try {
        await fsPromises.rm(worktreePath, { recursive: true, force: true });
        log.info(`[GitService] Deleted worktree directory: ${worktreePath}`);
      } catch (rmError) {
        const rmErrorMessage = rmError instanceof Error ? rmError.message : 'Unknown error';
        log.warn(
          `[GitService] Failed to delete worktree directory '${worktreePath}': ${rmErrorMessage}`
        );
        // Don't fail the entire operation if directory deletion fails
      }

      // Clean up any prunable worktrees
      await execAsync('git worktree prune', {
        cwd: mainRepoPath,
        timeout: 30000,
      });

      // Delete the local branch if provided
      if (branchName) {
        try {
          await execAsync(`git branch -D "${branchName}"`, {
            cwd: mainRepoPath,
            timeout: 30000,
          });
          log.info(`[GitService] Deleted local branch: ${branchName}`);
        } catch (branchError) {
          const branchErrorMessage =
            branchError instanceof Error ? branchError.message : 'Unknown error';
          log.warn(
            `[GitService] Failed to delete local branch '${branchName}' (continuing anyway): ${branchErrorMessage}`
          );
        }
      }

      return {
        success: true,
        message: `Successfully removed worktree at ${worktreePath}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('[GitService] Remove worktree failed:', errorMessage);

      // If git worktree remove failed, try to manually delete the directory
      try {
        await fsPromises.rm(options.worktreePath, { recursive: true, force: true });
        log.info(
          `[GitService] Deleted worktree directory (git tracking may be inconsistent): ${options.worktreePath}`
        );
        return {
          success: true,
          message: `Worktree directory removed (git tracking may be inconsistent)`,
        };
      } catch (rmError) {
        return {
          success: false,
          message: 'Failed to remove worktree',
          error: errorMessage,
        };
      }
    }
  }

  /**
   * Checks if a repository exists at the given path
   */
  async repoExists(repoPath: string): Promise<boolean> {
    try {
      await fsPromises.access(path.join(repoPath, '.git'), fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks for branch naming conflicts in Git refs namespace
   * Git doesn't allow both 'foo' and 'foo/bar' to exist simultaneously
   *
   * @param repoPath - Path to the git repository
   * @param branchName - Name of the branch to check
   * @returns The conflicting branch name if exists, null otherwise
   *
   * Examples:
   * - If 'test/test' exists, cannot create 'test'
   * - If 'test' exists, cannot create 'test/foo'
   */
  async checkBranchNameConflict(repoPath: string, branchName: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync(`git ls-remote --heads origin`, {
        cwd: repoPath,
      });

      const lines = stdout.trim().split('\n');
      const allBranches = lines
        .map((line) => {
          const match = line.match(/\trefs\/heads\/(.+)$/);
          return match ? match[1] : null;
        })
        .filter((branch): branch is string => branch !== null);

      // Check if any existing branch would conflict with the new branch name
      for (const existingBranch of allBranches) {
        // Conflict if existing branch starts with "branchName/"
        // Example: branchName="test", existingBranch="test/test" → conflict
        if (existingBranch.startsWith(`${branchName}/`)) {
          log.warn(
            `[GitService] Branch naming conflict: cannot create '${branchName}' because '${existingBranch}' exists`
          );
          return existingBranch;
        }

        // Conflict if branchName starts with "existingBranch/"
        // Example: branchName="test/foo", existingBranch="test" → conflict
        if (branchName.startsWith(`${existingBranch}/`)) {
          log.warn(
            `[GitService] Branch naming conflict: cannot create '${branchName}' because '${existingBranch}' exists`
          );
          return existingBranch;
        }
      }

      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error(`[GitService] Error checking branch name conflict:`, errorMessage);
      // Return null to allow operation to continue (fail later with clearer error)
      return null;
    }
  }

  /**
   * Checks if a branch exists on the remote
   *
   * @param repoPath - Path to the git repository
   * @param branchName - Name of the branch to check (supports slashes)
   * @returns True if branch exists on origin, false otherwise
   *
   * Implementation: Uses `git ls-remote --heads origin` to query remote
   * without fetching all data. This is fast and doesn't modify local state.
   * Performs exact match on the branch name to avoid false positives.
   */
  async remoteBranchExists(repoPath: string, branchName: string): Promise<boolean> {
    try {
      log.info(`[GitService] Checking if remote branch exists: ${branchName}`);
      const { stdout } = await execAsync(`git ls-remote --heads origin`, {
        cwd: repoPath,
      });

      // Parse output to find exact match for refs/heads/<branchName>
      // Each line format: <commit-hash>\trefs/heads/<branch-name>
      const lines = stdout.trim().split('\n');
      const exactMatch = lines.some((line) => {
        const match = line.match(/\trefs\/heads\/(.+)$/);
        return match && match[1] === branchName;
      });

      const status = exactMatch ? 'exists' : 'does not exist';
      log.info(`[GitService] Remote branch "${branchName}" ${status}`);
      return exactMatch;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error(`[GitService] Error checking remote branch "${branchName}":`, errorMessage);
      return false;
    }
  }

  /**
   * Detects the default branch of the repository using multiple strategies
   * Strategy 1: Parse symbolic-ref from origin/HEAD
   * Strategy 2: Parse ls-remote output for HEAD
   * Strategy 3: Fallback to common default branch names
   */
  private async getDefaultBranch(repoPath: string): Promise<string> {
    // Strategy 1: Try symbolic-ref to get origin/HEAD
    try {
      const { stdout } = await execAsync('git symbolic-ref refs/remotes/origin/HEAD', {
        cwd: repoPath,
      });
      const match = stdout.trim().match(/refs\/remotes\/origin\/(.+)/);
      if (match && match[1]) {
        log.info('[GitService] Default branch detected via symbolic-ref:', match[1]);
        return match[1];
      }
    } catch (error) {
      log.info('[GitService] symbolic-ref strategy failed, trying next strategy');
    }

    // Strategy 2: Parse ls-remote output for HEAD
    try {
      const { stdout } = await execAsync('git ls-remote --symref origin HEAD', {
        cwd: repoPath,
      });
      const match = stdout.match(/ref: refs\/heads\/(\S+)\s+HEAD/);
      if (match && match[1]) {
        log.info('[GitService] Default branch detected via ls-remote:', match[1]);
        return match[1];
      }
    } catch (error) {
      log.info('[GitService] ls-remote strategy failed, trying next strategy');
    }

    // Strategy 3: Fallback to common default branch names
    const commonDefaults = ['main', 'master', 'develop'];
    for (const branchName of commonDefaults) {
      const exists = await this.remoteBranchExists(repoPath, branchName);
      if (exists) {
        log.info('[GitService] Default branch detected via fallback:', branchName);
        return branchName;
      }
    }

    // If all strategies fail, default to 'main'
    log.warn('[GitService] Could not detect default branch, defaulting to "main"');
    return 'main';
  }

  isValidGitUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }

    // Remove trailing spaces and .git extension for validation
    const cleanUrl = url.trim();

    // Basic URL validation
    try {
      // Check if it's a valid HTTP(S) URL
      if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
        const parsedUrl = new URL(cleanUrl);

        // Must have a valid hostname with at least one dot (e.g., github.com)
        if (!parsedUrl.hostname || !parsedUrl.hostname.includes('.')) {
          log.info('[GitService] Invalid hostname:', parsedUrl.hostname);
          return false;
        }

        // Must have a pathname that's not just '/'
        if (!parsedUrl.pathname || parsedUrl.pathname === '/') {
          log.info('[GitService] Invalid pathname:', parsedUrl.pathname);
          return false;
        }

        // Must have at least owner/repo structure
        const pathParts = parsedUrl.pathname.split('/').filter((p) => p.length > 0);
        if (pathParts.length < 2) {
          log.info('[GitService] Not enough path parts:', pathParts);
          return false;
        }

        // Check for known git hosting services
        const knownHosts = ['github.com', 'gitlab.com', 'bitbucket.org', 'bitbucket.com'];
        const isKnownHost = knownHosts.some(
          (host) => parsedUrl.hostname === host || parsedUrl.hostname.endsWith(`.${host}`)
        );

        if (!isKnownHost) {
          log.info('[GitService] Unknown git host:', parsedUrl.hostname);
          // For unknown hosts, do additional validation
          // Must look like a valid domain
          const domainPattern = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
          if (!domainPattern.test(parsedUrl.hostname)) {
            log.info('[GitService] Invalid domain format:', parsedUrl.hostname);
            return false;
          }
        }

        log.info('[GitService] Valid HTTPS URL:', cleanUrl);
        return true;
      }

      // Check for SSH URLs (git@...)
      if (cleanUrl.startsWith('git@')) {
        // Basic SSH URL pattern: git@hostname:owner/repo.git
        const sshPattern = /^git@[\w.-]+:[\w.-]+\/[\w.-]+(\.git)?$/;
        const isValid = sshPattern.test(cleanUrl);
        log.info('[GitService] SSH URL validation:', cleanUrl, isValid);
        return isValid;
      }

      // Check for git:// URLs
      if (cleanUrl.startsWith('git://')) {
        const gitPattern = /^git:\/\/[\w.-]+\/.+$/;
        const isValid = gitPattern.test(cleanUrl);
        log.info('[GitService] git:// URL validation:', cleanUrl, isValid);
        return isValid;
      }

      log.info('[GitService] URL does not match any known patterns:', cleanUrl);
      return false;
    } catch (e) {
      // If URL parsing fails, it's not a valid URL
      log.info('[GitService] URL parsing failed:', url, e);
      return false;
    }
  }

  extractRepoName(repoUrl: string): string {
    // Extract repository name from URL
    const match = repoUrl.match(/\/([^/]+?)(?:\.git)?$/);
    return match ? match[1] : 'unknown-repo';
  }
}
