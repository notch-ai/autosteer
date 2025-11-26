/**
 * Chat Silent Interruption - Integration Tests
 *
 * Integration tests for Silent Message Interruption During Claude Code Processing
 *
 * Coverage:
 * - Cancel → Send flow with rapid submissions
 * - Edge cases: concurrent operations, race conditions
 * - UI state verification (no interrupted messages)
 * - Clean session state after silent cancellation
 *
 * @see Silent Message Interruption During Claude Code Processing
 */

import { useChatStore } from '@/stores';
import { claudeCodeService } from '@/renderer/services/ClaudeCodeService';

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

describe('Chat Silent Interruption - Integration Tests', () => {
  const initialState = {
    messages: new Map(),
    activeChat: null,
    streamingMessages: new Map(),
    attachments: new Map(),
    streamingStates: new Map(),
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
    useChatStore.setState(initialState);
    jest.clearAllMocks();
  });

  describe('Cancel → Send Flow', () => {
    it('should handle rapid message submissions without race conditions', async () => {
      useChatStore.setState({ activeChat: 'test-agent-1' });

      // Setup initial long-running query
      (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
        async () => new Promise(() => {}) // Never resolves
      );

      const promise1 = useChatStore.getState().sendMessage('first message');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(useChatStore.getState().isStreaming('test-agent-1')).toBe(true);

      // Setup second query that completes
      (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
        async (_msg, _opts, callbacks) => {
          if (callbacks?.onResult) {
            callbacks.onResult({ type: 'result', subtype: 'success' });
          }
          if (callbacks?.onComplete) {
            callbacks.onComplete('response');
          }
          return Promise.resolve();
        }
      );

      // Rapidly send second message using cancelAndSend
      await useChatStore.getState().cancelAndSend('second message');

      const messages = useChatStore.getState().messages.get('test-agent-1') || [];

      // Verify no interrupted message appears
      const interruptedMsg = messages.find((m) => m.content === '[Request interrupted by user]');
      expect(interruptedMsg).toBeUndefined();

      // Verify second message was sent
      const userMessages = messages.filter((m) => m.role === 'user');
      expect(userMessages.some((m) => m.content === 'second message')).toBe(true);

      promise1.catch(() => {});
    });

    it('should handle multiple consecutive cancelAndSend calls', async () => {
      useChatStore.setState({ activeChat: 'test-agent-1' });

      let callCount = 0;
      (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
        async (_msg, _opts, callbacks) => {
          callCount++;
          if (callbacks?.onResult) {
            callbacks.onResult({ type: 'result', subtype: 'success' });
          }
          if (callbacks?.onComplete) {
            callbacks.onComplete('done');
          }
          return Promise.resolve();
        }
      );

      // Send 5 messages rapidly
      await Promise.all([
        useChatStore.getState().cancelAndSend('msg 1'),
        useChatStore.getState().cancelAndSend('msg 2'),
        useChatStore.getState().cancelAndSend('msg 3'),
        useChatStore.getState().cancelAndSend('msg 4'),
        useChatStore.getState().cancelAndSend('msg 5'),
      ]);

      const messages = useChatStore.getState().messages.get('test-agent-1') || [];
      const interruptedMsgs = messages.filter((m) => m.content === '[Request interrupted by user]');

      // No interrupted messages should appear
      expect(interruptedMsgs.length).toBe(0);

      // All messages should be sent
      expect(callCount).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle cancel during tool execution phase', async () => {
      useChatStore.setState({ activeChat: 'test-agent-1' });

      let capturedCallbacks: any = null;
      (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
        async (_msg, _opts, callbacks) => {
          capturedCallbacks = callbacks;
          return new Promise(() => {}); // Never resolves
        }
      );

      const promise1 = useChatStore.getState().sendMessage('test message');
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Simulate tool execution
      if (capturedCallbacks?.onToolUse) {
        capturedCallbacks.onToolUse({
          type: 'tool_use',
          name: 'Read',
          input: { file_path: '/test/file.ts' },
        });
      }

      // Now cancel and send new message
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

      await useChatStore.getState().cancelAndSend('new message');

      const messages = useChatStore.getState().messages.get('test-agent-1') || [];
      const interruptedMsg = messages.find((m) => m.content === '[Request interrupted by user]');

      expect(interruptedMsg).toBeUndefined();

      promise1.catch(() => {});
    });

    it('should verify clean session state after silent cancellation', async () => {
      useChatStore.setState({ activeChat: 'test-agent-1' });

      (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
        async () => new Promise(() => {})
      );

      const promise1 = useChatStore.getState().sendMessage('test');
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify streaming state before cancel
      expect(useChatStore.getState().isStreaming('test-agent-1')).toBe(true);

      // Silent cancel
      useChatStore.getState().stopStreaming({ silentCancel: true });

      // Verify clean state
      const state = useChatStore.getState();
      expect(state.isStreaming('test-agent-1')).toBe(false);
      expect(state.streamingStates.get('test-agent-1')).toBe(false);

      // Verify no interrupted message
      const messages = state.messages.get('test-agent-1') || [];
      const interruptedMsg = messages.find((m) => m.content === '[Request interrupted by user]');
      expect(interruptedMsg).toBeUndefined();

      promise1.catch(() => {});
    });

    it('should handle cancelAndSend when no active query exists', async () => {
      useChatStore.setState({ activeChat: 'test-agent-1' });

      // No active stream
      expect(useChatStore.getState().isStreaming('test-agent-1')).toBe(false);

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

      await useChatStore.getState().cancelAndSend('test message');

      const messages = useChatStore.getState().messages.get('test-agent-1') || [];
      const userMessages = messages.filter((m) => m.role === 'user');

      expect(userMessages.length).toBeGreaterThan(0);
      expect(userMessages[0].content).toBe('test message');

      // No interrupted messages
      const interruptedMsg = messages.find((m) => m.content === '[Request interrupted by user]');
      expect(interruptedMsg).toBeUndefined();
    });
  });

  describe('UI State Verification', () => {
    it('should not show interrupted UI artifacts in chat history', async () => {
      useChatStore.setState({ activeChat: 'test-agent-1' });

      // Send initial message
      (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
        async () => new Promise(() => {})
      );

      const promise1 = useChatStore.getState().sendMessage('query 1');
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Send second message with cancelAndSend
      (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
        async (_msg, _opts, callbacks) => {
          if (callbacks?.onResult) {
            callbacks.onResult({ type: 'result', subtype: 'success' });
          }
          if (callbacks?.onComplete) {
            callbacks.onComplete('response 2');
          }
          return Promise.resolve();
        }
      );

      await useChatStore.getState().cancelAndSend('query 2');

      // Send third message with cancelAndSend
      (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
        async (_msg, _opts, callbacks) => {
          if (callbacks?.onResult) {
            callbacks.onResult({ type: 'result', subtype: 'success' });
          }
          if (callbacks?.onComplete) {
            callbacks.onComplete('response 3');
          }
          return Promise.resolve();
        }
      );

      await useChatStore.getState().cancelAndSend('query 3');

      // Verify NO interrupted messages in entire history
      const messages = useChatStore.getState().messages.get('test-agent-1') || [];
      const interruptedMsgs = messages.filter((m) => m.content === '[Request interrupted by user]');

      expect(interruptedMsgs.length).toBe(0);

      // Verify all user messages are present
      const userMessages = messages.filter((m) => m.role === 'user');
      expect(userMessages.some((m) => m.content === 'query 1')).toBe(true);
      expect(userMessages.some((m) => m.content === 'query 2')).toBe(true);
      expect(userMessages.some((m) => m.content === 'query 3')).toBe(true);

      promise1.catch(() => {});
    });

    it('should maintain correct message order after silent cancellations', async () => {
      useChatStore.setState({ activeChat: 'test-agent-1' });

      let resolveFirstQuery: any;
      const firstQueryPromise = new Promise((resolve) => {
        resolveFirstQuery = resolve;
      });

      (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
        async () => firstQueryPromise
      );

      const promise1 = useChatStore.getState().sendMessage('msg 1');
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Send second message (should cancel first)
      (claudeCodeService.queryWithStreaming as jest.Mock).mockImplementation(
        async (_msg, _opts, callbacks) => {
          if (callbacks?.onResult) {
            callbacks.onResult({ type: 'result', subtype: 'success' });
          }
          if (callbacks?.onComplete) {
            callbacks.onComplete('response 2');
          }
          return Promise.resolve();
        }
      );

      await useChatStore.getState().cancelAndSend('msg 2');

      const messages = useChatStore.getState().messages.get('test-agent-1') || [];
      const userMessages = messages.filter((m) => m.role === 'user');

      // Messages should be in order
      expect(userMessages[0].content).toBe('msg 1');
      expect(userMessages[1].content).toBe('msg 2');

      // No interrupted messages between them
      const interruptedMsgs = messages.filter((m) => m.content === '[Request interrupted by user]');
      expect(interruptedMsgs.length).toBe(0);

      resolveFirstQuery();
      promise1.catch(() => {});
    });
  });

  describe('Performance', () => {
    it('should handle 10 rapid cancelAndSend operations without memory leaks', async () => {
      useChatStore.setState({ activeChat: 'test-agent-1' });

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

      const startMemory = process.memoryUsage().heapUsed;

      // Send 10 messages rapidly
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(useChatStore.getState().cancelAndSend(`message ${i}`));
      }

      await Promise.all(promises);

      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = endMemory - startMemory;

      // Verify no interrupted messages
      const messages = useChatStore.getState().messages.get('test-agent-1') || [];
      const interruptedMsgs = messages.filter((m) => m.content === '[Request interrupted by user]');
      expect(interruptedMsgs.length).toBe(0);

      // Memory increase should be reasonable (< 10MB for 10 messages)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});
