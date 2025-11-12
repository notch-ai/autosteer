/**
 * MessageValidator Unit Tests
 *
 * Tests for message validation with progressive fallback strategy
 * Target: 80% code coverage
 */

import { MessageValidator } from '@/services/MessageValidator';
import type { ValidationOptions } from '@/types/validation.types';

describe('MessageValidator', () => {
  beforeEach(() => {
    MessageValidator.resetAllSessions();
  });

  describe('Strict Validation', () => {
    it('should validate a complete user message', () => {
      const message = {
        uuid: '123e4567-e89b-12d3-a456-426614174000',
        session_id: 'session-123',
        type: 'user',
        message: {
          role: 'user',
          content: 'Hello, Claude!',
        },
        parent_tool_use_id: null,
      };

      const result = MessageValidator.validate(message);

      expect(result.isValid).toBe(true);
      expect(result.validationMethod).toBe('strict');
      expect(result.chatMessage).not.toBeNull();
      expect(result.chatMessage?.role).toBe('user');
      expect(result.chatMessage?.content).toBe('Hello, Claude!');
      expect(result.metadata?.correlationId).toBeDefined();
      expect(result.metadata?.sessionId).toBe('session-123');
    });

    it('should validate a complete assistant message with usage', () => {
      const message = {
        uuid: '123e4567-e89b-12d3-a456-426614174001',
        session_id: 'session-123',
        type: 'assistant',
        message: {
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello, human!' }],
          model: 'claude-3-5-sonnet-20241022',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: 10,
            output_tokens: 20,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 5,
          },
        },
        parent_tool_use_id: null,
      };

      const result = MessageValidator.validate(message);

      expect(result.isValid).toBe(true);
      expect(result.validationMethod).toBe('strict');
      expect(result.chatMessage).not.toBeNull();
      expect(result.chatMessage?.role).toBe('assistant');
      expect(result.chatMessage?.content).toBe('Hello, human!');
      expect(result.chatMessage?.tokenUsage).toEqual({
        inputTokens: 10,
        outputTokens: 20,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 5,
      });
    });

    it('should validate system init message', () => {
      const message = {
        uuid: '123e4567-e89b-12d3-a456-426614174002',
        session_id: 'session-123',
        type: 'system',
        subtype: 'init',
        agents: [],
        apiKeySource: 'user',
        cwd: '/home/user/project',
        tools: ['Edit', 'Read', 'Write'],
        mcp_servers: [{ name: 'test-server', status: 'connected' }],
        model: 'claude-3-5-sonnet-20241022',
        permissionMode: 'default',
        slash_commands: ['/commit', '/pr'],
        output_style: 'default',
      };

      const result = MessageValidator.validate(message);

      expect(result.isValid).toBe(true);
      expect(result.validationMethod).toBe('strict');
      expect(result.chatMessage).toBeNull(); // System messages don't create ChatMessages
      expect(result.metadata?.sessionId).toBe('session-123');
    });

    it('should validate system init message with apiKeySource none', () => {
      const message = {
        uuid: '123e4567-e89b-12d3-a456-426614174002',
        session_id: 'session-123',
        type: 'system',
        subtype: 'init',
        agents: [],
        apiKeySource: 'none',
        cwd: '/home/user/project',
        tools: ['Edit', 'Read', 'Write'],
        mcp_servers: [{ name: 'test-server', status: 'connected' }],
        model: 'claude-3-5-sonnet-20241022',
        permissionMode: 'default',
        slash_commands: ['/commit', '/pr'],
        output_style: 'default',
      };

      const result = MessageValidator.validate(message);

      expect(result.isValid).toBe(true);
      expect(result.validationMethod).toBe('strict');
      expect(result.chatMessage).toBeNull(); // System messages don't create ChatMessages
      expect(result.metadata?.sessionId).toBe('session-123');
    });

    it('should validate system init message without uuid (runtime compatibility)', () => {
      const message = {
        session_id: 'd86231ed-56d3-4992-aa91-1714bdd03383',
        type: 'system',
        subtype: 'init',
        agents: ['general-purpose', 'trd-writer'],
        apiKeySource: 'none',
        cwd: '/Users/john.cao/.autosteer/worktrees/autosteer',
        tools: ['Task', 'Bash', 'Glob', 'Grep'],
        mcp_servers: [
          { name: 'linear', status: 'connected' },
          { name: 'notion', status: 'connected' },
        ],
        model: 'claude-sonnet-4-5-20250929',
        permissionMode: 'acceptEdits',
        slash_commands: ['/commit', '/pr', '/engineering:write-code'],
        output_style: 'default',
      };

      const result = MessageValidator.validate(message);

      expect(result.isValid).toBe(true);
      expect(result.validationMethod).toBe('strict');
      expect(result.chatMessage).toBeNull();
      expect(result.metadata?.sessionId).toBe('d86231ed-56d3-4992-aa91-1714bdd03383');
      expect(result.metadata?.correlationId).toBeDefined(); // UUID should be generated
    });

    it('should validate result message', () => {
      const message = {
        uuid: '123e4567-e89b-12d3-a456-426614174003',
        session_id: 'session-123',
        type: 'result',
        subtype: 'success',
        duration_ms: 1500,
        duration_api_ms: 1200,
        is_error: false,
        num_turns: 3,
        total_cost_usd: 0.05,
        usage: {
          input_tokens: 100,
          output_tokens: 200,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 50,
        },
        modelUsage: {},
        permission_denials: [],
        result: 'Task completed successfully',
      };

      const result = MessageValidator.validate(message);

      expect(result.isValid).toBe(true);
      expect(result.validationMethod).toBe('strict');
      expect(result.chatMessage).toBeNull(); // Result messages don't create ChatMessages
      expect(result.metadata?.totalCost).toBe(0.05);
    });

    it('should validate result message without uuid (runtime compatibility)', () => {
      const message = {
        session_id: 'session-123',
        type: 'result',
        subtype: 'success',
        duration_ms: 3466,
        is_error: false,
        num_turns: 3,
        total_cost_usd: 0.2044466,
        usage: {
          input_tokens: 3,
          output_tokens: 24,
          cache_creation_input_tokens: 54368,
          cache_read_input_tokens: 0,
        },
        modelUsage: {
          'claude-sonnet-4-5-20250929': {
            inputTokens: 3,
            outputTokens: 24,
            cacheReadInputTokens: 0,
            cacheCreationInputTokens: 54368,
            webSearchRequests: 0,
            costUSD: 0.204249,
            contextWindow: 200000,
          },
        },
        permission_denials: [],
        result: 'Hello again! 👋',
      };

      const result = MessageValidator.validate(message);

      expect(result.isValid).toBe(true);
      expect(result.validationMethod).toBe('strict');
      expect(result.chatMessage).toBeNull();
      expect(result.metadata?.totalCost).toBe(0.2044466);
      expect(result.metadata?.correlationId).toBeDefined(); // UUID should be generated
    });

    it('should validate result message without duration_api_ms (runtime compatibility)', () => {
      const message = {
        session_id: 'session-123',
        type: 'result',
        subtype: 'error_max_turns',
        duration_ms: 5000,
        // duration_api_ms intentionally omitted - SDK doesn't always send it
        is_error: true,
        num_turns: 10,
        total_cost_usd: 0.15,
        usage: {
          input_tokens: 500,
          output_tokens: 100,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 200,
        },
        modelUsage: {},
        permission_denials: [],
      };

      const result = MessageValidator.validate(message);

      expect(result.isValid).toBe(true);
      expect(result.validationMethod).toBe('strict');
      expect(result.chatMessage).toBeNull();
    });

    it('should validate stream event message', () => {
      const message = {
        uuid: '123e4567-e89b-12d3-a456-426614174004',
        session_id: 'session-123',
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: {
            type: 'text_delta',
            text: 'Hello',
          },
        },
        parent_tool_use_id: null,
      };

      const result = MessageValidator.validate(message);

      expect(result.isValid).toBe(true);
      expect(result.validationMethod).toBe('strict');
      expect(result.chatMessage?.content).toBe('Hello');
      expect(result.metadata?.isStreaming).toBe(true);
    });
  });

  describe('Relaxed Validation', () => {
    it('should fall back to relaxed validation when optional fields are missing', () => {
      const message = {
        uuid: '123e4567-e89b-12d3-a456-426614174005',
        session_id: 'session-123',
        type: 'assistant',
        message: {
          id: 'msg_124',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Response without usage' }],
          model: 'claude-3-5-sonnet-20241022',
          stop_reason: null,
          stop_sequence: null,
          // Missing usage field
        },
        parent_tool_use_id: null,
      };

      const result = MessageValidator.validate(message);

      expect(result.isValid).toBe(true);
      expect(result.validationMethod).toBe('relaxed');
      expect(result.warnings).toContain('Used relaxed validation due to missing optional fields');
      expect(result.chatMessage?.content).toBe('Response without usage');
    });
  });

  describe('Partial Extraction', () => {
    it('should extract partial data from malformed user message', () => {
      const message = {
        uuid: '123e4567-e89b-12d3-a456-426614174006',
        session_id: 'session-123',
        type: 'user',
        message: {
          content: 'Partially valid message',
          // Missing role field
        },
      };

      const result = MessageValidator.validate(message);

      expect(result.isValid).toBe(true);
      expect(result.validationMethod).toBe('partial');
      expect(result.warnings).toContain('Used partial extraction due to validation failures');
      expect(result.chatMessage).not.toBeNull();
      expect(result.chatMessage?.content).toBe('Partially valid message');
    });

    it('should extract partial data from malformed assistant message', () => {
      const message = {
        uuid: '123e4567-e89b-12d3-a456-426614174007',
        session_id: 'session-123',
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: 'Partial response' }],
          // Missing required fields like id, role, etc.
        },
      };

      const result = MessageValidator.validate(message);

      expect(result.isValid).toBe(true);
      expect(result.validationMethod).toBe('partial');
      expect(result.chatMessage?.content).toBe('Partial response');
    });

    it('should return invalid for completely malformed message', () => {
      const message = {
        type: 'unknown',
        // Missing all required fields
      };

      const result = MessageValidator.validate(message);

      expect(result.isValid).toBe(false);
      expect(result.validationMethod).toBe('partial');
      expect(result.chatMessage).toBeNull();
    });
  });

  describe('Validation Failure', () => {
    it('should fail when strict mode is enabled and message is invalid', () => {
      const message = {
        type: 'user',
        // Missing required fields
      };

      const options: ValidationOptions = {
        strict: true,
        enableFallback: false,
      };

      const result = MessageValidator.validate(message, options);

      expect(result.isValid).toBe(false);
      expect(result.validationMethod).toBe('failed');
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should fail when fallback is disabled', () => {
      const message = {
        uuid: 'invalid-uuid',
        type: 'user',
      };

      const options: ValidationOptions = {
        enableFallback: false,
      };

      const result = MessageValidator.validate(message, options);

      expect(result.isValid).toBe(false);
      expect(result.validationMethod).toBe('failed');
    });
  });

  describe('Correlation ID Tracking', () => {
    it('should generate correlation ID by default', () => {
      const message = {
        uuid: '123e4567-e89b-12d3-a456-426614174008',
        session_id: 'session-123',
        type: 'user',
        message: {
          role: 'user',
          content: 'Test message',
        },
        parent_tool_use_id: null,
      };

      const result = MessageValidator.validate(message);

      expect(result.metadata?.correlationId).toBeDefined();
      expect(typeof result.metadata?.correlationId).toBe('string');
    });

    it('should not generate correlation ID when disabled', () => {
      const message = {
        uuid: '123e4567-e89b-12d3-a456-426614174009',
        session_id: 'session-123',
        type: 'user',
        message: {
          role: 'user',
          content: 'Test message',
        },
        parent_tool_use_id: null,
      };

      const options: ValidationOptions = {
        generateCorrelationId: false,
      };

      const result = MessageValidator.validate(message, options);

      // Should use uuid as correlationId
      expect(result.metadata?.correlationId).toBe('123e4567-e89b-12d3-a456-426614174009');
    });
  });

  describe('Sequence Number Tracking', () => {
    it('should track sequence numbers when enabled', () => {
      const message1 = {
        uuid: '123e4567-e89b-12d3-a456-426614174010',
        session_id: 'session-123',
        type: 'user',
        message: { role: 'user', content: 'First message' },
        parent_tool_use_id: null,
      };

      const message2 = {
        uuid: '123e4567-e89b-12d3-a456-426614174011',
        session_id: 'session-123',
        type: 'user',
        message: { role: 'user', content: 'Second message' },
        parent_tool_use_id: null,
      };

      const result1 = MessageValidator.validate(message1);
      const result2 = MessageValidator.validate(message2);

      expect(result1.metadata?.sequenceNumber).toBe(1);
      expect(result2.metadata?.sequenceNumber).toBe(2);
    });

    it('should not track sequence numbers when disabled', () => {
      const message = {
        uuid: '123e4567-e89b-12d3-a456-426614174012',
        session_id: 'session-123',
        type: 'user',
        message: { role: 'user', content: 'Test message' },
        parent_tool_use_id: null,
      };

      const options: ValidationOptions = {
        trackSequenceNumbers: false,
      };

      const result = MessageValidator.validate(message, options);

      expect(result.metadata?.sequenceNumber).toBeUndefined();
    });
  });

  describe('Batch Validation', () => {
    it('should validate multiple messages in batch', () => {
      const messages = [
        {
          uuid: '123e4567-e89b-12d3-a456-426614174013',
          session_id: 'session-123',
          type: 'user',
          message: { role: 'user', content: 'Message 1' },
          parent_tool_use_id: null,
        },
        {
          uuid: '123e4567-e89b-12d3-a456-426614174014',
          session_id: 'session-123',
          type: 'user',
          message: { role: 'user', content: 'Message 2' },
          parent_tool_use_id: null,
        },
      ];

      const results = MessageValidator.validateBatch(messages);

      expect(results).toHaveLength(2);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
    });

    it('should provide summary statistics for batch validation', () => {
      const messages = [
        {
          uuid: '123e4567-e89b-12d3-a456-426614174015',
          session_id: 'session-123',
          type: 'user',
          message: { role: 'user', content: 'Valid' },
          parent_tool_use_id: null,
        },
        { type: 'invalid' }, // Invalid message
      ];

      const { results, summary } = MessageValidator.validateBatchWithSummary(messages);

      expect(results).toHaveLength(2);
      expect(summary.total).toBe(2);
      expect(summary.valid).toBe(1);
      expect(summary.invalid).toBe(1);
    });
  });

  describe('Message Type Specific Tests', () => {
    it('should handle tool use messages', () => {
      const message = {
        uuid: '123e4567-e89b-12d3-a456-426614174016',
        session_id: 'session-123',
        type: 'assistant',
        message: {
          id: 'msg_125',
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'tool_123',
              name: 'Edit',
              input: { file_path: '/test.ts', old_string: 'old', new_string: 'new' },
            },
          ],
          model: 'claude-3-5-sonnet-20241022',
          stop_reason: 'tool_use',
          stop_sequence: null,
          usage: {
            input_tokens: 10,
            output_tokens: 20,
          },
        },
        parent_tool_use_id: null,
      };

      const result = MessageValidator.validate(message);

      expect(result.isValid).toBe(true);
      expect(result.chatMessage?.toolUsages).toBeDefined();
      expect(result.chatMessage?.toolUsages).toHaveLength(1);
      expect(result.chatMessage?.toolUsages?.[0]).toEqual({
        id: 'tool_123',
        name: 'Edit',
        input: { file_path: '/test.ts', old_string: 'old', new_string: 'new' },
      });
    });

    it('should handle compact boundary messages', () => {
      const message = {
        uuid: '123e4567-e89b-12d3-a456-426614174017',
        session_id: 'session-123',
        type: 'system',
        subtype: 'compact_boundary',
        compact_metadata: {
          trigger: 'manual',
          pre_tokens: 1000,
        },
      };

      const result = MessageValidator.validate(message);

      expect(result.isValid).toBe(true);
      expect(result.metadata?.isCompactionReset).toBe(true);
    });

    it('should handle replay messages', () => {
      const message = {
        uuid: '123e4567-e89b-12d3-a456-426614174018',
        session_id: 'session-123',
        type: 'user',
        message: {
          role: 'user',
          content: 'Replayed message',
        },
        parent_tool_use_id: null,
        isReplay: true,
      };

      const result = MessageValidator.validate(message);

      expect(result.isValid).toBe(true);
      expect(result.metadata?.isReplay).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content arrays gracefully', () => {
      const message = {
        uuid: '123e4567-e89b-12d3-a456-426614174019',
        session_id: 'session-123',
        type: 'assistant',
        message: {
          id: 'msg_126',
          type: 'message',
          role: 'assistant',
          content: [],
          model: 'claude-3-5-sonnet-20241022',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {},
        },
        parent_tool_use_id: null,
      };

      const result = MessageValidator.validate(message);

      expect(result.isValid).toBe(true);
      expect(result.chatMessage?.content).toBe('No text content');
    });

    it('should handle mixed content arrays', () => {
      const message = {
        uuid: '123e4567-e89b-12d3-a456-426614174020',
        session_id: 'session-123',
        type: 'assistant',
        message: {
          id: 'msg_127',
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: 'First part' },
            { type: 'tool_use', id: 'tool_124', name: 'Read', input: {} },
            { type: 'text', text: 'Second part' },
          ],
          model: 'claude-3-5-sonnet-20241022',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {},
        },
        parent_tool_use_id: null,
      };

      const result = MessageValidator.validate(message);

      expect(result.isValid).toBe(true);
      expect(result.chatMessage?.content).toBe('First part\nSecond part');
      expect(result.chatMessage?.toolUsages).toHaveLength(1);
    });
  });

  describe('QueryManager Integration', () => {
    let mockQueryManager: any;

    beforeEach(() => {
      MessageValidator.resetAllSessions();

      // Create mock QueryManager with EventEmitter behavior
      mockQueryManager = {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      };
    });

    afterEach(() => {
      // Clean up any registered query managers
      MessageValidator.unregisterQueryManager(mockQueryManager);
    });

    it('should register QueryManager and listen for session-closed events when sessions are created', () => {
      MessageValidator.registerQueryManager(mockQueryManager);

      // Create a session by validating a message
      const message = {
        uuid: 'test-uuid',
        session_id: 'test-session',
        type: 'user',
        message: { role: 'user', content: 'Test' },
        parent_tool_use_id: null,
      };

      MessageValidator.validate(message);

      // Now the listener should have been set up for the session
      expect(mockQueryManager.on).toHaveBeenCalledWith(
        'session-closed:test-session',
        expect.any(Function)
      );
    });

    it('should track session-specific sequence numbers', () => {
      const session1Message1 = {
        uuid: '123e4567-e89b-12d3-a456-426614174101',
        session_id: 'session-1',
        type: 'user',
        message: { role: 'user', content: 'Session 1 Message 1' },
        parent_tool_use_id: null,
      };

      const session1Message2 = {
        uuid: '123e4567-e89b-12d3-a456-426614174102',
        session_id: 'session-1',
        type: 'user',
        message: { role: 'user', content: 'Session 1 Message 2' },
        parent_tool_use_id: null,
      };

      const session2Message1 = {
        uuid: '123e4567-e89b-12d3-a456-426614174103',
        session_id: 'session-2',
        type: 'user',
        message: { role: 'user', content: 'Session 2 Message 1' },
        parent_tool_use_id: null,
      };

      const result1 = MessageValidator.validate(session1Message1);
      const result2 = MessageValidator.validate(session1Message2);
      const result3 = MessageValidator.validate(session2Message1);

      // Session 1 should have sequence 1, 2
      expect(result1.metadata?.sequenceNumber).toBe(1);
      expect(result2.metadata?.sequenceNumber).toBe(2);

      // Session 2 should have sequence 1 (independent counter)
      expect(result3.metadata?.sequenceNumber).toBe(1);
    });

    it('should maintain separate sequence counters for different sessions', () => {
      // Interleave messages from two sessions
      const messages = [
        {
          uuid: '123e4567-e89b-12d3-a456-426614174104',
          session_id: 'session-A',
          type: 'user',
          message: { role: 'user', content: 'A1' },
          parent_tool_use_id: null,
        },
        {
          uuid: '123e4567-e89b-12d3-a456-426614174105',
          session_id: 'session-B',
          type: 'user',
          message: { role: 'user', content: 'B1' },
          parent_tool_use_id: null,
        },
        {
          uuid: '123e4567-e89b-12d3-a456-426614174106',
          session_id: 'session-A',
          type: 'user',
          message: { role: 'user', content: 'A2' },
          parent_tool_use_id: null,
        },
        {
          uuid: '123e4567-e89b-12d3-a456-426614174107',
          session_id: 'session-B',
          type: 'user',
          message: { role: 'user', content: 'B2' },
          parent_tool_use_id: null,
        },
      ];

      const results = messages.map((msg) => MessageValidator.validate(msg));

      // Session A should have sequence 1, 2
      expect(results[0].metadata?.sequenceNumber).toBe(1);
      expect(results[2].metadata?.sequenceNumber).toBe(2);

      // Session B should have sequence 1, 2
      expect(results[1].metadata?.sequenceNumber).toBe(1);
      expect(results[3].metadata?.sequenceNumber).toBe(2);
    });

    it('should cleanup session state when session is closed', () => {
      const message = {
        uuid: '123e4567-e89b-12d3-a456-426614174108',
        session_id: 'session-cleanup',
        type: 'user',
        message: { role: 'user', content: 'Test' },
        parent_tool_use_id: null,
      };

      // Validate message to create session state
      MessageValidator.validate(message);

      // Verify session exists
      expect(MessageValidator.getActiveSessions()).toContain('session-cleanup');

      // Cleanup session
      MessageValidator.cleanupSession('session-cleanup');

      // Verify session is removed
      expect(MessageValidator.getActiveSessions()).not.toContain('session-cleanup');
    });

    it('should track message count per session', () => {
      const sessionId = 'session-count';

      for (let i = 0; i < 5; i++) {
        MessageValidator.validate({
          uuid: `uuid-${i}`,
          session_id: sessionId,
          type: 'user',
          message: { role: 'user', content: `Message ${i}` },
          parent_tool_use_id: null,
        });
      }

      const sessionState = MessageValidator.getSessionState(sessionId);
      expect(sessionState).toBeDefined();
      expect(sessionState?.messageCount).toBe(5);
      expect(sessionState?.sequenceCounter).toBe(5);
    });

    it('should update last activity timestamp for each validation', (done) => {
      const sessionId = 'session-activity';

      const message1 = {
        uuid: 'uuid-1',
        session_id: sessionId,
        type: 'user',
        message: { role: 'user', content: 'Message 1' },
        parent_tool_use_id: null,
      };

      MessageValidator.validate(message1);
      const state1 = MessageValidator.getSessionState(sessionId);
      const time1 = state1?.lastActivity.getTime();

      // Wait a bit before second message
      setTimeout(() => {
        const message2 = {
          uuid: 'uuid-2',
          session_id: sessionId,
          type: 'user',
          message: { role: 'user', content: 'Message 2' },
          parent_tool_use_id: null,
        };

        MessageValidator.validate(message2);
        const state2 = MessageValidator.getSessionState(sessionId);
        const time2 = state2?.lastActivity.getTime();

        expect(time2).toBeGreaterThan(time1!);
        done();
      }, 10);
    });

    it('should get all active sessions', () => {
      const messages = [
        {
          uuid: 'uuid-1',
          session_id: 'session-X',
          type: 'user',
          message: { role: 'user', content: 'X' },
          parent_tool_use_id: null,
        },
        {
          uuid: 'uuid-2',
          session_id: 'session-Y',
          type: 'user',
          message: { role: 'user', content: 'Y' },
          parent_tool_use_id: null,
        },
        {
          uuid: 'uuid-3',
          session_id: 'session-Z',
          type: 'user',
          message: { role: 'user', content: 'Z' },
          parent_tool_use_id: null,
        },
      ];

      messages.forEach((msg) => MessageValidator.validate(msg));

      const activeSessions = MessageValidator.getActiveSessions();
      expect(activeSessions).toHaveLength(3);
      expect(activeSessions).toContain('session-X');
      expect(activeSessions).toContain('session-Y');
      expect(activeSessions).toContain('session-Z');
    });

    it('should handle messages without session_id gracefully', () => {
      const message = {
        uuid: '123e4567-e89b-12d3-a456-426614174109',
        type: 'user',
        message: { role: 'user', content: 'No session' },
        parent_tool_use_id: null,
      };

      // This should use global counter fallback
      const result = MessageValidator.validate(message);

      // Should still validate but use global counter
      expect(result.isValid).toBe(true);
      expect(result.metadata?.sequenceNumber).toBeDefined();
    });

    it('should unregister QueryManager and prevent future listeners', () => {
      MessageValidator.registerQueryManager(mockQueryManager);

      // Create a session - should set up listener
      const message1 = {
        uuid: 'uuid-1',
        session_id: 'session-1',
        type: 'user',
        message: { role: 'user', content: 'Test 1' },
        parent_tool_use_id: null,
      };
      MessageValidator.validate(message1);

      const callCountAfterFirstSession = mockQueryManager.on.mock.calls.length;
      expect(callCountAfterFirstSession).toBe(1);

      // Unregister
      MessageValidator.unregisterQueryManager(mockQueryManager);

      // Create another session - should NOT set up listener
      const message2 = {
        uuid: 'uuid-2',
        session_id: 'session-2',
        type: 'user',
        message: { role: 'user', content: 'Test 2' },
        parent_tool_use_id: null,
      };
      MessageValidator.validate(message2);

      // Should still be 1 (no new listeners after unregister)
      expect(mockQueryManager.on).toHaveBeenCalledTimes(callCountAfterFirstSession);
    });
  });
});
