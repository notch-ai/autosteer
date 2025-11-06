import { COMPACT_PROMPT } from '@/commons/constants/compactPrompt';
import { logger } from '@/commons/utils/logger';
import { todoActivityMonitor } from '@/renderer/services/TodoActivityMonitor';
import { useAgentsStore, useChatStore, useProjectsStore, useUIStore } from '@/stores';
import { ModelOption } from '@/types/model.types';
import { DEFAULT_PERMISSION_MODE, PermissionMode } from '@/types/permission.types';
import { useCallback, useRef, useState } from 'react';

/**
 *
 * Business logic handler for chat input component operations.
 *
 * Key Features:
 * - Command parsing (slash commands: /clear, /compact, custom commands)
 * - Input validation (non-empty, HTML to plain text conversion)
 * - Message submission to Claude SDK
 * - Chat store updates (clear, compact workflows)
 * - Error state management
 * - Loading state management
 * - Permission mode and model selection
 *
 * Architecture:
 * - Extracted from ChatInput.tsx for separation of concerns
 * - Integrates with useChatStore for message management
 * - Uses useAgentsStore for agent context
 * - Uses useProjectsStore for project context
 * - Uses useUIStore for model selection
 *
 * Usage:
 * ```tsx
 * const {
 *   message,
 *   setMessage,
 *   isValid,
 *   isSubmitting,
 *   error,
 *   permissionMode,
 *   setPermissionMode,
 *   model,
 *   setModel,
 *   handleSubmit,
 *   handleCommandParse,
 * } = useChatInputHandler({
 *   onSendMessage,
 *   isLoading,
 *   selectedAgentId,
 * });
 * ```
 *
 * @see docs/guides-architecture.md Handler Pattern
 */

export interface UseChatInputHandlerProps {
  onSendMessage: (
    content: string,
    options?: { permissionMode?: PermissionMode; model?: ModelOption }
  ) => void;
  isLoading: boolean;
}

export interface UseChatInputHandlerReturn {
  message: string;
  setMessage: (msg: string) => void;
  isValid: boolean;
  isSubmitting: boolean;
  error: string | null;
  permissionMode: PermissionMode;
  setPermissionMode: (mode: PermissionMode) => void;
  model: ModelOption;
  setModel: (model: ModelOption) => void;
  handleSubmit: () => Promise<void>;
  handleCommandParse: (input: string) => {
    isCommand: boolean;
    command?: string;
    args?: string;
  };
  handleSlashCommand: (commandContent: string) => void;
}

