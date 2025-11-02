/**
 * Session Factory
 * Creates mock session objects for testing
 */

import { ChatMessage } from '@/entities';

/**
 * Create a test chat message
 * @param overrides - Partial message properties to override defaults
 * @returns ChatMessage object
 */
export function createTestMessage(overrides?: Partial<ChatMessage>): ChatMessage {
  const message: ChatMessage = {
    id: 'test-message-id',
    role: 'user',
    content: 'Test message content',
    timestamp: new Date(),
    attachedResources: [],
    ...overrides,
  };

  console.log('[Session Factory] Created test message:', message.id);
  return message;
}

/**
 * Create multiple test messages
 * @param count - Number of messages to create
 * @param overrides - Partial message properties to override defaults
 * @returns Array of ChatMessage objects
 */
export function createTestMessages(count: number, overrides?: Partial<ChatMessage>): ChatMessage[] {
  console.log(`[Session Factory] Creating ${count} test messages`);
  return Array.from({ length: count }, (_, index) => {
    const timestamp = new Date(Date.now() + index * 1000);
    return createTestMessage({
      id: `test-message-${index}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `Test message ${index}`,
      timestamp,
      ...overrides,
    });
  });
}

/**
 * Create a conversation (alternating user/assistant messages)
 * @param messageCount - Number of messages in conversation
 * @returns Array of ChatMessage objects alternating between user and assistant
 */
export function createTestConversation(messageCount: number): ChatMessage[] {
  console.log(`[Session Factory] Creating test conversation with ${messageCount} messages`);
  return Array.from({ length: messageCount }, (_, index) => {
    const isUser = index % 2 === 0;
    const timestamp = new Date(Date.now() + index * 1000);

    return createTestMessage({
      id: `conv-msg-${index}`,
      role: isUser ? 'user' : 'assistant',
      content: isUser
        ? `User question ${Math.floor(index / 2)}`
        : `Assistant response ${Math.floor(index / 2)}`,
      timestamp,
    });
  });
}

/**
 * Create a user message
 * @param content - Message content
 * @param overrides - Partial message properties to override defaults
 * @returns User ChatMessage
 */
export function createUserMessage(content: string, overrides?: Partial<ChatMessage>): ChatMessage {
  return createTestMessage({
    ...overrides,
    role: 'user',
    content,
  });
}

/**
 * Create an assistant message
 * @param content - Message content
 * @param overrides - Partial message properties to override defaults
 * @returns Assistant ChatMessage
 */
export function createAssistantMessage(
  content: string,
  overrides?: Partial<ChatMessage>
): ChatMessage {
  return createTestMessage({
    ...overrides,
    role: 'assistant',
    content,
  });
}

/**
 * Create a message with attached resources
 * @param resourceIds - Array of resource IDs
 * @param overrides - Partial message properties to override defaults
 * @returns ChatMessage with resources
 */
export function createMessageWithResources(
  resourceIds: string[],
  overrides?: Partial<ChatMessage>
): ChatMessage {
  return createTestMessage({
    ...overrides,
    attachedResources: resourceIds,
  });
}

/**
 * Create a session ID for testing
 * @param prefix - Optional prefix for the session ID
 * @returns Session ID string
 */
export function createTestSessionId(prefix = 'test-session'): string {
  const sessionId = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  console.log('[Session Factory] Created test session ID:', sessionId);
  return sessionId;
}

/**
 * Create a mock session manifest
 * @param worktreeId - Worktree identifier
 * @param agentId - Agent identifier
 * @param sessionId - Session identifier
 * @returns Session manifest object
 */
export function createTestSessionManifest(worktreeId: string, agentId: string, sessionId: string) {
  const manifest = {
    worktreeId,
    sessions: {
      [agentId]: {
        sessionId,
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
      },
    },
  };

  console.log('[Session Factory] Created test session manifest:', manifest);
  return manifest;
}
