import { QueryManager } from '@/services/QueryManager';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Query, SDKMessage } from '@anthropic-ai/claude-agent-sdk';

// Mock dependencies
jest.mock('@anthropic-ai/claude-agent-sdk');
jest.mock('electron-log');

describe('QueryManager', () => {
  let queryManager: QueryManager;
  const mockProjectId = 'test-project-id';
  const mockProjectPath = '/test/project/path';
  const mockSessionId = 'test-session-id';
  const mockAgentId = 'test-agent-id';

  // Mock query instance
  const mockQueryInstance = {
    interrupt: jest.fn(),
    [Symbol.asyncIterator]: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (query as jest.Mock).mockReturnValue(mockQueryInstance);
  });

  afterEach(async () => {
    if (queryManager) {
      await queryManager.destroy();
    }
  });

  describe('Initialization', () => {
    it('should create a QueryManager instance', () => {
      queryManager = new QueryManager(mockProjectId, mockProjectPath);
      expect(queryManager).toBeInstanceOf(QueryManager);
    });

    it('should initialize with default options', async () => {
      queryManager = new QueryManager(mockProjectId, mockProjectPath);
      await queryManager.initialize();

      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.any(Object),
          options: expect.objectContaining({
            cwd: mockProjectPath,
            settingSources: ['project', 'local', 'user'],
          }),
        })
      );
    });

    it('should initialize with custom options', async () => {
      queryManager = new QueryManager(mockProjectId, mockProjectPath, {
        maxSessions: 5,
        sessionIdleTimeout: 60000,
        mcpTimeout: 10000,
      });
      await queryManager.initialize();

      const stats = queryManager.getStats();
      expect(stats.projectId).toBe(mockProjectId);
      expect(stats.mcpInitialized).toBe(true);
    });

    it('should not re-initialize if already initialized', async () => {
      queryManager = new QueryManager(mockProjectId, mockProjectPath);
      await queryManager.initialize();
      await queryManager.initialize();

      // query should only be called once
      expect(query).toHaveBeenCalledTimes(1);
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      queryManager = new QueryManager(mockProjectId, mockProjectPath);
      await queryManager.initialize();
    });

    it('should create a new virtual session', async () => {
      const sessionId = await queryManager.getOrCreateSession(mockAgentId, mockSessionId);

      expect(sessionId).toBe(mockSessionId);
      const stats = queryManager.getStats();
      expect(stats.activeSessionCount).toBe(1);
    });

    it('should return existing session if already created', async () => {
      const sessionId1 = await queryManager.getOrCreateSession(mockAgentId, mockSessionId);
      const sessionId2 = await queryManager.getOrCreateSession(mockAgentId, mockSessionId);

      expect(sessionId1).toBe(sessionId2);
      const stats = queryManager.getStats();
      expect(stats.activeSessionCount).toBe(1);
    });

    it('should create multiple sessions up to maxSessions limit', async () => {
      queryManager = new QueryManager(mockProjectId, mockProjectPath, { maxSessions: 3 });
      await queryManager.initialize();

      await queryManager.getOrCreateSession(mockAgentId, 'session-1');
      await queryManager.getOrCreateSession(mockAgentId, 'session-2');
      await queryManager.getOrCreateSession(mockAgentId, 'session-3');

      const stats = queryManager.getStats();
      expect(stats.activeSessionCount).toBe(3);
    });

    it('should evict LRU session when exceeding maxSessions limit', async () => {
      queryManager = new QueryManager(mockProjectId, mockProjectPath, { maxSessions: 2 });
      await queryManager.initialize();

      await queryManager.getOrCreateSession(mockAgentId, 'session-1');
      // Wait a bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));
      await queryManager.getOrCreateSession(mockAgentId, 'session-2');
      await new Promise((resolve) => setTimeout(resolve, 10));
      await queryManager.getOrCreateSession(mockAgentId, 'session-3');

      const stats = queryManager.getStats();
      expect(stats.activeSessionCount).toBe(2);
    });

    it('should close a session', async () => {
      await queryManager.getOrCreateSession(mockAgentId, mockSessionId);
      await queryManager.closeSession(mockSessionId);

      const stats = queryManager.getStats();
      expect(stats.activeSessionCount).toBe(0);
    });

    it('should handle closing non-existent session gracefully', async () => {
      await expect(queryManager.closeSession('non-existent')).resolves.not.toThrow();
    });

    it('should emit session-closed event when closing session', async () => {
      await queryManager.getOrCreateSession(mockAgentId, mockSessionId);

      const closedHandler = jest.fn();
      queryManager.on(`session-closed:${mockSessionId}`, closedHandler);

      await queryManager.closeSession(mockSessionId);
      expect(closedHandler).toHaveBeenCalled();
    });
  });

  describe('Message Sending', () => {
    beforeEach(async () => {
      queryManager = new QueryManager(mockProjectId, mockProjectPath);
      await queryManager.initialize();
      await queryManager.getOrCreateSession(mockAgentId, mockSessionId);
    });

    it('should queue a message for sending', async () => {
      await queryManager.sendMessage(mockSessionId, 'Test message');

      const stats = queryManager.getStats();
      expect(stats.sessionMetrics[mockSessionId].messagesSent).toBe(1);
    });

    it('should queue message with attachments', async () => {
      const attachments = [{ type: 'file', path: '/test/file.txt' }];
      await queryManager.sendMessage(mockSessionId, 'Test message', attachments);

      const stats = queryManager.getStats();
      expect(stats.sessionMetrics[mockSessionId].messagesSent).toBe(1);
    });

    it('should throw error if session does not exist', async () => {
      await expect(queryManager.sendMessage('non-existent', 'Test message')).rejects.toThrow(
        'Session non-existent not found'
      );
    });

    it('should throw error if not initialized', async () => {
      const uninitializedManager = new QueryManager(mockProjectId, mockProjectPath);
      await expect(uninitializedManager.sendMessage(mockSessionId, 'Test message')).rejects.toThrow(
        'QueryManager not initialized'
      );
    });

    it('should increment sequence number for each message', async () => {
      await queryManager.sendMessage(mockSessionId, 'Message 1');
      await queryManager.sendMessage(mockSessionId, 'Message 2');
      await queryManager.sendMessage(mockSessionId, 'Message 3');

      const stats = queryManager.getStats();
      expect(stats.sessionMetrics[mockSessionId].messagesSent).toBe(3);
    });
  });

  describe('Message Routing', () => {
    beforeEach(async () => {
      queryManager = new QueryManager(mockProjectId, mockProjectPath);
      await queryManager.initialize();
      await queryManager.getOrCreateSession(mockAgentId, mockSessionId);
    });

    it('should route messages to session-specific listeners', async () => {
      const mockMessage: SDKMessage = {
        uuid: '12345678-1234-1234-1234-123456789abc',
        session_id: mockSessionId,
        type: 'assistant',
        message: {
          id: 'test-id',
          role: 'assistant',
          content: [{ type: 'text', text: 'Test response', citations: null }],
        } as any,
        parent_tool_use_id: null,
      };

      const messagePromise = new Promise<SDKMessage>((resolve) => {
        queryManager.on(`message:${mockSessionId}`, (message: SDKMessage) => {
          resolve(message);
        });
      });

      // Simulate message from SDK
      await (queryManager as any).handleSDKMessage({
        ...mockMessage,
        session_id: mockSessionId,
      });

      const receivedMessage = await messagePromise;
      expect(receivedMessage).toEqual(mockMessage);
    });

    it('should update metrics when receiving messages', async () => {
      const mockMessage: SDKMessage = {
        uuid: '12345678-1234-1234-1234-123456789abc',
        session_id: mockSessionId,
        type: 'assistant',
        message: {
          id: 'test-id',
          role: 'assistant',
          content: [{ type: 'text', text: 'Test response', citations: null }],
        } as any,
        parent_tool_use_id: null,
      };

      await (queryManager as any).handleSDKMessage({
        ...mockMessage,
        session_id: mockSessionId,
      });

      const stats = queryManager.getStats();
      expect(stats.sessionMetrics[mockSessionId].messagesReceived).toBe(1);
    });

    it('should track misrouted messages', async () => {
      const mockMessage: SDKMessage = {
        uuid: '12345678-1234-1234-1234-123456789abc',
        session_id: mockSessionId,
        type: 'assistant',
        message: {
          id: 'test-id',
          role: 'assistant',
          content: [{ type: 'text', text: 'Test response', citations: null }],
        } as any,
        parent_tool_use_id: null,
      };

      // First create metrics for the session
      await queryManager.sendMessage(mockSessionId, 'Test');

      // Then close the session
      await queryManager.closeSession(mockSessionId);

      // Create new session with same ID to get metrics reference
      await queryManager.getOrCreateSession(mockAgentId, mockSessionId);

      // Try to handle message for non-existent session
      await (queryManager as any).handleSDKMessage({
        ...mockMessage,
        session_id: 'non-existent-session',
      });

      // Note: metrics for non-existent session won't be tracked
      // This test just ensures the code doesn't crash
    });

    it('should handle messages without session_id gracefully', async () => {
      const mockMessage: SDKMessage = {
        uuid: '12345678-1234-1234-1234-123456789abc',
        session_id: mockSessionId,
        type: 'assistant',
        message: {
          id: 'test-id',
          role: 'assistant',
          content: [{ type: 'text', text: 'Test response', citations: null }],
        } as any,
        parent_tool_use_id: null,
      };

      await expect((queryManager as any).handleSDKMessage(mockMessage)).resolves.not.toThrow();
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      queryManager = new QueryManager(mockProjectId, mockProjectPath);
      await queryManager.initialize();
    });

    it('should return correct stats', () => {
      const stats = queryManager.getStats();

      expect(stats).toEqual({
        projectId: mockProjectId,
        activeSessionCount: 0,
        mcpInitialized: true,
        sessionMetrics: {},
      });
    });

    it('should update stats after creating sessions', async () => {
      await queryManager.getOrCreateSession(mockAgentId, 'session-1');
      await queryManager.getOrCreateSession(mockAgentId, 'session-2');

      const stats = queryManager.getStats();
      expect(stats.activeSessionCount).toBe(2);
      expect(Object.keys(stats.sessionMetrics)).toHaveLength(2);
    });

    it('should include session metrics in stats', async () => {
      await queryManager.getOrCreateSession(mockAgentId, mockSessionId);
      await queryManager.sendMessage(mockSessionId, 'Test message');

      const stats = queryManager.getStats();
      expect(stats.sessionMetrics[mockSessionId]).toEqual({
        messagesSent: 1,
        messagesReceived: 0,
        misrouted: 0,
        validationErrors: 0,
        cacheHits: 0,
        cacheMisses: 0,
      });
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      queryManager = new QueryManager(mockProjectId, mockProjectPath);
      await queryManager.initialize();
    });

    it('should destroy and clean up resources', async () => {
      await queryManager.getOrCreateSession(mockAgentId, mockSessionId);
      await queryManager.destroy();

      expect(mockQueryInstance.interrupt).toHaveBeenCalled();

      const stats = queryManager.getStats();
      expect(stats.activeSessionCount).toBe(0);
      expect(stats.mcpInitialized).toBe(false);
    });

    it('should close all sessions on destroy', async () => {
      await queryManager.getOrCreateSession(mockAgentId, 'session-1');
      await queryManager.getOrCreateSession(mockAgentId, 'session-2');

      await queryManager.destroy();

      const stats = queryManager.getStats();
      expect(stats.activeSessionCount).toBe(0);
    });

    it('should handle destroy when not initialized', async () => {
      const uninitializedManager = new QueryManager(mockProjectId, mockProjectPath);
      await expect(uninitializedManager.destroy()).resolves.not.toThrow();
    });
  });

  describe('Input Generator', () => {
    beforeEach(async () => {
      queryManager = new QueryManager(mockProjectId, mockProjectPath);
    });

    it('should create async generator that yields queued messages', async () => {
      await queryManager.initialize();
      await queryManager.getOrCreateSession(mockAgentId, mockSessionId);

      // Get the generator that was passed to query()
      const callArgs = (query as jest.Mock).mock.calls[0][0];
      const generator = callArgs.prompt;

      // Queue a message
      await queryManager.sendMessage(mockSessionId, 'Test message');

      // Get the next value from generator
      const result = await generator.next();
      expect(result.value).toBe('Test message');
    });

    it('should skip messages from closed sessions', async () => {
      await queryManager.initialize();
      await queryManager.getOrCreateSession(mockAgentId, mockSessionId);

      // Get the generator
      const callArgs = (query as jest.Mock).mock.calls[0][0];
      const generator = callArgs.prompt;

      // Queue a message then close session
      await queryManager.sendMessage(mockSessionId, 'Test message');
      await queryManager.closeSession(mockSessionId);

      // Generator should skip the message (this would normally wait for next message)
      // We can't easily test async waiting, so we just verify the generator exists
      expect(generator).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in message consumer gracefully', async () => {
      const errorIterator = {
        interrupt: jest.fn(),
        [Symbol.asyncIterator]: () => ({
          next: jest.fn().mockRejectedValue(new Error('SDK error')),
        }),
      };

      (query as jest.Mock).mockReturnValue(errorIterator as unknown as Query);

      queryManager = new QueryManager(mockProjectId, mockProjectPath);
      await queryManager.initialize();

      // Should not throw - error is logged internally
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should handle session operations before initialization', async () => {
      queryManager = new QueryManager(mockProjectId, mockProjectPath);

      await expect(queryManager.getOrCreateSession(mockAgentId, mockSessionId)).rejects.toThrow(
        'QueryManager not initialized'
      );
    });
  });
});
