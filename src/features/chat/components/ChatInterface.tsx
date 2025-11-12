import { useTheme } from '@/commons/contexts/ThemeContext';
import { cn } from '@/commons/utils';
import { logger } from '@/commons/utils/logger';
import { useMessageMetadata, usePermissionHandling } from '@/hooks';
import { useFileDragDrop } from '@/hooks/useFileDragDrop';
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

import { ComputedMessage } from '@/stores/chat.selectors';
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

import { useChatScroll } from '@/hooks/useChatScroll';
import { MarkdownCacheService } from '@/renderer/services/MarkdownCacheService';
import { useAgentsStore, useChatStore, useProjectsStore } from '@/stores';
import { useResourcesStore } from '@/stores/resources.store';

import {
  RequestTiming,
  StreamingEventDisplay,
  ToolPairDisplay,
  ToolUsageDisplay,
} from '@/features/monitoring';
import { ClaudeErrorDisplay, PermissionActionDisplay, TodoDisplay } from '@/features/shared';
import { CachedMarkdownRenderer } from './CachedMarkdownRenderer';
import { ChatInput, ChatInputHandle } from './ChatInput';

interface ChatInterfaceProps {
  messages: ComputedMessage[];
  onSendMessage: (
    content: string,
    options?: { permissionMode?: PermissionMode; model?: ModelOption }
  ) => void;
  isLoading: boolean;
  attachedResourceIds: string[];
  onRemoveResource: (resourceId: string) => void;
  onAttachResources?: (resourceIds: string[]) => void;
  isActive?: boolean; // Whether this chat tab is active
}

export interface ChatInterfaceRef {
  focus: () => void;
}

