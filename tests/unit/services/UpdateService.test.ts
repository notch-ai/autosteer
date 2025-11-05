/**
 * Tests for UpdateService
 * Comprehensive test coverage for app update operations
 */

// IMPORTANT: All jest.mock() calls must be at the top before imports (Jest hoisting requirement)

// Mock electron module inline to ensure proper access to app.isPackaged
jest.mock('electron', () => ({
  app: {
    getVersion: () => '1.0.0',
    getPath: () => '/mock/path',
    on: jest.fn(),
    quit: jest.fn(),
    isPackaged: true,
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
  },
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
    send: jest.fn(),
  },
  BrowserWindow: jest.fn(),
  shell: {
    openExternal: jest.fn(),
    openPath: jest.fn(),
  },
  dialog: {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn(),
    showMessageBox: jest.fn(),
  },
  screen: {
    getPrimaryDisplay: () => ({
      workAreaSize: { width: 1920, height: 1080 },
    }),
  },
  nativeTheme: {
    shouldUseDarkColors: false,
    on: jest.fn(),
  },
}));

jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
  }));
});

jest.mock('electron-updater', () => {
  const { EventEmitter } = require('events');
  const mockAutoUpdater = new EventEmitter();
  Object.assign(mockAutoUpdater, {
    autoDownload: false,
    autoInstallOnAppQuit: true,
    checkForUpdates: jest.fn(),
    downloadUpdate: jest.fn(),
    quitAndInstall: jest.fn(),
    setFeedURL: jest.fn(),
  });
  return {
    autoUpdater: mockAutoUpdater,
  };
});

jest.mock('semver', () => ({
  gt: jest.fn((v1: string, v2: string) => {
    const parseVersion = (v: string) => {
      const parts = v.split('.').map(Number);
      return parts[0] * 10000 + parts[1] * 100 + parts[2];
    };
    return parseVersion(v1) > parseVersion(v2);
  }),
}));

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { UpdateService, UpdateInfo } from '@/services/UpdateService';

