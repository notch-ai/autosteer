import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/commons/utils';

interface VerticalSplitPanelProps {
  topPanel: React.ReactNode;
  bottomPanel: React.ReactNode;
  defaultTopHeight?: number;
  minTopHeight?: number;
  minBottomHeight?: number;
  className?: string;
}

export const VerticalSplitPanel: React.FC<VerticalSplitPanelProps> = ({
  topPanel,
  bottomPanel,
  defaultTopHeight = 60, // 60% default
  minTopHeight = 200,
  minBottomHeight = 200,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [topHeightPercent, setTopHeightPercent] = useState(defaultTopHeight);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const totalHeight = rect.height;

      const newTopHeight = (y / totalHeight) * 100;

      // Calculate actual pixel heights to check against minimums
      const topHeightPx = (newTopHeight / 100) * totalHeight;
      const bottomHeightPx = totalHeight - topHeightPx;

      if (topHeightPx >= minTopHeight && bottomHeightPx >= minBottomHeight) {
        setTopHeightPercent(newTopHeight);
      }
    },
    [isResizing, minTopHeight, minBottomHeight]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
      };
    }
    return undefined;
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} className={cn('h-full flex flex-col', className)}>
      <div style={{ height: `${topHeightPercent}%` }} className="flex-shrink-0 overflow-hidden">
        {topPanel}
      </div>

      <div
        onMouseDown={handleMouseDown}
        className={cn(
          'relative cursor-ns-resize hover:bg-primary/20 transition-colors',
          'flex items-center justify-center group'
        )}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize panels"
        tabIndex={0}
      >
        <Separator className="w-full" />
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center',
            'group-hover:bg-primary/10 transition-colors'
          )}
          style={{
            height: '8px',
            backgroundColor: isResizing ? 'rgb(59 130 246 / 0.3)' : undefined,
          }}
        />
      </div>

      <div style={{ height: `${100 - topHeightPercent}%` }} className="flex-1 overflow-hidden">
        {bottomPanel}
      </div>
    </div>
  );
};
