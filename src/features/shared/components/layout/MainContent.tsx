import { cn } from '@/commons/utils';
import { getFolderName } from '@/commons/utils/folderName';
import { KeyboardShortcuts, useKeyboardShortcut } from '@/commons/utils/keyboardShortcuts';
import { logger } from '@/commons/utils/logger';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { AgentType, ChatMessage } from '@/entities';
import { ChatInterface } from '@/features/chat/components/ChatInterface';
import { ChangesTab } from '@/features/shared/components/git/ChangesTab';
import { ResizablePanel } from '@/features/shared/components/layout/ResizablePanel';
import { SessionTabs } from '@/features/shared/components/session/SessionTabs';
import { TerminalTab } from '@/features/shared/components/terminal/TerminalTab';
import { DetailPanel } from '@/features/shared/components/ui/DetailPanel';
import { mockPermissionChatMessage } from '@/mocks/gitDiffMockData';
import { useAgentsStore, useChatStore, useProjectsStore, useUIStore } from '@/stores';
import { attachResourceToChat, detachResourceFromChat } from '@/stores/resources.store';
import { Link2, Music, Video } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';

// Toggle this to show mock permission message for UX development
const USE_MOCK_PERMISSION = false;

export const MainContent: React.FC = () => {
  // Use domain-specific stores for reactivity (getters in core don't trigger re-renders)
  const selectedAgentId = useAgentsStore((state) => state.selectedAgentId);
  const agents = useAgentsStore((state) => state.agents);
  const selectedProjectId = useProjectsStore((state) => state.selectedProjectId);
  const projects = useProjectsStore((state) => state.projects);

  console.log('[MainContent] 🎨 RENDER - selectedAgentId:', selectedAgentId);

  // Subscribe to chat store for messages reactivity
  // Important: Subscribe to activeChat separately to avoid re-renders when other chats update
  const activeChat = useChatStore((state) => state.activeChat);
  const streamingStates = useChatStore((state) => state.streamingStates);
  const chatError = useChatStore((state) => state.chatError);

  // Subscribe to messages only for the active chat using a stable reference
  // This prevents infinite loops by comparing array references before updating
  const [baseChatMessages, setBaseChatMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);

  React.useEffect(() => {
    // Subscribe to changes and update local state only when reference changes
    const unsubscribe = useChatStore.subscribe((state) => {
      if (state.activeChat) {
        const messages = state.messages.get(state.activeChat) || [];
        // Only update if the array reference has changed
        if (messages !== messagesRef.current) {
          messagesRef.current = messages;
          setBaseChatMessages(messages);
        }
      } else if (messagesRef.current.length > 0) {
        messagesRef.current = [];
        setBaseChatMessages([]);
      }
    });

    // Initial load
    const state = useChatStore.getState();
    if (state.activeChat) {
      const messages = state.messages.get(state.activeChat) || [];
      messagesRef.current = messages;
      setBaseChatMessages(messages);
    } else {
      messagesRef.current = [];
      setBaseChatMessages([]);
    }

    return unsubscribe;
  }, [activeChat]); // Re-subscribe when activeChat changes

  // Chat store actions
  const sendMessage = useChatStore((state) => state.sendMessage);

  // Agents store actions
  const updateAgent = useAgentsStore((state) => state.updateAgent);

  // Derive streaming state from chat store
  const isStreamingActiveChat = activeChat ? streamingStates.get(activeChat) || false : false;

  // UI store - presentation state
  const detailPanelCollapsed = useUIStore((state) => state.detailPanelCollapsed);
  const toggleDetailPanel = useUIStore((state) => state.toggleDetailPanel);
  const setShowProjectCreation = useUIStore((state) => state.setShowProjectCreation);

  // Derive selected agent from store
  const selectedAgent = selectedAgentId ? agents.get(selectedAgentId) : null;
  const chatMessages = USE_MOCK_PERMISSION
    ? [...baseChatMessages, mockPermissionChatMessage]
    : baseChatMessages;

  // Debug: Log comprehensive state when relevant values change
  React.useEffect(() => {
    logger.info('[MainContent] ========== STATE UPDATE ==========');
    logger.info('[MainContent] selectedAgentId:', selectedAgentId);
  }, [selectedAgentId, activeChat, baseChatMessages.length]);

  // HYPOTHESIS LOGGING: Track TerminalTab visibility in MainContent
  React.useEffect(() => {
    logger.debug('[HYPO-MAINCONTENT] TerminalTab container visibility changed', {
      selectedAgentId,
      isTerminalVisible: selectedAgentId === 'terminal-tab',
      isChangesVisible: selectedAgentId === 'changes-tab',
      isChatVisible: selectedAgentId !== 'terminal-tab' && selectedAgentId !== 'changes-tab',
    });
  }, [selectedAgentId]);

  // Get current attachments (resource IDs) from chat store
  const attachments = useChatStore((state) => state.attachments);
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
                {/* Keep TerminalTab mounted to preserve state across tab switches */}
                <div
                  className={cn('flex-1 flex flex-col', {
                    hidden: selectedAgentId !== 'terminal-tab',
                  })}
                >
                  <TerminalTab className="flex-1" />
                </div>

                {/* Keep ChangesTab mounted to preserve state across tab switches */}
                <div
                  className={cn('flex-1 flex flex-col', {
                    hidden: selectedAgentId !== 'changes-tab',
                  })}
                >
                  <ChangesTab className="flex-1" />
                </div>

                {/* Keep ChatInterface mounted to preserve state across tab switches */}
                <div
                  className={cn('flex-1 flex flex-col', {
                    hidden: selectedAgentId === 'terminal-tab' || selectedAgentId === 'changes-tab',
                  })}
                >
                  <ChatInterface
                    ref={chatInterfaceRef}
                    messages={chatMessages}
                    onSendMessage={async (content, options) => {
                      await sendMessage(content, undefined, attachedResourceIds, options);
                      if (attachedResourceIds.length > 0) {
                        attachedResourceIds.forEach((id) => detachResourceFromChat(id));
                      }
                    }}
                    isLoading={isStreamingActiveChat || !!chatError}
                    attachedResourceIds={attachedResourceIds}
                    onRemoveResource={detachResourceFromChat}
                    onAttachResources={async (resourceIds) => {
                      // First, we need to get the actual resources and store them
                      for (const id of resourceIds) {
                        // Get the resource data from electron (it was just uploaded)
                        const resources = await window.electron?.resources?.getResources([id]);
                        if (resources && resources.length > 0) {
                          const resource = resources[0];
                          // Pass the resource data so it can be stored
                          attachResourceToChat(id, resource);
                        } else {
                          attachResourceToChat(id);
                        }
                      }
                    }}
                  />
                </div>
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
