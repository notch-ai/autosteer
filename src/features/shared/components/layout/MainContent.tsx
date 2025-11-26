import { cn } from '@/commons/utils/ui/cn';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { ChangesTab } from '@/features/shared/components/git/ChangesTab';
import { AgentChatInterface } from '@/features/shared/components/layout/AgentChatInterface';
import { EmptyState } from '@/features/shared/components/layout/EmptyState';
import { SessionTabs } from '@/features/shared/components/session/SessionTabs';
import { TerminalTab } from '@/features/shared/components/terminal/TerminalTab';
import { MaximizeSessionTab } from '@/features/shared/components/ui/MaximizeSessionTab';
import {
  useAgentChatInstances,
  useAgentContentRenderer,
  useChatInputFocus,
  useContentEditor,
  useGlobalScrollShortcuts,
  useMainContentState,
  useProjectHeader,
} from '@/hooks';
import { useAgentsStore, useProjectsStore, useUIStore } from '@/stores';
import { TOOLS_TAB_ID } from '@/constants/tabs';
import { ExternalLink, Link2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

const USE_MOCK_PERMISSION = false;

export const MainContent: React.FC = () => {
  const selectedAgentId = useAgentsStore((state) => state.selectedAgentId);
  const agents = useAgentsStore((state) => state.agents);
  const selectedProjectId = useProjectsStore((state) => state.selectedProjectId);
  const projects = useProjectsStore((state) => state.projects);
  const updateAgent = useAgentsStore((state) => state.updateAgent);
  const setShowProjectCreation = useUIStore((state) => state.setShowProjectCreation);
  const activeTabId = useUIStore((state) => state.tabState?.activeTabId);

  const { selectedAgent, shouldShowEmpty } = useMainContentState({
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

  const { handleMainContentClick, handleRefReady, focusChatInput } = useChatInputFocus({
    selectedAgentId,
    chatInterfaceRefs,
  });

  const { renderContentByType } = useAgentContentRenderer(selectedAgent);

  const [isContentExpanded] = useState(false);
  const [hasEditors, setHasEditors] = useState(false);

  // Check for available editors on mount
  useEffect(() => {
    if (window.electron?.ide) {
      window.electron.ide.detect().then((result: any) => {
        const editors = result.editors || [];
        setHasEditors(editors.length > 0);
      });
    }
  }, []);

  // Handler for opening in IDE
  const handleOpenInIDE = async () => {
    if (!window.electron?.ide) {
      toast.error('IDE integration not available');
      return;
    }

    if (!currentProject?.localPath) {
      toast.error('No directory path available');
      return;
    }

    try {
      const result = await window.electron.ide.openFile({
        file: currentProject.localPath,
      });

      if (!result.success) {
        toast.error(`Failed to open directory: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to open directory in IDE:', error);
      toast.error('Failed to open directory in IDE');
    }
  };

  useGlobalScrollShortcuts({ activeTabId: selectedAgentId });

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
      <div
        id="center-panel"
        data-panel="center-active"
        className="flex-1 flex flex-col center-panel"
        onClick={handleMainContentClick}
      >
        {selectedProjectId && displayName && (
          <>
            <div className="flex justify-between items-center px-3 pr-2 h-8 folder-path-bar">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{displayName}</span>
              </div>
              {currentProject?.localPath && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="icon-secondary"
                    size="icon"
                    onClick={handleCopyPath}
                    title={`Copy full path: ${currentProject?.localPath || ''}`}
                    className="copy-icon-btn"
                  >
                    <Link2 className="h-4 w-4" />
                  </Button>
                  {hasEditors && (
                    <Button
                      variant="icon-secondary"
                      size="icon"
                      onClick={handleOpenInIDE}
                      title="Open in preferred IDE"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        <SessionTabs onNewSession={focusChatInput} onTabRenamed={focusChatInput} />

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
                    <div className="absolute top-2 right-2 text-xs text-gray-500 bg-gray-800 px-[6px] py-[2px] rounded-md opacity-0 transition-opacity duration-200 group-hover:opacity-100">
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
              {Array.from(projects.values()).map((project) => {
                const isProjectActive = project.id === selectedProjectId;
                const isTerminalTabActive = activeTabId === 'terminal-tab';
                const shouldBeVisible = isProjectActive && isTerminalTabActive;

                return (
                  <div
                    key={`terminal-${project.id}`}
                    data-agent-id={`terminal-tab-${project.id}`}
                    data-project-id={project.id}
                    className={cn(
                      'flex flex-col min-h-0 min-w-0 absolute inset-0 transition-opacity duration-200',
                      {
                        'z-10 opacity-100': shouldBeVisible,
                        'z-0 opacity-0 pointer-events-none': !shouldBeVisible,
                      }
                    )}
                  >
                    <TerminalTab
                      projectId={project.id}
                      className="flex-1"
                      isActive={shouldBeVisible}
                    />
                  </div>
                );
              })}

              <div
                data-agent-id="changes-tab"
                className={cn('flex flex-col min-h-0 min-w-0 absolute inset-0', {
                  'z-10': activeTabId === 'changes-tab',
                  'z-0 pointer-events-none': activeTabId !== 'changes-tab',
                })}
              >
                <ChangesTab className="flex-1" />
              </div>

              {/* Tools Tab (system tab - same pattern as terminal/changes) */}
              <div
                data-agent-id="tools-tab"
                className={cn('flex flex-col min-h-0 min-w-0 absolute inset-0', {
                  'z-10': activeTabId === TOOLS_TAB_ID,
                  'z-0 pointer-events-none': activeTabId !== TOOLS_TAB_ID,
                })}
              >
                <MaximizeSessionTab isActive={activeTabId === TOOLS_TAB_ID} />
              </div>

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
      </div>
    </main>
  );
};
