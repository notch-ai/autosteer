import React, { useEffect, useState } from 'react';
import { ComputedMessage } from '@/stores/chat.selectors';
import { cn } from '@/commons/utils';

interface SessionTimeTrackingProps {
  messages: ComputedMessage[];
  className?: string;
}

/**
 * Feature component for SessionTimeTracking
 * Wraps the session time tracking functionality with improved styling utilities
 * Maintains backward compatibility with legacy API
 */
export const SessionTimeTracking: React.FC<SessionTimeTrackingProps> = ({
  messages,
  className,
}) => {
  const [elapsedTime, setElapsedTime] = useState<string>('');

  useEffect(() => {
    if (messages.length === 0) return () => {}; // Return empty cleanup function

    // Find the first message timestamp
    const firstMessage = messages[0];
    if (!firstMessage) return () => {}; // Return empty cleanup function

    const sessionStartTime = new Date(firstMessage.timestamp);

    // Update elapsed time every second
    const updateElapsedTime = () => {
      const now = new Date();
      const elapsedMs = now.getTime() - sessionStartTime.getTime();

      // Format elapsed time
      const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
      const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((elapsedMs % (1000 * 60)) / 1000);

      let formatted = 'Session: ';
      if (hours > 0) {
        formatted += `${hours}h ${minutes}m`;
      } else if (minutes > 0) {
        formatted += `${minutes}m ${seconds}s`;
      } else {
        formatted += `${seconds}s`;
      }

      setElapsedTime(formatted);
    };

    // Initial update
    updateElapsedTime();

    // Update every second
    const interval = setInterval(updateElapsedTime, 1000);

    return () => clearInterval(interval);
  }, [messages]);

  if (messages.length === 0 || !elapsedTime) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-1 text-sm text-muted-foreground', className)}>
      <span>⏱️</span>
      <span>{elapsedTime}</span>
    </div>
  );
};