export const useChatInputHandler = ({
  onSendMessage,
  isLoading,
}: UseChatInputHandlerProps): UseChatInputHandlerReturn => {
  const [message, setMessageState] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(DEFAULT_PERMISSION_MODE);

  // Use ref to track latest message value to avoid stale closure issues
  const messageRef = useRef(message);

  // Wrap setMessage to update ref synchronously
  const setMessage = useCallback((msg: string) => {
    messageRef.current = msg;
    setMessageState(msg);
  }, []);

  // Get model from UI store
  const model = useUIStore((state) => state.selectedModel);
  const setModel = useUIStore((state) => state.setSelectedModel);

  // Core store subscriptions
  const clearChat = useChatStore((state) => state.clearChat);

  /**
   * handleCommandParse - Parse slash command from user input
   *
   * Detects slash commands like /clear, /compact, /commit, /pr, etc.
   *
   * @param input - User input string
   * @returns Object with isCommand flag, command name, and args
   */
  const handleCommandParse = useCallback(
    (input: string): { isCommand: boolean; command?: string; args?: string } => {
      const trimmed = input.trim();

      // Check if it starts with slash
      if (!trimmed.startsWith('/')) {
        return { isCommand: false };
      }

      // Parse command and args
      const spaceIndex = trimmed.indexOf(' ');
      if (spaceIndex === -1) {
        // No args, entire string is command
        return {
          isCommand: true,
          command: trimmed.substring(1),
          args: '',
        };
      }

      // Split into command and args
      const command = trimmed.substring(1, spaceIndex);
      const args = trimmed.substring(spaceIndex + 1);

      return {
        isCommand: true,
        command,
        args,
      };
    },
    []
  );

  /**
   * handleClearChat - Clear chat messages and session
   *
   * Flow:
   * 1. Get selected agent ID
   * 2. Clear session via IPC
   * 3. Clear todo activity monitor
   * 4. Clear chat store messages
   *
   * Error Cases:
   * - No agent selected (logs and returns)
   * - IPC failure (logs error but continues)
   */
  const handleClearChat = useCallback(async () => {
    logger.info('[/clear command] Starting session clear process');

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

  /**
   * handleCompactChat - Compact conversation using Claude
   *
   * Flow:
   * 1. Get selected agent ID
   * 2. Send COMPACT_PROMPT to Claude
   * 3. Wait for compaction result
   *
   * Error Cases:
   * - No agent selected (logs and returns)
   * - Send message failure (handled by onSendMessage)
   */
  const handleCompactChat = useCallback(async () => {
    logger.info('[/compact command] Starting compact process');

    const selectedAgentId = useAgentsStore.getState().selectedAgentId;
    logger.info('[/compact command] Selected agent ID:', selectedAgentId);

    if (selectedAgentId) {
      const state = useAgentsStore.getState();
      const agent = state.agents.get(selectedAgentId);
      if (agent) {
        // Send the compact prompt
        onSendMessage(COMPACT_PROMPT, { permissionMode, model });

        logger.info(
          '[/compact command] Sent compact prompt, awaiting result before clearing session'
        );
      }
    }
  }, [onSendMessage, permissionMode, model]);

  /**
   * handleSlashCommand - Handle custom slash commands
   *
   * Sends the slash command content as a message to Claude.
   *
   * @param commandContent - Command string to send
   */
  const handleSlashCommand = useCallback(
    (commandContent: string) => {
      // Send the slash command content as a message
      if (commandContent.trim()) {
        onSendMessage(commandContent, { permissionMode, model });
        setMessage('');
      }
    },
    [onSendMessage, permissionMode, model]
  );

  /**
   * handleSubmit - Submit message to Claude
   *
   * Flow:
   * 1. Validate input (non-empty after HTML stripping)
   * 2. Check if it's a built-in command (/clear, /compact)
   * 3. Execute built-in command OR send to Claude
   * 4. Clear input on success
   *
   * Error Cases:
   * - Empty message (no-op)
   * - Loading state (no-op)
   * - Send message failure (logged)
   */
  const handleSubmit = useCallback(async () => {
    // Read latest message from ref to avoid stale closure issues
    const currentMessage = messageRef.current;

    if (!currentMessage.trim() || isLoading) {
      return;
    }

    // Extract plain text from HTML content early
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = currentMessage;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';

    if (!plainText.trim()) {
      return;
    }

    // Capture message and clear immediately to prevent rapid submit issues
    const messageToSend = currentMessage;
    setMessage('');
    setIsSubmitting(true);

    try {
      // Check if it's a built-in command
      const trimmedText = plainText.trim();
      if (trimmedText === '/clear') {
        logger.info('[Built-in Command] Intercepting /clear command');
        await handleClearChat();
        setIsSubmitting(false);
        setError(null);
        return;
      } else if (trimmedText === '/compact') {
        logger.info('[Built-in Command] Intercepting /compact command');
        await handleCompactChat();
        setIsSubmitting(false);
        setError(null);
        return;
      }

      // Not a built-in command, send normally
      onSendMessage(messageToSend, { permissionMode, model });

      // Clear error only on successful submit
      setError(null);
      setIsSubmitting(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      logger.error('[useChatInputHandler] Error calling onSendMessage:', err);
      setError(errorMessage);
      setIsSubmitting(false);
    }
  }, [isLoading, onSendMessage, permissionMode, model, handleClearChat, handleCompactChat]);

  // Validate message (non-empty plain text)
  const isValid = useCallback(() => {
    if (!message.trim()) {
      return false;
    }

    // Extract plain text from HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = message;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';

    return plainText.trim().length > 0;
  }, [message])();

  return {
    message,
    setMessage,
    isValid,
    isSubmitting,
    error,
    permissionMode,
    setPermissionMode,
    model,
    setModel,
    handleSubmit,
    handleCommandParse,
    handleSlashCommand,
  };
};
