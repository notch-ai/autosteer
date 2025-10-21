/**
 * Test Mode Handler for Visual Testing
 *
 * Provides IPC handlers for component isolation during visual testing.
 * Only activates when VISUAL_TEST_MODE environment variable is set.
 */

import { ipcMain, BrowserWindow } from 'electron';
import log from 'electron-log';
import { IPC_CHANNELS, TestModeState } from '@/types/ipc.types';

export class TestModeHandler {
  private isActive: boolean;
  private state: TestModeState;
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    this.isActive = process.env.VISUAL_TEST_MODE === 'true';
    this.state = {
      isActive: this.isActive,
      currentComponent: null,
      componentProps: {},
      themeVariant: 'day',
    };

    if (this.isActive) {
      log.info('Test mode activated for visual testing');
      this.setupIpcHandlers();
    }
  }

  /**
   * Set the main window reference for sending events
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Check if test mode is active
   */
  get active(): boolean {
    return this.isActive;
  }

  /**
   * Setup IPC handlers for test mode operations
   */
  private setupIpcHandlers(): void {
    // Set component for isolation testing
    ipcMain.handle(
      IPC_CHANNELS.TEST_MODE_SET_COMPONENT,
      async (_event, componentName: string, props?: any) => {
        if (!this.isActive) {
          log.warn('Test mode set component called but test mode is not active');
          return;
        }

        log.info(
          `Test mode: Setting component to ${componentName}`,
          props ? `with props: ${JSON.stringify(props)}` : ''
        );

        this.state.currentComponent = componentName;
        this.state.componentProps = props || {};

        // Notify renderer of component change
        if (this.mainWindow) {
          this.mainWindow.webContents.send('test-mode:component-changed', {
            component: componentName,
            props: this.state.componentProps,
          });
        }
      }
    );

    // Set theme for testing
    ipcMain.handle(
      IPC_CHANNELS.TEST_MODE_SET_THEME,
      async (_event, themeVariant: 'day' | 'night') => {
        if (!this.isActive) {
          log.warn('Test mode set theme called but test mode is not active');
          return;
        }

        log.info(`Test mode: Setting theme to ${themeVariant}`);

        this.state.themeVariant = themeVariant;

        // Notify renderer of theme change
        if (this.mainWindow) {
          this.mainWindow.webContents.send('test-mode:theme-changed', themeVariant);
        }
      }
    );

    // Get current test mode state
    ipcMain.handle(IPC_CHANNELS.TEST_MODE_GET_STATE, async () => {
      if (!this.isActive) {
        log.warn('Test mode get state called but test mode is not active');
        return {
          isActive: false,
          currentComponent: null,
          componentProps: {},
          themeVariant: 'day',
        } as TestModeState;
      }

      return { ...this.state };
    });

    // Reset test mode
    ipcMain.handle('test-mode:reset', async () => {
      if (!this.isActive) {
        log.warn('Test mode reset called but test mode is not active');
        return;
      }

      this.reset();
    });

    log.info('Test mode IPC handlers registered');
  }

  /**
   * Cleanup test mode handlers
   */
  cleanup(): void {
    if (this.isActive) {
      ipcMain.removeHandler(IPC_CHANNELS.TEST_MODE_SET_COMPONENT);
      ipcMain.removeHandler(IPC_CHANNELS.TEST_MODE_SET_THEME);
      ipcMain.removeHandler(IPC_CHANNELS.TEST_MODE_GET_STATE);
      ipcMain.removeHandler('test-mode:reset');
      log.info('Test mode IPC handlers cleaned up');
    }
  }

  /**
   * Reset test mode state
   */
  reset(): void {
    if (!this.isActive) return;

    this.state.currentComponent = null;
    this.state.componentProps = {};
    this.state.themeVariant = 'day';

    // Notify renderer of reset
    if (this.mainWindow) {
      this.mainWindow.webContents.send('test-mode:reset');
    }

    log.info('Test mode state reset');
  }
}

// Export singleton instance
let testModeHandler: TestModeHandler | null = null;

export function getTestModeHandler(): TestModeHandler {
  if (!testModeHandler) {
    testModeHandler = new TestModeHandler();
  }
  return testModeHandler;
}

export function isTestModeActive(): boolean {
  return process.env.VISUAL_TEST_MODE === 'true';
}
