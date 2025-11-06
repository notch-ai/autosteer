import { useTheme } from '@/commons/contexts/ThemeContext';
import { cn } from '@/commons/utils';
import { logger } from '@/commons/utils/logger';
import { useFileDragDrop } from '@/hooks/useFileDragDrop';
import { useChatInputFocus } from '@/hooks/useChatInputFocus';
import {
  Circle,
  CircleCheck,
  CircleStop,
  FileCheck2,
  Package2,
  Paperclip,
  Wrench,
} from 'lucide-react';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { ThreeDots } from 'react-loader-spinner';

import { ChatMessage } from '@/entities';
import { ModelOption } from '@/types/model.types';
import { PermissionMode } from '@/types/permission.types';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

import { useAgentsStore, useChatStore, useProjectsStore } from '@/stores';
import { useResourcesStore } from '@/stores/resources.store';

import {
  RequestTiming,
  StreamingEventDisplay,
  ToolPairDisplay,
  ToolUsageDisplay,
} from '@/features/monitoring';
import { ClaudeErrorDisplay, PermissionActionDisplay, TodoDisplay } from '@/features/shared';
import { ChatInput, ChatInputHandle } from './ChatInput';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (
    content: string,
    options?: { permissionMode?: PermissionMode; model?: ModelOption }
  ) => void;
  isLoading: boolean;
  attachedResourceIds: string[];
  onRemoveResource: (resourceId: string) => void;
  onAttachResources?: (resourceIds: string[]) => void;
}

export interface ChatInterfaceRef {
  focus: () => void;
}

interface MessageItemProps {
  message: ChatMessage;
  streamingMessageId: string | null;
  resources: Map<string, any>;
  formatTimestamp: (date: Date) => string;
  isLastMessage?: boolean;
  onScrollToBottom?: () => void;
  isStreaming?: boolean;
}

// Helper function to format token counts
const formatTokenCount = (count: number): string => {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};

// Helper function to format cost with appropriate decimal places
const formatCost = (cost: number): string => {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
};

