// Centralized mocks loaded via jest.config.js moduleNameMapper:
// - electron: __mocks__/electron.ts
// - electron-log: __mocks__/electron-log.ts
//
// Note: Do NOT add jest.mock('electron') here - it conflicts with moduleNameMapper
// and prevents the centralized mock from loading correctly

jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
  }));
});

jest.mock('fs/promises');
jest.mock('fast-glob');

import { ipcMain, shell, BrowserWindow, dialog } from 'electron';
import { ProjectHandlers } from '@/main/ipc/handlers/project.handlers';
import { IPC_CHANNELS } from '@/types/ipc.types';
import { Resource, ResourceType } from '@/entities';

describe('ProjectHandlers', () => {
  let handler: ProjectHandlers;
  let mockStore: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Verify mock is working
    if (!ipcMain || !ipcMain.handle) {
      throw new Error('ipcMain mock not set up correctly');
    }

    mockStore = {
      get: jest.fn(),
      set: jest.fn(),
    };

    handler = new ProjectHandlers();
    (handler as any).store = mockStore;
  });

  describe('File Operations', () => {
    describe('registerHandlers', () => {
      it('should register all file operation IPC channels', () => {
        handler.registerHandlers();

        expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.FILE_OPEN, expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.FILE_SAVE, expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith(
          IPC_CHANNELS.FILE_SAVE_AS,
          expect.any(Function)
        );
        expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.FOLDER_OPEN, expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith(
          IPC_CHANNELS.DIALOG_OPEN_FILE,
          expect.any(Function)
        );
        expect(ipcMain.handle).toHaveBeenCalledWith(
          IPC_CHANNELS.DIALOG_SAVE_FILE,
          expect.any(Function)
        );
        expect(ipcMain.handle).toHaveBeenCalledWith(
          IPC_CHANNELS.DIALOG_MESSAGE,
          expect.any(Function)
        );
        expect(ipcMain.handle).toHaveBeenCalledWith('file:pathExists', expect.any(Function));
      });
    });

    describe('file:open', () => {
      it('should read file content successfully', async () => {
        handler.registerHandlers();

        const fs = require('fs/promises');
        fs.readFile = jest.fn().mockResolvedValue('file content');

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.FILE_OPEN
        );
        const handlerFn = handleCall[1];
        const result = await handlerFn({}, '/path/to/file.txt');

        expect(fs.readFile).toHaveBeenCalledWith('/path/to/file.txt', 'utf-8');
        expect(result).toBe('file content');
      });

      it('should handle file read errors', async () => {
        handler.registerHandlers();

        const fs = require('fs/promises');
        fs.readFile = jest.fn().mockRejectedValue(new Error('File not found'));

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.FILE_OPEN
        );
        const handlerFn = handleCall[1];

        await expect(handlerFn({}, '/invalid/path.txt')).rejects.toThrow('File not found');
      });
    });

    describe('file:save', () => {
      it('should write file content successfully', async () => {
        handler.registerHandlers();

        const fs = require('fs/promises');
        fs.writeFile = jest.fn().mockResolvedValue(undefined);

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.FILE_SAVE
        );
        const handlerFn = handleCall[1];
        await handlerFn({}, '/path/to/file.txt', 'new content');

        expect(fs.writeFile).toHaveBeenCalledWith('/path/to/file.txt', 'new content', 'utf-8');
      });

      it('should handle file write errors', async () => {
        handler.registerHandlers();

        const fs = require('fs/promises');
        fs.writeFile = jest.fn().mockRejectedValue(new Error('Permission denied'));

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.FILE_SAVE
        );
        const handlerFn = handleCall[1];

        await expect(handlerFn({}, '/readonly/file.txt', 'content')).rejects.toThrow(
          'Permission denied'
        );
      });
    });

    describe('file:saveAs', () => {
      it('should show save dialog and write file', async () => {
        handler.registerHandlers();

        const mockWindow = {};
        (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(mockWindow);
        (dialog.showSaveDialog as jest.Mock).mockResolvedValue({
          canceled: false,
          filePath: '/path/to/newfile.txt',
        });

        const fs = require('fs/promises');
        fs.writeFile = jest.fn().mockResolvedValue(undefined);

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.FILE_SAVE_AS
        );
        const handlerFn = handleCall[1];
        const result = await handlerFn({ sender: {} }, 'content', '/default/path.txt');

        expect(dialog.showSaveDialog).toHaveBeenCalled();
        expect(fs.writeFile).toHaveBeenCalledWith('/path/to/newfile.txt', 'content', 'utf-8');
        expect(result).toBe('/path/to/newfile.txt');
      });

      it('should return null when dialog is cancelled', async () => {
        handler.registerHandlers();

        const mockWindow = {};
        (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(mockWindow);
        (dialog.showSaveDialog as jest.Mock).mockResolvedValue({
          canceled: true,
        });

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.FILE_SAVE_AS
        );
        const handlerFn = handleCall[1];
        const result = await handlerFn({ sender: {} }, 'content');

        expect(result).toBeNull();
      });
    });

    describe('folder:open', () => {
      it('should open folder in native file explorer', async () => {
        handler.registerHandlers();

        (shell.openPath as jest.Mock).mockResolvedValue('');

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.FOLDER_OPEN
        );
        const handlerFn = handleCall[1];
        await handlerFn({}, '/path/to/folder');

        expect(shell.openPath).toHaveBeenCalledWith('/path/to/folder');
      });
    });

    describe('dialog:openFile', () => {
      it('should show file picker dialog', async () => {
        handler.registerHandlers();

        const mockWindow = {};
        (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(mockWindow);
        (dialog.showOpenDialog as jest.Mock).mockResolvedValue({
          canceled: false,
          filePaths: ['/selected/file.txt'],
        });

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.DIALOG_OPEN_FILE
        );
        const handlerFn = handleCall[1];
        const result = await handlerFn({ sender: {} });

        expect(dialog.showOpenDialog).toHaveBeenCalled();
        expect(result).toEqual(['/selected/file.txt']);
      });
    });

    describe('dialog:saveFile', () => {
      it('should show save file dialog', async () => {
        handler.registerHandlers();

        const mockWindow = {};
        (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(mockWindow);
        (dialog.showSaveDialog as jest.Mock).mockResolvedValue({
          canceled: false,
          filePath: '/save/path.txt',
        });

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.DIALOG_SAVE_FILE
        );
        const handlerFn = handleCall[1];
        const result = await handlerFn({ sender: {} });

        expect(dialog.showSaveDialog).toHaveBeenCalled();
        expect(result).toBe('/save/path.txt');
      });
    });

    describe('dialog:message', () => {
      it('should show message box dialog', async () => {
        handler.registerHandlers();

        const mockWindow = {};
        (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(mockWindow);
        (dialog.showMessageBox as jest.Mock).mockResolvedValue({
          response: 0,
        });

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.DIALOG_MESSAGE
        );
        const handlerFn = handleCall[1];
        const result = await handlerFn({ sender: {} }, { message: 'Test message' });

        expect(dialog.showMessageBox).toHaveBeenCalledWith(mockWindow, { message: 'Test message' });
        expect(result).toEqual({ response: 0 });
      });
    });

    describe('file:pathExists', () => {
      it('should check if path exists', async () => {
        handler.registerHandlers();

        const fs = require('fs/promises');
        fs.access = jest.fn().mockResolvedValue(undefined);

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'file:pathExists'
        );
        const handlerFn = handleCall[1];
        const result = await handlerFn({}, '/existing/path');

        expect(fs.access).toHaveBeenCalled();
        expect(result).toBe(true);
      });

      it('should return false for non-existent path', async () => {
        handler.registerHandlers();

        const fs = require('fs/promises');
        fs.access = jest.fn().mockRejectedValue(new Error('Not found'));

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'file:pathExists'
        );
        const handlerFn = handleCall[1];
        const result = await handlerFn({}, '/nonexistent/path');

        expect(result).toBe(false);
      });

      it('should expand tilde in path', async () => {
        handler.registerHandlers();

        const fs = require('fs/promises');
        const path = require('path');
        const os = require('os');

        fs.access = jest.fn().mockResolvedValue(undefined);
        os.homedir = jest.fn().mockReturnValue('/home/user');
        path.join = jest.fn().mockReturnValue('/home/user/.config');

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'file:pathExists'
        );
        const handlerFn = handleCall[1];
        await handlerFn({}, '~/.config');

        expect(path.join).toHaveBeenCalled();
      });
    });
  });

  describe('Resource Operations', () => {
    describe('registerHandlers', () => {
      it('should register all resource operation IPC channels', () => {
        handler.registerHandlers();

        expect(ipcMain.handle).toHaveBeenCalledWith(
          IPC_CHANNELS.RESOURCES_LOAD_BY_IDS,
          expect.any(Function)
        );
        expect(ipcMain.handle).toHaveBeenCalledWith(
          IPC_CHANNELS.RESOURCES_UPLOAD,
          expect.any(Function)
        );
        expect(ipcMain.handle).toHaveBeenCalledWith(
          IPC_CHANNELS.RESOURCES_DELETE,
          expect.any(Function)
        );
        expect(ipcMain.handle).toHaveBeenCalledWith(
          IPC_CHANNELS.RESOURCES_OPEN,
          expect.any(Function)
        );
        expect(ipcMain.handle).toHaveBeenCalledWith(
          IPC_CHANNELS.RESOURCES_PREVIEW,
          expect.any(Function)
        );
      });
    });

    describe('resources:loadByIds', () => {
      it('should load resources by IDs', () => {
        handler.registerHandlers();

        const mockResources: Resource[] = [
          {
            id: 'resource-1',
            name: 'test.png',
            type: ResourceType.IMAGE,
            path: '/path/to/test.png',
            size: 1024,
            mimeType: 'image/png',
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: {},
          },
        ];

        mockStore.get.mockReturnValue(mockResources);

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.RESOURCES_LOAD_BY_IDS
        );
        const handlerFn = handleCall[1];
        const result = handlerFn({}, ['resource-1']);

        expect(mockStore.get).toHaveBeenCalledWith('resources', []);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('resource-1');
      });

      it('should return empty array for non-existent IDs', () => {
        handler.registerHandlers();

        mockStore.get.mockReturnValue([]);

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.RESOURCES_LOAD_BY_IDS
        );
        const handlerFn = handleCall[1];
        const result = handlerFn({}, ['non-existent']);

        expect(result).toHaveLength(0);
      });
    });

    describe('resources:upload', () => {
      it('should upload a new resource', async () => {
        handler.registerHandlers();

        const fs = require('fs/promises');
        fs.stat = jest.fn().mockResolvedValue({ size: 2048 });
        fs.copyFile = jest.fn().mockResolvedValue(undefined);

        mockStore.get.mockReturnValue([]);
        mockStore.set.mockReturnValue(undefined);

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.RESOURCES_UPLOAD
        );
        const handlerFn = handleCall[1];
        const result = await handlerFn({}, '/source/image.png', { mimeType: 'image/png' });

        expect(fs.stat).toHaveBeenCalledWith('/source/image.png');
        expect(fs.copyFile).toHaveBeenCalled();
        expect(mockStore.set).toHaveBeenCalled();
        expect(result).toHaveProperty('id');
        expect(result.name).toBe('image.png');
        expect(result.type).toBe(ResourceType.IMAGE);
      });
    });

    describe('resources:delete', () => {
      it('should delete resource and file', async () => {
        handler.registerHandlers();

        const mockResource: Resource = {
          id: 'resource-1',
          name: 'test.png',
          type: ResourceType.IMAGE,
          path: '/path/to/test.png',
          size: 1024,
          mimeType: 'image/png',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        };

        const fs = require('fs/promises');
        fs.unlink = jest.fn().mockResolvedValue(undefined);

        mockStore.get.mockReturnValue([mockResource]);
        mockStore.set.mockReturnValue(undefined);

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.RESOURCES_DELETE
        );
        const handlerFn = handleCall[1];
        await handlerFn({}, 'resource-1');

        expect(fs.unlink).toHaveBeenCalledWith('/path/to/test.png');
        expect(mockStore.set).toHaveBeenCalledWith('resources', []);
      });

      it('should handle missing resource error', async () => {
        handler.registerHandlers();

        mockStore.get.mockReturnValue([]);

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.RESOURCES_DELETE
        );
        const handlerFn = handleCall[1];

        await expect(handlerFn({}, 'non-existent')).rejects.toThrow('Resource not found');
      });
    });

    describe('resources:open', () => {
      it('should open resource in default application', async () => {
        handler.registerHandlers();

        (shell.openPath as jest.Mock).mockResolvedValue('');

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.RESOURCES_OPEN
        );
        const handlerFn = handleCall[1];
        await handlerFn({}, '/path/to/resource.pdf');

        expect(shell.openPath).toHaveBeenCalledWith('/path/to/resource.pdf');
      });
    });

    describe('resources:preview', () => {
      it('should generate base64 preview of resource', async () => {
        handler.registerHandlers();

        const mockResource: Resource = {
          id: 'resource-1',
          name: 'test.png',
          type: ResourceType.IMAGE,
          path: '/path/to/test.png',
          size: 1024,
          mimeType: 'image/png',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        };

        const fs = require('fs/promises');
        const mockBuffer = Buffer.from('fake image data');
        fs.readFile = jest.fn().mockResolvedValue(mockBuffer);

        mockStore.get.mockReturnValue([mockResource]);

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.RESOURCES_PREVIEW
        );
        const handlerFn = handleCall[1];
        const result = await handlerFn({}, 'resource-1');

        expect(fs.readFile).toHaveBeenCalledWith('/path/to/test.png');
        expect(result).toContain('data:image/png;base64,');
      });

      it('should handle missing resource error', async () => {
        handler.registerHandlers();

        mockStore.get.mockReturnValue([]);

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.RESOURCES_PREVIEW
        );
        const handlerFn = handleCall[1];

        await expect(handlerFn({}, 'non-existent')).rejects.toThrow('Resource not found');
      });
    });
  });
});
