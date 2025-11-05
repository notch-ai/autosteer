/**
 * Mock for electron-updater
 * Provides a mock autoUpdater that is an EventEmitter
 *
 * Note: Cannot use jest.fn() here as moduleNameMapper loads this before jest globals
 * Tests must override with jest.mock('electron-updater') if they need jest.fn() functionality
 */

const { EventEmitter } = require('events');

const noop = () => {};

const mockAutoUpdater = new EventEmitter();

// Add autoUpdater methods
mockAutoUpdater.autoDownload = false;
mockAutoUpdater.autoInstallOnAppQuit = true;
mockAutoUpdater.checkForUpdates = noop;
mockAutoUpdater.downloadUpdate = noop;
mockAutoUpdater.quitAndInstall = noop;
mockAutoUpdater.setFeedURL = noop;

module.exports = {
  autoUpdater: mockAutoUpdater,
};
