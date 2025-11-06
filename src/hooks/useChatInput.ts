/**
 * useChatInput Hook - Draft Input State Access
 *
 * Provides read-only access to per-session draft input text state.
 * Manages draft text that persists when switching between agents/sessions.
 *
 * @example
 * const { draftInput, sessionId } = useChatInput();
 * const { draftInput: specificDraft } = useChatInput('agent-123');
 */

import { useChatStore } from '@/stores';

/**
 * Hook to access draft input state for a specific agent session
 *
 * @param agentId - Optional agent ID. If not provided, uses active chat.
 * @returns Draft input text and session ID
 */
export function useChatInput(agentId?: string) {
  const activeChat = useChatStore((state) => state.activeChat);
  const sessionId = agentId || activeChat;

  const draftInput = useChatStore((state) => (sessionId ? state.getDraftInput(sessionId) : ''));

  return {
    draftInput,
    sessionId,
  };
}
