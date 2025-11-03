import { COMPACT_PROMPT } from '@/commons/constants/compactPrompt';
import { logger } from '@/commons/utils/logger';
import { cn } from '@/commons/utils';
import { useResourcesStore } from '@/stores/resources.store';
import { useChatStore, useAgentsStore, useProjectsStore, useUIStore } from '@/stores';
import { ModelOption } from '@/types/model.types';
import { DEFAULT_PERMISSION_MODE, PermissionMode } from '@/types/permission.types';
import { memo, useCallback, useState } from 'react';
import { RichTextEditor } from './RichTextEditor';
import { todoActivityMonitor } from '@/renderer/services/TodoActivityMonitor';

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
 * Isolated chat input component that manages its own state
 * This prevents re-rendering the entire ChatInterface on every keystroke
 */
export const ChatInput = memo<ChatInputProps>(
  ({
    onSendMessage,
    isLoading,
    attachedResourceIds,
    onRemoveResource,
    onAttachResources,
    isStreaming,
    selectedAgentId,
  }) => {
    const [inputValue, setInputValue] = useState('');
    const [permissionMode, setPermissionMode] = useState<PermissionMode>(DEFAULT_PERMISSION_MODE);

    // Get model from UI store
    const model = useUIStore((state) => state.selectedModel);
    const setModel = useUIStore((state) => state.setSelectedModel);

    // Core store subscriptions
    const resources = useResourcesStore((state) => state.resources);
    const clearChat = useChatStore((state) => state.clearChat);
    const stopStreaming = useChatStore((state) => state.stopStreaming);

    const isCompactingConversation = false; // TODO: Implement compacting state in CoreStore

    const handleSendMessage = useCallback(() => {
      if (inputValue.trim() && !isLoading) {
        // Extract plain text from HTML content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = inputValue;
        const plainText = tempDiv.textContent || tempDiv.innerText || '';

        if (plainText.trim()) {
          // Check if it's a built-in command
          const trimmedText = plainText.trim();
          if (trimmedText === '/clear') {
            logger.info('[Built-in Command] Intercepting /clear command');
            handleClearChat();
            setInputValue('');
            return;
          } else if (trimmedText === '/compact') {
            logger.info('[Built-in Command] Intercepting /compact command');
            handleCompactChat();
            setInputValue('');
            return;
          }

          // Not a built-in command, send normally
          try {
            onSendMessage(inputValue, { permissionMode, model });
            setInputValue('');
          } catch (error) {
            logger.error('[DEBUG] Error calling onSendMessage:', error);
          }
        }
      }
    }, [inputValue, isLoading, onSendMessage, permissionMode, model]);

    const handleSlashCommand = useCallback(
      (commandContent: string) => {
        // Send the slash command content as a message
        if (commandContent.trim()) {
          onSendMessage(commandContent, { permissionMode, model });
          setInputValue('');
        }
      },
      [onSendMessage, permissionMode, model]
    );

    const handleClearChat = useCallback(async () => {
      logger.info('[/clear command] Starting session clear process');

      // Clear the session for the current entry
      const selectedAgentId = useAgentsStore.getState().selectedAgentId;
      logger.info('[/clear command] Selected agent ID:', selectedAgentId);

      if (selectedAgentId) {
        try {
          // Call IPC to clear session for this entry
          await window.electron.ipcRenderer.invoke(
            'claude-code:clear-session-for-entry',
            selectedAgentId
          );
          logger.info('[/clear command] Session cleared successfully for agent:', selectedAgentId);
        } catch (error) {
          logger.error('[/clear command] Failed to clear session via IPC:', error);
        }

        // Clear local messages
        const state = useProjectsStore.getState();
        const projectId = state.selectedProjectId;
        if (projectId) {
          todoActivityMonitor.clearWorktree(projectId);
        }

        // Use the CoreStore's clearChat action
        clearChat(selectedAgentId);

        logger.info('[/clear command] Chat cleared and session reset');
      } else {
        logger.info('[/clear command] No agent selected, nothing to clear');
      }
    }, [clearChat]);

    const handleCompactChat = useCallback(async () => {
      logger.info('[/compact command] Starting compact process');

      const selectedAgentId = useAgentsStore.getState().selectedAgentId;
      logger.info('[/compact command] Selected agent ID:', selectedAgentId);

      if (selectedAgentId) {
        const state = useAgentsStore.getState();
        const agent = state.agents.get(selectedAgentId);
        if (agent) {
          // TODO: Implement compacting conversation functionality in CoreStore
          // For now, just send the compact prompt
          onSendMessage(COMPACT_PROMPT, { permissionMode, model });

          logger.info(
            '[/compact command] Sent compact prompt, awaiting result before clearing session'
          );
        }
      }
    }, [onSendMessage, permissionMode, model]);

    return (
      <div className="px-2 pb-2 pt-1 flex-shrink-0">
        <div
          className={cn(
            'transition-all duration-200',
            (isLoading && !isStreaming) || isCompactingConversation || !selectedAgentId
              ? 'opacity-60'
              : ''
          )}
        >
          <RichTextEditor
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSendMessage}
            placeholder={
              !selectedAgentId
                ? 'Select an agent to start chatting...'
                : 'Type to start building...'
            }
            disabled={(isLoading && !isStreaming) || isCompactingConversation || !selectedAgentId}
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
);

ChatInput.displayName = 'ChatInput';
