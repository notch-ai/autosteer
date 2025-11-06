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
        className="bg-surface ml-2"
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

      {/* Main Content Area - Center Panel */}
      <div className="flex-1 flex flex-col overflow-hidden relative mr-2 mb-2 px-0 pb-0 pt-0 bg-surface border border-border rounded">
        <div className="flex-1 bg-surface overflow-hidden ">
          <MainContent />
        </div>
      </div>
    </div>
  );
};
