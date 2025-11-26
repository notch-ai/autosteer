import { Button } from '@/components/ui/button';
import { useTerminalTabHandler } from '@/hooks/useTerminalTabHandler';
import { useProjectsStore } from '@/stores';
import { Terminal } from '@/types/terminal.types';
import '@xterm/xterm/css/xterm.css';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import React, { useRef } from 'react';

interface TerminalTabProps {
  projectId: string;
  onTerminalCreated?: (terminal: Terminal) => void;
  className?: string;
  isActive?: boolean;
}

/**
 * Terminal tab component with z-index stacking pattern.
 *
 * Architecture:
 * - Terminal container stays permanently in DOM
 * - Visibility controlled at parent level (MainContent.tsx)
 * - No DOM attach/detach on tab switch
 * - useTerminalTabHandler keeps terminal attached permanently
 *
 * Pattern: Terminal attaches ONCE on creation, stays in pool, never detaches
 *
 * Responsibilities:
 * - Render terminal container (handler manages XTerm attachment)
 * - Display loading/error states
 * - Pass DOM ref to handler
 */
export const TerminalTab: React.FC<TerminalTabProps> = ({
  projectId: propsProjectId,
  onTerminalCreated,
  className = '',
  isActive = false,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);

  const projects = useProjectsStore((state) => state.projects);
  const project = projects.get(propsProjectId);

  // Use folderName as projectId for terminal session mapping
  // This ensures terminals are correctly associated with projects (1:1 relationship)
  const terminalProjectId = project?.folderName || null;

  // Always call hooks unconditionally (React rules)
  const { error, isLoading, handleRetry } = useTerminalTabHandler({
    projectId: terminalProjectId,
    projectPath: project?.localPath,
    terminalRef,
    onTerminalCreated,
    isActive,
  });

  // Guard: Wait for project to load before rendering terminal
  // This prevents race conditions where projectId updates but project is stale
  if (!project) {
    return (
      <div className={`flex items-center justify-center h-full bg-terminal-bg ${className}`}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading project...</span>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full bg-terminal-bg ${className}`}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Starting terminal...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full bg-terminal-bg ${className}`}>
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <div>
            <h3 className="font-semibold text-destructive mb-2">Terminal Error</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Ensure your shell is properly configured</p>
              <p>• Check if you have reached the 10-terminal limit</p>
              <p>• Try restarting the application if issues persist</p>
            </div>
          </div>
          <Button onClick={handleRetry} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-terminal-bg ${className} p-2`}>
      <div
        ref={terminalRef}
        className="flex-1 overflow-hidden text-sm bg-terminal-bg"
        style={{ minHeight: 0 }}
      />
    </div>
  );
};
