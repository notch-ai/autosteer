import { cn } from '@/commons/utils';
import { useUIStore } from '@/stores/ui';
import React from 'react';
import { MainContent } from './MainContent';
import { ResizablePanel } from './ResizablePanel';
import { Sidebar } from './Sidebar';

interface ThreeColumnLayoutProps {
  onOpenLLMSettings?: () => void;
  onOpenUsageMonitor?: () => void;
  onOpenKeyboardShortcuts?: () => void;
  onLogout?: () => void;
}

export const ThreeColumnLayout: React.FC<ThreeColumnLayoutProps> = ({
  onOpenLLMSettings,
  onOpenUsageMonitor,
  onOpenKeyboardShortcuts,
  onLogout,
}) => {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <div className="flex flex-1 w-full overflow-hidden relative bg-surface">
      {/* Sidebar */}
      <ResizablePanel
        side="left"
        defaultWidth={260}
        minWidth={200}
        maxWidth={400}
        collapsed={sidebarCollapsed}
        collapsedWidth={64}
        className="bg-surface rounded-r ml-2"
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          {...(onOpenLLMSettings && { onOpenLLMSettings })}
          {...(onOpenUsageMonitor && { onOpenUsageMonitor })}
          {...(onOpenKeyboardShortcuts && { onOpenKeyboardShortcuts })}
          {...(onLogout && { onLogout })}
        />
      </ResizablePanel>

      {/* Main Content Area - Center Panel with resizable left edge */}
      <div className="flex-1 flex flex-col overflow-hidden relative px-2 pb-2 pt-0 bg-surface">
        {/* Resize handle for left edge */}
        <div
          className={cn(
            'absolute left-0 top-0 bottom-0 w-2 cursor-col-resize',
            'hover:bg-primary/30 transition-colors z-50'
          )}
          style={{ pointerEvents: 'auto' }}
          onMouseDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const mainContent = e.currentTarget.parentElement;
            const sidebar = mainContent?.previousElementSibling as HTMLElement;
            if (!sidebar || !mainContent) return;

            const startSidebarWidth = sidebar.offsetWidth;

            const handleMouseMove = (e: MouseEvent) => {
              const deltaX = e.clientX - startX;
              const newWidth = Math.max(200, Math.min(400, startSidebarWidth + deltaX));
              sidebar.style.width = `${newWidth}px`;
              localStorage.setItem('panel-width-left', String(newWidth));
            };

            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
              document.body.style.cursor = '';
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
          }}
        />

        <div className="flex-1 bg-surface overflow-hidden border border-border rounded">
          <MainContent />
        </div>
      </div>
    </div>
  );
};
