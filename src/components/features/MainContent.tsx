import { cn } from '@/commons/utils';
import { getFolderName } from '@/commons/utils/folderName';
import { KeyboardShortcuts, useKeyboardShortcut } from '@/commons/utils/keyboardShortcuts';
import { logger } from '@/commons/utils/logger';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { AgentType } from '@/entities';
import { mockPermissionChatMessage } from '@/mocks/gitDiffMockData';
import { useCoreStore, useUIStore } from '@/stores';
import { Link2, Music, Video } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { ChangesTab } from './ChangesTab';
import { ChatInterface } from './ChatInterface';
import { DetailPanel } from './DetailPanel';
import { ResizablePanel } from './ResizablePanel';
import { SessionTabs } from './SessionTabs';
import { TerminalTab } from './TerminalTab';

// Toggle this to show mock permission message for UX development
const USE_MOCK_PERMISSION = false;

export const MainContent: React.FC = () => {
  // Core store - business logic
  const selectedAgentId = useCoreStore((state) => state.selectedAgentId);
  const agents = useCoreStore((state) => state.agents);
  const messages = useCoreStore((state) => state.messages);
  const selectedProjectId = useCoreStore((state) => state.selectedProjectId);
  const projects = useCoreStore((state) => state.projects);
  const attachments = useCoreStore((state) => state.attachments);
  const isStreamingActiveChat = useCoreStore((state) =>
    state.activeChat ? state.streamingStates.get(state.activeChat) || false : false
  );
  const chatError = useCoreStore((state) => state.chatError);
  const activeChat = useCoreStore((state) => state.activeChat);

  // Core store actions
  const updateAgent = useCoreStore((state) => state.updateAgent);
  const sendMessage = useCoreStore((state) => state.sendMessage);
  const attachResource = useCoreStore((state) => state.attachResource);
  const detachResource = useCoreStore((state) => state.detachResource);

  // UI store - presentation state
  const detailPanelCollapsed = useUIStore((state) => state.detailPanelCollapsed);
  const toggleDetailPanel = useUIStore((state) => state.toggleDetailPanel);
  const setShowProjectCreation = useUIStore((state) => state.setShowProjectCreation);

  // Derive selected agent from store
  const selectedAgent = selectedAgentId ? agents.get(selectedAgentId) : null;

  // Get current chat messages
  const baseChatMessages = activeChat ? messages.get(activeChat) || [] : [];
  const chatMessages = USE_MOCK_PERMISSION
    ? [...baseChatMessages, mockPermissionChatMessage]
    : baseChatMessages;

  // Debug: Log message count when it changes
  React.useEffect(() => {
    if (activeChat) {
      logger.info(
        `[MainContent] Rendering with ${chatMessages.length} messages for chat ${activeChat}`
      );
    }
  }, [chatMessages.length, activeChat]);

  // Get current attachments (resource IDs)
  const currentAttachments = activeChat ? attachments.get(activeChat) || [] : [];
  const attachedResourceIds = currentAttachments.map((att) => att.resourceId);

  const chatInterfaceRef = useRef<{ focus: () => void } | null>(null);
  const [isContentExpanded] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editedContent, setEditedContent] = useState('');

  // Get current project for header
  const currentProject = selectedProjectId ? projects.get(selectedProjectId) : null;
  const folderName = currentProject?.localPath ? getFolderName(currentProject.localPath) : null;
  const displayName = currentProject?.branchName || folderName;

  // Only show todos panel when a worktree is selected AND a session tab is active (not terminal or changes)
  const showTodosPanel =
    !!selectedProjectId && selectedAgentId !== 'terminal-tab' && selectedAgentId !== 'changes-tab';

  const handleCopyPath = useCallback(() => {
    if (currentProject?.localPath) {
      navigator.clipboard.writeText(currentProject.localPath).catch(logger.error);
    }
  }, [currentProject]);

  const handleContentClick = useCallback(() => {
    if (selectedAgent) {
      setEditedContent(selectedAgent.content);
      setIsEditingContent(true);
    }
  }, [selectedAgent]);

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedContent(e.target.value);
  }, []);

  const handleContentSave = useCallback(async () => {
    if (!selectedAgent) return;

    try {
      await updateAgent(selectedAgent.id, { content: editedContent });
      setIsEditingContent(false);
    } catch (error) {
      logger.error('Failed to update content:', error as Error);
      // Revert to original content on error
      setEditedContent(selectedAgent.content);
      setIsEditingContent(false);
    }
  }, [selectedAgent, editedContent, updateAgent]);

  const handleContentCancel = useCallback(() => {
    if (selectedAgent) {
      setEditedContent(selectedAgent.content);
    }
    setIsEditingContent(false);
  }, [selectedAgent]);

  const handleContentKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        handleContentCancel();
      } else if (e.key === 'Enter' && e.ctrlKey) {
        void handleContentSave();
      }
    },
    [handleContentCancel, handleContentSave]
  );

  // Keyboard shortcut: Focus chat input (Cmd+Alt+Enter)
  useKeyboardShortcut(
    [KeyboardShortcuts.FOCUS_CHAT_INPUT, KeyboardShortcuts.FOCUS_CHAT_INPUT_ALT],
    () => {
      if (chatInterfaceRef.current && selectedAgentId !== 'terminal-tab') {
        chatInterfaceRef.current.focus();
      }
    },
    { enabled: !!selectedAgentId && selectedAgentId !== 'terminal-tab' }
  );

  const handleMainContentClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Don't focus if clicking within tabs or interactive elements
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('[role="tab"]') ||
      target.closest('[role="tablist"]')
    ) {
      return;
    }

    // Check if click is within chat area (messages or input) - look for chat container or message wrappers
    const isClickInChatArea = !!(
      target.closest('.editor-content') ||
      target.closest('.markdown-content') ||
      target.closest('[role="log"]') ||
      target.closest('[aria-label="Chat messages"]')
    );

    // Focus chat if:
    // - Click is OUTSIDE chat messages (only focus on whitespace/empty areas)
    // - Never focus when clicking within messages (to allow text selection/copy)
    const shouldFocus = !isClickInChatArea;

    if (shouldFocus && chatInterfaceRef.current) {
      chatInterfaceRef.current.focus();
    }
  }, []);

  const renderContentByType = () => {
    if (!selectedAgent) return null;

    switch (selectedAgent.type) {
      case AgentType.CODE:
        return (
          <div>
            <pre>
              <code>{selectedAgent.content}</code>
            </pre>
          </div>
        );

      case AgentType.IMAGE:
        return (
          <div>
            <img src={selectedAgent.content} alt={selectedAgent.title} />
          </div>
        );

      case AgentType.VIDEO:
      case AgentType.AUDIO:
        return (
          <div>
            <p>{selectedAgent.content}</p>
            <div>
              {selectedAgent.type === AgentType.VIDEO ? (
                <Video className="h-5 w-5" />
              ) : (
                <Music className="h-5 w-5" />
              )}
              <span>Media Player</span>
            </div>
          </div>
        );

      default:
        return (
          <div>
            <p>{selectedAgent.content}</p>
          </div>
        );
    }
  };

  // Show empty state if no project is selected OR no agent is selected (but allow terminal and changes tabs)
  if (
    !selectedProjectId ||
    (!selectedAgent && selectedAgentId !== 'terminal-tab' && selectedAgentId !== 'changes-tab')
  ) {
    return (
      <main
        id="main-content-empty"
        data-component="MainContent"
        data-state="empty"
        className="h-full flex flex-col bg-background main-content-container"
      >
        <div
          id="center-panel-empty"
          data-panel="center-empty"
          className="h-full flex flex-col items-center justify-center center-panel"
        >
          <Button variant="brand" onClick={() => setShowProjectCreation(true)}>
            Create a project
          </Button>
        </div>
      </main>
    );
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
              className="flex-1 flex flex-col min-h-0 chat-wrapper"
            >
              <div
                id="chat-interface-container"
                data-section="chat-interface"
                className="flex-1 flex flex-col min-h-0 chat-interface-container"
              >
                {selectedAgentId === 'terminal-tab' ? (
                  <TerminalTab className="flex-1" />
                ) : selectedAgentId === 'changes-tab' ? (
                  <ChangesTab className="flex-1" />
                ) : (
                  <ChatInterface
                    ref={chatInterfaceRef}
                    messages={chatMessages}
                    onSendMessage={async (content, options) => {
                      await sendMessage(content, undefined, attachedResourceIds, options);
                      if (attachedResourceIds.length > 0) {
                        attachedResourceIds.forEach((id) => detachResource(id));
                      }
                    }}
                    isLoading={isStreamingActiveChat || !!chatError}
                    attachedResourceIds={attachedResourceIds}
                    onRemoveResource={detachResource}
                    onAttachResources={async (resourceIds) => {
                      // First, we need to get the actual resources and store them
                      for (const id of resourceIds) {
                        // Get the resource data from electron (it was just uploaded)
                        const resources = await window.electron?.resources?.getResources([id]);
                        if (resources && resources.length > 0) {
                          const resource = resources[0];
                          // Pass the resource data so it can be stored
                          attachResource(id, resource);
                        } else {
                          attachResource(id);
                        }
                      }
                    }}
                  />
                )}
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
