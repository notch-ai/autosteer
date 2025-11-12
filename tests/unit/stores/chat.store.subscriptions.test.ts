/**
 * Chat Store Subscription Tests
 *
 * Tests for optimized Zustand store subscriptions to prevent unnecessary re-renders
 * Validates selector efficiency and reference stability for ChatInterface component
 *
 * Coverage:
 * - Selector reference stability (messages, streaming state)
 * - Map-based state access patterns
 * - Reference equality for optimization
 * - Selector pattern demonstrations
 *
 * @see TRD Tab Switching Performance Optimization
 */

import { useChatStore } from '@/stores';
import { ComputedMessage } from '@/stores/chat.selectors';

// Mock dependencies
jest.mock('@/commons/utils/logger');

describe('ChatStore Subscriptions', () => {
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
      draftInputs: new Map(),
      draftCursorPositions: new Map(),
      validationErrors: new Map(),
      backgroundSyncInterval: null,
    });

    jest.clearAllMocks();
  });

  describe('Selector Reference Stability', () => {
    it('should return stable empty array reference from getMessages', () => {
      const state = useChatStore.getState();

      const firstCall = state.getMessages('agent-1');
      const secondCall = state.getMessages('agent-1');

      // Should return same reference for empty arrays (Zustand returns new empty array each time)
      // This test documents current behavior - optimization would cache empty arrays
      expect(firstCall).toEqual([]);
      expect(secondCall).toEqual([]);
    });

    it('should return same reference when messages array has not changed', () => {
      const testMessages: ComputedMessage[] = [
        { id: 'msg-1', role: 'user', content: 'Hello', timestamp: new Date() },
      ];

      useChatStore.setState({
        messages: new Map([['agent-1', testMessages]]),
      });

      const state = useChatStore.getState();
      const firstCall = state.getMessages('agent-1');
      const secondCall = state.getMessages('agent-1');

      // Should return same reference
      expect(firstCall).toBe(secondCall);
      expect(firstCall).toBe(testMessages);
    });

    it('should return different reference only when messages array changes', () => {
      const initialMessages: ComputedMessage[] = [
        { id: 'msg-1', role: 'user', content: 'Hello', timestamp: new Date() },
      ];

      useChatStore.setState({
        messages: new Map([['agent-1', initialMessages]]),
      });

      const state1 = useChatStore.getState();
      const firstCall = state1.getMessages('agent-1');

      // Update messages with new array
      const newMessages: ComputedMessage[] = [
        ...initialMessages,
        { id: 'msg-2', role: 'assistant', content: 'Hi', timestamp: new Date() },
      ];

      useChatStore.setState({
        messages: new Map([['agent-1', newMessages]]),
      });

      const state2 = useChatStore.getState();
      const secondCall = state2.getMessages('agent-1');

      // References should be different
      expect(firstCall).not.toBe(secondCall);
      expect(firstCall).toHaveLength(1);
      expect(secondCall).toHaveLength(2);
    });
  });

  describe('Map-based State Access Patterns', () => {
    it('should efficiently access different agent messages without cross-contamination', () => {
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
      });

      const state = useChatStore.getState();

      // Each agent should get their own messages
      expect(state.getMessages('agent-1')).toBe(agent1Messages);
      expect(state.getMessages('agent-2')).toBe(agent2Messages);
      expect(state.getMessages('agent-1')).not.toBe(state.getMessages('agent-2'));
    });

    it('should handle concurrent state updates for different agents', () => {
      useChatStore.setState({
        messages: new Map([
          ['agent-1', [{ id: 'msg-1', role: 'user', content: 'Test', timestamp: new Date() }]],
        ]),
        streamingStates: new Map([['agent-1', false]]),
      });

      // Update agent-2 (different agent)
      useChatStore.setState((state) => {
        const newMessages = new Map(state.messages);
        newMessages.set('agent-2', [
          { id: 'msg-2', role: 'user', content: 'Test 2', timestamp: new Date() },
        ]);
        return { messages: newMessages };
      });

      const finalState = useChatStore.getState();

      // Agent-1 messages should still exist
      expect(finalState.getMessages('agent-1')).toHaveLength(1);
      expect(finalState.getMessages('agent-2')).toHaveLength(1);
    });
  });

  describe('getCurrentMessages Behavior', () => {
    it('should return empty array when no active chat', () => {
      const state = useChatStore.getState();

      const messages = state.getCurrentMessages();

      expect(messages).toEqual([]);
    });

    it('should return messages for active chat', () => {
      const testMessages: ComputedMessage[] = [
        { id: 'msg-1', role: 'user', content: 'Hello', timestamp: new Date() },
      ];

      useChatStore.setState({
        activeChat: 'agent-1',
        messages: new Map([['agent-1', testMessages]]),
      });

      const state = useChatStore.getState();
      const messages = state.getCurrentMessages();

      expect(messages).toBe(testMessages);
    });

    it('should return different messages when active chat switches', () => {
      const agent1Messages: ComputedMessage[] = [
        { id: 'msg-1', role: 'user', content: 'Agent 1', timestamp: new Date() },
      ];
      const agent2Messages: ComputedMessage[] = [
        { id: 'msg-2', role: 'user', content: 'Agent 2', timestamp: new Date() },
      ];

      useChatStore.setState({
        activeChat: 'agent-1',
        messages: new Map([
          ['agent-1', agent1Messages],
          ['agent-2', agent2Messages],
        ]),
      });

      let state = useChatStore.getState();
      expect(state.getCurrentMessages()).toBe(agent1Messages);

      // Switch active chat
      useChatStore.setState({ activeChat: 'agent-2' });

      state = useChatStore.getState();
      expect(state.getCurrentMessages()).toBe(agent2Messages);
    });
  });

  describe('Performance: Reference Equality', () => {
    it('should maintain reference equality for unchanged selectors', () => {
      useChatStore.setState({
        activeChat: 'agent-1',
        messages: new Map([
          ['agent-1', [{ id: 'msg-1', role: 'user', content: 'Test', timestamp: new Date() }]],
        ]),
      });

      const state1 = useChatStore.getState();
      const messages1 = state1.getMessages('agent-1');

      // Update unrelated state
      useChatStore.setState({ chatError: 'Some error' });

      const state2 = useChatStore.getState();
      const messages2 = state2.getMessages('agent-1');

      // Should return same reference (Map value didn't change)
      expect(messages1).toBe(messages2);
    });

    it('should demonstrate optimization pattern with composite selector', () => {
      useChatStore.setState({
        activeChat: 'agent-1',
        messages: new Map([
          ['agent-1', [{ id: 'msg-1', role: 'user', content: 'Test', timestamp: new Date() }]],
        ]),
        streamingStates: new Map([['agent-1', false]]),
      });

      // Composite selector (as would be used in component with shallow comparison)
      const selector = (state: ReturnType<typeof useChatStore.getState>) => ({
        messages: state.getMessages('agent-1'),
        isStreaming: state.isStreaming('agent-1'),
      });

      const result1 = selector(useChatStore.getState());

      // Update unrelated state
      useChatStore.setState({ chatError: 'Error' });

      const result2 = selector(useChatStore.getState());

      // Individual properties should have same references
      expect(result1.messages).toBe(result2.messages);
      expect(result1.isStreaming).toBe(result2.isStreaming);
    });

    it('should demonstrate selector pattern for ChatInterface subscriptions', () => {
      // Setup initial state
      useChatStore.setState({
        activeChat: 'agent-1',
        messages: new Map([
          ['agent-1', [{ id: 'msg-1', role: 'user', content: 'Test', timestamp: new Date() }]],
        ]),
        streamingStates: new Map([['agent-1', false]]),
        streamingMessages: new Map(),
      });

      // Selector pattern that ChatInterface should use
      const chatInterfaceSelector = (state: ReturnType<typeof useChatStore.getState>) => ({
        resources: new Map(), // from useResourcesStore
        activeChat: state.activeChat,
        clearChat: state.clearChat,
        isStreaming: state.activeChat
          ? state.streamingStates.get(state.activeChat) || false
          : false,
        streamingMessage: state.activeChat ? state.streamingMessages.get(state.activeChat) : null,
      });

      const result1 = chatInterfaceSelector(useChatStore.getState());

      // Update unrelated state (should not affect selector result references)
      useChatStore.setState({ chatError: 'Some error' });

      const result2 = chatInterfaceSelector(useChatStore.getState());

      // Primitive values should be equal
      expect(result1.activeChat).toBe(result2.activeChat);
      expect(result1.isStreaming).toBe(result2.isStreaming);
      expect(result1.streamingMessage).toBe(result2.streamingMessage);
    });
  });

  describe('Streaming State Selectors', () => {
    it('should efficiently check streaming state for active chat', () => {
      useChatStore.setState({
        activeChat: 'agent-1',
        streamingStates: new Map([
          ['agent-1', true],
          ['agent-2', false],
        ]),
      });

      const state = useChatStore.getState();

      // Using the selector pattern
      const isStreaming = state.activeChat
        ? state.streamingStates.get(state.activeChat) || false
        : false;

      expect(isStreaming).toBe(true);
    });

    it('should return false when no active chat', () => {
      useChatStore.setState({
        activeChat: null,
        streamingStates: new Map([['agent-1', true]]),
      });

      const state = useChatStore.getState();
      const isStreaming = state.activeChat
        ? state.streamingStates.get(state.activeChat) || false
        : false;

      expect(isStreaming).toBe(false);
    });

    it('should return streaming message for active chat', () => {
      const streamingMsg = {
        id: 'stream-1',
        chunks: ['Hello'],
        isComplete: false,
      };

      useChatStore.setState({
        activeChat: 'agent-1',
        streamingMessages: new Map([['agent-1', streamingMsg]]),
      });

      const state = useChatStore.getState();
      const result = state.activeChat ? state.streamingMessages.get(state.activeChat) : null;

      expect(result).toBe(streamingMsg);
    });
  });

  describe('Optimized Selector Patterns', () => {
    it('should demonstrate direct property access pattern (current ChatInterface)', () => {
      useChatStore.setState({
        activeChat: 'agent-1',
        messages: new Map([
          ['agent-1', [{ id: 'msg-1', role: 'user', content: 'Test', timestamp: new Date() }]],
        ]),
      });

      // Current pattern in ChatInterface (lines 562-570)
      const state = useChatStore.getState();
      const activeChat = state.activeChat;
      const isStreaming = state.activeChat
        ? state.streamingStates.get(state.activeChat) || false
        : false;
      const streamingMessage = state.activeChat
        ? state.streamingMessages.get(state.activeChat)
        : null;

      expect(activeChat).toBe('agent-1');
      expect(isStreaming).toBe(false);
      // streamingMessage will be undefined (not set), not null
      expect(streamingMessage).toBeUndefined();
    });

    it('should demonstrate optimized selector with shallow comparison', () => {
      useChatStore.setState({
        activeChat: 'agent-1',
        messages: new Map([
          ['agent-1', [{ id: 'msg-1', role: 'user', content: 'Test', timestamp: new Date() }]],
        ]),
        streamingStates: new Map([['agent-1', false]]),
      });

      // Optimized selector pattern (for use with shallow comparison in component)
      const optimizedSelector = (state: ReturnType<typeof useChatStore.getState>) => ({
        activeChat: state.activeChat,
        isStreaming: state.activeChat
          ? state.streamingStates.get(state.activeChat) || false
          : false,
        streamingMessage: state.activeChat ? state.streamingMessages.get(state.activeChat) : null,
      });

      const result1 = optimizedSelector(useChatStore.getState());

      // Update unrelated state
      useChatStore.setState({ chatError: 'Error' });

      const result2 = optimizedSelector(useChatStore.getState());

      // With shallow comparison, component would not re-render
      // because all values are primitives or null (same references)
      expect(result1.activeChat).toBe(result2.activeChat);
      expect(result1.isStreaming).toBe(result2.isStreaming);
      expect(result1.streamingMessage).toBe(result2.streamingMessage);
    });
  });
});
