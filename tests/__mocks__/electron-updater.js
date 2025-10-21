module.exports = {
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: true,
    setFeedURL: jest.fn(),
    checkForUpdates: jest.fn().mockResolvedValue(null),
    downloadUpdate: jest.fn().mockResolvedValue(null),
    quitAndInstall: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
  },
};