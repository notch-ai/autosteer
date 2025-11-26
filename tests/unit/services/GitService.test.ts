/**
 * GitService.test.ts
 * Comprehensive unit tests for GitService with 80%+ coverage
 * Tests git operations, worktree management, error handling, and edge cases
 */

// Mock dependencies BEFORE imports
jest.mock('child_process');
jest.mock('fs');
jest.mock('electron-log/main', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Create mock fs promises
const fsPromises = {
  access: jest.fn(),
  mkdir: jest.fn(),
  rm: jest.fn(),
};

// Create mock execAsync
const mockExecAsync = jest.fn();

// Mock promisify to return our mocked functions
jest.mock('util', () => ({
  promisify: jest.fn((fn: any) => {
    const fnName = fn?.name || '';
    if (fnName === 'access') return fsPromises.access;
    if (fnName === 'mkdir') return fsPromises.mkdir;
    if (fnName === 'rm') return fsPromises.rm;
    if (fnName === 'exec') return mockExecAsync;
    return jest.fn();
  }),
}));

import { GitService } from '@/services/GitService';
import * as fs from 'fs';

describe('GitService', () => {
  let gitService: GitService;

  beforeEach(() => {
    console.log('[GitService.test] Setting up test suite');
    jest.clearAllMocks();
    gitService = GitService.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      console.log('[GitService.test] Testing singleton pattern');
      const instance1 = GitService.getInstance();
      const instance2 = GitService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('isGitRepository', () => {
    it('should return true when .git directory exists', async () => {
      console.log('[GitService.test] Testing isGitRepository - valid repo');
      fsPromises.access.mockResolvedValueOnce(undefined);

      const result = await gitService.isGitRepository('/test/repo');

      expect(result).toBe(true);
      expect(fsPromises.access).toHaveBeenCalledWith('/test/repo/.git', fs.constants.F_OK);
    });

    it('should return false when .git directory does not exist', async () => {
      console.log('[GitService.test] Testing isGitRepository - invalid repo');
      fsPromises.access.mockRejectedValueOnce(new Error('ENOENT'));

      const result = await gitService.isGitRepository('/test/not-repo');

      expect(result).toBe(false);
    });
  });

  describe('clone', () => {
    it('should successfully clone repository without branch', async () => {
      console.log('[GitService.test] Testing clone - no branch specified');
      // mkdir command
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });
      // git clone command
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Cloning into...', stderr: '' });

      const result = await gitService.clone({
        repoUrl: 'https://github.com/test/repo.git',
        targetPath: '/test/target',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully cloned');
    });

    it('should successfully clone repository with existing branch', async () => {
      console.log('[GitService.test] Testing clone - existing branch');
      // mkdir command
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });
      // git clone command
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Cloning into...', stderr: '' });

      const result = await gitService.clone({
        repoUrl: 'https://github.com/test/repo.git',
        targetPath: '/test/target',
        branchName: 'feature-branch',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully cloned');
    });

    it('should create new branch when remote branch does not exist', async () => {
      console.log('[GitService.test] Testing clone - creating new branch');
      // mkdir command
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });
      // First git clone with branch fails
      mockExecAsync.mockRejectedValueOnce(new Error('Remote branch feature-new not found'));
      // git clone without branch
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Cloning...', stderr: '' });
      // git checkout -b
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Switched to a new branch', stderr: '' });

      const result = await gitService.clone({
        repoUrl: 'https://github.com/test/repo.git',
        targetPath: '/test/target',
        branchName: 'feature-new',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('created new branch');
    });

    it('should handle clone failure', async () => {
      console.log('[GitService.test] Testing clone - failure handling');
      mockExecAsync.mockRejectedValueOnce(new Error('Permission denied'));

      const result = await gitService.clone({
        repoUrl: 'https://github.com/test/repo.git',
        targetPath: '/test/target',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });

    it('should handle timeout during clone', async () => {
      console.log('[GitService.test] Testing clone - timeout');
      mockExecAsync.mockRejectedValueOnce(new Error('Command timed out'));

      const result = await gitService.clone({
        repoUrl: 'https://github.com/test/repo.git',
        targetPath: '/test/target',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('createBranch', () => {
    it('should create and checkout new branch', async () => {
      console.log('[GitService.test] Testing createBranch - new branch');
      // git branch -a command
      mockExecAsync.mockResolvedValueOnce({ stdout: 'main\nfeature-1', stderr: '' });
      // git checkout -b command
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'Switched to a new branch',
        stderr: '',
      });

      const result = await gitService.createBranch('/test/repo', 'feature-new');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Created and switched');
    });

    it('should checkout existing branch', async () => {
      console.log('[GitService.test] Testing createBranch - existing branch');
      // git branch -a command
      mockExecAsync.mockResolvedValueOnce({ stdout: 'main\nfeature-existing', stderr: '' });
      // git checkout command
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Switched to branch', stderr: '' });

      const result = await gitService.createBranch('/test/repo', 'feature-existing');

      expect(result.success).toBe(true);
      expect(result.message).toContain('existing branch');
    });

    it('should handle branch creation failure', async () => {
      console.log('[GitService.test] Testing createBranch - failure');
      mockExecAsync.mockRejectedValueOnce(new Error('fatal: Not a git repository'));

      const result = await gitService.createBranch('/test/repo', 'feature-new');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('pullLatest', () => {
    it('should pull latest changes without branch specification', async () => {
      console.log('[GitService.test] Testing pullLatest - no branch');
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Already up to date', stderr: '' });

      const result = await gitService.pullLatest('/test/repo');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully pulled');
    });

    it('should pull latest changes with branch checkout', async () => {
      console.log('[GitService.test] Testing pullLatest - with branch');
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Success', stderr: '' });

      const result = await gitService.pullLatest('/test/repo', 'main');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully pulled');
    });

    it('should handle pull failure', async () => {
      console.log('[GitService.test] Testing pullLatest - failure');
      mockExecAsync.mockRejectedValueOnce(new Error('merge conflict'));

      const result = await gitService.pullLatest('/test/repo');

      expect(result.success).toBe(false);
      expect(result.error).toContain('merge conflict');
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name', async () => {
      console.log('[GitService.test] Testing getCurrentBranch - success');
      mockExecAsync.mockResolvedValueOnce({ stdout: 'feature-branch\n', stderr: '' });

      const result = await gitService.getCurrentBranch('/test/repo');

      expect(result).toBe('feature-branch');
    });

    it('should return null on error', async () => {
      console.log('[GitService.test] Testing getCurrentBranch - error');
      mockExecAsync.mockRejectedValueOnce(new Error('Not a git repository'));

      const result = await gitService.getCurrentBranch('/test/repo');

      expect(result).toBeNull();
    });
  });

  describe('getRemoteUrl', () => {
    it('should return remote URL', async () => {
      console.log('[GitService.test] Testing getRemoteUrl - success');
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'https://github.com/test/repo.git\n',
        stderr: '',
      });

      const result = await gitService.getRemoteUrl('/test/repo');

      expect(result).toBe('https://github.com/test/repo.git');
    });

    it('should return null when no remote exists', async () => {
      console.log('[GitService.test] Testing getRemoteUrl - no remote');
      mockExecAsync.mockRejectedValueOnce(new Error('No such remote'));

      const result = await gitService.getRemoteUrl('/test/repo');

      expect(result).toBeNull();
    });
  });

  describe('convertRepoUrlToSsh', () => {
    it('should convert HTTPS URL to SSH', () => {
      console.log('[GitService.test] Testing convertRepoUrlToSsh - HTTPS to SSH');
      const result = gitService.convertRepoUrlToSsh('https://github.com/test/repo.git');
      expect(result).toBe('git@github.com:test/repo.git');
    });

    it('should handle HTTPS URL without .git extension', () => {
      console.log('[GitService.test] Testing convertRepoUrlToSsh - no .git');
      const result = gitService.convertRepoUrlToSsh('https://github.com/test/repo');
      expect(result).toBe('git@github.com:test/repo.git');
    });

    it('should return SSH URL unchanged', () => {
      console.log('[GitService.test] Testing convertRepoUrlToSsh - already SSH');
      const sshUrl = 'git@github.com:test/repo.git';
      const result = gitService.convertRepoUrlToSsh(sshUrl);
      expect(result).toBe(sshUrl);
    });

    it('should return other formats unchanged', () => {
      console.log('[GitService.test] Testing convertRepoUrlToSsh - other format');
      const otherUrl = 'git://github.com/test/repo.git';
      const result = gitService.convertRepoUrlToSsh(otherUrl);
      expect(result).toBe(otherUrl);
    });
  });

  describe('repoExists', () => {
    it('should return true when .git exists', async () => {
      console.log('[GitService.test] Testing repoExists - exists');
      fsPromises.access.mockResolvedValueOnce(undefined);

      const result = await gitService.repoExists('/test/repo');

      expect(result).toBe(true);
    });

    it('should return false when .git does not exist', async () => {
      console.log('[GitService.test] Testing repoExists - not exists');
      fsPromises.access.mockRejectedValueOnce(new Error('ENOENT'));

      const result = await gitService.repoExists('/test/repo');

      expect(result).toBe(false);
    });
  });

  describe('remoteBranchExists', () => {
    it('should return true when remote branch exists', async () => {
      console.log('[GitService.test] Testing remoteBranchExists - exists');
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'abc123\trefs/heads/feature-branch',
        stderr: '',
      });

      const result = await gitService.remoteBranchExists('/test/repo', 'feature-branch');

      expect(result).toBe(true);
    });

    it('should return false when remote branch does not exist', async () => {
      console.log('[GitService.test] Testing remoteBranchExists - not exists');
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await gitService.remoteBranchExists('/test/repo', 'non-existent');

      expect(result).toBe(false);
    });

    it('should handle error checking remote branch', async () => {
      console.log('[GitService.test] Testing remoteBranchExists - error');
      mockExecAsync.mockRejectedValueOnce(new Error('Network error'));

      const result = await gitService.remoteBranchExists('/test/repo', 'feature-branch');

      expect(result).toBe(false);
    });
  });

  describe('isValidGitUrl', () => {
    it('should validate HTTPS GitHub URL', () => {
      console.log('[GitService.test] Testing isValidGitUrl - HTTPS GitHub');
      expect(gitService.isValidGitUrl('https://github.com/test/repo.git')).toBe(true);
    });

    it('should validate HTTPS GitHub URL without .git', () => {
      console.log('[GitService.test] Testing isValidGitUrl - HTTPS no .git');
      expect(gitService.isValidGitUrl('https://github.com/test/repo')).toBe(true);
    });

    it('should validate SSH URL', () => {
      console.log('[GitService.test] Testing isValidGitUrl - SSH');
      expect(gitService.isValidGitUrl('git@github.com:test/repo.git')).toBe(true);
    });

    it('should validate git:// URL', () => {
      console.log('[GitService.test] Testing isValidGitUrl - git://');
      expect(gitService.isValidGitUrl('git://github.com/test/repo.git')).toBe(true);
    });

    it('should reject invalid URL - no hostname', () => {
      console.log('[GitService.test] Testing isValidGitUrl - no hostname');
      expect(gitService.isValidGitUrl('https:///test/repo')).toBe(false);
    });

    it('should reject invalid URL - missing pathname', () => {
      console.log('[GitService.test] Testing isValidGitUrl - no pathname');
      expect(gitService.isValidGitUrl('https://github.com/')).toBe(false);
    });

    it('should reject invalid URL - insufficient path parts', () => {
      console.log('[GitService.test] Testing isValidGitUrl - insufficient path');
      expect(gitService.isValidGitUrl('https://github.com/test')).toBe(false);
    });

    it('should reject empty string', () => {
      console.log('[GitService.test] Testing isValidGitUrl - empty string');
      expect(gitService.isValidGitUrl('')).toBe(false);
    });

    it('should reject null/undefined', () => {
      console.log('[GitService.test] Testing isValidGitUrl - null/undefined');
      expect(gitService.isValidGitUrl(null as any)).toBe(false);
      expect(gitService.isValidGitUrl(undefined as any)).toBe(false);
    });

    it('should validate known git hosts', () => {
      console.log('[GitService.test] Testing isValidGitUrl - known hosts');
      expect(gitService.isValidGitUrl('https://gitlab.com/test/repo.git')).toBe(true);
      expect(gitService.isValidGitUrl('https://bitbucket.org/test/repo.git')).toBe(true);
    });
  });

  describe('extractRepoName', () => {
    it('should extract repo name from HTTPS URL with .git', () => {
      console.log('[GitService.test] Testing extractRepoName - HTTPS with .git');
      const result = gitService.extractRepoName('https://github.com/test/repo.git');
      expect(result).toBe('repo');
    });

    it('should extract repo name from HTTPS URL without .git', () => {
      console.log('[GitService.test] Testing extractRepoName - HTTPS no .git');
      const result = gitService.extractRepoName('https://github.com/test/repo');
      expect(result).toBe('repo');
    });

    it('should extract repo name from SSH URL', () => {
      console.log('[GitService.test] Testing extractRepoName - SSH');
      const result = gitService.extractRepoName('git@github.com:test/repo.git');
      expect(result).toBe('repo');
    });

    it('should return unknown-repo for invalid URL', () => {
      console.log('[GitService.test] Testing extractRepoName - invalid');
      const result = gitService.extractRepoName('invalid-url');
      expect(result).toBe('unknown-repo');
    });
  });

  describe('removeWorktree', () => {
    it('should successfully remove worktree without deleting branch', async () => {
      console.log('[GitService.test] Testing removeWorktree - success without branch deletion');
      // git worktree remove
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Success', stderr: '' });
      // fs.rm for directory
      fsPromises.rm.mockResolvedValueOnce(undefined);
      // git worktree prune
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Success', stderr: '' });

      const result = await gitService.removeWorktree({
        mainRepoPath: '/test/main',
        worktreePath: '/test/worktree',
      });

      expect(result.success).toBe(true);
      expect(mockExecAsync).not.toHaveBeenCalledWith(
        expect.stringContaining('git push origin --delete'),
        expect.any(Object)
      );
    });

    it('should remove worktree and delete local branch only when branchName provided and deleteBranch is false', async () => {
      console.log('[GitService.test] Testing removeWorktree - with local branch deletion only');
      // git worktree remove
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Success', stderr: '' });
      // fs.rm for directory
      fsPromises.rm.mockResolvedValueOnce(undefined);
      // git worktree prune
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Success', stderr: '' });
      // git branch -D
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Deleted branch', stderr: '' });

      const result = await gitService.removeWorktree({
        mainRepoPath: '/test/main',
        worktreePath: '/test/worktree',
        branchName: 'feature-branch',
        deleteBranch: false,
      });

      expect(result.success).toBe(true);
      expect(mockExecAsync).toHaveBeenCalledWith(
        'git branch -D "feature-branch"',
        expect.any(Object)
      );
      expect(mockExecAsync).not.toHaveBeenCalledWith(
        expect.stringContaining('git push origin --delete'),
        expect.any(Object)
      );
    });

    it('should remove worktree and delete both local and remote branch when deleteBranch is true', async () => {
      console.log('[GitService.test] Testing removeWorktree - with remote branch deletion');
      // git worktree remove
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Success', stderr: '' });
      // fs.rm for directory
      fsPromises.rm.mockResolvedValueOnce(undefined);
      // git worktree prune
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Success', stderr: '' });
      // git branch -D
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Deleted branch', stderr: '' });
      // git ls-remote (check if branch exists)
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'abc123\trefs/heads/feature-branch',
        stderr: '',
      });
      // git push origin --delete
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Deleted remote branch', stderr: '' });

      const result = await gitService.removeWorktree({
        mainRepoPath: '/test/main',
        worktreePath: '/test/worktree',
        branchName: 'feature-branch',
        deleteBranch: true,
      });

      expect(result.success).toBe(true);
      expect(mockExecAsync).toHaveBeenCalledWith(
        'git branch -D "feature-branch"',
        expect.any(Object)
      );
      expect(mockExecAsync).toHaveBeenCalledWith(
        'git push origin --delete "feature-branch"',
        expect.any(Object)
      );
    });

    it('should handle remote branch deletion when branch does not exist on remote', async () => {
      console.log('[GitService.test] Testing removeWorktree - remote branch does not exist');
      // git worktree remove
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Success', stderr: '' });
      // fs.rm for directory
      fsPromises.rm.mockResolvedValueOnce(undefined);
      // git worktree prune
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Success', stderr: '' });
      // git branch -D
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Deleted branch', stderr: '' });
      // git ls-remote (branch does not exist)
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await gitService.removeWorktree({
        mainRepoPath: '/test/main',
        worktreePath: '/test/worktree',
        branchName: 'feature-branch',
        deleteBranch: true,
      });

      expect(result.success).toBe(true);
      expect(mockExecAsync).not.toHaveBeenCalledWith(
        expect.stringContaining('git push origin --delete'),
        expect.any(Object)
      );
    });

    it('should continue despite remote branch deletion failure', async () => {
      console.log(
        '[GitService.test] Testing removeWorktree - remote deletion failure non-blocking'
      );
      // git worktree remove
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Success', stderr: '' });
      // fs.rm for directory
      fsPromises.rm.mockResolvedValueOnce(undefined);
      // git worktree prune
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Success', stderr: '' });
      // git branch -D
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Deleted branch', stderr: '' });
      // git ls-remote (check if branch exists)
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'abc123\trefs/heads/feature-branch',
        stderr: '',
      });
      // git push origin --delete fails
      mockExecAsync.mockRejectedValueOnce(new Error('Network error'));

      const result = await gitService.removeWorktree({
        mainRepoPath: '/test/main',
        worktreePath: '/test/worktree',
        branchName: 'feature-branch',
        deleteBranch: true,
      });

      expect(result.success).toBe(true);
    });

    it('should continue despite local branch deletion failure', async () => {
      console.log('[GitService.test] Testing removeWorktree - local deletion failure non-blocking');
      // git worktree remove
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Success', stderr: '' });
      // fs.rm for directory
      fsPromises.rm.mockResolvedValueOnce(undefined);
      // git worktree prune
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Success', stderr: '' });
      // git branch -D fails
      mockExecAsync.mockRejectedValueOnce(new Error('Branch not found'));

      const result = await gitService.removeWorktree({
        mainRepoPath: '/test/main',
        worktreePath: '/test/worktree',
        branchName: 'feature-branch',
        deleteBranch: true,
      });

      expect(result.success).toBe(true);
    });

    it('should handle worktree removal failure with fallback to manual delete', async () => {
      console.log('[GitService.test] Testing removeWorktree - fallback');
      // First call (git worktree remove) fails
      mockExecAsync.mockRejectedValueOnce(new Error('Worktree locked'));
      // Manual rm succeeds
      fsPromises.rm.mockResolvedValueOnce(undefined);

      const result = await gitService.removeWorktree({
        mainRepoPath: '/test/main',
        worktreePath: '/test/worktree',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('directory removed');
    });

    it('should handle complete removal failure', async () => {
      console.log('[GitService.test] Testing removeWorktree - complete failure');
      // git worktree remove fails
      mockExecAsync.mockRejectedValueOnce(new Error('Permission denied'));
      // Manual rm also fails
      fsPromises.rm.mockRejectedValueOnce(new Error('Permission denied'));

      const result = await gitService.removeWorktree({
        mainRepoPath: '/test/main',
        worktreePath: '/test/worktree',
      });

      expect(result.success).toBe(false);
    });

    it('should maintain backward compatibility - no deleteBranch parameter defaults to false', async () => {
      console.log('[GitService.test] Testing removeWorktree - backward compatibility');
      // git worktree remove
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Success', stderr: '' });
      // fs.rm for directory
      fsPromises.rm.mockResolvedValueOnce(undefined);
      // git worktree prune
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Success', stderr: '' });
      // git branch -D
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Deleted branch', stderr: '' });

      const result = await gitService.removeWorktree({
        mainRepoPath: '/test/main',
        worktreePath: '/test/worktree',
        branchName: 'feature-branch',
      });

      expect(result.success).toBe(true);
      expect(mockExecAsync).toHaveBeenCalledWith(
        'git branch -D "feature-branch"',
        expect.any(Object)
      );
      expect(mockExecAsync).not.toHaveBeenCalledWith(
        expect.stringContaining('git push origin --delete'),
        expect.any(Object)
      );
    });
  });

  describe('localBranchExists', () => {
    it('should return true when local branch exists', async () => {
      console.log('[GitService.test] Testing localBranchExists - exists');
      mockExecAsync.mockResolvedValueOnce({
        stdout: '  main\n* feature-branch\n  develop',
        stderr: '',
      });

      const result = await gitService.localBranchExists('/test/repo', 'feature-branch');

      expect(result).toBe(true);
    });

    it('should return false when local branch does not exist', async () => {
      console.log('[GitService.test] Testing localBranchExists - not exists');
      mockExecAsync.mockResolvedValueOnce({ stdout: '  main\n* develop', stderr: '' });

      const result = await gitService.localBranchExists('/test/repo', 'non-existent');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      console.log('[GitService.test] Testing localBranchExists - error');
      mockExecAsync.mockRejectedValueOnce(new Error('Not a git repository'));

      const result = await gitService.localBranchExists('/test/repo', 'feature-branch');

      expect(result).toBe(false);
    });

    it('should handle branches with special characters', async () => {
      console.log('[GitService.test] Testing localBranchExists - special characters');
      mockExecAsync.mockResolvedValueOnce({
        stdout: '  main\n* feature/test-123\n  bugfix/issue-456',
        stderr: '',
      });

      const result = await gitService.localBranchExists('/test/repo', 'feature/test-123');

      expect(result).toBe(true);
    });
  });

  describe('getUnpushedCommitCount', () => {
    it('should return commit count when unpushed commits exist', async () => {
      console.log('[GitService.test] Testing getUnpushedCommitCount - has unpushed commits');
      mockExecAsync.mockResolvedValueOnce({ stdout: '3', stderr: '' });

      const result = await gitService.getUnpushedCommitCount('/test/repo', 'feature-branch');

      expect(result).toBe(3);
    });

    it('should return 0 when no unpushed commits', async () => {
      console.log('[GitService.test] Testing getUnpushedCommitCount - no unpushed commits');
      mockExecAsync.mockResolvedValueOnce({ stdout: '0', stderr: '' });

      const result = await gitService.getUnpushedCommitCount('/test/repo', 'feature-branch');

      expect(result).toBe(0);
    });

    it('should return 0 when branch does not exist on remote', async () => {
      console.log('[GitService.test] Testing getUnpushedCommitCount - branch not on remote');
      mockExecAsync.mockRejectedValueOnce(
        new Error("fatal: ambiguous argument 'origin/feature-branch'")
      );

      const result = await gitService.getUnpushedCommitCount('/test/repo', 'feature-branch');

      expect(result).toBe(0);
    });

    it('should return 0 on error', async () => {
      console.log('[GitService.test] Testing getUnpushedCommitCount - error');
      mockExecAsync.mockRejectedValueOnce(new Error('Not a git repository'));

      const result = await gitService.getUnpushedCommitCount('/test/repo', 'feature-branch');

      expect(result).toBe(0);
    });

    it('should handle invalid output gracefully', async () => {
      console.log('[GitService.test] Testing getUnpushedCommitCount - invalid output');
      mockExecAsync.mockResolvedValueOnce({ stdout: 'invalid\n', stderr: '' });

      const result = await gitService.getUnpushedCommitCount('/test/repo', 'feature-branch');

      expect(result).toBe(0);
    });
  });

  describe('isProtectedBranch', () => {
    it('should return true for main branch', () => {
      console.log('[GitService.test] Testing isProtectedBranch - main');
      expect(gitService.isProtectedBranch('main')).toBe(true);
    });

    it('should return true for master branch', () => {
      console.log('[GitService.test] Testing isProtectedBranch - master');
      expect(gitService.isProtectedBranch('master')).toBe(true);
    });

    it('should return true for develop branch', () => {
      console.log('[GitService.test] Testing isProtectedBranch - develop');
      expect(gitService.isProtectedBranch('develop')).toBe(true);
    });

    it('should return false for feature branch', () => {
      console.log('[GitService.test] Testing isProtectedBranch - feature');
      expect(gitService.isProtectedBranch('feature-branch')).toBe(false);
    });

    it('should return false for undefined', () => {
      console.log('[GitService.test] Testing isProtectedBranch - undefined');
      expect(gitService.isProtectedBranch(undefined)).toBe(false);
    });

    it('should be case-insensitive', () => {
      console.log('[GitService.test] Testing isProtectedBranch - case insensitive');
      expect(gitService.isProtectedBranch('MAIN')).toBe(true);
      expect(gitService.isProtectedBranch('Master')).toBe(true);
      expect(gitService.isProtectedBranch('DEVELOP')).toBe(true);
    });
  });

  describe('checkBranchMerged', () => {
    it('should return true when branch is merged', async () => {
      console.log('[GitService.test] Testing checkBranchMerged - branch is merged');
      mockExecAsync.mockResolvedValueOnce({
        stdout: '  main\n  feature-branch\n  develop\n',
        stderr: '',
      });

      const result = await gitService.checkBranchMerged('/test/repo', 'feature-branch');

      expect(result).toBe(true);
      expect(mockExecAsync).toHaveBeenCalledWith('git branch --merged', {
        cwd: '/test/repo',
      });
    });

    it('should return false when branch is not merged', async () => {
      console.log('[GitService.test] Testing checkBranchMerged - branch not merged');
      mockExecAsync.mockResolvedValueOnce({
        stdout: '  main\n  develop\n',
        stderr: '',
      });

      const result = await gitService.checkBranchMerged('/test/repo', 'feature-branch');

      expect(result).toBe(false);
    });

    it('should handle asterisk prefix for current branch', async () => {
      console.log('[GitService.test] Testing checkBranchMerged - asterisk prefix');
      mockExecAsync.mockResolvedValueOnce({
        stdout: '* main\n  feature-branch\n',
        stderr: '',
      });

      const result = await gitService.checkBranchMerged('/test/repo', 'feature-branch');

      expect(result).toBe(true);
    });

    it('should handle branch names with slashes', async () => {
      console.log('[GitService.test] Testing checkBranchMerged - branch with slashes');
      mockExecAsync.mockResolvedValueOnce({
        stdout: '  main\n  feature/test-123\n',
        stderr: '',
      });

      const result = await gitService.checkBranchMerged('/test/repo', 'feature/test-123');

      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      console.log('[GitService.test] Testing checkBranchMerged - error handling');
      mockExecAsync.mockRejectedValueOnce(new Error('Not a git repository'));

      const result = await gitService.checkBranchMerged('/test/repo', 'feature-branch');

      expect(result).toBe(false);
    });

    it('should handle empty output', async () => {
      console.log('[GitService.test] Testing checkBranchMerged - empty output');
      mockExecAsync.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
      });

      const result = await gitService.checkBranchMerged('/test/repo', 'feature-branch');

      expect(result).toBe(false);
    });
  });

  describe('deleteBranch', () => {
    it('should delete branch with safe deletion', async () => {
      console.log('[GitService.test] Testing deleteBranch - safe deletion');
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'Deleted branch feature-branch',
        stderr: '',
      });

      await gitService.deleteBranch('/test/repo', 'feature-branch');

      expect(mockExecAsync).toHaveBeenCalledWith('git branch -d "feature-branch"', {
        cwd: '/test/repo',
      });
    });

    it('should delete branch with force option', async () => {
      console.log('[GitService.test] Testing deleteBranch - force deletion');
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'Deleted branch feature-branch',
        stderr: '',
      });

      await gitService.deleteBranch('/test/repo', 'feature-branch', true);

      expect(mockExecAsync).toHaveBeenCalledWith('git branch -D "feature-branch"', {
        cwd: '/test/repo',
      });
    });

    it('should handle branch names with slashes', async () => {
      console.log('[GitService.test] Testing deleteBranch - branch with slashes');
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'Deleted branch feature/test-123',
        stderr: '',
      });

      await gitService.deleteBranch('/test/repo', 'feature/test-123');

      expect(mockExecAsync).toHaveBeenCalledWith('git branch -d "feature/test-123"', {
        cwd: '/test/repo',
      });
    });

    it('should throw error when branch is not merged', async () => {
      console.log('[GitService.test] Testing deleteBranch - not merged error');
      mockExecAsync.mockRejectedValueOnce(new Error('error: The branch is not fully merged'));

      await expect(gitService.deleteBranch('/test/repo', 'feature-branch')).rejects.toThrow(
        'not fully merged'
      );
    });

    it('should throw error when branch does not exist', async () => {
      console.log('[GitService.test] Testing deleteBranch - branch not found');
      mockExecAsync.mockRejectedValueOnce(new Error('error: branch not found'));

      await expect(gitService.deleteBranch('/test/repo', 'non-existent')).rejects.toThrow(
        'branch not found'
      );
    });

    it('should handle deletion errors', async () => {
      console.log('[GitService.test] Testing deleteBranch - general error');
      mockExecAsync.mockRejectedValueOnce(new Error('Permission denied'));

      await expect(gitService.deleteBranch('/test/repo', 'feature-branch')).rejects.toThrow(
        'Permission denied'
      );
    });
  });

  describe('checkUnpushedCommits', () => {
    it('should return 0 when no unpushed commits', async () => {
      console.log('[GitService.test] Testing checkUnpushedCommits - no unpushed commits');
      mockExecAsync.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
      });

      const result = await gitService.checkUnpushedCommits('/test/repo', 'feature-branch');

      expect(result).toBe(0);
      expect(mockExecAsync).toHaveBeenCalledWith(
        'git log origin/feature-branch..feature-branch --oneline',
        {
          cwd: '/test/repo',
        }
      );
    });

    it('should return correct count for single unpushed commit', async () => {
      console.log('[GitService.test] Testing checkUnpushedCommits - single commit');
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'abc123 feat: add new feature\n',
        stderr: '',
      });

      const result = await gitService.checkUnpushedCommits('/test/repo', 'feature-branch');

      expect(result).toBe(1);
    });

    it('should return correct count for multiple unpushed commits', async () => {
      console.log('[GitService.test] Testing checkUnpushedCommits - multiple commits');
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'abc123 feat: add feature 1\ndef456 feat: add feature 2\nghi789 fix: bug fix\n',
        stderr: '',
      });

      const result = await gitService.checkUnpushedCommits('/test/repo', 'feature-branch');

      expect(result).toBe(3);
    });

    it('should handle branch names with slashes', async () => {
      console.log('[GitService.test] Testing checkUnpushedCommits - branch with slashes');
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'abc123 feat: add feature\n',
        stderr: '',
      });

      const result = await gitService.checkUnpushedCommits('/test/repo', 'feature/test-123');

      expect(result).toBe(1);
      expect(mockExecAsync).toHaveBeenCalledWith(
        'git log origin/feature/test-123..feature/test-123 --oneline',
        {
          cwd: '/test/repo',
        }
      );
    });

    it('should return 0 when remote branch does not exist', async () => {
      console.log('[GitService.test] Testing checkUnpushedCommits - no remote branch');
      mockExecAsync.mockRejectedValueOnce(new Error('unknown revision or path'));

      const result = await gitService.checkUnpushedCommits('/test/repo', 'new-branch');

      expect(result).toBe(0);
    });

    it('should return 0 on error', async () => {
      console.log('[GitService.test] Testing checkUnpushedCommits - error handling');
      mockExecAsync.mockRejectedValueOnce(new Error('Not a git repository'));

      const result = await gitService.checkUnpushedCommits('/test/repo', 'feature-branch');

      expect(result).toBe(0);
    });

    it('should handle output with trailing newlines', async () => {
      console.log('[GitService.test] Testing checkUnpushedCommits - trailing newlines');
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'abc123 feat: add feature\n\n\n',
        stderr: '',
      });

      const result = await gitService.checkUnpushedCommits('/test/repo', 'feature-branch');

      expect(result).toBe(1);
    });
  });
});
