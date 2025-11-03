import { toast } from '@/commons/utils/toastUtils';
import { Button } from '@/components/ui/button';
import { useAgentsStore, useProjectsStore, useMCPStore, useChatStore, useUIStore } from '@/stores';
import { MODEL_OPTIONS } from '@/types/model.types';
import React, { useState } from 'react';

// Version is hardcoded for simplicity - update when package.json version changes
const APP_VERSION = '1.0.0';

/**
 * StatusDisplay component shows session information in the Session Info panel
 * Displays: Session ID, Working Directory, Model, and Version
 */
export const StatusDisplay: React.FC = () => {
  const selectedAgentId = useAgentsStore((state) => state.selectedAgentId);
  const selectedAgent = useAgentsStore((state) =>
    selectedAgentId ? state.agents.get(selectedAgentId) : null
  );
  const claudeSessionId = useChatStore((state) =>
    selectedAgentId ? state.sessionIds.get(selectedAgentId) : null
  );
  const selectedProject = useProjectsStore((state) => state.getSelectedProject());
  const selectedModel = useUIStore((state) => state.selectedModel);
  const mcpServers = useMCPStore((state) =>
    selectedAgentId ? state.mcpServers.get(selectedAgentId) : null
  );

  // Track authentication state for each server
  const [authenticatingServers, setAuthenticatingServers] = useState<Set<string>>(new Set());

  // Additional directories state
  const [additionalDirectoriesValue, setAdditionalDirectoriesValue] = useState<string>('');

  // Load additional directories when agent/project changes
  React.useEffect(() => {
    const loadAdditionalDirectories = async () => {
      if (!selectedAgentId || !selectedProject?.folderName) {
        setAdditionalDirectoriesValue('');
        return;
      }

      try {
        const result: { success: boolean; directories: string[]; error?: string } =
          await window.electron.ipcRenderer.invoke(
            'agents:getAdditionalDirectories',
            selectedProject.folderName,
            selectedAgentId
          );
        if (result.success && result.directories) {
          setAdditionalDirectoriesValue(result.directories.join(', '));
        }
      } catch (error) {
        // Failed to load additional directories
      }
    };

    loadAdditionalDirectories();
  }, [selectedAgentId, selectedProject?.folderName]);

  const handleAdditionalDirectoriesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setAdditionalDirectoriesValue(e.target.value);
  };

  const handleAdditionalDirectoriesKeyDown = async (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await saveAdditionalDirectories();
    }
  };

  const saveAdditionalDirectories = async () => {
    if (!selectedAgentId || !selectedProject?.folderName) return;

    try {
      // Split by comma, trim each item, filter empty strings
      const directories = additionalDirectoriesValue
        .split(',')
        .map((dir) => dir.trim())
        .filter((dir) => dir.length > 0);

      // Validate that all paths exist
      const invalidPaths: string[] = [];
      for (const dir of directories) {
        try {
          // Use Node.js fs to check if path exists
          const exists = await window.electron.ipcRenderer.invoke('file:pathExists', dir);
          if (!exists) {
            invalidPaths.push(dir);
          }
        } catch (error) {
          invalidPaths.push(dir);
        }
      }

      if (invalidPaths.length > 0) {
        toast.error('Invalid paths detected', {
          description: `The following paths do not exist: ${invalidPaths.join(', ')}`,
          duration: 5000,
        });
        return;
      }

      // Update the value with trimmed version
      setAdditionalDirectoriesValue(directories.join(', '));

      // Save to session manifest
      await window.electron.ipcRenderer.invoke(
        'agents:updateAdditionalDirectories',
        selectedProject.folderName,
        selectedAgentId,
        directories
      );

      toast.success('Additional directories saved');
    } catch (error) {
      toast.error('Failed to save additional directories');
    }
  };

  // Save and restore text selection
  const containerRef = React.useRef<HTMLDivElement>(null);
  const savedSelectionRef = React.useRef<Range | null>(null);

  React.useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      // Only handle mouseup events inside the status panel
      if (!containerRef.current?.contains(e.target as Node)) return;

      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && selection.toString().length > 0) {
        // Save the selection
        savedSelectionRef.current = selection.getRangeAt(0).cloneRange();

        // Restore the selection multiple times to ensure it sticks
        const restoreSelection = () => {
          const sel = window.getSelection();
          if (sel && savedSelectionRef.current) {
            sel.removeAllRanges();
            sel.addRange(savedSelectionRef.current);
          }
        };

        // Restore on multiple animation frames
        requestAnimationFrame(() => {
          restoreSelection();
          requestAnimationFrame(() => {
            restoreSelection();
            // And one more time after a small delay
            setTimeout(restoreSelection, 50);
          });
        });
      }
    };

    document.addEventListener('mouseup', handleMouseUp, true);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp, true);
    };
  }, []);

  const modelConfig = MODEL_OPTIONS.find((m) => m.value === selectedModel);
  const modelLabel = modelConfig ? modelConfig.label : 'Unknown';

  /**
   * Handle authentication for a server that needs auth or has failed
   */
  const handleAuthenticateServer = async (serverName: string) => {
    if (!selectedProject?.localPath) {
      return;
    }

    try {
      setAuthenticatingServers((prev) => new Set(prev).add(serverName));

      // Show toast notification
      toast.info('Check your browser to complete authentication', {
        description: `Opening OAuth page for ${serverName}...`,
        duration: 4000,
      });

      const result = await window.electron.ipcRenderer.invoke(
        'mcp:authenticate-server',
        serverName,
        selectedProject.localPath
      );

      if (!result.success && result.error) {
        toast.error('Authentication failed', {
          description: result.error,
        });
      } else if (result.success) {
        // Authentication successful - ask user to refresh
        toast.success('Authentication complete!', {
          description: 'Please refresh the page (Cmd+R / Ctrl+R) to see updated server status',
          duration: 10000,
        });
      }
    } catch (error) {
      // Error authenticating server
    } finally {
      setAuthenticatingServers((prev) => {
        const next = new Set(prev);
        next.delete(serverName);
        return next;
      });
    }
  };

  if (!selectedAgent) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        No active session
      </div>
    );
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  };

  return (
    <div ref={containerRef} className="space-y-6 text-sm status-display-selectable">
      {/* Session Information */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-text tracking-wide">Session Info</h3>
        <div className="space-y-1">
          {claudeSessionId ? (
            <div className="flex flex-col gap-0.5">
              <p className="text-sm text-text m-0" style={{ userSelect: 'text' }}>
                Session ID
              </p>
              <p
                className="font-mono text-sm text-text break-all m-0"
                style={{ userSelect: 'text', WebkitUserSelect: 'text' } as React.CSSProperties}
              >
                {claudeSessionId}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              <p className="text-sm text-text m-0">Session ID</p>
              <p className="text-sm text-text m-0">Not available</p>
            </div>
          )}
          <div className="flex flex-col gap-0.5 mt-2">
            <p className="text-sm text-text m-0">Created</p>
            <p className="text-sm text-text m-0">{formatDate(selectedAgent.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* Working Directory */}
      {selectedProject && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-text tracking-wide">Working Directory</h3>
          <div className="space-y-1">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm text-text m-0">Path</p>
              <p className="font-mono text-sm text-text break-all m-0">
                {selectedProject.localPath}
              </p>
            </div>
            {selectedProject.folderName && (
              <div className="flex flex-col gap-0.5 mt-2">
                <p className="text-sm text-text m-0">Folder</p>
                <p className="font-mono text-sm text-text m-0">{selectedProject.folderName}</p>
              </div>
            )}

            {/* Additional Directories Input */}
            <div className="flex flex-col gap-0.5 mt-3">
              <p className="text-sm text-text m-0">Additional Directories</p>
              <textarea
                className="font-mono text-sm text-text bg-background-secondary border border-border rounded px-2 py-1.5 resize-none focus:outline-none focus:border-border-focus"
                rows={2}
                placeholder="/path/to/dir1, /path/to/dir2"
                value={additionalDirectoriesValue}
                onChange={handleAdditionalDirectoriesChange}
                onKeyDown={handleAdditionalDirectoriesKeyDown}
                style={{ minHeight: '3.5rem' }}
              />
              <p className="text-xs text-text-muted mt-0.5 m-0">
                Comma-separated paths. Press Enter to save.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Model Information */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-text tracking-wide">Model</h3>
        <div className="space-y-1">
          <p className="text-sm text-text m-0">{modelLabel}</p>
        </div>
      </div>

      {/* Version Information */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-text tracking-wide">Version</h3>
        <div className="space-y-1">
          <p className="text-sm text-text m-0">{APP_VERSION}</p>
        </div>
      </div>

      {/* MCP Servers */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-text tracking-wide">MCP Servers</h3>
        <div className="space-y-1.5">
          {mcpServers && mcpServers.length > 0 ? (
            mcpServers.map((server) => {
              const statusIcon =
                server.status === 'connected'
                  ? '✓'
                  : server.status === 'failed'
                    ? '✗'
                    : server.status === 'pending'
                      ? '↻'
                      : server.status === 'needs-auth'
                        ? '!'
                        : '•';

              const statusColor =
                server.status === 'connected'
                  ? 'text-green-500'
                  : server.status === 'failed'
                    ? 'text-red-500'
                    : server.status === 'pending'
                      ? 'text-yellow-500'
                      : server.status === 'needs-auth'
                        ? 'text-blue-500'
                        : 'text-text-muted';

              const needsAuth = server.status === 'needs-auth' || server.status === 'failed';
              const isAuthenticating = authenticatingServers.has(server.name);

              return (
                <div key={server.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={statusColor}>{statusIcon}</span>
                    <span className="text-text">{server.name}</span>
                  </div>
                  {needsAuth && (
                    <Button
                      onClick={() => handleAuthenticateServer(server.name)}
                      disabled={isAuthenticating}
                      variant="outline"
                      size="sm"
                      className="bg-button-special shadow-xs"
                    >
                      {isAuthenticating ? 'Authenticating...' : 'Authenticate'}
                    </Button>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-xs text-text-muted m-0">Send a message to initialize MCP Servers</p>
          )}
        </div>
      </div>
    </div>
  );
};
