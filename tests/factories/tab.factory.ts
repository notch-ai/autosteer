/**
 * Tab Factory
 * Creates mock SessionTab objects for testing with customizable properties
 */

import { SessionTab } from '@/types/ui.types';

/**
 * Default tab configuration
 */
const DEFAULT_TAB: Omit<SessionTab, 'id'> = {
  agentId: 'test-agent-id',
  agentName: 'Test Tab',
  agentType: 'general',
  isActive: false,
  sessionId: 'test-session-id',
  lastAccessed: new Date(),
  tabType: 'agent',
};

/**
 * Create a test tab with optional overrides
 * @param overrides - Partial tab properties to override defaults
 * @returns Complete SessionTab object
 *
 * @example
 * ```typescript
 * const tab = createTestTab({ agentName: 'My Tab', isActive: true });
 * ```
 */
export function createTestTab(overrides?: Partial<SessionTab>): SessionTab {
  const id = overrides?.id || `test-tab-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  const tab: SessionTab = {
    ...DEFAULT_TAB,
    id,
    ...overrides,
  };

  console.log('[Tab Factory] Created test tab:', tab.id);
  return tab;
}

/**
 * Create multiple test tabs
 * @param count - Number of tabs to create
 * @param overrides - Partial tab properties to override defaults
 * @returns Array of SessionTab objects
 *
 * @example
 * ```typescript
 * const tabs = createTestTabs(5);
 * ```
 */
export function createTestTabs(count: number, overrides?: Partial<SessionTab>): SessionTab[] {
  console.log(`[Tab Factory] Creating ${count} test tabs`);
  return Array.from({ length: count }, (_, index) => {
    const timestamp = new Date(Date.now() + index * 1000);
    return createTestTab({
      id: `test-tab-${index}`,
      agentId: `test-agent-${index}`,
      agentName: `Test Tab ${index}`,
      sessionId: `test-session-${index}`,
      lastAccessed: timestamp,
      isActive: index === 0, // First tab is active by default
      ...overrides,
    });
  });
}

/**
 * Create an active tab
 * @param overrides - Partial tab properties to override defaults
 * @returns Active SessionTab
 */
export function createActiveTab(overrides?: Partial<SessionTab>): SessionTab {
  return createTestTab({
    ...overrides,
    isActive: true,
  });
}

/**
 * Create a terminal tab
 * @param overrides - Partial tab properties to override defaults
 * @returns Terminal SessionTab
 */
export function createTerminalTab(overrides?: Partial<SessionTab>): SessionTab {
  return createTestTab({
    id: 'terminal-tab',
    agentId: 'terminal-tab',
    agentName: 'Terminal',
    agentType: 'terminal',
    sessionId: 'terminal-session',
    tabType: 'terminal',
    ...overrides,
  });
}

/**
 * Create a changes tab
 * @param overrides - Partial tab properties to override defaults
 * @returns Changes SessionTab
 */
export function createChangesTab(overrides?: Partial<SessionTab>): SessionTab {
  return createTestTab({
    id: 'changes-tab',
    agentId: 'changes-tab',
    agentName: 'Changes',
    agentType: 'changes',
    sessionId: 'changes-session',
    tabType: 'changes',
    ...overrides,
  });
}

/**
 * Create agent tabs for a specific project
 * @param projectId - Project identifier
 * @param count - Number of agent tabs to create
 * @returns Array of SessionTab objects for the project
 */
export function createProjectTabs(projectId: string, count: number): SessionTab[] {
  return createTestTabs(count).map((tab, index) => ({
    ...tab,
    id: `${projectId}-tab-${index}`,
    agentId: `${projectId}-agent-${index}`,
    sessionId: `${projectId}-session-${index}`,
  }));
}
