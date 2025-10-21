import { useCallback, useMemo } from 'react';
import { useCoreStore } from '../stores/core';
import { useUIStore } from '../stores/ui';
import { SessionTab } from '../types/ui.types';
import { AgentType, AgentStatus } from '../entities/Agent';

export const useSessionTabs = () => {
  // Core store subscriptions for agents and projects
  const agents = useCoreStore((state) => state.agents);
  const selectedProjectId = useCoreStore((state) => state.selectedProjectId);
  const projects = useCoreStore((state) => state.projects);
  const selectedAgentId = useCoreStore((state) => state.selectedAgentId);
  const selectAgent = useCoreStore((state) => state.selectAgent);
  const createAgent = useCoreStore((state) => state.createAgent);
  const deleteAgent = useCoreStore((state) => state.deleteAgent);

  // UI store subscriptions for tab state
  const setActiveTab = useUIStore((state) => state.setActiveTab);
  const removeTab = useUIStore((state) => state.removeTab);

  // Get current project
  const currentProject = selectedProjectId ? projects.get(selectedProjectId) : undefined;
  const projectId = currentProject?.folderName || currentProject?.id;

  // Generate tabs from agents in current project
  const tabs = useMemo(() => {
    if (!projectId) return [];

    const projectAgents = Array.from(agents.values()).filter(
      (agent) => agent.projectId === projectId
    );

    const agentTabs = projectAgents.map(
      (agent): SessionTab => ({
        id: agent.id,
        agentId: agent.id,
        agentName: agent.title,
        agentType: agent.type || 'general',
        isActive: agent.id === selectedAgentId,
        sessionId: agent.id, // Use agent ID as session ID for now
        lastAccessed: agent.updatedAt || agent.createdAt,
        tabType: 'agent',
      })
    );

    // Add a terminal tab
    const terminalTab: SessionTab = {
      id: 'terminal-tab',
      agentId: 'terminal-tab',
      agentName: 'Terminal',
      agentType: 'terminal',
      isActive: selectedAgentId === 'terminal-tab',
      sessionId: 'terminal-session',
      lastAccessed: new Date(),
      tabType: 'terminal',
    };

    // Add a changes tab
    const changesTab: SessionTab = {
      id: 'changes-tab',
      agentId: 'changes-tab',
      agentName: 'Changes',
      agentType: 'changes',
      isActive: selectedAgentId === 'changes-tab',
      sessionId: 'changes-session',
      lastAccessed: new Date(),
      tabType: 'changes',
    };

    return [...agentTabs, terminalTab, changesTab];
  }, [agents, projectId, selectedAgentId]);

  const activeTab = useMemo(() => tabs.find((tab) => tab.isActive) || null, [tabs]);

  const switchToTab = useCallback(
    async (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (tab) {
        if (tab.tabType === 'terminal' || tab.tabType === 'changes') {
          // For terminal and changes tabs, we need to handle them differently
          // Set selectedAgentId to the tab ID so it shows as active
          await selectAgent(tab.agentId);
        } else {
          // For agent tabs, select the agent normally
          await selectAgent(tab.agentId);
        }
        setActiveTab(tabId);
      }
    },
    [tabs, selectAgent, setActiveTab]
  );

  const createNewTab = useCallback(async () => {
    if (!currentProject || !projectId || tabs.length >= 5) return;

    try {
      const newAgent = await createAgent({
        title: `Session ${tabs.length + 1}`,
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
  }, [currentProject, tabs.length, projectId, createAgent, selectAgent]);

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
