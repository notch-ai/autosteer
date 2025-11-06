import { cn } from '@/commons/utils';
import { useChatInputHandler } from '@/hooks/useChatInputHandler';
import { useChatStore, useResourcesStore } from '@/stores';
import { ModelOption } from '@/types/model.types';
import { PermissionMode } from '@/types/permission.types';
import { forwardRef, memo, useImperativeHandle } from 'react';
import { RichTextEditor } from './RichTextEditor';

export interface ChatInputHandle {
  focus: () => void;
}

interface ChatInputProps {
  onSendMessage: (
    content: string,
    options?: { permissionMode?: PermissionMode; model?: ModelOption }
  ) => void;
  isLoading: boolean;
  attachedResourceIds: string[];
  onRemoveResource: (resourceId: string) => void;
  onAttachResources?: (resourceIds: string[]) => void;
  isStreaming: boolean;
  selectedAgentId: string | null;
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
        isLoading,
        attachedResourceIds,
        onRemoveResource,
        onAttachResources,
        isStreaming,
        selectedAgentId,
      },
      ref
    ) => {
      const resources = useResourcesStore((state) => state.resources);
      const stopStreaming = useChatStore((state) => state.stopStreaming);

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
      } = useChatInputHandler({
        onSendMessage,
        isLoading,
      });

      const isCompactingConversation = false; // TODO: Implement compacting state in CoreStore
      const isDisabled =
        (isLoading && !isStreaming) || isCompactingConversation || !selectedAgentId;

      // Expose focus method to parent
      useImperativeHandle(ref, () => ({
        focus: () => {
          // Focus the CodeMirror editor
          const cmEditor = document.querySelector('.cm-editor .cm-content') as HTMLElement;
          if (cmEditor) {
            cmEditor.focus();
          }
        },
      }));

      return (
        <div className="px-2 pb-2 pt-1 flex-shrink-0">
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
            />
          </div>
        </div>
      );
    }
  )
);

ChatInput.displayName = 'ChatInput';
