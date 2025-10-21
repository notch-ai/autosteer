// ============================================================================
// DESKTOP APP STORE EXPORTS
// New 3-Store Architecture (TRD Section 2.1.1)
//
// ARCHITECTURE OVERVIEW:
// - CoreStore: Business entities (agents, chat, projects, resources, tasks)
// - UIStore: Presentation state (layout, panels, search, vim mode)
// - SettingsStore: Configuration (preferences, API keys, commands)
//
// MIGRATION STATUS: ✅ All new stores implemented and exported
// LEGACY STATUS: ⚠️  useAppStore kept temporarily for backward compatibility
// ============================================================================

// ==================== NEW STORE ARCHITECTURE ====================
// Use these stores for all new development

/**
 * Core Business Store - Primary store for business entities and operations
 * Handles: agents, chat, projects, resources, tasks
 * Usage: const { agents, sendMessage, createAgent } = useCoreStore();
 */
export { useCoreStore } from './core';

/**
 * UI Presentation Store - UI state and presentation logic only
 * Handles: layout, panels, search, vim mode, view states
 * Usage: const { sidebarCollapsed, toggleSidebar, setActivePanel } = useUIStore();
 */
export { useUIStore } from './ui';

/**
 * Settings Configuration Store - User preferences and configuration
 * Handles: theme, font settings, API keys, slash commands, custom commands
 * Usage: const { theme, updatePreferences, setApiKey } = useSettingsStore();
 */
export {
  useSettingsStore,
  useTheme,
  useFontSettings,
  useSelectedProvider,
  useApiKeys,
  useCustomCommands,
  useSlashCommands,
  useSettingsInitialization,
} from './settings';

/**
 * Monitoring Store - Application monitoring and telemetry
 * Handles: performance metrics, error tracking, usage analytics
 */
export { useMonitoringStore } from './useMonitoringStore';

// ==================== UTILITY EXPORTS ====================

/**
 * Vim Slice - Used within stores, not a standalone store
 * Provides vim functionality to UI store
 */
export { createVimSlice } from './vimStore';
export type { VimSlice } from './vimStore';

// ==================== TYPE EXPORTS ====================

/**
 * All store types and interfaces
 * Includes CoreStore, UIStore, SettingsStore, and all supporting types
 */
export * from './types';

// ============================================================================
// PHASE 4 MIGRATION COMPLETE
// Legacy useAppStore has been removed. All components now use the new stores.
// ============================================================================
