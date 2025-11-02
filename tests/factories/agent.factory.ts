/**
 * Agent Factory
 * Creates mock Agent objects for testing with customizable properties
 */

import { Agent, AgentStatus, AgentType, ChatMessage } from '@/entities';

/**
 * Default agent configuration
 */
const DEFAULT_AGENT = {
  id: 'test-agent-id',
  title: 'Test Agent',
  content: 'Test agent content for development',
  preview: 'Test agent preview',
  type: AgentType.TEXT,
  status: AgentStatus.DRAFT,
  tags: [] as string[],
  resourceIds: [] as string[],
  projectId: 'test-project-id',
};

/**
 * Create a test agent with optional overrides
 * @param overrides - Partial agent properties to override defaults
 * @returns Complete Agent object
 *
 * @example
 * ```typescript
 * const agent = createTestAgent({ title: 'My Custom Agent' });
 * ```
 */
export function createTestAgent(overrides?: Partial<Agent>): Agent {
  const now = new Date();
  const agent: Agent = {
    ...DEFAULT_AGENT,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };

  console.log('[Agent Factory] Created test agent:', agent.id);
  return agent;
}

/**
 * Create multiple test agents
 * @param count - Number of agents to create
 * @param overrides - Partial agent properties to override defaults
 * @returns Array of Agent objects
 *
 * @example
 * ```typescript
 * const agents = createTestAgents(5, { status: 'active' });
 * ```
 */
export function createTestAgents(count: number, overrides?: Partial<Agent>): Agent[] {
  console.log(`[Agent Factory] Creating ${count} test agents`);
  return Array.from({ length: count }, (_, index) => {
    const timestamp = new Date(Date.now() + index * 1000);
    return createTestAgent({
      id: `test-agent-${index}`,
      title: `Test Agent ${index}`,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...overrides,
    });
  });
}

/**
 * Create an agent with chat history
 * @param messageCount - Number of messages in chat history
 * @param overrides - Partial agent properties to override defaults
 * @returns Agent with populated chat history
 *
 * @example
 * ```typescript
 * const agent = createAgentWithHistory(10);
 * ```
 */
export function createAgentWithHistory(messageCount: number, overrides?: Partial<Agent>): Agent {
  const chatHistory: ChatMessage[] = Array.from({ length: messageCount }, (_, index) => ({
    id: `msg-${index}`,
    role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
    content: `Test message ${index}`,
    timestamp: new Date(Date.now() + index * 1000),
    attachedResources: [],
  }));

  console.log(`[Agent Factory] Created agent with ${messageCount} messages`);
  return createTestAgent({
    ...overrides,
    chatHistory,
  });
}

/**
 * Create an active agent (status: active)
 * @param overrides - Partial agent properties to override defaults
 * @returns Active Agent
 */
export function createActiveAgent(overrides?: Partial<Agent>): Agent {
  return createTestAgent({
    ...overrides,
    status: AgentStatus.IN_PROGRESS,
  });
}

/**
 * Create an idle agent (status: idle)
 * @param overrides - Partial agent properties to override defaults
 * @returns Idle Agent
 */
export function createIdleAgent(overrides?: Partial<Agent>): Agent {
  return createTestAgent({
    ...overrides,
    status: AgentStatus.DRAFT,
  });
}

/**
 * Create an archived agent (status: archived)
 * @param overrides - Partial agent properties to override defaults
 * @returns Archived Agent
 */
export function createArchivedAgent(overrides?: Partial<Agent>): Agent {
  return createTestAgent({
    ...overrides,
    status: AgentStatus.ARCHIVED,
  });
}

/**
 * Create an agent with specific tags
 * @param tags - Array of tag strings
 * @param overrides - Partial agent properties to override defaults
 * @returns Agent with tags
 */
export function createAgentWithTags(tags: string[], overrides?: Partial<Agent>): Agent {
  return createTestAgent({
    ...overrides,
    tags,
  });
}

/**
 * Create an agent with metadata
 * @param metadata - Metadata object
 * @param overrides - Partial agent properties to override defaults
 * @returns Agent with metadata
 */
export function createAgentWithMetadata(
  metadata: Record<string, unknown>,
  overrides?: Partial<Agent>
): Agent {
  return createTestAgent({
    ...overrides,
    metadata,
  });
}
