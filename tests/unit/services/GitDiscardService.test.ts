/**
 * Tests for GitDiscardService
 * Comprehensive test coverage for git discard operations
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GitDiscardService, DiscardLineInfo } from '@/services/GitDiscardService';
import { DiffHunk } from '@/types/git-diff.types';

// Mock window.electron
const mockIpcInvoke = jest.fn<any>();

// Assign directly to window.electron
(window as any).electron = {
  ipcRenderer: {
    invoke: mockIpcInvoke,
  },
};

describe('GitDiscardService', () => {
  beforeEach(() => {
    console.log('[GitDiscardService Test] Setting up test');
    jest.clearAllMocks();
    mockIpcInvoke.mockResolvedValue(undefined as any);
  });

  describe('discardFile', () => {
    it('should call IPC with correct parameters', async () => {
      console.log('[GitDiscardService Test] Testing discardFile IPC call');
      const repoPath = '/path/to/repo';
      const filePath = 'src/components/Button.tsx';

      await GitDiscardService.discardFile(repoPath, filePath);

      expect(mockIpcInvoke).toHaveBeenCalledWith('git-diff:discard-file', {
        repoPath,
        filePath,
      });
    });

    it('should handle absolute file paths', async () => {
      console.log('[GitDiscardService Test] Testing discardFile with absolute path');
      const repoPath = '/home/user/project';
      const filePath = '/home/user/project/src/index.ts';

      await GitDiscardService.discardFile(repoPath, filePath);

      expect(mockIpcInvoke).toHaveBeenCalledWith('git-diff:discard-file', {
        repoPath,
        filePath,
      });
    });

    it('should handle relative file paths', async () => {
      console.log('[GitDiscardService Test] Testing discardFile with relative path');
      const repoPath = '/workspace/app';
      const filePath = './src/utils/helper.ts';

      await GitDiscardService.discardFile(repoPath, filePath);

      expect(mockIpcInvoke).toHaveBeenCalledWith('git-diff:discard-file', {
        repoPath,
        filePath,
      });
    });

    it('should handle nested directory paths', async () => {
      console.log('[GitDiscardService Test] Testing discardFile with nested path');
      const repoPath = '/repo';
      const filePath = 'deeply/nested/folder/structure/file.js';

      await GitDiscardService.discardFile(repoPath, filePath);

      expect(mockIpcInvoke).toHaveBeenCalledWith('git-diff:discard-file', {
        repoPath,
        filePath,
      });
    });

    it('should handle IPC errors', async () => {
      console.log('[GitDiscardService Test] Testing discardFile error handling');
      const error = new Error('Permission denied');
      mockIpcInvoke.mockRejectedValue(error);

      const repoPath = '/repo';
      const filePath = 'file.txt';

      await expect(GitDiscardService.discardFile(repoPath, filePath)).rejects.toThrow(
        'Permission denied'
      );
    });

    it('should wait for IPC response', async () => {
      console.log('[GitDiscardService Test] Testing discardFile async behavior');
      let resolved = false;
      mockIpcInvoke.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolved = true;
              resolve(undefined);
            }, 100);
          })
      );

      const promise = GitDiscardService.discardFile('/repo', 'file.txt');

      expect(resolved).toBe(false);
      await promise;
      expect(resolved).toBe(true);
    });
  });

  describe('discardHunk', () => {
    const createTestHunk = (overrides?: Partial<DiffHunk>): DiffHunk => ({
      oldStart: 10,
      oldLines: 5,
      newStart: 10,
      newLines: 7,
      changes: [
        { type: 'del', content: '- old line', oldLineNumber: 10 },
        { type: 'add', content: '+ new line', newLineNumber: 10 },
      ],
      hasConflicts: false,
      ...overrides,
    });

    it('should call IPC with correct parameters', async () => {
      console.log('[GitDiscardService Test] Testing discardHunk IPC call');
      const repoPath = '/repo';
      const filePath = 'src/app.ts';
      const hunk = createTestHunk();

      await GitDiscardService.discardHunk(repoPath, filePath, hunk);

      expect(mockIpcInvoke).toHaveBeenCalledWith('git-diff:discard-hunk', {
        repoPath,
        filePath,
        hunk,
      });
    });

    it('should handle hunk with additions only', async () => {
      console.log('[GitDiscardService Test] Testing discardHunk with additions only');
      const hunk = createTestHunk({
        changes: [
          { type: 'add', content: '+ new line 1', newLineNumber: 10 },
          { type: 'add', content: '+ new line 2', newLineNumber: 11 },
        ],
      });

      await GitDiscardService.discardHunk('/repo', 'file.txt', hunk);

      expect(mockIpcInvoke).toHaveBeenCalledWith('git-diff:discard-hunk', {
        repoPath: '/repo',
        filePath: 'file.txt',
        hunk,
      });
    });

    it('should handle hunk with deletions only', async () => {
      console.log('[GitDiscardService Test] Testing discardHunk with deletions only');
      const hunk = createTestHunk({
        changes: [
          { type: 'del', content: '- old line 1', oldLineNumber: 10 },
          { type: 'del', content: '- old line 2', oldLineNumber: 11 },
        ],
      });

      await GitDiscardService.discardHunk('/repo', 'file.txt', hunk);

      expect(mockIpcInvoke).toHaveBeenCalledWith('git-diff:discard-hunk', {
        repoPath: '/repo',
        filePath: 'file.txt',
        hunk,
      });
    });

    it('should handle hunk with normal lines', async () => {
      console.log('[GitDiscardService Test] Testing discardHunk with normal lines');
      const hunk = createTestHunk({
        changes: [
          { type: 'normal', content: '  unchanged line 1' },
          { type: 'add', content: '+ new line', newLineNumber: 11 },
          { type: 'normal', content: '  unchanged line 2' },
        ],
      });

      await GitDiscardService.discardHunk('/repo', 'file.txt', hunk);

      expect(mockIpcInvoke).toHaveBeenCalled();
    });

    it('should handle hunk with conflicts', async () => {
      console.log('[GitDiscardService Test] Testing discardHunk with conflicts');
      const hunk = createTestHunk({
        hasConflicts: true,
        changes: [
          { type: 'add', content: '+ conflicting change', newLineNumber: 10, isConflict: true },
        ],
      });

      await GitDiscardService.discardHunk('/repo', 'file.txt', hunk);

      expect(mockIpcInvoke).toHaveBeenCalledWith('git-diff:discard-hunk', {
        repoPath: '/repo',
        filePath: 'file.txt',
        hunk,
      });
    });

    it('should handle large hunks', async () => {
      console.log('[GitDiscardService Test] Testing discardHunk with large hunk');
      const changes = Array.from({ length: 100 }, (_, i) => ({
        type: 'add' as const,
        content: `+ line ${i}`,
        newLineNumber: i + 1,
      }));

      const largeHunk = createTestHunk({
        oldLines: 0,
        newLines: 100,
        changes,
      });

      await GitDiscardService.discardHunk('/repo', 'file.txt', largeHunk);

      expect(mockIpcInvoke).toHaveBeenCalled();
    });

    it('should handle IPC errors', async () => {
      console.log('[GitDiscardService Test] Testing discardHunk error handling');
      const error = new Error('Git operation failed');
      mockIpcInvoke.mockRejectedValue(error);

      const hunk = createTestHunk();

      await expect(GitDiscardService.discardHunk('/repo', 'file.txt', hunk)).rejects.toThrow(
        'Git operation failed'
      );
    });
  });

  describe('discardLines', () => {
    it('should call IPC with correct parameters', async () => {
      console.log('[GitDiscardService Test] Testing discardLines IPC call');
      const repoPath = '/repo';
      const filePath = 'src/main.ts';
      const lines: DiscardLineInfo[] = [
        { lineNumber: 10, type: 'add' },
        { lineNumber: 15, type: 'del' },
      ];

      await GitDiscardService.discardLines(repoPath, filePath, lines);

      expect(mockIpcInvoke).toHaveBeenCalledWith('git-diff:discard-lines', {
        repoPath,
        filePath,
        lines,
      });
    });

    it('should handle single line discard', async () => {
      console.log('[GitDiscardService Test] Testing discardLines with single line');
      const lines: DiscardLineInfo[] = [{ lineNumber: 42, type: 'add' }];

      await GitDiscardService.discardLines('/repo', 'file.txt', lines);

      expect(mockIpcInvoke).toHaveBeenCalledWith('git-diff:discard-lines', {
        repoPath: '/repo',
        filePath: 'file.txt',
        lines,
      });
    });

    it('should handle multiple added lines', async () => {
      console.log('[GitDiscardService Test] Testing discardLines with multiple additions');
      const lines: DiscardLineInfo[] = [
        { lineNumber: 5, type: 'add' },
        { lineNumber: 10, type: 'add' },
        { lineNumber: 15, type: 'add' },
      ];

      await GitDiscardService.discardLines('/repo', 'file.txt', lines);

      expect(mockIpcInvoke).toHaveBeenCalledWith('git-diff:discard-lines', {
        repoPath: '/repo',
        filePath: 'file.txt',
        lines,
      });
    });

    it('should handle multiple deleted lines', async () => {
      console.log('[GitDiscardService Test] Testing discardLines with multiple deletions');
      const lines: DiscardLineInfo[] = [
        { lineNumber: 20, type: 'del' },
        { lineNumber: 21, type: 'del' },
        { lineNumber: 22, type: 'del' },
      ];

      await GitDiscardService.discardLines('/repo', 'file.txt', lines);

      expect(mockIpcInvoke).toHaveBeenCalledWith('git-diff:discard-lines', {
        repoPath: '/repo',
        filePath: 'file.txt',
        lines,
      });
    });

    it('should handle mixed add and delete lines', async () => {
      console.log('[GitDiscardService Test] Testing discardLines with mixed types');
      const lines: DiscardLineInfo[] = [
        { lineNumber: 5, type: 'add' },
        { lineNumber: 10, type: 'del' },
        { lineNumber: 15, type: 'add' },
        { lineNumber: 20, type: 'del' },
      ];

      await GitDiscardService.discardLines('/repo', 'file.txt', lines);

      expect(mockIpcInvoke).toHaveBeenCalledWith('git-diff:discard-lines', {
        repoPath: '/repo',
        filePath: 'file.txt',
        lines,
      });
    });

    it('should handle empty lines array', async () => {
      console.log('[GitDiscardService Test] Testing discardLines with empty array');
      const lines: DiscardLineInfo[] = [];

      await GitDiscardService.discardLines('/repo', 'file.txt', lines);

      expect(mockIpcInvoke).toHaveBeenCalledWith('git-diff:discard-lines', {
        repoPath: '/repo',
        filePath: 'file.txt',
        lines: [],
      });
    });

    it('should handle non-sequential line numbers', async () => {
      console.log('[GitDiscardService Test] Testing discardLines with non-sequential lines');
      const lines: DiscardLineInfo[] = [
        { lineNumber: 100, type: 'add' },
        { lineNumber: 5, type: 'del' },
        { lineNumber: 50, type: 'add' },
      ];

      await GitDiscardService.discardLines('/repo', 'file.txt', lines);

      expect(mockIpcInvoke).toHaveBeenCalled();
    });

    it('should handle timeout error', async () => {
      console.log('[GitDiscardService Test] Testing discardLines timeout');
      mockIpcInvoke.mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('IPC call timed out after 5 seconds')), 5100);
          })
      );

      const lines: DiscardLineInfo[] = [{ lineNumber: 1, type: 'add' }];

      await expect(GitDiscardService.discardLines('/repo', 'file.txt', lines)).rejects.toThrow(
        'IPC call timed out after 5 seconds'
      );
    }, 10000); // 10 second timeout for this test

    it('should complete before timeout for fast IPC', async () => {
      console.log('[GitDiscardService Test] Testing discardLines completes before timeout');
      mockIpcInvoke.mockResolvedValue(undefined as any);

      const lines: DiscardLineInfo[] = [{ lineNumber: 1, type: 'add' }];

      await expect(
        GitDiscardService.discardLines('/repo', 'file.txt', lines)
      ).resolves.toBeUndefined();
    });

    it('should handle IPC errors', async () => {
      console.log('[GitDiscardService Test] Testing discardLines error handling');
      const error = new Error('File not found');
      mockIpcInvoke.mockRejectedValue(error);

      const lines: DiscardLineInfo[] = [{ lineNumber: 1, type: 'add' }];

      await expect(GitDiscardService.discardLines('/repo', 'file.txt', lines)).rejects.toThrow(
        'File not found'
      );
    });
  });

  describe('restoreFile', () => {
    it('should call IPC with correct parameters', async () => {
      console.log('[GitDiscardService Test] Testing restoreFile IPC call');
      const repoPath = '/path/to/repo';
      const filePath = 'src/deleted-file.ts';

      await GitDiscardService.restoreFile(repoPath, filePath);

      expect(mockIpcInvoke).toHaveBeenCalledWith('git-diff:restore-file', {
        repoPath,
        filePath,
      });
    });

    it('should handle deleted files', async () => {
      console.log('[GitDiscardService Test] Testing restoreFile for deleted file');
      const repoPath = '/repo';
      const filePath = 'removed-component.tsx';

      await GitDiscardService.restoreFile(repoPath, filePath);

      expect(mockIpcInvoke).toHaveBeenCalledWith('git-diff:restore-file', {
        repoPath,
        filePath,
      });
    });

    it('should handle nested file paths', async () => {
      console.log('[GitDiscardService Test] Testing restoreFile with nested path');
      const repoPath = '/workspace';
      const filePath = 'src/components/features/Button/Button.tsx';

      await GitDiscardService.restoreFile(repoPath, filePath);

      expect(mockIpcInvoke).toHaveBeenCalledWith('git-diff:restore-file', {
        repoPath,
        filePath,
      });
    });

    it('should handle files with special characters', async () => {
      console.log('[GitDiscardService Test] Testing restoreFile with special characters');
      const repoPath = '/repo';
      const filePath = 'src/file-with-spaces and-special_chars.ts';

      await GitDiscardService.restoreFile(repoPath, filePath);

      expect(mockIpcInvoke).toHaveBeenCalledWith('git-diff:restore-file', {
        repoPath,
        filePath,
      });
    });

    it('should handle IPC errors', async () => {
      console.log('[GitDiscardService Test] Testing restoreFile error handling');
      const error = new Error('File cannot be restored');
      mockIpcInvoke.mockRejectedValue(error);

      await expect(GitDiscardService.restoreFile('/repo', 'file.txt')).rejects.toThrow(
        'File cannot be restored'
      );
    });

    it('should wait for IPC response', async () => {
      console.log('[GitDiscardService Test] Testing restoreFile async behavior');
      let resolved = false;
      mockIpcInvoke.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolved = true;
              resolve(undefined);
            }, 50);
          })
      );

      const promise = GitDiscardService.restoreFile('/repo', 'file.txt');

      expect(resolved).toBe(false);
      await promise;
      expect(resolved).toBe(true);
    });
  });

  describe('console logging', () => {
    it('should log discardFile calls', async () => {
      console.log('[GitDiscardService Test] Testing discardFile logging');
      const consoleSpy = jest.spyOn(console, 'log');

      await GitDiscardService.discardFile('/repo', 'file.txt');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[GitDiscardService] Calling discard-file IPC',
        expect.objectContaining({
          repoPath: '/repo',
          filePath: 'file.txt',
        })
      );
      expect(consoleSpy).toHaveBeenCalledWith('[GitDiscardService] discard-file IPC returned');

      consoleSpy.mockRestore();
    });

    it('should log discardHunk calls', async () => {
      console.log('[GitDiscardService Test] Testing discardHunk logging');
      const consoleSpy = jest.spyOn(console, 'log');
      const hunk: DiffHunk = {
        oldStart: 10,
        oldLines: 5,
        newStart: 10,
        newLines: 5,
        changes: [],
        hasConflicts: false,
      };

      await GitDiscardService.discardHunk('/repo', 'file.txt', hunk);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[GitDiscardService] Calling discard-hunk IPC',
        expect.objectContaining({
          repoPath: '/repo',
          filePath: 'file.txt',
          oldStart: 10,
          hunk: expect.any(Object),
        })
      );
      expect(consoleSpy).toHaveBeenCalledWith('[GitDiscardService] discard-hunk IPC returned');

      consoleSpy.mockRestore();
    });

    it('should log discardLines calls', async () => {
      console.log('[GitDiscardService Test] Testing discardLines logging');
      const consoleSpy = jest.spyOn(console, 'log');
      const lines: DiscardLineInfo[] = [{ lineNumber: 1, type: 'add' }];

      await GitDiscardService.discardLines('/repo', 'file.txt', lines);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[GitDiscardService] Calling discard-lines IPC',
        expect.objectContaining({
          repoPath: '/repo',
          filePath: 'file.txt',
          lineCount: 1,
          lines,
        })
      );
      expect(consoleSpy).toHaveBeenCalledWith('[GitDiscardService] discard-lines IPC returned');

      consoleSpy.mockRestore();
    });

    it('should log restoreFile calls', async () => {
      console.log('[GitDiscardService Test] Testing restoreFile logging');
      const consoleSpy = jest.spyOn(console, 'log');

      await GitDiscardService.restoreFile('/repo', 'file.txt');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[GitDiscardService] Calling restore-file IPC',
        expect.objectContaining({
          repoPath: '/repo',
          filePath: 'file.txt',
        })
      );
      expect(consoleSpy).toHaveBeenCalledWith('[GitDiscardService] restore-file IPC returned');

      consoleSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle empty repo path', async () => {
      console.log('[GitDiscardService Test] Testing empty repo path');
      await GitDiscardService.discardFile('', 'file.txt');

      expect(mockIpcInvoke).toHaveBeenCalledWith('git-diff:discard-file', {
        repoPath: '',
        filePath: 'file.txt',
      });
    });

    it('should handle empty file path', async () => {
      console.log('[GitDiscardService Test] Testing empty file path');
      await GitDiscardService.discardFile('/repo', '');

      expect(mockIpcInvoke).toHaveBeenCalledWith('git-diff:discard-file', {
        repoPath: '/repo',
        filePath: '',
      });
    });

    it('should handle concurrent discard operations', async () => {
      console.log('[GitDiscardService Test] Testing concurrent operations');
      const operations = [
        GitDiscardService.discardFile('/repo', 'file1.txt'),
        GitDiscardService.discardFile('/repo', 'file2.txt'),
        GitDiscardService.discardFile('/repo', 'file3.txt'),
      ];

      await Promise.all(operations);

      expect(mockIpcInvoke).toHaveBeenCalledTimes(3);
    });

    it('should handle very long file paths', async () => {
      console.log('[GitDiscardService Test] Testing very long file path');
      const longPath = 'a/'.repeat(100) + 'file.txt';

      await GitDiscardService.discardFile('/repo', longPath);

      expect(mockIpcInvoke).toHaveBeenCalledWith('git-diff:discard-file', {
        repoPath: '/repo',
        filePath: longPath,
      });
    });

    it('should handle file paths with unicode characters', async () => {
      console.log('[GitDiscardService Test] Testing unicode file paths');
      const unicodePath = 'src/文件/ファイル/파일.ts';

      await GitDiscardService.discardFile('/repo', unicodePath);

      expect(mockIpcInvoke).toHaveBeenCalledWith('git-diff:discard-file', {
        repoPath: '/repo',
        filePath: unicodePath,
      });
    });
  });
});
