import { useCallback, useEffect, useMemo, useRef } from 'react';
import { generateSessionName } from '../commons/utils/sessionNameGenerator';
import type { Agent } from '../entities/Agent';
import { AgentStatus, AgentType } from '../entities/Agent';
import { useCoreStore } from '../stores/core';
import { useUIStore } from '../stores/ui';
import { SessionTab } from '../types/ui.types';
import { MAX_TABS, TERMINAL_TAB_ID, CHANGES_TAB_ID } from '../constants/tabs';

// Helper: Create system tab
const createSystemTab = (
  id: string,
  name: string,
  type: 'terminal' | 'changes',
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

// Helper: Convert agent to tab
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

// Helper: Persist active tab to config
const persistActiveTab = async (projectId: string, tabId: string): Promise<void> => {
  try {
    await window.electron.worktree.setActiveTab(projectId, tabId);
  } catch (error) {
    console.error('Failed to save active tab:', error);
  }
};

export const useSessionTabs = () => {
  // Store subscriptions
  const agents = useCoreStore((state) => state.agents);
  const selectedProjectId = useCoreStore((state) => state.selectedProjectId);
  const projects = useCoreStore((state) => state.projects);
  const selectedAgentId = useCoreStore((state) => state.selectedAgentId);
  const selectAgent = useCoreStore((state) => state.selectAgent);
  const createAgent = useCoreStore((state) => state.createAgent);
  const deleteAgent = useCoreStore((state) => state.deleteAgent);
  const setActiveTab = useUIStore((state) => state.setActiveTab);
  const removeTab = useUIStore((state) => state.removeTab);

  // Derived state
  const currentProject = selectedProjectId ? projects.get(selectedProjectId) : undefined;
  const projectId = currentProject?.folderName || currentProject?.id;

  // Hydration tracking
  const lastLoadedProjectId = useRef<string | null>(null);

  // Generate tabs
  const tabs = useMemo(() => {
    if (!projectId) return [];

    const projectAgents = Array.from(agents.values()).filter(
      (agent) => agent.projectId === projectId
    );

    const agentTabs = projectAgents.map((agent) => agentToTab(agent, agent.id === selectedAgentId));

    const terminalTab = createSystemTab(
      TERMINAL_TAB_ID,
      'Terminal',
      'terminal',
      selectedAgentId === TERMINAL_TAB_ID
    );

    const changesTab = createSystemTab(
      CHANGES_TAB_ID,
      'Changes',
      'changes',
      selectedAgentId === CHANGES_TAB_ID
    );

    return [...agentTabs, terminalTab, changesTab];
  }, [agents, projectId, selectedAgentId]);

  const activeTab = useMemo(() => tabs.find((tab) => tab.isActive) || null, [tabs]);

  const switchToTab = useCallback(
    async (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;

      await selectAgent(tab.agentId);
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

      // Select the new agent which will update tabs
      await selectAgent(newAgent.id);
    } catch (error) {
      console.error('Failed to create new tab:', error);
    }
  }, [currentProject, tabs.length, projectId, createAgent, selectAgent, agents]);

  const closeTab = useCallback(
    async (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab || tabs.length <= 1) return;

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
      } catch (error) {
        console.error('Failed to close tab:', error);
      }
    },
    [tabs, selectAgent, removeTab]
  );

  // Feature flag for tabs - can be controlled via settings
  const isTabsEnabled = true;

  // Load saved active tab when project changes
  useEffect(() => {
    const loadSavedTab = async () => {
      // Skip if no project or no tabs
      if (!projectId || !tabs.length) return;

      // Skip if we've already loaded this project in this render cycle
      if (lastLoadedProjectId.current === projectId) return;

      try {
        const savedTabId = await window.electron.worktree.getActiveTab(projectId);
        if (savedTabId && tabs.some((tab) => tab.id === savedTabId)) {
          // Mark this project as loaded
          lastLoadedProjectId.current = projectId;
          await switchToTab(savedTabId);
        }
      } catch (error) {
        console.error('Failed to load saved tab:', error);
      }
    };

    void loadSavedTab();
  }, [projectId, tabs, switchToTab]);

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
