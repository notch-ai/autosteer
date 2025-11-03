import { cn } from '@/commons/utils/cn';
import { Button } from '@/components/ui/button';
import { ProjectList } from '@/features/shared/components/projects/ProjectList';
import { useProjectsStore } from '@/stores';
import { Keyboard, LogOut, Settings } from 'lucide-react';
import React, { useEffect } from 'react';
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
          'task-indicator transition-colors duration-100',
          isActive ? 'task-indicator--active' : 'task-indicator--idle',
          className
        )}
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: isActive ? '#10b981' : '#9ca3af',
        }}
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
  // Core store actions with stable references
  const loadProjects = useProjectsStore((state) => state.loadProjects);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return (
    <aside
      id="app-sidebar"
      data-component="Sidebar"
      className="h-full flex flex-col sidebar-container"
    >
      {!collapsed && (
        <>
          <div
            id="sidebar-content"
            data-section="sidebar-main"
            className="flex-1 overflow-y-auto overflow-x-hidden sidebar-main-content"
          >
            <ProjectList />
          </div>

          <div
            id="sidebar-footer"
            data-section="sidebar-footer"
            className="h-12 flex items-center justify-center gap-6 px-3 pb-4 bg-surface sidebar-footer-controls"
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
