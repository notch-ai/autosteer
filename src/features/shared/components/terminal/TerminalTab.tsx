import { Button } from '@/components/ui/button';
import { useTerminalTabHandler } from '@/hooks/useTerminalTabHandler';
import { useProjectsStore } from '@/stores';
import { Terminal } from '@/types/terminal.types';
import '@xterm/xterm/css/xterm.css';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import React, { useRef } from 'react';

interface TerminalTabProps {
  onTerminalCreated?: (terminal: Terminal) => void;
  className?: string;
}

/**
 *
 * Pure presentation component for terminal tab.
 * All lifecycle logic delegated to useTerminalTabHandler.
 *
 * Responsibilities:
 * - Render terminal container
 * - Display loading/error states
 * - Pass DOM ref to handler
 */
export const TerminalTab: React.FC<TerminalTabProps> = ({ onTerminalCreated, className = '' }) => {
  const terminalRef = useRef<HTMLDivElement>(null);

  const selectedProjectId = useProjectsStore((state) => state.selectedProjectId);
  const projects = useProjectsStore((state) => state.projects);
  const selectedProject = selectedProjectId ? projects.get(selectedProjectId) : undefined;

  const { error, isLoading, handleRetry } = useTerminalTabHandler({
    projectId: selectedProjectId,
    projectPath: selectedProject?.localPath,
    terminalRef,
    onTerminalCreated,
  });

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Starting terminal...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
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
    <div className={`flex flex-col h-full bg-terminal-bg ${className}`}>
      <div
        ref={terminalRef}
        className="flex-1 overflow-hidden text-sm bg-terminal-bg"
        style={{ minHeight: 0 }}
      />
    </div>
  );
};
