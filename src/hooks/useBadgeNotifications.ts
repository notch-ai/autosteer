/**
 * Badge Notifications Hook
 *
 * Purpose: React hook for managing badge notification state and operations
 * Phase 2: Integration & UI
 *
 * This hook provides:
 * - Badge visibility state management
 * - Platform support detection
 * - Settings integration
 * - Task completion triggers
 *
 * Success Criteria:
 * - Clean API for components to trigger badge updates
 * - Automatic badge clearing on window focus
 * - Settings persistence and synchronization
 */

import { useEffect, useCallback, useState } from 'react';
import { useSettingsStore } from '@/stores/settings';
import { logger } from '@/commons/utils/logger';

export interface UseBadgeNotificationsReturn {
  isSupported: boolean;
  isEnabled: boolean;
  isVisible: boolean;
  showBadge: () => Promise<void>;
  hideBadge: () => Promise<void>;
  toggleEnabled: () => Promise<void>;
}

/**
 * Custom hook for managing badge notifications
 * Integrates with settings store and IPC badge handlers
 */
export const useBadgeNotifications = (): UseBadgeNotificationsReturn => {
  const preferences = useSettingsStore((state) => state.preferences);
  const updatePreferences = useSettingsStore((state) => state.updatePreferences);

  const [isSupported, setIsSupported] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Check platform support on mount
  useEffect(() => {
    const checkSupport = async () => {
      try {
        const electronWithBadge = window.electron as any;
        const result = await electronWithBadge.badge.isSupported();
        setIsSupported(result.data ?? false);
      } catch (error) {
        logger.error('Failed to check badge support:', error);
        setIsSupported(false);
      }
    };

    checkSupport();
  }, []);

  // Show badge
  const showBadge = useCallback(async () => {
    if (!isSupported || !preferences.badgeNotifications) {
      return;
    }

    try {
      const electronWithBadge = window.electron as any;
      const result = await electronWithBadge.badge.show();
      if (result.success) {
        setIsVisible(true);
      } else {
        logger.error('Failed to show badge:', result.error);
      }
    } catch (error) {
      logger.error('Error showing badge:', error);
    }
  }, [isSupported, preferences.badgeNotifications]);

  // Hide badge
  const hideBadge = useCallback(async () => {
    if (!isSupported) {
      return;
    }

    try {
      const electronWithBadge = window.electron as any;
      const result = await electronWithBadge.badge.hide();
      if (result.success) {
        setIsVisible(false);
      } else {
        logger.error('Failed to hide badge:', result.error);
      }
    } catch (error) {
      logger.error('Error hiding badge:', error);
    }
  }, [isSupported]);

  // Toggle enabled state
  const toggleEnabled = useCallback(async () => {
    const newValue = !preferences.badgeNotifications;

    // Update preferences
    await updatePreferences({ badgeNotifications: newValue });

    // If disabling, clear any existing badge
    if (!newValue && isVisible) {
      await hideBadge();
    }
  }, [preferences.badgeNotifications, updatePreferences, isVisible, hideBadge]);

  // Auto-hide badge on window focus
  useEffect(() => {
    const handleFocus = () => {
      if (isVisible) {
        hideBadge();
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [isVisible, hideBadge]);

  return {
    isSupported,
    isEnabled: preferences.badgeNotifications,
    isVisible,
    showBadge,
    hideBadge,
    toggleEnabled,
  };
};
