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
// DevTools configuration - only in development
// Support both main process (Node.js) and renderer process (Vite)
const isDevelopment =
  (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') ||
  (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development');
const withDevtools = isDevelopment ? devtools : (f: any) => f;

/**
 * SlashCommand Interface from IPC Handler
 */
export interface SlashCommandFromIPC {
  trigger: string; // The command trigger (e.g., 'pr', 'commit', 'engineering:fix-bug')
  description: string; // Description from markdown file
  content: string; // Full markdown content for Claude Code
}

/**
 * SlashCommand Interface
 * Represents a slash command definition for internal use
 */
export interface SlashCommand {
  name: string;
  description?: string;
  prompt: string;
  source: 'local' | 'user';
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
        set((state) => {
          state.slashCommandsLoading = true;
          state.slashCommandsError = null;
        });

        try {
          if (window.electron?.slashCommands) {
            // Pass the project path to load commands from the correct directory
            const commandsFromIPC: SlashCommandFromIPC[] =
              await window.electron.slashCommands.load(projectPath);

            // Transform IPC commands to internal format
            const commands: SlashCommand[] = commandsFromIPC.map((cmd) => ({
              name: cmd.trigger,
              description: cmd.description,
              prompt: cmd.content,
              source: cmd.source,
            }));

            set((state) => {
              state.slashCommands = commands;
              state.slashCommandsLoading = false;
            });
          } else {
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
