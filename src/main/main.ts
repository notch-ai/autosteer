import { getDevSettings, logSettingsAtStartup } from '@/config/settings';
import { ApplicationContainer } from '@/services/ApplicationContainer';
import { FileDataStoreService } from '@/services/FileDataStoreService';
import { UpdateService } from '@/services/UpdateService';
import { app, BrowserWindow } from 'electron';
import contextMenu from 'electron-context-menu';
import log from 'electron-log';
import path from 'path';
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

// Initialize main logger early (before app ready)
// This prevents "logger isn't initialized" errors from renderer process
// Log handlers will be registered by IpcRegistrar.initialize()
(async () => {
  try {
    log.info('[STARTUP] Initializing main logger...');
    await mainLogger.initialize();
    log.info('[STARTUP] Main logger initialized successfully');
  } catch (error) {
    log.error('[STARTUP] Failed to initialize main logger:', error);
    throw error;
  }
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
    log.info('[ELECTRON_APP] Constructing ElectronApp...');
    try {
      log.info('[ELECTRON_APP] Creating ApplicationContainer...');
      this.applicationContainer = new ApplicationContainer();
      log.info('[ELECTRON_APP] ApplicationContainer created');

      log.info('[ELECTRON_APP] Creating WindowManager...');
      this.windowManager = new WindowManager();
      log.info('[ELECTRON_APP] WindowManager created');

      log.info('[ELECTRON_APP] Creating IpcRegistrar...');
      this.ipcRegistrar = new IpcRegistrar(this.applicationContainer);
      log.info('[ELECTRON_APP] IpcRegistrar created');

      // Initialize test mode handler if test mode is active
      if (isTestModeActive()) {
        log.info('[ELECTRON_APP] Test mode active, creating test mode handler...');
        this.testModeHandler = getTestModeHandler();
        log.info('[ELECTRON_APP] Test mode handler created');
      }

      log.info('[ELECTRON_APP] ElectronApp construction complete');
    } catch (error) {
      log.error('[ELECTRON_APP] Failed to construct ElectronApp:', error);
      throw error;
    }
  }

  initialize(): void {
    log.info('[ELECTRON_APP] Initializing ElectronApp...');

    // Handle creating/removing shortcuts on Windows when installing/uninstalling.
    if (process.platform === 'win32' && process.argv.length >= 2) {
      const squirrelCommand = process.argv[1];
      if (squirrelCommand === '--squirrel-install' || squirrelCommand === '--squirrel-updated') {
        log.info('[ELECTRON_APP] Squirrel command detected, quitting app:', squirrelCommand);
        app.quit();
        return;
      }
    }

    try {
      log.info('[ELECTRON_APP] Initializing ApplicationContainer...');
      this.applicationContainer.initialize();
      log.info('[ELECTRON_APP] ApplicationContainer initialized');

      log.info('[ELECTRON_APP] Setting up event handlers...');
      this.setupEventHandlers();
      log.info('[ELECTRON_APP] Event handlers setup complete');
      log.info('[ELECTRON_APP] ElectronApp initialization complete');
    } catch (error) {
      log.error('[ELECTRON_APP] Failed to initialize ElectronApp:', error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    log.info('[EVENT] Setting up app event handlers...');

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    app
      .whenReady()
      .then(async () => {
        log.info('[READY] App is ready, starting initialization...');

        // Log application settings at startup
        log.info('[READY] Logging settings at startup...');
        logSettingsAtStartup();
        log.info('[READY] Settings logged');

        // Fetch tracer is injected into SDK subprocess via NODE_OPTIONS (see ClaudeCodeSDKService)
        // No need to instrument main process - only SDK subprocess API calls are traced

        // Initialize FileDataStoreService and ensure config.json exists
        // This will load custom project directory from config if set
        try {
          log.info('[READY] Initializing FileDataStoreService...');
          const fileDataStore = await FileDataStoreService.initialize();
          log.info('[READY] FileDataStoreService initialized');

          log.info('[READY] Ensuring directories...');
          await fileDataStore.ensureDirectories();
          log.info('[READY] Directories ensured');

          // Create config.json if it doesn't exist
          log.info('[READY] Checking if config exists...');
          const configExists = await fileDataStore.configExists();
          log.info('[READY] Config exists:', configExists);

          if (!configExists) {
            log.info('[READY] Creating default config...');
            await fileDataStore.writeConfig({ worktrees: [] });
            log.info('[READY] Default config created');
          }

          // Clean up old deleted session manifests on startup
          log.info('[READY] Cleaning up deleted session manifests...');
          const { SessionManifestService } = await import('@/services/SessionManifestService');
          const sessionManifest = SessionManifestService.getInstance();
          await sessionManifest.cleanupDeletedManifests();
          log.info('[READY] Session manifests cleanup complete');
        } catch (error) {
          log.error('[READY] Failed to initialize file data store:', error);
          // Don't fail the entire startup for this
        }

        // Set dock icon for macOS (skip if USE_PLAIN_ICON is set for dev-no-reload mode)
        if (process.platform === 'darwin' && app.dock && !process.env.USE_PLAIN_ICON) {
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
          log.info('[READY] Initializing IPC handlers...');
          this.ipcRegistrar.initialize();
          log.info('[READY] IPC handlers initialized successfully');
        } catch (ipcError) {
          log.error('[READY] IPC initialization failed, but continuing:', ipcError);
          // Continue with app startup even if IPC fails
        }

        log.info('[READY] Creating main window...');
        this.createMainWindow();
        log.info('[READY] Main window created');

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
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      // On OS X it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createMainWindow();
      }
    });

    // Handle app termination
    app.on('before-quit', () => {
      try {
        this.applicationContainer.cleanup();

        if (this.updateService) {
          this.updateService.destroy();
        }

        if (this.testModeHandler) {
          this.testModeHandler.cleanup();
        }
      } catch (error) {
        log.error('[EVENT] Error during cleanup:', error);
      }
    });
  }

  private async initializeUpdateService(): Promise<void> {
    try {
      const mainWindow = this.windowManager.getWindow('main');
      if (mainWindow) {
        this.updateService = new UpdateService();
        await this.updateService.initialize(mainWindow);
        this.ipcRegistrar.setUpdateService(this.updateService);
      } else {
        log.error('[UPDATE] Main window not found, cannot initialize update service');
      }
    } catch (error) {
      log.error('[UPDATE] Failed to initialize update service:', error);
      // Don't fail the entire app for update service issues
    }
  }

  /**
   * Setup window lifecycle handlers to cleanup orphaned PTY processes
   * This prevents PTY accumulation on renderer reloads/crashes
   */
  private async setupWindowLifecycleHandlers(window: BrowserWindow): Promise<void> {
    // Import dynamically to avoid circular dependency
    const { XtermService } = await import('@/services/XtermService');
    const xtermService = XtermService.getInstance();

    // Track whether initial load has completed to distinguish reloads from first load
    let initialLoadComplete = false;

    // Mark initial load as complete after first successful load
    window.webContents.on('did-finish-load', () => {
      if (!initialLoadComplete) {
        initialLoadComplete = true;
        log.debug('[WINDOW] Initial load complete, reload detection enabled');
      }
    });

    // Cleanup terminals when renderer process crashes
    window.webContents.on('render-process-gone', async (_event, details) => {
      log.warn(`[WINDOW] Renderer process gone: ${details.reason}`);
      await xtermService.cleanupWindowTerminals(window);
    });

    // Cleanup terminals when window is closed
    window.on('closed', async () => {
      log.info('[WINDOW] Window closed, cleaning up terminals');
      await xtermService.cleanupWindowTerminals(window);
    });

    // Cleanup terminals on renderer reload (dev mode Cmd+R)
    window.webContents.on('did-start-loading', async () => {
      if (initialLoadComplete) {
        log.info('[WINDOW] Renderer reloading (did-start-loading), cleaning up terminals');
        await xtermService.cleanupWindowTerminals(window);
      }
    });

    // Backup handler for navigation-based reloads
    window.webContents.on('will-navigate', async () => {
      if (initialLoadComplete) {
        log.info('[WINDOW] Renderer navigating (will-navigate), cleaning up terminals');
        await xtermService.cleanupWindowTerminals(window);
      }
    });
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
    let loadUrl: string;
    if (process.env.VITE_DEV_SERVER_URL) {
      loadUrl = process.env.VITE_DEV_SERVER_URL;
      log.info(`[WINDOW] Loading from VITE_DEV_SERVER_URL: ${loadUrl}`);
      mainWindow.loadURL(loadUrl);
    } else if (!app.isPackaged) {
      loadUrl = 'http://localhost:5173';
      log.info(
        `[WINDOW] VITE_DEV_SERVER_URL not set, using fallback: ${loadUrl} (port may auto-increment if busy)`
      );
      mainWindow.loadURL(loadUrl);
    } else {
      const htmlPath = path.join(__dirname, '../renderer/main_window/index.html');
      log.info(`[WINDOW] Loading from production build: ${htmlPath}`);
      mainWindow.loadFile(htmlPath);
    }

    // Log the actual URL after load attempt
    mainWindow.webContents.on('did-start-loading', () => {
      const actualUrl = mainWindow.webContents.getURL();
      log.info(`[WINDOW] Actually loading URL: ${actualUrl || 'not yet available'}`);
    });

    mainWindow.webContents.on('did-finish-load', () => {
      const actualUrl = mainWindow.webContents.getURL();
      log.info(`[WINDOW] Successfully loaded: ${actualUrl}`);
    });

    mainWindow.webContents.on(
      'did-fail-load',
      (_event, errorCode, errorDescription, validatedURL) => {
        log.error(
          `[WINDOW] Failed to load URL: ${validatedURL}, Error: ${errorCode} - ${errorDescription}`
        );
      }
    );

    // Setup window lifecycle handlers AFTER initial load completes
    // This prevents interference with the startup sequence
    mainWindow.webContents.once('did-finish-load', async () => {
      log.info('[WINDOW] Initial load complete, setting up lifecycle handlers');
      await this.setupWindowLifecycleHandlers(mainWindow);
    });

    // Open DevTools in development mode if enabled
    if (!app.isPackaged) {
      const devSettings = getDevSettings();

      if (devSettings.openDevTools) {
        mainWindow.webContents.once('did-finish-load', () => {
          mainWindow.webContents.openDevTools();
        });
      }
    }
  }
}

// Create and initialize the app
const electronApp = new ElectronApp();
electronApp.initialize();
