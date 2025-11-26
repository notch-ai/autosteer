/**
 * Tab Management Test Fixtures
 *
 * Pre-configured test data for tab management integration tests.
 * Provides realistic scenarios for testing per-project tab persistence,
 * cross-project isolation, and tab restoration flows.
 *
 * @see tests/integration/tab-management.integration.test.ts
 * @see tests/manual/tab-management-scenarios.md
 */

import { Project } from '@/types/project.types';
import { Agent } from '@/entities/Agent';
import { SessionTab } from '@/types/ui.types';
import { WorktreeConfig } from '@/types/config.types';
import { createTestProject, createTestAgent, createTestTab } from '../factories';
import { MAX_TABS, TERMINAL_TAB_ID, CHANGES_TAB_ID } from '@/constants/tabs';

/**
 * Complete test scenario with 2 projects, multiple agents, and configured tabs
 */
export interface TabManagementScenario {
  projects: Project[];
  agents: Map<string, Agent>;
  tabs: Map<string, SessionTab[]>; // projectId -> tabs
  activeTabIds: Map<string, string>; // projectId -> activeTabId
  worktreeConfigs: Map<string, Partial<WorktreeConfig>>; // projectId -> config
}

/**
 * Scenario 1: Two projects with different tab configurations
 *
 * Project Alpha:
 * - 3 agent tabs
 * - Active tab: Agent 2 (middle)
 * - System tabs: Terminal, Changes
 *
 * Project Beta:
 * - 5 agent tabs
 * - Active tab: Agent 4 (near end)
 * - System tabs: Terminal, Changes
 */