interface MessageItemProps {
  message: ComputedMessage;
  streamingMessageId: string | null;
  resources: Map<string, any>;
  formatTimestamp: (date: Date) => string;
  _isLastMessage?: boolean;
  _onScrollToBottom?: () => void;
  isStreaming?: boolean;
  activeMetadataTab: Map<string, 'tools' | 'tokens' | 'todos' | null>;
  onMetadataToggle: (messageId: string, tab: 'tools' | 'tokens' | 'todos') => void;
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
  ({
    message,
    streamingMessageId,
    resources,
    isStreaming,
    activeMetadataTab,
    onMetadataToggle,
  }) => {
    const { activeTheme } = useTheme();
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

    // Get current active tab for this message
    const currentActiveTab = activeMetadataTab.get(message.id) || null;
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
                    <CachedMarkdownRenderer content={content} />
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
                          <CachedMarkdownRenderer content={content} />
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
                      isActive={currentActiveTab === 'todos'}
                      onToggle={() => onMetadataToggle(message.id, 'todos')}
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
                        currentActiveTab === 'tools'
                          ? 'bg-white border-border shadow-xs hover:bg-white hover:border-border hover:shadow-xs text-text [&.dark]:text-black [.dark_&]:text-black'
                          : 'bg-muted text-text-muted border-border hover:bg-white hover:text-text hover:border-border hover:shadow-xs [.dark_&:hover]:text-black'
                      )}
                      onClick={() => onMetadataToggle(message.id, 'tools')}
                      style={
                        currentActiveTab === 'tools' && activeTheme === 'dark'
                          ? { color: 'black' }
                          : undefined
                      }
                    >
                      {message.simplifiedToolCalls?.length ||
                        message.toolCalls?.filter((tc: { type: string }) => tc.type === 'tool_use')
                          .length ||
                        message.toolUsages?.length ||
                        0}{' '}
                      tool call
                      {(message.simplifiedToolCalls?.length ||
                        message.toolCalls?.filter((tc: { type: string }) => tc.type === 'tool_use')
                          .length ||
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
                        currentActiveTab === 'tokens'
                          ? 'bg-white border-border shadow-xs hover:bg-white hover:border-border hover:shadow-xs text-text [&.dark]:text-black [.dark_&]:text-black'
                          : 'bg-muted text-text-muted border-border hover:bg-white hover:text-text hover:border-border hover:shadow-xs [.dark_&:hover]:text-black'
                      )}
                      onClick={() => onMetadataToggle(message.id, 'tokens')}
                      style={
                        currentActiveTab === 'tokens' && activeTheme === 'dark'
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
              {currentActiveTab === 'tools' && (
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
                        .filter((tc: { name: string }) => tc.name !== 'TodoWrite')
                        .map((toolCall: any, index: number) => (
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
                        .filter((tc: { type: string }) => tc.type === 'tool_use')
                        .map((toolCall: any, index: number) => {
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

              {currentActiveTab === 'tokens' && message.tokenUsage && (
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
              {currentActiveTab === 'todos' && message.latestTodos && (
                <div className="ml-0 mt-3 space-y-1">
                  {message.latestTodos.map((task: any) => (
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
      isActive = true,
    },
    ref
  ) => {
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<ChatInputHandle>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

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

    // Throw chatError to trigger ErrorBoundary (must be in useEffect, not render)
    const chatError = useChatStore((state) => state.chatError);
    const [errorToThrow, setErrorToThrow] = useState<Error | null>(null);

    useEffect(() => {
      if (chatError && !errorToThrow) {
        // Validate chatError is a clean error message (not corrupted console output)
        if (
          typeof chatError === 'string' &&
          chatError.trim().length > 0 &&
          !chatError.includes('[Settings]') && // Filter out console.log artifacts
          !chatError.startsWith('{') && // Filter out JSON objects
          !chatError.startsWith('[') // Filter out arrays
        ) {
          try {
            setErrorToThrow(new Error(chatError));
          } catch (err) {
            // If creating Error fails, use a generic message
            setErrorToThrow(new Error('An unexpected error occurred'));
          }
        }
      }
    }, [chatError, errorToThrow]);

    if (errorToThrow) {
      throw errorToThrow;
    }

    const selectedAgentId = useAgentsStore((state) => state.selectedAgentId);
    const storeSendMessage = useChatStore((state) => state.sendMessage);
    const selectedProjectId = useProjectsStore((state) => state.selectedProjectId);
    const projects = useProjectsStore((state) => state.projects);
    const currentProject = selectedProjectId ? projects.get(selectedProjectId) : undefined;

    // Debug: Track isActive changes
    useEffect(() => {
      console.log('[ChatInterface] isActive changed:', {
        isActive,
        activeChat,
        selectedAgentId,
      });
    }, [isActive, activeChat, selectedAgentId]);

    // Debug: Track message changes
    useEffect(() => {
      console.log('[ChatInterface] Messages changed:', {
        isActive,
        messageCount: messages.length,
        lastMessageId: messages[messages.length - 1]?.id,
        lastMessageContentLength: messages[messages.length - 1]?.content?.length || 0,
        lastMessageRole: messages[messages.length - 1]?.role,
        allMessageIds: messages.map((m) => m.id),
      });
    }, [messages, isActive]);

    // Scroll position management with sticky-bottom (z-index keeps elements mounted)
    // bottomThreshold: 300px to account for streaming content growth during render
    // When you scroll up slightly (e.g., 100px), growing content can push you to 500-600px away
    const { scrollRef, scrollToBottom } = useChatScroll(messages, {
      isActive,
      bottomThreshold: 300,
    });

    // Message metadata state management
    const { activeMetadataTab, handleMetadataToggle } = useMessageMetadata({
      onScrollToBottom: scrollToBottom,
    });

    // Wrapper for sendMessage to match usePermissionHandling signature
    const sendMessageWrapper = useCallback(
      async (
        content: string,
        _agentId: string | undefined,
        attachedResourceIds: string[],
        options?: { permissionMode?: string }
      ) => {
        await storeSendMessage(content, undefined, attachedResourceIds, options as any);
      },
      [storeSendMessage]
    );

    // Permission handling
    const { handlePermissionApprove, handlePermissionReject } = usePermissionHandling({
      activeChat,
      currentPermissionRequest,
      sendMessage: sendMessageWrapper,
    });

    // Connect scrollRef to the actual scrollable viewport element (runs once, z-index keeps it mounted)
    useEffect(() => {
      console.log('[ChatInterface] Connecting scrollRef', {
        hasScrollAreaRef: !!scrollAreaRef.current,
        scrollRefAlreadySet: !!scrollRef.current,
      });

      if (scrollAreaRef.current && !scrollRef.current) {
        const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        console.log('[ChatInterface] Found viewport:', {
          found: !!viewport,
          isHTMLDivElement: viewport instanceof HTMLDivElement,
        });

        if (viewport instanceof HTMLDivElement) {
          scrollRef.current = viewport;
          console.log('[ChatInterface] scrollRef connected to viewport', {
            scrollTop: viewport.scrollTop,
            scrollHeight: viewport.scrollHeight,
            clientHeight: viewport.clientHeight,
          });
        }
      }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Wrap onSendMessage to force scroll to bottom (Rule #3)
    const handleSendMessage = useCallback(
      (content: string, options?: { permissionMode?: PermissionMode; model?: ModelOption }) => {
        onSendMessage(content, options);
        // Force scroll to bottom when message is sent (Rule #3)
        // Use double RAF to ensure DOM has updated with new message
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollToBottom();
          });
        });
      },
      [onSendMessage, scrollToBottom]
    );

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

    // Warmup markdown cache for improved rendering performance
    useEffect(() => {
      const cacheService = MarkdownCacheService.getInstance();
      const contents = messages.map((msg) => msg.content).filter(Boolean);
      if (contents.length > 0) {
        cacheService.warmup(contents);
      }
    }, [messages]);

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
          // Try to focus via chatInputRef first (most reliable)
          if (chatInputRef.current && typeof chatInputRef.current.focus === 'function') {
            chatInputRef.current.focus();
            return;
          }

          // Fallback: Focus the CodeMirror editor within THIS component's scroll area
          // IMPORTANT: Scope to scrollAreaRef to avoid focusing wrong agent's editor
          const container = scrollAreaRef.current;
          if (!container) {
            return;
          }

          // Find CodeMirror editor within this component's container
          const cmEditor = container.querySelector('.cm-editor .cm-content') as HTMLElement;
          if (cmEditor) {
            cmEditor.focus({ preventScroll: true });

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
            // Fallback to .editor-content within this container
            const editor = container.querySelector('.editor-content') as HTMLDivElement;
            if (editor) {
              editor.focus({ preventScroll: true });
            }
          }
        },
      }),
      [activeChat]
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
        className="flex flex-col flex-1 min-h-0 bg-background min-w-0 relative"
        data-chat-interface
        onDragEnter={dragHandlers.onDragEnter}
        onDragOver={dragHandlers.onDragOver}
        onDragLeave={dragHandlers.onDragLeave}
        onDrop={dragHandlers.onDrop}
      >
        {/* Drag overlay - extends over entire interface including chat input */}
        {isDragging && (
          <div className="absolute inset-0 z-50 bg-muted/95 flex items-center justify-center pointer-events-none">
            <div className="bg-background rounded-lg p-4 flex flex-col items-center gap-2 pointer-events-none">
              <Paperclip className="h-8 w-8 text-primary" />
              <p className="text-sm font-medium text-text">Drop files to attach</p>
            </div>
          </div>
        )}

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
        <div className="flex-1 flex flex-col relative min-h-0 overflow-hidden">
          <ScrollArea ref={scrollAreaRef} className="flex-1 overflow-hidden">
            <div role="log" aria-live="polite" aria-label="Chat messages" className="px-2 py-1.5">
              {messages.map((message, index) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  streamingMessageId={streamingMessageId}
                  resources={resources}
                  formatTimestamp={formatTimestamp}
                  _isLastMessage={index === messages.length - 1}
                  _onScrollToBottom={() =>
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
                  }
                  isStreaming={isStreaming}
                  activeMetadataTab={activeMetadataTab}
                  onMetadataToggle={(messageId, tab) =>
                    handleMetadataToggle(messageId, tab, index === messages.length - 1)
                  }
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
              {currentPermissionRequest && (
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
            onSendMessage={handleSendMessage}
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
