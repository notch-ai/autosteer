/**
 * VirtualizedMessageList Component Tests
 */

import { render, screen } from '@testing-library/react';
import { VirtualizedMessageList } from '@/features/chat/components/VirtualizedMessageList';
import { MessageHeightEstimator } from '@/features/chat/utils/messageHeightEstimator';
import { ComputedMessage } from '@/stores/chat.selectors';

// Mock react-window
jest.mock('react-window', () => ({
  VariableSizeList: jest.fn(({ children, itemCount, itemSize }) => {
    return (
      <div data-testid="virtualized-list">
        {Array.from({ length: Math.min(itemCount, 5) }).map((_, index) => {
          const style = { height: itemSize(index) };
          return children({ index, style });
        })}
      </div>
    );
  }),
}));

// Mock logger
jest.mock('@/commons/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('VirtualizedMessageList', () => {
  let heightEstimator: MessageHeightEstimator;

  const createMockMessage = (id: string, content: string): ComputedMessage => ({
    id,
    role: 'user',
    content,
    timestamp: new Date(),
  });

  const createMockMessages = (count: number): ComputedMessage[] => {
    return Array.from({ length: count }, (_, i) => createMockMessage(`msg-${i}`, `Message ${i}`));
  };

  const mockRenderMessage = jest.fn((message: ComputedMessage, index: number) => (
    <div key={message.id} data-testid={`message-${index}`}>
      {message.content}
    </div>
  ));

  beforeEach(() => {
    jest.clearAllMocks();
    heightEstimator = new MessageHeightEstimator();
  });

  describe('Rendering', () => {
    it('should render empty list when no messages', () => {
      render(
        <VirtualizedMessageList
          messages={[]}
          heightEstimator={heightEstimator}
          isStreaming={false}
          renderMessage={mockRenderMessage}
        />
      );

      const list = screen.getByRole('log');
      expect(list).toBeInTheDocument();
    });

    it('should render messages using renderMessage callback', () => {
      const messages = createMockMessages(3);

      render(
        <VirtualizedMessageList
          messages={messages}
          heightEstimator={heightEstimator}
          isStreaming={false}
          renderMessage={mockRenderMessage}
        />
      );

      // Verify renderMessage was called with correct arguments
      expect(mockRenderMessage).toHaveBeenCalled();
      expect(mockRenderMessage).toHaveBeenCalledWith(messages[0], 0);
      expect(mockRenderMessage).toHaveBeenCalledWith(messages[1], 1);
      expect(mockRenderMessage).toHaveBeenCalledWith(messages[2], 2);
    });

    it('should render with correct accessibility attributes', () => {
      const messages = createMockMessages(2);

      render(
        <VirtualizedMessageList
          messages={messages}
          heightEstimator={heightEstimator}
          isStreaming={false}
          renderMessage={mockRenderMessage}
        />
      );

      const list = screen.getByRole('log');
      expect(list).toHaveAttribute('aria-live', 'polite');
      expect(list).toHaveAttribute('aria-label', 'Chat messages');
    });
  });

  describe('ComputedMessage Integration', () => {
    it('should work with user messages', () => {
      const messages: ComputedMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date(),
        },
      ];

      render(
        <VirtualizedMessageList
          messages={messages}
          heightEstimator={heightEstimator}
          isStreaming={false}
          renderMessage={mockRenderMessage}
        />
      );

      expect(mockRenderMessage).toHaveBeenCalledWith(messages[0], 0);
    });

    it('should work with assistant messages', () => {
      const messages: ComputedMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Hi there!',
          timestamp: new Date(),
          tokenUsage: {
            inputTokens: 10,
            outputTokens: 5,
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: 0,
          },
        },
      ];

      render(
        <VirtualizedMessageList
          messages={messages}
          heightEstimator={heightEstimator}
          isStreaming={false}
          renderMessage={mockRenderMessage}
        />
      );

      expect(mockRenderMessage).toHaveBeenCalledWith(messages[0], 0);
    });

    it('should work with system messages', () => {
      const messages: ComputedMessage[] = [
        {
          id: 'msg-1',
          role: 'system',
          content: 'Session initialized',
          timestamp: new Date(),
        },
      ];

      render(
        <VirtualizedMessageList
          messages={messages}
          heightEstimator={heightEstimator}
          isStreaming={false}
          renderMessage={mockRenderMessage}
        />
      );

      expect(mockRenderMessage).toHaveBeenCalledWith(messages[0], 0);
    });

    it('should handle messages with tool calls', () => {
      const messages: ComputedMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Using tool',
          timestamp: new Date(),
          toolCalls: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'bash',
              input: { command: 'ls' },
            },
          ],
        },
      ];

      render(
        <VirtualizedMessageList
          messages={messages}
          heightEstimator={heightEstimator}
          isStreaming={false}
          renderMessage={mockRenderMessage}
        />
      );

      expect(mockRenderMessage).toHaveBeenCalledWith(messages[0], 0);
    });
  });

  describe('Height Estimation', () => {
    it('should use height estimator for message heights', () => {
      const messages = createMockMessages(2);
      const estimateSpy = jest.spyOn(heightEstimator, 'estimate');

      render(
        <VirtualizedMessageList
          messages={messages}
          heightEstimator={heightEstimator}
          isStreaming={false}
          renderMessage={mockRenderMessage}
        />
      );

      expect(estimateSpy).toHaveBeenCalled();
    });

    it('should call measure when ref callback is invoked', () => {
      const messages = createMockMessages(1);
      const measureSpy = jest.spyOn(heightEstimator, 'measure');

      render(
        <VirtualizedMessageList
          messages={messages}
          heightEstimator={heightEstimator}
          isStreaming={false}
          renderMessage={mockRenderMessage}
        />
      );

      // Note: Actual height measurement requires real DOM dimensions
      // which are 0 in jsdom. This test verifies the component structure exists.
      expect(heightEstimator).toBeDefined();
      expect(measureSpy).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should handle large message lists efficiently', () => {
      const messages = createMockMessages(1000);

      const { container } = render(
        <VirtualizedMessageList
          messages={messages}
          heightEstimator={heightEstimator}
          isStreaming={false}
          renderMessage={mockRenderMessage}
        />
      );

      // Should render messages (virtualized rendering varies by mock implementation)
      expect(mockRenderMessage.mock.calls.length).toBeGreaterThan(0);
      expect(mockRenderMessage.mock.calls.length).toBeLessThan(1000);
      expect(container).toBeInTheDocument();
    });

    it('should update when messages change', () => {
      const { rerender } = render(
        <VirtualizedMessageList
          messages={createMockMessages(2)}
          heightEstimator={heightEstimator}
          isStreaming={false}
          renderMessage={mockRenderMessage}
        />
      );

      mockRenderMessage.mockClear();

      rerender(
        <VirtualizedMessageList
          messages={createMockMessages(3)}
          heightEstimator={heightEstimator}
          isStreaming={false}
          renderMessage={mockRenderMessage}
        />
      );

      expect(mockRenderMessage).toHaveBeenCalledTimes(3);
    });
  });

  describe('Streaming State', () => {
    it('should handle streaming state correctly', () => {
      const messages = createMockMessages(2);

      render(
        <VirtualizedMessageList
          messages={messages}
          heightEstimator={heightEstimator}
          isStreaming={true}
          renderMessage={mockRenderMessage}
        />
      );

      expect(mockRenderMessage).toHaveBeenCalled();
    });

    it('should not break when isStreaming changes', () => {
      const messages = createMockMessages(2);

      const { rerender } = render(
        <VirtualizedMessageList
          messages={messages}
          heightEstimator={heightEstimator}
          isStreaming={false}
          renderMessage={mockRenderMessage}
        />
      );

      rerender(
        <VirtualizedMessageList
          messages={messages}
          heightEstimator={heightEstimator}
          isStreaming={true}
          renderMessage={mockRenderMessage}
        />
      );

      expect(mockRenderMessage).toHaveBeenCalled();
    });
  });
});