export function createTwoProjectScenario(): TabManagementScenario {
  // Create projects
  const projectAlpha = createTestProject({
    id: 'project-alpha',
    name: 'Project Alpha',
    folderName: 'project-alpha',
    localPath: '/Users/test/projects/project-alpha',
  });

  const projectBeta = createTestProject({
    id: 'project-beta',
    name: 'Project Beta',
    folderName: 'project-beta',
    localPath: '/Users/test/projects/project-beta',
  });

  const projects = [projectAlpha, projectBeta];

  // Create agents for Project Alpha (3 agents)
  const alphaAgents = [
    createTestAgent({
      id: 'alpha-agent-1',
      title: 'Alpha Agent 1',
      projectId: 'project-alpha',
    }),
    createTestAgent({
      id: 'alpha-agent-2',
      title: 'Alpha Agent 2',
      projectId: 'project-alpha',
    }),
    createTestAgent({
      id: 'alpha-agent-3',
      title: 'Alpha Agent 3',
      projectId: 'project-alpha',
    }),
  ];

  // Create agents for Project Beta (5 agents)
  const betaAgents = [
    createTestAgent({
      id: 'beta-agent-1',
      title: 'Beta Agent 1',
      projectId: 'project-beta',
    }),
    createTestAgent({
      id: 'beta-agent-2',
      title: 'Beta Agent 2',
      projectId: 'project-beta',
    }),
    createTestAgent({
      id: 'beta-agent-3',
      title: 'Beta Agent 3',
      projectId: 'project-beta',
    }),
    createTestAgent({
      id: 'beta-agent-4',
      title: 'Beta Agent 4',
      projectId: 'project-beta',
    }),
    createTestAgent({
      id: 'beta-agent-5',
      title: 'Beta Agent 5',
      projectId: 'project-beta',
    }),
  ];

  // Build agents map
  const agents = new Map<string, Agent>();
  [...alphaAgents, ...betaAgents].forEach((agent) => agents.set(agent.id, agent));

  // Create tabs for Project Alpha
  const alphaTabs: SessionTab[] = [
    createTestTab({
      id: alphaAgents[0].id,
      agentId: alphaAgents[0].id,
      agentName: alphaAgents[0].title,
      isActive: false,
      tabType: 'agent',
    }),
    createTestTab({
      id: alphaAgents[1].id,
      agentId: alphaAgents[1].id,
      agentName: alphaAgents[1].title,
      isActive: true, // Active tab
      tabType: 'agent',
    }),
    createTestTab({
      id: alphaAgents[2].id,
      agentId: alphaAgents[2].id,
      agentName: alphaAgents[2].title,
      isActive: false,
      tabType: 'agent',
    }),
    createTestTab({
      id: TERMINAL_TAB_ID,
      agentId: TERMINAL_TAB_ID,
      agentName: 'Terminal',
      agentType: 'terminal',
      isActive: false,
      tabType: 'terminal',
    }),
    createTestTab({
      id: CHANGES_TAB_ID,
      agentId: CHANGES_TAB_ID,
      agentName: 'Changes',
      agentType: 'changes',
      isActive: false,
      tabType: 'changes',
    }),
  ];

  // Create tabs for Project Beta
  const betaTabs: SessionTab[] = [
    ...betaAgents.map((agent, index) =>
      createTestTab({
        id: agent.id,
        agentId: agent.id,
        agentName: agent.title,
        isActive: index === 3, // Agent 4 is active
        tabType: 'agent',
      })
    ),
    createTestTab({
      id: TERMINAL_TAB_ID,
      agentId: TERMINAL_TAB_ID,
      agentName: 'Terminal',
      agentType: 'terminal',
      isActive: false,
      tabType: 'terminal',
    }),
    createTestTab({
      id: CHANGES_TAB_ID,
      agentId: CHANGES_TAB_ID,
      agentName: 'Changes',
      agentType: 'changes',
      isActive: false,
      tabType: 'changes',
    }),
  ];

  // Build tabs map
  const tabs = new Map<string, SessionTab[]>();
  tabs.set('project-alpha', alphaTabs);
  tabs.set('project-beta', betaTabs);

  // Build active tab IDs map
  const activeTabIds = new Map<string, string>();
  activeTabIds.set('project-alpha', 'alpha-agent-2');
  activeTabIds.set('project-beta', 'beta-agent-4');

  // Build worktree configs map
  const worktreeConfigs = new Map<string, Partial<WorktreeConfig>>();
  worktreeConfigs.set('project-alpha', {
    folder_name: 'project-alpha',
    git_repo: '',
    branch_name: '',
    activeTabId: 'alpha-agent-2',
  });
  worktreeConfigs.set('project-beta', {
    folder_name: 'project-beta',
    git_repo: '',
    branch_name: '',
    activeTabId: 'beta-agent-4',
  });

  return {
    projects,
    agents,
    tabs,
    activeTabIds,
    worktreeConfigs,
  };
}

/**
 * Scenario 2: Max capacity scenario - project at MAX_TABS limit
 *
 * Project at max capacity with 10 tabs.
 * Tests behavior when trying to create 11th tab or delete tabs.
 */
export function createMaxCapacityScenario(): TabManagementScenario {
  const project = createTestProject({
    id: 'project-max',
    name: 'Project Max Capacity',
    folderName: 'project-max',
    localPath: '/Users/test/projects/project-max',
  });

  // Create MAX_TABS agents (10 total)
  const maxAgents = Array.from({ length: MAX_TABS }, (_, index) =>
    createTestAgent({
      id: `max-agent-${index + 1}`,
      title: `Max Agent ${index + 1}`,
      projectId: 'project-max',
    })
  );

  const agents = new Map<string, Agent>();
  maxAgents.forEach((agent) => agents.set(agent.id, agent));

  // Create tabs (all agent tabs, no room for maximize tabs)
  const maxTabs: SessionTab[] = [
    ...maxAgents.map((agent, index) =>
      createTestTab({
        id: agent.id,
        agentId: agent.id,
        agentName: agent.title,
        isActive: index === 4, // Middle tab active
        tabType: 'agent',
      })
    ),
  ];

  const tabs = new Map<string, SessionTab[]>();
  tabs.set('project-max', maxTabs);

  const activeTabIds = new Map<string, string>();
  activeTabIds.set('project-max', 'max-agent-5');

  const worktreeConfigs = new Map<string, Partial<WorktreeConfig>>();
  worktreeConfigs.set('project-max', {
    folder_name: 'project-max',
    git_repo: '',
    branch_name: '',
    activeTabId: 'max-agent-5',
  });

  return {
    projects: [project],
    agents,
    tabs,
    activeTabIds,
    worktreeConfigs,
  };
}

