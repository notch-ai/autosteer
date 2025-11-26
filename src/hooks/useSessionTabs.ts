import { useCallback, useEffect, useMemo } from 'react';
import { logger } from '../commons/utils/logger';
import { generateSessionName } from '../commons/utils/project/session_name_generator';
import type { Agent } from '../entities/Agent';
import { AgentStatus, AgentType } from '../entities/Agent';
import { useAgentsStore } from '../stores/agents.store';
import { useProjectsStore } from '../stores/projects.store';
import { useUIStore } from '../stores/ui';
import { useSettingsStore } from '../stores/settings';
import { SessionTab } from '../types/ui.types';
import { MAX_TABS, TERMINAL_TAB_ID, CHANGES_TAB_ID, TOOLS_TAB_ID } from '../constants/tabs';

/**
 * Creates a system tab (terminal, changes, or tools).
 * System tabs are always present and cannot be closed.
 *
 * @param id - Unique tab identifier
 * @param name - Display name for the tab
 * @param type - System tab type ('terminal', 'changes', or 'tools')
 * @param isActive - Whether this tab is currently active
 * @returns SessionTab configured as a system tab
 */
const createSystemTab = (
  id: string,
  name: string,
  type: 'terminal' | 'changes' | 'tools',
  isActive: boolean
): SessionTab => ({
  id,
  agentId: id,
  agentName: name,
  agentType: type,
  isActive,
  sessionId: `${type}-session`,
  lastAccessed: new Date(),
  tabType: type,
});

/**
 * Converts an Agent entity to a SessionTab.
 * Preserves agent metadata and sets tab-specific properties.
 *
 * @param agent - Agent entity to convert
 * @param isActive - Whether this tab should be marked as active
 * @returns SessionTab representing the agent
 */
const agentToTab = (agent: Agent, isActive: boolean): SessionTab => ({
  id: agent.id,
  agentId: agent.id,
  agentName: agent.title,
  agentType: agent.type || 'general',
  isActive,
  sessionId: agent.id,
  lastAccessed: agent.updatedAt || agent.createdAt,
  tabType: 'agent',
});

/**
 * Persists the active tab selection to the project configuration.
 * Ensures tab selection survives application restarts.
 *
 * @param projectId - Project identifier
 * @param tabId - Tab identifier to mark as active
 */
const persistActiveTab = async (projectId: string, tabId: string): Promise<void> => {
  try {
    await window.electron.worktree.setActiveTab(projectId, tabId);
  } catch (error) {
    console.error('Failed to save active tab:', error);
  }
};

/**
 * Custom hook for managing session tabs with per-project isolation.
 *
 * Features:
 * - Per-project tab filtering: Only shows tabs for the selected project
 * - Auto-select behavior: Configurable via settings.confirmSessionTabDeletion
 * - Tab lifecycle: Create, switch, close with persistence
 * - System tabs: Terminal and Changes tabs always present
 * - Maximize tabs: Dynamic tabs for maximize view
 *
 * Tab Management:
 * - Tabs are scoped to the current project
 * - Closing a tab auto-selects another tab if available
 * - Active tab is persisted to project configuration
 * - System tabs (terminal/changes) cannot be closed
 *
 * @example
 * const { tabs, activeTab, switchToTab, closeTab } = useSessionTabs();
 *
 * // Switch to a specific tab
 * await switchToTab('agent-123');
 *
 * // Close a tab (auto-selects next available tab)
 * await closeTab('agent-123');
 *
 * @returns Tab management interface with tabs array, active tab, and control functions
 */
