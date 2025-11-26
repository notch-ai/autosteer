import { cn } from '@/commons/utils';
import { useChatInputHandler } from '@/hooks/useChatInputHandler';
import { useChatStore, useResourcesStore } from '@/stores';
import { ModelOption } from '@/types/model.types';
import { DEFAULT_PERMISSION_MODE, PermissionMode } from '@/types/permission.types';
import { forwardRef, memo, useImperativeHandle, useRef } from 'react';
import { RichTextEditor } from './RichTextEditor';

/**
 * Imperative handle interface for ChatInput
 * Allows parent components to programmatically control the input
 */
export interface ChatInputHandle {
  /**
   * Focus the chat input editor
   * Used for restoring focus after operations like stream cancellation
   * Implementation: Focuses the CodeMirror editor within the component's container
   * Safety: Uses preventScroll to avoid interfering with scroll position restoration
   */
  focus: () => void;

  /**
   * Reset the input state
   * Clears message content, permission mode, and model selection
   */
  reset: () => void;
}

interface ChatInputProps {
  onSendMessage: (
    content: string,
    options?: { permissionMode?: PermissionMode; model?: ModelOption }
  ) => void;
  attachedResourceIds: string[];
  onRemoveResource: (resourceId: string) => void;
  onAttachResources?: (resourceIds: string[]) => void;
  isStreaming: boolean;
  selectedAgentId: string | null;
  onStopStreaming?: (options?: { focusCallback?: () => void; silentCancel?: boolean }) => void;
}

/**
 *
 * Renders chat input UI and delegates all business logic to useChatInputHandler.
 *
 * Responsibilities:
 * - Render RichTextEditor with proper props
 * - Display loading/disabled states
 * - Handle visual styling based on state
 * - Expose focus method via ref for programmatic focus
 *
 * Business Logic (delegated to handler):
 * - Command parsing
 * - Input validation
 * - Message submission
 * - Built-in command execution
 * - Error handling
 *
 * @see useChatInputHandler for business logic
 */
export const ChatInput = memo(
  forwardRef<ChatInputHandle, ChatInputProps>(
    (
      {
        onSendMessage,
        attachedResourceIds,
        onRemoveResource,
        onAttachResources,
        isStreaming,
        selectedAgentId,
        onStopStreaming,
      },
      ref
    ) => {
      const resources = useResourcesStore((state) => state.resources);
      const stopStreamingFromStore = useChatStore((state) => state.stopStreaming);
      const stopStreaming = onStopStreaming || stopStreamingFromStore;
      const containerRef = useRef<HTMLDivElement>(null);

      // Delegate all business logic to handler
      const {
        message,
        setMessage,
        permissionMode,
        setPermissionMode,
        model,
        setModel,
        handleSubmit,
        handleSlashCommand,
        cursorPosition,
        handleCursorPositionChange,
      } = useChatInputHandler({
        onSendMessage,
        isStreaming,
        selectedAgentId,
      });

      const isCompactingConversation = false; // TODO: Implement compacting state in CoreStore
      const isDisabled = isCompactingConversation || !selectedAgentId;

      // Expose focus and reset methods to parent
      useImperativeHandle(
        ref,
        () => ({
          focus: () => {
            // Focus the CodeMirror editor within THIS component's container
            // IMPORTANT: Scope to containerRef to avoid focusing wrong agent's editor
            // IMPORTANT: Use preventScroll to avoid interfering with scroll position restoration
            const container = containerRef.current;
            if (!container) {
              console.warn('❌ [CHAT INPUT FOCUS] Container ref not available');
              return;
            }

            const cmEditor = container.querySelector('.cm-editor .cm-content') as HTMLElement;
            if (cmEditor) {
              cmEditor.focus({ preventScroll: true });
            } else {
              console.warn('❌ [CHAT INPUT FOCUS] CodeMirror editor not found in container', {
                agentId: selectedAgentId,
              });
            }
          },
          reset: () => {
            // Clear the message input
            setMessage('');
            // Reset permission mode to default
            setPermissionMode(DEFAULT_PERMISSION_MODE);
            // Reset model (null means use settings default)
            setModel(null as any);
          },
        }),
        [selectedAgentId]
      );

      return (
        <div ref={containerRef} className="px-2 pb-2 pt-1 flex-shrink-0">
          <div className={cn('transition-all duration-200', isDisabled ? 'opacity-60' : '')}>
            <RichTextEditor
              value={message}
              onChange={setMessage}
              onSend={handleSubmit}
              placeholder={
                !selectedAgentId
                  ? 'Select an agent to start chatting...'
                  : 'Type to start building...'
              }
              disabled={isDisabled}
              attachedResourceIds={attachedResourceIds}
              onRemoveResource={onRemoveResource}
              {...(onAttachResources && { onAttachResources })}
              onSlashCommand={handleSlashCommand}
              isStreaming={isStreaming}
              onStopStreaming={stopStreaming}
              permissionMode={permissionMode}
              onPermissionModeChange={setPermissionMode}
              model={model}
              onModelChange={setModel}
              resources={resources}
              initialCursorPosition={cursorPosition}
              onCursorPositionChange={handleCursorPositionChange}
            />
          </div>
        </div>
      );
    }
  )
);

ChatInput.displayName = 'ChatInput';
