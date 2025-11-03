/**
 * Slash Commands Store - Command Management
 *
 * Handles loading and managing slash commands for projects
 *
 * Key features:
 * - Load slash commands from project .claude directory
 * - Store command definitions with metadata
 * - Support project-specific commands
 * - Command search and filtering
 *
 * @see docs/guides-architecture.md - Store Architecture
 */

import { logger } from '@/commons/utils/logger';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// DevTools configuration - only in development
const withDevtools = process.env.NODE_ENV === 'development' ? devtools : (f: any) => f;

/**
 * SlashCommand Interface
 * Represents a slash command definition
 */
export interface SlashCommand {
  name: string;
  description?: string;
  prompt: string;
  path: string;
}

/**
 * SlashCommandsStore Interface
 * Defines all state and actions for slash commands management
 */
export interface SlashCommandsStore {
  // ==================== STATE ====================

  // Slash Commands State
  slashCommands: SlashCommand[];
  slashCommandsLoading: boolean;
  slashCommandsError: string | null;

  // ==================== ACTIONS ====================

  // Slash Commands Actions
  loadSlashCommands: (projectPath?: string) => Promise<void>;
  clearSlashCommands: () => void;
  setSlashCommandsError: (error: string | null) => void;
}

/**
 * Slash Commands Store
 * Manages slash commands for the application
 */
export const useSlashCommandsStore = create<SlashCommandsStore>()(
  withDevtools(
    immer<SlashCommandsStore>((set) => ({
      // ==================== STATE ====================

      slashCommands: [],
      slashCommandsLoading: false,
      slashCommandsError: null,

      // ==================== ACTIONS ====================

      loadSlashCommands: async (projectPath?: string) => {
        logger.debug('[SlashCommandsStore] ========== LOAD SLASH COMMANDS CALLED ==========');

        set((state) => {
          state.slashCommandsLoading = true;
          state.slashCommandsError = null;
        });

        try {
          if (window.electron?.slashCommands) {
            // Pass the project path to load commands from the correct directory
            const commands = await window.electron.slashCommands.load(projectPath);

            set((state) => {
              state.slashCommands = commands;
              state.slashCommandsLoading = false;
            });

            logger.debug(
              `[SlashCommandsStore] Loaded ${commands.length} slash commands for path: ${projectPath || 'default'}`
            );
          } else {
            logger.warn('[SlashCommandsStore] window.electron.slashCommands not available');
            set((state) => {
              state.slashCommandsLoading = false;
            });
          }
        } catch (error) {
          logger.error('[SlashCommandsStore] Error loading slash commands:', error);
          set((state) => {
            state.slashCommandsError =
              error instanceof Error ? error.message : 'Failed to load slash commands';
            state.slashCommandsLoading = false;
          });
        }
      },

      clearSlashCommands: () => {
        set((state) => {
          state.slashCommands = [];
          state.slashCommandsError = null;
        });
      },

      setSlashCommandsError: (error: string | null) => {
        set((state) => {
          state.slashCommandsError = error;
        });
      },
    })),
    { name: 'slashcommands-store', trace: true }
  )
);

/**
 * React Hooks for Slash Commands
 * Convenient hooks for accessing slash commands state
 */

export const useSlashCommands = () => {
  return useSlashCommandsStore((state) => state.slashCommands);
};

export const useSlashCommandsLoading = () => {
  return useSlashCommandsStore((state) => state.slashCommandsLoading);
};

export const useSlashCommandsError = () => {
  return useSlashCommandsStore((state) => state.slashCommandsError);
};

export const useSlashCommandActions = () => {
  return useSlashCommandsStore((state) => ({
    loadSlashCommands: state.loadSlashCommands,
    clearSlashCommands: state.clearSlashCommands,
    setSlashCommandsError: state.setSlashCommandsError,
  }));
};