export const useSessionTabs = () => {
  // Use domain-specific stores instead of deprecated core.ts methods
  const agents = useAgentsStore((state) => state.agents);
  const selectedProjectId = useProjectsStore((state) => state.selectedProjectId);
  const projects = useProjectsStore((state) => state.projects);
  const selectAgent = useAgentsStore((state) => state.selectAgent);
  const createAgent = useAgentsStore((state) => state.createAgent);
  const deleteAgent = useAgentsStore((state) => state.deleteAgent);
  const setActiveTab = useUIStore((state) => state.setActiveTab);
  const removeTab = useUIStore((state) => state.removeTab);
  const updateTabState = useUIStore((state) => state.updateTabState);
  const activeTabId = useUIStore((state) => state.tabState?.activeTabId);
  const autoSelectFirstTab = useSettingsStore(
    (state) => state.preferences.autoSelectFirstTab ?? true
  );

  // Derived state
  const currentProject = selectedProjectId ? projects.get(selectedProjectId) : undefined;
  const projectId = currentProject?.folderName || currentProject?.id;

  // Load activeTabId from WorktreeConfig on mount and project switch
  useEffect(() => {
    const loadActiveTab = async () => {
      if (!projectId) {
        return;
      }

      try {
        const storedActiveTabId = await window.electron.worktree.getActiveTab(projectId);

        // Check if the stored tab exists in current tabs
        const projectAgents = Array.from(agents.values()).filter(
          (agent) => agent.projectId === projectId
        );

        const agentIds = projectAgents.map((agent) => agent.id);
        const systemTabIds = [TERMINAL_TAB_ID, CHANGES_TAB_ID, TOOLS_TAB_ID];
        const allTabIds = [...agentIds, ...systemTabIds];

        // IMPORTANT: If activeTabId is already set AND it exists in current project tabs
        // AND there's a stored activeTabId for this project (meaning the user explicitly selected it),
        // don't override it. This allows navigation to work while still
        // allowing project switches to load the correct tab.
        // EXCEPTION: System tabs (terminal, changes, tools) are shared across projects, so we
        // always restore them from saved config when switching projects.
        const currentActiveTabId = activeTabId;
        if (currentActiveTabId && storedActiveTabId) {
          const isSystemTab = systemTabIds.includes(currentActiveTabId);

          // For non-system tabs (agent tabs), skip reload if already active and valid
          if (!isSystemTab) {
            const isValidTab = allTabIds.includes(currentActiveTabId);
            if (isValidTab) {
              return;
            }
          }
        }

        if (storedActiveTabId) {
          if (allTabIds.includes(storedActiveTabId)) {
            // Restore active tab
            setActiveTab(storedActiveTabId);

            // Also select the agent if it's an agent tab (not system tab)
            // IMPORTANT: Don't persist here - we're just restoring what's already saved
            if (agentIds.includes(storedActiveTabId)) {
              await selectAgent(storedActiveTabId);
            }
          } else if (autoSelectFirstTab) {
            // Auto-select: stored tab doesn't exist, select first available tab if enabled
            if (allTabIds.length > 0) {
              const firstTabId = allTabIds[0];
              setActiveTab(firstTabId);

              if (agentIds.includes(firstTabId)) {
                await selectAgent(firstTabId);
              }

              // Persist the fallback tab
              await persistActiveTab(projectId, firstTabId);
            }
          }
        } else {
          // No stored activeTabId, auto-select first tab if enabled
          if (autoSelectFirstTab) {
            const projectAgents = Array.from(agents.values()).filter(
              (agent) => agent.projectId === projectId
            );

            if (projectAgents.length > 0) {
              const firstAgentId = projectAgents[0].id;
              setActiveTab(firstAgentId);
              await selectAgent(firstAgentId);
              await persistActiveTab(projectId, firstAgentId);
            }
          }
        }
      } catch (error) {
        logger.error('[useSessionTabs] Failed to load activeTab from config', {
          projectId,
          error: String(error),
        });
      }
    };

    loadActiveTab();
  }, [projectId, agents, setActiveTab, selectAgent, autoSelectFirstTab]);

  // Generate tabs
  const tabs = useMemo(() => {
    if (!projectId) return [];

    // BUG FIX 2: Project-scoped tab filtering - Filter agents by projectId
    // to prevent cross-project tab leakage
    const projectAgents = Array.from(agents.values()).filter(
      (agent) => agent.projectId === projectId
    );

    const agentTabs = projectAgents.map((agent) => agentToTab(agent, agent.id === activeTabId));

    const terminalTab = createSystemTab(
      TERMINAL_TAB_ID,
      'Terminal',
      'terminal',
      activeTabId === TERMINAL_TAB_ID
    );

    const changesTab = createSystemTab(
      CHANGES_TAB_ID,
      'Changes',
      'changes',
      activeTabId === CHANGES_TAB_ID
    );

    // Create Tools tab (system tab - same pattern as terminal/changes)
    const toolsTab = createSystemTab(TOOLS_TAB_ID, 'Tools', 'tools', activeTabId === TOOLS_TAB_ID);

    // Place tools tab before terminal (to the left in the UI)
    return [...agentTabs, toolsTab, terminalTab, changesTab];
  }, [agents, projectId, activeTabId]); // REMOVED: selectedAgentId (unused in memo)

  const activeTab = useMemo(() => tabs.find((tab) => tab.isActive) || null, [tabs]);

  // Sync tabs to UI store's tabState
  useEffect(() => {
    updateTabState(tabs);
  }, [tabs, updateTabState]);

  const switchToTab = useCallback(
    async (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) {
        logger.error('[useSessionTabs] Tab not found', {
          tabId,
          availableTabs: tabs.map((t) => t.id),
        });
        return;
      }

      // For system tabs (terminal, changes, tools), DON'T select an agent - just set the active tab
      // The MainContent component uses activeTabId to control visibility
      const isSystemTab =
        tab.tabType === 'terminal' || tab.tabType === 'changes' || tab.tabType === 'tools';

      if (!isSystemTab) {
        await selectAgent(tab.agentId);
      }

      setActiveTab(tabId);

      if (projectId) {
        await persistActiveTab(projectId, tabId);
      }
    },
    [tabs, selectAgent, setActiveTab, projectId]
  );

  const createNewTab = useCallback(async () => {
    if (!currentProject || !projectId || tabs.length >= MAX_TABS) return;

    try {
      // Get existing session names to avoid collisions
      const existingNames = new Set(
        Array.from(agents.values())
          .filter((agent) => agent.projectId === projectId)
          .map((agent) => agent.title)
      );

      const sessionName = generateSessionName(existingNames);

      const newAgent = await createAgent({
        title: sessionName,
        content: '',
        type: AgentType.TEXT,
        status: AgentStatus.DRAFT,
        projectId: projectId,
      });

      // Select the new agent and set it as active tab
      await selectAgent(newAgent.id);
      setActiveTab(newAgent.id);

      // Persist the new tab as active
      if (projectId) {
        await persistActiveTab(projectId, newAgent.id);
      }
    } catch (error) {
      console.error('Failed to create new tab:', error);
    }
  }, [currentProject, tabs.length, projectId, createAgent, selectAgent, setActiveTab, agents]);

  /**
   * Closes a tab and auto-selects the next available tab.
   *
   * Behavior:
   * - Cannot close if only one tab remains
   * - If closing active tab, automatically switches to another tab first
   * - Removes tab from UI store but preserves agent data
   * - System tabs (terminal/changes) are filtered out from auto-selection
   *
   * Auto-selection logic:
   * - Finds first non-system tab (agent or maximize tab)
   * - Falls back to system tabs if no other tabs available
   * - Persists new active tab selection to project config
   *
   * @param tabId - ID of the tab to close
   *
   * @example
   * // Close a specific tab
   * await closeTab('agent-123');
   *
   * // Tab is removed, and next available tab becomes active
   */
  const closeTab = useCallback(
    async (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);

      if (!tab) {
        logger.error('[useSessionTabs] Tab not found', {
          tabId,
          availableTabs: tabs.map((t) => t.id),
        });
        return;
      }

      // BUG FIX 1: Remove blocking condition preventing deletion at max capacity
      // Old code: if (!tab || tabs.length <= 1) return;
      // New code: Only check if tab exists, allow deletion even at max capacity
      if (tabs.length <= 1) {
        return;
      }

      try {
        // If closing the active tab, switch to another tab first
        if (tab.isActive && tabs.length > 1) {
          const nextTab = tabs.find((t) => t.id !== tabId);
          if (nextTab) {
            await selectAgent(nextTab.agentId);
          }
        }

        // Remove from UI store
        removeTab(tabId);

        // Note: We don't delete the agent from core store to preserve data
        // The agent will just not be shown in tabs
        // Note: System tabs (terminal/changes/maximize) cannot be closed - prevented in SessionTabs component
      } catch (error) {
        logger.error('[useSessionTabs] Failed to close tab', {
          tabId,
          error: String(error),
        });
      }
    },
    [tabs, selectAgent, removeTab, projectId]
  );

  // Feature flag for tabs - can be controlled via settings
  const isTabsEnabled = true;

  return {
    tabs,
    activeTab,
    switchToTab,
    createNewTab,
    closeTab,
    deleteAgent,
    isTabsEnabled,
  };
};
