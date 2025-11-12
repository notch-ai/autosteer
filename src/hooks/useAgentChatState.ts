import { ComputedMessage } from '@/stores/chat.selectors';
import { mockPermissionChatMessage } from '@/mocks/gitDiffMockData';
import { useChatStore } from '@/stores';
import { useMemo } from 'react';

const EMPTY_MESSAGES: ComputedMessage[] = [];
const EMPTY_ATTACHMENTS: any[] = [];

interface UseAgentChatStateParams {
  agentId: string;
  useMockPermission?: boolean;
}

export const useAgentChatState = ({
  agentId,
  useMockPermission = false,
}: UseAgentChatStateParams) => {
  const agentMessages = useChatStore((state) => state.messages.get(agentId) ?? EMPTY_MESSAGES);
  const isStreamingAgent = useChatStore((state) => state.streamingStates.get(agentId) ?? false);
  const chatError = useChatStore((state) => state.chatError);
  const attachmentsAgent = useChatStore(
    (state) => state.attachments.get(agentId) ?? EMPTY_ATTACHMENTS
  );

  const messages = useMemo(() => {
    return useMockPermission ? [...agentMessages, mockPermissionChatMessage] : agentMessages;
  }, [agentMessages, useMockPermission]);

  const attachedResourceIds = useMemo(
    () => attachmentsAgent.map((att) => att.resourceId),
    [attachmentsAgent]
  );

  const isLoading = useMemo(() => isStreamingAgent || !!chatError, [isStreamingAgent, chatError]);

  return {
    messages,
    attachedResourceIds,
    isLoading,
    attachmentsAgent,
  };
};
