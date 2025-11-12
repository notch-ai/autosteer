/**
 * Chat Selectors Tests
 *
 * Tests for memoized selector layer with 80%+ coverage.
 */

import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import {
  clearSelectorCache,
  selectAssistantMessages,
  selectCurrentMessages,
  selectLastMessage,
  selectMessageById,
  selectMessages,
  selectMessagesByRole,
  selectTotalCost,
  selectTotalTokenUsage,
  selectUserMessages,
  type ChatStoreState,
} from '@/stores/chat.selectors';

// Helper to create valid UUID for tests
const uuid = (id: string): `${string}-${string}-${string}-${string}-${string}` =>
  `${id}-0000-0000-0000-000000000000` as const;

// Factory functions for SDK messages
const userMsg = (id: string, content: string): SDKMessage =>
  ({
    type: 'user',
    uuid: uuid(id),
    session_id: 'sess-1',
    parent_tool_use_id: null,
    message: { role: 'user', content },
  }) as any;

const assistantMsg = (id: string, content: string): SDKMessage =>
  ({
    type: 'assistant',
    uuid: uuid(id),
    session_id: 'sess-1',
    parent_tool_use_id: null,
    message: {
      id: uuid(id),
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-4',
      content: [{ type: 'text', text: content, citations: null }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation: null,
        server_tool_use: null,
        service_tier: null,
      },
    },
  }) as any;

const resultMsg = (id: string, cost: number): SDKMessage =>
  ({
    type: 'result',
    subtype: 'success',
    uuid: uuid(id),
    session_id: 'sess-1',
    duration_ms: 1000,
    duration_api_ms: 800,
    is_error: false,
    num_turns: 1,
    result: 'Success',
    total_cost_usd: cost,
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 10,
      cache_read_input_tokens: 20,
      cache_creation: null,
      server_tool_use: null,
      service_tier: null,
    },
    modelUsage: {},
    permission_denials: [],
  }) as any;