/**
 * Scenario 3: Empty project scenario
 *
 * Project with no agent tabs, only system tabs.
 * Tests behavior when project has no agents.
 */
export function createEmptyProjectScenario(): TabManagementScenario {
  const project = createTestProject({
    id: 'project-empty',
    name: 'Empty Project',
    folderName: 'project-empty',
    localPath: '/Users/test/projects/project-empty',
  });

  const agents = new Map<string, Agent>();

  // Only system tabs, no agent tabs
  const emptyTabs: SessionTab[] = [
    createTestTab({
      id: TERMINAL_TAB_ID,
      agentId: TERMINAL_TAB_ID,
      agentName: 'Terminal',
      agentType: 'terminal',
      isActive: true, // Terminal tab active by default
      tabType: 'terminal',
    }),
    createTestTab({
      id: CHANGES_TAB_ID,
      agentId: CHANGES_TAB_ID,
      agentName: 'Changes',
      agentType: 'changes',
      isActive: false,
      tabType: 'changes',
    }),
  ];

  const tabs = new Map<string, SessionTab[]>();
  tabs.set('project-empty', emptyTabs);

  const activeTabIds = new Map<string, string>();
  activeTabIds.set('project-empty', TERMINAL_TAB_ID);

  const worktreeConfigs = new Map<string, Partial<WorktreeConfig>>();
  worktreeConfigs.set('project-empty', {
    folder_name: 'project-empty',
    git_repo: '',
    branch_name: '',
    activeTabId: TERMINAL_TAB_ID,
  });

  return {
    projects: [project],
    agents,
    tabs,
    activeTabIds,
    worktreeConfigs,
  };
}

/**
 * Scenario 4: Multi-project isolation test
 *
 * 3 projects with different tab counts to verify isolation.
 *
 * Project X: 5 tabs (active: tab 3)
 * Project Y: 2 tabs (active: tab 1)
 * Project Z: 8 tabs (active: tab 6)
 */
export function createMultiProjectIsolationScenario(): TabManagementScenario {
  const projectX = createTestProject({
    id: 'project-x',
    name: 'Project X',
    folderName: 'project-x',
  });

  const projectY = createTestProject({
    id: 'project-y',
    name: 'Project Y',
    folderName: 'project-y',
  });

  const projectZ = createTestProject({
    id: 'project-z',
    name: 'Project Z',
    folderName: 'project-z',
  });

  const projects = [projectX, projectY, projectZ];

  // Create agents
  const createProjectAgents = (projectId: string, count: number) => {
    return Array.from({ length: count }, (_, index) =>
      createTestAgent({
        id: `${projectId}-agent-${index + 1}`,
        title: `${projectId.toUpperCase()} Agent ${index + 1}`,
        projectId,
      })
    );
  };

  const xAgents = createProjectAgents('project-x', 5);
  const yAgents = createProjectAgents('project-y', 2);
  const zAgents = createProjectAgents('project-z', 8);

  const agents = new Map<string, Agent>();
  [...xAgents, ...yAgents, ...zAgents].forEach((agent) => agents.set(agent.id, agent));

  // Create tabs
  const createProjectTabs = (projectAgents: Agent[], activeIndex: number): SessionTab[] => {
    return [
      ...projectAgents.map((agent, index) =>
        createTestTab({
          id: agent.id,
          agentId: agent.id,
          agentName: agent.title,
          isActive: index === activeIndex,
          tabType: 'agent',
        })
      ),
      createTestTab({
        id: TERMINAL_TAB_ID,
        agentId: TERMINAL_TAB_ID,
        agentName: 'Terminal',
        agentType: 'terminal',
        isActive: false,
        tabType: 'terminal',
      }),
      createTestTab({
        id: CHANGES_TAB_ID,
        agentId: CHANGES_TAB_ID,
        agentName: 'Changes',
        agentType: 'changes',
        isActive: false,
        tabType: 'changes',
      }),
    ];
  };

  const tabs = new Map<string, SessionTab[]>();
  tabs.set('project-x', createProjectTabs(xAgents, 2)); // Tab 3 active
  tabs.set('project-y', createProjectTabs(yAgents, 0)); // Tab 1 active
  tabs.set('project-z', createProjectTabs(zAgents, 5)); // Tab 6 active

  const activeTabIds = new Map<string, string>();
  activeTabIds.set('project-x', 'project-x-agent-3');
  activeTabIds.set('project-y', 'project-y-agent-1');
  activeTabIds.set('project-z', 'project-z-agent-6');

  const worktreeConfigs = new Map<string, Partial<WorktreeConfig>>();
  worktreeConfigs.set('project-x', {
    folder_name: 'project-x',
    git_repo: '',
    branch_name: '',
    activeTabId: 'project-x-agent-3',
  });
  worktreeConfigs.set('project-y', {
    folder_name: 'project-y',
    git_repo: '',
    branch_name: '',
    activeTabId: 'project-y-agent-1',
  });
  worktreeConfigs.set('project-z', {
    folder_name: 'project-z',
    git_repo: '',
    branch_name: '',
    activeTabId: 'project-z-agent-6',
  });

  return {
    projects,
    agents,
    tabs,
    activeTabIds,
    worktreeConfigs,
  };
}

