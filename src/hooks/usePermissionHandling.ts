import { useCallback, useState } from 'react';
import { ComputedMessage } from '@/stores/chat.selectors';
import { PermissionRequest } from '@/stores/types';
import { logger } from '@/commons/utils/logger';
import { useChatStore } from '@/stores';

/**
 * Parameters for the permission handling hook
 */
export interface UsePermissionHandlingParams {
  /** Active chat ID */
  activeChat: string | null;
  /** Current permission request being displayed */
  currentPermissionRequest: PermissionRequest | null;
  /** Function to send messages to the chat */
  sendMessage: (
    content: string,
    agentId: string | undefined,
    attachedResourceIds: string[],
    options?: { permissionMode?: string }
  ) => Promise<void>;
}

/**
 * Return type for the permission handling hook
 */
export interface UsePermissionHandlingReturn {
  /** Whether the permission dialog is visible */
  showPermissionDialog: boolean;
  /** Set permission dialog visibility */
  setShowPermissionDialog: (show: boolean) => void;
  /** Handle permission approval */
  handlePermissionApprove: () => Promise<void>;
  /** Handle permission rejection */
  handlePermissionReject: () => void;
}

/**
 * usePermissionHandling Hook
 *
 * Encapsulates permission request flow logic for ChatInterface.
 *
 * Key Features:
 * - State management for permission dialog visibility
 * - Permission approval flow with action message creation
 * - Permission rejection flow with action message creation
 * - Streaming state cleanup on approval/rejection
 * - Comprehensive error logging
 * - Stable callback references with useCallback
 *
 * Architecture:
 * - React hook pattern
 * - Directly updates chat store state
 * - Creates permission action messages for UI display
 * - Continues conversation after approval with bypass mode
 *
 * Usage:
 * ```tsx
 * const {
 *   showPermissionDialog,
 *   setShowPermissionDialog,
 *   handlePermissionApprove,
 *   handlePermissionReject
 * } = usePermissionHandling({
 *   activeChat,
 *   currentPermissionRequest,
 *   sendMessage
 * });
 *
 * // Show permission dialog
 * setShowPermissionDialog(true);
 *
 * // Handle approval
 * await handlePermissionApprove();
 *
 * // Handle rejection
 * handlePermissionReject();
 * ```
 *
 * @param params - Configuration parameters
 * @returns Permission handling operations and state
 */
export const usePermissionHandling = ({
  activeChat,
  currentPermissionRequest,
  sendMessage,
}: UsePermissionHandlingParams): UsePermissionHandlingReturn => {
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);

  /**
   * Handle permission approval
   *
   * Creates a permission action message showing the accepted change,
   * clears streaming state, and continues conversation with bypass mode.
   */
  const handlePermissionApprove = useCallback(async () => {
    logger.debug('[usePermissionHandling] Permission approved', {
      activeChat,
      hasPermissionRequest: !!currentPermissionRequest,
    });

    setShowPermissionDialog(false);

    if (activeChat && currentPermissionRequest) {
      const chatId = activeChat;

      try {
        // Add a permission action message to show the accepted change
        const permissionActionMessage: ComputedMessage = {
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

        logger.debug('[usePermissionHandling] Permission action message added', {
          chatId,
          messageId: permissionActionMessage.id,
        });

        // Continue with the approved changes
        await sendMessage('Continue with the approved changes.', undefined, [], {
          permissionMode: 'bypassPermissions',
        });

        logger.debug('[usePermissionHandling] Continuation message sent', { chatId });
      } catch (error) {
        logger.error('[usePermissionHandling] Failed to handle permission approval', {
          chatId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }
  }, [activeChat, currentPermissionRequest, sendMessage]);

  /**
   * Handle permission rejection
   *
   * Creates a permission action message showing the rejected change
   * and clears streaming state.
   */
  const handlePermissionReject = useCallback(() => {
    logger.debug('[usePermissionHandling] Permission rejected', {
      activeChat,
      hasPermissionRequest: !!currentPermissionRequest,
    });

    setShowPermissionDialog(false);

    if (activeChat && currentPermissionRequest) {
      const chatId = activeChat;

      try {
        // Add a permission action message to show the rejected change
        const permissionActionMessage: ComputedMessage = {
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

        logger.debug('[usePermissionHandling] Permission rejection message added', {
          chatId,
          messageId: permissionActionMessage.id,
        });
      } catch (error) {
        logger.error('[usePermissionHandling] Failed to handle permission rejection', {
          chatId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }
  }, [activeChat, currentPermissionRequest]);

  return {
    showPermissionDialog,
    setShowPermissionDialog,
    handlePermissionApprove,
    handlePermissionReject,
  };
};
