import { useChatStore } from '@/stores';
import { detachResourceFromChat } from '@/stores/resources.store';
import { useCallback } from 'react';

interface UseChatMessageHandlersParams {
  attachedResourceIds: string[];
}

export const useChatMessageHandlers = ({ attachedResourceIds }: UseChatMessageHandlersParams) => {
  const sendMessage = useChatStore((state) => state.sendMessage);

  const handleSendMessage = useCallback(
    async (content: string, options?: any) => {
      await sendMessage(content, undefined, attachedResourceIds, options);
      if (attachedResourceIds.length > 0) {
        attachedResourceIds.forEach((id) => detachResourceFromChat(id));
      }
    },
    [sendMessage, attachedResourceIds]
  );

  return {
    handleSendMessage,
  };
};
