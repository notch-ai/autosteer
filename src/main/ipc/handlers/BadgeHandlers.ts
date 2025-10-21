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

export class BadgeHandlers {
  private badgeService: BadgeService;

  constructor() {
    this.badgeService = BadgeService.getInstance();
  }

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

  cleanup(): void {
    // Remove handlers on cleanup
    ipcMain.removeHandler('badge:show');
    ipcMain.removeHandler('badge:hide');
    ipcMain.removeHandler('badge:isSupported');
  }
}