// Memoized message component using UI components
const MessageItem = memo<MessageItemProps>(
  ({ message, streamingMessageId, resources, isLastMessage, onScrollToBottom, isStreaming }) => {
    const { activeTheme } = useTheme();
    const [activeMetadataTab, setActiveMetadataTab] = useState<'tools' | 'tokens' | 'todos' | null>(
      null
    );

    const [showSessionStats, setShowSessionStats] = useState(false);

    // Get current project path to strip from file paths
    const selectedProjectId = useProjectsStore((state) => state.selectedProjectId);
    const projects = useProjectsStore((state) => state.projects);
    const currentProject = selectedProjectId ? projects.get(selectedProjectId) : undefined;

    // Utility to strip worktree directory from file paths
    const stripWorktreePath = (filePath: string): string => {
      if (!currentProject?.localPath) return filePath;
      const worktreePath = currentProject.localPath;
      if (filePath.startsWith(worktreePath)) {
        return filePath.slice(worktreePath.length).replace(/^\//, '');
      }
      return filePath;
    };

    const handleMetadataToggle = (tab: 'tools' | 'tokens' | 'todos') => {
      const newValue = activeMetadataTab === tab ? null : tab;
      setActiveMetadataTab(newValue);
      // Scroll to bottom if this is the last message and we're opening a tab
      if (isLastMessage && newValue !== null && onScrollToBottom) {
        setTimeout(onScrollToBottom, 100);
      }
    };
    const streamingEvents: any[] = []; // TODO: Implement streaming events in CoreStore
    const worktreeStats: any = null; // TODO: Implement worktreeStats in CoreStore

    const renderAttachedResources = (resourceIds: string[]) => {
      if (!resourceIds || resourceIds.length === 0) return null;

      return (
        <div className="flex flex-wrap gap-1 mb-1">
          {resourceIds.map((id) => {
            const resource = resources.get(id);
            if (!resource) return null;

            return (
              <Badge
                key={id}
                variant="secondary"
                className="flex items-center gap-0.5 py-0 px-1.5 text-[11px]"
              >
                <Paperclip className="h-2.5 w-2.5" />
                <span>{resource.name}</span>
              </Badge>
            );
          })}
        </div>
      );
    };

    const isStreamingMessage = message.id === streamingMessageId && isStreaming;
    const content = message.content || '';

    // Check if this is an interrupted message
    const isInterrupted = message.role === 'user' && content === '[Request interrupted by user]';

    // Don't render empty streaming assistant messages - the standalone indicator will show instead
    if (isStreamingMessage && message.role === 'assistant' && !content && !isInterrupted) {
      return null;
    }

    return (
      <div
        className={cn(
          'mb-1 group min-w-0 max-w-full select-text',
          message.role === 'user'
            ? 'text-text-muted bg-background rounded px-1 py-1'
            : 'text-text bg-muted rounded px-1 py-1 pb-2'
        )}
      >
        {/* Message Content */}
        <div className="pl-2 text-sm min-w-0 max-w-full break-words select-text">
          {renderAttachedResources(message.attachedResources || [])}

          {isStreamingMessage ? (
            <>
              {isInterrupted ? (
                <div className="flex items-center gap-1.5 text-sm text-text">
                  <CircleStop className="w-4 h-4 stroke-red text-red" />
                  <span>interrupted</span>
                </div>
              ) : (
                content && (
                  <div className={cn(message.role === 'user' ? 'text-text-muted' : 'text-text')}>
                    <MarkdownRenderer content={content} />
                  </div>
                )
              )}
              {streamingEvents && streamingEvents.length > 0 && (
                <StreamingEventDisplay events={streamingEvents} />
              )}
            </>
          ) : message.streamingEvents && message.streamingEvents.length > 0 ? (
            <StreamingEventDisplay events={message.streamingEvents} />
          ) : (
            <>
              {message.permissionAction ? (
                <PermissionActionDisplay
                  type={message.permissionAction.type}
                  file_path={stripWorktreePath(message.permissionAction.file_path)}
                  old_string={message.permissionAction.old_string}
                  new_string={message.permissionAction.new_string}
                  content={message.permissionAction.content}
                />
              ) : (
                <>
                  {isInterrupted ? (
                    <div className="flex items-center gap-1.5 text-sm text-text">
                      <CircleStop className="w-4 h-4 stroke-red" />
                      <span>interrupted</span>
                    </div>
                  ) : (
                    <>
                      {content && (
                        <div
                          className={cn(message.role === 'user' ? 'text-text-muted' : 'text-text')}
                        >
                          <MarkdownRenderer content={content} />
                        </div>
                      )}
                      {message.role === 'assistant' &&
                        message.toolCalls &&
                        message.toolCalls.length > 0 && (
                          <div className="mt-2">
                            <ToolPairDisplay toolCalls={message.toolCalls} inline />
                          </div>
                        )}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {/* Display errors and stop reason warnings */}
          {!isStreamingMessage &&
            message.role === 'assistant' &&
            (message.error || message.stopReason) && (
              <div className="mt-3">
                <ClaudeErrorDisplay
                  {...(message.error && { error: message.error })}
                  {...(message.stopReason && { stopReason: message.stopReason })}
                  {...(message.stopSequence && { stopSequence: message.stopSequence })}
                  {...(message.requestId && { requestId: message.requestId })}
                />
              </div>
            )}

          {/* Combined Tool Calls and Token Usage Tabs */}
          {!isStreamingMessage && message.role === 'assistant' && (
            <>
              {((message.simplifiedToolCalls && message.simplifiedToolCalls.length > 0) ||
                (message.toolCalls && message.toolCalls.length > 0) ||
                (message.toolUsages && message.toolUsages.length > 0) ||
                message.tokenUsage ||
                (message.latestTodos && message.latestTodos.length > 0)) && (
                <div className="flex items-center gap-2 my-2">
                  {/* Todos Tab */}
                  {message.latestTodos && message.latestTodos.length > 0 && (
                    <TodoDisplay
                      todos={message.latestTodos}
                      isActive={activeMetadataTab === 'todos'}
                      onToggle={() => handleMetadataToggle('todos')}
                    />
                  )}

                  {/* Tool Calls Tab */}
                  {((message.simplifiedToolCalls && message.simplifiedToolCalls.length > 0) ||
                    (message.toolCalls && message.toolCalls.length > 0) ||
                    (message.toolUsages && message.toolUsages.length > 0)) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        'h-auto py-0.5 px-2 text-[11px]',
                        activeMetadataTab === 'tools'
                          ? 'bg-white border-border shadow-xs hover:bg-white hover:border-border hover:shadow-xs text-text [&.dark]:text-black [.dark_&]:text-black'
                          : 'bg-muted text-text-muted border-border hover:bg-white hover:text-text hover:border-border hover:shadow-xs [.dark_&:hover]:text-black'
                      )}
                      onClick={() => handleMetadataToggle('tools')}
                      style={
                        activeMetadataTab === 'tools' && activeTheme === 'dark'
                          ? { color: 'black' }
                          : undefined
                      }
                    >
                      {message.simplifiedToolCalls?.length ||
                        message.toolCalls?.filter((tc) => tc.type === 'tool_use').length ||
                        message.toolUsages?.length ||
                        0}{' '}
                      tool call
                      {(message.simplifiedToolCalls?.length ||
                        message.toolCalls?.filter((tc) => tc.type === 'tool_use').length ||
                        message.toolUsages?.length ||
                        0) !== 1
                        ? 's'
                        : ''}
                    </Button>
                  )}
                  {/* Token Usage Tab */}
                  {message.tokenUsage && (
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        'h-auto py-0.5 px-2 text-[11px]',
                        activeMetadataTab === 'tokens'
                          ? 'bg-white border-border shadow-xs hover:bg-white hover:border-border hover:shadow-xs text-text [&.dark]:text-black [.dark_&]:text-black'
                          : 'bg-muted text-text-muted border-border hover:bg-white hover:text-text hover:border-border hover:shadow-xs [.dark_&:hover]:text-black'
                      )}
                      onClick={() => handleMetadataToggle('tokens')}
                      style={
                        activeMetadataTab === 'tokens' && activeTheme === 'dark'
                          ? { color: 'black' }
                          : undefined
                      }
                    >
                      {message.tokenUsage.inputTokens !== undefined &&
                        message.tokenUsage.outputTokens !== undefined && (
                          <span>
                            {formatTokenCount(
                              (message.tokenUsage.inputTokens || 0) +
                                (message.tokenUsage.outputTokens || 0)
                            )}{' '}
                            tokens
                          </span>
                        )}
                      {message.totalCostUSD !== undefined && message.totalCostUSD > 0 && (
                        <span className="ml-1">{formatCost(message.totalCostUSD)}</span>
                      )}
                    </Button>
                  )}
                </div>
              )}

              {/* Tab Content */}
              {activeMetadataTab === 'tools' && (
                <div className="ml-0 mt-3 space-y-2">
                  {(() => {
                    if (message.toolUsages && message.toolUsages.length > 0) {
                      return <ToolUsageDisplay toolUsages={message.toolUsages} />;
                    }

                    const getToolDescription = (toolName: string, input: any): string => {
                      if (!input) return '';
                      switch (toolName) {
                        case 'Read':
                          return stripWorktreePath(input.file_path || input.path || '');
                        case 'Write':
                          return stripWorktreePath(input.file_path || input.path || '');
                        case 'Edit':
                        case 'MultiEdit':
                          return stripWorktreePath(input.file_path || input.path || '');
                        case 'Bash':
                          return input.command || '';
                        case 'Task':
                          return input.description || '';
                        case 'Grep':
                          return `"${input.pattern}" in ${stripWorktreePath(input.path || '.')}`;
                        case 'Glob':
                          return `${input.pattern} in ${stripWorktreePath(input.path || '.')}`;
                        default:
                          if (input.path) return stripWorktreePath(input.path);
                          if (input.file_path) return stripWorktreePath(input.file_path);
                          if (input.query) return input.query;
                          return '';
                      }
                    };

                    if (message.simplifiedToolCalls && message.simplifiedToolCalls.length > 0) {
                      return message.simplifiedToolCalls
                        .filter((tc) => tc.name !== 'TodoWrite')
                        .map((toolCall, index) => (
                          <div key={index} className="flex items-start gap-2">
                            <Wrench className="h-4 w-4 text-blue" />
                            <div className="flex-1 text-sm">
                              {toolCall.name}
                              {toolCall.description && (
                                <span className="ml-2 text-muted-foreground">
                                  {stripWorktreePath(toolCall.description)}
                                </span>
                              )}
                            </div>
                          </div>
                        ));
                    } else if (message.toolCalls && message.toolCalls.length > 0) {
                      return message.toolCalls
                        .filter((tc) => tc.type === 'tool_use')
                        .map((toolCall, index) => {
                          const description = getToolDescription(
                            toolCall.name || '',
                            toolCall.input
                          );
                          return (
                            <div key={index} className="flex items-start gap-2">
                              <Wrench className="h-4 w-4 text-blue" />
                              <div className="flex-1 text-sm">
                                {toolCall.name || 'Unknown'}
                                {description && (
                                  <span className="ml-2 text-muted-foreground">{description}</span>
                                )}
                              </div>
                            </div>
                          );
                        });
                    }
                    return null;
                  })()}
                </div>
              )}

              {activeMetadataTab === 'tokens' && message.tokenUsage && (
                <div className="flex items-center gap-1 mt-3 text-sm ml-0">
                  <Package2 className="h-4 w-4 text-orange mr-1" />

                  {message.tokenUsage.inputTokens !== undefined && (
                    <span>↓ {formatTokenCount(message.tokenUsage.inputTokens)}</span>
                  )}
                  {message.tokenUsage.outputTokens !== undefined && (
                    <span>↑ {formatTokenCount(message.tokenUsage.outputTokens)}</span>
                  )}
                  {message.tokenUsage.cacheReadInputTokens !== undefined &&
                    message.tokenUsage.cacheReadInputTokens > 0 && (
                      <span className="ml-2">
                        {formatTokenCount(message.tokenUsage.cacheReadInputTokens)} cached
                      </span>
                    )}
                  {message.tokenUsage.cacheCreationInputTokens &&
                    message.tokenUsage.cacheCreationInputTokens > 0 && (
                      <span className="ml-2">
                        {formatTokenCount(message.tokenUsage.cacheCreationInputTokens)} cache write
                      </span>
                    )}
                </div>
              )}
              {activeMetadataTab === 'todos' && message.latestTodos && (
                <div className="ml-0 mt-3 space-y-1">
                  {message.latestTodos.map((task) => (
                    <div key={task.id} className="flex items-start gap-2">
                      <CircleCheck
                        className={cn(
                          'h-4 w-4 flex-shrink-0 mt-0.5',
                          task.status === 'completed' ? 'text-success' : 'text-text-muted'
                        )}
                      />
                      <span className="text-sm">
                        {task.status === 'in_progress' && task.activeForm
                          ? task.activeForm
                          : task.content}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Session Stats - Moved to bottom */}
          {!isStreamingMessage &&
            message.role === 'assistant' &&
            worktreeStats &&
            worktreeStats.messageCount > 0 && (
              <div className="relative mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto py-0 px-0.5 text-[11px] text-text-muted hover:text-text"
                  onMouseEnter={() => setShowSessionStats(true)}
                  onMouseLeave={() => setShowSessionStats(false)}
                >
                  session
                </Button>

                {showSessionStats && (
                  <Card className="absolute top-full left-0 mt-1 p-3 z-10 w-64">
                    <h4 className="font-semibold text-sm mb-2">Session Stats</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text-muted">Messages</span>
                        <span>{worktreeStats.messageCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Total Cost</span>
                        <span className="text-success">{formatCost(worktreeStats.totalCost)}</span>
                      </div>
                      <Separator className="my-1" />
                      <div className="flex justify-between">
                        <span className="text-text-muted">Total Tokens</span>
                        <span>
                          {formatTokenCount(
                            worktreeStats.totalInputTokens +
                              worktreeStats.totalOutputTokens +
                              worktreeStats.totalCacheCreationTokens +
                              worktreeStats.totalCacheReadTokens
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Input</span>
                        <span>{formatTokenCount(worktreeStats.totalInputTokens)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Output</span>
                        <span>{formatTokenCount(worktreeStats.totalOutputTokens)}</span>
                      </div>
                      {worktreeStats.totalCacheReadTokens > 0 && (
                        <div className="flex justify-between">
                          <span className="text-text-muted">Cache Read</span>
                          <span>{formatTokenCount(worktreeStats.totalCacheReadTokens)}</span>
                        </div>
                      )}
                      {worktreeStats.totalCacheCreationTokens > 0 && (
                        <div className="flex justify-between">
                          <span className="text-text-muted">Cache Write</span>
                          <span>{formatTokenCount(worktreeStats.totalCacheCreationTokens)}</span>
                        </div>
                      )}
                    </div>
                  </Card>
                )}
              </div>
            )}
        </div>
      </div>
    );
  }
);

MessageItem.displayName = 'MessageItem';

/**
 * Feature component for ChatInterface
 * Migrated to use shadcn/ui components for all visual elements
 * Maintains backward compatibility with legacy API
 */
export const ChatInterface = forwardRef<ChatInterfaceRef, ChatInterfaceProps>(
  (
    {
      messages,
      onSendMessage,
      isLoading,
      attachedResourceIds,
      onRemoveResource,
      onAttachResources,
    },
    ref
  ) => {
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [showPermissionDialog, setShowPermissionDialog] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<ChatInputHandle>(null);

    // Store subscriptions
    const resources = useResourcesStore((state) => state.resources);
    const activeChat = useChatStore((state) => state.activeChat);
    const clearChat = useChatStore((state) => state.clearChat);
    const isStreaming = useChatStore((state) =>
      state.activeChat ? state.streamingStates.get(state.activeChat) || false : false
    );
    const streamingMessage = useChatStore((state) =>
      state.activeChat ? state.streamingMessages.get(state.activeChat) : null
    );

    const currentPermissionRequest = useChatStore((state) => {
      if (!activeChat) return null;
      const msg = state.streamingMessages.get(activeChat);
      return msg?.permissionRequest || null;
    });

    const selectedAgentId = useAgentsStore((state) => state.selectedAgentId);

    // Auto-focus chat input when agent changes
    useChatInputFocus(() => {
      chatInputRef.current?.focus();
    });
    const sendMessage = useChatStore((state) => state.sendMessage);

    // Get current project for auto-focus and path stripping
    const selectedProjectId = useProjectsStore((state) => state.selectedProjectId);
    const projects = useProjectsStore((state) => state.projects);
    const currentProject = selectedProjectId ? projects.get(selectedProjectId) : undefined;

    // Derived values
    const streamingMessageId = streamingMessage?.id || null;

    // Utility to strip worktree directory from file paths
    const stripWorktreePath = (filePath: string): string => {
      if (!currentProject?.localPath) return filePath;
      const worktreePath = currentProject.localPath;
      if (filePath.startsWith(worktreePath)) {
        return filePath.slice(worktreePath.length).replace(/^\//, '');
      }
      return filePath;
    };

    // Scroll to bottom when messages change or agent switches
    useEffect(() => {
      // Use setTimeout to ensure DOM has fully updated with new content
      const scrollTimer = setTimeout(() => {
        const scrollAreaRoot = scrollAreaRef.current;
        const viewport = scrollAreaRoot?.querySelector('[data-radix-scroll-area-viewport]');

        if (viewport) {
          // Force scroll to absolute bottom
          viewport.scrollTop = viewport.scrollHeight;
        } else {
          logger.warn('[ChatInterface] ScrollArea viewport not found');
        }
      }, 150);

      return () => clearTimeout(scrollTimer);
    }, [messages, selectedAgentId]);

    // Auto-focus chat input when a worktree/project is selected
    useEffect(() => {
      if (currentProject?.localPath) {
        // Focus would be handled here if we had a ref
      }
    }, [currentProject?.id]);

    // Expose focus method to parent components
    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          // Focus the CodeMirror editor
          const cmEditor = document.querySelector('.cm-editor .cm-content') as HTMLElement;
          if (cmEditor) {
            cmEditor.focus();

            // If vim mode exists, ensure we're in insert mode
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            const cmView = cmEditor.closest('.cm-editor') as any;
            if (cmView && cmView.cmView) {
              const view = cmView.cmView.view;
              // Try to get vim state
              const vim = view?.state?.vim;
              if (vim) {
                // Force into insert mode if in normal mode
                if (vim.mode !== 'insert') {
                  // Trigger 'i' key to enter insert mode
                  const event = new KeyboardEvent('keydown', { key: 'i' });
                  cmEditor.dispatchEvent(event);
                }
              }
            }
          } else {
            // Fallback to .editor-content
            const editor = document.querySelector('.editor-content') as HTMLDivElement;
            if (editor) {
              editor.focus();
            }
          }
        },
      }),
      []
    );

    const confirmClearChat = () => {
      const selectedAgentId = useAgentsStore.getState().selectedAgentId;
      if (selectedAgentId) {
        clearChat(selectedAgentId);
      }
      setShowClearConfirm(false);
    };

    const cancelClearChat = () => {
      setShowClearConfirm(false);
    };

    const handlePermissionApprove = async () => {
      setShowPermissionDialog(false);

      if (activeChat && currentPermissionRequest) {
        const chatId = activeChat;

        // Add a permission action message to show the accepted change
        const permissionActionMessage: ChatMessage = {
          id: `permission-approved-${Date.now()}`,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          permissionAction: {
            type: 'accepted',
            file_path: currentPermissionRequest.file_path,
            ...(currentPermissionRequest.old_string && {
              old_string: currentPermissionRequest.old_string,
            }),
            ...(currentPermissionRequest.new_string && {
              new_string: currentPermissionRequest.new_string,
            }),
            ...(currentPermissionRequest.content && {
              content: currentPermissionRequest.content,
            }),
            timestamp: new Date(),
          },
        };

        // Add the permission action message to the chat
        useChatStore.setState((state) => {
          const messages = state.messages.get(chatId) || [];
          state.messages.set(chatId, [...messages, permissionActionMessage]);
          state.streamingMessages.delete(chatId);
          return state;
        });

        // Continue with the approved changes
        await sendMessage('Continue with the approved changes.', undefined, [], {
          permissionMode: 'bypassPermissions',
        });
      }
    };

    const handlePermissionReject = () => {
      setShowPermissionDialog(false);

      if (activeChat && currentPermissionRequest) {
        const chatId = activeChat;

        // Add a permission action message to show the rejected change
        const permissionActionMessage: ChatMessage = {
          id: `permission-rejected-${Date.now()}`,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          permissionAction: {
            type: 'rejected',
            file_path: currentPermissionRequest.file_path,
            ...(currentPermissionRequest.old_string && {
              old_string: currentPermissionRequest.old_string,
            }),
            ...(currentPermissionRequest.new_string && {
              new_string: currentPermissionRequest.new_string,
            }),
            ...(currentPermissionRequest.content && {
              content: currentPermissionRequest.content,
            }),
            timestamp: new Date(),
          },
        };

        // Add the permission action message to the chat
        useChatStore.setState((state) => {
          const messages = state.messages.get(chatId) || [];
          state.messages.set(chatId, [...messages, permissionActionMessage]);
          state.streamingMessages.delete(chatId);
          return state;
        });
      }
    };

    const formatTimestamp = (date: Date) => {
      const now = new Date();
      const messageDate = new Date(date);
      const isToday = messageDate.toDateString() === now.toDateString();

      if (isToday) {
        return messageDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      }

      return messageDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    };

    // Handle file drag and drop
    const handleFilesDropped = useCallback(
      async (filePaths: string[]) => {
        if (!onAttachResources) return;

        try {
          const resourceIds: string[] = [];

          for (const filePath of filePaths) {
            const resource = await window.electron.resources?.uploadResources(filePath);
            if (resource) {
              resourceIds.push(resource.id);
            }
          }

          if (resourceIds.length > 0) {
            onAttachResources(resourceIds);
          }
        } catch (error) {
          logger.error('[ChatInterface] Failed to process dropped files:', error);
        }
      },
      [onAttachResources]
    );

    const { isDragging, dragHandlers } = useFileDragDrop({
      onFilesDropped: handleFilesDropped,
      disabled: !onAttachResources || (isLoading && !isStreaming),
    });

    return (
      <div
        role="main"
        aria-label="Chat interface"
        className="flex flex-col flex-1 min-h-0 bg-background min-w-0"
        data-chat-interface
      >
        {/* Clear Chat Confirmation Dialog */}
        <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clear Chat History?</DialogTitle>
              <DialogDescription>
                This will clear all messages and start a new conversation. This action cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={cancelClearChat}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmClearChat}>
                Clear Chat
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Messages Area */}
        <div
          className="flex-1 flex flex-col relative min-h-0 overflow-hidden"
          onDragEnter={dragHandlers.onDragEnter}
          onDragOver={dragHandlers.onDragOver}
          onDragLeave={dragHandlers.onDragLeave}
          onDrop={dragHandlers.onDrop}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none">
              <div className="bg-background/90 rounded-lg p-4 flex flex-col items-center gap-2 pointer-events-none">
                <Paperclip className="h-8 w-8 text-primary" />
                <p className="text-sm font-medium text-text">Drop files to attach</p>
              </div>
            </div>
          )}

          <ScrollArea ref={scrollAreaRef} className="flex-1 overflow-hidden">
            <div role="log" aria-live="polite" aria-label="Chat messages" className="px-2 py-1.5">
              {messages.map((message, index) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  streamingMessageId={streamingMessageId}
                  resources={resources}
                  formatTimestamp={formatTimestamp}
                  isLastMessage={index === messages.length - 1}
                  onScrollToBottom={() =>
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
                  }
                  isStreaming={isStreaming}
                />
              ))}

              {/* Standalone Streaming Indicator - Shown when actively streaming */}
              {isStreaming && streamingMessage && (
                <div className="mb-1 group min-w-0 text-text bg-muted rounded px-1 py-1 pb-2">
                  <div className="pl-2 text-sm min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <ThreeDots
                        height="12"
                        width="24"
                        color="#4caf50"
                        ariaLabel="three-dots-loading"
                      />
                      {(() => {
                        const lastMessage = messages[messages.length - 1];
                        if (lastMessage?.role === 'assistant') {
                          return (
                            <>
                              <RequestTiming startTime={lastMessage.startTime} isStreaming={true} />
                              {lastMessage.currentResponseOutputTokens &&
                                lastMessage.currentResponseOutputTokens > 0 && (
                                  <span className="text-text-muted">
                                    ↓ {formatTokenCount(lastMessage.currentResponseOutputTokens)}{' '}
                                    tokens
                                  </span>
                                )}
                            </>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Inline Permission Request */}
              {currentPermissionRequest && !showPermissionDialog && (
                <div className="mb-4">
                  <div className="rounded-lg py-2 bg-muted">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 ml-1 px-2">
                          <FileCheck2 className="h-4 w-4 text-red flex-shrink-0" />
                          <div className="text-sm font-mono break-all">
                            {currentPermissionRequest.tool_name === 'Bash'
                              ? 'Run Command'
                              : currentPermissionRequest.tool_name === 'WebFetch'
                                ? 'Fetch URL'
                                : currentPermissionRequest.tool_name === 'WebSearch'
                                  ? 'Search Web'
                                  : currentPermissionRequest.tool_name || 'Edit'}{' '}
                            {currentPermissionRequest.url ||
                              currentPermissionRequest.query ||
                              (currentPermissionRequest.file_path
                                ? stripWorktreePath(currentPermissionRequest.file_path)
                                : '')}
                          </div>
                        </div>

                        {/* Show diff or content */}
                        <div className="space-y-0 overflow-hidden max-h-[400px] overflow-y-auto mb-2 pr-2 pl-5">
                          {currentPermissionRequest.old_string && (
                            <div>
                              {currentPermissionRequest.old_string
                                .split('\n')
                                .map((line: string, i: number) => (
                                  <div
                                    key={`old-${i}`}
                                    className="flex font-mono text-sm leading-5 bg-red-50 dark:bg-red-950"
                                  >
                                    <span className="inline-block px-2 text-right select-none flex-shrink-0 w-16 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">
                                      {i + 1}
                                    </span>
                                    <span className="px-2 select-none text-red-600 dark:text-red-400">
                                      -
                                    </span>
                                    <span className="flex-1 pr-3 text-foreground">
                                      {line || ' '}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          )}

                          {currentPermissionRequest.new_string && (
                            <div>
                              {currentPermissionRequest.new_string
                                .split('\n')
                                .map((line: string, i: number) => (
                                  <div
                                    key={`new-${i}`}
                                    className="flex font-mono text-sm leading-5 bg-green-50 dark:bg-green-950"
                                  >
                                    <span className="inline-block px-2 text-right select-none flex-shrink-0 w-16 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                                      {i + 1}
                                    </span>
                                    <span className="px-2 select-none text-green-600 dark:text-green-400">
                                      +
                                    </span>
                                    <span className="flex-1 pr-3 text-foreground">
                                      {line || ' '}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          )}

                          {/* Show content for Write operations (new file) */}
                          {currentPermissionRequest.content &&
                            !currentPermissionRequest.old_string && (
                              <div>
                                {currentPermissionRequest.content
                                  .split('\n')
                                  .map((line: string, i: number) => (
                                    <div
                                      key={`content-${i}`}
                                      className="flex font-mono text-sm leading-5 bg-green-50 dark:bg-green-950"
                                    >
                                      <span className="inline-block px-2 text-right select-none flex-shrink-0 w-16 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                                        {i + 1}
                                      </span>
                                      <span className="px-2 select-none text-green-600 dark:text-green-400">
                                        +
                                      </span>
                                      <span className="flex-1 pr-3 text-foreground">
                                        {line || ' '}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 pt-4 px-3 pb-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handlePermissionApprove}
                            className="border-transparent h-auto py-0.5 px-2 text-[11px] bg-green-400 text-white shadow-xs hover:bg-green hover:text-white hover:shadow-xs"
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handlePermissionReject}
                            className="border-transparent h-auto py-0.5 px-2 text-[11px] bg-red-400 text-white  hover:bg-red hover:text-white hover:shadow-xs"
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading Indicator */}
              {isLoading && !isStreaming && (
                <div className="mb-1.5">
                  <div className="flex items-center gap-1 mb-0.5 text-sm text-text-muted">
                    <Circle className="h-1.5 w-1.5 fill-current" />
                    <span>Assistant</span>
                  </div>
                  <div className="pl-2">
                    <div data-testid="typing-indicator">
                      <ThreeDots
                        height="12"
                        width="24"
                        color="#4caf50"
                        ariaLabel="three-dots-loading"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Input Area - Hidden when terminal tab is active */}
        {selectedAgentId !== 'terminal-tab' && (
          <ChatInput
            ref={chatInputRef}
            key={selectedAgentId}
            onSendMessage={onSendMessage}
            isLoading={isLoading}
            attachedResourceIds={attachedResourceIds}
            onRemoveResource={onRemoveResource}
            {...(onAttachResources && { onAttachResources })}
            isStreaming={isStreaming}
            selectedAgentId={selectedAgentId}
          />
        )}
      </div>
    );
  }
);

ChatInterface.displayName = 'ChatInterface';
