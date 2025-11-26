import { logger } from '@/commons/utils/logger';
import { SlashCommand } from '@/types/ipc.types';
import { DEFAULT_MODEL } from '@/types/model.types';
import { DEFAULT_PERMISSION_MODE } from '@/types/permission.types';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { CustomCommand, UserPreferences } from './types';

/**
 * SettingsStore - User configuration and preferences
 *
 * This store handles all user settings and preferences, synchronized with
 * ~/.autosteer/config.json via IPC. Follows the TRD specification (Section 2.3.2).
 *
 * Key features:
 * - All preferences state (theme, fontSize, fontFamily, autoSave, etc.)
 * - API keys storage (securely handled)
 * - Selected provider state
 * - Slash commands and custom commands
 * - Integration with ~/.autosteer/config.json via IPC
 * - Initialize method to load from config file on startup
 * - All actions persist to config file
 */

export interface SettingsStore {
  // User Preferences State
  preferences: UserPreferences;

  // API Configuration
  apiKeys: Record<string, string>;
  selectedProvider: 'mock' | 'claude-code' | 'openai';

  // Commands State
  slashCommands: SlashCommand[];
  customCommands: CustomCommand[];
  slashCommandsLoading: boolean;
  slashCommandsError: string | null;

  // Initialization State
  isInitialized: boolean;
  initializationError: string | null;

  // Core Actions
  initialize: () => Promise<void>;

  // Preference Actions
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  resetPreferences: () => Promise<void>;

  // API Key Actions
  setApiKey: (service: string, key: string) => Promise<void>;
  removeApiKey: (service: string) => Promise<void>;
  clearAllApiKeys: () => Promise<void>;

  // Provider Actions
  setProvider: (provider: 'mock' | 'claude-code' | 'openai') => Promise<void>;

  // Command Actions
  loadSlashCommands: () => Promise<void>;
  addCustomCommand: (command: Omit<CustomCommand, 'id' | 'createdAt'>) => Promise<void>;
  updateCustomCommand: (
    id: string,
    updates: Partial<Omit<CustomCommand, 'id' | 'createdAt'>>
  ) => Promise<void>;
  removeCustomCommand: (id: string) => Promise<void>;
  clearCustomCommands: () => Promise<void>;

  // Utility Actions
  exportSettings: () => Promise<string>;
  importSettings: (settingsJson: string) => Promise<void>;
  reset: () => void;
}

/**
 * Default user preferences following TRD specification
 */
const getDefaultPreferences = (): UserPreferences => ({
  theme: 'system',
  fontSize: 'medium',
  fontFamily: 'Fira Code, SF Mono, Monaco, Consolas, monospace', // Default to Fira Code
  autoSave: true,
  compactOnTokenLimit: true,
  maxTokens: 4000,
  badgeNotifications: true,
  defaultModel: DEFAULT_MODEL, // Default model for new conversations
  maxTurns: null, // Default: unlimited (null = no limit)
  confirmSessionTabDeletion: true, // Default: show confirmation dialog
  enableSkills: true, // Default: enable skills
  autoSelectFirstTab: true, // Default: auto-select first tab when no active tab
  defaultPermissionMode: DEFAULT_PERMISSION_MODE, // Default: 'edit'
});

