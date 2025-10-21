import { WindowState } from '@/entities/WindowState';
import { BrowserWindow, screen } from 'electron';
import log from 'electron-log';
import path from 'path';

export class WindowManager {
  private windows: Map<string, BrowserWindow>;
  private windowStates: Map<string, WindowState>;

  constructor() {
    this.windows = new Map();
    this.windowStates = new Map();
  }

  createMainWindow(): BrowserWindow {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    // Create the browser window with 3-column layout considerations
    const windowOptions: Electron.BrowserWindowConstructorOptions = {
      width: Math.min(1600, width),
      height: Math.min(900, height),
      minWidth: 1200,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      show: false,
    };

    // Add icon for non-macOS platforms
    if (process.platform !== 'darwin') {
      windowOptions.icon = path.join(__dirname, '../../assets/icon.png');
    }

    const mainWindow = new BrowserWindow(windowOptions);

    // Save window state
    const windowId = 'main';
    this.windows.set(windowId, mainWindow);
    this.windowStates.set(windowId, {
      id: windowId,
      bounds: mainWindow.getBounds(),
      isMaximized: mainWindow.isMaximized(),
      isFullScreen: mainWindow.isFullScreen(),
    });

    // Show window when ready, with timeout fallback
    let windowShown = false;

    mainWindow.once('ready-to-show', () => {
      if (!windowShown) {
        windowShown = true;
        mainWindow.show();
        log.info('[WINDOW-MANAGER] Main window shown via ready-to-show event');
      }
    });

    // Fallback: show window after timeout even if content doesn't load
    setTimeout(() => {
      if (!windowShown && !mainWindow.isDestroyed()) {
        windowShown = true;
        mainWindow.show();
        log.warn(
          '[WINDOW-MANAGER] Main window shown via timeout fallback (content may not have loaded)'
        );
      }
    }, 5000); // 5 second timeout

    // Track window state changes
    mainWindow.on('resize', () => this.saveWindowState(windowId));
    mainWindow.on('move', () => this.saveWindowState(windowId));
    mainWindow.on('maximize', () => this.saveWindowState(windowId));
    mainWindow.on('unmaximize', () => this.saveWindowState(windowId));
    mainWindow.on('enter-full-screen', () => this.saveWindowState(windowId));
    mainWindow.on('leave-full-screen', () => this.saveWindowState(windowId));

    // Clean up on close
    mainWindow.on('closed', () => {
      this.windows.delete(windowId);
      this.windowStates.delete(windowId);
    });

    return mainWindow;
  }

  getWindow(id: string): BrowserWindow | undefined {
    return this.windows.get(id);
  }

  getAllWindows(): BrowserWindow[] {
    return Array.from(this.windows.values());
  }

  closeWindow(id: string): void {
    const window = this.windows.get(id);
    if (window && !window.isDestroyed()) {
      window.close();
    }
  }

  private saveWindowState(windowId: string): void {
    const window = this.windows.get(windowId);
    if (!window || window.isDestroyed()) return;

    const state: WindowState = {
      id: windowId,
      bounds: window.getBounds(),
      isMaximized: window.isMaximized(),
      isFullScreen: window.isFullScreen(),
    };

    this.windowStates.set(windowId, state);
  }

  restoreWindowState(windowId: string): void {
    const window = this.windows.get(windowId);
    const state = this.windowStates.get(windowId);

    if (!window || !state || window.isDestroyed()) return;

    if (state.bounds) {
      window.setBounds(state.bounds);
    }

    if (state.isMaximized) {
      window.maximize();
    }

    if (state.isFullScreen) {
      window.setFullScreen(true);
    }
  }
}
