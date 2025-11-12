import { useMemo } from 'react';
import { Agent } from '@/entities';

interface UseMainContentStateParams {
  selectedAgentId: string | null;
  selectedProjectId: string | null;
  agents: Map<string, Agent>;
}

interface UseMainContentStateReturn {
  selectedAgent: Agent | null;
  showTodosPanel: boolean;
  shouldShowEmpty: boolean;
}

/**
 * useMainContentState - Derives main content display state from selection context
 *
 * Computes derived state for the main content area based on selected agent and project.
 * Handles display logic for todos panel and empty states.
 *
 * Key Features:
 * - Agent lookup from agents map
 * - Todos panel visibility logic (project selected + not terminal/changes tabs)
 * - Empty state determination (no project or no agent for non-terminal/changes tabs)
 *
 * @param params - Selection context parameters
 * @returns Derived display state for main content
 */
export const useMainContentState = ({
  selectedAgentId,
  selectedProjectId,
  agents,
}: UseMainContentStateParams): UseMainContentStateReturn => {
  const selectedAgent = useMemo(
    () => (selectedAgentId ? (agents.get(selectedAgentId) ?? null) : null),
    [selectedAgentId, agents]
  );

  const showTodosPanel = useMemo(() => {
    if (!selectedProjectId) return false;

    const isTerminalOrChangesTab =
      selectedAgentId === 'terminal-tab' || selectedAgentId === 'changes-tab';

    return !isTerminalOrChangesTab;
  }, [selectedProjectId, selectedAgentId]);

  const shouldShowEmpty = useMemo(() => {
    if (!selectedProjectId) return true;

    const isTerminalOrChangesTab =
      selectedAgentId === 'terminal-tab' || selectedAgentId === 'changes-tab';

    return !selectedAgent && !isTerminalOrChangesTab;
  }, [selectedProjectId, selectedAgent, selectedAgentId]);

  return {
    selectedAgent,
    showTodosPanel,
    shouldShowEmpty,
  };
};
