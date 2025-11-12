import { CHANGES_TAB_ID, TERMINAL_TAB_ID } from '@/constants/tabs';
import { GlobalChatRefs } from '@/commons/utils/globalChatRefs';
import type { ChatInterfaceRef } from '@/commons/utils/globalChatRefs';
import { useCallback } from 'react';

export type { ChatInterfaceRef };

export interface UseChatInputFocusParams {
  selectedAgentId: string | null;
  chatInterfaceRefs: React.MutableRefObject<Map<string, ChatInterfaceRef | null>>;
}

export interface UseChatInputFocusReturn {
  handleMainContentClick: (e: React.MouseEvent) => void;
  handleRefReady: (agentId: string, ref: ChatInterfaceRef | null) => void;
  focusChatInput: () => void;
}

export function useChatInputFocus({
  selectedAgentId,
  chatInterfaceRefs,
}: UseChatInputFocusParams): UseChatInputFocusReturn {
  // Callback to focus the chat input
  const focusChatInput = useCallback(() => {
    if (
      selectedAgentId &&
      selectedAgentId !== TERMINAL_TAB_ID &&
      selectedAgentId !== CHANGES_TAB_ID &&
      chatInterfaceRefs.current.has(selectedAgentId)
    ) {
      const ref = chatInterfaceRefs.current.get(selectedAgentId);
      if (ref) {
        ref.focus();
      }
    }
  }, [selectedAgentId, chatInterfaceRefs]);

  // Handle clicks on main content area
  const handleMainContentClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;

      // Ignore clicks on buttons, inputs, textareas, tabs
      if (
        target.closest('button') ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('[role="tab"]') ||
        target.closest('[role="tablist"]')
      ) {
        return;
      }

      // Check if click is within chat area (messages or input)
      const isClickInChatArea = !!(
        target.closest('.editor-content') ||
        target.closest('.markdown-content') ||
        target.closest('[role="log"]') ||
        target.closest('[aria-label="Chat messages"]')
      );

      // Focus input only if click is OUTSIDE chat area
      if (!isClickInChatArea) {
        focusChatInput();
      }
    },
    [focusChatInput]
  );

  // Callback to register chat interface refs
  // Also registers in global registry for keyboard shortcuts
  const handleRefReady = useCallback(
    (agentId: string, ref: ChatInterfaceRef | null) => {
      chatInterfaceRefs.current.set(agentId, ref);
      // Register in global registry for keyboard shortcuts
      GlobalChatRefs.set(agentId, ref);
    },
    [chatInterfaceRefs]
  );

  return {
    handleMainContentClick,
    handleRefReady,
    focusChatInput,
  };
}
