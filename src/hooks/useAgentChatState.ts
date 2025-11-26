import { mockPermissionChatMessage } from '@/mocks/gitDiffMockData';
import { useChatStore } from '@/stores';
import { useMemo } from 'react';

const EMPTY_ATTACHMENTS: any[] = [];

interface UseAgentChatStateParams {
  agentId: string;
  useMockPermission?: boolean;
}

export const useAgentChatState = ({
  agentId,
  useMockPermission = false,
}: UseAgentChatStateParams) => {
  // Get raw messages from store
  // Note: We get the raw Map entry, not a selector, to ensure stable reference
  const rawMessages = useChatStore((state) => state.messages.get(agentId) ?? []);

  const attachmentsAgent = useChatStore(
    (state) => state.attachments.get(agentId) ?? EMPTY_ATTACHMENTS
  );

  // Note: Synthetic messages are already filtered at the source (main process)
  // when loading from JSONL. See claude.handlers.ts
  const agentMessages = rawMessages;

  const messages = useMemo(() => {
    return useMockPermission ? [...agentMessages, mockPermissionChatMessage] : agentMessages;
  }, [agentMessages, useMockPermission]);

  const attachedResourceIds = useMemo(
    () => attachmentsAgent.map((att) => att.resourceId),
    [attachmentsAgent]
  );

  return {
    messages,
    attachedResourceIds,
    attachmentsAgent,
  };
};
