/**
 * Chat Store - Query State Management Tests
 *
 * TDD tests for Fix chat loader visibility tied to query lifecycle
 * instead of streaming state
 *
 * Coverage:
 * - Query state initialization
 * - Query lifecycle (start, complete, error, stop)
 * - Multi-agent query state isolation
 * - Query state management during sendMessage
 *
 * @see Fix chat loader visibility tied to query lifecycle
 */

import { claudeCodeService } from '@/renderer/services/ClaudeCodeService';
import { useChatStore } from '@/stores';
import { ComputedMessage } from '@/stores/chat.selectors';

// Mock dependencies
jest.mock('@/commons/utils/logger');
jest.mock('@/renderer/services/ClaudeCodeService', () => ({
  claudeCodeService: {
    queryWithStreaming: jest.fn(),
    stopStreaming: jest.fn(),
  },
}));
jest.mock('@/stores/agents.store', () => ({
  useAgentsStore: {
    getState: jest.fn(() => ({
      selectedAgentId: 'test-agent-1',
      getSelectedAgent: jest.fn(() => ({
        id: 'test-agent-1',
        name: 'Test Agent',
        projectId: 'test-project',
      })),
    })),
  },
}));
jest.mock('@/stores/projects.store', () => ({
  useProjectsStore: {
    getState: jest.fn(() => ({
      getSelectedProject: jest.fn(() => ({
        id: 'test-project',
        folderName: 'test-project',
        localPath: '/test/path',
      })),
    })),
  },
}));
jest.mock('@/stores/settings', () => ({
  useSettingsStore: {
    getState: jest.fn(() => ({
      preferences: {
        maxTurns: null,
      },
    })),
  },
}));
jest.mock('@/renderer/services/TodoActivityMonitorManager', () => ({
  getTodoMonitor: jest.fn(() => null),
}));

