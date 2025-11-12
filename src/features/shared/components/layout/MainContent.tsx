import { cn } from '@/commons/utils/ui/cn';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { ChangesTab } from '@/features/shared/components/git/ChangesTab';
import { AgentChatInterface } from '@/features/shared/components/layout/AgentChatInterface';
import { EmptyState } from '@/features/shared/components/layout/EmptyState';
import { ResizablePanel } from '@/features/shared/components/layout/ResizablePanel';
import { SessionTabs } from '@/features/shared/components/session/SessionTabs';
import { TerminalTab } from '@/features/shared/components/terminal/TerminalTab';
import { DetailPanel } from '@/features/shared/components/ui/DetailPanel';
import {
  useAgentChatInstances,
  useAgentContentRenderer,
  useChatInputFocus,
  useContentEditor,
  useMainContentState,
  useProjectHeader,
} from '@/hooks';
import { useAgentsStore, useProjectsStore, useUIStore } from '@/stores';
import { Link2 } from 'lucide-react';
import React, { useState } from 'react';

// Toggle this to show mock permission message for UX development
const USE_MOCK_PERMISSION = false;

export const MainContent: React.FC = () => {
  // Store subscriptions
  const selectedAgentId = useAgentsStore((state) => state.selectedAgentId);
  const agents = useAgentsStore((state) => state.agents);
  const selectedProjectId = useProjectsStore((state) => state.selectedProjectId);
  const updateAgent = useAgentsStore((state) => state.updateAgent);
  const detailPanelCollapsed = useUIStore((state) => state.detailPanelCollapsed);
  const toggleDetailPanel = useUIStore((state) => state.toggleDetailPanel);
  const setShowProjectCreation = useUIStore((state) => state.setShowProjectCreation);

  // Custom hooks - all logic extracted
  const { selectedAgent, showTodosPanel, shouldShowEmpty } = useMainContentState({
    selectedAgentId,
    selectedProjectId,
    agents,
  });

  const { currentProject, displayName, handleCopyPath } = useProjectHeader(selectedProjectId);

  const {
    isEditingContent,
    editedContent,
    handleContentClick,
    handleContentChange,
    handleContentSave,
    handleContentCancel,
    handleContentKeyDown,
  } = useContentEditor({
    selectedAgent: selectedAgent ?? null,
    updateAgent,
  });

  const { agentIdsWithInstances, chatInterfaceRefs } = useAgentChatInstances({
    selectedAgentId,
  });

  const { handleMainContentClick, handleRefReady } = useChatInputFocus({
    selectedAgentId,
    chatInterfaceRefs,
  });

  const { renderContentByType } = useAgentContentRenderer(selectedAgent);

  const [isContentExpanded] = useState(false);

  // Early return for empty state
  if (shouldShowEmpty) {
    return <EmptyState onCreateProject={() => setShowProjectCreation(true)} />;
  }

  return (
    <main
      id="main-content"
      data-component="MainContent"
      data-state="active"
      className="h-full flex main-content-container bg-background"
    >
      {/* Center Panel - Chat */}
      <div
        id="center-panel"
        data-panel="center-active"
        className="flex-1 flex flex-col center-panel"
        onClick={handleMainContentClick}
      >
        {/* Path bar header */}
        {selectedProjectId && displayName && (
          <>
            <div className="flex justify-between items-center px-3 h-8 folder-path-bar">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{displayName}</span>
                <Button
                  variant="icon-secondary"
                  size="icon-sm"
                  onClick={handleCopyPath}
                  title={`Copy full path: ${currentProject?.localPath || ''}`}
                  className="copy-icon-btn"
                >
                  <Link2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Session Tabs */}
        <SessionTabs />

        {/* Chat content + Task Manager row */}
        <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
          {/* Chat content area */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
            {isContentExpanded && (
              <>
                <div className="bg-surface p-4 animate-slideDown overflow-hidden">
                  {isEditingContent ? (
                    <div className="flex flex-col gap-2 h-full">
                      <Textarea
                        className="w-full min-h-[50px] max-h-[60px] text-sm resize-y"
                        value={editedContent}
                        onChange={handleContentChange}
                        onKeyDown={handleContentKeyDown}
                        autoFocus
                        placeholder="Enter content..."
                      />
                      <div className="flex gap-2 justify-end">
                        <Button variant="brand" onClick={() => void handleContentSave()}>
                          Save (Ctrl+Enter)
                        </Button>
                        <Button variant="secondary" onClick={handleContentCancel}>
                          Cancel (Esc)
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <ScrollArea
                      className={cn(
                        'cursor-pointer relative transition-opacity duration-200',
                        'hover:opacity-90 max-h-[150px]'
                      )}
                      onClick={handleContentClick}
                    >
                      {renderContentByType()}
                      <div className="absolute top-2 right-2 text-[10px] text-gray-500 bg-gray-800 px-[6px] py-[2px] rounded-md opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        Click to edit
                      </div>
                    </ScrollArea>
                  )}
                </div>
                <Separator />
              </>
            )}

            <div
              id="chat-container"
              data-section="chat-wrapper"
              className="flex-1 flex flex-col min-h-0 min-w-0 chat-wrapper"
            >
              <div
                id="chat-interface-container"
                data-section="chat-interface"
                className="flex-1 flex flex-col min-h-0 min-w-0 relative chat-interface-container"
              >
                {/* Keep TerminalTab mounted to preserve state across tab switches */}
                <div
                  className={cn('flex flex-col min-h-0 min-w-0 absolute inset-0', {
                    'z-10': selectedAgentId === 'terminal-tab',
                    'z-0 pointer-events-none': selectedAgentId !== 'terminal-tab',
                  })}
                >
                  <TerminalTab className="flex-1" />
                </div>

                {/* Keep ChangesTab mounted to preserve state across tab switches */}
                <div
                  className={cn('flex flex-col min-h-0 min-w-0 absolute inset-0', {
                    'z-10': selectedAgentId === 'changes-tab',
                    'z-0 pointer-events-none': selectedAgentId !== 'changes-tab',
                  })}
                >
                  <ChangesTab className="flex-1" />
                </div>

                {/* Per-agent ChatInterface instances - all mounted, visibility controlled by display:none */}
                {agentIdsWithInstances.map((agentId) => (
                  <AgentChatInterface
                    key={agentId}
                    agentId={agentId}
                    selectedAgentId={selectedAgentId}
                    useMockPermission={USE_MOCK_PERMISSION}
                    onRefReady={handleRefReady}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel - Task Manager (only for session tabs) */}
          {showTodosPanel && (
            <ResizablePanel
              defaultWidth={300}
              minWidth={200}
              maxWidth={500}
              side="right"
              className="border-l border-border"
            >
              <DetailPanel collapsed={detailPanelCollapsed} onToggleCollapse={toggleDetailPanel} />
            </ResizablePanel>
          )}
        </div>
      </div>
    </main>
  );
};
