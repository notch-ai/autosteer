/**
 * Shared Electron mock for Jest tests
 * Simple mock implementation - all functions are plain functions, not jest mocks
 * Tests can override functionality as needed
 */

const noop = () => {};
const getVersion = () => '1.0.0';
const getPath = (name) => {
  // Return appropriate paths based on the requested path name
  const paths = {
    home: '/mock/home',
    appData: '/mock/appData',
    userData: '/mock/userData',
    temp: '/mock/temp',
  };
  return paths[name] || '/mock/path';
};

const ipcMain = {
  handle: noop,
  on: noop,
  removeListener: noop,
};

const ipcRenderer = {
  invoke: noop,
  on: noop,
  removeListener: noop,
  send: noop,
};

const app = {
  getVersion,
  getPath,
  on: noop,
  quit: noop,
  isPackaged: true,
};

const shell = {
  openExternal: noop,
  openPath: noop,
};

const dialog = {
  showOpenDialog: noop,
  showSaveDialog: noop,
  showMessageBox: noop,
};

const BrowserWindow = function () {
  return {
    loadURL: noop,
    on: noop,
    webContents: {
      send: noop,
      on: noop,
    },
    show: noop,
    close: noop,
  };
};
BrowserWindow.fromWebContents = noop;

// Avoid conflict with DOM global 'screen' by using const
const mockScreen = {
  getPrimaryDisplay: () => ({
    workAreaSize: { width: 1920, height: 1080 },
  }),
};

const nativeTheme = {
  shouldUseDarkColors: false,
  on: noop,
};

// Mark as ES module for proper destructuring support
module.exports = {
  __esModule: true,
  ipcMain,
  ipcRenderer,
  app,
  shell,
  dialog,
  BrowserWindow,
  screen: mockScreen,
  nativeTheme,
  // For default export compatibility
  default: {
    ipcMain,
    ipcRenderer,
    app,
    shell,
    dialog,
    BrowserWindow,
    screen: mockScreen,
    nativeTheme,
  },
};
