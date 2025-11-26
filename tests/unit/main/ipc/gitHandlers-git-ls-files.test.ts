/**
 * Unit tests for git ls-files command integration in gitHandlers
 * TRD: Git Changes - Expand Untracked Folders to Show Individual Files
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import log from 'electron-log';

// Mock dependencies
jest.mock('child_process');
jest.mock('electron-log');
jest.mock('util', () => ({
  promisify: jest.fn((fn) => fn),
}));

// Import function to test
import { expandUntrackedFolder } from '../../../../src/main/ipc/gitHandlers';

const execAsync = promisify(exec);

describe('gitHandlers - git ls-files integration', () => {
  let mockExecAsync: jest.MockedFunction<typeof execAsync>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExecAsync = execAsync as jest.MockedFunction<typeof execAsync>;
  });

  describe('expandUntrackedFolder', () => {
    const mockCwd = '/test/workspace';
    const mockFolderPath = 'src/components';

    it('should execute git ls-files command with correct parameters', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: 'src/components/Button.tsx\nsrc/components/Input.tsx\n',
        stderr: '',
      } as any);

      const result = await expandUntrackedFolder(mockFolderPath, mockCwd);

      expect(mockExecAsync).toHaveBeenCalledWith(
        `git ls-files --others --exclude-standard "${mockFolderPath}"`,
        {
          cwd: mockCwd,
          encoding: 'utf8',
          maxBuffer: 1024 * 1024,
        }
      );
      expect(result).toEqual(['src/components/Button.tsx', 'src/components/Input.tsx']);
    });

    it('should parse output correctly with newline-separated paths', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: 'src/components/Button.tsx\nsrc/components/Input.tsx\nsrc/components/Modal.tsx\n',
        stderr: '',
      } as any);

      const result = await expandUntrackedFolder(mockFolderPath, mockCwd);

      expect(result).toEqual([
        'src/components/Button.tsx',
        'src/components/Input.tsx',
        'src/components/Modal.tsx',
      ]);
    });

    it('should filter empty lines from output', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: 'src/components/Button.tsx\n\n\nsrc/components/Input.tsx\n\n',
        stderr: '',
      } as any);

      const result = await expandUntrackedFolder(mockFolderPath, mockCwd);

      expect(result).toEqual(['src/components/Button.tsx', 'src/components/Input.tsx']);
    });

    it('should filter results to match folder prefix', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: 'src/components/Button.tsx\nsrc/components/Input.tsx\nsrc/other/File.tsx\n',
        stderr: '',
      } as any);

      const result = await expandUntrackedFolder(mockFolderPath, mockCwd);

      expect(result).toEqual(['src/components/Button.tsx', 'src/components/Input.tsx']);
    });

    it('should handle empty output correctly', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: '',
        stderr: '',
      } as any);

      const result = await expandUntrackedFolder(mockFolderPath, mockCwd);

      expect(result).toEqual([]);
    });

    it('should handle whitespace-only output', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: '   \n\n  \n',
        stderr: '',
      } as any);

      const result = await expandUntrackedFolder(mockFolderPath, mockCwd);

      expect(result).toEqual([]);
    });

    it('should handle command execution errors gracefully', async () => {
      const mockError = new Error('fatal: not a git repository');
      mockExecAsync.mockRejectedValue(mockError);

      await expect(expandUntrackedFolder(mockFolderPath, mockCwd)).rejects.toThrow(
        'fatal: not a git repository'
      );

      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining('[Git] Failed to expand untracked folder'),
        expect.objectContaining({ error: 'fatal: not a git repository' })
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockExecAsync.mockRejectedValue('string error');

      await expect(expandUntrackedFolder(mockFolderPath, mockCwd)).rejects.toBe('string error');

      expect(log.error).toHaveBeenCalled();
    });

    it('should log debug information on success', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: 'src/components/Button.tsx\nsrc/components/Input.tsx\n',
        stderr: '',
      } as any);

      await expandUntrackedFolder(mockFolderPath, mockCwd);

      expect(log.debug).toHaveBeenCalledWith(
        '[Git] Expanding untracked folder',
        expect.objectContaining({
          folderPath: mockFolderPath,
          cwd: mockCwd,
        })
      );
      expect(log.debug).toHaveBeenCalledWith(
        '[Git] Found files in folder',
        expect.objectContaining({
          folderPath: mockFolderPath,
          fileCount: 2,
        })
      );
    });

    it('should handle stderr warnings without failing', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: 'src/components/Button.tsx\n',
        stderr: 'warning: some git warning message\n',
      } as any);

      const result = await expandUntrackedFolder(mockFolderPath, mockCwd);

      expect(result).toEqual(['src/components/Button.tsx']);
      // Warnings are ignored (not logged) when stderr contains 'warning:'
      expect(log.warn).not.toHaveBeenCalled();
    });

    it('should handle paths with spaces correctly', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: 'src/components/Button Component.tsx\nsrc/components/Input Field.tsx\n',
        stderr: '',
      } as any);

      const result = await expandUntrackedFolder(mockFolderPath, mockCwd);

      expect(result).toEqual([
        'src/components/Button Component.tsx',
        'src/components/Input Field.tsx',
      ]);
    });

    it('should handle nested folder paths', async () => {
      const nestedFolder = 'src/components/ui/forms';
      mockExecAsync.mockResolvedValue({
        stdout: 'src/components/ui/forms/TextInput.tsx\nsrc/components/ui/forms/Button.tsx\n',
        stderr: '',
      } as any);

      const result = await expandUntrackedFolder(nestedFolder, mockCwd);

      expect(mockExecAsync).toHaveBeenCalledWith(
        `git ls-files --others --exclude-standard "${nestedFolder}"`,
        expect.any(Object)
      );

      expect(result).toEqual([
        'src/components/ui/forms/TextInput.tsx',
        'src/components/ui/forms/Button.tsx',
      ]);
    });

    it('should preserve relative paths from git root', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: 'src/components/Button.tsx\npackages/ui/Input.tsx\n',
        stderr: '',
      } as any);

      const result = await expandUntrackedFolder('', mockCwd); // Query all untracked

      expect(result).toContain('src/components/Button.tsx');
      expect(result).toContain('packages/ui/Input.tsx');
    });
  });
});
