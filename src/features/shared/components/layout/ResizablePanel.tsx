import { cn } from '@/commons/utils';
import { useUIStore } from '@/stores/ui';
import React, { useCallback, useEffect, useRef, useState } from 'react';

interface ResizablePanelProps {
  children: React.ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  side: 'left' | 'right';
  collapsed?: boolean;
  collapsedWidth?: number;
  onResize?: (width: number) => void;
  className?: string;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  children,
  defaultWidth = 260,
  minWidth = 200,
  maxWidth = 500,
  side,
  collapsed = false,
  collapsedWidth = 64,
  onResize,
  className = '',
}) => {
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const setPanelWidth = useUIStore((state) => state.setPanelWidth);

  // Load saved width from localStorage
  useEffect(() => {
    const savedWidth = localStorage.getItem(`panel-width-${side}`);
    if (savedWidth) {
      setWidth(Number(savedWidth));
    }
  }, [side]);

  // Save width to localStorage when it changes
  useEffect(() => {
    if (!collapsed) {
      localStorage.setItem(`panel-width-${side}`, String(width));
    }
  }, [width, side, collapsed]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (collapsed) return;

      e.preventDefault();
      setIsResizing(true);
      startXRef.current = e.clientX;
      startWidthRef.current = width;

      // Safely manipulate DOM
      if (document.body) {
        document.body.style.cursor = 'col-resize';
        document.body.classList.add('resizing');
      }
    },
    [collapsed, width]
  );

  useEffect(() => {
    if (!isResizing) return () => {}; // Return empty cleanup function

    const handleMouseMove = (e: MouseEvent) => {
      const diff = side === 'left' ? e.clientX - startXRef.current : startXRef.current - e.clientX;

      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + diff));

      setWidth(newWidth);
      onResize?.(newWidth);
    };

    const handleMouseUp = () => {
      // Check if there's an active text selection - if so, don't interfere
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        // User is selecting text, don't clear the resize state yet
        return;
      }

      setIsResizing(false);
      // Safely clean up DOM
      if (document.body) {
        document.body.style.cursor = '';
        document.body.classList.remove('resizing');
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // Ensure cleanup on unmount
      if (document.body) {
        document.body.style.cursor = '';
        document.body.classList.remove('resizing');
      }
    };
  }, [isResizing, side, minWidth, maxWidth, onResize]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Ensure body styles are cleaned up when component unmounts
      if (document.body) {
        document.body.style.cursor = '';
        document.body.classList.remove('resizing');
      }
    };
  }, []);

  const actualWidth = collapsed ? collapsedWidth : width;

  // Set CSS variable for the panel width and update store
  useEffect(() => {
    if (side === 'left') {
      document.documentElement.style.setProperty('--sidebar-actual-width', `${actualWidth}px`);
      setPanelWidth('left', actualWidth);
    } else if (side === 'right') {
      setPanelWidth('right', actualWidth);
    }
  }, [actualWidth, side, setPanelWidth]);

  return (
    <div
      ref={panelRef}
      className={cn('relative flex-shrink-0', className)}
      style={{ width: actualWidth }}
    >
      {children}
      {!collapsed && (
        <div
          className={cn(
            'absolute top-0 w-2 h-full cursor-col-resize hover:bg-primary/30 transition-colors z-50',
            side === 'left' ? 'right-0' : 'left-0'
          )}
          onMouseDown={handleMouseDown}
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize ${side} panel`}
          tabIndex={0}
          style={{ pointerEvents: 'auto' }}
        >
          <div className={cn('w-full h-full', isResizing && 'bg-primary/50')} />
        </div>
      )}
    </div>
  );
};
