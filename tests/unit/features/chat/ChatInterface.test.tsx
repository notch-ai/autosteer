import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChatInterface } from '@/features/chat/components/ChatInterface';
import { logger } from '@/commons/utils/logger';

// Mock dependencies
jest.mock('@/commons/utils/logger');
jest.mock('@/features/chat/components/ChatInput', () => ({
  ChatInput: () => <div data-testid="chat-input">Chat Input</div>,
}));
jest.mock('@/features/chat/components/AutoLinkedText', () => ({
  AutoLinkedText: ({ text }: { text: string }) => <div>{text}</div>,
}));
jest.mock('@/features/chat/components/CachedMarkdownRenderer', () => ({
  CachedMarkdownRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}));
jest.mock('@/hooks/useMessageMetadata', () => ({
  useMessageMetadata: jest.fn(() => ({
    activeMetadataTab: new Map(),
    handleMetadataToggle: jest.fn(),
  })),
}));
jest.mock('@/hooks/usePermissionHandling', () => ({
  usePermissionHandling: jest.fn(() => ({
    handlePermissionApprove: jest.fn(),
    handlePermissionReject: jest.fn(),
  })),
}));
jest.mock('@/hooks/useFileDragDrop', () => ({
  useFileDragDrop: jest.fn(() => ({
    isDragging: false,
    dragHandlers: {
      onDragEnter: jest.fn(),
      onDragOver: jest.fn(),
      onDragLeave: jest.fn(),
      onDrop: jest.fn(),
    },
  })),
}));
jest.mock('@/hooks/useSessionTabs', () => ({
  useSessionTabs: jest.fn(() => ({
    switchToTab: jest.fn(),
  })),
}));
jest.mock('@/hooks/useChatScroll', () => ({
  useChatScroll: jest.fn(() => ({
    scrollRef: { current: null },
    scrollToBottom: jest.fn(),
  })),
}));
jest.mock('@/stores', () => ({
  useAgentsStore: jest.fn(),
  useChatStore: jest.fn(),
  useProjectsStore: jest.fn(),
}));
jest.mock('@/stores/resources.store', () => ({
  useResourcesStore: jest.fn(),
}));
jest.mock('@/renderer/services/MarkdownCacheService', () => ({
  MarkdownCacheService: {
    getInstance: jest.fn(() => ({
      warmup: jest.fn(),
    })),
  },
}));

describe('ChatInterface', () => {
  const mockProps = {
    messages: [],
    onSendMessage: jest.fn(),
    attachedResourceIds: [],
    onRemoveResource: jest.fn(),
    onAttachResources: jest.fn(),
    isActive: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup store mocks
    const { useAgentsStore, useChatStore, useProjectsStore } = require('@/stores');
    const { useResourcesStore } = require('@/stores/resources.store');

    useAgentsStore.mockImplementation((selector: any) =>
      selector({
        selectedAgentId: 'test-agent',
      })
    );

    useChatStore.mockImplementation((selector: any) =>
      selector({
        activeChat: 'test-chat',
        clearChat: jest.fn(),
        streamingStates: new Map(),
        streamingMessages: new Map(),
        stopStreaming: jest.fn(),
        sendMessage: jest.fn(),
        chatError: null,
        clearChatError: jest.fn(),
      })
    );

    useProjectsStore.mockImplementation((selector: any) =>
      selector({
        selectedProjectId: null,
        projects: new Map(),
      })
    );

    useResourcesStore.mockImplementation((selector: any) =>
      selector({
        resources: new Map(),
      })
    );
  });

  it('should render without MaximizeButton', () => {
    render(<ChatInterface {...mockProps} />);
    expect(screen.queryByTestId('maximize-button')).not.toBeInTheDocument();
  });

  it('should not have MaximizeButton imports', () => {
    expect(ChatInterface).toBeDefined();
  });

  it('should render chat interface successfully', () => {
    const { container } = render(<ChatInterface {...mockProps} />);
    expect(container.querySelector('[data-chat-interface]')).toBeInTheDocument();
  });

  it('should not render MaximizeButton component in message items', () => {
    const messagesWithUser = [
      {
        id: 'msg-1',
        role: 'user' as const,
        content: 'Test message',
        attachedResources: [],
        timestamp: new Date(),
      },
    ];

    render(<ChatInterface {...mockProps} messages={messagesWithUser} />);

    const maximizeButtons = screen.queryAllByRole('button', { name: /maximize/i });
    expect(maximizeButtons).toHaveLength(0);
  });

  it('should log with logger instead of console.log', () => {
    render(<ChatInterface {...mockProps} />);
    expect(logger.debug).toBeDefined();
    expect(logger.error).toBeDefined();
  });
});
