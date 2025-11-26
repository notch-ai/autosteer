import { cn } from '@/commons/utils/ui/cn';
import { Button } from '@/components/ui/button';
import { ProjectList } from '@/features/shared/components/projects/ProjectList';
import { useSidebarHandler } from '@/hooks/useSidebarHandler';
import { useProjects } from '@/hooks/useProjects';
import { Keyboard, LogOut, Settings } from 'lucide-react';
import React from 'react';
import { ThemeToggle } from '@/features/settings/components/ThemeToggle';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenLLMSettings?: () => void;
  onOpenKeyboardShortcuts?: () => void;
  onLogout?: () => void;
}

const TaskIndicator: React.FC<{ isActive: boolean; className?: string }> = React.memo(
  ({ isActive, className }) => {
    return (
      <div
        className={cn(
          'task-indicator transition-colors duration-100 w-2 h-2 rounded-full',
          isActive
            ? 'task-indicator--active bg-primary'
            : 'task-indicator--idle bg-muted-foreground',
          className
        )}
        aria-label={isActive ? 'Tasks running' : 'No active tasks'}
      />
    );
  }
);

TaskIndicator.displayName = 'TaskIndicator';

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onOpenLLMSettings,
  onOpenKeyboardShortcuts,
  onLogout,
}) => {
  // Auto-load projects on mount
  useProjects({ autoLoad: true });

  // Use handler for sidebar business logic
  const { activePanel, isCollapsed, error } = useSidebarHandler();

  return (
    <aside
      id="app-sidebar"
      data-component="Sidebar"
      data-active-panel={activePanel}
      data-collapsed={isCollapsed}
      className="h-full flex flex-col sidebar-container bg-card"
    >
      {!collapsed && (
        <>
          <div
            id="sidebar-content"
            data-section="sidebar-main"
            className="flex-1 overflow-hidden sidebar-main-content"
          >
            <div className="h-full overflow-y-auto overflow-x-hidden">
              <ProjectList />
            </div>
          </div>

          {error && (
            <div
              className="px-3 py-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20"
              role="alert"
            >
              {error}
            </div>
          )}

          <div
            id="sidebar-footer"
            data-section="sidebar-footer"
            className="h-12 flex items-center justify-center gap-6 px-3 pb-4 bg-card sidebar-footer-controls"
          >
            <ThemeToggle />
            {/* Keyboard Shortcuts Button */}
            <Button
              id="keyboard-shortcuts-btn"
              data-action="open-keyboard-shortcuts"
              variant="icon-secondary"
              size="icon"
              title="Keyboard Shortcuts (⌘/)"
              onClick={onOpenKeyboardShortcuts}
            >
              <Keyboard className="h-4 w-4" />
            </Button>
            {/* Settings Button */}
            <Button
              id="settings-btn"
              data-action="open-settings"
              variant="icon-secondary"
              size="icon"
              title="LLM Settings"
              onClick={onOpenLLMSettings}
            >
              <Settings className="h-4 w-4" />
            </Button>
            {/* Logout Button - only show if onLogout is provided */}
            {onLogout && (
              <Button
                id="logout-btn"
                data-action="logout"
                variant="icon-secondary"
                size="icon"
                title="Sign Out"
                onClick={onLogout}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </>
      )}
    </aside>
  );
};
