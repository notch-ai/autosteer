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

  return {
    sendMessage: useCallback(sendMessage, [sendMessage]),
    clearChat: useCallback(clearChat, [clearChat]),
    stopStreaming: useCallback(stopStreaming, [stopStreaming]),
    loadChatHistory: useCallback(loadChatHistory, [loadChatHistory]),
  };
}
