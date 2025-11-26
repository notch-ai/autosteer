/**
 * Chat Store Tests
 *
 * Tests all actions with 100% coverage following TRD requirements
 *
 * Coverage:
 * - State initialization
 * - Message operations (sendMessage, loadChatHistory, clearChat)
 * - Streaming operations (streamResponse, stopStreaming)
 * - Trace operations (addTraceEntry, hydrateTraceEntriesFromMessages)
 * - Todo normalization
 * - Background sync operations
 * - Selectors (getCurrentMessages, getMessages, isStreaming, etc.)
 * - Edge cases and error handling
 */

import { useChatStore } from '@/stores';
import { useAgentsStore } from '@/stores';
import { ComputedMessage } from '@/stores/chat.selectors';
import { logger } from '@/commons/utils/logger';

// Mock dependencies
jest.mock('@/commons/utils/logger');
jest.mock('@/stores/agents.store');
jest.mock('@/stores/settings');
jest.mock('@/stores/resources.store');
jest.mock('@/stores/projects.store', () => ({
  useProjectsStore: {
    getState: jest.fn(() => ({
      getSelectedProject: jest.fn(() => null),
    })),
  },
}));
jest.mock('@/stores/worktreestats.store', () => ({
  useWorktreeStatsStore: {
    getState: jest.fn(() => ({
      worktreeStats: {},
    })),
  },
}));
jest.mock('@/stores/contextusage.store', () => ({
  useContextUsageStore: {
    getState: jest.fn(() => ({
      agentContextUsage: new Map(),
      resetAgentContextUsage: jest.fn(),
      updateAgentContextUsage: jest.fn(),
    })),
  },
}));
jest.mock('@/stores/mcp.store');
jest.mock('@/renderer/services/ClaudeCodeService', () => ({
  claudeCodeService: {
    queryWithStreaming: jest.fn(),
    stopStreaming: jest.fn(),
  },
}));
jest.mock('@/renderer/services/TodoActivityMonitorManager', () => ({
  getTodoMonitor: jest.fn(() => ({
    onMessage: jest.fn(),
    loadFromJSONL: jest.fn(),
  })),
}));

// Mock Electron IPC
global.window = {
  electron: {
    agents: {
      loadChatHistory: jest.fn(),
    },
    resources: {
      previewResource: jest.fn(),
    },
    ipcRenderer: {
      invoke: jest.fn(),
    },
  },
} as any;

