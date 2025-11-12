import { cn } from '@/commons/utils/ui/cn';
import { ChatInterface } from '@/features/chat/components/ChatInterface';
import { useAgentChatState, useChatMessageHandlers, useResourceAttachment } from '@/hooks';
import React, { useRef } from 'react';

interface AgentChatInterfaceProps {
  agentId: string;
  selectedAgentId: string | null;
  useMockPermission?: boolean;
  onRefReady?: (agentId: string, ref: { focus: () => void } | null) => void;
}

/**
 * Wrapper component for ChatInterface that properly subscribes to chat store changes
 * This ensures the component re-renders when messages are added/updated
 */
export const AgentChatInterface: React.FC<AgentChatInterfaceProps> = React.memo(
  ({ agentId, selectedAgentId, useMockPermission = false, onRefReady }) => {
    const chatInterfaceRef = useRef<{ focus: () => void } | null>(null);

    // Notify parent when ref is ready (after mount or update)
    React.useEffect(() => {
      if (onRefReady && chatInterfaceRef.current) {
        onRefReady(agentId, chatInterfaceRef.current);
      }
    }, [agentId, onRefReady]);

    // Custom hooks - all logic extracted
    const { messages, attachedResourceIds, isLoading } = useAgentChatState({
      agentId,
      useMockPermission,
    });

    const { handleSendMessage } = useChatMessageHandlers({ attachedResourceIds });

    const { handleAttachResources, handleRemoveResource } = useResourceAttachment();

    const isActive = selectedAgentId === agentId;

    return (
      <div
        className={cn('flex flex-col min-h-0 min-w-0 absolute inset-0', {
          // Z-index stacking: active tab on top (z-10), inactive below (z-0)
          // This preserves full rendering and scroll dimensions while controlling visibility
          'z-10': isActive,
          'z-0 pointer-events-none': !isActive,
        })}
        data-agent-id={agentId}
        data-active={isActive}
      >
        <ChatInterface
          ref={chatInterfaceRef}
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          attachedResourceIds={attachedResourceIds}
          onRemoveResource={handleRemoveResource}
          onAttachResources={handleAttachResources}
          isActive={isActive}
        />
      </div>
    );
  }
);

AgentChatInterface.displayName = 'AgentChatInterface';
