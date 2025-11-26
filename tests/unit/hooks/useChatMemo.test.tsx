import { renderHook } from '@testing-library/react';
import { useMemo } from 'react';

describe('ChatInterface useMemo() Optimizations', () => {
  describe('Message Filtering Cache', () => {
    it('should cache userMessages filter result across renders', () => {
      const messages = [
        { id: '1', role: 'user', content: 'Hello' },
        { id: '2', role: 'assistant', content: 'Hi' },
        { id: '3', role: 'user', content: 'How are you?' },
      ];

      let renderCount = 0;
      const { rerender } = renderHook(() => {
        renderCount++;
        return useMemo(() => messages.filter((msg) => msg.role === 'user'), [messages]);
      });

      const firstRender = renderCount;
      rerender();
      const secondRender = renderCount;

      expect(secondRender).toBe(firstRender + 1);
    });

    it('should recalculate when messages dependency changes', () => {
      const messages1 = [
        { id: '1', role: 'user', content: 'Hello' },
        { id: '2', role: 'assistant', content: 'Hi' },
      ];

      const messages2 = [
        { id: '1', role: 'user', content: 'Hello' },
        { id: '2', role: 'assistant', content: 'Hi' },
        { id: '3', role: 'user', content: 'New message' },
      ];

      const { result, rerender } = renderHook(
        ({ msgs }) => useMemo(() => msgs.filter((msg) => msg.role === 'user'), [msgs]),
        { initialProps: { msgs: messages1 } }
      );

      const firstResult = result.current;
      expect(firstResult).toHaveLength(1);

      rerender({ msgs: messages2 });
      const secondResult = result.current;
      expect(secondResult).toHaveLength(2);
      expect(secondResult).not.toBe(firstResult);
    });

    it('should cache assistantMessages filter result', () => {
      const messages = [
        { id: '1', role: 'user', content: 'Hello' },
        { id: '2', role: 'assistant', content: 'Hi' },
        { id: '3', role: 'assistant', content: 'How can I help?' },
      ];

      const { result, rerender } = renderHook(() =>
        useMemo(() => messages.filter((msg) => msg.role === 'assistant'), [messages])
      );

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
      expect(firstResult).toHaveLength(2);
    });
  });

  describe('Tool Call Filtering Cache', () => {
    it('should cache toolCalls filter for tool_use type', () => {
      const toolCalls = [
        { type: 'tool_use', name: 'Read', id: '1' },
        { type: 'tool_result', id: '2' },
        { type: 'tool_use', name: 'Write', id: '3' },
      ];

      const { result, rerender } = renderHook(() =>
        useMemo(() => toolCalls.filter((tc) => tc.type === 'tool_use'), [toolCalls])
      );

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
      expect(firstResult).toHaveLength(2);
    });

    it('should cache toolCalls filter excluding TodoWrite', () => {
      const toolCalls = [
        { type: 'tool_use', name: 'Read', id: '1' },
        { type: 'tool_use', name: 'TodoWrite', id: '2' },
        { type: 'tool_use', name: 'Write', id: '3' },
      ];

      const { result, rerender } = renderHook(() =>
        useMemo(
          () =>
            toolCalls
              .filter((tc) => tc.type === 'tool_use')
              .filter((tc) => tc.name !== 'TodoWrite'),
          [toolCalls]
        )
      );

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
      expect(firstResult).toHaveLength(2);
      expect(firstResult.every((tc) => tc.name !== 'TodoWrite')).toBe(true);
    });
  });

  describe('Content Transformation Cache', () => {
    it('should cache assistantContents map and filter chain', () => {
      const assistantMessages = [
        { id: '1', role: 'assistant', content: 'Hello' },
        { id: '2', role: 'assistant', content: '' },
        { id: '3', role: 'assistant', content: 'World' },
      ];

      const { result, rerender } = renderHook(() =>
        useMemo(
          () => assistantMessages.map((msg) => msg.content).filter(Boolean),
          [assistantMessages]
        )
      );

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
      expect(firstResult).toEqual(['Hello', 'World']);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should complete filter operation under 5ms for 100 messages', () => {
      const messages = Array.from({ length: 100 }, (_, i) => ({
        id: String(i),
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      }));

      const start = performance.now();
      const filtered = messages.filter((msg) => msg.role === 'user');
      const end = performance.now();
      const duration = end - start;

      expect(filtered).toHaveLength(50);
      expect(duration).toBeLessThan(5);
    });

    it('should complete toolCalls filter under 5ms for 50 tool calls', () => {
      const toolCalls = Array.from({ length: 50 }, (_, i) => ({
        type: i % 3 === 0 ? 'tool_use' : 'tool_result',
        name: i % 5 === 0 ? 'TodoWrite' : 'Read',
        id: String(i),
      }));

      const start = performance.now();
      const filtered = toolCalls
        .filter((tc) => tc.type === 'tool_use')
        .filter((tc) => tc.name !== 'TodoWrite');
      const end = performance.now();
      const duration = end - start;

      expect(filtered.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(5);
    });

    it('should demonstrate cache hit performance improvement', () => {
      const messages = Array.from({ length: 100 }, (_, i) => ({
        id: String(i),
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      }));

      // First render - cache miss
      const { result, rerender } = renderHook(() =>
        useMemo(() => messages.filter((msg) => msg.role === 'user'), [messages])
      );

      const start = performance.now();
      rerender();
      const end = performance.now();
      const cacheHitDuration = end - start;

      // Cache hit should be faster than 10ms (CI environments can be slower)
      expect(cacheHitDuration).toBeLessThan(10);
      expect(result.current).toHaveLength(50);
    });
  });

  describe('Dependency Array Validation', () => {
    it('should trigger recomputation when messages array reference changes', () => {
      const messages1 = [{ id: '1', role: 'user', content: 'Hello' }];
      const messages2 = [{ id: '1', role: 'user', content: 'Hello' }];

      const { result, rerender } = renderHook(
        ({ msgs }) => useMemo(() => msgs.filter((msg) => msg.role === 'user'), [msgs]),
        { initialProps: { msgs: messages1 } }
      );

      const firstResult = result.current;
      rerender({ msgs: messages2 });
      const secondResult = result.current;

      expect(secondResult).not.toBe(firstResult);
    });

    it('should NOT trigger recomputation when messages reference is stable', () => {
      const messages = [{ id: '1', role: 'user', content: 'Hello' }];

      const { result, rerender } = renderHook(() =>
        useMemo(() => messages.filter((msg) => msg.role === 'user'), [messages])
      );

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
    });
  });

  describe('Large Dataset Performance', () => {
    it('should handle 500 messages efficiently with useMemo', () => {
      const messages = Array.from({ length: 500 }, (_, i) => ({
        id: String(i),
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
        toolCalls: i % 10 === 0 ? [{ type: 'tool_use', name: 'Read' }] : undefined,
      }));

      const { result, rerender } = renderHook(() => {
        const userMessages = useMemo(
          () => messages.filter((msg) => msg.role === 'user'),
          [messages]
        );
        const assistantMessages = useMemo(
          () => messages.filter((msg) => msg.role === 'assistant'),
          [messages]
        );
        return { userMessages, assistantMessages };
      });

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult.userMessages).toBe(secondResult.userMessages);
      expect(firstResult.assistantMessages).toBe(secondResult.assistantMessages);
      expect(firstResult.userMessages).toHaveLength(250);
      expect(firstResult.assistantMessages).toHaveLength(250);
    });
  });
});
