import { useCallback } from 'react';
import { Video, Music } from 'lucide-react';
import { Agent, AgentType } from '@/entities';

export const useAgentContentRenderer = (selectedAgent: Agent | null) => {
  const renderContentByType = useCallback((): JSX.Element | null => {
    if (!selectedAgent) {
      return <p>No agent selected</p>;
    }

    switch (selectedAgent.type) {
      case AgentType.CODE:
        return (
          <pre>
            <code>{selectedAgent.content}</code>
          </pre>
        );

      case AgentType.IMAGE:
        return <img src={selectedAgent.content} alt={selectedAgent.title} />;

      case AgentType.VIDEO:
        return (
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            <span>{selectedAgent.content}</span>
            <span>Media Player</span>
          </div>
        );

      case AgentType.AUDIO:
        return (
          <div className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            <span>{selectedAgent.content}</span>
            <span>Media Player</span>
          </div>
        );

      default:
        return <p>{selectedAgent.content}</p>;
    }
  }, [selectedAgent]);

  return { renderContentByType };
};
