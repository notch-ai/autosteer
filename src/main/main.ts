import { ApplicationContainer } from '@/services/ApplicationContainer';
import { FileDataStoreService } from '@/services/FileDataStoreService';
import { UpdateService } from '@/services/UpdateService';
import { app, BrowserWindow } from 'electron';
import contextMenu from 'electron-context-menu';
import log from 'electron-log';
import path from 'path';
import { LogHandlers } from './ipc/handlers/LogHandlers';
import { UpdateHandlers } from './ipc/handlers/UpdateHandlers';
import { IpcRegistrar } from './ipc/IpcRegistrar';
import { mainLogger } from './services/logger';
import { getTestModeHandler, isTestModeActive } from './test-mode';
import { WindowManager } from './windows/WindowManager';

if (process.platform === 'darwin' || process.platform === 'linux') {
  import('fix-path')
    .then((fixPath) => fixPath.default())
    .catch((e) => {
      console.error('Failed to fix PATH:', e);
    });
}

// Handle Squirrel startup events on Windows
// Keep using require for main process since it runs in Node.js context
if (process.platform === 'win32') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    if (require('electron-squirrel-startup')) {
      app.quit();
    }
  } catch (e) {
    // electron-squirrel-startup not installed, continue normally
  }
}

// Remove webpack constants - using Vite now

// Disable sandbox for development on Linux
if (process.platform === 'linux' && !app.isPackaged) {
  app.commandLine.appendSwitch('no-sandbox');
}

// Fix ICU data file and GPU issues based on recognized solutions
// These errors are common on macOS Big Sur+ due to tightened security constraints
if (!app.isPackaged) {
  // Primary fix: Disable GPU sandbox which prevents ICU and GPU errors
  app.commandLine.appendSwitch('disable-gpu-sandbox');

  // Alternative approach if running from network storage or symlinks
  app.commandLine.appendSwitch('no-sandbox');

  // Suppress logging for cleaner output
  process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
}

// Disable GPU vsync errors
app.commandLine.appendSwitch('disable-gpu-vsync');

// Suppress DevTools storage errors
if (app.isPackaged) {
  app.commandLine.appendSwitch('disable-dev-shm-usage');
}

// Initialize main logger and log handlers early (before app ready)
// This prevents "logger isn't initialized" errors from renderer process
(async () => {
  await mainLogger.initialize();
  LogHandlers.register();
})();

// Configure logging
log.transports.file.level = 'debug';
log.transports.console.level = !app.isPackaged ? 'debug' : false;

class ElectronApp {
  private windowManager: WindowManager;
  private ipcRegistrar: IpcRegistrar;
  private applicationContainer: ApplicationContainer;
  private updateService: UpdateService | null = null;
  private testModeHandler: ReturnType<typeof getTestModeHandler> | null = null;

  constructor() {
    this.applicationContainer = new ApplicationContainer();
    this.windowManager = new WindowManager();
    this.ipcRegistrar = new IpcRegistrar(this.applicationContainer);

    // Initialize test mode handler if test mode is active
    if (isTestModeActive()) {
      this.testModeHandler = getTestModeHandler();
      log.info('Test mode is active - visual testing enabled');
    }
  }

  initialize(): void {
    // Handle creating/removing shortcuts on Windows when installing/uninstalling.
    if (process.platform === 'win32' && process.argv.length >= 2) {
      const squirrelCommand = process.argv[1];
      if (squirrelCommand === '--squirrel-install' || squirrelCommand === '--squirrel-updated') {
        app.quit();
        return;
      }
    }

    this.applicationContainer.initialize();
    this.setupEventHandlers();
  }

  private setupGlobalErrorHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      log.error('[Main] Uncaught exception:', error);