// DevTools configuration - only in development
// Use process.env (works in both Node and Vite)
const isDevelopment =
  (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') || false;

/**
 * Create SettingsStore with Zustand + Immer middleware
 * Uses devtools in development for debugging
 */
export const useSettingsStore = create<SettingsStore>()(
  devtools(
    immer((set, get) => ({
      // Initial State
      preferences: getDefaultPreferences(),
      apiKeys: {},
      selectedProvider: 'claude-code',
      slashCommands: [],
      customCommands: [],
      slashCommandsLoading: false,
      slashCommandsError: null,
      isInitialized: false,
      initializationError: null,

      // Core Actions
      initialize: async () => {
        try {
          logger.info('[SETTINGS_STORE] Initializing settings store...');
          set((state) => {
            state.initializationError = null;
          });

          // Load settings from ~/.autosteer/config.json via IPC
          logger.info('[SETTINGS_STORE] Reading config from IPC...');
          const config = await window.electron.ipc.invoke('config:read');
          logger.info('[SETTINGS_STORE] Config loaded:', {
            hasSettings: !!config.settings,
            settingsKeys: config.settings ? Object.keys(config.settings) : [],
          });

          // Load slash commands for current project (if any)
          logger.info('[SETTINGS_STORE] Loading slash commands...');
          await get().loadSlashCommands();
          logger.info('[SETTINGS_STORE] Slash commands loaded');

          set((state) => {
            logger.info('[SETTINGS_STORE] Updating state with config data...');
            // Update preferences with config data or use defaults
            if (config.settings) {
              logger.info('[SETTINGS_STORE] Merging config settings with defaults...');
              state.preferences = {
                ...getDefaultPreferences(),
                ...config.settings,
              };
              logger.info('[SETTINGS_STORE] Preferences merged:', state.preferences);

              // Migration: Convert legacy numeric fontSize to preset
              if (config.settings.fontSize && typeof config.settings.fontSize === 'number') {
                logger.info(
                  '[SETTINGS_STORE] Migrating legacy fontSize:',
                  config.settings.fontSize
                );
                const legacySize = config.settings.fontSize;
                const migratedSize: 'small' | 'medium' | 'large' =
                  legacySize <= 12 ? 'small' : legacySize <= 13 ? 'medium' : 'large';

                state.preferences.fontSize = migratedSize;

                // Persist migration asynchronously (don't await to avoid blocking initialization)
                window.electron.ipc
                  .invoke('config:updateSettings', { fontSize: migratedSize })
                  .catch((error) => {
                    logger.error('[SETTINGS_STORE] Failed to persist fontSize migration:', error);
                  });

                logger.info(
                  `[SETTINGS_STORE] Migrated legacy fontSize ${legacySize}px to '${migratedSize}'`
                );
              }

              // Migration: Remove legacy 'default' permission mode
              if (config.settings.defaultPermissionMode) {
                const savedMode = config.settings.defaultPermissionMode as string;
                logger.info('[SETTINGS_STORE] Checking permission mode migration:', savedMode);

                // If saved mode is 'default', migrate to DEFAULT_PERMISSION_MODE ('acceptEdits')
                if (savedMode === 'default') {
                  logger.info(
                    '[SETTINGS_STORE] Migrating legacy permission mode to:',
                    DEFAULT_PERMISSION_MODE
                  );
                  state.preferences.defaultPermissionMode = DEFAULT_PERMISSION_MODE;

                  // Persist migration asynchronously
                  window.electron.ipc
                    .invoke('config:updateSettings', {
                      defaultPermissionMode: DEFAULT_PERMISSION_MODE,
                    })
                    .catch((error) => {
                      logger.error(
                        '[SETTINGS_STORE] Failed to persist permission mode migration:',
                        error
                      );
                    });

                  logger.debug(
                    `[SETTINGS_STORE] Migrated legacy permission mode 'default' to '${DEFAULT_PERMISSION_MODE}'`
                  );
                }
              }
            }

            // Load API keys (handled securely via IPC)
            if (config.apiKeys) {
              logger.info('[SETTINGS_STORE] Loading API keys...');
              state.apiKeys = config.apiKeys;
              logger.info(
                '[SETTINGS_STORE] API keys loaded, count:',
                Object.keys(config.apiKeys).length
              );
            }

            // Load selected provider
            if (config.settings?.selectedProvider) {
              logger.info(
                '[SETTINGS_STORE] Setting selected provider:',
                config.settings.selectedProvider
              );
              state.selectedProvider = config.settings.selectedProvider;
            }

            // Load custom commands
            if (config.customCommands) {
              logger.info('[SETTINGS_STORE] Loading custom commands...');
              state.customCommands = config.customCommands;
              logger.info(
                '[SETTINGS_STORE] Custom commands loaded, count:',
                config.customCommands.length
              );
            }

            logger.info('[SETTINGS_STORE] Marking store as initialized');
            state.isInitialized = true;
          });
          logger.info('[SETTINGS_STORE] Settings store initialization complete');
        } catch (error) {
          logger.error('[SETTINGS_STORE] Failed to initialize settings store:', error);
          logger.error(
            '[SETTINGS_STORE] Error stack:',
            error instanceof Error ? error.stack : 'No stack'
          );
          set((state) => {
            state.initializationError =
              error instanceof Error ? error.message : 'Unknown initialization error';
            state.isInitialized = false;
          });
        }
      },

      // Preference Actions
      updatePreferences: async (updates: Partial<UserPreferences>) => {
        // Update local state immediately (optimistic update)
        set((state) => {
          state.preferences = { ...state.preferences, ...updates };
        });

        try {
          // Persist to ~/.autosteer/config.json via IPC
          await window.electron.ipc.invoke('config:updateSettings', {
            ...updates,
          });
        } catch (error) {
          logger.error('Failed to persist preference updates:', error);
          // Revert optimistic update on failure
          set((state) => {
            // Remove the updates that failed to persist
            const revertedPreferences = { ...state.preferences };
            Object.keys(updates).forEach((key) => {
              // This is a simplistic revert - in production you might want to reload from config
              delete revertedPreferences[key as keyof UserPreferences];
            });
            state.preferences = { ...getDefaultPreferences(), ...revertedPreferences };
          });
          throw error;
        }
      },

      resetPreferences: async () => {
        const defaultPrefs = getDefaultPreferences();
        await get().updatePreferences(defaultPrefs);
      },

      // API Key Actions
      setApiKey: async (service: string, key: string) => {
        // Update local state
        set((state) => {
          state.apiKeys[service] = key;
        });

        try {
          // Persist to config file via IPC
          await window.electron.ipc.invoke('config:setApiKey', service, key);
        } catch (error) {
          logger.error('Failed to persist API key:', error);
          // Revert local state
          set((state) => {
            delete state.apiKeys[service];
          });
          throw error;
        }
      },

      removeApiKey: async (service: string) => {
        // Update local state
        set((state) => {
          delete state.apiKeys[service];
        });

        try {
          // Remove from config file via IPC
          await window.electron.ipc.invoke('config:removeApiKey', service);
        } catch (error) {
          logger.error('Failed to remove API key:', error);
          throw error;
        }
      },

      clearAllApiKeys: async () => {
        const previousKeys = { ...get().apiKeys };

        // Clear local state
        set((state) => {
          state.apiKeys = {};
        });

        try {
          // Clear all API keys via IPC
          await window.electron.ipc.invoke('config:clearApiKeys');
        } catch (error) {
          logger.error('Failed to clear API keys:', error);
          // Revert local state
          set((state) => {
            state.apiKeys = previousKeys;
          });
          throw error;
        }
      },

      // Provider Actions
      setProvider: async (provider: 'mock' | 'claude-code' | 'openai') => {
        // Update local state
        set((state) => {
          state.selectedProvider = provider;
        });

        try {
          // Persist provider to config file directly
          await window.electron.ipc.invoke('config:updateSettings', { selectedProvider: provider });
        } catch (error) {
          logger.error('Failed to persist provider selection:', error);
          // Revert local state
          set((state) => {
            state.selectedProvider = 'claude-code'; // fallback to default
          });
          throw error;
        }
      },

      // Command Actions
      loadSlashCommands: async () => {
        set((state) => {
          state.slashCommandsLoading = true;
          state.slashCommandsError = null;
        });

        try {
          // Load slash commands for current project
          const currentProject = window.electron.store
            ? await window.electron.store.get('currentProjectPath')
            : null;

          const commands = await window.electron.slashCommands.load(currentProject || undefined);

          set((state) => {
            state.slashCommands = commands;
            state.slashCommandsLoading = false;
          });
        } catch (error) {
          logger.error('Failed to load slash commands:', error);
          set((state) => {
            state.slashCommandsError =
              error instanceof Error ? error.message : 'Failed to load slash commands';
            state.slashCommandsLoading = false;
          });
        }
      },

      addCustomCommand: async (command: Omit<CustomCommand, 'id' | 'createdAt'>) => {
        const newCommand: CustomCommand = {
          ...command,
          id: crypto.randomUUID(),
          createdAt: new Date(),
        };

        // Update local state
        set((state) => {
          state.customCommands.push(newCommand);
        });

        try {
          // Persist to config file
          await window.electron.ipc.invoke('config:addCustomCommand', newCommand);
        } catch (error) {
          logger.error('Failed to persist custom command:', error);
          // Revert local state
          set((state) => {
            state.customCommands = state.customCommands.filter((cmd) => cmd.id !== newCommand.id);
          });
          throw error;
        }
      },

      updateCustomCommand: async (
        id: string,
        updates: Partial<Omit<CustomCommand, 'id' | 'createdAt'>>
      ) => {
        const originalCommand = get().customCommands.find((cmd) => cmd.id === id);
        if (!originalCommand) {
          throw new Error('Custom command not found');
        }

        // Update local state
        set((state) => {
          const commandIndex = state.customCommands.findIndex((cmd) => cmd.id === id);
          if (commandIndex >= 0) {
            state.customCommands[commandIndex] = {
              ...state.customCommands[commandIndex],
              ...updates,
            };
          }
        });

        try {
          // Persist to config file
          const updatedCommand = { ...originalCommand, ...updates };
          await window.electron.ipc.invoke('config:updateCustomCommand', id, updatedCommand);
        } catch (error) {
          logger.error('Failed to update custom command:', error);
          // Revert local state
          set((state) => {
            const commandIndex = state.customCommands.findIndex((cmd) => cmd.id === id);
            if (commandIndex >= 0) {
              state.customCommands[commandIndex] = originalCommand;
            }
          });
          throw error;
        }
      },

      removeCustomCommand: async (id: string) => {
        const originalCommands = [...get().customCommands];

        // Update local state
        set((state) => {
          state.customCommands = state.customCommands.filter((cmd) => cmd.id !== id);
        });

        try {
          // Remove from config file
          await window.electron.ipc.invoke('config:removeCustomCommand', id);
        } catch (error) {
          logger.error('Failed to remove custom command:', error);
          // Revert local state
          set((state) => {
            state.customCommands = originalCommands;
          });
          throw error;
        }
      },

      clearCustomCommands: async () => {
        const originalCommands = [...get().customCommands];

        // Clear local state
        set((state) => {
          state.customCommands = [];
        });

        try {
          // Clear from config file
          await window.electron.ipc.invoke('config:clearCustomCommands');
        } catch (error) {
          logger.error('Failed to clear custom commands:', error);
          // Revert local state
          set((state) => {
            state.customCommands = originalCommands;
          });
          throw error;
        }
      },

      // Utility Actions
      exportSettings: async (): Promise<string> => {
        const state = get();
        const settingsExport = {
          preferences: state.preferences,
          selectedProvider: state.selectedProvider,
          customCommands: state.customCommands,
          // Note: API keys are excluded from export for security
          exportedAt: new Date().toISOString(),
          version: '1.0',
        };

        return JSON.stringify(settingsExport, null, 2);
      },

      importSettings: async (settingsJson: string) => {
        try {
          const imported = JSON.parse(settingsJson);

          // Validate imported settings structure
          if (!imported.preferences || typeof imported.preferences !== 'object') {
            throw new Error('Invalid settings file: missing preferences');
          }

          // Import preferences
          if (imported.preferences) {
            await get().updatePreferences(imported.preferences);
          }

          // Import provider selection
          if (imported.selectedProvider) {
            await get().setProvider(imported.selectedProvider);
          }

          // Import custom commands
          if (imported.customCommands && Array.isArray(imported.customCommands)) {
            // Clear existing custom commands first
            await get().clearCustomCommands();

            // Add imported commands
            for (const command of imported.customCommands) {
              await get().addCustomCommand({
                name: command.name,
                description: command.description,
                command: command.command,
              });
            }
          }
        } catch (error) {
          logger.error('Failed to import settings:', error);
          // Re-throw validation errors as-is
          if (error instanceof Error && error.message.startsWith('Invalid settings file:')) {
            throw error;
          }
          throw new Error('Failed to import settings: Invalid format or persistence error');
        }
      },

      reset: () => {
        set((state) => {
          state.preferences = getDefaultPreferences();
          state.apiKeys = {};
          state.selectedProvider = 'claude-code';
          state.customCommands = [];
          state.slashCommands = [];
          state.slashCommandsLoading = false;
          state.slashCommandsError = null;
          state.isInitialized = false;
          state.initializationError = null;
        });
      },
    })),
    {
      name: 'settings-store',
      trace: isDevelopment,
    }
  )
);

/**
 * Selector hooks for common use cases
 */

// Theme selector
export const useTheme = () => useSettingsStore((state) => state.preferences.theme);

// Font settings selector
export const useFontSettings = () =>
  useSettingsStore((state) => ({
    fontSize: state.preferences.fontSize,
    fontFamily: state.preferences.fontFamily,
  }));

// Provider selector
export const useSelectedProvider = () => useSettingsStore((state) => state.selectedProvider);

// API keys selector (be careful with this - avoid exposing in logs)
export const useApiKeys = () => useSettingsStore((state) => state.apiKeys);

// Custom commands selector
export const useCustomCommands = () => useSettingsStore((state) => state.customCommands);

// Slash commands selector
export const useSlashCommands = () =>
  useSettingsStore((state) => ({
    commands: state.slashCommands,
    loading: state.slashCommandsLoading,
    error: state.slashCommandsError,
  }));

// Initialization status selector
export const useSettingsInitialization = () =>
  useSettingsStore((state) => ({
    isInitialized: state.isInitialized,
    error: state.initializationError,
  }));

// Default model selector
export const useDefaultModel = () => useSettingsStore((state) => state.preferences.defaultModel);

// Default permission mode selector
export const useDefaultPermissionMode = () =>
  useSettingsStore((state) => state.preferences.defaultPermissionMode);

/**
 * Type exports for use in components
 */
export type { CustomCommand, UserPreferences };
