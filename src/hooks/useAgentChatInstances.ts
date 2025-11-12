import React, { useEffect, useMemo, useRef, useState } from 'react';
import { logger } from '@/commons/utils/logger';

/**
 * useAgentChatInstances - Agent ChatInterface instance management
 *
 * Manages lifecycle of ChatInterface component instances per agent to preserve
 * conversation state across tab switches. Uses Set-based tracking to determine
 * which agents should have mounted ChatInterface instances.
 *
 * Key Features:
 * - Auto-create ChatInterface instances on first agent selection
 * - Preserve instances across tab switches (no remounting)
 * - Instance creation logging with context
 * - Efficient Set-based tracking (O(1) lookups)
 *
 * Performance:
 * - Memoized instance arrays to prevent unnecessary re-renders
 * - Lightweight Set operations for instance tracking
 * - Lazy instance creation (only when agent selected)
 *
 * Architecture:
 * - Instances created once and kept mounted (hidden with CSS)
 * - No cleanup on tab switch to preserve state
 * - Singleton pattern per agent (one instance per agent ID)
 *
 * Usage:
 * ```tsx
 * const { agentIdsWithInstances, chatInterfaceRefs } = useAgentChatInstances({
 *   selectedAgentId
 * });
 *
 * // Render all instances (visibility controlled by selectedAgentId)
 * {agentIdsWithInstances.map((agentId) => (
 *   <AgentChatInterface
 *     key={agentId}
 *     agentId={agentId}
 *     selectedAgentId={selectedAgentId}
 *     ref={(ref) => chatInterfaceRefs.current.set(agentId, ref)}
 *   />
 * ))}
 * ```
 *
 * @see docs/guides-architecture.md - Handler Pattern Guidelines
 */

/**
 * Hook parameters
 */
interface UseAgentChatInstancesParams {
  /** Currently selected agent ID (can be null, 'terminal-tab', or 'changes-tab') */
  selectedAgentId: string | null;
}

/**
 * Hook return value
 */
interface UseAgentChatInstancesReturn {
  /** Array of agent IDs that should have ChatInterface instances */
  agentIdsWithInstances: string[];
  /** Map of agent IDs to ChatInterface refs (for imperative actions like focus) */
  chatInterfaceRefs: React.MutableRefObject<Map<string, { focus: () => void } | null>>;
}

/**
 * Create agent chat instances hook
 */
export const useAgentChatInstances = ({
  selectedAgentId,
}: UseAgentChatInstancesParams): UseAgentChatInstancesReturn => {
  // ==================== STATE ====================

  /** Track which agents have had ChatInterface instances created */
  const [createdAgents, setCreatedAgents] = useState<Set<string>>(new Set());

  /** Refs to ChatInterface instances for imperative actions (focus, etc.) */
  const chatInterfaceRefs = useRef<Map<string, { focus: () => void } | null>>(new Map());

  // ==================== EFFECTS ====================

  /**
   * Create ChatInterface instances for new agents on first selection
   * Effect runs when selectedAgentId changes
   */
  useEffect(() => {
    // Skip for special tabs (terminal, changes) or no selection
    if (
      !selectedAgentId ||
      selectedAgentId === 'terminal-tab' ||
      selectedAgentId === 'changes-tab'
    ) {
      return;
    }

    // Check if instance already exists
    if (createdAgents.has(selectedAgentId)) {
      logger.debug('[useAgentChatInstances] Switching to existing ChatInterface instance', {
        agentId: selectedAgentId,
        totalInstances: createdAgents.size,
      });
      return;
    }

    // Create new instance
    logger.debug('[useAgentChatInstances] Creating ChatInterface instance for agent', {
      agentId: selectedAgentId,
      totalInstances: createdAgents.size + 1,
    });

    setCreatedAgents((prev) => new Set(prev).add(selectedAgentId));
  }, [selectedAgentId, createdAgents]);

  // ==================== COMPUTED VALUES ====================

  /**
   * Get array of agent IDs that should have ChatInterface instances
   * Memoized to prevent unnecessary re-renders in consuming components
   */
  const agentIdsWithInstances = useMemo(() => {
    return Array.from(createdAgents);
  }, [createdAgents]);

  // ==================== RETURN ====================

  return {
    agentIdsWithInstances,
    chatInterfaceRefs,
  };
};
