/**
 * Badge IPC Handlers
 *
 * Purpose: Handle IPC communication for badge notifications between main and renderer processes
 * Phase 1: Core Badge Implementation
 *
 * This handler manages:
 * - Badge show/hide operations
 * - Platform support detection
 * - Badge state management
 *
 * Success Criteria:
 * - Badge operations complete in <5ms
 * - Graceful degradation on unsupported platforms
 * - Type-safe IPC communication
 */

import { ipcMain } from 'electron';
import log from 'electron-log';
import { BadgeService } from '../../services/BadgeService';

/**
 * BadgeHandlers class
 * Manages IPC communication for application badge notifications in the dock/taskbar
 *
 * @remarks
 * This handler provides a bridge between the renderer process and the main process
 * for managing badge visibility on the application icon. It delegates badge operations
 * to the BadgeService singleton and ensures all operations complete within performance
 * targets (<5ms). The handler provides graceful degradation on platforms that don't
 * support badge notifications (e.g., Windows, Linux).
 *
 * IPC Channels:
 * - `badge:show` - Display badge on application icon
 * - `badge:hide` - Remove badge from application icon
 * - `badge:isSupported` - Check if badge operations are supported on current platform
 *
 * Performance: All badge operations are monitored and log warnings if they exceed 5ms.
 *
 * @example
 * ```typescript
 * const handler = new BadgeHandlers();
 * handler.registerHandlers();
 * ```
 */
export class BadgeHandlers {
  private badgeService: BadgeService;

  constructor() {
    this.badgeService = BadgeService.getInstance();
  }

  /**
   * Registers all badge-related IPC handlers
   *
   * @remarks
   * Sets up the following IPC handlers:
   * - `badge:show` - Shows badge with performance monitoring
   * - `badge:hide` - Hides badge with performance monitoring
   * - `badge:isSupported` - Returns platform support status
   *
   * All handlers return standardized responses with success/error status.
   * Operations exceeding 5ms trigger performance warnings in logs.
   *
   * @returns void
   */
  registerHandlers(): void {
    // Show badge handler
    ipcMain.handle('badge:show', async () => {
      try {
        const startTime = Date.now();
        await this.badgeService.showBadge();
        const duration = Date.now() - startTime;

        if (duration > 5) {
          log.warn(`Badge show operation took ${duration}ms`);
        }

        return { success: true };
      } catch (error) {
        log.error('Failed to show badge:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to show badge',
        };
      }
    });

    // Hide badge handler
    ipcMain.handle('badge:hide', async () => {
      try {
        const startTime = Date.now();
        await this.badgeService.hideBadge();
        const duration = Date.now() - startTime;

        if (duration > 5) {
          log.warn(`Badge hide operation took ${duration}ms`);
        }

        return { success: true };
      } catch (error) {
        log.error('Failed to hide badge:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to hide badge',
        };
      }
    });

    // Check platform support
    ipcMain.handle('badge:isSupported', async () => {
      try {
        const isSupported = this.badgeService.isSupported();
        return { success: true, data: isSupported };
      } catch (error) {
        log.error('Failed to check badge support:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to check badge support',
        };
      }
    });

    log.info('Badge handlers registered');
  }

  /**
   * Cleans up all registered badge IPC handlers
   *
   * @remarks
   * Removes all badge-related IPC handlers from the main process.
   * Should be called during application shutdown or when the handlers
   * need to be re-registered.
   *
   * Removed handlers:
   * - `badge:show`
   * - `badge:hide`
   * - `badge:isSupported`
   *
   * @returns void
   */
  cleanup(): void {
    // Remove handlers on cleanup
    ipcMain.removeHandler('badge:show');
    ipcMain.removeHandler('badge:hide');
    ipcMain.removeHandler('badge:isSupported');
  }
}