/**
 * IPC Mock Responses
 * Pre-configured responses for window.electron.worktree mocks
 */
export const mockIpcResponses = {
  /**
   * Mock response for getActiveTab - returns stored activeTabId
   */
  getActiveTab: (projectId: string, activeTabIds: Map<string, string>): string | null => {
    return activeTabIds.get(projectId) || null;
  },

  /**
   * Mock response for setActiveTab - simulates successful persistence
   */
  setActiveTab: async (_projectId: string, _tabId: string): Promise<void> => {
    // Simulate async IPC call
    return Promise.resolve();
  },

  /**
   * Mock response for getActiveTab with error
   */
  getActiveTabError: async (_projectId: string): Promise<never> => {
    throw new Error('Failed to load active tab from config');
  },

  /**
   * Mock response for setActiveTab with error
   */
  setActiveTabError: async (_projectId: string, _tabId: string): Promise<never> => {
    throw new Error('Failed to save active tab to config');
  },
};

/**
 * Test Helpers
 */

/**
 * Convert scenario to store states for easy setup
 */
export function scenarioToStoreStates(scenario: TabManagementScenario) {
  return {
    projectsState: {
      projects: new Map(scenario.projects.map((p) => [p.id, p])),
      selectedProjectId: scenario.projects[0]?.id || null,
    },
    agentsState: {
      agents: scenario.agents,
      selectedAgentId: Array.from(scenario.agents.values())[0]?.id || null,
    },
    uiState: {
      tabState: scenario.projects[0]
        ? {
            tabs: scenario.tabs.get(scenario.projects[0].id) || [],
            activeTabId: scenario.activeTabIds.get(scenario.projects[0].id) || '',
            maxTabs: MAX_TABS,
          }
        : null,
    },
  };
}

/**
 * Assert tab state matches expected scenario
 */
export function assertTabStateMatchesScenario(
  actualTabs: SessionTab[],
  expectedTabs: SessionTab[]
) {
  // Check tab count
  expect(actualTabs.length).toBe(expectedTabs.length);

  // Check each tab
  actualTabs.forEach((actualTab, index) => {
    const expectedTab = expectedTabs[index];
    expect(actualTab.id).toBe(expectedTab.id);
    expect(actualTab.agentId).toBe(expectedTab.agentId);
    expect(actualTab.isActive).toBe(expectedTab.isActive);
    expect(actualTab.tabType).toBe(expectedTab.tabType);
  });
}
