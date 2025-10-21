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
    logger.info('[BadgeUtils] Attempting to show badge notification');

    const electronWithBadge = window.electron as any;
    const result = await electronWithBadge.badge.show();

    if (result.success) {
      logger.info('[BadgeUtils] Badge shown successfully');
      return true;
    } else {
      logger.error('[BadgeUtils] Failed to show badge:', result.error);
      return false;
    }
  } catch (error) {
    logger.error('[BadgeUtils] Exception while showing badge:', error);
    return false;
  }
}

/**
 * Hide badge notification with logging
 * @returns Promise<boolean> - true if badge was hidden successfully
 */
export async function hideBadgeWithLogging(): Promise<boolean> {
  try {
    logger.info('[BadgeUtils] Attempting to hide badge notification');

    const electronWithBadge = window.electron as any;
    const result = await electronWithBadge.badge.hide();

    if (result.success) {
      logger.info('[BadgeUtils] Badge hidden successfully');
      return true;
    } else {
      logger.error('[BadgeUtils] Failed to hide badge:', result.error);
      return false;
    }
  } catch (error) {
    logger.error('[BadgeUtils] Exception while hiding badge:', error);
    return false;
  }
}

/**
 * Show badge only if window is not focused
 * @returns Promise<boolean> - true if badge was shown (window not focused), false otherwise
 */
export async function showBadgeIfNotFocused(): Promise<boolean> {
  if (!document.hasFocus()) {
    logger.info('[BadgeUtils] Window not focused, showing badge');
    return await showBadgeWithLogging();
  } else {
    logger.debug('[BadgeUtils] Window is focused, skipping badge notification');
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
    logger.debug('[BadgeUtils] Badge clearing already set up, skipping');
    return;
  }

  badgeClearSetup = true;

  window.addEventListener('focus', async () => {
    logger.debug('[BadgeUtils] Window gained focus, clearing badge');
    await hideBadgeWithLogging();
  });

  window.addEventListener('blur', () => {
    logger.debug('[BadgeUtils] Window lost focus');
  });
}