      // Notify user if main window exists
      const mainWindow = this.windowManager.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('main-process-error', {
          type: 'uncaughtException',
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        });
      }

      // Don't exit immediately - try to recover
      // Only exit if error is truly fatal
      if (error.message.includes('Cannot find module') || error.message.includes('ENOENT')) {
        app.quit();
      }
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, _promise) => {
      log.error('[Main] Unhandled promise rejection:', reason);

      const mainWindow = this.windowManager.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('main-process-error', {
          type: 'unhandledRejection',
          error: {
            name: 'UnhandledPromiseRejection',
            message: reason instanceof Error ? reason.message : String(reason),
            stack: reason instanceof Error ? reason.stack : undefined,
          },
        });
      }
    });

    log.info('[Main] Global error handlers initialized');
  }

  private setupEventHandlers(): void {
    log.info('[SETUP] Setting up Electron event handlers');

    // Set up global error handlers first
    this.setupGlobalErrorHandlers();

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    app
      .whenReady()
      .then(async () => {
        // Initialize FileDataStoreService and ensure config.json exists
        // This will load custom project directory from config if set
        try {
          const fileDataStore = await FileDataStoreService.initialize();
          await fileDataStore.ensureDirectories();

          // Create config.json if it doesn't exist
          const configExists = await fileDataStore.configExists();
          if (!configExists) {
            await fileDataStore.writeConfig({ worktrees: [] });
          }
        } catch (error) {
          log.error('[READY] Failed to initialize file data store:', error);
          // Don't fail the entire startup for this
        }

        // Set dock icon for macOS
        if (process.platform === 'darwin' && app.dock) {
          try {
            const iconPath = path.join(__dirname, '../../assets/icon-padded.png');
            app.dock.setIcon(iconPath);
          } catch (error) {
            log.error('[READY] Failed to set dock icon:', error);
          }
        }

        // Initialize IPC handlers BEFORE creating window to prevent race conditions
        // The renderer process may try to invoke IPC handlers as soon as the window loads
        try {
          log.info('[READY] Initializing IPC handlers before window creation');
          this.ipcRegistrar.initialize();
        } catch (ipcError) {
          log.error('[READY] IPC initialization failed, but continuing:', ipcError);
          // Continue with app startup even if IPC fails
        }

        this.createMainWindow();

        // Set main window reference for test mode handler
        if (this.testModeHandler) {
          const mainWindow = this.windowManager.getWindow('main');
          if (mainWindow) {
            this.testModeHandler.setMainWindow(mainWindow);
          }
        }

        // Initialize update service
        await this.initializeUpdateService();
      })
      .catch((error) => {
        log.error('[READY] Failed to initialize when app ready:', error);
        app.quit();
      });

    // Quit when all windows are closed, except on macOS.
    app.on('window-all-closed', () => {
      log.debug('[EVENT] All windows closed event');
      if (process.platform !== 'darwin') {
        log.info('[EVENT] Quitting application (non-macOS)');
        app.quit();
      } else {
        log.debug('[EVENT] Not quitting on macOS (keeping app in dock)');
      }
    });

    app.on('activate', () => {
      log.debug('[EVENT] App activate event');
      // On OS X it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) {
        log.info('[EVENT] No windows open, creating main window');
        this.createMainWindow();
      } else {
        log.debug('[EVENT] Windows already open, not creating new window');
      }
    });

    // Handle app termination
    app.on('before-quit', () => {
      log.info('[EVENT] App before-quit event, cleaning up...');
      try {
        this.applicationContainer.cleanup();
        log.debug('[EVENT] Application container cleaned up');

        if (this.updateService) {
          this.updateService.destroy();
          log.debug('[EVENT] Update service destroyed');
        }

        if (this.testModeHandler) {
          this.testModeHandler.cleanup();
          log.debug('[EVENT] Test mode handler cleaned up');
        }

        log.info('[EVENT] Application cleanup completed');
      } catch (error) {
        log.error('[EVENT] Error during cleanup:', error);
      }
    });
  }

  private async initializeUpdateService(): Promise<void> {
    try {
      log.debug('[UPDATE] Starting update service initialization');
      const mainWindow = this.windowManager.getWindow('main');
      if (mainWindow) {
        log.debug('[UPDATE] Main window found, creating update service');
        this.updateService = new UpdateService();
        await this.updateService.initialize(mainWindow);
        new UpdateHandlers(this.updateService);
        log.info('[UPDATE] Update service initialized successfully');
      } else {
        log.error('[UPDATE] Main window not found, cannot initialize update service');
      }
    } catch (error) {
      log.error('[UPDATE] Failed to initialize update service:', error);
      // Don't fail the entire app for update service issues
    }
  }

  private async setupDevToolsContextMenu(window: BrowserWindow): Promise<void> {
    // Check if inspect element is enabled via environment variable
    const enableInspectElement = process.env.ENABLE_INSPECT_ELEMENT === 'true';

    if (enableInspectElement || !app.isPackaged) {
      // Setup context menu with inspect element and other developer tools
      contextMenu({
        window,
        showInspectElement: true,
        showServices: false,
        showSearchWithGoogle: false,
        showCopyImage: true,
        showCopyImageAddress: true,
        showSaveImageAs: true,
        showCopyLink: true,
        prepend: (_defaultActions: any, _parameters: any, _browserWindow: any) => [
          {
            label: 'Open Console',
            click: () => {
              window.webContents.openDevTools({ mode: 'detach' });
            },
            visible: !app.isPackaged || enableInspectElement,
          },
          {
            label: 'Open Network Tab',
            click: () => {
              window.webContents.openDevTools({ mode: 'detach' });
              // Note: Can't directly open specific tab, but devtools remembers last tab
            },
            visible: !app.isPackaged || enableInspectElement,
          },
          { type: 'separator' },
        ],
      });

      log.info('[DEVTOOLS] Context menu with inspect element enabled');
    }
  }

  private createMainWindow(): void {
    const mainWindow = this.windowManager.createMainWindow();

    // Setup developer context menu if enabled
    this.setupDevToolsContextMenu(mainWindow).catch((err) => {
      log.error('Failed to setup context menu:', err);
    });

    // Set CSP for development
    if (!app.isPackaged) {
      mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';",
            ],
          },
        });
      });
    }

    // Load content
    if (process.env.VITE_DEV_SERVER_URL) {
      mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else if (!app.isPackaged) {
      mainWindow.loadURL('http://localhost:5173');
    } else {
      const htmlPath = path.join(__dirname, '../renderer/main_window/index.html');
      mainWindow.loadFile(htmlPath);
    }

    if (!app.isPackaged) {
      mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.openDevTools();
      });
    }
  }
}

// Create and initialize the app
const electronApp = new ElectronApp();
electronApp.initialize();
