/**
 * Context Usage Store - Agent Context Window Tracking
 *
 * Handles tracking context window usage per agent and model
 *
 * Key features:
 * - Track context usage per agent and model
 * - Monitor input tokens, cache tokens, and output tokens
 * - Context window limits per model
 * - Compaction boundary detection and reset
 * - Real-time usage updates during streaming
 *
 * @see docs/guides-architecture.md - Store Architecture
 */

import { logger } from '@/commons/utils/logger';
import { enableMapSet } from 'immer';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Enable MapSet plugin for Immer
enableMapSet();

// DevTools configuration - only in development
const withDevtools = process.env.NODE_ENV === 'development' ? devtools : (f: any) => f;

/**
 * ModelUsage Interface
 * Represents context usage for a specific model
 */
export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  contextWindow: number;
}

/**
 * AgentContextUsage Interface
 * Represents context usage for an agent across all models
 */
export interface AgentContextUsage {
  agentId: string;
  modelUsage: Record<string, ModelUsage>;
  lastUpdated: Date;
}

/**
 * ContextUsageStore Interface
 * Defines all state and actions for context usage management
 */
export interface ContextUsageStore {
  // ==================== STATE ====================

  // Context Usage State
  agentContextUsage: Map<string, AgentContextUsage>;

  // ==================== ACTIONS ====================

  // Context Usage Actions
  updateAgentContextUsage: (
    agentId: string,
    modelUsage: Record<string, Partial<ModelUsage>>
  ) => void;
  resetAgentContextUsage: (agentId: string) => void;
  getAgentContextUsage: (agentId: string) => AgentContextUsage | undefined;
  clearAllContextUsage: () => void;
}

/**
 * Context Usage Store
 * Manages context window usage for all agents
 */
export const useContextUsageStore = create<ContextUsageStore>()(
  withDevtools(
    immer<ContextUsageStore>((set, get) => ({
      // ==================== STATE ====================

      agentContextUsage: new Map(),

      // ==================== ACTIONS ====================

      updateAgentContextUsage: (
        agentId: string,
        modelUsage: Record<string, Partial<ModelUsage>>
      ) => {
        set((state) => {
          const existing = state.agentContextUsage.get(agentId);

          // Check if this is a zero-token update (like /context command that doesn't make API calls)
          // If so, skip the update to preserve the last known values
          const hasTokens = Object.values(modelUsage).some((usage) => {
            const total =
              (usage.inputTokens || 0) +
              (usage.cacheReadInputTokens || 0) +
              (usage.cacheCreationInputTokens || 0) +
              (usage.outputTokens || 0);
            return total > 0;
          });

          if (!hasTokens && existing) {
            // Skip update - this is a no-op command, keep existing values
            return;
          }

          if (!existing) {
            // First time seeing this agent - initialize with the modelUsage data
            const initialUsage: Record<string, ModelUsage> = {};
            for (const [modelName, usage] of Object.entries(modelUsage)) {
              initialUsage[modelName] = {
                inputTokens: usage.inputTokens || 0,
                outputTokens: usage.outputTokens || 0,
                cacheReadInputTokens: usage.cacheReadInputTokens || 0,
                cacheCreationInputTokens: usage.cacheCreationInputTokens || 0,
                contextWindow: usage.contextWindow || 200000,
              };
            }

            state.agentContextUsage.set(agentId, {
              agentId,
              modelUsage: initialUsage,
              lastUpdated: new Date(),
            });

            logger.debug(
              `[ContextUsageStore] Initialized context usage for agent ${agentId}:`,
              initialUsage
            );
          } else {
            // Update with latest turn's values (NOT accumulate - each turn contains full context state)
            for (const [modelName, usage] of Object.entries(modelUsage)) {
              existing.modelUsage[modelName] = {
                inputTokens: usage.inputTokens || 0,
                outputTokens: usage.outputTokens || 0,
                cacheReadInputTokens: usage.cacheReadInputTokens || 0,
                cacheCreationInputTokens: usage.cacheCreationInputTokens || 0,
                contextWindow: usage.contextWindow || 200000,
              };
            }
            existing.lastUpdated = new Date();

            logger.debug(
              `[ContextUsageStore] Updated context usage for agent ${agentId}:`,
              existing.modelUsage
            );
          }
        });
      },

      resetAgentContextUsage: (agentId: string) => {
        set((state) => {
          state.agentContextUsage.delete(agentId);
        });

        logger.info(`[ContextUsageStore] Reset context usage for agent ${agentId}`);
      },

      getAgentContextUsage: (agentId: string) => {
        return get().agentContextUsage.get(agentId);
      },

      clearAllContextUsage: () => {
        set((state) => {
          state.agentContextUsage.clear();
        });

        logger.info('[ContextUsageStore] Cleared all context usage');
      },
    })),
    { name: 'contextusage-store', trace: true }
  )
);

/**
 * React Hooks for Context Usage
 * Convenient hooks for accessing context usage state
 */

export const useAgentContextUsage = (agentId?: string) => {
  return useContextUsageStore((state) =>
    agentId ? state.agentContextUsage.get(agentId) : state.agentContextUsage
  );
};

export const useContextUsageActions = () => {
  return useContextUsageStore((state) => ({
    updateAgentContextUsage: state.updateAgentContextUsage,
    resetAgentContextUsage: state.resetAgentContextUsage,
    getAgentContextUsage: state.getAgentContextUsage,
    clearAllContextUsage: state.clearAllContextUsage,
  }));
};