describe('UpdateService', () => {
  let updateService: UpdateService;
  let mockWindow: any;
  let mockStore: any;
  let mockAutoUpdater: any;
  let mockApp: any;

  beforeEach(() => {
    console.log('[UpdateService Test] Setting up test');

    // DO NOT call jest.clearAllMocks() as it breaks the electron mock
    // Instead, clear individual mocks we need to reset

    // Get reference to the mocked electron app
    const { app } = require('electron');
    mockApp = app;

    // Ensure isPackaged is reset to true for most tests
    if (mockApp) {
      mockApp.isPackaged = true;
    }

    // Get the mocked autoUpdater instance
    const { autoUpdater } = require('electron-updater');
    mockAutoUpdater = autoUpdater;
    mockAutoUpdater.removeAllListeners();

    // Clear and reset mock implementations
    if (mockAutoUpdater.checkForUpdates.mockClear) {
      mockAutoUpdater.checkForUpdates.mockClear();
    }
    if (mockAutoUpdater.downloadUpdate.mockClear) {
      mockAutoUpdater.downloadUpdate.mockClear();
    }
    if (mockAutoUpdater.quitAndInstall.mockClear) {
      mockAutoUpdater.quitAndInstall.mockClear();
    }
    if (mockAutoUpdater.setFeedURL.mockClear) {
      mockAutoUpdater.setFeedURL.mockClear();
    }
    mockAutoUpdater.checkForUpdates.mockResolvedValue({} as any);
    mockAutoUpdater.downloadUpdate.mockResolvedValue([] as any);

    // Clear electron-log mocks
    const log = require('electron-log');
    if (log.info?.mockClear) log.info.mockClear();
    if (log.error?.mockClear) log.error.mockClear();
    if (log.warn?.mockClear) log.warn.mockClear();
    if (log.debug?.mockClear) log.debug.mockClear();

    // Mock BrowserWindow
    mockWindow = {
      webContents: {
        send: jest.fn(),
      },
      isDestroyed: jest.fn(() => false),
    };

    // Mock electron-store
    const Store = require('electron-store');
    mockStore = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const defaults: Record<string, any> = {
          lastCheckTime: 0,
          lastCheckVersion: '1.0.0',
          dismissedVersions: [],
          updateCheckInterval: 6 * 60 * 60 * 1000,
          notificationShownFor: [],
        };
        return defaults[key] ?? defaultValue;
      }),
      set: jest.fn(),
    };
    Store.mockImplementation(() => mockStore);

    // Create service instance
    updateService = new UpdateService();
  });

  afterEach(() => {
    console.log('[UpdateService Test] Cleaning up test');
    if (updateService) {
      updateService.destroy();
    }
    jest.clearAllTimers();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      console.log('[UpdateService Test] Testing constructor initialization');
      // Service is already created in beforeEach, just verify it initialized correctly

      expect(mockAutoUpdater.autoDownload).toBe(false);
      expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(true);
    });

    it('should configure GitHub feed URL when env var is set', () => {
      console.log('[UpdateService Test] Testing GitHub feed URL configuration');
      const originalEnv = process.env.GITHUB_RELEASES_URL;
      process.env.GITHUB_RELEASES_URL = 'https://github.com/notch-ai/autosteer/releases';

      const service = new UpdateService();

      expect(mockAutoUpdater.setFeedURL).toHaveBeenCalledWith({
        provider: 'github',
        owner: 'notch-ai',
        repo: 'autosteer',
      });

      // Restore env
      if (originalEnv) {
        process.env.GITHUB_RELEASES_URL = originalEnv;
      } else {
        delete process.env.GITHUB_RELEASES_URL;
      }

      service.destroy();
    });
  });

  describe('initialize', () => {
    it('should register all auto updater event handlers', async () => {
      console.log('[UpdateService Test] Testing event handler registration');
      await updateService.initialize(mockWindow);

      expect(mockAutoUpdater.listenerCount('checking-for-update')).toBe(1);
      expect(mockAutoUpdater.listenerCount('update-available')).toBe(1);
      expect(mockAutoUpdater.listenerCount('update-not-available')).toBe(1);
      expect(mockAutoUpdater.listenerCount('error')).toBe(1);
      expect(mockAutoUpdater.listenerCount('download-progress')).toBe(1);
      expect(mockAutoUpdater.listenerCount('update-downloaded')).toBe(1);
    });

    it('should start periodic update checks', async () => {
      console.log('[UpdateService Test] Testing periodic check initialization');
      jest.useFakeTimers();

      await updateService.initialize(mockWindow);

      // First check should happen immediately
      expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);

      // Fast-forward 6 hours
      jest.advanceTimersByTime(6 * 60 * 60 * 1000);

      // Second check should have happened
      expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should check for updates immediately on initialization', async () => {
      console.log('[UpdateService Test] Testing immediate update check');
      await updateService.initialize(mockWindow);

      expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalled();
    });
  });

  describe('checkForUpdates', () => {
    it('should skip update checks in development mode', async () => {
      console.log('[UpdateService Test] Testing skip in development mode');

      // Save original value
      const originalIsPackaged = mockApp.isPackaged;

      // Set development mode BEFORE creating service instance
      mockApp.isPackaged = false;

      // Create a fresh UpdateService instance that will read the updated isPackaged value
      const devService = new UpdateService();
      await devService.initialize(mockWindow);

      // Clear the call made during initialize
      mockAutoUpdater.checkForUpdates.mockClear();

      // Now call checkForUpdates manually - it should skip in dev mode
      await devService.checkForUpdates();

      // Verify no update check was made
      expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();

      // Cleanup
      devService.destroy();

      // Restore original value
      mockApp.isPackaged = originalIsPackaged;
    });

    it('should respect minimum check interval (5 minutes)', async () => {
      console.log('[UpdateService Test] Testing minimum check interval');
      await updateService.initialize(mockWindow);

      // Set last check to 2 minutes ago
      mockStore.get.mockImplementation((key: string) => {
        if (key === 'lastCheckTime') {
          return Date.now() - 2 * 60 * 1000;
        }
        return 0;
      });

      mockAutoUpdater.checkForUpdates.mockClear();

      await updateService.checkForUpdates();

      // Should not check because 2 minutes < 5 minutes
      expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();
    });

    it('should check for updates after minimum interval', async () => {
      console.log('[UpdateService Test] Testing check after minimum interval');
      await updateService.initialize(mockWindow);

      // Set last check to 10 minutes ago
      mockStore.get.mockImplementation((key: string) => {
        if (key === 'lastCheckTime') {
          return Date.now() - 10 * 60 * 1000;
        }
        return 0;
      });

      mockAutoUpdater.checkForUpdates.mockClear();

      await updateService.checkForUpdates();

      // Should check because 10 minutes > 5 minutes
      expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalled();
    });

    it('should handle update check errors', async () => {
      console.log('[UpdateService Test] Testing update check error handling');
      const log = require('electron-log');
      const error = new Error('Network error');
      mockAutoUpdater.checkForUpdates.mockRejectedValue(error);

      await updateService.initialize(mockWindow);

      // Should not throw
      await expect(updateService.checkForUpdates()).resolves.toBeUndefined();

      expect(log.error).toHaveBeenCalledWith('Update check failed:', error);
    });
  });

  describe('update availability handling', () => {
    it('should notify renderer when update is available', async () => {
      console.log('[UpdateService Test] Testing update available notification');
      await updateService.initialize(mockWindow);

      const updateInfo: UpdateInfo = {
        version: '2.0.0',
        releaseNotes: 'New features',
        releaseDate: '2025-11-03',
      };

      mockAutoUpdater.emit('update-available', updateInfo);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('update:available', {
        currentVersion: '1.0.0',
        newVersion: '2.0.0',
        releaseNotes: 'New features',
        releaseDate: '2025-11-03',
      });
    });

    it('should not notify if version is dismissed', async () => {
      console.log('[UpdateService Test] Testing dismissed version handling');
      mockStore.get.mockImplementation((key: string) => {
        if (key === 'dismissedVersions') {
          return ['2.0.0'];
        }
        return [];
      });

      await updateService.initialize(mockWindow);

      const updateInfo: UpdateInfo = {
        version: '2.0.0',
      };

      mockAutoUpdater.emit('update-available', updateInfo);

      expect(mockWindow.webContents.send).not.toHaveBeenCalledWith(
        'update:available',
        expect.anything()
      );
    });

    it('should not notify if already notified for this version', async () => {
      console.log('[UpdateService Test] Testing duplicate notification prevention');
      mockStore.get.mockImplementation((key: string) => {
        if (key === 'notificationShownFor') {
          return ['2.0.0'];
        }
        return [];
      });

      await updateService.initialize(mockWindow);

      const updateInfo: UpdateInfo = {
        version: '2.0.0',
      };

      mockAutoUpdater.emit('update-available', updateInfo);

      expect(mockWindow.webContents.send).not.toHaveBeenCalledWith(
        'update:available',
        expect.anything()
      );
    });

    it('should not notify if new version is not greater than current', async () => {
      console.log('[UpdateService Test] Testing version comparison');
      await updateService.initialize(mockWindow);

      // Same version
      mockAutoUpdater.emit('update-available', { version: '1.0.0' });
      expect(mockWindow.webContents.send).not.toHaveBeenCalled();

      mockWindow.webContents.send.mockClear();

      // Lower version
      mockAutoUpdater.emit('update-available', { version: '0.9.0' });
      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('should track notified versions', async () => {
      console.log('[UpdateService Test] Testing version tracking');
      await updateService.initialize(mockWindow);

      const updateInfo: UpdateInfo = {
        version: '2.0.0',
      };

      mockAutoUpdater.emit('update-available', updateInfo);

      expect(mockStore.set).toHaveBeenCalledWith('notificationShownFor', ['2.0.0']);
    });

    it('should update last check time on update available', async () => {
      console.log('[UpdateService Test] Testing last check time update');
      await updateService.initialize(mockWindow);

      const updateInfo: UpdateInfo = {
        version: '2.0.0',
      };

      mockAutoUpdater.emit('update-available', updateInfo);

      expect(mockStore.set).toHaveBeenCalledWith('lastCheckTime', expect.any(Number));
      expect(mockStore.set).toHaveBeenCalledWith('lastCheckVersion', '1.0.0');
    });
  });

  describe('update not available handling', () => {
    it('should update last check time when no update available', async () => {
      console.log('[UpdateService Test] Testing no update available handling');
      await updateService.initialize(mockWindow);

      mockAutoUpdater.emit('update-not-available');

      expect(mockStore.set).toHaveBeenCalledWith('lastCheckTime', expect.any(Number));
      expect(mockStore.set).toHaveBeenCalledWith('lastCheckVersion', '1.0.0');
    });
  });

  describe('checking for update event', () => {
    it('should notify renderer when checking for updates', async () => {
      console.log('[UpdateService Test] Testing checking notification');
      await updateService.initialize(mockWindow);

      mockAutoUpdater.emit('checking-for-update');

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('update:checking', undefined);
    });
  });

  describe('error handling', () => {
    it('should handle update errors and notify renderer', async () => {
      console.log('[UpdateService Test] Testing error notification');
      const log = require('electron-log');
      await updateService.initialize(mockWindow);

      const error = new Error('Update server unreachable');
      mockAutoUpdater.emit('error', error);

      expect(log.error).toHaveBeenCalledWith('Update check failed:', error);
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'update:error',
        'Update server unreachable'
      );
    });

    it('should update last check time on error', async () => {
      console.log('[UpdateService Test] Testing last check time update on error');
      await updateService.initialize(mockWindow);

      mockAutoUpdater.emit('error', new Error('Test error'));

      expect(mockStore.set).toHaveBeenCalledWith('lastCheckTime', expect.any(Number));
    });
  });

  describe('download progress', () => {
    it('should forward download progress to renderer', async () => {
      console.log('[UpdateService Test] Testing download progress forwarding');
      await updateService.initialize(mockWindow);

      const progressObj = {
        bytesPerSecond: 1024000,
        percent: 45.5,
        transferred: 10240000,
        total: 22528000,
      };

      mockAutoUpdater.emit('download-progress', progressObj);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'update:download-progress',
        progressObj
      );
    });
  });

  describe('update downloaded', () => {
    it('should notify renderer when update is downloaded', async () => {
      console.log('[UpdateService Test] Testing update downloaded notification');
      await updateService.initialize(mockWindow);

      mockAutoUpdater.emit('update-downloaded');

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('update:downloaded', undefined);
    });
  });

  describe('downloadUpdate', () => {
    it('should trigger update download', async () => {
      console.log('[UpdateService Test] Testing download trigger');
      await updateService.initialize(mockWindow);

      await updateService.downloadUpdate();

      expect(mockAutoUpdater.downloadUpdate).toHaveBeenCalled();
    });

    it('should handle download errors', async () => {
      console.log('[UpdateService Test] Testing download error handling');
      const log = require('electron-log');
      const error = new Error('Download failed');
      mockAutoUpdater.downloadUpdate.mockRejectedValue(error);

      await updateService.initialize(mockWindow);

      await updateService.downloadUpdate();

      expect(log.error).toHaveBeenCalledWith('Update check failed:', error);
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('update:error', 'Download failed');
    });
  });

  describe('quitAndInstall', () => {
    it('should call autoUpdater quitAndInstall', async () => {
      console.log('[UpdateService Test] Testing quit and install');
      await updateService.initialize(mockWindow);

      updateService.quitAndInstall();

      expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalled();
    });
  });

  describe('dismissVersion', () => {
    it('should add version to dismissed list', async () => {
      console.log('[UpdateService Test] Testing version dismissal');
      await updateService.initialize(mockWindow);

      updateService.dismissVersion('2.0.0');

      expect(mockStore.set).toHaveBeenCalledWith('dismissedVersions', ['2.0.0']);
    });

    it('should not add duplicate dismissed versions', async () => {
      console.log('[UpdateService Test] Testing duplicate dismissal prevention');
      mockStore.get.mockImplementation((key: string) => {
        if (key === 'dismissedVersions') {
          return ['2.0.0'];
        }
        return [];
      });

      await updateService.initialize(mockWindow);

      updateService.dismissVersion('2.0.0');

      // Should not set again
      expect(mockStore.set).not.toHaveBeenCalledWith(
        'dismissedVersions',
        expect.arrayContaining(['2.0.0', '2.0.0'])
      );
    });

    it('should append to existing dismissed versions', async () => {
      console.log('[UpdateService Test] Testing appending to dismissed list');
      mockStore.get.mockImplementation((key: string) => {
        if (key === 'dismissedVersions') {
          return ['1.5.0'];
        }
        return [];
      });

      await updateService.initialize(mockWindow);

      updateService.dismissVersion('2.0.0');

      expect(mockStore.set).toHaveBeenCalledWith('dismissedVersions', ['1.5.0', '2.0.0']);
    });
  });

  describe('window management', () => {
    it('should not send to destroyed window', async () => {
      console.log('[UpdateService Test] Testing destroyed window handling');
      mockWindow.isDestroyed.mockReturnValue(true);

      await updateService.initialize(mockWindow);

      mockAutoUpdater.emit('checking-for-update');

      // Should not throw and should not send
      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('should handle null window', async () => {
      console.log('[UpdateService Test] Testing null window handling');
      const service = new UpdateService();

      // Initialize without window should not crash
      mockAutoUpdater.emit('checking-for-update');

      // Should not throw
      expect(true).toBe(true);

      service.destroy();
    });
  });

  describe('destroy', () => {
    it('should clear check interval', async () => {
      console.log('[UpdateService Test] Testing interval cleanup');
      jest.useFakeTimers();

      await updateService.initialize(mockWindow);

      updateService.destroy();

      mockAutoUpdater.checkForUpdates.mockClear();

      // Fast-forward 6 hours
      jest.advanceTimersByTime(6 * 60 * 60 * 1000);

      // Should not have checked (interval was cleared)
      expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should remove all event listeners', async () => {
      console.log('[UpdateService Test] Testing event listener cleanup');
      await updateService.initialize(mockWindow);

      updateService.destroy();

      expect(mockAutoUpdater.listenerCount('checking-for-update')).toBe(0);
      expect(mockAutoUpdater.listenerCount('update-available')).toBe(0);
      expect(mockAutoUpdater.listenerCount('update-not-available')).toBe(0);
      expect(mockAutoUpdater.listenerCount('error')).toBe(0);
      expect(mockAutoUpdater.listenerCount('download-progress')).toBe(0);
      expect(mockAutoUpdater.listenerCount('update-downloaded')).toBe(0);
    });

    it('should handle multiple destroy calls', async () => {
      console.log('[UpdateService Test] Testing multiple destroy calls');
      await updateService.initialize(mockWindow);

      updateService.destroy();
      updateService.destroy();

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('custom check interval', () => {
    it('should use custom check interval from store', async () => {
      console.log('[UpdateService Test] Testing custom check interval');
      const customInterval = 2 * 60 * 60 * 1000; // 2 hours
      mockStore.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'updateCheckInterval') {
          return customInterval;
        }
        return defaultValue ?? 0;
      });

      jest.useFakeTimers();

      await updateService.initialize(mockWindow);

      mockAutoUpdater.checkForUpdates.mockClear();

      // Fast-forward 2 hours
      jest.advanceTimersByTime(customInterval);

      // Should have checked
      expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('edge cases', () => {
    it('should handle update info without release notes', async () => {
      console.log('[UpdateService Test] Testing update without release notes');
      await updateService.initialize(mockWindow);

      const updateInfo: UpdateInfo = {
        version: '2.0.0',
        releaseNotes: null,
      };

      mockAutoUpdater.emit('update-available', updateInfo);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('update:available', {
        currentVersion: '1.0.0',
        newVersion: '2.0.0',
        releaseNotes: null,
        releaseDate: undefined,
      });
    });

    it('should handle concurrent update checks', async () => {
      console.log('[UpdateService Test] Testing concurrent update checks');
      await updateService.initialize(mockWindow);

      // Trigger multiple checks simultaneously
      const checks = [
        updateService.checkForUpdates(),
        updateService.checkForUpdates(),
        updateService.checkForUpdates(),
      ];

      await Promise.all(checks);

      // Should handle gracefully without errors
      expect(true).toBe(true);
    });

    it('should handle rapid version updates', async () => {
      console.log('[UpdateService Test] Testing rapid version updates');
      await updateService.initialize(mockWindow);

      // Emit multiple version updates
      mockAutoUpdater.emit('update-available', { version: '2.0.0' });
      mockAutoUpdater.emit('update-available', { version: '2.1.0' });
      mockAutoUpdater.emit('update-available', { version: '2.2.0' });

      // Should track all notifications
      expect(mockStore.set).toHaveBeenCalledWith('notificationShownFor', ['2.0.0']);
      expect(mockStore.set).toHaveBeenCalledWith('notificationShownFor', ['2.1.0']);
      expect(mockStore.set).toHaveBeenCalledWith('notificationShownFor', ['2.2.0']);
    });
  });
});
