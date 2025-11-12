/**
 * Git Handlers Test Suite
 * Tests for IPC git handler operations including diff, watching, and file operations
 */

import { GitHandlers } from '@/main/ipc/handlers/git.handlers';
import { GitDiffService } from '@/main/services/GitDiffService';
import { ipcMain } from 'electron';
import { log as logger } from '@/main/services/logger';

// Mock dependencies
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
  },
}));

jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('@/main/services/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/main/services/GitDiffService');

describe('GitHandlers', () => {
  let gitHandlers: GitHandlers;
  let mockGitDiffService: jest.Mocked<GitDiffService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock GitDiffService instance
    mockGitDiffService = {
      getDiff: jest.fn(),
      getUncommittedDiff: jest.fn(),
      getStagedDiff: jest.fn(),
      getConflictedFiles: jest.fn(),
      getFileContent: jest.fn(),
      startWatching: jest.fn(),
      stopWatching: jest.fn(),
      discardFileChanges: jest.fn(),
      discardHunkChanges: jest.fn(),
      discardLineChanges: jest.fn(),
      restoreDeletedFile: jest.fn(),
    } as unknown as jest.Mocked<GitDiffService>;

    // Mock GitDiffService constructor
    (GitDiffService as jest.MockedClass<typeof GitDiffService>).mockImplementation(
      () => mockGitDiffService
    );

    gitHandlers = new GitHandlers();
  });

  describe('registerHandlers', () => {
    it('should register all git IPC handlers', () => {
      gitHandlers.registerHandlers();

      expect(ipcMain.handle).toHaveBeenCalledWith('git-diff:get-diff', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('git-diff:get-uncommitted', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('git-diff:get-staged', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('git-diff:get-conflicts', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith(
        'git-diff:get-file-content',
        expect.any(Function)
      );
      expect(ipcMain.handle).toHaveBeenCalledWith('git-diff:start-watching', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('git-diff:stop-watching', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('git-diff:discard-file', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('git-diff:discard-hunk', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('git-diff:discard-lines', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('git-diff:restore-file', expect.any(Function));
    });
  });

  describe('git-diff:get-diff', () => {
    it('should get diff between commits', async () => {
      const mockDiff = [
        {
          from: 'test.txt',
          to: 'test.txt',
          hunks: [],
          additions: 5,
          deletions: 3,
          isNew: false,
          isDeleted: false,
          isRenamed: false,
          hasConflicts: false,
        },
      ];
      mockGitDiffService.getDiff.mockResolvedValue(mockDiff);

      gitHandlers.registerHandlers();
      const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'git-diff:get-diff'
      )[1];

      const result = await handler(null, {
        repoPath: '/test/repo',
        from: 'HEAD~1',
        to: 'HEAD',
      });

      expect(mockGitDiffService.getDiff).toHaveBeenCalledWith({
        repoPath: '/test/repo',
        from: 'HEAD~1',
        to: 'HEAD',
      });
      expect(result).toEqual(mockDiff);
    });

    it('should handle errors in get-diff', async () => {
      mockGitDiffService.getDiff.mockRejectedValue(new Error('Git error'));

      gitHandlers.registerHandlers();
      const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'git-diff:get-diff'
      )[1];

      const result = await handler(null, {
        repoPath: '/test/repo',
      });

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Git error'),
        message: expect.any(String),
      });
    });
  });

  describe('git-diff:get-uncommitted', () => {
    it('should get uncommitted changes', async () => {
      const mockDiff = [
        {
          from: 'uncommitted.txt',
          to: 'uncommitted.txt',
          hunks: [],
          additions: 2,
          deletions: 1,
          isNew: false,
          isDeleted: false,
          isRenamed: false,
          hasConflicts: false,
        },
      ];
      mockGitDiffService.getUncommittedDiff.mockResolvedValue(mockDiff);

      gitHandlers.registerHandlers();
      const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'git-diff:get-uncommitted'
      )[1];

      const result = await handler(null, { repoPath: '/test/repo' });

      expect(mockGitDiffService.getUncommittedDiff).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockDiff);
    });
  });

  describe('git-diff:get-staged', () => {
    it('should get staged changes', async () => {
      const mockDiff = [
        {
          from: 'staged.txt',
          to: 'staged.txt',
          hunks: [],
          additions: 10,
          deletions: 0,
          isNew: true,
          isDeleted: false,
          isRenamed: false,
          hasConflicts: false,
        },
      ];
      mockGitDiffService.getStagedDiff.mockResolvedValue(mockDiff);

      gitHandlers.registerHandlers();
      const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'git-diff:get-staged'
      )[1];

      const result = await handler(null, { repoPath: '/test/repo', filePath: 'staged.txt' });

      expect(mockGitDiffService.getStagedDiff).toHaveBeenCalledWith('staged.txt');
      expect(result).toEqual(mockDiff);
    });
  });

  describe('git-diff:get-conflicts', () => {
    it('should get list of conflicted files', async () => {
      const mockConflicts = ['conflict1.txt', 'conflict2.txt'];
      mockGitDiffService.getConflictedFiles.mockResolvedValue(mockConflicts);

      gitHandlers.registerHandlers();
      const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'git-diff:get-conflicts'
      )[1];

      const result = await handler(null, '/test/repo');

      expect(mockGitDiffService.getConflictedFiles).toHaveBeenCalled();
      expect(result).toEqual(mockConflicts);
    });
  });

  describe('git-diff:get-file-content', () => {
    it('should get file content at specific ref', async () => {
      const mockContent = 'file content here';
      mockGitDiffService.getFileContent.mockResolvedValue(mockContent);

      gitHandlers.registerHandlers();
      const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'git-diff:get-file-content'
      )[1];

      const result = await handler(null, {
        repoPath: '/test/repo',
        filePath: 'test.txt',
        ref: 'HEAD',
      });

      expect(mockGitDiffService.getFileContent).toHaveBeenCalledWith('test.txt', 'HEAD');
      expect(result).toBe(mockContent);
    });
  });

  describe('git-diff:start-watching', () => {
    it('should start watching for git changes', async () => {
      const mockCleanup = jest.fn();
      mockGitDiffService.startWatching.mockReturnValue(mockCleanup);

      gitHandlers.registerHandlers();
      const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'git-diff:start-watching'
      )[1];

      const mockEvent = { sender: { send: jest.fn() } };
      await handler(mockEvent, '/test/repo');

      expect(mockGitDiffService.startWatching).toHaveBeenCalledWith(expect.any(Function));
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Started watching git changes'),
        expect.any(Object)
      );
    });

    it('should stop existing watcher before starting new one', async () => {
      const mockCleanup = jest.fn();
      mockGitDiffService.startWatching.mockReturnValue(mockCleanup);

      gitHandlers.registerHandlers();
      const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'git-diff:start-watching'
      )[1];

      const mockEvent = { sender: { send: jest.fn() } };

      // Start watching twice for same repo
      await handler(mockEvent, '/test/repo');
      await handler(mockEvent, '/test/repo');

      expect(mockCleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe('git-diff:stop-watching', () => {
    it('should stop watching for git changes', async () => {
      const mockCleanup = jest.fn();
      mockGitDiffService.startWatching.mockReturnValue(mockCleanup);

      gitHandlers.registerHandlers();
      const startHandler = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'git-diff:start-watching'
      )[1];
      const stopHandler = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'git-diff:stop-watching'
      )[1];

      const mockEvent = { sender: { send: jest.fn() } };

      // Start watching first
      await startHandler(mockEvent, '/test/repo');

      // Then stop
      await stopHandler(null, '/test/repo');

      expect(mockCleanup).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Stopped watching git changes'),
        expect.any(Object)
      );
    });

    it('should warn when no watcher found', async () => {
      gitHandlers.registerHandlers();
      const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'git-diff:stop-watching'
      )[1];

      await handler(null, '/nonexistent/repo');

      expect(logger.warn).toHaveBeenCalledWith(
        '[GitHandlers] No watcher found for:',
        '/nonexistent/repo'
      );
    });
  });

  describe('git-diff:discard-file', () => {
    it('should discard all changes in a file', async () => {
      mockGitDiffService.discardFileChanges.mockResolvedValue(undefined);

      gitHandlers.registerHandlers();
      const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'git-diff:discard-file'
      )[1];

      await handler(null, {
        repoPath: '/test/repo',
        filePath: 'test.txt',
      });

      expect(mockGitDiffService.discardFileChanges).toHaveBeenCalledWith('test.txt');
    });
  });

  describe('git-diff:discard-hunk', () => {
    it('should discard changes in a specific hunk', async () => {
      const mockHunk = {
        oldStart: 1,
        oldLines: 5,
        newStart: 1,
        newLines: 7,
        lines: [],
      };
      mockGitDiffService.discardHunkChanges.mockResolvedValue(undefined);

      gitHandlers.registerHandlers();
      const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'git-diff:discard-hunk'
      )[1];

      await handler(null, {
        repoPath: '/test/repo',
        filePath: 'test.txt',
        hunk: mockHunk,
      });

      expect(mockGitDiffService.discardHunkChanges).toHaveBeenCalledWith('test.txt', mockHunk);
    });
  });

  describe('git-diff:discard-lines', () => {
    it('should discard specific lines within a file', async () => {
      const mockLines = [
        { lineNumber: 5, type: 'add' as const },
        { lineNumber: 10, type: 'del' as const },
      ];
      mockGitDiffService.discardLineChanges.mockResolvedValue(undefined);

      gitHandlers.registerHandlers();
      const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'git-diff:discard-lines'
      )[1];

      await handler(null, {
        repoPath: '/test/repo',
        filePath: 'test.txt',
        lines: mockLines,
      });

      expect(mockGitDiffService.discardLineChanges).toHaveBeenCalledWith('test.txt', mockLines);
    });
  });

  describe('git-diff:restore-file', () => {
    it('should restore a deleted file from HEAD', async () => {
      mockGitDiffService.restoreDeletedFile.mockResolvedValue(undefined);

      gitHandlers.registerHandlers();
      const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'git-diff:restore-file'
      )[1];

      await handler(null, {
        repoPath: '/test/repo',
        filePath: 'deleted.txt',
      });

      expect(mockGitDiffService.restoreDeletedFile).toHaveBeenCalledWith('deleted.txt');
    });
  });
});
