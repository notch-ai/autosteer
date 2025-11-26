import { WindowManager } from '@/main/windows/WindowManager';
import { BrowserWindow, screen } from 'electron';

// Mock electron modules
jest.mock('electron', () => ({
  BrowserWindow: jest.fn(),
  screen: {
    getPrimaryDisplay: jest.fn(),
  },
  shell: {
    openExternal: jest.fn(),
  },
}));

// Mock electron-log
jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock path
jest.mock('path', () => ({
  join: jest.fn((...args) => {
    // Check if this is the preload path
    if (args.some((arg) => arg.includes('preload'))) {
      return '/mock/preload.js';
    }
    return args.join('/');
  }),
}));

// @ts-expect-error - Mock webpack global
global.MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY = '/mock/preload.js';

describe('WindowManager', () => {
  let windowManager: WindowManager;
  let mockBrowserWindow: any;
  let mockScreen: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock BrowserWindow
    mockBrowserWindow = {
      getBounds: jest.fn().mockReturnValue({ x: 0, y: 0, width: 1600, height: 900 }),
      isMaximized: jest.fn().mockReturnValue(false),
      isFullScreen: jest.fn().mockReturnValue(false),
      isDestroyed: jest.fn().mockReturnValue(false),
      show: jest.fn(),
      close: jest.fn(),
      once: jest.fn((event, callback) => {
        if (event === 'ready-to-show') {
          // Simulate ready-to-show event
          process.nextTick(callback);
        }
      }),
      on: jest.fn(),
      webContents: {
        setWindowOpenHandler: jest.fn(),
        on: jest.fn(),
      },
    };

    (BrowserWindow as jest.MockedClass<typeof BrowserWindow>).mockImplementation(
      () => mockBrowserWindow
    );

    // Mock screen
    mockScreen = {
      getPrimaryDisplay: jest.fn().mockReturnValue({
        workAreaSize: { width: 1920, height: 1080 },
      }),
    };
    (screen.getPrimaryDisplay as jest.Mock).mockImplementation(mockScreen.getPrimaryDisplay);

    windowManager = new WindowManager();
  });

  describe('constructor', () => {
    it('should initialize with empty windows and window states', () => {
      expect(windowManager).toBeInstanceOf(WindowManager);
      expect(windowManager.getAllWindows()).toHaveLength(0);
    });
  });

  describe('createMainWindow', () => {
    it('should create a main window with correct options', () => {
      const window = windowManager.createMainWindow();

      const expectedOptions: any = {
        width: 1600,
        height: 900,
        minWidth: 1200,
        minHeight: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: '/mock/preload.js',
        },
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        show: false,
      };

      // Add icon for non-macOS platforms
      if (process.platform !== 'darwin') {
        expectedOptions.icon = expect.stringContaining('assets/icon.png');
      }

      expect(BrowserWindow).toHaveBeenCalledWith(expectedOptions);
      expect(window).toBe(mockBrowserWindow);
    });

    it('should respect screen size limits', () => {
      // Mock smaller screen
      mockScreen.getPrimaryDisplay.mockReturnValue({
        workAreaSize: { width: 1024, height: 768 },
      });

      windowManager.createMainWindow();

      expect(BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 1024, // Should use screen width since it's smaller than 1600
          height: 768, // Should use screen height since it's smaller than 900
        })
      );
    });

    it('should add icon for non-macOS platforms', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      windowManager.createMainWindow();

      expect(BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: expect.stringContaining('assets/icon.png'),
        })
      );

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should not add icon for macOS platform', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      windowManager.createMainWindow();

      const callArgs = (BrowserWindow as unknown as jest.Mock).mock.calls[0][0];
      expect(callArgs.icon).toBeUndefined();

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should register window event listeners', () => {
      windowManager.createMainWindow();

      expect(mockBrowserWindow.once).toHaveBeenCalledWith('ready-to-show', expect.any(Function));
      expect(mockBrowserWindow.on).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(mockBrowserWindow.on).toHaveBeenCalledWith('move', expect.any(Function));
      expect(mockBrowserWindow.on).toHaveBeenCalledWith('maximize', expect.any(Function));
      expect(mockBrowserWindow.on).toHaveBeenCalledWith('unmaximize', expect.any(Function));
      expect(mockBrowserWindow.on).toHaveBeenCalledWith('enter-full-screen', expect.any(Function));
      expect(mockBrowserWindow.on).toHaveBeenCalledWith('leave-full-screen', expect.any(Function));
      expect(mockBrowserWindow.on).toHaveBeenCalledWith('closed', expect.any(Function));
    });

    it('should show window when ready', (done) => {
      windowManager.createMainWindow();

      // Wait for ready-to-show callback
      process.nextTick(() => {
        expect(mockBrowserWindow.show).toHaveBeenCalled();
        done();
      });
    });

    it('should store window in internal map', () => {
      const window = windowManager.createMainWindow();

      expect(windowManager.getWindow('main')).toBe(window);
      expect(windowManager.getAllWindows()).toContain(window);
    });
  });

  describe('getWindow', () => {
    it('should return window by id', () => {
      const window = windowManager.createMainWindow();

      expect(windowManager.getWindow('main')).toBe(window);
    });

    it('should return undefined for non-existent window', () => {
      expect(windowManager.getWindow('nonexistent')).toBeUndefined();
    });
  });

  describe('getAllWindows', () => {
    it('should return empty array when no windows exist', () => {
      expect(windowManager.getAllWindows()).toEqual([]);
    });

    it('should return all windows', () => {
      const window1 = windowManager.createMainWindow();

      expect(windowManager.getAllWindows()).toEqual([window1]);
      expect(windowManager.getAllWindows()).toHaveLength(1);
    });
  });

  describe('closeWindow', () => {
    it('should close existing window', () => {
      windowManager.createMainWindow();

      windowManager.closeWindow('main');

      expect(mockBrowserWindow.close).toHaveBeenCalled();
    });

    it('should handle non-existent window gracefully', () => {
      expect(() => windowManager.closeWindow('nonexistent')).not.toThrow();
    });

    it('should handle destroyed window gracefully', () => {
      windowManager.createMainWindow();
      mockBrowserWindow.isDestroyed.mockReturnValue(true);

      expect(() => windowManager.closeWindow('main')).not.toThrow();
      expect(mockBrowserWindow.close).not.toHaveBeenCalled();
    });
  });

  describe('window event handling', () => {
    let eventHandlers: { [key: string]: () => void };

    beforeEach(() => {
      eventHandlers = {};
      mockBrowserWindow.on.mockImplementation((event: string, handler: () => void) => {
        eventHandlers[event] = handler;
      });
    });

    it('should handle window resize events', () => {
      windowManager.createMainWindow();

      // Trigger resize event
      eventHandlers['resize']();

      // Should call saveWindowState internally (tested via getBounds call)
      expect(mockBrowserWindow.getBounds).toHaveBeenCalled();
    });

    it('should handle window move events', () => {
      windowManager.createMainWindow();

      // Trigger move event
      eventHandlers['move']();

      expect(mockBrowserWindow.getBounds).toHaveBeenCalled();
    });

    it('should handle window maximize events', () => {
      windowManager.createMainWindow();

      eventHandlers['maximize']();

      expect(mockBrowserWindow.isMaximized).toHaveBeenCalled();
    });

    it('should handle window closed event', () => {
      const window = windowManager.createMainWindow();

      // Initially window should be in the map
      expect(windowManager.getWindow('main')).toBe(window);

      // Trigger closed event
      eventHandlers['closed']();

      // Window should be removed from maps
      expect(windowManager.getWindow('main')).toBeUndefined();
      expect(windowManager.getAllWindows()).toHaveLength(0);
    });
  });

  describe('window state management', () => {
    it('should save window state on creation', () => {
      windowManager.createMainWindow();

      expect(mockBrowserWindow.getBounds).toHaveBeenCalled();
      expect(mockBrowserWindow.isMaximized).toHaveBeenCalled();
      expect(mockBrowserWindow.isFullScreen).toHaveBeenCalled();
    });

    it('should handle destroyed window in saveWindowState', () => {
      let resizeHandler: () => void;
      mockBrowserWindow.on.mockImplementation((event: string, handler: () => void) => {
        if (event === 'resize') {
          resizeHandler = handler;
        }
      });

      windowManager.createMainWindow();

      // Mock window as destroyed
      mockBrowserWindow.isDestroyed.mockReturnValue(true);

      // Should not throw when calling saveWindowState on destroyed window
      expect(() => resizeHandler()).not.toThrow();
    });
  });

  describe('restoreWindowState', () => {
    beforeEach(() => {
      // Add methods needed for restore
      mockBrowserWindow.setBounds = jest.fn();
      mockBrowserWindow.maximize = jest.fn();
      mockBrowserWindow.setFullScreen = jest.fn();
    });

    it('should restore window bounds', () => {
      windowManager.createMainWindow();

      // Save state first by triggering resize
      const resizeHandler = (mockBrowserWindow.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'resize'
      )[1];
      resizeHandler();

      // Now restore
      windowManager.restoreWindowState('main');

      expect(mockBrowserWindow.setBounds).toHaveBeenCalledWith({
        x: 0,
        y: 0,
        width: 1600,
        height: 900,
      });
    });

    it('should restore maximized state', () => {
      windowManager.createMainWindow();
      mockBrowserWindow.isMaximized.mockReturnValue(true);

      // Save state
      const maximizeHandler = (mockBrowserWindow.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'maximize'
      )[1];
      maximizeHandler();

      // Restore
      windowManager.restoreWindowState('main');

      expect(mockBrowserWindow.maximize).toHaveBeenCalled();
    });

    it('should restore full screen state', () => {
      windowManager.createMainWindow();
      mockBrowserWindow.isFullScreen.mockReturnValue(true);

      // Save state
      const fullScreenHandler = (mockBrowserWindow.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'enter-full-screen'
      )[1];
      fullScreenHandler();

      // Restore
      windowManager.restoreWindowState('main');

      expect(mockBrowserWindow.setFullScreen).toHaveBeenCalledWith(true);
    });

    it('should handle non-existent window', () => {
      expect(() => windowManager.restoreWindowState('nonexistent')).not.toThrow();
    });

    it('should handle non-existent state', () => {
      windowManager.createMainWindow();
      // Clear the state
      const closedHandler = (mockBrowserWindow.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'closed'
      )[1];
      closedHandler();

      // Try to restore non-existent state
      expect(() => windowManager.restoreWindowState('main')).not.toThrow();
    });

    it('should handle destroyed window', () => {
      windowManager.createMainWindow();
      mockBrowserWindow.isDestroyed.mockReturnValue(true);

      expect(() => windowManager.restoreWindowState('main')).not.toThrow();
      expect(mockBrowserWindow.setBounds).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle screen API errors gracefully', () => {
      mockScreen.getPrimaryDisplay.mockImplementation(() => {
        throw new Error('Screen API error');
      });

      expect(() => windowManager.createMainWindow()).toThrow('Screen API error');
    });

    it('should handle BrowserWindow constructor errors', () => {
      (BrowserWindow as jest.MockedClass<typeof BrowserWindow>).mockImplementation(() => {
        throw new Error('BrowserWindow creation failed');
      });

      expect(() => windowManager.createMainWindow()).toThrow('BrowserWindow creation failed');
    });
  });
});
