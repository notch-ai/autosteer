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
    it('should successfully remove worktree', async () => {
      console.log('[GitService.test] Testing removeWorktree - success');
      // git worktree remove
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Success', stderr: '' });
      // git worktree prune
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Success', stderr: '' });

      const result = await gitService.removeWorktree({
        mainRepoPath: '/test/main',
        worktreePath: '/test/worktree',
      });

      expect(result.success).toBe(true);
    });

    it('should remove worktree and delete local branch', async () => {
      console.log('[GitService.test] Testing removeWorktree - with branch deletion');
      // git worktree remove
      mockExecAsync.mockResolvedValueOnce({ stdout: 'Success', stderr: '' });
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
  });
});
