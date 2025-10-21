import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/commons/utils';

export interface RequestTimingProps {
  startTime?: Date | undefined;
  duration?: number | undefined; // Duration in milliseconds from result message
  isStreaming?: boolean | undefined;
  className?: string;
  variant?: 'default' | 'secondary' | 'outline';
}

/**
 * Feature component for RequestTiming
 * Migrated to use shadcn/ui Badge component while maintaining legacy API
 * Displays request timing next to chat messages
 */
export const RequestTiming: React.FC<RequestTimingProps> = ({
  startTime,
  duration,
  isStreaming,
  className,
  variant = 'secondary',
}) => {
  const [currentDuration, setCurrentDuration] = useState(0);

  useEffect(() => {
    if (!startTime) return () => {}; // Return empty cleanup function

    if (isStreaming && !duration) {
      // Update duration every 100ms while streaming
      const interval = setInterval(() => {
        const now = new Date();
        const elapsed = now.getTime() - startTime.getTime();
        setCurrentDuration(elapsed);
      }, 100);

      return () => clearInterval(interval);
    } else if (duration) {
      // Use the final duration from the result message
      setCurrentDuration(duration);
    }

    // Return cleanup function for all code paths
    return () => {};
  }, [startTime, duration, isStreaming]);

  // Format duration in seconds without decimal
  const formatDuration = (ms: number): string => {
    const seconds = ms / 1000;
    if (seconds < 1) {
      return `${Math.round(ms)}ms`;
    }
    return `${Math.round(seconds)}s`;
  };

  if (!startTime && !duration) return null;

  const displayDuration = duration || currentDuration;

  // For backward compatibility, if no className is provided, return a simple span
  // This ensures existing usage without styling continues to work
  if (!className && variant === 'secondary') {
    return <span>{formatDuration(displayDuration)}</span>;
  }

  return (
    <Badge
      variant={variant}
      className={cn('font-mono text-sm', isStreaming && 'animate-pulse', className)}
    >
      {formatDuration(displayDuration)}
    </Badge>
  );
};
