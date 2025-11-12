/**
 * Badge Settings Panel Component
 *
 * Purpose: UI component for managing badge notification preferences
 * This component provides:
 * - Toggle for enabling/disabling badge notifications
 * - Platform support status display
 * - Settings persistence through Zustand store
 * - Accessible UI following design system
 *
 * Success Criteria:
 * - Settings changes persist across sessions
 * - Clear visual feedback for platform support
 * - Accessible toggle with proper labeling
 */

import React, { useState } from 'react';
import { useBadgeNotifications } from '@/hooks/useBadgeNotifications';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { InfoIcon, Bell, BellOff } from 'lucide-react';

export const BadgeSettingsPanel: React.FC = () => {
  const { isSupported, isEnabled, isVisible, showBadge, hideBadge, toggleEnabled } =
    useBadgeNotifications();
  const [testStatus, setTestStatus] = useState<string>('');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between py-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-primary">Badge Notifications</h3>
            {!isSupported && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <InfoIcon className="h-3 w-3" />
                <span>Not supported on this platform</span>
              </div>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Show a badge indicator on the app icon when tasks complete or errors occur
          </p>
        </div>
        <Switch
          checked={isEnabled}
          onCheckedChange={toggleEnabled}
          disabled={!isSupported}
          aria-label="Toggle badge notifications"
        />
      </div>

      {isSupported && isEnabled && (
        <div className="rounded-md bg-muted/50 p-3">
          <p className="text-sm text-muted-foreground">
            Badge notifications are enabled. A dot indicator will appear on the app icon when there
            are notifications. The badge will clear automatically when you focus the app window.
          </p>
        </div>
      )}

      {!isSupported && (
        <div className="rounded-md bg-orange-500/10 p-3">
          <p className="text-sm text-orange-700 dark:text-orange-400">
            Badge notifications are not supported on your current platform. This feature is
            available on macOS and most Linux desktop environments.
          </p>
        </div>
      )}

      {/* Test Badge Section */}
      {isSupported && (
        <div className="space-y-3 rounded-md border border-border p-4">
          <h4 className="text-sm font-medium">Test Badge Functionality</h4>
          <p className="text-sm text-muted-foreground">
            Use these buttons to test the badge indicator. Minimize or switch away from the app to
            see the badge on the dock/taskbar icon.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                setTestStatus('Showing badge...');
                await showBadge();
                setTestStatus('Badge shown! Check your dock/taskbar icon.');
                setTimeout(() => setTestStatus(''), 3000);
              }}
              disabled={!isEnabled || isVisible}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Bell className="h-3 w-3" />
              Show Badge
            </Button>
            <Button
              onClick={async () => {
                await hideBadge();
                setTestStatus('');
              }}
              disabled={!isEnabled || !isVisible}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <BellOff className="h-3 w-3" />
              Hide Badge
            </Button>
          </div>
          {testStatus && <p className="text-sm text-primary animate-pulse">{testStatus}</p>}
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              • Badge is currently: <strong>{isVisible ? 'Visible' : 'Hidden'}</strong>
            </p>
            <p>• The badge will auto-hide when you focus this window</p>
          </div>
        </div>
      )}
    </div>
  );
};
