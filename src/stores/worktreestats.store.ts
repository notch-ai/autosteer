/**
 * Worktree Stats Store - Project Statistics Tracking
 *
 * Handles tracking token usage, costs, and timing stats per project/worktree
 *
 * Key features:
 * - Token usage tracking (input, output, cache creation, cache reads)
 * - Cost tracking per project
 * - Request timing and duration tracking
 * - Message count per project
 * - Real-time stats updates during streaming
 *
 * @see docs/guides-architecture.md - Store Architecture
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// DevTools configuration - only in development
// DevTools configuration - only in development
// Support both main process (Node.js) and renderer process (Vite)
const isDevelopment =
  (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') ||
  (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development');
const withDevtools = isDevelopment ? devtools : (f: any) => f;

/**
 * WorktreeStats Interface
 * Represents usage statistics for a specific worktree/project
 */
export interface WorktreeStats {
  projectId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  totalCost: number;
  messageCount: number;
  lastUpdated: Date;
  lastRequestDuration?: number;
  lastMessageTokens?: number;
  totalStreamingTime?: number;
  currentStreamStartTime?: number;
}

/**
 * TokenUsage Interface
 * Represents token usage for a single request
 */
export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  duration?: number;
}

/**
 * WorktreeStatsStore Interface
 * Defines all state and actions for worktree statistics management
 */
export interface WorktreeStatsStore {
  // ==================== STATE ====================

  // Worktree Stats State
  worktreeStats: Record<string, WorktreeStats>;

  // ==================== ACTIONS ====================

  // Worktree Stats Actions
  updateWorktreeStats: (projectId: string, tokenUsage: TokenUsage) => void;
  updateWorktreeCost: (projectId: string, cost: number) => void;
  resetWorktreeStats: (projectId: string) => void;
  getWorktreeStats: (projectId: string) => WorktreeStats | undefined;
  markStreamStart: (projectId: string, startTime: number) => void;
  markStreamEnd: (projectId: string) => void;
}

/**
 * Worktree Stats Store
 * Manages usage statistics for all worktrees
 */
export const useWorktreeStatsStore = create<WorktreeStatsStore>()(
  withDevtools(
    immer<WorktreeStatsStore>((set, get) => ({
      // ==================== STATE ====================

      worktreeStats: {},

      // ==================== ACTIONS ====================

      updateWorktreeStats: (projectId: string, tokenUsage: TokenUsage) => {
        set((state) => {
          if (!state.worktreeStats[projectId]) {
            state.worktreeStats[projectId] = {
              projectId,
              totalInputTokens: 0,
              totalOutputTokens: 0,
              totalCacheCreationTokens: 0,
              totalCacheReadTokens: 0,
              totalCost: 0,
              messageCount: 0,
              lastUpdated: new Date(),
            };
          }

          const stats = state.worktreeStats[projectId];
          stats.totalInputTokens += tokenUsage.inputTokens || 0;
          stats.totalOutputTokens += tokenUsage.outputTokens || 0;
          stats.totalCacheCreationTokens += tokenUsage.cacheCreationInputTokens || 0;
          stats.totalCacheReadTokens += tokenUsage.cacheReadInputTokens || 0;
          stats.messageCount += 1;
          stats.lastUpdated = new Date();

          if (tokenUsage.duration !== undefined) {
            stats.lastRequestDuration = tokenUsage.duration;
          }

          const lastMessageTokens = (tokenUsage.inputTokens || 0) + (tokenUsage.outputTokens || 0);
          if (lastMessageTokens > 0) {
            stats.lastMessageTokens = lastMessageTokens;
          }
        });
      },

      updateWorktreeCost: (projectId: string, cost: number) => {
        set((state) => {
          if (state.worktreeStats[projectId]) {
            state.worktreeStats[projectId].totalCost =
              (state.worktreeStats[projectId].totalCost || 0) + cost;
            state.worktreeStats[projectId].lastUpdated = new Date();
          }
        });
      },

      resetWorktreeStats: (projectId: string) => {
        set((state) => {
          if (state.worktreeStats[projectId]) {
            state.worktreeStats[projectId] = {
              projectId,
              totalInputTokens: 0,
              totalOutputTokens: 0,
              totalCacheCreationTokens: 0,
              totalCacheReadTokens: 0,
              totalCost: 0,
              messageCount: 0,
              lastUpdated: new Date(),
            };
          }
        });
      },

      getWorktreeStats: (projectId: string) => {
        return get().worktreeStats[projectId];
      },

      markStreamStart: (projectId: string, startTime: number) => {
        set((state) => {
          if (state.worktreeStats[projectId]) {
            state.worktreeStats[projectId].currentStreamStartTime = startTime;
          }
        });
      },

      markStreamEnd: (projectId: string) => {
        set((state) => {
          const stats = state.worktreeStats[projectId];
          if (stats && stats.currentStreamStartTime) {
            const streamDuration = Date.now() - stats.currentStreamStartTime;
            stats.totalStreamingTime = (stats.totalStreamingTime || 0) + streamDuration;
            stats.lastRequestDuration = streamDuration;
            delete stats.currentStreamStartTime;
            stats.lastUpdated = new Date();
          }
        });
      },
    })),
    { name: 'worktreestats-store', trace: true }
  )
);

/**
 * React Hooks for Worktree Stats
 * Convenient hooks for accessing worktree stats state
 */

export const useWorktreeStats = (projectId?: string) => {
  return useWorktreeStatsStore((state) =>
    projectId ? state.worktreeStats[projectId] : state.worktreeStats
  );
};

export const useWorktreeStatsActions = () => {
  return useWorktreeStatsStore((state) => ({
    updateWorktreeStats: state.updateWorktreeStats,
    updateWorktreeCost: state.updateWorktreeCost,
    resetWorktreeStats: state.resetWorktreeStats,
    getWorktreeStats: state.getWorktreeStats,
    markStreamStart: state.markStreamStart,
    markStreamEnd: state.markStreamEnd,
  }));
};
