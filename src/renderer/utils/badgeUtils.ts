/**
 * Badge utility functions for showing/hiding badge notifications with logging
 */

import { logger } from '@/commons/utils/logger';

/**
 * Show badge notification with logging
 * @returns Promise<boolean> - true if badge was shown successfully
 */
export async function showBadgeWithLogging(): Promise<boolean> {
  try {
    const electronWithBadge = window.electron as any;
    const result = await electronWithBadge.badge.show();

    if (result.success) {
      return true;
    } else {
      logger.error('Failed to show badge:', result.error);
      return false;
    }
  } catch (error) {
    logger.error('Exception while showing badge:', error);
    return false;
  }
}

/**
 * Hide badge notification with logging
 * @returns Promise<boolean> - true if badge was hidden successfully
 */
export async function hideBadgeWithLogging(): Promise<boolean> {
  try {
    const electronWithBadge = window.electron as any;
    const result = await electronWithBadge.badge.hide();

    if (result.success) {
      return true;
    } else {
      logger.error('Failed to hide badge:', result.error);
      return false;
    }
  } catch (error) {
    logger.error('Exception while hiding badge:', error);
    return false;
  }
}

/**
 * Show badge only if window is not focused
 * @returns Promise<boolean> - true if badge was shown (window not focused), false otherwise
 */
export async function showBadgeIfNotFocused(): Promise<boolean> {
  if (!document.hasFocus()) {
    return await showBadgeWithLogging();
  } else {
    return false;
  }
}

let badgeClearSetup = false;

/**
 * Setup automatic badge clearing on window focus
 */
export function setupAutoBadgeClear(): void {
  // Only setup once to avoid multiple listeners
  if (badgeClearSetup) {
    return;
  }

  badgeClearSetup = true;

  window.addEventListener('focus', async () => {
    await hideBadgeWithLogging();
  });

  window.addEventListener('blur', () => {});
}
