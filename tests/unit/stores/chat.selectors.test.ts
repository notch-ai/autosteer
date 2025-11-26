/**
 * Chat Selectors Tests
 *
 * Tests for selector layer that works with pre-transformed ComputedMessage[].
 * Messages are transformed at source (claude.handlers.ts or ClaudeCodeService.ts)
 * before being stored, so selectors just pass through the data.
 */

import {
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
  type ComputedMessage,
} from '@/stores/chat.selectors';

// Helper to create valid UUID for tests
const uuid = (id: string): `${string}-${string}-${string}-${string}-${string}` =>
  `${id}-0000-0000-0000-000000000000` as const;

// Factory functions for ComputedMessage (store contains pre-transformed messages)
const userMsg = (id: string, content: string): ComputedMessage => ({
  id: uuid(id),
  role: 'user',
  content,
  timestamp: new Date('2024-01-01'),
});

const assistantMsg = (
  id: string,
  content: string,
  usage?: { input: number; output: number }
): ComputedMessage => {
  const msg: ComputedMessage = {
    id: uuid(id),
    role: 'assistant',
    content,
    timestamp: new Date('2024-01-01'),
  };

  if (usage) {
    msg.tokenUsage = {
      inputTokens: usage.input,
      outputTokens: usage.output,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    };
  }

  return msg;
};

const resultMsg = (id: string, cost: number): ComputedMessage => ({
  id: uuid(id),
  role: 'assistant',
  content: 'Result',
  timestamp: new Date('2024-01-01'),
  tokenUsage: {
    inputTokens: 100,
    outputTokens: 50,
    cacheCreationInputTokens: 10,
    cacheReadInputTokens: 20,
  },
  totalCostUSD: cost,
});

describe('chat.selectors', () => {
  // Note: No need to clear cache - selectors just pass through pre-transformed messages

  describe('selectMessages', () => {
    it('should return empty array when no messages', () => {
      const state: ChatStoreState = {
        messages: new Map(),
        activeChat: null,
      };

      expect(selectMessages(state, 'agent-1')).toEqual([]);
    });

    it('should return user messages from store', () => {
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

    it('should return assistant messages from store', () => {
      const state: ChatStoreState = {
        messages: new Map([['agent-1', [assistantMsg('2', 'Hi there', { input: 10, output: 5 })]]]),
        activeChat: 'agent-1',
      };

      const result = selectMessages(state, 'agent-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: uuid('2'),
        role: 'assistant',
        content: 'Hi there',
        tokenUsage: {
          inputTokens: 10,
          outputTokens: 5,
        },
      });
    });

    it('should return result messages with cost', () => {
      const state: ChatStoreState = {
        messages: new Map([['agent-1', [resultMsg('3', 0.05)]]]),
        activeChat: 'agent-1',
      };

      const result = selectMessages(state, 'agent-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: uuid('3'),
        role: 'assistant',
        totalCostUSD: 0.05,
      });
    });

    it('should return same array reference for same map', () => {
      const messagesArray = [userMsg('1', 'Test')];
      const messagesMap = new Map([['agent-1', messagesArray]]);

      const state: ChatStoreState = {
        messages: messagesMap,
        activeChat: 'agent-1',
      };

      const result1 = selectMessages(state, 'agent-1');
      const result2 = selectMessages(state, 'agent-1');

      // Same array reference since messages map hasn't changed
      expect(result1).toBe(result2);
      expect(result1).toBe(messagesArray); // Direct reference to store array
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
      const msg1 = assistantMsg('1', 'Response 1', { input: 10, output: 5 });
      const msg2 = assistantMsg('2', 'Response 2', { input: 10, output: 5 });

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

  describe('Store Integration', () => {
    it('should return messages directly from Map storage', () => {
      const messages = [userMsg('1', 'Test'), assistantMsg('2', 'Response')];
      const messagesMap = new Map([['agent-1', messages]]);

      const state: ChatStoreState = {
        messages: messagesMap,
        activeChat: 'agent-1',
      };

      const result = selectMessages(state, 'agent-1');

      expect(result).toHaveLength(2);
      expect(result).toBe(messages); // Direct reference - no transformation
    });

    it('should handle metadata flags preserved from source', () => {
      const msgWithMetadata: ComputedMessage = {
        id: uuid('1'),
        role: 'user',
        content: 'Test',
        timestamp: new Date('2024-01-01'),
        isSynthetic: true, // Preserved from source transformation
        isReplay: false,
      };

      const state: ChatStoreState = {
        messages: new Map([['agent-1', [msgWithMetadata]]]),
        activeChat: 'agent-1',
      };

      const result = selectMessages(state, 'agent-1');

      expect(result[0].isSynthetic).toBe(true);
      expect(result[0].isReplay).toBe(false);
    });

    it('should handle tool calls preserved from source', () => {
      const msgWithTools: ComputedMessage = {
        id: uuid('1'),
        role: 'assistant',
        content: 'Using tool',
        timestamp: new Date('2024-01-01'),
        toolCalls: [
          {
            type: 'tool_use',
            id: 'tool-1',
            name: 'Read',
            input: { file_path: '/test' },
          },
        ],
      };

      const state: ChatStoreState = {
        messages: new Map([['agent-1', [msgWithTools]]]),
        activeChat: 'agent-1',
      };

      const result = selectMessages(state, 'agent-1');

      expect(result[0].toolCalls).toHaveLength(1);
      expect(result[0].toolCalls?.[0].name).toBe('Read');
    });
  });
});