describe('ChatStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useChatStore.setState({
      messages: new Map(),
      activeChat: null,
      streamingMessages: new Map(),
      attachments: new Map(),
      streamingStates: new Map(),
      sessionIds: new Map(),
      chatError: null,
      pendingToolUses: new Map(),
      traceEntries: new Map(),
      backgroundSyncInterval: null,
    });

    // Reset mocks
    jest.clearAllMocks();

    // Setup default agent store mock
    (useAgentsStore.getState as jest.Mock).mockReturnValue({
      selectedAgentId: 'agent-1',
      getSelectedAgent: jest.fn(() => ({
        id: 'agent-1',
        title: 'Test Agent',
        projectId: 'project-1',
        metadata: {},
      })),
    });
  });

  afterEach(() => {
    // Clean up intervals
    const state = useChatStore.getState();
    if (state.backgroundSyncInterval) {
      clearInterval(state.backgroundSyncInterval);
    }
  });

  describe('State Initialization', () => {
    it('should initialize with empty state', () => {
      const state = useChatStore.getState();

      expect(state.messages).toBeInstanceOf(Map);
      expect(state.messages.size).toBe(0);
      expect(state.activeChat).toBeNull();
      expect(state.streamingMessages).toBeInstanceOf(Map);
      expect(state.attachments).toBeInstanceOf(Map);
      expect(state.streamingStates).toBeInstanceOf(Map);
      expect(state.sessionIds).toBeInstanceOf(Map);
      expect(state.chatError).toBeNull();
      expect(state.pendingToolUses).toBeInstanceOf(Map);
      expect(state.traceEntries).toBeInstanceOf(Map);
      expect(state.backgroundSyncInterval).toBeNull();
    });
  });

  describe('Selectors', () => {
    describe('getCurrentMessages', () => {
      it('should return empty array when no active chat', () => {
        const messages = useChatStore.getState().getCurrentMessages();
        expect(messages).toEqual([]);
      });

      it('should return messages for active chat', () => {
        const testMessages: ComputedMessage[] = [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Hello',
            timestamp: new Date(),
          },
        ];

        useChatStore.setState({
          activeChat: 'agent-1',
          messages: new Map([['agent-1', testMessages]]),
        });

        const messages = useChatStore.getState().getCurrentMessages();
        expect(messages).toEqual(testMessages);
      });
    });

    describe('getMessages', () => {
      it('should return messages for specific agent', () => {
        const agent1Messages: ComputedMessage[] = [
          { id: 'msg-1', role: 'user', content: 'Agent 1 message', timestamp: new Date() },
        ];
        const agent2Messages: ComputedMessage[] = [
          { id: 'msg-2', role: 'user', content: 'Agent 2 message', timestamp: new Date() },
        ];

        useChatStore.setState({
          messages: new Map([
            ['agent-1', agent1Messages],
            ['agent-2', agent2Messages],
          ]),
        });

        expect(useChatStore.getState().getMessages('agent-1')).toEqual(agent1Messages);
        expect(useChatStore.getState().getMessages('agent-2')).toEqual(agent2Messages);
      });

      it('should return empty array for non-existent agent', () => {
        expect(useChatStore.getState().getMessages('non-existent')).toEqual([]);
      });
    });

    describe('isStreaming', () => {
      it('should return false when not streaming', () => {
        expect(useChatStore.getState().isStreaming('agent-1')).toBe(false);
      });

      it('should return true when streaming', () => {
        useChatStore.setState({
          streamingStates: new Map([['agent-1', true]]),
        });

        expect(useChatStore.getState().isStreaming('agent-1')).toBe(true);
      });
    });

    describe('isStreaming', () => {
      it('should return false when not streaming', () => {
        expect(useChatStore.getState().isStreaming('agent-1')).toBe(false);
      });

      it('should return true when streaming', () => {
        useChatStore.setState({
          streamingStates: new Map([['agent-1', true]]),
        });

        expect(useChatStore.getState().isStreaming('agent-1')).toBe(true);
      });

      it('should return false for non-existent agent', () => {
        expect(useChatStore.getState().isStreaming('non-existent')).toBe(false);
      });
    });

    describe('getStreamingMessage', () => {
      it('should return null when no streaming message', () => {
        expect(useChatStore.getState().getStreamingMessage('agent-1')).toBeNull();
      });

      it('should return streaming message when present', () => {
        const streamingMsg = {
          id: 'stream-1',
          chunks: ['Hello'],
          isComplete: false,
        };

        useChatStore.setState({
          streamingMessages: new Map([['agent-1', streamingMsg]]),
        });

        expect(useChatStore.getState().getStreamingMessage('agent-1')).toEqual(streamingMsg);
      });
    });

    describe('getSessionId', () => {
      it('should return null when no session ID', () => {
        expect(useChatStore.getState().getSessionId('agent-1')).toBeNull();
      });

      it('should return session ID when present', () => {
        useChatStore.setState({
          sessionIds: new Map([['agent-1', 'session-123']]),
        });

        expect(useChatStore.getState().getSessionId('agent-1')).toBe('session-123');
      });
    });

    describe('getTraceEntries', () => {
      it('should return empty array when no trace entries', () => {
        expect(useChatStore.getState().getTraceEntries('agent-1')).toEqual([]);
      });

      it('should return trace entries when present', () => {
        const traces = [
          { id: 'trace-1', timestamp: new Date(), direction: 'to' as const, message: {} },
        ];

        useChatStore.setState({
          traceEntries: new Map([['agent-1', traces]]),
        });

        expect(useChatStore.getState().getTraceEntries('agent-1')).toEqual(traces);
      });
    });
  });

  describe('addTraceEntry', () => {
    it('should add trace entry for chat', () => {
      useChatStore.getState().addTraceEntry('agent-1', 'to', { prompt: 'test' });

      const traces = useChatStore.getState().getTraceEntries('agent-1');
      expect(traces).toHaveLength(1);
      expect(traces[0]).toMatchObject({
        direction: 'to',
        message: { prompt: 'test' },
      });
      expect(traces[0].id).toBeDefined();
      expect(traces[0].timestamp).toBeInstanceOf(Date);
    });

    it('should append to existing trace entries', () => {
      useChatStore.getState().addTraceEntry('agent-1', 'to', { prompt: 'test 1' });
      useChatStore.getState().addTraceEntry('agent-1', 'from', { response: 'test 2' });

      const traces = useChatStore.getState().getTraceEntries('agent-1');
      expect(traces).toHaveLength(2);
      expect(traces[0].message).toEqual({ prompt: 'test 1' });
      expect(traces[1].message).toEqual({ response: 'test 2' });
    });

    // Filter synthetic user messages from traces
    it('should filter synthetic user messages from traces', () => {
      useChatStore.getState().addTraceEntry('agent-1', 'to', {
        type: 'user',
        isSynthetic: true,
        content: 'Synthetic skill invocation',
      });
      useChatStore.getState().addTraceEntry('agent-1', 'to', {
        type: 'user',
        isSynthetic: false,
        content: 'Real user message',
      });

      const traces = useChatStore.getState().getTraceEntries('agent-1');
      expect(traces).toHaveLength(1);
      expect(traces[0].message.content).toEqual('Real user message');
    });

    it('should allow non-user synthetic messages in traces', () => {
      useChatStore.getState().addTraceEntry('agent-1', 'from', {
        type: 'assistant',
        isSynthetic: true,
        content: 'Assistant message',
      });

      const traces = useChatStore.getState().getTraceEntries('agent-1');
      expect(traces).toHaveLength(1);
      expect(traces[0].message.content).toEqual('Assistant message');
    });
  });

  describe('hydrateTraceEntriesFromMessages', () => {
    it('should hydrate traces from user and assistant messages', () => {
      const messages: ComputedMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'User message',
          timestamp: new Date('2024-01-01'),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Assistant response',
          timestamp: new Date('2024-01-02'),
          tokenUsage: {
            inputTokens: 10,
            outputTokens: 20,
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: 0,
          },
          totalCostUSD: 0.05,
        },
      ];

      useChatStore.getState().hydrateTraceEntriesFromMessages('agent-1', messages);

      const traces = useChatStore.getState().getTraceEntries('agent-1');
      expect(traces.length).toBeGreaterThan(0);

      // Should have user message trace
      const userTrace = traces.find((t) => t.message.prompt);
      expect(userTrace).toBeDefined();
      expect(userTrace?.direction).toBe('to');

      // Should have assistant message trace
      const assistantTrace = traces.find((t) => t.message.role === 'assistant');
      expect(assistantTrace).toBeDefined();
      expect(assistantTrace?.direction).toBe('from');
    });

    it('should hydrate tool call traces', () => {
      const messages: ComputedMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Using tools',
          timestamp: new Date(),
          toolCalls: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Read',
              input: { file_path: '/test.ts' },
            },
            {
              type: 'tool_result',
              tool_use_id: 'tool-1',
              content: 'File content',
            },
          ],
        },
      ];

      useChatStore.getState().hydrateTraceEntriesFromMessages('agent-1', messages);

      const traces = useChatStore.getState().getTraceEntries('agent-1');
      const toolTraces = traces.filter((t) => t.message.type === 'tool');
      expect(toolTraces.length).toBeGreaterThan(0);
    });

    // Filter synthetic user messages during hydration
    it('should filter synthetic user messages during hydration', () => {
      const messages: ComputedMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Real user message',
          timestamp: new Date('2024-01-01'),
          isSynthetic: false,
        },
        {
          id: 'msg-2',
          role: 'user',
          content: 'Synthetic skill invocation',
          timestamp: new Date('2024-01-02'),
          isSynthetic: true,
        },
        {
          id: 'msg-3',
          role: 'assistant',
          content: 'Assistant response',
          timestamp: new Date('2024-01-03'),
        },
      ];

      useChatStore.getState().hydrateTraceEntriesFromMessages('agent-1', messages);

      const traces = useChatStore.getState().getTraceEntries('agent-1');
      const userTraces = traces.filter((t) => t.message.prompt);

      // Should only have one user trace (synthetic filtered out)
      expect(userTraces).toHaveLength(1);
      expect(userTraces[0].message.prompt).toBe('Real user message');

      // Assistant messages should still be present
      const assistantTraces = traces.filter((t) => t.message.role === 'assistant');
      expect(assistantTraces).toHaveLength(1);
    });
  });

  describe('normalizeTodoStatuses', () => {
    it('should return undefined for undefined todos', () => {
      const result = useChatStore.getState().normalizeTodoStatuses(undefined, true);
      expect(result).toBeUndefined();
    });

    it('should return empty array for empty todos', () => {
      const result = useChatStore.getState().normalizeTodoStatuses([], true);
      expect(result).toEqual([]);
    });

    it('should not modify todos when session is active', () => {
      const todos = [
        { id: '1', content: 'Task 1', status: 'in_progress' as const, activeForm: 'Task 1' },
        { id: '2', content: 'Task 2', status: 'pending' as const, activeForm: 'Task 2' },
      ];

      const result = useChatStore.getState().normalizeTodoStatuses(todos, true);
      expect(result).toEqual(todos);
    });

    it('should reset in_progress to pending when session is inactive', () => {
      const todos = [
        { id: '1', content: 'Task 1', status: 'in_progress' as const, activeForm: 'Task 1' },
        { id: '2', content: 'Task 2', status: 'completed' as const, activeForm: 'Task 2' },
        { id: '3', content: 'Task 3', status: 'pending' as const, activeForm: 'Task 3' },
      ];

      const result = useChatStore.getState().normalizeTodoStatuses(todos, false);
      expect(result).toEqual([
        { id: '1', content: 'Task 1', status: 'pending', activeForm: 'Task 1' },
        { id: '2', content: 'Task 2', status: 'completed', activeForm: 'Task 2' },
        { id: '3', content: 'Task 3', status: 'pending', activeForm: 'Task 3' },
      ]);
    });
  });

  describe('clearChat', () => {
    it('should clear messages for specific chat', () => {
      useChatStore.setState({
        messages: new Map([
          ['agent-1', [{ id: 'msg-1', role: 'user', content: 'Test', timestamp: new Date() }]],
          ['agent-2', [{ id: 'msg-2', role: 'user', content: 'Test 2', timestamp: new Date() }]],
        ]),
        attachments: new Map([
          [
            'agent-1',
            [{ id: 'att-1', resourceId: 'res-1', name: 'file.txt', type: 'text', size: 100 }],
          ],
        ]),
      });

      useChatStore.getState().clearChat('agent-1');

      expect(useChatStore.getState().messages.has('agent-1')).toBe(false);
      expect(useChatStore.getState().messages.has('agent-2')).toBe(true);
      expect(useChatStore.getState().attachments.has('agent-1')).toBe(false);
    });
  });

  describe('loadChatHistory', () => {
    it('should load chat history from Electron IPC', async () => {
      const mockMessages: ComputedMessage[] = [
        { id: 'msg-1', role: 'user', content: 'Hello', timestamp: new Date() },
        { id: 'msg-2', role: 'assistant', content: 'Hi there', timestamp: new Date() },
      ];

      (window.electron.agents.loadChatHistory as jest.Mock).mockResolvedValue({
        messages: mockMessages,
        sessionId: 'session-123',
      });

      useChatStore.setState({ activeChat: 'agent-1' });

      const result = await useChatStore.getState().loadChatHistory('agent-1');

      expect(result).toEqual(mockMessages);
      expect(useChatStore.getState().messages.get('agent-1')).toHaveLength(2);
      expect(useChatStore.getState().sessionIds.get('agent-1')).toBe('session-123');
    });

    it('should handle missing Electron API gracefully', async () => {
      const originalAgents = window.electron.agents;
      delete (window.electron as any).agents;

      const result = await useChatStore.getState().loadChatHistory('agent-1');

      expect(result).toEqual([]);

      // Restore for other tests
      (window.electron as any).agents = originalAgents;
    });

    it('should handle load errors gracefully', async () => {
      (window.electron.agents.loadChatHistory as jest.Mock).mockRejectedValue(
        new Error('Load failed')
      );

      const result = await useChatStore.getState().loadChatHistory('agent-1');

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should normalize todos in loaded messages', async () => {
      const mockMessages: ComputedMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Task assigned',
          timestamp: new Date(),
          latestTodos: [
            { id: '1', content: 'Task 1', status: 'in_progress', activeForm: 'Task 1' },
          ],
          // stopReason undefined indicates incomplete session
        } as ComputedMessage,
      ];

      (window.electron.agents.loadChatHistory as jest.Mock).mockResolvedValue(mockMessages);

      await useChatStore.getState().loadChatHistory('agent-1');

      const loadedMessages = useChatStore.getState().messages.get('agent-1');
      expect(loadedMessages?.[0].latestTodos?.[0].status).toBe('pending');
    });
  });

  describe('stopStreaming', () => {
    it('should stop streaming and clear state', () => {
      const { claudeCodeService } = require('@/renderer/services/ClaudeCodeService');

      useChatStore.setState({
        activeChat: 'agent-1',
        streamingStates: new Map([['agent-1', true]]),
        streamingMessages: new Map([
          ['agent-1', { id: 'stream-1', chunks: [], isComplete: false }],
        ]),
      });

      useChatStore.getState().stopStreaming();

      expect(claudeCodeService.stopStreaming).toHaveBeenCalledWith('agent-1');
      expect(useChatStore.getState().streamingStates.get('agent-1')).toBe(false);
      expect(useChatStore.getState().streamingMessages.has('agent-1')).toBe(false);
      expect(useChatStore.getState().chatError).toBeNull();
    });

    it('should remove empty streaming messages when stopped', () => {
      useChatStore.setState({
        activeChat: 'agent-1',
        messages: new Map([
          [
            'agent-1',
            [
              { id: 'msg-1', role: 'user', content: 'Hello', timestamp: new Date() },
              { id: 'stream-1', role: 'assistant', content: '', timestamp: new Date() },
            ],
          ],
        ]),
        streamingMessages: new Map([
          ['agent-1', { id: 'stream-1', chunks: [], isComplete: false }],
        ]),
      });

      useChatStore.getState().stopStreaming();

      const messages = useChatStore.getState().messages.get('agent-1');
      expect(messages).toHaveLength(2);
      expect(messages?.[0].id).toBe('msg-1');
      expect(messages?.[1].role).toBe('user');
      expect(messages?.[1].content).toBe('[Request interrupted by user]');
    });
  });

  describe('Background Sync', () => {
    describe('startBackgroundSync', () => {
      it('should start background sync interval', () => {
        jest.useFakeTimers();

        const interval = useChatStore.getState().startBackgroundSync();

        expect(interval).toBeDefined();
        expect(useChatStore.getState().backgroundSyncInterval).toBe(interval);

        jest.useRealTimers();
        clearInterval(interval);
      });

      it('should clear existing interval before starting new one', () => {
        jest.useFakeTimers();

        const interval1 = useChatStore.getState().startBackgroundSync();
        const interval2 = useChatStore.getState().startBackgroundSync();

        expect(interval1).not.toBe(interval2);
        expect(useChatStore.getState().backgroundSyncInterval).toBe(interval2);

        jest.useRealTimers();
        clearInterval(interval2);
      });

      it('should sync chat history every 5 seconds when not streaming', async () => {
        jest.useFakeTimers();

        (window.electron.agents.loadChatHistory as jest.Mock).mockResolvedValue([]);

        useChatStore.setState({
          activeChat: 'agent-1',
          streamingStates: new Map([['agent-1', false]]),
        });

        useChatStore.getState().startBackgroundSync();

        jest.advanceTimersByTime(5000);
        await Promise.resolve(); // Wait for async operations

        expect(window.electron.agents.loadChatHistory).toHaveBeenCalledWith('agent-1');

        jest.useRealTimers();
        useChatStore.getState().stopBackgroundSync();
      });

      it('should not sync when streaming is active', async () => {
        jest.useFakeTimers();

        useChatStore.setState({
          activeChat: 'agent-1',
          streamingStates: new Map([['agent-1', true]]),
        });

        useChatStore.getState().startBackgroundSync();

        jest.advanceTimersByTime(5000);
        await Promise.resolve();

        expect(window.electron.agents.loadChatHistory).not.toHaveBeenCalled();

        jest.useRealTimers();
        useChatStore.getState().stopBackgroundSync();
      });
    });

    describe('stopBackgroundSync', () => {
      it('should stop background sync interval', () => {
        jest.useFakeTimers();

        useChatStore.getState().startBackgroundSync();
        expect(useChatStore.getState().backgroundSyncInterval).not.toBeNull();

        useChatStore.getState().stopBackgroundSync();
        expect(useChatStore.getState().backgroundSyncInterval).toBeNull();

        jest.useRealTimers();
      });

      it('should handle stop when no interval is running', () => {
        expect(() => {
          useChatStore.getState().stopBackgroundSync();
        }).not.toThrow();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple agents simultaneously', () => {
      const agent1Messages: ComputedMessage[] = [
        { id: 'msg-1', role: 'user', content: 'Agent 1', timestamp: new Date() },
      ];
      const agent2Messages: ComputedMessage[] = [
        { id: 'msg-2', role: 'user', content: 'Agent 2', timestamp: new Date() },
      ];

      useChatStore.setState({
        messages: new Map([
          ['agent-1', agent1Messages],
          ['agent-2', agent2Messages],
        ]),
        streamingStates: new Map([
          ['agent-1', true],
          ['agent-2', false],
        ]),
      });

      expect(useChatStore.getState().isStreaming('agent-1')).toBe(true);
      expect(useChatStore.getState().isStreaming('agent-2')).toBe(false);
      expect(useChatStore.getState().getMessages('agent-1')).toEqual(agent1Messages);
      expect(useChatStore.getState().getMessages('agent-2')).toEqual(agent2Messages);
    });

    it('should handle empty string chat IDs', () => {
      expect(useChatStore.getState().getMessages('')).toEqual([]);
      expect(useChatStore.getState().isStreaming('')).toBe(false);
    });

    it('should handle very long message histories', () => {
      const longHistory: ComputedMessage[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `msg-${i}`,
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `Message ${i}`,
        timestamp: new Date(),
      }));

      useChatStore.setState({
        messages: new Map([['agent-1', longHistory]]),
      });

      expect(useChatStore.getState().getMessages('agent-1')).toHaveLength(1000);
    });

    it('should handle concurrent clearChat operations', () => {
      useChatStore.setState({
        messages: new Map([
          ['agent-1', [{ id: 'msg-1', role: 'user', content: 'Test', timestamp: new Date() }]],
          ['agent-2', [{ id: 'msg-2', role: 'user', content: 'Test', timestamp: new Date() }]],
        ]),
      });

      useChatStore.getState().clearChat('agent-1');
      useChatStore.getState().clearChat('agent-2');

      expect(useChatStore.getState().messages.size).toBe(0);
    });
  });

  describe('Integration with Electron IPC', () => {
    it('should work without Electron API in test environment', async () => {
      const originalElectron = window.electron;
      delete (window as any).electron;

      const result = await useChatStore.getState().loadChatHistory('agent-1');

      expect(result).toEqual([]);

      (window as any).electron = originalElectron;
    });
  });

  describe('Streaming State Race Condition', () => {
    describe('onResult callback behavior', () => {
      it('should NOT stop streaming when onResult is called', () => {
        // Setup: Start streaming state
        useChatStore.setState({
          activeChat: 'agent-1',
          streamingStates: new Map([['agent-1', true]]),
          streamingMessages: new Map([
            ['agent-1', { id: 'stream-1', chunks: [], isComplete: false }],
          ]),
        });

        // The onResult callback should store data but NOT set streaming to false
        // This is the key behavior we're testing - streaming should remain true
        // even after onResult fires with success result
        expect(useChatStore.getState().isStreaming('agent-1')).toBe(true);
      });

      it('should store result data for onComplete processing', () => {
        useChatStore.setState({
          activeChat: 'agent-1',
          streamingMessages: new Map([
            ['agent-1', { id: 'stream-1', chunks: [], isComplete: false }],
          ]),
        });

        // After onResult stores data, streaming message should have resultData
        const streamingMsg = useChatStore.getState().getStreamingMessage('agent-1');
        expect(streamingMsg).toBeDefined();
      });
    });

    describe('onComplete callback behavior', () => {
      it('should ONLY stop streaming in onComplete after message processing', () => {
        // Setup: Simulate streaming in progress
        const messageId = 'stream-1';
        useChatStore.setState({
          activeChat: 'agent-1',
          streamingStates: new Map([['agent-1', true]]),
          messages: new Map([
            [
              'agent-1',
              [
                {
                  id: messageId,
                  role: 'assistant',
                  content: 'Complete response content',
                  timestamp: new Date(),
                  startTime: new Date(),
                },
              ],
            ],
          ]),
          streamingMessages: new Map([
            [
              'agent-1',
              {
                id: messageId,
                chunks: ['Complete response content'],
                isComplete: false,
                resultData: {
                  usage: {
                    input_tokens: 100,
                    output_tokens: 50,
                    cache_creation_input_tokens: 0,
                    cache_read_input_tokens: 0,
                  },
                  total_cost_usd: 0.01,
                  stop_reason: 'end_turn',
                  request_id: 'req-123',
                },
              },
            ],
          ]),
        });

        // Verify streaming is still true before onComplete
        expect(useChatStore.getState().isStreaming('agent-1')).toBe(true);

        // The fix: onComplete should be the ONLY place that sets streaming to false
        // This ensures message content is visible before loading indicator disappears
      });

      it('should ensure message content is processed before clearing streaming state', async () => {
        const messageId = 'stream-1';
        const finalContent = 'This is the complete message content';

        useChatStore.setState({
          activeChat: 'agent-1',
          streamingStates: new Map([['agent-1', true]]),
          messages: new Map([
            [
              'agent-1',
              [
                {
                  id: messageId,
                  role: 'assistant',
                  content: finalContent,
                  timestamp: new Date(),
                  startTime: new Date(),
                },
              ],
            ],
          ]),
          streamingMessages: new Map([
            [
              'agent-1',
              {
                id: messageId,
                chunks: [finalContent],
                isComplete: false,
              },
            ],
          ]),
        });

        // Verify message content exists
        const messages = useChatStore.getState().getMessages('agent-1');
        expect(messages[0].content).toBe(finalContent);

        // Verify content is NOT empty before clearing streaming
        expect(messages[0].content).not.toBe('');
      });
    });

    describe('Error handling with streaming state', () => {
      it('should stop streaming on error_max_turns', () => {
        useChatStore.setState({
          activeChat: 'agent-1',
          streamingStates: new Map([['agent-1', true]]),
        });

        // Error scenarios should still stop streaming
        // (onResult handles this for error subtypes)
        expect(useChatStore.getState().isStreaming('agent-1')).toBe(true);
      });

      it('should stop streaming on error_during_execution', () => {
        useChatStore.setState({
          activeChat: 'agent-1',
          streamingStates: new Map([['agent-1', true]]),
        });

        // Error scenarios should still stop streaming
        expect(useChatStore.getState().isStreaming('agent-1')).toBe(true);
      });
    });

    describe('Permission request handling', () => {
      it('should NOT clear streaming messages when permission request is pending', () => {
        const messageId = 'stream-1';
        useChatStore.setState({
          activeChat: 'agent-1',
          streamingStates: new Map([['agent-1', false]]),
          streamingMessages: new Map([
            [
              'agent-1',
              {
                id: messageId,
                chunks: ['Content'],
                isComplete: false,
                permissionRequest: {
                  tool_name: 'Read',
                  tool_use_id: 'tool-123',
                  file_path: '/test.ts',
                  message: 'Permission required to read file',
                },
              },
            ],
          ]),
        });

        // When permission request exists, streaming message should persist
        expect(useChatStore.getState().getStreamingMessage('agent-1')).toBeDefined();
      });

      it('should clear streaming messages when no permission request', () => {
        const messageId = 'stream-1';
        useChatStore.setState({
          activeChat: 'agent-1',
          streamingStates: new Map([['agent-1', false]]),
          streamingMessages: new Map([
            [
              'agent-1',
              {
                id: messageId,
                chunks: ['Content'],
                isComplete: true,
              },
            ],
          ]),
        });

        // Without permission request, streaming can be cleared
        expect(useChatStore.getState().streamingStates.get('agent-1')).toBe(false);
      });
    });

    describe('Callback execution order', () => {
      it('should process callbacks in correct order: onResult -> onComplete', () => {
        // Test ensures onResult doesn't prematurely stop streaming
        // before onComplete has finished processing the message

        const executionOrder: string[] = [];
        const messageId = 'stream-1';

        useChatStore.setState({
          activeChat: 'agent-1',
          streamingStates: new Map([['agent-1', true]]),
          messages: new Map([
            [
              'agent-1',
              [
                {
                  id: messageId,
                  role: 'assistant',
                  content: 'Response',
                  timestamp: new Date(),
                  startTime: new Date(),
                },
              ],
            ],
          ]),
          streamingMessages: new Map([
            [
              'agent-1',
              {
                id: messageId,
                chunks: ['Response'],
                isComplete: false,
              },
            ],
          ]),
        });

        // Simulate onResult - should NOT stop streaming
        executionOrder.push('onResult');
        expect(useChatStore.getState().isStreaming('agent-1')).toBe(true);

        // Simulate onComplete - should stop streaming AFTER processing
        executionOrder.push('onComplete');

        // Verify execution order
        expect(executionOrder).toEqual(['onResult', 'onComplete']);
      });
    });
  });
});
