/**
 * useAgents Hook - Agent State Access
 *
 * Provides convenient access to agent state and selectors from the agents store
 * Part of the agents.store.ts extraction
 *
 * @example
 * ```tsx
 * const { agents, selectedAgentId, selectedAgent, agentsLoading } = useAgents();
 *
 * if (agentsLoading) return <Loading />;
 *
 * return (
 *   <div>
 *     <h2>{selectedAgent?.title}</h2>
 *     <AgentList agents={agents} />
 *   </div>
 * );
 * ```
 */

import { Agent } from '@/entities';
import { useAgentsStore } from '@/stores';

export interface UseAgentsReturn {
  // State
  agents: Map<string, Agent>;
  selectedAgentId: string | null;
  agentsLoading: boolean;
  agentsError: string | null;

  // Computed/Selectors
  selectedAgent: Agent | null;
  agentsList: Agent[]; // Convenience: agents as array
}

/**
 * Hook to access agent state and selectors
 * @returns Agent state, loading status, and computed values
 */
export function useAgents(): UseAgentsReturn {
  const agents = useAgentsStore((state) => state.agents);
  const selectedAgentId = useAgentsStore((state) => state.selectedAgentId);
  const agentsLoading = useAgentsStore((state) => state.agentsLoading);
  const agentsError = useAgentsStore((state) => state.agentsError);
  const getSelectedAgent = useAgentsStore((state) => state.getSelectedAgent);

  // Computed values
  const selectedAgent = getSelectedAgent();
  const agentsList = Array.from(agents.values());

  return {
    agents,
    selectedAgentId,
    agentsLoading,
    agentsError,
    selectedAgent,
    agentsList,
  };
}

/**
 * Hook to get a specific agent by ID
 * @param id - Agent ID
 * @returns Agent object or null if not found
 *
 * @example
 * ```tsx
 * const agent = useAgent(agentId);
 * if (!agent) return <NotFound />;
 * return <AgentDetail agent={agent} />;
 * ```
 */
export function useAgent(id: string | undefined): Agent | null {
  const getAgent = useAgentsStore((state) => state.getAgent);

  if (!id) return null;
  return getAgent(id);
}

/**
 * Hook to get the selected agent
 * @returns Selected agent or null
 *
 * @example
 * ```tsx
 * const selectedAgent = useSelectedAgent();
 * return selectedAgent ? <AgentView agent={selectedAgent} /> : <EmptyState />;
 * ```
 */
export function useSelectedAgent(): Agent | null {
  const getSelectedAgent = useAgentsStore((state) => state.getSelectedAgent);
  return getSelectedAgent();
}

/**
 * Hook to get loading and error state
 * @returns Loading and error state for agents
 *
 * @example
 * ```tsx
 * const { agentsLoading, agentsError } = useAgentsLoadingState();
 * if (agentsError) return <Error message={agentsError} />;
 * if (agentsLoading) return <Spinner />;
 * ```
 */
export function useAgentsLoadingState() {
  const agentsLoading = useAgentsStore((state) => state.agentsLoading);
  const agentsError = useAgentsStore((state) => state.agentsError);

  return {
    agentsLoading,
    agentsError,
  };
}
