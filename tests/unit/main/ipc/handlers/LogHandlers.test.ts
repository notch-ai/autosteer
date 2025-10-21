// Mock electron-log before any imports (not electron-log/main)
jest.mock('electron-log', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock the main logger
jest.mock('@/main/services/logger', () => ({
  mainLogger: {
    getLogPath: jest.fn(() => '/mock/log/path'),
    cleanOldLogs: jest.fn(),
  },
}));

// Mock fs
jest.mock('fs', () => ({
  promises: {
    readdir: jest.fn(() => Promise.resolve(['app.log', 'app-2024.log.gz', 'other.txt'])),
  },
}));

// Mock electron
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
  },
  app: {
    getPath: jest.fn(() => '/mock/path'),
  },
}));

import { LogHandlers } from '@/main/ipc/handlers/LogHandlers';
import { ipcMain } from 'electron';
import log from 'electron-log';

describe('LogHandlers', () => {
  type HandlerFunction = (...args: any[]) => Promise<void>;
  let handlers: Map<string, HandlerFunction>;

  beforeEach(() => {
    jest.clearAllMocks();
    handlers = new Map();

    // Capture registered handlers
    (ipcMain.handle as jest.Mock).mockImplementation(
      (channel: string, handler: HandlerFunction) => {
        handlers.set(channel, handler);
      }
    );
  });

  describe('register', () => {
    it('should register all log handlers', () => {
      LogHandlers.register();

      expect(ipcMain.handle).toHaveBeenCalledTimes(8);
      expect(ipcMain.handle).toHaveBeenCalledWith('log:info', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('log:warn', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('log:error', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('log:debug', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('log', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('logs:getPath', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('logs:cleanOldLogs', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('logs:getLogFiles', expect.any(Function));
    });
  });

  describe('log handlers', () => {
    beforeEach(() => {
      LogHandlers.register();
    });

    it('should handle log:info messages', async () => {
      const handler = handlers.get('log:info')!;
      const mockEvent = {} as any;

      await handler(mockEvent, 'Test info message', 'arg1', 'arg2');

      expect(log.info).toHaveBeenCalledWith('Test info message', 'arg1', 'arg2');
    });

    it('should handle log:warn messages', async () => {
      const handler = handlers.get('log:warn')!;
      const mockEvent = {} as any;

      await handler(mockEvent, 'Test warning message', 'arg1');

      expect(log.warn).toHaveBeenCalledWith('Test warning message', 'arg1');
    });

    it('should handle log:error messages', async () => {
      const handler = handlers.get('log:error')!;
      const mockEvent = {} as any;

      await handler(mockEvent, 'Test error message', { error: 'details' });

      expect(log.error).toHaveBeenCalledWith('Test error message', { error: 'details' });
    });

    it('should handle log:debug messages', async () => {
      const handler = handlers.get('log:debug')!;
      const mockEvent = {} as any;

      await handler(mockEvent, 'Test debug message');

      expect(log.debug).toHaveBeenCalledWith('Test debug message');
    });

    it('should handle generic log with info level', async () => {
      const handler = handlers.get('log')!;
      const mockEvent = {} as any;

      await handler(mockEvent, 'info', 'Generic info message', 'extra');

      expect(log.info).toHaveBeenCalledWith('Generic info message', 'extra');
    });

    it('should handle generic log with warn level', async () => {
      const handler = handlers.get('log')!;
      const mockEvent = {} as any;

      await handler(mockEvent, 'warn', 'Generic warn message');

      expect(log.warn).toHaveBeenCalledWith('Generic warn message');
    });

    it('should handle generic log with error level', async () => {
      const handler = handlers.get('log')!;
      const mockEvent = {} as any;

      await handler(mockEvent, 'error', 'Generic error message');

      expect(log.error).toHaveBeenCalledWith('Generic error message');
    });

    it('should handle generic log with debug level', async () => {
      const handler = handlers.get('log')!;
      const mockEvent = {} as any;

      await handler(mockEvent, 'debug', 'Generic debug message');

      expect(log.debug).toHaveBeenCalledWith('Generic debug message');
    });

    it('should default to info for unknown log level', async () => {
      const handler = handlers.get('log')!;
      const mockEvent = {} as any;

      await handler(mockEvent, 'unknown', 'Unknown level message');

      expect(log.info).toHaveBeenCalledWith('Unknown level message');
    });

    it('should handle multiple arguments', async () => {
      const handler = handlers.get('log:info')!;
      const mockEvent = {} as any;

      await handler(mockEvent, 'Message', 'arg1', 'arg2', 'arg3', { key: 'value' });

      expect(log.info).toHaveBeenCalledWith('Message', 'arg1', 'arg2', 'arg3', { key: 'value' });
    });

    it('should handle no additional arguments', async () => {
      const handler = handlers.get('log:info')!;
      const mockEvent = {} as any;

      await handler(mockEvent, 'Simple message');

      expect(log.info).toHaveBeenCalledWith('Simple message');
    });
  });
});