describe('Chat Store - Query State Management', () => {
  const initialState = {
    messages: new Map(),
    activeChat: null,
    streamingMessages: new Map(),
    attachments: new Map(),
    streamingStates: new Map(),
    queryingStates: new Map(),
    sessionIds: new Map(),
    chatError: null,
    pendingToolUses: new Map(),
    traceEntries: new Map(),
    draftInputs: new Map(),
    draftCursorPositions: new Map(),
    validationErrors: new Map(),
    backgroundSyncInterval: null,
  };

  beforeEach(() => {
    // Reset store state
    useChatStore.setState(initialState);
    jest.clearAllMocks();
  });

  describe('Query State Initialization', () => {
    it('should initialize queryingStates as empty Map', () => {
      const state = useChatStore.getState();
      expect(state.queryingStates).toBeInstanceOf(Map);
      expect(state.queryingStates.size).toBe(0);
    });

    it('should return false for isQuerying when agent not found', () => {
      const state = useChatStore.getState();
      expect(state.isQuerying('non-existent-agent')).toBe(false);
    });

    it('should return false for isQuerying when queryingStates is empty', () => {
      const state = useChatStore.getState();
      expect(state.queryingStates.size).toBe(0);
      expect(state.isQuerying('any-agent')).toBe(false);
    });
  });

  describe('Query Lifecycle - Start', () => {
    it('should set isQuerying=true when sendMessage starts', async () => {
      // Setup
      useChatStore.setState({ activeChat: 'test-agent-1' });

      // Mock queryWithStreaming to pause before calling callbacks
      const mockQueryPromise = new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      (claudeCodeService.queryWithStreaming as jest.Mock).mockReturnValue(mockQueryPromise);

      // Act - start query
      const sendPromise = useChatStore.getState().sendMessage('test message');

      // Assert - query state should be true immediately after sendMessage starts
      await new Promise((resolve) => setTimeout(resolve, 10));
      const stateAfterStart = useChatStore.getState();
      expect(stateAfterStart.isQuerying('test-agent-1')).toBe(true);
      expect(stateAfterStart.queryingStates.get('test-agent-1')).toBe(true);

      // Cleanup
      await sendPromise.catch(() => {});
    });

    it('should set query state for correct agent ID', async () => {
      useChatStore.setState({ activeChat: 'test-agent-1' });

      const mockQueryPromise = new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      (claudeCodeService.queryWithStreaming as jest.Mock).mockReturnValue(mockQueryPromise);

      const sendPromise = useChatStore.getState().sendMessage('test message');

      await new Promise((resolve) => setTimeout(resolve, 10));
      const state = useChatStore.getState();

      expect(state.queryingStates.has('test-agent-1')).toBe(true);
      expect(state.queryingStates.get('test-agent-1')).toBe(true);
      expect(state.isQuerying('test-agent-1')).toBe(true);

      await sendPromise.catch(() => {});
    });

    it('should support multiple agents with independent query states', async () => {
      // Setup agent 1
      useChatStore.setState({ activeChat: 'agent-1' });
      const mockPromise1 = new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      (claudeCodeService.queryWithStreaming as jest.Mock).mockReturnValue(mockPromise1);

      const send1Promise = useChatStore.getState().sendMessage('message 1');
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify agent 1 is querying
      let state = useChatStore.getState();
      expect(state.isQuerying('agent-1')).toBe(true);

      // Setup agent 2
      useChatStore.setState({ activeChat: 'agent-2' });
      const mockPromise2 = new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      (claudeCodeService.queryWithStreaming as jest.Mock).mockReturnValue(mockPromise2);

      // Update agents store mock
      const { useAgentsStore } = require('@/stores/agents.store');
      (useAgentsStore.getState as jest.Mock).mockReturnValue({
        selectedAgentId: 'agent-2',
        getSelectedAgent: jest.fn(() => ({
          id: 'agent-2',
          name: 'Agent 2',
          projectId: 'test-project',
        })),
      });

      const send2Promise = useChatStore.getState().sendMessage('message 2');
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify both agents have independent query states
      state = useChatStore.getState();
      expect(state.isQuerying('agent-1')).toBe(true);
      expect(state.isQuerying('agent-2')).toBe(true);
      expect(state.queryingStates.get('agent-1')).toBe(true);
      expect(state.queryingStates.get('agent-2')).toBe(true);

      await Promise.all([send1Promise.catch(() => {}), send2Promise.catch(() => {})]);
    });
  });

  describe('Query Lifecycle - Complete (onResult)', () => {
    it('should set isQuerying=false when onResult callback fires', async () => {
      useChatStore.setState({ activeChat: 'test-agent-1' });

      let capturedCallbacks: any = null;
      (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
        async (_msg, _opts, callbacks) => {
          capturedCallbacks = callbacks;
          // Simulate query start
          return Promise.resolve();
        }
      );

      // Start query
      await useChatStore.getState().sendMessage('test message');

      // Verify querying state is true initially
      expect(useChatStore.getState().isQuerying('test-agent-1')).toBe(true);

      // Simulate result callback
      if (capturedCallbacks?.onResult) {
        capturedCallbacks.onResult({
          type: 'result',
          subtype: 'success',
          usage: { input_tokens: 10, output_tokens: 20 },
        });
      }

      // Query state should be cleared after onResult
      const state = useChatStore.getState();
      expect(state.isQuerying('test-agent-1')).toBe(false);
      expect(state.queryingStates.has('test-agent-1')).toBe(false);
    });

    it('should clear query state for correct agent ID', async () => {
      useChatStore.setState({ activeChat: 'test-agent-1' });

      let capturedCallbacks: any = null;
      (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
        async (_msg, _opts, callbacks) => {
          capturedCallbacks = callbacks;
          return Promise.resolve();
        }
      );

      await useChatStore.getState().sendMessage('test');
      expect(useChatStore.getState().queryingStates.has('test-agent-1')).toBe(true);

      if (capturedCallbacks?.onResult) {
        capturedCallbacks.onResult({ type: 'result', subtype: 'success' });
      }

      const state = useChatStore.getState();
      expect(state.queryingStates.has('test-agent-1')).toBe(false);
      expect(state.isQuerying('test-agent-1')).toBe(false);
    });

    it('should not affect other agents query states', async () => {
      // Setup agent-1 query
      useChatStore.setState({ activeChat: 'agent-1' });
      let callbacks1: any = null;
      (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
        async (_msg, _opts, callbacks) => {
          callbacks1 = callbacks;
          return Promise.resolve();
        }
      );
      await useChatStore.getState().sendMessage('msg1');

      // Setup agent-2 query
      useChatStore.setState({ activeChat: 'agent-2' });
      (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
        async (_msg, _opts) => {
          return Promise.resolve();
        }
      );

      const { useAgentsStore } = require('@/stores/agents.store');
      (useAgentsStore.getState as jest.Mock).mockReturnValue({
        selectedAgentId: 'agent-2',
        getSelectedAgent: jest.fn(() => ({
          id: 'agent-2',
          name: 'Agent 2',
          projectId: 'test-project',
        })),
      });

      await useChatStore.getState().sendMessage('msg2');

      // Both should be querying
      expect(useChatStore.getState().isQuerying('agent-1')).toBe(true);
      expect(useChatStore.getState().isQuerying('agent-2')).toBe(true);

      // Complete agent-1 only
      if (callbacks1?.onResult) {
        callbacks1.onResult({ type: 'result', subtype: 'success' });
      }

      const state = useChatStore.getState();
      expect(state.isQuerying('agent-1')).toBe(false);
      expect(state.isQuerying('agent-2')).toBe(true);
      expect(state.queryingStates.get('agent-2')).toBe(true);
    });
  });

  describe('Query Lifecycle - Error Handling', () => {
    it('should set isQuerying=false on onError callback', async () => {
      useChatStore.setState({ activeChat: 'test-agent-1' });

      let capturedCallbacks: any = null;
      (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
        async (_msg, _opts, callbacks) => {
          capturedCallbacks = callbacks;
          return Promise.resolve();
        }
      );

      await useChatStore.getState().sendMessage('test');
      expect(useChatStore.getState().isQuerying('test-agent-1')).toBe(true);

      if (capturedCallbacks?.onError) {
        capturedCallbacks.onError(new Error('Test error'));
      }

      const state = useChatStore.getState();
      expect(state.isQuerying('test-agent-1')).toBe(false);
      expect(state.queryingStates.has('test-agent-1')).toBe(false);
    });

    it('should clear query state on abort', async () => {
      useChatStore.setState({ activeChat: 'test-agent-1' });

      (claudeCodeService.queryWithStreaming as jest.Mock).mockRejectedValue(
        new Error('Query aborted')
      );

      try {
        await useChatStore.getState().sendMessage('test');
      } catch (e) {
        // Expected to throw
      }

      const state = useChatStore.getState();
      expect(state.isQuerying('test-agent-1')).toBe(false);
      expect(state.queryingStates.has('test-agent-1')).toBe(false);
    });

    it('should clear query state on exception in catch block', async () => {
      useChatStore.setState({ activeChat: 'test-agent-1' });

      (claudeCodeService.queryWithStreaming as jest.Mock).mockRejectedValue(
        new Error('Network failure')
      );

      try {
        await useChatStore.getState().sendMessage('test');
      } catch (e) {
        // Expected error
      }

      const state = useChatStore.getState();
      expect(state.isQuerying('test-agent-1')).toBe(false);
      expect(state.queryingStates.has('test-agent-1')).toBe(false);
    });
  });

  describe('Query Lifecycle - Stop', () => {
    it('should set isQuerying=false when stopStreaming is called', async () => {
      useChatStore.setState({ activeChat: 'test-agent-1' });

      (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
        async () => new Promise(() => {}) // Never resolves
      );

      const sendPromise = useChatStore.getState().sendMessage('test');
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify querying
      expect(useChatStore.getState().isQuerying('test-agent-1')).toBe(true);

      // Stop streaming
      useChatStore.getState().stopStreaming();

      // Query state should be cleared
      const state = useChatStore.getState();
      expect(state.isQuerying('test-agent-1')).toBe(false);
      expect(state.queryingStates.has('test-agent-1')).toBe(false);

      sendPromise.catch(() => {});
    });

    it('should clear query state when streaming is stopped', async () => {
      useChatStore.setState({ activeChat: 'test-agent-1' });

      (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
        async () => new Promise(() => {})
      );

      const sendPromise = useChatStore.getState().sendMessage('test');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(useChatStore.getState().queryingStates.get('test-agent-1')).toBe(true);

      useChatStore.getState().stopStreaming();

      const state = useChatStore.getState();
      expect(state.queryingStates.has('test-agent-1')).toBe(false);
      expect(state.isQuerying('test-agent-1')).toBe(false);

      sendPromise.catch(() => {});
    });
  });

  describe('Multi-Agent Query State Isolation', () => {
    it('should maintain independent query states per agent', async () => {
      // Start query for agent-1
      useChatStore.setState({ activeChat: 'agent-1' });
      (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
        async () => new Promise(() => {})
      );

      const promise1 = useChatStore.getState().sendMessage('msg1');
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Start query for agent-2
      useChatStore.setState({ activeChat: 'agent-2' });
      const { useAgentsStore } = require('@/stores/agents.store');
      (useAgentsStore.getState as jest.Mock).mockReturnValue({
        selectedAgentId: 'agent-2',
        getSelectedAgent: jest.fn(() => ({
          id: 'agent-2',
          name: 'Agent 2',
          projectId: 'test-project',
        })),
      });

      const promise2 = useChatStore.getState().sendMessage('msg2');
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify independent states
      const state = useChatStore.getState();
      expect(state.isQuerying('agent-1')).toBe(true);
      expect(state.isQuerying('agent-2')).toBe(true);
      expect(state.queryingStates.size).toBe(2);

      promise1.catch(() => {});
      promise2.catch(() => {});
    });

    it('should not affect other agents when one completes', async () => {
      useChatStore.setState({ activeChat: 'agent-1' });
      let callbacks1: any = null;
      (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
        async (_msg, _opts, callbacks) => {
          callbacks1 = callbacks;
          return Promise.resolve();
        }
      );
      await useChatStore.getState().sendMessage('msg1');

      useChatStore.setState({ activeChat: 'agent-2' });
      (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
        async (_msg, _opts) => {
          return Promise.resolve();
        }
      );

      const { useAgentsStore } = require('@/stores/agents.store');
      (useAgentsStore.getState as jest.Mock).mockReturnValue({
        selectedAgentId: 'agent-2',
        getSelectedAgent: jest.fn(() => ({
          id: 'agent-2',
          name: 'Agent 2',
          projectId: 'test-project',
        })),
      });

      await useChatStore.getState().sendMessage('msg2');

      // Complete agent-1
      if (callbacks1?.onResult) {
        callbacks1.onResult({ type: 'result', subtype: 'success' });
      }

      const state = useChatStore.getState();
      expect(state.isQuerying('agent-1')).toBe(false);
      expect(state.isQuerying('agent-2')).toBe(true);
    });

    it('should handle switching active agent without affecting query states', async () => {
      // Start query for agent-1
      useChatStore.setState({ activeChat: 'agent-1' });
      (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
        async () => new Promise(() => {})
      );

      const promise1 = useChatStore.getState().sendMessage('msg1');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(useChatStore.getState().isQuerying('agent-1')).toBe(true);

      // Switch to agent-2 (without starting a query)
      useChatStore.setState({ activeChat: 'agent-2' });

      // agent-1 should still be querying
      const state = useChatStore.getState();
      expect(state.isQuerying('agent-1')).toBe(true);
      expect(state.isQuerying('agent-2')).toBe(false);
      expect(state.activeChat).toBe('agent-2');

      promise1.catch(() => {});
    });
  });

  describe('Query State Selector', () => {
    it('should provide isQuerying selector for any agent', () => {
      useChatStore.setState({
        queryingStates: new Map([
          ['agent-1', true],
          ['agent-2', false],
        ]),
      });

      const state = useChatStore.getState();
      expect(state.isQuerying('agent-1')).toBe(true);
      expect(state.isQuerying('agent-2')).toBe(false);
      expect(state.isQuerying('agent-3')).toBe(false);
    });

    it('should return stable false value for non-existent agents', () => {
      const state = useChatStore.getState();
      const result1 = state.isQuerying('non-existent');
      const result2 = state.isQuerying('non-existent');

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result1).toBe(result2);
    });

    it('should work correctly with getCurrentMessages for loading indicator', () => {
      const testMessages: ComputedMessage[] = [
        { id: 'msg-1', role: 'user', content: 'Test', timestamp: new Date() },
      ];

      useChatStore.setState({
        activeChat: 'agent-1',
        messages: new Map([['agent-1', testMessages]]),
        queryingStates: new Map([['agent-1', true]]),
      });

      const state = useChatStore.getState();
      expect(state.getCurrentMessages()).toBe(testMessages);
      expect(state.isQuerying('agent-1')).toBe(true);

      // This pattern should be used for loading indicator
      const shouldShowLoader = state.activeChat ? state.isQuerying(state.activeChat) : false;
      expect(shouldShowLoader).toBe(true);
    });
  });

  describe('Query State with Streaming State Independence', () => {
    it('should maintain query state independent of streaming state', async () => {
      useChatStore.setState({ activeChat: 'test-agent-1' });

      let capturedCallbacks: any = null;
      (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
        async (_msg, _opts, callbacks) => {
          capturedCallbacks = callbacks;
          return Promise.resolve();
        }
      );

      await useChatStore.getState().sendMessage('test');

      // Query started - both query and streaming should be true
      expect(useChatStore.getState().isQuerying('test-agent-1')).toBe(true);
      expect(useChatStore.getState().isStreaming('test-agent-1')).toBe(true);

      // Simulate onResult (query complete, but streaming continues)
      if (capturedCallbacks?.onResult) {
        capturedCallbacks.onResult({ type: 'result', subtype: 'success' });
      }

      // After onResult, query should be false but streaming may still be true
      let state = useChatStore.getState();
      expect(state.isQuerying('test-agent-1')).toBe(false);
      // Streaming state is managed separately in onComplete

      // Simulate onComplete (streaming complete)
      if (capturedCallbacks?.onComplete) {
        capturedCallbacks.onComplete('final content');
      }

      // Both should be false after complete
      state = useChatStore.getState();
      expect(state.isQuerying('test-agent-1')).toBe(false);
      expect(state.isStreaming('test-agent-1')).toBe(false);
    });

    it('should clear query state before streaming state completes', async () => {
      useChatStore.setState({ activeChat: 'test-agent-1' });

      let capturedCallbacks: any = null;
      (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
        async (_msg, _opts, callbacks) => {
          capturedCallbacks = callbacks;
          return Promise.resolve();
        }
      );

      await useChatStore.getState().sendMessage('test');

      // Both true initially
      expect(useChatStore.getState().isQuerying('test-agent-1')).toBe(true);
      expect(useChatStore.getState().isStreaming('test-agent-1')).toBe(true);

      // Call onResult (not onComplete)
      if (capturedCallbacks?.onResult) {
        capturedCallbacks.onResult({ type: 'result', subtype: 'success' });
      }

      const state = useChatStore.getState();
      // Query state should be cleared immediately after onResult
      expect(state.isQuerying('test-agent-1')).toBe(false);
      // Streaming state is managed separately (may still be true)
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing activeChat gracefully', async () => {
      useChatStore.setState({ activeChat: null });

      await expect(useChatStore.getState().sendMessage('test')).rejects.toThrow(
        'No active chat or selected agent'
      );

      const state = useChatStore.getState();
      expect(state.queryingStates.size).toBe(0);
    });

    it('should handle concurrent sendMessage calls for same agent', async () => {
      useChatStore.setState({ activeChat: 'test-agent-1' });

      let capturedCallbacks: any = null;
      (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
        async (_msg, _opts, callbacks) => {
          capturedCallbacks = callbacks;
          return new Promise((resolve) => setTimeout(resolve, 100));
        }
      );

      const promise1 = useChatStore.getState().sendMessage('msg1');
      const promise2 = useChatStore.getState().sendMessage('msg2');

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Query state should be true (last call wins)
      expect(useChatStore.getState().isQuerying('test-agent-1')).toBe(true);

      // Simulate onResult to properly clear query state
      if (capturedCallbacks?.onResult) {
        capturedCallbacks.onResult({ type: 'result', subtype: 'success' });
      }

      await Promise.all([promise1, promise2]);

      // Should be false after result arrives
      expect(useChatStore.getState().isQuerying('test-agent-1')).toBe(false);
    });

    it('should handle queryingStates Map properly with immer', () => {
      // Using immer-style state updates
      useChatStore.setState({
        queryingStates: new Map([['agent-1', true]]),
      });

      expect(useChatStore.getState().isQuerying('agent-1')).toBe(true);

      useChatStore.setState({
        queryingStates: new Map(),
      });

      expect(useChatStore.getState().isQuerying('agent-1')).toBe(false);
    });
  });

  describe('stopStreaming with focus callback - NOTCH-1532', () => {
    beforeEach(() => {
      // Reset store state
      useChatStore.setState(initialState);
      jest.clearAllMocks();
    });

    describe('Basic Callback Invocation', () => {
      it('should accept optional focusCallback parameter', () => {
        useChatStore.setState({ activeChat: 'test-agent-1' });
        const mockCallback = jest.fn();

        // Should not throw when callback is provided
        expect(() => {
          useChatStore.getState().stopStreaming({ focusCallback: mockCallback });
        }).not.toThrow();
      });

      it('should invoke callback after state cleanup', () => {
        useChatStore.setState({
          activeChat: 'test-agent-1',
          streamingStates: new Map([['test-agent-1', true]]),
          queryingStates: new Map([['test-agent-1', true]]),
          streamingMessages: new Map([
            [
              'test-agent-1',
              {
                id: 'msg-1',
                chunks: ['test content'],
                isComplete: false,
              },
            ],
          ]),
          messages: new Map([
            [
              'test-agent-1',
              [
                {
                  id: 'msg-1',
                  role: 'assistant',
                  content: 'test content',
                  timestamp: new Date(),
                },
              ],
            ],
          ]),
        });

        const mockCallback = jest.fn();
        useChatStore.getState().stopStreaming({ focusCallback: mockCallback });

        // Callback should be invoked
        expect(mockCallback).toHaveBeenCalledTimes(1);

        // State should be cleaned up
        const state = useChatStore.getState();
        expect(state.streamingStates.get('test-agent-1')).toBe(false);
        expect(state.queryingStates.has('test-agent-1')).toBe(false);
        expect(state.streamingMessages.has('test-agent-1')).toBe(false);
      });

      it('should NOT invoke callback if not provided (backward compatibility)', () => {
        useChatStore.setState({
          activeChat: 'test-agent-1',
          streamingStates: new Map([['test-agent-1', true]]),
          queryingStates: new Map([['test-agent-1', true]]),
        });

        // Should not throw when callback is not provided
        expect(() => {
          useChatStore.getState().stopStreaming();
        }).not.toThrow();

        // State should still be cleaned up
        const state = useChatStore.getState();
        expect(state.streamingStates.get('test-agent-1')).toBe(false);
        expect(state.queryingStates.has('test-agent-1')).toBe(false);
      });

      it('should handle callback that throws error gracefully', () => {
        useChatStore.setState({
          activeChat: 'test-agent-1',
          streamingStates: new Map([['test-agent-1', true]]),
        });

        const throwingCallback = jest.fn(() => {
          throw new Error('Callback error');
        });

        // Should not propagate callback errors
        expect(() => {
          useChatStore.getState().stopStreaming({ focusCallback: throwingCallback });
        }).not.toThrow();

        // Callback should have been called
        expect(throwingCallback).toHaveBeenCalledTimes(1);

        // State should still be cleaned up despite callback error
        const state = useChatStore.getState();
        expect(state.streamingStates.get('test-agent-1')).toBe(false);
      });
    });

    describe('Timing Tests', () => {
      it('should invoke callback within 10ms of state cleanup completion', () => {
        useChatStore.setState({
          activeChat: 'test-agent-1',
          streamingStates: new Map([['test-agent-1', true]]),
        });

        const mockCallback = jest.fn();
        const startTime = Date.now();
        useChatStore.getState().stopStreaming({ focusCallback: mockCallback });
        const endTime = Date.now();

        expect(mockCallback).toHaveBeenCalledTimes(1);
        expect(endTime - startTime).toBeLessThan(10);
      });

      it('should invoke callback AFTER streaming state is cleared', () => {
        useChatStore.setState({
          activeChat: 'test-agent-1',
          streamingStates: new Map([['test-agent-1', true]]),
          queryingStates: new Map([['test-agent-1', true]]),
        });

        let streamingStateWhenCallbackFired: boolean | undefined;
        let queryingStateWhenCallbackFired: boolean | undefined;

        const mockCallback = jest.fn(() => {
          const state = useChatStore.getState();
          streamingStateWhenCallbackFired = state.streamingStates.get('test-agent-1');
          queryingStateWhenCallbackFired = state.queryingStates.get('test-agent-1');
        });

        useChatStore.getState().stopStreaming({ focusCallback: mockCallback });

        expect(mockCallback).toHaveBeenCalledTimes(1);
        expect(streamingStateWhenCallbackFired).toBe(false);
        expect(queryingStateWhenCallbackFired).toBeUndefined(); // Should be deleted from Map
      });

      it('should ensure no race conditions with rapid cancellations', async () => {
        useChatStore.setState({
          activeChat: 'test-agent-1',
          streamingStates: new Map([['test-agent-1', true]]),
        });

        const mockCallback1 = jest.fn();
        const mockCallback2 = jest.fn();
        const mockCallback3 = jest.fn();

        // Rapid successive calls
        useChatStore.getState().stopStreaming({ focusCallback: mockCallback1 });
        useChatStore.getState().stopStreaming({ focusCallback: mockCallback2 });
        useChatStore.getState().stopStreaming({ focusCallback: mockCallback3 });

        // All callbacks should fire
        expect(mockCallback1).toHaveBeenCalledTimes(1);
        expect(mockCallback2).toHaveBeenCalledTimes(1);
        expect(mockCallback3).toHaveBeenCalledTimes(1);

        // State should be stable
        const state = useChatStore.getState();
        expect(state.streamingStates.get('test-agent-1')).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      it('should handle rapid ESC presses without duplicate callbacks', () => {
        useChatStore.setState({
          activeChat: 'test-agent-1',
          streamingStates: new Map([['test-agent-1', true]]),
        });

        const mockCallback = jest.fn();

        // Simulate rapid ESC ESC
        useChatStore.getState().stopStreaming({ focusCallback: mockCallback });
        useChatStore.getState().stopStreaming({ focusCallback: mockCallback });

        // Callback should be called for each stopStreaming call
        expect(mockCallback).toHaveBeenCalledTimes(2);

        // State should be stable
        const state = useChatStore.getState();
        expect(state.streamingStates.get('test-agent-1')).toBe(false);
      });

      it('should invoke callback when no active stream exists', () => {
        useChatStore.setState({
          activeChat: 'test-agent-1',
          streamingStates: new Map(),
          queryingStates: new Map(),
        });

        const mockCallback = jest.fn();
        useChatStore.getState().stopStreaming({ focusCallback: mockCallback });

        // Callback should still be invoked even if no stream was active
        expect(mockCallback).toHaveBeenCalledTimes(1);
      });

      it('should handle callback when activeChat is null', () => {
        useChatStore.setState({
          activeChat: null,
        });

        const mockCallback = jest.fn();

        // Should not throw
        expect(() => {
          useChatStore.getState().stopStreaming({ focusCallback: mockCallback });
        }).not.toThrow();

        // Callback should still be invoked
        expect(mockCallback).toHaveBeenCalledTimes(1);
      });

      it('should handle callback with empty streaming message', () => {
        useChatStore.setState({
          activeChat: 'test-agent-1',
          streamingStates: new Map([['test-agent-1', true]]),
          streamingMessages: new Map([
            [
              'test-agent-1',
              {
                id: 'msg-1',
                chunks: [],
                isComplete: false,
              },
            ],
          ]),
          messages: new Map([
            [
              'test-agent-1',
              [
                {
                  id: 'msg-1',
                  role: 'assistant',
                  content: '', // Empty content
                  timestamp: new Date(),
                },
              ],
            ],
          ]),
        });

        const mockCallback = jest.fn();
        useChatStore.getState().stopStreaming({ focusCallback: mockCallback });

        expect(mockCallback).toHaveBeenCalledTimes(1);

        // Empty message should be removed
        const state = useChatStore.getState();
        const messages = state.messages.get('test-agent-1') || [];
        expect(messages.length).toBe(1); // Only interrupted message remains
        expect(messages[0].content).toBe('[Request interrupted by user]');
      });

      it('should preserve non-empty messages when invoking callback', () => {
        useChatStore.setState({
          activeChat: 'test-agent-1',
          streamingStates: new Map([['test-agent-1', true]]),
          streamingMessages: new Map([
            [
              'test-agent-1',
              {
                id: 'msg-1',
                chunks: ['partial content'],
                isComplete: false,
              },
            ],
          ]),
          messages: new Map([
            [
              'test-agent-1',
              [
                {
                  id: 'msg-1',
                  role: 'assistant',
                  content: 'partial content',
                  timestamp: new Date(),
                },
              ],
            ],
          ]),
        });

        const mockCallback = jest.fn();
        useChatStore.getState().stopStreaming({ focusCallback: mockCallback });

        expect(mockCallback).toHaveBeenCalledTimes(1);

        // Non-empty message should be preserved
        const state = useChatStore.getState();
        const messages = state.messages.get('test-agent-1') || [];
        expect(messages.length).toBe(2); // Original + interrupted message
        expect(messages[0].content).toBe('partial content');
        expect(messages[1].content).toBe('[Request interrupted by user]');
      });
    });

    describe('Multi-Agent Session Tests', () => {
      it('should invoke callback for correct agent when multiple agents active', () => {
        useChatStore.setState({
          activeChat: 'agent-1',
          streamingStates: new Map([
            ['agent-1', true],
            ['agent-2', true],
          ]),
          queryingStates: new Map([
            ['agent-1', true],
            ['agent-2', true],
          ]),
        });

        const mockCallback = jest.fn();
        useChatStore.getState().stopStreaming({ focusCallback: mockCallback });

        expect(mockCallback).toHaveBeenCalledTimes(1);

        // Only agent-1 state should be cleared
        const state = useChatStore.getState();
        expect(state.streamingStates.get('agent-1')).toBe(false);
        expect(state.queryingStates.has('agent-1')).toBe(false);

        // agent-2 state should remain unchanged
        expect(state.streamingStates.get('agent-2')).toBe(true);
        expect(state.queryingStates.get('agent-2')).toBe(true);
      });

      it('should invoke different callbacks for different agents', () => {
        const mockCallback1 = jest.fn();
        const mockCallback2 = jest.fn();

        // Setup agent-1
        useChatStore.setState({
          activeChat: 'agent-1',
          streamingStates: new Map([['agent-1', true]]),
          messages: new Map(),
        });
        useChatStore.getState().stopStreaming({ focusCallback: mockCallback1 });

        // Get intermediate state after first call
        const intermediateState = useChatStore.getState();

        // Setup agent-2, preserving agent-1 state
        useChatStore.setState({
          activeChat: 'agent-2',
          streamingStates: new Map([
            ['agent-1', intermediateState.streamingStates.get('agent-1') ?? false],
            ['agent-2', true],
          ]),
          messages: intermediateState.messages,
        });
        useChatStore.getState().stopStreaming({ focusCallback: mockCallback2 });

        expect(mockCallback1).toHaveBeenCalledTimes(1);
        expect(mockCallback2).toHaveBeenCalledTimes(1);

        // Both agents should have false streaming state
        const state = useChatStore.getState();
        expect(state.streamingStates.get('agent-1')).toBe(false);
        expect(state.streamingStates.get('agent-2')).toBe(false);
      });

      it('should not invoke callback for non-active agents', () => {
        useChatStore.setState({
          activeChat: 'agent-1',
          streamingStates: new Map([
            ['agent-1', true],
            ['agent-2', true],
          ]),
        });

        const mockCallback = jest.fn();
        useChatStore.getState().stopStreaming({ focusCallback: mockCallback });

        // Only one callback invocation for active agent
        expect(mockCallback).toHaveBeenCalledTimes(1);

        const state = useChatStore.getState();
        expect(state.streamingStates.get('agent-1')).toBe(false);
        expect(state.streamingStates.get('agent-2')).toBe(true); // Unchanged
      });
    });

    describe('Integration with ClaudeCodeService', () => {
      it('should call claudeCodeService.stopStreaming before invoking callback', () => {
        useChatStore.setState({
          activeChat: 'test-agent-1',
          streamingStates: new Map([['test-agent-1', true]]),
        });

        let serviceStopCalled = false;
        (claudeCodeService.stopStreaming as jest.Mock).mockImplementation(() => {
          serviceStopCalled = true;
        });

        const mockCallback = jest.fn(() => {
          // Service should have been called before callback
          expect(serviceStopCalled).toBe(true);
        });

        useChatStore.getState().stopStreaming({ focusCallback: mockCallback });

        expect(claudeCodeService.stopStreaming).toHaveBeenCalledWith('test-agent-1');
        expect(mockCallback).toHaveBeenCalledTimes(1);
      });

      it('should pass correct agentId to claudeCodeService.stopStreaming', () => {
        useChatStore.setState({
          activeChat: 'my-special-agent',
          streamingStates: new Map([['my-special-agent', true]]),
        });

        const mockCallback = jest.fn();
        useChatStore.getState().stopStreaming({ focusCallback: mockCallback });

        expect(claudeCodeService.stopStreaming).toHaveBeenCalledWith('my-special-agent');
        expect(mockCallback).toHaveBeenCalledTimes(1);
      });

      it('should pass undefined to claudeCodeService.stopStreaming when no activeChat', () => {
        useChatStore.setState({
          activeChat: null,
        });

        const mockCallback = jest.fn();
        useChatStore.getState().stopStreaming({ focusCallback: mockCallback });

        expect(claudeCodeService.stopStreaming).toHaveBeenCalledWith(undefined);
        expect(mockCallback).toHaveBeenCalledTimes(1);
      });
    });

    describe('State Consistency', () => {
      it('should maintain consistent state after callback invocation', () => {
        useChatStore.setState({
          activeChat: 'test-agent-1',
          streamingStates: new Map([['test-agent-1', true]]),
          queryingStates: new Map([['test-agent-1', true]]),
          streamingMessages: new Map([
            ['test-agent-1', { id: 'msg-1', chunks: [], isComplete: false }],
          ]),
          chatError: 'some error',
        });

        const mockCallback = jest.fn();
        useChatStore.getState().stopStreaming({ focusCallback: mockCallback });

        const state = useChatStore.getState();
        expect(state.streamingStates.get('test-agent-1')).toBe(false);
        expect(state.queryingStates.has('test-agent-1')).toBe(false);
        expect(state.streamingMessages.has('test-agent-1')).toBe(false);
        expect(state.chatError).toBe(null); // Error should be cleared
        expect(mockCallback).toHaveBeenCalledTimes(1);
      });

      it('should add interrupted message with callback', () => {
        useChatStore.setState({
          activeChat: 'test-agent-1',
          streamingStates: new Map([['test-agent-1', true]]),
          messages: new Map([['test-agent-1', []]]),
        });

        const mockCallback = jest.fn();
        useChatStore.getState().stopStreaming({ focusCallback: mockCallback });

        expect(mockCallback).toHaveBeenCalledTimes(1);

        const state = useChatStore.getState();
        const messages = state.messages.get('test-agent-1') || [];
        expect(messages.length).toBe(1);
        expect(messages[0].content).toBe('[Request interrupted by user]');
        expect(messages[0].role).toBe('user');
      });

      it('should preserve existing messages when adding interrupted message', () => {
        const existingMessage: ComputedMessage = {
          id: 'existing-msg',
          role: 'user',
          content: 'test message',
          timestamp: new Date(),
        };

        useChatStore.setState({
          activeChat: 'test-agent-1',
          streamingStates: new Map([['test-agent-1', true]]),
          messages: new Map([['test-agent-1', [existingMessage]]]),
        });

        const mockCallback = jest.fn();
        useChatStore.getState().stopStreaming({ focusCallback: mockCallback });

        expect(mockCallback).toHaveBeenCalledTimes(1);

        const state = useChatStore.getState();
        const messages = state.messages.get('test-agent-1') || [];
        expect(messages.length).toBe(2);
        expect(messages[0]).toBe(existingMessage);
        expect(messages[1].content).toBe('[Request interrupted by user]');
      });
    });
  });

  describe('Silent Cancellation (NOTCH-1533)', () => {
    describe('stopStreaming with silentCancel parameter', () => {
      it('should add interrupted message when silentCancel=false (default)', async () => {
        useChatStore.setState({ activeChat: 'test-agent-1' });

        (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
          async () => new Promise(() => {}) // Never resolves
        );

        const sendPromise = useChatStore.getState().sendMessage('test');
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Stop with default behavior (silentCancel=false)
        useChatStore.getState().stopStreaming();

        const messages = useChatStore.getState().messages.get('test-agent-1') || [];
        const interruptedMsg = messages.find((m) => m.content === '[Request interrupted by user]');

        expect(interruptedMsg).toBeDefined();
        expect(interruptedMsg?.role).toBe('user');

        sendPromise.catch(() => {});
      });

      it('should NOT add interrupted message when silentCancel=true', async () => {
        useChatStore.setState({ activeChat: 'test-agent-1' });

        (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
          async () => new Promise(() => {})
        );

        const sendPromise = useChatStore.getState().sendMessage('test');
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Get messages before stopping
        const messagesBefore = useChatStore.getState().messages.get('test-agent-1') || [];
        const beforeCount = messagesBefore.length;

        // Stop with silentCancel=true
        useChatStore.getState().stopStreaming({ silentCancel: true });

        const messagesAfter = useChatStore.getState().messages.get('test-agent-1') || [];
        const interruptedMsg = messagesAfter.find(
          (m) => m.content === '[Request interrupted by user]'
        );

        expect(interruptedMsg).toBeUndefined();
        // Message count should remain the same or decrease (if empty streaming message removed)
        expect(messagesAfter.length).toBeLessThanOrEqual(beforeCount);

        sendPromise.catch(() => {});
      });

      it('should clear query state regardless of silentCancel flag', async () => {
        useChatStore.setState({ activeChat: 'test-agent-1' });

        (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
          async () => new Promise(() => {})
        );

        const sendPromise = useChatStore.getState().sendMessage('test');
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(useChatStore.getState().isQuerying('test-agent-1')).toBe(true);

        // Stop with silentCancel=true
        useChatStore.getState().stopStreaming({ silentCancel: true });

        expect(useChatStore.getState().isQuerying('test-agent-1')).toBe(false);
        expect(useChatStore.getState().queryingStates.has('test-agent-1')).toBe(false);

        sendPromise.catch(() => {});
      });

      it('should clear streaming state regardless of silentCancel flag', async () => {
        useChatStore.setState({ activeChat: 'test-agent-1' });

        (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
          async () => new Promise(() => {})
        );

        const sendPromise = useChatStore.getState().sendMessage('test');
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(useChatStore.getState().isStreaming('test-agent-1')).toBe(true);

        // Stop with silentCancel=true
        useChatStore.getState().stopStreaming({ silentCancel: true });

        expect(useChatStore.getState().isStreaming('test-agent-1')).toBe(false);

        sendPromise.catch(() => {});
      });
    });

    describe('cancelAndSend method', () => {
      it('should cancel active query silently before sending new message', async () => {
        useChatStore.setState({ activeChat: 'test-agent-1' });

        // Start initial query that never resolves
        (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
          async () => new Promise(() => {})
        );

        const promise1 = useChatStore.getState().sendMessage('first message');
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(useChatStore.getState().isQuerying('test-agent-1')).toBe(true);

        // Now use cancelAndSend for second message
        (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
          async (_msg, _opts, callbacks) => {
            if (callbacks?.onResult) {
              callbacks.onResult({ type: 'result', subtype: 'success' });
            }
            if (callbacks?.onComplete) {
              callbacks.onComplete('final content');
            }
            return Promise.resolve();
          }
        );

        await useChatStore.getState().cancelAndSend('second message');

        // Check that no interrupted message was added
        const messages = useChatStore.getState().messages.get('test-agent-1') || [];
        const interruptedMsg = messages.find((m) => m.content === '[Request interrupted by user]');
        expect(interruptedMsg).toBeUndefined();

        // Verify second message was sent
        const userMessages = messages.filter((m) => m.role === 'user');
        expect(userMessages.length).toBeGreaterThan(0);
        expect(userMessages.some((m) => m.content === 'second message')).toBe(true);

        promise1.catch(() => {});
      });

      it('should not cancel if no active query', async () => {
        useChatStore.setState({ activeChat: 'test-agent-1' });

        // No active query, just send
        (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
          async (_msg, _opts, callbacks) => {
            if (callbacks?.onResult) {
              callbacks.onResult({ type: 'result', subtype: 'success' });
            }
            if (callbacks?.onComplete) {
              callbacks.onComplete('final content');
            }
            return Promise.resolve();
          }
        );

        await useChatStore.getState().cancelAndSend('test message');

        const messages = useChatStore.getState().messages.get('test-agent-1') || [];
        const userMessages = messages.filter((m) => m.role === 'user');

        expect(userMessages.length).toBeGreaterThan(0);
        expect(userMessages[0].content).toBe('test message');
      });

      it('should handle rapid consecutive cancelAndSend calls', async () => {
        useChatStore.setState({ activeChat: 'test-agent-1' });

        // Mock rapid submissions
        let callCount = 0;
        (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
          async (_msg, _opts, callbacks) => {
            callCount++;
            if (callbacks?.onResult) {
              callbacks.onResult({ type: 'result', subtype: 'success' });
            }
            if (callbacks?.onComplete) {
              callbacks.onComplete('final content');
            }
            return Promise.resolve();
          }
        );

        await Promise.all([
          useChatStore.getState().cancelAndSend('message 1'),
          useChatStore.getState().cancelAndSend('message 2'),
          useChatStore.getState().cancelAndSend('message 3'),
        ]);

        // Should not have any interrupted messages
        const messages = useChatStore.getState().messages.get('test-agent-1') || [];
        const interruptedMsgs = messages.filter(
          (m) => m.content === '[Request interrupted by user]'
        );
        expect(interruptedMsgs.length).toBe(0);

        // All messages should be sent
        expect(callCount).toBe(3);
      });

      it('should pass options correctly to sendMessage', async () => {
        useChatStore.setState({ activeChat: 'test-agent-1' });

        let capturedOptions: any = null;
        (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
          async (_msg, opts, callbacks) => {
            capturedOptions = opts;
            if (callbacks?.onResult) {
              callbacks.onResult({ type: 'result', subtype: 'success' });
            }
            if (callbacks?.onComplete) {
              callbacks.onComplete('final content');
            }
            return Promise.resolve();
          }
        );

        await useChatStore.getState().cancelAndSend('test', undefined, ['resource-1'], {
          permissionMode: 'plan',
          model: 'claude-3-5-sonnet-20241022',
        });

        expect(capturedOptions.conversationOptions.permission_mode).toBe('plan');
        expect(capturedOptions.conversationOptions.model).toBe('claude-3-5-sonnet-20241022');
      });
    });

    describe('UI Integration Scenarios', () => {
      it('should support send button click during active query (silent interruption)', async () => {
        useChatStore.setState({ activeChat: 'test-agent-1' });

        // Simulate user sends first message
        (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
          async () => new Promise(() => {}) // Long running query
        );

        const promise1 = useChatStore.getState().sendMessage('first');
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(useChatStore.getState().isQuerying('test-agent-1')).toBe(true);

        // User clicks send button again with new message (should interrupt silently)
        (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
          async (_msg, _opts, callbacks) => {
            if (callbacks?.onResult) {
              callbacks.onResult({ type: 'result', subtype: 'success' });
            }
            if (callbacks?.onComplete) {
              callbacks.onComplete('done');
            }
            return Promise.resolve();
          }
        );

        await useChatStore.getState().cancelAndSend('second');

        const messages = useChatStore.getState().messages.get('test-agent-1') || [];
        const interruptedMsg = messages.find((m) => m.content === '[Request interrupted by user]');

        // No interrupted message should appear
        expect(interruptedMsg).toBeUndefined();

        promise1.catch(() => {});
      });

      it('should support Enter key press during active query (silent interruption)', async () => {
        useChatStore.setState({ activeChat: 'test-agent-1' });

        (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
          async () => new Promise(() => {})
        );

        const promise1 = useChatStore.getState().sendMessage('typing...');
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(useChatStore.getState().isQuerying('test-agent-1')).toBe(true);

        // User presses Enter with new input (should interrupt silently)
        (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
          async (_msg, _opts, callbacks) => {
            if (callbacks?.onResult) {
              callbacks.onResult({ type: 'result', subtype: 'success' });
            }
            if (callbacks?.onComplete) {
              callbacks.onComplete('done');
            }
            return Promise.resolve();
          }
        );

        await useChatStore.getState().cancelAndSend('actual message');

        const messages = useChatStore.getState().messages.get('test-agent-1') || [];
        const interruptedMsg = messages.find((m) => m.content === '[Request interrupted by user]');

        expect(interruptedMsg).toBeUndefined();

        promise1.catch(() => {});
      });
    });
  });

  describe('Session Permission Mode Integration (NOTCH-1544)', () => {
    describe('Default Permission Mode Application', () => {
      it('should apply default permission mode from settings when no option provided', async () => {
        useChatStore.setState({ activeChat: 'test-agent-1' });

        // Mock settings store with default permission mode
        const { useSettingsStore } = require('@/stores/settings');
        (useSettingsStore.getState as jest.Mock).mockReturnValue({
          preferences: {
            maxTurns: null,
            defaultPermissionMode: 'plan',
          },
        });

        let capturedOptions: any = null;
        (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
          async (_msg, opts, callbacks) => {
            capturedOptions = opts;
            if (callbacks?.onResult) {
              callbacks.onResult({ type: 'result', subtype: 'success' });
            }
            if (callbacks?.onComplete) {
              callbacks.onComplete('final content');
            }
            return Promise.resolve();
          }
        );

        await useChatStore.getState().sendMessage('test message');

        expect(capturedOptions.conversationOptions.permission_mode).toBe('plan');
      });

      it('should use explicit permission mode when provided in options', async () => {
        useChatStore.setState({ activeChat: 'test-agent-1' });

        // Mock settings with different default
        const { useSettingsStore } = require('@/stores/settings');
        (useSettingsStore.getState as jest.Mock).mockReturnValue({
          preferences: {
            maxTurns: null,
            defaultPermissionMode: 'plan',
          },
        });

        let capturedOptions: any = null;
        (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
          async (_msg, opts, callbacks) => {
            capturedOptions = opts;
            if (callbacks?.onResult) {
              callbacks.onResult({ type: 'result', subtype: 'success' });
            }
            if (callbacks?.onComplete) {
              callbacks.onComplete('final content');
            }
            return Promise.resolve();
          }
        );

        // Explicit permission mode should override default
        await useChatStore.getState().sendMessage('test message', undefined, undefined, {
          permissionMode: 'bypassPermissions',
        });

        expect(capturedOptions.conversationOptions.permission_mode).toBe('bypassPermissions');
      });

      it('should handle acceptEdits as default permission mode', async () => {
        useChatStore.setState({ activeChat: 'test-agent-1' });

        const { useSettingsStore } = require('@/stores/settings');
        (useSettingsStore.getState as jest.Mock).mockReturnValue({
          preferences: {
            maxTurns: null,
            defaultPermissionMode: 'acceptEdits',
          },
        });

        let capturedOptions: any = null;
        (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
          async (_msg, opts, callbacks) => {
            capturedOptions = opts;
            if (callbacks?.onResult) {
              callbacks.onResult({ type: 'result', subtype: 'success' });
            }
            if (callbacks?.onComplete) {
              callbacks.onComplete('final content');
            }
            return Promise.resolve();
          }
        );

        await useChatStore.getState().sendMessage('test message');

        expect(capturedOptions.conversationOptions.permission_mode).toBe('acceptEdits');
      });

      it('should not set permission_mode in conversationOptions when no default and no option', async () => {
        useChatStore.setState({ activeChat: 'test-agent-1' });

        // Mock settings without defaultPermissionMode
        const { useSettingsStore } = require('@/stores/settings');
        (useSettingsStore.getState as jest.Mock).mockReturnValue({
          preferences: {
            maxTurns: null,
            // No defaultPermissionMode
          },
        });

        let capturedOptions: any = null;
        (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
          async (_msg, opts, callbacks) => {
            capturedOptions = opts;
            if (callbacks?.onResult) {
              callbacks.onResult({ type: 'result', subtype: 'success' });
            }
            if (callbacks?.onComplete) {
              callbacks.onComplete('final content');
            }
            return Promise.resolve();
          }
        );

        await useChatStore.getState().sendMessage('test message');

        expect(capturedOptions.conversationOptions.permission_mode).toBeUndefined();
      });
    });

    describe('Permission Mode Logging', () => {
      it('should log when applying default permission mode', async () => {
        const { logger } = require('@/commons/utils/logger');
        useChatStore.setState({ activeChat: 'test-agent-1' });

        const { useSettingsStore } = require('@/stores/settings');
        (useSettingsStore.getState as jest.Mock).mockReturnValue({
          preferences: {
            maxTurns: null,
            defaultPermissionMode: 'plan',
          },
        });

        (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
          async (_msg, _opts, callbacks) => {
            if (callbacks?.onResult) {
              callbacks.onResult({ type: 'result', subtype: 'success' });
            }
            if (callbacks?.onComplete) {
              callbacks.onComplete('final content');
            }
            return Promise.resolve();
          }
        );

        await useChatStore.getState().sendMessage('test message');

        // Verify logger.debug was called with permission mode info
        expect(logger.debug).toHaveBeenCalledWith(
          expect.stringContaining('permission'),
          expect.anything()
        );
      });

      it('should log when using explicit permission mode override', async () => {
        const { logger } = require('@/commons/utils/logger');
        useChatStore.setState({ activeChat: 'test-agent-1' });

        const { useSettingsStore } = require('@/stores/settings');
        (useSettingsStore.getState as jest.Mock).mockReturnValue({
          preferences: {
            maxTurns: null,
            defaultPermissionMode: 'plan',
          },
        });

        (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
          async (_msg, _opts, callbacks) => {
            if (callbacks?.onResult) {
              callbacks.onResult({ type: 'result', subtype: 'success' });
            }
            if (callbacks?.onComplete) {
              callbacks.onComplete('final content');
            }
            return Promise.resolve();
          }
        );

        await useChatStore.getState().sendMessage('test message', undefined, undefined, {
          permissionMode: 'bypassPermissions',
        });

        expect(logger.debug).toHaveBeenCalledWith(
          expect.stringContaining('permission'),
          expect.anything()
        );
      });
    });

    describe('Permission Mode with cancelAndSend', () => {
      it('should apply permission mode when using cancelAndSend', async () => {
        useChatStore.setState({ activeChat: 'test-agent-1' });

        const { useSettingsStore } = require('@/stores/settings');
        (useSettingsStore.getState as jest.Mock).mockReturnValue({
          preferences: {
            maxTurns: null,
            defaultPermissionMode: 'plan',
          },
        });

        let capturedOptions: any = null;
        (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
          async (_msg, opts, callbacks) => {
            capturedOptions = opts;
            if (callbacks?.onResult) {
              callbacks.onResult({ type: 'result', subtype: 'success' });
            }
            if (callbacks?.onComplete) {
              callbacks.onComplete('final content');
            }
            return Promise.resolve();
          }
        );

        await useChatStore.getState().cancelAndSend('test message', undefined, undefined, {
          permissionMode: 'acceptEdits',
        });

        expect(capturedOptions.conversationOptions.permission_mode).toBe('acceptEdits');
      });
    });

    describe('Multi-Agent Permission Mode Independence', () => {
      it('should apply different permission modes for different agents', async () => {
        // Agent 1 with plan mode
        useChatStore.setState({ activeChat: 'agent-1' });

        const { useSettingsStore } = require('@/stores/settings');
        (useSettingsStore.getState as jest.Mock).mockReturnValue({
          preferences: {
            maxTurns: null,
            defaultPermissionMode: 'plan',
          },
        });

        let capturedOptions1: any = null;
        (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
          async (_msg, opts, callbacks) => {
            capturedOptions1 = opts;
            if (callbacks?.onResult) {
              callbacks.onResult({ type: 'result', subtype: 'success' });
            }
            if (callbacks?.onComplete) {
              callbacks.onComplete('final content');
            }
            return Promise.resolve();
          }
        );

        await useChatStore.getState().sendMessage('message 1', undefined, undefined, {
          permissionMode: 'plan',
        });

        expect(capturedOptions1.conversationOptions.permission_mode).toBe('plan');

        // Agent 2 with bypassPermissions mode
        useChatStore.setState({ activeChat: 'agent-2' });

        const { useAgentsStore } = require('@/stores/agents.store');
        (useAgentsStore.getState as jest.Mock).mockReturnValue({
          selectedAgentId: 'agent-2',
          getSelectedAgent: jest.fn(() => ({
            id: 'agent-2',
            name: 'Agent 2',
            projectId: 'test-project',
          })),
        });

        let capturedOptions2: any = null;
        (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
          async (_msg, opts, callbacks) => {
            capturedOptions2 = opts;
            if (callbacks?.onResult) {
              callbacks.onResult({ type: 'result', subtype: 'success' });
            }
            if (callbacks?.onComplete) {
              callbacks.onComplete('final content');
            }
            return Promise.resolve();
          }
        );

        await useChatStore.getState().sendMessage('message 2', undefined, undefined, {
          permissionMode: 'bypassPermissions',
        });

        expect(capturedOptions2.conversationOptions.permission_mode).toBe('bypassPermissions');
      });
    });

    describe('ConversationOptions Integration', () => {
      it('should include permission_mode alongside other conversation options', async () => {
        useChatStore.setState({ activeChat: 'test-agent-1' });

        const { useSettingsStore } = require('@/stores/settings');
        (useSettingsStore.getState as jest.Mock).mockReturnValue({
          preferences: {
            maxTurns: 10,
            defaultPermissionMode: 'plan',
          },
        });

        let capturedOptions: any = null;
        (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
          async (_msg, opts, callbacks) => {
            capturedOptions = opts;
            if (callbacks?.onResult) {
              callbacks.onResult({ type: 'result', subtype: 'success' });
            }
            if (callbacks?.onComplete) {
              callbacks.onComplete('final content');
            }
            return Promise.resolve();
          }
        );

        await useChatStore.getState().sendMessage('test message', undefined, undefined, {
          model: 'claude-3-5-sonnet-20241022',
        });

        expect(capturedOptions.conversationOptions).toEqual({
          max_turns: 10,
          permission_mode: 'plan',
          model: 'claude-3-5-sonnet-20241022',
          cwd: '/test/path',
        });
      });

      it('should handle all permission mode options correctly', async () => {
        useChatStore.setState({ activeChat: 'test-agent-1' });

        const permissionModes: Array<'plan' | 'acceptEdits' | 'bypassPermissions'> = [
          'plan',
          'acceptEdits',
          'bypassPermissions',
        ];

        for (const mode of permissionModes) {
          let capturedOptions: any = null;
          (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
            async (_msg, opts, callbacks) => {
              capturedOptions = opts;
              if (callbacks?.onResult) {
                callbacks.onResult({ type: 'result', subtype: 'success' });
              }
              if (callbacks?.onComplete) {
                callbacks.onComplete('final content');
              }
              return Promise.resolve();
            }
          );

          await useChatStore.getState().sendMessage('test message', undefined, undefined, {
            permissionMode: mode,
          });

          expect(capturedOptions.conversationOptions.permission_mode).toBe(mode);
        }
      });
    });
  });
});
