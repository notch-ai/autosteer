/**
 * Agent Store Tests - Characterization Tests
 *
 * Test-first approach for agents.store.ts extraction from core.ts
 *
 * Coverage requirements:
 * - 100% action coverage
 * - Multi-agent session isolation (ADR-006)
 * - Edge cases (duplicate names, missing IDs, concurrent operations)
 */

// Mock electron-log/renderer before any imports
jest.mock('electron-log/renderer', () => {
  const mockLog: any = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    silly: jest.fn(),
    log: jest.fn(),
    transports: {
      file: { level: false, format: '', maxSize: 0 },
      console: { level: false, format: '' },
    },
    initialize: jest.fn(),
    scope: jest.fn(function (this: any) {
      return this;
    }),
  };
  return { __esModule: true, default: mockLog };
});

import { Agent, AgentStatus, AgentType } from '@/entities';
import { useAgentsStore } from '@/stores';
import { createTestAgent, createTestAgents } from '../../../tests/factories';
import { act, renderHook } from '@testing-library/react';

// Helper function to safely add agent to store
const addAgentToStore = (agent: Agent) => {
  act(() => {
    const currentAgents = new Map(useAgentsStore.getState().agents);
    currentAgents.set(agent.id, agent);
    useAgentsStore.setState({ agents: currentAgents });
  });
};

// Helper function to set selected agent
const setSelectedAgent = (agentId: string | null) => {
  act(() => {
    useAgentsStore.setState({ selectedAgentId: agentId });
  });
};

