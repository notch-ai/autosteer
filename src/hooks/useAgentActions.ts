/**
 * useAgentActions Hook - Agent CRUD Operations
 *
 * Provides convenient access to agent actions from the agents store
 * Part of the agents.store.ts extraction
 *
 * @example
 * ```tsx
 * const { createAgent, updateAgent, deleteAgent, selectAgent } = useAgentActions();
 *
 * const handleCreate = async () => {
 *   const newAgent = await createAgent({
 *     title: 'New Agent',
 *     content: 'Content',
 *     type: AgentType.TEXT,
 *   });
 *   selectAgent(newAgent.id);
 * };
 * ```
 */

import { Agent } from '@/entities';
import { useAgentsStore } from '@/stores';
import { AgentConfig } from '@/stores/types';
import { useCallback } from 'react';

export interface UseAgentActionsReturn {
  // CRUD Operations
  loadAgents: () => Promise<void>;
  createAgent: (config: AgentConfig) => Promise<Agent>;
  updateAgent: (id: string, updates: Partial<Agent>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;

  // Selection
  selectAgent: (id: string | null) => void;
}

/**
 * Hook to access agent CRUD operations and selection actions
 * @returns Agent action functions (memoized with useCallback)
 */
export function useAgentActions(): UseAgentActionsReturn {
  const loadAgents = useAgentsStore((state) => state.loadAgents);
  const createAgentAction = useAgentsStore((state) => state.createAgent);
  const updateAgentAction = useAgentsStore((state) => state.updateAgent);
  const deleteAgentAction = useAgentsStore((state) => state.deleteAgent);
  const selectAgentAction = useAgentsStore((state) => state.selectAgent);

  // Memoize actions to prevent unnecessary re-renders
  const createAgent = useCallback(
    async (config: AgentConfig) => {
      return await createAgentAction(config);
    },
    [createAgentAction]
  );

  const updateAgent = useCallback(
    async (id: string, updates: Partial<Agent>) => {
      return await updateAgentAction(id, updates);
    },
    [updateAgentAction]
  );

  const deleteAgent = useCallback(
    async (id: string) => {
      return await deleteAgentAction(id);
    },
    [deleteAgentAction]
  );

  const selectAgent = useCallback(
    (id: string | null) => {
      selectAgentAction(id);
    },
    [selectAgentAction]
  );

  return {
    loadAgents,
    createAgent,
    updateAgent,
    deleteAgent,
    selectAgent,
  };
}

/**
 * Hook to load agents on component mount
 * Useful for components that need to ensure agents are loaded
 *
 * @example
 * ```tsx
 * function AgentsList() {
 *   useLoadAgents();
 *   const { agentsList, agentsLoading } = useAgents();
 *
 *   if (agentsLoading) return <Loading />;
 *   return <List agents={agentsList} />;
 * }
 * ```
 */
export function useLoadAgents() {
  const loadAgents = useAgentsStore((state) => state.loadAgents);

  // Load agents on mount
  React.useEffect(() => {
    loadAgents();
  }, [loadAgents]);
}

// Re-export React for convenience
import React from 'react';
