/**
 * Integration Tests - System/Terminal Flows
 *
 * Tests end-to-end renderer → IPC → service flows for system operations
 */

import { SystemHandlers } from '@/main/ipc/handlers/system.handlers';
import { XtermService } from '@/services/XtermService';
import { BadgeService } from '@/main/services/BadgeService';
import { UpdateService } from '@/services/UpdateService';
import { ipcMain, BrowserWindow } from 'electron';

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
  },
  BrowserWindow: {
    fromWebContents: jest.fn(),
  },
}));

jest.mock('@/services/XtermService');
jest.mock('@/main/services/BadgeService');
jest.mock('@/services/UpdateService');
jest.mock('@/services/FileDataStoreService');
jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('@/main/services/logger', () => ({
  mainLogger: {
    setDevelopmentMode: jest.fn(),
    getLogPath: jest.fn(() => '/mock/logs/main.log'),
    cleanOldLogs: jest.fn(),
  },
}));

describe('Integration: System/Terminal Flows', () => {
  let systemHandlers: SystemHandlers;
  let xtermService: jest.Mocked<XtermService>;
  let badgeService: jest.Mocked<BadgeService>;
  let updateService: jest.Mocked<UpdateService>;

  beforeEach(() => {
    jest.clearAllMocks();

    xtermService = {
      createTerminal: jest.fn().mockResolvedValue({}),
      killTerminal: jest.fn().mockResolvedValue(undefined),
      getAllTerminals: jest.fn().mockReturnValue([]),
      cleanup: jest.fn(),
    } as any;

    badgeService = {
      showBadge: jest.fn(),
      hideBadge: jest.fn(),
      isSupported: jest.fn(),
    } as any;

    updateService = {
      checkForUpdates: jest.fn(),
      downloadUpdate: jest.fn(),
      quitAndInstall: jest.fn(),
      dismissVersion: jest.fn(),
    } as any;

    (XtermService.getInstance as jest.Mock).mockReturnValue(xtermService);
    (BadgeService.getInstance as jest.Mock).mockReturnValue(badgeService);

    systemHandlers = new SystemHandlers(updateService);
    systemHandlers.registerHandlers();
  });

  describe('Terminal Session Flow', () => {
    it('should create terminal session end-to-end', async () => {
      const mockTerminal = {
        id: 'term-1',
        pid: 12345,
        cwd: '/test/dir',
      };

      const mockWindow = { id: 1 };
      (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(mockWindow);
      xtermService.createTerminal.mockResolvedValue(mockTerminal as any);

      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'terminal:create'
      );
      const handler = handleCall![1];

      const result = await handler({ sender: {} } as any, { cwd: '/test/dir' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTerminal);
      expect(xtermService.createTerminal).toHaveBeenCalledWith(mockWindow, { cwd: '/test/dir' });
    });

    it('should handle terminal creation errors', async () => {
      const mockWindow = { id: 1 };
      (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(mockWindow);
      (xtermService.createTerminal as unknown as jest.Mock).mockRejectedValueOnce(
        new Error('Failed to spawn')
      );

      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'terminal:create'
      );
      const handler = handleCall![1];

      const result = await handler({ sender: {} } as any, { cwd: '/test/dir' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Badge Operations Flow', () => {
    it('should show badge indicator end-to-end', async () => {
      badgeService.showBadge.mockResolvedValue(undefined);

      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'badge:show'
      );
      const handler = handleCall![1];

      const result = await handler({} as any);

      expect(result.success).toBe(true);
      expect(badgeService.showBadge).toHaveBeenCalledWith();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors consistently across system handlers', async () => {
      (xtermService.getAllTerminals as unknown as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Service error');
      });

      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'terminal:list'
      );
      const handler = handleCall![1];

      const result = await handler({} as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Service error');
    });
  });
});