describe('AgentsStore', () => {
  beforeEach(() => {
    // Reset store state before each test using setState
    act(() => {
      useAgentsStore.setState({
        agents: new Map(),
        selectedAgentId: null,
        agentsLoading: false,
        agentsError: null,
      });
    });

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('State Initialization', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useAgentsStore());

      expect(result.current.agents.size).toBe(0);
      expect(result.current.selectedAgentId).toBeNull();
      expect(result.current.agentsLoading).toBe(false);
      expect(result.current.agentsError).toBeNull();
    });
  });

  describe('loadAgents', () => {
    it('should set loading state while loading agents', async () => {
      const mockAgents = createTestAgents(3);

      // Mock Electron IPC
      global.window.electron = {
        agents: {
          loadAll: jest.fn().mockResolvedValue(mockAgents),
        },
      } as any;

      const { result } = renderHook(() => useAgentsStore());

      act(() => {
        result.current.loadAgents();
      });

      // Should set loading immediately
      expect(result.current.agentsLoading).toBe(true);
      expect(result.current.agentsError).toBeNull();

      // Wait for async operation
      await act(async () => {
        await result.current.loadAgents();
      });

      expect(result.current.agentsLoading).toBe(false);
      expect(result.current.agents.size).toBe(3);
    });

    it('should load agents from Electron IPC', async () => {
      const mockAgents = createTestAgents(5);

      global.window.electron = {
        agents: {
          loadAll: jest.fn().mockResolvedValue(mockAgents),
        },
      } as any;

      const { result } = renderHook(() => useAgentsStore());

      await act(async () => {
        await result.current.loadAgents();
      });

      expect(result.current.agents.size).toBe(5);
      expect(global.window.electron.agents.loadAll).toHaveBeenCalledTimes(1);
    });

    it('should handle loading errors gracefully', async () => {
      const errorMessage = 'Failed to load agents from disk';

      global.window.electron = {
        agents: {
          loadAll: jest.fn().mockRejectedValue(new Error(errorMessage)),
        },
      } as any;

      const { result } = renderHook(() => useAgentsStore());

      await act(async () => {
        await result.current.loadAgents();
      });

      expect(result.current.agentsLoading).toBe(false);
      expect(result.current.agentsError).toBe(errorMessage);
      expect(result.current.agents.size).toBe(0);
    });

    it('should handle missing Electron API gracefully', async () => {
      // @ts-expect-error - Testing missing API scenario
      global.window.electron = undefined;

      const { result } = renderHook(() => useAgentsStore());

      await act(async () => {
        await result.current.loadAgents();
      });

      expect(result.current.agentsLoading).toBe(false);
      expect(result.current.agentsError).toBeNull();
      expect(result.current.agents.size).toBe(0);
    });
  });

  describe('createAgent', () => {
    it('should create a new agent with provided config', async () => {
      const mockAgent = createTestAgent({ title: 'New Agent' });

      global.window.electron = {
        agents: {
          create: jest.fn().mockResolvedValue(mockAgent),
        },
      } as any;

      const { result } = renderHook(() => useAgentsStore());

      let createdAgent: Agent | undefined;
      await act(async () => {
        createdAgent = await result.current.createAgent({
          title: 'New Agent',
          content: 'Test content',
          type: AgentType.TEXT,
          status: AgentStatus.DRAFT,
        });
      });

      expect(createdAgent).toBeDefined();
      expect(createdAgent!.title).toBe('New Agent');
      expect(result.current.agents.size).toBe(1);
      expect(result.current.agents.get(mockAgent.id)).toEqual(mockAgent);
    });

    it('should generate unique IDs for new agents', async () => {
      global.window.electron = {
        agents: {
          create: jest.fn().mockImplementation((agent) => Promise.resolve(agent)),
        },
      } as any;

      const { result } = renderHook(() => useAgentsStore());

      let agent1: Agent | undefined;
      let agent2: Agent | undefined;

      await act(async () => {
        agent1 = await result.current.createAgent({
          title: 'Agent 1',
          content: 'Content 1',
          type: AgentType.TEXT,
        });
      });

      await act(async () => {
        agent2 = await result.current.createAgent({
          title: 'Agent 2',
          content: 'Content 2',
          type: AgentType.TEXT,
        });
      });

      expect(agent1!.id).not.toBe(agent2!.id);
      expect(result.current.agents.size).toBe(2);
    });

    it('should include timestamps on creation', async () => {
      global.window.electron = {
        agents: {
          create: jest.fn().mockImplementation((agent) => Promise.resolve(agent)),
        },
      } as any;

      const { result } = renderHook(() => useAgentsStore());

      let createdAgent: Agent | undefined;
      await act(async () => {
        createdAgent = await result.current.createAgent({
          title: 'Timestamped Agent',
          content: 'Content',
          type: AgentType.TEXT,
        });
      });

      expect(createdAgent!.createdAt).toBeInstanceOf(Date);
      expect(createdAgent!.updatedAt).toBeInstanceOf(Date);
    });

    it('should set error state on creation failure', async () => {
      const errorMessage = 'Failed to create agent';

      global.window.electron = {
        agents: {
          create: jest.fn().mockRejectedValue(new Error(errorMessage)),
        },
      } as any;

      const { result } = renderHook(() => useAgentsStore());

      try {
        await act(async () => {
          await result.current.createAgent({
            title: 'Failed Agent',
            content: 'Content',
            type: AgentType.TEXT,
          });
        });
      } catch (error) {
        // Expected to throw
      }

      // Get fresh state after error
      const state = useAgentsStore.getState();
      expect(state.agentsError).toBe(errorMessage);
    });

    it('should support optional projectId in config', async () => {
      global.window.electron = {
        agents: {
          create: jest.fn().mockImplementation((agent) => Promise.resolve(agent)),
        },
      } as any;

      const { result } = renderHook(() => useAgentsStore());

      let createdAgent: Agent | undefined;
      await act(async () => {
        createdAgent = await result.current.createAgent({
          title: 'Project Agent',
          content: 'Content',
          type: AgentType.TEXT,
          projectId: 'project-123',
        });
      });

      expect(createdAgent!.projectId).toBe('project-123');
    });
  });

  describe('updateAgent', () => {
    it('should update an existing agent', async () => {
      const mockAgent = createTestAgent({ title: 'Original Title' });

      global.window.electron = {
        agents: {
          update: jest.fn().mockResolvedValue(undefined),
        },
      } as any;

      const { result } = renderHook(() => useAgentsStore());

      // Add agent to store first
      act(() => {
        addAgentToStore(mockAgent);
      });

      await act(async () => {
        await result.current.updateAgent(mockAgent.id, { title: 'Updated Title' });
      });

      const updatedAgent = result.current.agents.get(mockAgent.id);
      expect(updatedAgent!.title).toBe('Updated Title');
      expect(global.window.electron.agents.update).toHaveBeenCalledWith(mockAgent.id, {
        title: 'Updated Title',
      });
    });

    it('should update the updatedAt timestamp', async () => {
      const mockAgent = createTestAgent();
      const originalUpdatedAt = mockAgent.updatedAt;

      global.window.electron = {
        agents: {
          update: jest.fn().mockResolvedValue(undefined),
        },
      } as any;

      const { result } = renderHook(() => useAgentsStore());

      act(() => {
        addAgentToStore(mockAgent);
      });

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await act(async () => {
        await result.current.updateAgent(mockAgent.id, { content: 'New content' });
      });

      const updatedAgent = result.current.agents.get(mockAgent.id);
      expect(updatedAgent!.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should throw error for non-existent agent', async () => {
      const { result } = renderHook(() => useAgentsStore());

      await expect(
        act(async () => {
          await result.current.updateAgent('non-existent-id', { title: 'Updated' });
        })
      ).rejects.toThrow('Agent with id non-existent-id not found');
    });

    it('should set error state on update failure', async () => {
      const mockAgent = createTestAgent();
      const errorMessage = 'Failed to update agent';

      global.window.electron = {
        agents: {
          update: jest.fn().mockRejectedValue(new Error(errorMessage)),
        },
      } as any;

      const { result } = renderHook(() => useAgentsStore());

      act(() => {
        addAgentToStore(mockAgent);
      });

      try {
        await act(async () => {
          await result.current.updateAgent(mockAgent.id, { title: 'Updated' });
        });
      } catch (error) {
        // Expected to throw
      }

      // Get fresh state after error
      const state = useAgentsStore.getState();
      expect(state.agentsError).toBe(errorMessage);
    });
  });

  describe('deleteAgent', () => {
    it('should delete an existing agent', async () => {
      const mockAgent = createTestAgent();

      global.window.electron = {
        agents: {
          delete: jest.fn().mockResolvedValue(undefined),
        },
      } as any;

      const { result } = renderHook(() => useAgentsStore());

      act(() => {
        addAgentToStore(mockAgent);
      });

      expect(result.current.agents.size).toBe(1);

      await act(async () => {
        await result.current.deleteAgent(mockAgent.id);
      });

      expect(result.current.agents.size).toBe(0);
      expect(global.window.electron.agents.delete).toHaveBeenCalledWith(mockAgent.id);
    });

    it('should clear selectedAgentId if deleting selected agent', async () => {
      const mockAgent = createTestAgent();

      global.window.electron = {
        agents: {
          delete: jest.fn().mockResolvedValue(undefined),
        },
      } as any;

      const { result } = renderHook(() => useAgentsStore());

      act(() => {
        addAgentToStore(mockAgent);
        setSelectedAgent(mockAgent.id);
      });

      await act(async () => {
        await result.current.deleteAgent(mockAgent.id);
      });

      expect(result.current.selectedAgentId).toBeNull();
    });

    it('should not clear selectedAgentId if deleting non-selected agent', async () => {
      const agent1 = createTestAgent({ id: 'agent-1' });
      const agent2 = createTestAgent({ id: 'agent-2' });

      global.window.electron = {
        agents: {
          delete: jest.fn().mockResolvedValue(undefined),
        },
      } as any;

      const { result } = renderHook(() => useAgentsStore());

      act(() => {
        addAgentToStore(agent1);
        addAgentToStore(agent2);
        setSelectedAgent(agent1.id);
      });

      await act(async () => {
        await result.current.deleteAgent(agent2.id);
      });

      expect(result.current.selectedAgentId).toBe(agent1.id);
    });

    it('should set error state on deletion failure', async () => {
      const mockAgent = createTestAgent();
      const errorMessage = 'Failed to delete session';

      global.window.electron = {
        agents: {
          delete: jest.fn().mockRejectedValue(new Error(errorMessage)),
        },
      } as any;

      const { result } = renderHook(() => useAgentsStore());

      act(() => {
        addAgentToStore(mockAgent);
      });

      try {
        await act(async () => {
          await result.current.deleteAgent(mockAgent.id);
        });
      } catch (error) {
        // Expected to throw
      }

      // Get fresh state after error
      const state = useAgentsStore.getState();
      expect(state.agentsError).toBe(errorMessage);
    });
  });

  describe('selectAgent', () => {
    it('should select an agent by ID', async () => {
      const mockAgent = createTestAgent();
      const { result } = renderHook(() => useAgentsStore());

      act(() => {
        addAgentToStore(mockAgent);
      });

      await act(async () => {
        await result.current.selectAgent(mockAgent.id);
      });

      expect(result.current.selectedAgentId).toBe(mockAgent.id);
    });

    it('should allow deselecting by passing null', async () => {
      const mockAgent = createTestAgent();
      const { result } = renderHook(() => useAgentsStore());

      act(() => {
        addAgentToStore(mockAgent);
        setSelectedAgent(mockAgent.id);
      });

      await act(async () => {
        await result.current.selectAgent(null);
      });

      expect(result.current.selectedAgentId).toBeNull();
    });

    it('should support selecting non-existent agent (graceful handling)', async () => {
      const { result } = renderHook(() => useAgentsStore());

      await act(async () => {
        await result.current.selectAgent('non-existent-id');
      });

      // Should set the ID even if agent doesn't exist (lazy loading pattern)
      expect(result.current.selectedAgentId).toBe('non-existent-id');
    });
  });

  describe('Selectors', () => {
    describe('getAgent', () => {
      it('should return agent by ID', () => {
        const mockAgent = createTestAgent();
        const { result } = renderHook(() => useAgentsStore());

        act(() => {
          addAgentToStore(mockAgent);
        });

        const agent = result.current.getAgent(mockAgent.id);
        expect(agent).toEqual(mockAgent);
      });

      it('should return null for non-existent agent', () => {
        const { result } = renderHook(() => useAgentsStore());

        const agent = result.current.getAgent('non-existent-id');
        expect(agent).toBeNull();
      });
    });

    describe('getSelectedAgent', () => {
      it('should return currently selected agent', () => {
        const mockAgent = createTestAgent();
        const { result } = renderHook(() => useAgentsStore());

        act(() => {
          addAgentToStore(mockAgent);
          setSelectedAgent(mockAgent.id);
        });

        const selected = result.current.getSelectedAgent();
        expect(selected).toEqual(mockAgent);
      });

      it('should return null when no agent is selected', () => {
        const { result } = renderHook(() => useAgentsStore());

        const selected = result.current.getSelectedAgent();
        expect(selected).toBeNull();
      });

      it('should return null when selected agent does not exist', () => {
        const { result } = renderHook(() => useAgentsStore());

        act(() => {
          setSelectedAgent('non-existent-id');
        });

        const selected = result.current.getSelectedAgent();
        expect(selected).toBeNull();
      });
    });
  });

  describe('Multi-Agent Session Isolation (ADR-006)', () => {
    it('should maintain separate state for multiple agents', async () => {
      // Create test agents for reference (not used directly in test)
      createTestAgent({ id: 'agent-1', title: 'Agent 1' });
      createTestAgent({ id: 'agent-2', title: 'Agent 2' });

      global.window.electron = {
        agents: {
          create: jest.fn().mockImplementation((agent) => Promise.resolve(agent)),
        },
      } as any;

      const { result } = renderHook(() => useAgentsStore());

      await act(async () => {
        await result.current.createAgent({
          title: 'Agent 1',
          content: 'Content 1',
          type: AgentType.TEXT,
          projectId: 'project-1',
        });

        await result.current.createAgent({
          title: 'Agent 2',
          content: 'Content 2',
          type: AgentType.TEXT,
          projectId: 'project-1',
        });
      });

      expect(result.current.agents.size).toBe(2);
    });

    it('should support up to 5 concurrent agents per worktree', async () => {
      const agents = createTestAgents(5, { projectId: 'worktree-1' });

      global.window.electron = {
        agents: {
          create: jest.fn().mockImplementation((agent) => Promise.resolve(agent)),
        },
      } as any;

      const { result } = renderHook(() => useAgentsStore());

      for (const agent of agents) {
        await act(async () => {
          await result.current.createAgent({
            title: agent.title,
            content: agent.content,
            type: agent.type,
            projectId: 'worktree-1',
          });
        });
      }

      const worktreeAgents = Array.from(result.current.agents.values()).filter(
        (a) => a.projectId === 'worktree-1'
      );

      expect(worktreeAgents.length).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle duplicate agent names gracefully', async () => {
      global.window.electron = {
        agents: {
          create: jest.fn().mockImplementation((agent) => Promise.resolve(agent)),
        },
      } as any;

      const { result } = renderHook(() => useAgentsStore());

      await act(async () => {
        await result.current.createAgent({
          title: 'Duplicate Name',
          content: 'Content 1',
          type: AgentType.TEXT,
        });
      });

      await act(async () => {
        await result.current.createAgent({
          title: 'Duplicate Name',
          content: 'Content 2',
          type: AgentType.TEXT,
        });
      });

      expect(result.current.agents.size).toBe(2);
      // Both agents should exist despite having the same name
      const agents = Array.from(result.current.agents.values());
      expect(agents[0].title).toBe('Duplicate Name');
      expect(agents[1].title).toBe('Duplicate Name');
      // But they should have different IDs
      expect(agents[0].id).not.toBe(agents[1].id);
    });

    it('should handle concurrent create operations', async () => {
      global.window.electron = {
        agents: {
          create: jest
            .fn()
            .mockImplementation(
              (agent) => new Promise((resolve) => setTimeout(() => resolve(agent), 10))
            ),
        },
      } as any;

      const { result } = renderHook(() => useAgentsStore());

      await act(async () => {
        await Promise.all([
          result.current.createAgent({
            title: 'Concurrent Agent 1',
            content: 'Content 1',
            type: AgentType.TEXT,
          }),
          result.current.createAgent({
            title: 'Concurrent Agent 2',
            content: 'Content 2',
            type: AgentType.TEXT,
          }),
          result.current.createAgent({
            title: 'Concurrent Agent 3',
            content: 'Content 3',
            type: AgentType.TEXT,
          }),
        ]);
      });

      expect(result.current.agents.size).toBe(3);
    });

    it('should handle concurrent update operations on same agent', async () => {
      const mockAgent = createTestAgent();

      global.window.electron = {
        agents: {
          update: jest
            .fn()
            .mockImplementation(
              () => new Promise((resolve) => setTimeout(() => resolve(undefined), 10))
            ),
        },
      } as any;

      const { result } = renderHook(() => useAgentsStore());

      act(() => {
        addAgentToStore(mockAgent);
      });

      await act(async () => {
        await Promise.all([
          result.current.updateAgent(mockAgent.id, { title: 'Update 1' }),
          result.current.updateAgent(mockAgent.id, { content: 'Update 2' }),
        ]);
      });

      // Last update should win
      const updatedAgent = result.current.agents.get(mockAgent.id);
      expect(updatedAgent).toBeDefined();
      expect(global.window.electron.agents.update).toHaveBeenCalledTimes(2);
    });

    it('should handle missing agent ID gracefully in getAgent', () => {
      const { result } = renderHook(() => useAgentsStore());

      const agent = result.current.getAgent('');
      expect(agent).toBeNull();
    });

    it('should handle empty string agent ID in selectAgent', async () => {
      const { result } = renderHook(() => useAgentsStore());

      await act(async () => {
        await result.current.selectAgent('');
      });

      expect(result.current.selectedAgentId).toBe('');
    });
  });

  describe('Integration with Electron IPC', () => {
    it('should work without Electron API in test environment', async () => {
      // @ts-expect-error - Testing missing API scenario
      global.window.electron = undefined;

      const { result } = renderHook(() => useAgentsStore());

      // Should not throw, just handle gracefully
      await act(async () => {
        await result.current.loadAgents();
      });

      expect(result.current.agents.size).toBe(0);
      expect(result.current.agentsError).toBeNull();
    });

    it('should log agent creation for debugging', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      global.window.electron = {
        agents: {
          create: jest.fn().mockImplementation((agent) => Promise.resolve(agent)),
        },
      } as any;

      const { result } = renderHook(() => useAgentsStore());

      await act(async () => {
        await result.current.createAgent({
          title: 'Logged Agent',
          content: 'Content',
          type: AgentType.TEXT,
        });
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Agent created'),
        expect.any(String)
      );

      consoleSpy.mockRestore();
    });
  });
});
