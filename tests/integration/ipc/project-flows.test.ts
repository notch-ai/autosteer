/**
 * Integration Tests - Project/Resource Flows
 *
 * Tests end-to-end renderer → IPC → service flows for project and resource operations
 */

import { ProjectHandlers } from '@/main/ipc/handlers/project.handlers';
import { ipcMain, dialog } from 'electron';
import * as fs from 'fs/promises';

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
  },
  dialog: {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn(),
    showMessageBox: jest.fn(),
  },
  shell: {
    openPath: jest.fn(),
  },
  BrowserWindow: {
    fromWebContents: jest.fn(() => ({ id: 1 })),
  },
  app: {
    getPath: jest.fn(() => '/mock/userdata'),
  },
}));

jest.mock('fs/promises');
jest.mock('fast-glob');
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(() => []),
    set: jest.fn(),
  }));
});

jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe.skip('Integration: Project/Resource Flows', () => {
  let projectHandlers: ProjectHandlers;

  beforeEach(() => {
    jest.clearAllMocks();
    projectHandlers = new ProjectHandlers();
    projectHandlers.registerHandlers();
  });

  describe('File Operations', () => {
    it('should read file content end-to-end', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue('file content');

      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'file:open'
      );
      expect(handleCall).toBeDefined();

      const handler = handleCall![1];
      const result = await handler({} as any, '/test/file.txt');

      expect(result).toBe('file content');
      expect(fs.readFile).toHaveBeenCalledWith('/test/file.txt', 'utf-8');
    });

    it('should handle file read errors', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'file:open'
      );
      const handler = handleCall![1];

      await expect(handler({} as any, '/invalid/file.txt')).rejects.toThrow('File not found');
    });
  });

  describe('Directory Operations', () => {
    it('should list directory contents', async () => {
      const mockDirents = [
        { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
        { name: 'dir1', isDirectory: () => true, isFile: () => false },
      ];

      (fs.readdir as jest.Mock).mockResolvedValue(mockDirents);

      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'file:list-directory'
      );
      const handler = handleCall![1];

      const result = await handler({} as any, { path: '/test/dir', includeHidden: false });

      expect(result.entries).toHaveLength(2);
      expect(fs.readdir).toHaveBeenCalled();
    });
  });

  describe('Dialog Operations', () => {
    it('should show open file dialog', async () => {
      const mockWindow = { id: 1 };
      require('electron').BrowserWindow.fromWebContents.mockReturnValue(mockWindow);
      (dialog.showOpenDialog as jest.Mock).mockResolvedValue({
        canceled: false,
        filePaths: ['/test/file.txt'],
      });

      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'dialog:openFile'
      );
      const handler = handleCall![1];

      const result = await handler({ sender: {} } as any, {});

      expect(result).toEqual(['/test/file.txt']);
      expect(dialog.showOpenDialog).toHaveBeenCalled();
    });
  });

  describe('Resource Management', () => {
    it('should load resources by IDs', async () => {
      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'resources:loadByIds'
      );
      const handler = handleCall![1];

      const result = await handler({} as any, ['resource-1', 'resource-2']);

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
