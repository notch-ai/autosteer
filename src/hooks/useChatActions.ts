/**
 * useChatActions Hook
 * Provides access to chat actions (send, clear, stop, etc.)
 */

import { useChatStore } from '@/stores';
import { useCallback } from 'react';

export function useChatActions() {
  const sendMessage = useChatStore((state) => state.sendMessage);
  const clearChat = useChatStore((state) => state.clearChat);
  const stopStreaming = useChatStore((state) => state.stopStreaming);
  const loadChatHistory = useChatStore((state) => state.loadChatHistory);
  const setDraftInput = useChatStore((state) => state.setDraftInput);
  const clearDraftInput = useChatStore((state) => state.clearDraftInput);
  const setDraftCursorPosition = useChatStore((state) => state.setDraftCursorPosition);

  return {
    sendMessage: useCallback(sendMessage, [sendMessage]),
    clearChat: useCallback(clearChat, [clearChat]),
    stopStreaming: useCallback(stopStreaming, [stopStreaming]),
    loadChatHistory: useCallback(loadChatHistory, [loadChatHistory]),
    setDraftInput: useCallback(setDraftInput, [setDraftInput]),
    clearDraftInput: useCallback(clearDraftInput, [clearDraftInput]),
    setDraftCursorPosition: useCallback(setDraftCursorPosition, [setDraftCursorPosition]),
  };
}
