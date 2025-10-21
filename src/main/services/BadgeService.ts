/**
 * Badge Service
 *
 * Purpose: Wrapper around Electron's app.setBadge() API for native OS badge notifications
 * Phase 1: Core Badge Implementation
 *
 * This service provides:
 * - Platform-agnostic badge operations
 * - Badge state management
 * - Platform compatibility detection
 * - Graceful degradation for unsupported platforms
 *
 * Success Criteria:
 * - Badge operations complete in <5ms
 * - Works on Mac and Linux platforms
 * - Graceful fallback for unsupported environments
 */

import { app } from 'electron';
import log from 'electron-log';

export class BadgeService {
  private static instance: BadgeService;
  private isEnabled = true;
  private currentBadge: string | number | null = null;

  private constructor() {
    // Initialize with settings if available
    this.initializeSettings();
  }

  public static getInstance(): BadgeService {
    if (!BadgeService.instance) {
      BadgeService.instance = new BadgeService();
    }
    return BadgeService.instance;
  }

  private initializeSettings(): void {
    // This will be connected to settings store in Phase 2
    // For now, default to enabled
    this.isEnabled = true;
  }

  /**
   * Show badge indicator (dot) on the app icon
   * Uses a dot "." instead of a count as per requirements
   */
  public async showBadge(): Promise<void> {
    if (!this.isEnabled) {
      log.debug('Badge notifications are disabled');
      return;
    }

    if (!this.isSupported()) {
      log.debug('Badge notifications not supported on this platform');
      return;
    }

    try {
      // Use a dot instead of a count as per PRD requirements
      const badgeValue = '.';

      if (process.platform === 'darwin') {
        // macOS: Set dock badge
        app.dock?.setBadge(badgeValue);
      } else if (process.platform === 'linux') {
        // Linux: Use app.setBadgeCount for Unity launcher
        // Some Linux DEs support badge count, we'll set to 1 to show indicator
        app.setBadgeCount(1);
      }

      this.currentBadge = badgeValue;
      log.debug('Badge shown');
    } catch (error) {
      log.error('Failed to show badge:', error);
      throw error;
    }
  }

  /**
   * Hide/clear the badge indicator
   */
  public async hideBadge(): Promise<void> {
    if (!this.isSupported()) {
      log.debug('Badge notifications not supported on this platform');
      return;
    }

    try {
      if (process.platform === 'darwin') {
        // macOS: Clear dock badge
        app.dock?.setBadge('');
      } else if (process.platform === 'linux') {
        // Linux: Clear badge count
        app.setBadgeCount(0);
      }

      this.currentBadge = null;
      log.debug('Badge hidden');
    } catch (error) {
      log.error('Failed to hide badge:', error);
      throw error;
    }
  }

  /**
   * Check if badge notifications are supported on this platform
   */
  public isSupported(): boolean {
    // Badge is supported on macOS and Linux (with varying DE support)
    // Windows support is planned for Phase 2
    const platform = process.platform;
    const supported = platform === 'darwin' || platform === 'linux';

    if (platform === 'linux') {
      // Log warning about potential Linux DE compatibility issues
      log.debug('Linux detected - badge support varies by desktop environment');
    }

    return supported;
  }

  /**
   * Set badge enabled state (will be connected to settings in Phase 2)
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;

    // If disabling, clear any existing badge
    if (!enabled && this.currentBadge !== null) {
      this.hideBadge().catch((error) => {
        log.error('Failed to clear badge on disable:', error);
      });
    }
  }

  /**
   * Get current badge state
   */
  public getBadgeState(): string | number | null {
    return this.currentBadge;
  }

  /**
   * Check if badge notifications are enabled
   */
  public isEnabledSetting(): boolean {
    return this.isEnabled;
  }
}
