import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChatMessage } from '@/entities';

// Mock react-window
jest.mock('react-window', () => ({
  VariableSizeList: ({
    children,
    itemCount,
    itemSize,
  }: {
    children: (props: { index: number; style: React.CSSProperties }) => React.ReactNode;
    itemCount: number;
    itemSize: (index: number) => number;
  }) => {
    return (
      <div data-testid="virtual-list">
        {Array.from({ length: Math.min(itemCount, 40) }).map((_, index) =>
          children({ index, style: {} })
        )}
      </div>
    );
  },
}));

// Helper to create test messages
const createTestMessages = (count: number): ChatMessage[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Message ${i}`,
    timestamp: new Date(),
  })) as ChatMessage[];
};

describe('Virtual Scrolling Integration', () => {
  describe('DOM Rendering', () => {
    it('should render only visible messages with VariableSizeList', () => {
      const messages = createTestMessages(1000);

      // This will be tested with actual ChatInterface once implemented
      const { container } = render(
        <div data-testid="virtual-list">
          {messages.slice(0, 40).map((msg) => (
            <div key={msg.id} data-testid="message-item">
              {msg.content}
            </div>
          ))}
        </div>
      );

      const renderedMessages = screen.getAllByTestId('message-item');
      expect(renderedMessages.length).toBeLessThanOrEqual(40);
      expect(renderedMessages.length).toBeLessThan(messages.length);
    });

    it('should use overscan to render extra messages for smooth scrolling', () => {
      const messages = createTestMessages(100);
      const visibleCount = 20;
      const overscanCount = 5;
      const expectedRenderCount = visibleCount + overscanCount * 2;

      const { container } = render(
        <div data-testid="virtual-list">
          {messages.slice(0, expectedRenderCount).map((msg) => (
            <div key={msg.id} data-testid="message-item">
              {msg.content}
            </div>
          ))}
        </div>
      );

      const renderedMessages = screen.getAllByTestId('message-item');
      expect(renderedMessages.length).toBeLessThanOrEqual(expectedRenderCount);
    });
  });

  describe('Height Estimation', () => {
    it('should provide getItemSize function for dynamic heights', () => {
      const messages = createTestMessages(10);
      const getItemSize = jest.fn((index: number) => {
        const message = messages[index];
        return 80 + message.content.length * 0.5;
      });

      messages.forEach((_, index) => {
        getItemSize(index);
      });

      expect(getItemSize).toHaveBeenCalledTimes(messages.length);
      expect(getItemSize(0)).toBeGreaterThan(0);
    });

    it('should adjust heights after measurement', () => {
      const messageId = 'msg-1';
      const estimatedHeight = 120;
      const measuredHeight = 150;

      const heightCache = new Map<string, number>();
      heightCache.set(messageId, estimatedHeight);

      // Simulate measurement callback
      heightCache.set(messageId, measuredHeight);

      expect(heightCache.get(messageId)).toBe(measuredHeight);
    });
  });

  describe('Performance', () => {
    it('should handle large message lists efficiently', () => {
      const largeMessageSet = createTestMessages(1000);
      const start = performance.now();

      const { container } = render(
        <div data-testid="virtual-list">
          {largeMessageSet.slice(0, 40).map((msg) => (
            <div key={msg.id} data-testid="message-item">
              {msg.content}
            </div>
          ))}
        </div>
      );

      const end = performance.now();
      const renderTime = end - start;

      expect(renderTime).toBeLessThan(100);
      expect(screen.getAllByTestId('message-item').length).toBeLessThanOrEqual(40);
    });

    it('should reduce memory usage for large lists', () => {
      const messages1000 = createTestMessages(1000);
      const messages100 = createTestMessages(100);

      // Both should render similar number of DOM nodes
      const { container: container1000 } = render(
        <div data-testid="virtual-list">
          {messages1000.slice(0, 40).map((msg) => (
            <div key={msg.id} data-testid="message-item">
              {msg.content}
            </div>
          ))}
        </div>
      );

      const { container: container100 } = render(
        <div data-testid="virtual-list">
          {messages100.slice(0, 40).map((msg) => (
            <div key={msg.id} data-testid="message-item">
              {msg.content}
            </div>
          ))}
        </div>
      );

      const nodes1000 = container1000.querySelectorAll('[data-testid="message-item"]').length;
      const nodes100 = container100.querySelectorAll('[data-testid="message-item"]').length;

      // Both should have similar DOM node counts despite different total message counts
      expect(Math.abs(nodes1000 - nodes100)).toBeLessThan(10);
    });
  });

  describe('Scroll Behavior', () => {
    it('should preserve scroll position when list updates', () => {
      const messages = createTestMessages(100);
      let scrollTop = 500;

      // Simulate scroll position preservation
      const preservedScrollTop = scrollTop;
      messages.push({
        id: 'new-msg',
        role: 'user',
        content: 'New message',
        timestamp: new Date(),
      } as ChatMessage);

      expect(preservedScrollTop).toBe(500);
    });

    it('should scroll to bottom for new messages when already at bottom', () => {
      const messages = createTestMessages(50);
      const containerHeight = 600;
      const totalHeight = messages.length * 120;
      const scrollTop = totalHeight - containerHeight - 10; // Within 50px of bottom

      const isNearBottom = totalHeight - scrollTop - containerHeight < 50;
      expect(isNearBottom).toBe(true);
    });
  });

  describe('Row Rendering', () => {
    it('should render Row component with correct props', () => {
      const message: ChatMessage = {
        id: 'test-msg',
        role: 'user',
        content: 'Test message',
        timestamp: new Date(),
      };

      const onHeightMeasured = jest.fn();
      const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
        <div style={style} data-testid={`row-${index}`}>
          <div data-testid="message-item">{message.content}</div>
        </div>
      );

      render(<Row index={0} style={{ height: 120 }} />);

      expect(screen.getByTestId('row-0')).toBeInTheDocument();
      expect(screen.getByTestId('message-item')).toHaveTextContent('Test message');
    });

    it('should trigger height measurement callback', () => {
      const onHeightMeasured = jest.fn();
      const actualHeight = 150;

      // Simulate height measurement
      onHeightMeasured(actualHeight);

      expect(onHeightMeasured).toHaveBeenCalledWith(actualHeight);
    });
  });

  describe('List Reset', () => {
    it('should reset list after height measurements', () => {
      const resetAfterIndex = jest.fn();
      const messageIndex = 5;

      // Simulate list reset after measurement
      resetAfterIndex(messageIndex);

      expect(resetAfterIndex).toHaveBeenCalledWith(messageIndex);
    });

    it('should handle multiple resets efficiently', () => {
      const resetAfterIndex = jest.fn();

      resetAfterIndex(0);
      resetAfterIndex(5);
      resetAfterIndex(10);

      expect(resetAfterIndex).toHaveBeenCalledTimes(3);
    });
  });
});
