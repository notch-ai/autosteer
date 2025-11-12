/**
 * useChatMessages Hook
 * Provides access to chat messages for a specific agent
 */

import { useChatStore } from '@/stores';
import { ComputedMessage } from '@/stores/chat.selectors';

/**
 * Get messages for a specific agent (or active chat if no agentId provided)
 * @param agentId - Optional agent ID to get messages for
 * @returns Array of chat messages
 */
export function useChatMessages(agentId?: string): ComputedMessage[] {
  return useChatStore((state) => {
    if (agentId) {
      return state.getMessages(agentId);
    }
    return state.getCurrentMessages();
  });
}

/**
 * Get streaming state for a specific agent
 * @param agentId - Agent ID
 * @returns Whether the agent is currently streaming
 */
export function useIsStreaming(agentId?: string): boolean {
  return useChatStore((state) => {
    if (!agentId) {
      return state.activeChat ? state.isStreaming(state.activeChat) : false;
    }
    return state.isStreaming(agentId);
  });
}
