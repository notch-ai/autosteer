/**
 * Unit tests for folder detection and expansion logic
 * TRD: Git Changes - Expand Untracked Folders to Show Individual Files
 */

import { jest } from '@jest/globals';
import { exec } from 'child_process';
import { promisify } from 'util';

// Mock child_process
jest.mock('child_process');

// Mock util promisify to return our mocked exec
jest.mock('util', () => ({
  promisify: jest.fn((fn) => fn),
}));

// Mock logger
const mockLogger = {
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

jest.mock('electron-log', () => mockLogger);

// Import functions to test
import { isFolder, expandUntrackedFolder } from '../../../../src/main/ipc/gitHandlers';

const execAsync = promisify(exec);

describe('gitHandlers - Folder Detection & Expansion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isFolder', () => {
    it('should return true for paths ending with /', () => {
      expect(isFolder('newfolder/')).toBe(true);
    });

    it('should return true for nested paths ending with /', () => {
      expect(isFolder('parent/subfolder/')).toBe(true);
    });

    it('should return false for file paths without trailing slash', () => {
      expect(isFolder('file.ts')).toBe(false);
    });

    it('should return false for file paths with extensions', () => {
      expect(isFolder('README.md')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isFolder('')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isFolder(null as any)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isFolder(undefined as any)).toBe(false);
    });

    it('should handle whitespace in folder paths', () => {
      expect(isFolder('  folder/  ')).toBe(true);
    });

    it('should handle path with spaces and trailing slash', () => {
      expect(isFolder('my folder/')).toBe(true);
    });
  });

  describe('expandUntrackedFolder', () => {
    it('should return array of file paths for valid folder', async () => {
      const mockStdout = 'newfolder/file1.ts\nnewfolder/file2.ts\nnewfolder/nested/file3.ts\n';

      (execAsync as jest.MockedFunction<typeof execAsync>).mockResolvedValue({
        stdout: mockStdout,
        stderr: '',
      } as any);

      const result = await expandUntrackedFolder('newfolder/', '/test/cwd');

      expect(result).toEqual([
        'newfolder/file1.ts',
        'newfolder/file2.ts',
        'newfolder/nested/file3.ts',
      ]);

      expect(execAsync).toHaveBeenCalledWith(
        expect.stringContaining('git ls-files'),
        expect.objectContaining({ cwd: '/test/cwd' })
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[Git] Expanding untracked folder'),
        expect.objectContaining({ folderPath: 'newfolder/', cwd: '/test/cwd' })
      );
    });

    it('should return empty array for empty folder', async () => {
      (execAsync as jest.MockedFunction<typeof execAsync>).mockResolvedValue({
        stdout: '',
        stderr: '',
      } as any);

      const result = await expandUntrackedFolder('emptyfolder/', '/test/cwd');

      expect(result).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[Git] No files found'),
        expect.objectContaining({ folderPath: 'emptyfolder/' })
      );
    });

    it('should filter results to only include files within folder prefix', async () => {
      const mockStdout = 'newfolder/file1.ts\notherfolder/file2.ts\nnewfolder/file3.ts\n';

      (execAsync as jest.MockedFunction<typeof execAsync>).mockResolvedValue({
        stdout: mockStdout,
        stderr: '',
      } as any);

      const result = await expandUntrackedFolder('newfolder/', '/test/cwd');

      expect(result).toEqual(['newfolder/file1.ts', 'newfolder/file3.ts']);
      expect(result).not.toContain('otherfolder/file2.ts');
    });

    it('should handle git command errors', async () => {
      const mockError = new Error('Git command failed');

      (execAsync as jest.MockedFunction<typeof execAsync>).mockRejectedValue(mockError);

      await expect(expandUntrackedFolder('newfolder/', '/test/cwd')).rejects.toThrow(
        'Git command failed'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('[Git] Failed to expand untracked folder'),
        expect.objectContaining({ error: mockError.message })
      );
    });

    it('should trim whitespace from file paths', async () => {
      const mockStdout = '  newfolder/file1.ts  \n  newfolder/file2.ts  \n';

      (execAsync as jest.MockedFunction<typeof execAsync>).mockResolvedValue({
        stdout: mockStdout,
        stderr: '',
      } as any);

      const result = await expandUntrackedFolder('newfolder/', '/test/cwd');

      expect(result).toEqual(['newfolder/file1.ts', 'newfolder/file2.ts']);
    });

    it('should handle nested folder structures', async () => {
      const mockStdout = 'parent/child1/file1.ts\nparent/child1/file2.ts\nparent/child2/file3.ts\n';

      (execAsync as jest.MockedFunction<typeof execAsync>).mockResolvedValue({
        stdout: mockStdout,
        stderr: '',
      } as any);

      const result = await expandUntrackedFolder('parent/', '/test/cwd');

      expect(result).toEqual([
        'parent/child1/file1.ts',
        'parent/child1/file2.ts',
        'parent/child2/file3.ts',
      ]);
    });

    it('should use correct git command with folder path', async () => {
      (execAsync as jest.MockedFunction<typeof execAsync>).mockResolvedValue({
        stdout: '',
        stderr: '',
      } as any);

      await expandUntrackedFolder('test-folder/', '/workspace/project');

      expect(execAsync).toHaveBeenCalledWith(
        'git ls-files --others --exclude-standard "test-folder/"',
        expect.objectContaining({
          cwd: '/workspace/project',
          encoding: 'utf8',
          maxBuffer: 1024 * 1024,
        })
      );
    });

    it('should handle file paths with special characters', async () => {
      const mockStdout = 'folder/file with spaces.ts\nfolder/file-with-dashes.ts\n';

      (execAsync as jest.MockedFunction<typeof execAsync>).mockResolvedValue({
        stdout: mockStdout,
        stderr: '',
      } as any);

      const result = await expandUntrackedFolder('folder/', '/test/cwd');

      expect(result).toEqual(['folder/file with spaces.ts', 'folder/file-with-dashes.ts']);
    });

    it('should log file count on success', async () => {
      const mockStdout = 'folder/file1.ts\nfolder/file2.ts\nfolder/file3.ts\n';

      (execAsync as jest.MockedFunction<typeof execAsync>).mockResolvedValue({
        stdout: mockStdout,
        stderr: '',
      } as any);

      await expandUntrackedFolder('folder/', '/test/cwd');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[Git] Found'),
        expect.objectContaining({ fileCount: 3 })
      );
    });

    it('should filter empty lines from output', async () => {
      const mockStdout = 'folder/file1.ts\n\n\nfolder/file2.ts\n\n';

      (execAsync as jest.MockedFunction<typeof execAsync>).mockResolvedValue({
        stdout: mockStdout,
        stderr: '',
      } as any);

      const result = await expandUntrackedFolder('folder/', '/test/cwd');

      expect(result).toEqual(['folder/file1.ts', 'folder/file2.ts']);
    });
  });
});
