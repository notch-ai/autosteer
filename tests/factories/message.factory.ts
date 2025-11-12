import { ComputedMessage } from '@/stores/chat.selectors';

export interface MessageOptions {
  role?: 'user' | 'assistant';
  content?: string;
  toolCalls?: Array<{
    type: 'tool_use' | 'tool_result';
    id?: string;
    name?: string;
    input?: any;
  }>;
  attachedResources?: string[];
  tokenUsage?: ComputedMessage['tokenUsage'];
  isStreaming?: boolean;
}

/**
 * Create test messages with customizable options
 */
export function createTestMessages(count: number, options?: MessageOptions): ComputedMessage[] {
  const messages: ComputedMessage[] = [];

  for (let i = 0; i < count; i++) {
    const message: ComputedMessage = {
      id: `msg-${Date.now()}-${i}`,
      role: options?.role || (i % 2 === 0 ? 'user' : 'assistant'),
      content: options?.content || `Test message ${i + 1}`,
      timestamp: new Date(Date.now() - (count - i) * 60000),
      attachedResources: options?.attachedResources || [],
      toolCalls: options?.toolCalls || [],
    };
    if (options?.tokenUsage) {
      message.tokenUsage = options.tokenUsage;
    }
    messages.push(message);
  }

  return messages;
}

/**
 * Create a single test message
 */
export function createTestMessage(options?: MessageOptions): ComputedMessage {
  return createTestMessages(1, options)[0];
}

/**
 * Create a user message
 */
export function createUserMessage(content: string): ComputedMessage {
  return createTestMessage({ role: 'user', content });
}

/**
 * Create an assistant message
 */
export function createAssistantMessage(content: string): ComputedMessage {
  return createTestMessage({ role: 'assistant', content });
}

/**
 * Create a message with tool calls
 */
export function createMessageWithTools(toolCount: number): ComputedMessage {
  const toolCalls = Array.from({ length: toolCount }, (_, i) => ({
    type: 'tool_use' as const,
    id: `tool-${i}`,
    name: 'Read',
    input: { file_path: `/path/to/file${i}.txt` },
  }));

  return createTestMessage({
    role: 'assistant',
    content: 'Message with tool calls',
    toolCalls,
  });
}

/**
 * Create a message with token usage
 */
export function createMessageWithTokens(
  inputTokens: number,
  outputTokens: number
): ComputedMessage {
  return createTestMessage({
    role: 'assistant',
    content: 'Message with token usage',
    tokenUsage: {
      inputTokens,
      outputTokens,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    },
  });
}

/**
 * Create a streaming message
 */
export function createStreamingMessage(content: string): ComputedMessage {
  return createTestMessage({
    role: 'assistant',
    content,
    isStreaming: true,
  });
}

/**
 * Create messages with varying content lengths for height testing
 */
export function createMessagesWithVaryingHeights(): ComputedMessage[] {
  return [
    createTestMessage({ content: 'Short' }),
    createTestMessage({
      content: 'Medium length message\n'.repeat(5),
    }),
    createTestMessage({
      content: 'Long message with multiple lines\n'.repeat(20),
    }),
    createMessageWithTools(5),
    createTestMessage({
      content: 'Message with code block\n```typescript\nconst x = 1;\n```',
    }),
  ];
}
