import { COMPACT_PROMPT } from '@/commons/constants/compactPrompt';
import { logger } from '@/commons/utils/logger';
import { todoActivityMonitor } from '@/renderer/services/TodoActivityMonitor';
import {
  useAgentsStore,
  useChatStore,
  useProjectsStore,
  useSettingsStore,
  useUIStore,
} from '@/stores';
import { ModelOption } from '@/types/model.types';
import { DEFAULT_PERMISSION_MODE, PermissionMode } from '@/types/permission.types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
 * - Per-session draft input persistence (auto-save on change)
 * - Per-session cursor position persistence (via callbacks)
 *
 * Architecture:
 * - Extracted from ChatInput.tsx for separation of concerns
 * - Integrates with useChatStore for message management
 * - Uses useAgentsStore for agent context
 * - Uses useProjectsStore for project context
 * - Uses useUIStore for model selection
 * - Automatically syncs draft state with chat store per agent session
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
 *   cursorPosition,
 *   handleCursorPositionChange,
 * } = useChatInputHandler({
 *   onSendMessage,
 *   isStreaming,
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
  isStreaming: boolean;
  selectedAgentId: string | null; // Legacy prop - now using activeChat from store
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
  cursorPosition: number | null;
  handleCursorPositionChange: (position: number) => void;
}

export const useChatInputHandler = ({
  onSendMessage,
  isStreaming: _isStreaming,
  selectedAgentId: _selectedAgentId,
}: UseChatInputHandlerProps): UseChatInputHandlerReturn => {
  // Core store subscriptions - must be called before useState
  const getDraftInput = useChatStore((state) => state.getDraftInput);
  const activeChat = useChatStore((state) => state.activeChat);
  const getSessionPermissionMode = useChatStore((state) => state.getSessionPermissionMode);
  const setSessionPermissionModeStore = useChatStore((state) => state.setSessionPermissionMode);
  const loadSessionSettings = useChatStore((state) => state.loadSessionSettings);

  // Get defaults from settings
  const defaultPermissionModeFromSettings = useSettingsStore(
    (state) => state.preferences.defaultPermissionMode || DEFAULT_PERMISSION_MODE
  );

  // Initialize message state with draft synchronously to avoid blank input on mount
  // Use activeChat (unique chat ID) instead of selectedAgentId for proper per-tab isolation
  const [message, setMessageState] = useState(() => {
    if (activeChat) {
      return getDraftInput(activeChat);
    }
    return '';
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize permission mode from session or settings
  const [permissionMode, setPermissionModeState] = useState<PermissionMode>(() => {
    if (activeChat) {
      const sessionMode = getSessionPermissionMode(activeChat);
      if (sessionMode) return sessionMode;
    }
    return defaultPermissionModeFromSettings;
  });

  // Load session settings when activeChat changes (ONLY activeChat, not settings)
  useEffect(() => {
    if (!activeChat) return;

    const loadSettings = async () => {
      // First, try to load from config.json (persisted settings)
      await loadSessionSettings(activeChat);

      // Then check if we have a session mode (from memory or just loaded)
      const sessionMode = getSessionPermissionMode(activeChat);

      if (sessionMode) {
        // Existing session - use saved mode
        setPermissionModeState(sessionMode);
        logger.debug('[useChatInputHandler] Loaded existing session permission mode', {
          activeChat,
          permissionMode: sessionMode,
        });
      } else {
        // New session - initialize with settings default
        const defaultMode =
          useSettingsStore.getState().preferences.defaultPermissionMode || DEFAULT_PERMISSION_MODE;
        setPermissionModeState(defaultMode);
        setSessionPermissionModeStore(activeChat, defaultMode);
        logger.debug(
          '[useChatInputHandler] Initialized new session with permission mode from settings',
          {
            activeChat,
            permissionMode: defaultMode,
          }
        );
      }
    };

    void loadSettings();
  }, [activeChat, getSessionPermissionMode, setSessionPermissionModeStore, loadSessionSettings]);

  // Use ref to track latest message value to avoid stale closure issues
  const messageRef = useRef(message);

  // Rest of store subscriptions
  const clearChat = useChatStore((state) => state.clearChat);
  const setDraftInput = useChatStore((state) => state.setDraftInput);
  const clearDraftInput = useChatStore((state) => state.clearDraftInput);
  const setDraftCursorPosition = useChatStore((state) => state.setDraftCursorPosition);
  const getDraftCursorPosition = useChatStore((state) => state.getDraftCursorPosition);
  const isStreaming = useChatStore((state) =>
    activeChat ? state.streamingStates.get(activeChat) || false : false
  );
  const cancelAndSend = useChatStore((state) => state.cancelAndSend);

  // Get model from UI store
  const model = useUIStore((state) => state.selectedModel);
  const setModel = useUIStore((state) => state.setSelectedModel);

  // Load draft input when active chat changes (for subsequent switches)
  // Use activeChat instead of selectedAgentId to ensure per-tab draft isolation
  useEffect(() => {
    if (activeChat) {
      const draft = getDraftInput(activeChat);
      setMessageState(draft);
      messageRef.current = draft;
    }
  }, [activeChat, getDraftInput]);

  // Get cursor position for current chat (use activeChat for proper per-tab isolation)
  const cursorPosition = activeChat ? getDraftCursorPosition(activeChat) : null;

  // Wrap setMessage to update both local state and draft store
  // Use activeChat instead of selectedAgentId for proper per-tab isolation
  const setMessage = useCallback(
    (msg: string) => {
      messageRef.current = msg;
      setMessageState(msg);

      // Auto-save draft to store using activeChat for proper per-tab isolation
      if (activeChat) {
        setDraftInput(activeChat, msg);
      }
    },
    [activeChat, setDraftInput]
  );

  // Handle cursor position changes
  // Use activeChat instead of selectedAgentId for proper per-tab isolation
  const handleCursorPositionChange = useCallback(
    (position: number) => {
      if (activeChat) {
        setDraftCursorPosition(activeChat, position);
      }
    },
    [activeChat, setDraftCursorPosition]
  );

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

        // Clear draft for current chat (use activeChat for proper per-tab isolation)
        if (activeChat) {
          clearDraftInput(activeChat);
        }
      }
    },
    [onSendMessage, permissionMode, model, activeChat, clearDraftInput]
  );

  /**
   * handleSubmit - Submit message to Claude
   *
   * Flow:
   * 1. Validate input (non-empty after HTML stripping)
   * 2. Check if it's a built-in command (/clear, /compact)
   * 3. Execute built-in command OR send to Claude (with silent cancellation if query active)
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

    if (!currentMessage.trim()) {
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
    messageRef.current = '';
    setMessageState('');
    setIsSubmitting(true);

    // Clear draft for current chat (use activeChat for proper per-tab isolation)
    if (activeChat) {
      clearDraftInput(activeChat);
    }

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

      // Use cancelAndSend if streaming is active (silent interruption)
      // Otherwise, use regular sendMessage
      if (isStreaming) {
        logger.debug(
          '[useChatInputHandler] Active stream detected, using cancelAndSend for silent interruption'
        );
        await cancelAndSend(messageToSend, undefined, undefined, { permissionMode, model });
      } else {
        onSendMessage(messageToSend, { permissionMode, model });
      }

      // Clear error only on successful submit
      setError(null);
      setIsSubmitting(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      logger.error('[useChatInputHandler] Error calling onSendMessage:', err);
      setError(errorMessage);
      setIsSubmitting(false);
    }
  }, [
    isStreaming,
    cancelAndSend,
    onSendMessage,
    permissionMode,
    model,
    handleClearChat,
    handleCompactChat,
    activeChat,
    clearDraftInput,
  ]);

  // Validate message (non-empty plain text) - memoized to update when message changes
  const isValid = useMemo(() => {
    if (!message.trim()) {
      return false;
    }

    // Extract plain text from HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = message;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';

    return plainText.trim().length > 0;
  }, [message]);

  // Wrap setPermissionMode to also save to chat store
  const setPermissionMode = useCallback(
    (mode: PermissionMode) => {
      setPermissionModeState(mode);
      if (activeChat) {
        setSessionPermissionModeStore(activeChat, mode);
        logger.debug('[useChatInputHandler] Permission mode changed', {
          activeChat,
          permissionMode: mode,
        });
      }
    },
    [activeChat, setSessionPermissionModeStore]
  );

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
    cursorPosition,
    handleCursorPositionChange,
  };
};
