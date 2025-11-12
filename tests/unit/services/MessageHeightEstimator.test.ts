import { MessageHeightEstimator } from '@/features/chat/utils/messageHeightEstimator';
import { ComputedMessage } from '@/stores/chat.selectors';

describe('MessageHeightEstimator', () => {
  let estimator: MessageHeightEstimator;

  beforeEach(() => {
    estimator = new MessageHeightEstimator();
  });

  describe('Height Estimation', () => {
    it('should return default height for first estimation', () => {
      const message: ComputedMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello world',
        timestamp: new Date(),
      };

      const height = estimator.estimate(message);
      expect(height).toBeGreaterThan(0);
      expect(height).toBeLessThan(300);
    });

    it('should estimate higher height for longer content', () => {
      const shortMessage: ComputedMessage = {
        id: 'msg-short',
        role: 'user',
        content: 'Hi',
        timestamp: new Date(),
      };

      const longMessage: ComputedMessage = {
        id: 'msg-long',
        role: 'user',
        content: 'This is a much longer message that spans multiple lines. '.repeat(10),
        timestamp: new Date(),
      };

      const shortHeight = estimator.estimate(shortMessage);
      const longHeight = estimator.estimate(longMessage);

      expect(longHeight).toBeGreaterThan(shortHeight);
    });

    it('should account for tool usage in height estimation', () => {
      const messageWithTools: ComputedMessage = {
        id: 'msg-tools',
        role: 'assistant',
        content: 'Let me help you',
        timestamp: new Date(),
        toolCalls: [
          { type: 'tool_use', id: 'tool-1', name: 'read_file' },
          { type: 'tool_result', id: 'tool-2', name: 'write_file' },
        ],
      };

      const messageWithoutTools: ComputedMessage = {
        id: 'msg-no-tools',
        role: 'assistant',
        content: 'Let me help you',
        timestamp: new Date(),
      };

      const heightWithTools = estimator.estimate(messageWithTools);
      const heightWithoutTools = estimator.estimate(messageWithoutTools);

      expect(heightWithTools).toBeGreaterThan(heightWithoutTools);
    });

    it('should cache estimated heights', () => {
      const message: ComputedMessage = {
        id: 'msg-cached',
        role: 'user',
        content: 'Test message',
        timestamp: new Date(),
      };

      const firstEstimate = estimator.estimate(message);
      const secondEstimate = estimator.estimate(message);

      expect(secondEstimate).toBe(firstEstimate);
    });
  });

  describe('Height Measurement', () => {
    it('should update cache with measured height', () => {
      const message: ComputedMessage = {
        id: 'msg-measured',
        role: 'user',
        content: 'Test',
        timestamp: new Date(),
      };

      const initialEstimate = estimator.estimate(message);
      const actualHeight = 150;

      estimator.measure(message.id, actualHeight);
      const newEstimate = estimator.estimate(message);

      expect(newEstimate).toBe(actualHeight);
      expect(newEstimate).not.toBe(initialEstimate);
    });

    it('should handle multiple measurements for same message', () => {
      const messageId = 'msg-multi';

      estimator.measure(messageId, 100);
      estimator.measure(messageId, 150);
      estimator.measure(messageId, 200);

      const message: ComputedMessage = {
        id: messageId,
        role: 'user',
        content: 'Test',
        timestamp: new Date(),
      };

      expect(estimator.estimate(message)).toBe(200);
    });
  });

  describe('Cache Behavior', () => {
    it('should maintain separate heights for different messages', () => {
      const msg1: ComputedMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'Short',
        timestamp: new Date(),
      };

      const msg2: ComputedMessage = {
        id: 'msg-2',
        role: 'user',
        content: 'Much longer message content',
        timestamp: new Date(),
      };

      estimator.measure('msg-1', 100);
      estimator.measure('msg-2', 200);

      expect(estimator.estimate(msg1)).toBe(100);
      expect(estimator.estimate(msg2)).toBe(200);
    });

    it('should clear cache when requested', () => {
      const message: ComputedMessage = {
        id: 'msg-clear',
        role: 'user',
        content: 'Test',
        timestamp: new Date(),
      };

      estimator.measure(message.id, 150);
      expect(estimator.estimate(message)).toBe(150);

      estimator.clearCache();
      const newEstimate = estimator.estimate(message);
      expect(newEstimate).not.toBe(150);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      const message: ComputedMessage = {
        id: 'msg-empty',
        role: 'user',
        content: '',
        timestamp: new Date(),
      };

      const height = estimator.estimate(message);
      expect(height).toBeGreaterThan(0);
    });

    it('should handle very long single-line content', () => {
      const message: ComputedMessage = {
        id: 'msg-long-line',
        role: 'user',
        content: 'a'.repeat(1000),
        timestamp: new Date(),
      };

      const height = estimator.estimate(message);
      expect(height).toBeGreaterThan(200);
    });

    it('should handle multiline content with newlines', () => {
      const message: ComputedMessage = {
        id: 'msg-multiline',
        role: 'user',
        content: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5',
        timestamp: new Date(),
      };

      const height = estimator.estimate(message);
      expect(height).toBeGreaterThan(100);
    });

    it('should handle code blocks in content', () => {
      const message: ComputedMessage = {
        id: 'msg-code',
        role: 'assistant',
        content: '```typescript\nconst x = 1;\nconst y = 2;\n```',
        timestamp: new Date(),
      };

      const height = estimator.estimate(message);
      expect(height).toBeGreaterThan(100);
    });
  });
});
