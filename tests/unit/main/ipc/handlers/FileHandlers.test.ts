import { FileHandlers } from '@/main/ipc/handlers/FileHandlers';
import { ipcMain, IpcMainInvokeEvent, dialog, shell, BrowserWindow } from 'electron';
import { IPC_CHANNELS, IpcChannelNames } from '@/types/ipc.types';
import * as fs from 'fs/promises';
import log from 'electron-log';

// Mock electron
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
    fromWebContents: jest.fn(),
  },
}));

// Mock fs/promises
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));

// Mock electron-log
jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

describe('FileHandlers', () => {
  let fileHandlers: FileHandlers;
  let handlers: Map<string, (...args: any[]) => any>;
  let mockWindow: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create handlers map to store registered handlers
    handlers = new Map();
    (ipcMain.handle as jest.Mock).mockImplementation(
      (channel: string, handler: (...args: any[]) => any) => {
        handlers.set(channel, handler);
      }
    );

    // Create mock window
    mockWindow = { id: 1 };
    (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(mockWindow);

    // Create FileHandlers instance and register handlers
    fileHandlers = new FileHandlers();
    fileHandlers.registerHandlers();
  });

  describe('registerHandlers', () => {
    it('should register all file handlers', () => {
      expect(ipcMain.handle).toHaveBeenCalledTimes(10);
      expect(handlers.has(IPC_CHANNELS.FILE_OPEN)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.FILE_SAVE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.FILE_SAVE_AS)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.FOLDER_OPEN)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.DIALOG_OPEN_FILE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.DIALOG_SAVE_FILE)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.DIALOG_MESSAGE)).toBe(true);
      expect(handlers.has(IpcChannelNames.FILE_LIST_DIRECTORY)).toBe(true);
      expect(handlers.has(IpcChannelNames.FILE_SEARCH_WORKSPACE)).toBe(true);
      expect(handlers.has('file:pathExists')).toBe(true);
    });
  });

  describe('FILE_OPEN handler', () => {
    it('should read and return file content', async () => {
      const filePath = '/path/to/file.txt';
      const content = 'File content';
      (fs.readFile as jest.Mock).mockResolvedValue(content);

      const handler = handlers.get(IPC_CHANNELS.FILE_OPEN)!;
      const event = {} as IpcMainInvokeEvent;
      const result = await handler(event, filePath);

      expect(fs.readFile).toHaveBeenCalledWith(filePath, 'utf-8');
      expect(log.info).toHaveBeenCalledWith(`Opened file: ${filePath}`);
      expect(result).toBe(content);
    });

    it('should throw error on read failure', async () => {
      const filePath = '/path/to/file.txt';
      const error = new Error('Read failed');
      (fs.readFile as jest.Mock).mockRejectedValue(error);

      const handler = handlers.get(IPC_CHANNELS.FILE_OPEN)!;
      const event = {} as IpcMainInvokeEvent;

      await expect(handler(event, filePath)).rejects.toThrow(error);
      expect(log.error).toHaveBeenCalledWith('Failed to open file:', error);
    });
  });

  describe('FILE_SAVE handler', () => {
    it('should save file content', async () => {
      const filePath = '/path/to/file.txt';
      const content = 'New content';
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const handler = handlers.get(IPC_CHANNELS.FILE_SAVE)!;
      const event = {} as IpcMainInvokeEvent;
      await handler(event, filePath, content);

      expect(fs.writeFile).toHaveBeenCalledWith(filePath, content, 'utf-8');
      expect(log.info).toHaveBeenCalledWith(`Saved file: ${filePath}`);
    });

    it('should throw error on save failure', async () => {
      const filePath = '/path/to/file.txt';
      const content = 'New content';
      const error = new Error('Write failed');
      (fs.writeFile as jest.Mock).mockRejectedValue(error);

      const handler = handlers.get(IPC_CHANNELS.FILE_SAVE)!;
      const event = {} as IpcMainInvokeEvent;

      await expect(handler(event, filePath, content)).rejects.toThrow(error);
      expect(log.error).toHaveBeenCalledWith('Failed to save file:', error);
    });
  });

  describe('FILE_SAVE_AS handler', () => {
    it('should save file with dialog', async () => {
      const content = 'File content';
      const selectedPath = '/path/to/newfile.txt';
      (dialog.showSaveDialog as jest.Mock).mockResolvedValue({
        canceled: false,
        filePath: selectedPath,
      });
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const handler = handlers.get(IPC_CHANNELS.FILE_SAVE_AS)!;
      const event = { sender: {} } as IpcMainInvokeEvent;
      const result = await handler(event, content);

      expect(dialog.showSaveDialog).toHaveBeenCalledWith(
        mockWindow,
        expect.objectContaining({
          filters: expect.arrayContaining([
            { name: 'Text Files', extensions: ['txt', 'md'] },
            { name: 'All Files', extensions: ['*'] },
          ]),
        })
      );
      expect(fs.writeFile).toHaveBeenCalledWith(selectedPath, content, 'utf-8');
      expect(log.info).toHaveBeenCalledWith(`Saved file as: ${selectedPath}`);
      expect(result).toBe(selectedPath);
    });

    it('should use default path if provided', async () => {
      const content = 'File content';
      const defaultPath = '/default/path.txt';
      const selectedPath = '/path/to/newfile.txt';
      (dialog.showSaveDialog as jest.Mock).mockResolvedValue({
        canceled: false,
        filePath: selectedPath,
      });
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const handler = handlers.get(IPC_CHANNELS.FILE_SAVE_AS)!;
      const event = { sender: {} } as IpcMainInvokeEvent;
      await handler(event, content, defaultPath);

      expect(dialog.showSaveDialog).toHaveBeenCalledWith(
        mockWindow,
        expect.objectContaining({
          defaultPath,
        })
      );
    });

    it('should return null if dialog is canceled', async () => {
      const content = 'File content';
      (dialog.showSaveDialog as jest.Mock).mockResolvedValue({
        canceled: true,
      });

      const handler = handlers.get(IPC_CHANNELS.FILE_SAVE_AS)!;
      const event = { sender: {} } as IpcMainInvokeEvent;
      const result = await handler(event, content);

      expect(fs.writeFile).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should throw error if no window found', async () => {
      (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(null);

      const handler = handlers.get(IPC_CHANNELS.FILE_SAVE_AS)!;
      const event = { sender: {} } as IpcMainInvokeEvent;

      await expect(handler(event, 'content')).rejects.toThrow('No window found');
      expect(log.error).toHaveBeenCalledWith('Failed to save file as:', expect.any(Error));
    });
  });

  describe('FOLDER_OPEN handler', () => {
    it('should open folder in shell', async () => {
      const folderPath = '/path/to/folder';
      (shell.openPath as jest.Mock).mockResolvedValue('');

      const handler = handlers.get(IPC_CHANNELS.FOLDER_OPEN)!;
      const event = {} as IpcMainInvokeEvent;
      await handler(event, folderPath);

      expect(shell.openPath).toHaveBeenCalledWith(folderPath);
      expect(log.info).toHaveBeenCalledWith(`Opened folder: ${folderPath}`);
    });

    it('should throw error on open failure', async () => {
      const folderPath = '/path/to/folder';
      const error = new Error('Open failed');
      (shell.openPath as jest.Mock).mockRejectedValue(error);

      const handler = handlers.get(IPC_CHANNELS.FOLDER_OPEN)!;
      const event = {} as IpcMainInvokeEvent;

      await expect(handler(event, folderPath)).rejects.toThrow(error);
      expect(log.error).toHaveBeenCalledWith('Failed to open folder:', error);
    });
  });

  describe('DIALOG_OPEN_FILE handler', () => {
    it('should show open dialog and return selected files', async () => {
      const selectedFiles = ['/file1.txt', '/file2.txt'];
      (dialog.showOpenDialog as jest.Mock).mockResolvedValue({
        canceled: false,
        filePaths: selectedFiles,
      });

      const handler = handlers.get(IPC_CHANNELS.DIALOG_OPEN_FILE)!;
      const event = { sender: {} } as IpcMainInvokeEvent;
      const result = await handler(event);

      expect(dialog.showOpenDialog).toHaveBeenCalledWith(
        mockWindow,
        expect.objectContaining({
          properties: ['openFile'],
          filters: expect.arrayContaining([
            expect.objectContaining({ name: 'All Supported' }),
            expect.objectContaining({ name: 'Documents' }),
            expect.objectContaining({ name: 'Images' }),
            expect.objectContaining({ name: 'All Files' }),
          ]),
        })
      );
      expect(log.info).toHaveBeenCalledWith(`Selected files: ${selectedFiles.join(', ')}`);
      expect(result).toEqual(selectedFiles);
    });

    it('should merge custom options', async () => {
      const customOptions = {
        properties: ['openFile', 'multiSelections'] as any,
        filters: [{ name: 'Custom', extensions: ['custom'] }],
      };
      (dialog.showOpenDialog as jest.Mock).mockResolvedValue({
        canceled: false,
        filePaths: ['/file.txt'],
      });

      const handler = handlers.get(IPC_CHANNELS.DIALOG_OPEN_FILE)!;
      const event = { sender: {} } as IpcMainInvokeEvent;
      await handler(event, customOptions);

      expect(dialog.showOpenDialog).toHaveBeenCalledWith(
        mockWindow,
        expect.objectContaining({
          properties: customOptions.properties,
          filters: customOptions.filters,
        })
      );
    });

    it('should return null if dialog is canceled', async () => {
      (dialog.showOpenDialog as jest.Mock).mockResolvedValue({
        canceled: true,
        filePaths: [],
      });

      const handler = handlers.get(IPC_CHANNELS.DIALOG_OPEN_FILE)!;
      const event = { sender: {} } as IpcMainInvokeEvent;
      const result = await handler(event);

      expect(result).toBeNull();
    });

    it('should throw error if no window found', async () => {
      (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(null);

      const handler = handlers.get(IPC_CHANNELS.DIALOG_OPEN_FILE)!;
      const event = { sender: {} } as IpcMainInvokeEvent;

      await expect(handler(event)).rejects.toThrow('No window found');
      expect(log.error).toHaveBeenCalledWith('Failed to show open dialog:', expect.any(Error));
    });
  });

  describe('DIALOG_SAVE_FILE handler', () => {
    it('should show save dialog and return selected path', async () => {
      const selectedPath = '/path/to/save.txt';
      (dialog.showSaveDialog as jest.Mock).mockResolvedValue({
        canceled: false,
        filePath: selectedPath,
      });

      const handler = handlers.get(IPC_CHANNELS.DIALOG_SAVE_FILE)!;
      const event = { sender: {} } as IpcMainInvokeEvent;
      const result = await handler(event);

      expect(dialog.showSaveDialog).toHaveBeenCalledWith(
        mockWindow,
        expect.objectContaining({
          filters: expect.arrayContaining([
            { name: 'Text Files', extensions: ['txt', 'md'] },
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] },
          ]),
        })
      );
      expect(log.info).toHaveBeenCalledWith(`Save path selected: ${selectedPath}`);
      expect(result).toBe(selectedPath);
    });

    it('should return null if dialog is canceled', async () => {
      (dialog.showSaveDialog as jest.Mock).mockResolvedValue({
        canceled: true,
      });

      const handler = handlers.get(IPC_CHANNELS.DIALOG_SAVE_FILE)!;
      const event = { sender: {} } as IpcMainInvokeEvent;
      const result = await handler(event);

      expect(result).toBeNull();
    });
  });

  describe('DIALOG_MESSAGE handler', () => {
    it('should show message box and return response', async () => {
      const options = {
        type: 'info' as const,
        title: 'Test',
        message: 'Test message',
        buttons: ['OK', 'Cancel'],
      };
      const response = { response: 0, checkboxChecked: false };
      (dialog.showMessageBox as jest.Mock).mockResolvedValue(response);

      const handler = handlers.get(IPC_CHANNELS.DIALOG_MESSAGE)!;
      const event = { sender: {} } as IpcMainInvokeEvent;
      const result = await handler(event, options);

      expect(dialog.showMessageBox).toHaveBeenCalledWith(mockWindow, options);
      expect(log.info).toHaveBeenCalledWith(`Message box response: ${response.response}`);
      expect(result).toEqual(response);
    });

    it('should throw error if no window found', async () => {
      (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(null);

      const handler = handlers.get(IPC_CHANNELS.DIALOG_MESSAGE)!;
      const event = { sender: {} } as IpcMainInvokeEvent;
      const options = { message: 'Test' };

      await expect(handler(event, options)).rejects.toThrow('No window found');
      expect(log.error).toHaveBeenCalledWith('Failed to show message box:', expect.any(Error));
    });
  });
});
