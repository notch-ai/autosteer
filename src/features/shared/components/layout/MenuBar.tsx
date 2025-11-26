import { cn } from '@/commons/utils';
import { useUIStore } from '@/stores/ui';
import React from 'react';

export interface MenuBarProps {
  className?: string;
  children?: React.ReactNode;
}

export const MenuBar: React.FC<MenuBarProps> = ({ className, children }) => {
  const { leftPanelWidth } = useUIStore();

  return (
    <div
      id="app-menubar"
      data-component="MenuBar"
      className={cn(
        'h-7 flex-shrink-0 bg-card flex items-center border-border menubar-container',
        className
      )}
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left section - aligned with sidebar */}
      <div
        id="menubar-left-section"
        data-section="menubar-left"
        className="menubar-left"
        style={
          {
            width: `${leftPanelWidth}px`,
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties
        }
      >
        {/* Left section content */}
      </div>

      {/* Center section - now empty after moving folder name to chat header */}
      <div id="menubar-center-section" data-section="menubar-center" className="menubar-center">
        {/* Center section content */}
        {children}
      </div>

      {/* Right section - empty for now */}
      <div id="menubar-right-section" data-section="menubar-right" className="menubar-right">
        {/* Right section content */}
      </div>
    </div>
  );
};