describe('chat.selectors', () => {
  beforeEach(() => {
    clearSelectorCache();
  });

  describe('selectMessages', () => {
    it('should return empty array when no messages', () => {
      const state: ChatStoreState = {
        messages: new Map(),
        activeChat: null,
      };

      expect(selectMessages(state, 'agent-1')).toEqual([]);
    });

    it('should transform user messages', () => {
      const state: ChatStoreState = {
        messages: new Map([['agent-1', [userMsg('1', 'Hello')]]]),
        activeChat: 'agent-1',
      };

      const result = selectMessages(state, 'agent-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: uuid('1'),
        role: 'user',
        content: 'Hello',
      });
    });

    it('should transform assistant messages', () => {
      const state: ChatStoreState = {
        messages: new Map([['agent-1', [assistantMsg('2', 'Hi there')]]]),
        activeChat: 'agent-1',
      };

      const result = selectMessages(state, 'agent-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: uuid('2'),
        role: 'assistant',
        content: 'Hi there',
      });
    });

    it('should transform result messages', () => {
      const state: ChatStoreState = {
        messages: new Map([['agent-1', [resultMsg('3', 0.05)]]]),
        activeChat: 'agent-1',
      };

      const result = selectMessages(state, 'agent-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: uuid('3'),
        role: 'system',
        totalCostUSD: 0.05,
      });
    });

    it('should memoize results', () => {
      const state: ChatStoreState = {
        messages: new Map([['agent-1', [userMsg('1', 'Test')]]]),
        activeChat: 'agent-1',
      };

      const result1 = selectMessages(state, 'agent-1');
      const result2 = selectMessages(state, 'agent-1');

      expect(result1).toBe(result2);
    });
  });

  describe('selectMessageById', () => {
    it('should return message by ID', () => {
      const state: ChatStoreState = {
        messages: new Map([['agent-1', [userMsg('1', 'Hello'), userMsg('2', 'World')]]]),
        activeChat: 'agent-1',
      };

      const result = selectMessageById(state, 'agent-1', uuid('2'));

      expect(result?.content).toBe('World');
    });

    it('should return undefined for non-existent ID', () => {
      const state: ChatStoreState = {
        messages: new Map(),
        activeChat: null,
      };

      expect(selectMessageById(state, 'agent-1', uuid('999'))).toBeUndefined();
    });
  });

  describe('selectMessagesByRole', () => {
    it('should filter messages by role', () => {
      const state: ChatStoreState = {
        messages: new Map([
          [
            'agent-1',
            [userMsg('1', 'User 1'), assistantMsg('2', 'Assistant 1'), userMsg('3', 'User 2')],
          ],
        ]),
        activeChat: 'agent-1',
      };

      const users = selectMessagesByRole(state, 'agent-1', 'user');
      const assistants = selectMessagesByRole(state, 'agent-1', 'assistant');

      expect(users).toHaveLength(2);
      expect(assistants).toHaveLength(1);
    });
  });

  describe('selectLastMessage', () => {
    it('should return last message', () => {
      const state: ChatStoreState = {
        messages: new Map([['agent-1', [userMsg('1', 'First'), userMsg('2', 'Last')]]]),
        activeChat: 'agent-1',
      };

      const result = selectLastMessage(state, 'agent-1');

      expect(result?.content).toBe('Last');
    });

    it('should return undefined for empty messages', () => {
      const state: ChatStoreState = {
        messages: new Map(),
        activeChat: null,
      };

      expect(selectLastMessage(state, 'agent-1')).toBeUndefined();
    });
  });

  describe('selectUserMessages', () => {
    it('should return only user messages', () => {
      const state: ChatStoreState = {
        messages: new Map([['agent-1', [userMsg('1', 'User'), assistantMsg('2', 'Assistant')]]]),
        activeChat: 'agent-1',
      };

      const result = selectUserMessages(state, 'agent-1');

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
    });
  });

  describe('selectAssistantMessages', () => {
    it('should return only assistant messages', () => {
      const state: ChatStoreState = {
        messages: new Map([['agent-1', [userMsg('1', 'User'), assistantMsg('2', 'Assistant')]]]),
        activeChat: 'agent-1',
      };

      const result = selectAssistantMessages(state, 'agent-1');

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
    });
  });

  describe('selectTotalTokenUsage', () => {
    it('should calculate total token usage', () => {
      const msg1 = assistantMsg('1', 'Response 1');
      const msg2 = assistantMsg('2', 'Response 2');

      const state: ChatStoreState = {
        messages: new Map([['agent-1', [msg1, msg2]]]),
        activeChat: 'agent-1',
      };

      const result = selectTotalTokenUsage(state, 'agent-1');

      // Each message has 10 input, 5 output tokens
      expect(result.inputTokens).toBe(20);
      expect(result.outputTokens).toBe(10);
    });

    it('should return zero for no messages', () => {
      const state: ChatStoreState = {
        messages: new Map(),
        activeChat: null,
      };

      const result = selectTotalTokenUsage(state, 'agent-1');

      expect(result).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      });
    });
  });

  describe('selectTotalCost', () => {
    it('should calculate total cost', () => {
      const state: ChatStoreState = {
        messages: new Map([['agent-1', [resultMsg('1', 0.05), resultMsg('2', 0.03)]]]),
        activeChat: 'agent-1',
      };

      const result = selectTotalCost(state, 'agent-1');

      expect(result).toBe(0.08);
    });

    it('should return zero for no messages', () => {
      const state: ChatStoreState = {
        messages: new Map(),
        activeChat: null,
      };

      expect(selectTotalCost(state, 'agent-1')).toBe(0);
    });
  });

  describe('selectCurrentMessages', () => {
    it('should return messages for active chat', () => {
      const state: ChatStoreState = {
        messages: new Map([['agent-1', [userMsg('1', 'Active')]]]),
        activeChat: 'agent-1',
      };

      const result = selectCurrentMessages(state);

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Active');
    });

    it('should return empty array when no active chat', () => {
      const state: ChatStoreState = {
        messages: new Map(),
        activeChat: null,
      };

      expect(selectCurrentMessages(state)).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle messages without uuid', () => {
      const msg: SDKMessage = {
        type: 'user',
        session_id: 'sess-1',
        parent_tool_use_id: null,
        message: { role: 'user', content: 'Test' },
      } as any;

      const state: ChatStoreState = {
        messages: new Map([['agent-1', [msg]]]),
        activeChat: 'agent-1',
      };

      const result = selectMessages(state, 'agent-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toMatch(/^temp-\d+$/);
    });

    it('should handle streaming events', () => {
      const streamMsg: SDKMessage = {
        type: 'stream_event',
        uuid: uuid('1'),
        session_id: 'sess-1',
        parent_tool_use_id: null,
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'Streaming...' },
        },
      } as any;

      const state: ChatStoreState = {
        messages: new Map([['agent-1', [streamMsg]]]),
        activeChat: 'agent-1',
      };

      const result = selectMessages(state, 'agent-1');

      expect(result[0]).toMatchObject({
        role: 'assistant',
        isPartial: true,
        content: 'Streaming...',
      });
    });

    it('should handle system init messages', () => {
      const initMsg: SDKMessage = {
        type: 'system',
        subtype: 'init',
        uuid: uuid('1'),
        session_id: 'sess-1',
        agents: [],
        apiKeySource: 'user',
        cwd: '/test',
        tools: [],
        mcp_servers: [],
        model: 'claude-sonnet-4',
        permissionMode: 'default',
        slash_commands: [],
        output_style: 'json',
      };

      const state: ChatStoreState = {
        messages: new Map([['agent-1', [initMsg]]]),
        activeChat: 'agent-1',
      };

      const result = selectMessages(state, 'agent-1');

      expect(result[0].content).toContain('Session initialized');
    });

    it('should handle compact boundary messages', () => {
      const compactMsg: SDKMessage = {
        type: 'system',
        subtype: 'compact_boundary',
        uuid: uuid('1'),
        session_id: 'sess-1',
        compact_metadata: {
          trigger: 'auto',
          pre_tokens: 28000,
        },
      };

      const state: ChatStoreState = {
        messages: new Map([['agent-1', [compactMsg]]]),
        activeChat: 'agent-1',
      };

      const result = selectMessages(state, 'agent-1');

      expect(result[0].content).toContain('Compaction triggered');
    });

    it('should handle messages with array content', () => {
      const msg: SDKMessage = {
        type: 'user',
        uuid: uuid('1'),
        session_id: 'sess-1',
        parent_tool_use_id: null,
        message: [
          { type: 'text', text: 'Part 1' },
          { type: 'text', text: 'Part 2' },
        ] as any,
      } as any;

      const state: ChatStoreState = {
        messages: new Map([['agent-1', [msg]]]),
        activeChat: 'agent-1',
      };

      const result = selectMessages(state, 'agent-1');

      expect(result[0].content).toBe('Part 1\nPart 2');
    });

    it('should handle messages with tool blocks', () => {
      const msg = assistantMsg('1', 'Text response');
      (msg as any).message.content = [
        { type: 'text', text: 'Using tool' },
        { type: 'tool_use', id: 'tool-1', name: 'Read', input: { file_path: '/test' } },
      ];

      const state: ChatStoreState = {
        messages: new Map([['agent-1', [msg]]]),
        activeChat: 'agent-1',
      };

      const result = selectMessages(state, 'agent-1');

      expect(result[0].content).toBe('Using tool');
      expect(result[0].toolCalls).toHaveLength(1);
      expect(result[0].toolCalls?.[0]).toMatchObject({
        type: 'tool_use',
        id: 'tool-1',
        name: 'Read',
      });
    });

    it('should handle result message errors', () => {
      const errorMsg: SDKMessage = {
        type: 'result',
        subtype: 'error_during_execution',
        uuid: uuid('1'),
        session_id: 'sess-1',
        duration_ms: 500,
        duration_api_ms: 400,
        is_error: true,
        num_turns: 1,
        total_cost_usd: 0,
        usage: {
          input_tokens: 50,
          output_tokens: 0,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
        modelUsage: {},
        permission_denials: [],
        error: {
          type: 'execution_error',
          message: 'Failed to execute',
        },
      } as any;

      const state: ChatStoreState = {
        messages: new Map([['agent-1', [errorMsg]]]),
        activeChat: 'agent-1',
      };

      const result = selectMessages(state, 'agent-1');

      expect(result[0].role).toBe('system');
      expect(result[0].error).toBeDefined();
      expect(result[0].content).toContain('Failed to execute');
    });

    it('should handle synthetic user messages', () => {
      const syntheticMsg: SDKMessage = {
        type: 'user',
        uuid: uuid('1'),
        session_id: 'sess-1',
        parent_tool_use_id: null,
        isSynthetic: true,
        message: { role: 'user', content: 'Synthetic message' },
      } as any;

      const state: ChatStoreState = {
        messages: new Map([['agent-1', [syntheticMsg]]]),
        activeChat: 'agent-1',
      };

      const result = selectMessages(state, 'agent-1');

      expect(result[0].isSynthetic).toBe(true);
    });

    it('should handle replay messages', () => {
      const replayMsg: SDKMessage = {
        type: 'user',
        uuid: uuid('1'),
        session_id: 'sess-1',
        parent_tool_use_id: null,
        isReplay: true,
        message: { role: 'user', content: 'Replay message' },
      } as any;

      const state: ChatStoreState = {
        messages: new Map([['agent-1', [replayMsg]]]),
        activeChat: 'agent-1',
      };

      const result = selectMessages(state, 'agent-1');

      expect(result[0].isReplay).toBe(true);
    });

    it('should handle string message content', () => {
      const msg: SDKMessage = {
        type: 'user',
        uuid: uuid('1'),
        session_id: 'sess-1',
        parent_tool_use_id: null,
        message: 'Simple string content',
      } as any;

      const state: ChatStoreState = {
        messages: new Map([['agent-1', [msg]]]),
        activeChat: 'agent-1',
      };

      const result = selectMessages(state, 'agent-1');

      expect(result[0].content).toBe('Simple string content');
    });

    it('should handle unknown message types gracefully', () => {
      const unknownMsg: SDKMessage = {
        type: 'unknown_type',
        uuid: uuid('1'),
        session_id: 'sess-1',
      } as any;

      const state: ChatStoreState = {
        messages: new Map([['agent-1', [unknownMsg]]]),
        activeChat: 'agent-1',
      };

      const result = selectMessages(state, 'agent-1');

      expect(result[0].content).toBe('[Unknown message type]');
    });
  });

  describe('Memoization Behavior', () => {
    it('should return same reference for identical state', () => {
      const state: ChatStoreState = {
        messages: new Map([['agent-1', [userMsg('1', 'Test')]]]),
        activeChat: 'agent-1',
      };

      const result1 = selectMessages(state, 'agent-1');
      const result2 = selectMessages(state, 'agent-1');

      expect(result1).toBe(result2);
    });

    it('should invalidate cache when messages change', () => {
      const state1: ChatStoreState = {
        messages: new Map([['agent-1', [userMsg('1', 'Test')]]]),
        activeChat: 'agent-1',
      };

      const result1 = selectMessages(state1, 'agent-1');

      const state2: ChatStoreState = {
        messages: new Map([['agent-1', [userMsg('1', 'Test'), userMsg('2', 'New')]]]),
        activeChat: 'agent-1',
      };

      const result2 = selectMessages(state2, 'agent-1');

      expect(result1).not.toBe(result2);
      expect(result2).toHaveLength(2);
    });

    it('should cache per agent independently', () => {
      const state: ChatStoreState = {
        messages: new Map([
          ['agent-1', [userMsg('1', 'Agent 1')]],
          ['agent-2', [userMsg('2', 'Agent 2')]],
        ]),
        activeChat: null,
      };

      const agent1Result1 = selectMessages(state, 'agent-1');
      const agent1Result2 = selectMessages(state, 'agent-1');
      const agent2Result1 = selectMessages(state, 'agent-2');

      expect(agent1Result1).toBe(agent1Result2);
      expect(agent1Result1).not.toBe(agent2Result1);
    });
  });

  describe('Performance', () => {
    it('should handle large message arrays efficiently', () => {
      const messages: SDKMessage[] = [];
      for (let i = 0; i < 1000; i++) {
        messages.push(userMsg(String(i), `Message ${i}`));
      }

      const state: ChatStoreState = {
        messages: new Map([['agent-1', messages]]),
        activeChat: 'agent-1',
      };

      const start = Date.now();
      const result = selectMessages(state, 'agent-1');
      const duration = Date.now() - start;

      expect(result).toHaveLength(1000);
      expect(duration).toBeLessThan(100); // Should complete in <100ms
    });

    it('should memoize large arrays effectively', () => {
      const messages: SDKMessage[] = [];
      for (let i = 0; i < 1000; i++) {
        messages.push(userMsg(String(i), `Message ${i}`));
      }

      const state: ChatStoreState = {
        messages: new Map([['agent-1', messages]]),
        activeChat: 'agent-1',
      };

      // First call - compute
      const result1 = selectMessages(state, 'agent-1');
      // Second call - should return cached reference
      const result2 = selectMessages(state, 'agent-1');

      // Should return same reference (memoized)
      expect(result1).toBe(result2);
    });
  });

  describe('Integration with Store', () => {
    it('should work with Map-based storage', () => {
      const messagesMap = new Map<string, SDKMessage[]>();
      messagesMap.set('agent-1', [userMsg('1', 'Test')]);

      const state: ChatStoreState = {
        messages: messagesMap,
        activeChat: 'agent-1',
      };

      const result = selectMessages(state, 'agent-1');

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Test');
    });

    it('should handle Map mutations properly', () => {
      const messagesMap = new Map<string, SDKMessage[]>();
      messagesMap.set('agent-1', [userMsg('1', 'Original')]);

      const state1: ChatStoreState = {
        messages: messagesMap,
        activeChat: 'agent-1',
      };

      const result1 = selectMessages(state1, 'agent-1');
      expect(result1).toHaveLength(1);

      // Create new Map with updated messages
      const messagesMap2 = new Map<string, SDKMessage[]>();
      messagesMap2.set('agent-1', [userMsg('1', 'Original'), userMsg('2', 'New')]);

      const state2: ChatStoreState = {
        messages: messagesMap2,
        activeChat: 'agent-1',
      };

      const result2 = selectMessages(state2, 'agent-1');

      // Should reflect the change with new Map
      expect(result2).toHaveLength(2);
    });
  });
});
