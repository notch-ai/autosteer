/**
 * Unit Tests for usePermissionHandling Hook
 *
 * Tests permission request flow logic with approve/reject operations.
 * Follows TDD approach with comprehensive coverage.
 *
 * Test Coverage:
 * - Hook initialization
 * - Permission dialog state management
 * - Permission approval flow with action message creation
 * - Permission rejection flow with action message creation
 * - Store state updates
 * - Error handling
 * - Callback stability
 *
 * Target Coverage: 80%+
 */

import { renderHook, act } from '@testing-library/react';
import { usePermissionHandling } from '@/hooks/usePermissionHandling';
import { logger } from '@/commons/utils/logger';
import { useChatStore } from '@/stores';

// Mock logger
jest.mock('@/commons/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock chat store
jest.mock('@/stores', () => ({
  useChatStore: {
    getState: jest.fn(),
    setState: jest.fn(),
  },
}));

describe('usePermissionHandling', () => {
  const mockSendMessage = jest.fn();
  const mockActiveChat = 'chat-123';
  const mockPermissionRequest = {
    tool_name: 'Edit',
    tool_use_id: 'tool-use-123',
    file_path: '/path/to/file.ts',
    old_string: 'old content',
    new_string: 'new content',
    message: 'Permission requested for file edit',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock store state
    (useChatStore.getState as jest.Mock).mockReturnValue({
      messages: new Map(),
      streamingMessages: new Map(),
    });

    (useChatStore.setState as jest.Mock).mockImplementation((updater) => {
      const state = {
        messages: new Map(),
        streamingMessages: new Map(),
      };
      updater(state);
      return state;
    });
  });

  describe('Hook Initialization', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() =>
        usePermissionHandling({
          activeChat: mockActiveChat,
          currentPermissionRequest: mockPermissionRequest,
          sendMessage: mockSendMessage,
        })
      );

      expect(result.current.showPermissionDialog).toBe(false);
      expect(result.current.setShowPermissionDialog).toBeDefined();
      expect(result.current.handlePermissionApprove).toBeDefined();
      expect(result.current.handlePermissionReject).toBeDefined();
    });
  });

  describe('Permission Dialog State', () => {
    it('should toggle permission dialog state', () => {
      const { result } = renderHook(() =>
        usePermissionHandling({
          activeChat: mockActiveChat,
          currentPermissionRequest: mockPermissionRequest,
          sendMessage: mockSendMessage,
        })
      );

      expect(result.current.showPermissionDialog).toBe(false);

      act(() => {
        result.current.setShowPermissionDialog(true);
      });

      expect(result.current.showPermissionDialog).toBe(true);

      act(() => {
        result.current.setShowPermissionDialog(false);
      });

      expect(result.current.showPermissionDialog).toBe(false);
    });
  });

  describe('Permission Approval', () => {
    it('should handle permission approval successfully', async () => {
      mockSendMessage.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        usePermissionHandling({
          activeChat: mockActiveChat,
          currentPermissionRequest: mockPermissionRequest,
          sendMessage: mockSendMessage,
        })
      );

      act(() => {
        result.current.setShowPermissionDialog(true);
      });

      await act(async () => {
        await result.current.handlePermissionApprove();
      });

      expect(result.current.showPermissionDialog).toBe(false);

      expect(useChatStore.setState).toHaveBeenCalled();
      expect(mockSendMessage).toHaveBeenCalledWith(
        'Continue with the approved changes.',
        undefined,
        [],
        { permissionMode: 'bypassPermissions' }
      );

      expect(logger.debug).toHaveBeenCalledWith(
        '[usePermissionHandling] Permission approved',
        expect.any(Object)
      );
    });

    it('should create permission action message on approval', async () => {
      mockSendMessage.mockResolvedValue(undefined);
      let capturedState: any;

      (useChatStore.setState as jest.Mock).mockImplementation((updater) => {
        const state = {
          messages: new Map([[mockActiveChat, []]]),
          streamingMessages: new Map(),
        };
        updater(state);
        capturedState = state;
        return state;
      });

      const { result } = renderHook(() =>
        usePermissionHandling({
          activeChat: mockActiveChat,
          currentPermissionRequest: mockPermissionRequest,
          sendMessage: mockSendMessage,
        })
      );

      await act(async () => {
        await result.current.handlePermissionApprove();
      });

      expect(capturedState).toBeDefined();
      expect(capturedState.messages.get(mockActiveChat)).toHaveLength(1);

      const actionMessage = capturedState.messages.get(mockActiveChat)[0];
      expect(actionMessage.role).toBe('assistant');
      expect(actionMessage.permissionAction).toBeDefined();
      expect(actionMessage.permissionAction.type).toBe('accepted');
      expect(actionMessage.permissionAction.file_path).toBe('/path/to/file.ts');
      expect(actionMessage.permissionAction.old_string).toBe('old content');
      expect(actionMessage.permissionAction.new_string).toBe('new content');
    });

    it('should clear streaming messages on approval', async () => {
      mockSendMessage.mockResolvedValue(undefined);
      let capturedState: any;

      (useChatStore.setState as jest.Mock).mockImplementation((updater) => {
        const state = {
          messages: new Map([[mockActiveChat, []]]),
          streamingMessages: new Map([[mockActiveChat, { content: 'streaming' }]]),
        };
        updater(state);
        capturedState = state;
        return state;
      });

      const { result } = renderHook(() =>
        usePermissionHandling({
          activeChat: mockActiveChat,
          currentPermissionRequest: mockPermissionRequest,
          sendMessage: mockSendMessage,
        })
      );

      await act(async () => {
        await result.current.handlePermissionApprove();
      });

      expect(capturedState.streamingMessages.has(mockActiveChat)).toBe(false);
    });

    it('should handle approval with content instead of strings', async () => {
      mockSendMessage.mockResolvedValue(undefined);
      let capturedState: any;

      const contentPermission = {
        tool_name: 'Write',
        tool_use_id: 'tool-use-456',
        file_path: '/path/to/new-file.ts',
        content: 'new file content',
        message: 'Permission requested for file write',
      };

      (useChatStore.setState as jest.Mock).mockImplementation((updater) => {
        const state = {
          messages: new Map([[mockActiveChat, []]]),
          streamingMessages: new Map(),
        };
        updater(state);
        capturedState = state;
        return state;
      });

      const { result } = renderHook(() =>
        usePermissionHandling({
          activeChat: mockActiveChat,
          currentPermissionRequest: contentPermission,
          sendMessage: mockSendMessage,
        })
      );

      await act(async () => {
        await result.current.handlePermissionApprove();
      });

      const actionMessage = capturedState.messages.get(mockActiveChat)[0];
      expect(actionMessage.permissionAction.content).toBe('new file content');
      expect(actionMessage.permissionAction.old_string).toBeUndefined();
      expect(actionMessage.permissionAction.new_string).toBeUndefined();
    });

    it('should handle approval errors gracefully', async () => {
      const testError = new Error('Send message failed');
      mockSendMessage.mockRejectedValue(testError);

      const { result } = renderHook(() =>
        usePermissionHandling({
          activeChat: mockActiveChat,
          currentPermissionRequest: mockPermissionRequest,
          sendMessage: mockSendMessage,
        })
      );

      await expect(
        act(async () => {
          await result.current.handlePermissionApprove();
        })
      ).rejects.toThrow('Send message failed');

      expect(logger.error).toHaveBeenCalledWith(
        '[usePermissionHandling] Failed to handle permission approval',
        expect.objectContaining({
          chatId: mockActiveChat,
          error: 'Send message failed',
        })
      );
    });

    it('should do nothing when no active chat', async () => {
      const { result } = renderHook(() =>
        usePermissionHandling({
          activeChat: null,
          currentPermissionRequest: mockPermissionRequest,
          sendMessage: mockSendMessage,
        })
      );

      await act(async () => {
        await result.current.handlePermissionApprove();
      });

      expect(useChatStore.setState).not.toHaveBeenCalled();
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('should do nothing when no permission request', async () => {
      const { result } = renderHook(() =>
        usePermissionHandling({
          activeChat: mockActiveChat,
          currentPermissionRequest: null,
          sendMessage: mockSendMessage,
        })
      );

      await act(async () => {
        await result.current.handlePermissionApprove();
      });

      expect(useChatStore.setState).not.toHaveBeenCalled();
      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Permission Rejection', () => {
    it('should handle permission rejection successfully', () => {
      const { result } = renderHook(() =>
        usePermissionHandling({
          activeChat: mockActiveChat,
          currentPermissionRequest: mockPermissionRequest,
          sendMessage: mockSendMessage,
        })
      );

      act(() => {
        result.current.setShowPermissionDialog(true);
      });

      act(() => {
        result.current.handlePermissionReject();
      });

      expect(result.current.showPermissionDialog).toBe(false);
      expect(useChatStore.setState).toHaveBeenCalled();

      expect(logger.debug).toHaveBeenCalledWith(
        '[usePermissionHandling] Permission rejected',
        expect.any(Object)
      );
    });

    it('should create permission action message on rejection', () => {
      let capturedState: any;

      (useChatStore.setState as jest.Mock).mockImplementation((updater) => {
        const state = {
          messages: new Map([[mockActiveChat, []]]),
          streamingMessages: new Map(),
        };
        updater(state);
        capturedState = state;
        return state;
      });

      const { result } = renderHook(() =>
        usePermissionHandling({
          activeChat: mockActiveChat,
          currentPermissionRequest: mockPermissionRequest,
          sendMessage: mockSendMessage,
        })
      );

      act(() => {
        result.current.handlePermissionReject();
      });

      expect(capturedState).toBeDefined();
      expect(capturedState.messages.get(mockActiveChat)).toHaveLength(1);

      const actionMessage = capturedState.messages.get(mockActiveChat)[0];
      expect(actionMessage.role).toBe('assistant');
      expect(actionMessage.permissionAction).toBeDefined();
      expect(actionMessage.permissionAction.type).toBe('rejected');
      expect(actionMessage.permissionAction.file_path).toBe('/path/to/file.ts');
    });

    it('should clear streaming messages on rejection', () => {
      let capturedState: any;

      (useChatStore.setState as jest.Mock).mockImplementation((updater) => {
        const state = {
          messages: new Map([[mockActiveChat, []]]),
          streamingMessages: new Map([[mockActiveChat, { content: 'streaming' }]]),
        };
        updater(state);
        capturedState = state;
        return state;
      });

      const { result } = renderHook(() =>
        usePermissionHandling({
          activeChat: mockActiveChat,
          currentPermissionRequest: mockPermissionRequest,
          sendMessage: mockSendMessage,
        })
      );

      act(() => {
        result.current.handlePermissionReject();
      });

      expect(capturedState.streamingMessages.has(mockActiveChat)).toBe(false);
    });

    it('should handle rejection errors gracefully', () => {
      (useChatStore.setState as jest.Mock).mockImplementation(() => {
        throw new Error('Store update failed');
      });

      const { result } = renderHook(() =>
        usePermissionHandling({
          activeChat: mockActiveChat,
          currentPermissionRequest: mockPermissionRequest,
          sendMessage: mockSendMessage,
        })
      );

      expect(() => {
        act(() => {
          result.current.handlePermissionReject();
        });
      }).toThrow('Store update failed');

      expect(logger.error).toHaveBeenCalledWith(
        '[usePermissionHandling] Failed to handle permission rejection',
        expect.objectContaining({
          chatId: mockActiveChat,
          error: 'Store update failed',
        })
      );
    });

    it('should do nothing when no active chat', () => {
      const { result } = renderHook(() =>
        usePermissionHandling({
          activeChat: null,
          currentPermissionRequest: mockPermissionRequest,
          sendMessage: mockSendMessage,
        })
      );

      act(() => {
        result.current.handlePermissionReject();
      });

      expect(useChatStore.setState).not.toHaveBeenCalled();
    });

    it('should do nothing when no permission request', () => {
      const { result } = renderHook(() =>
        usePermissionHandling({
          activeChat: mockActiveChat,
          currentPermissionRequest: null,
          sendMessage: mockSendMessage,
        })
      );

      act(() => {
        result.current.handlePermissionReject();
      });

      expect(useChatStore.setState).not.toHaveBeenCalled();
    });
  });

  describe('Callback Stability', () => {
    it('should maintain stable callback references', () => {
      const { result, rerender } = renderHook(() =>
        usePermissionHandling({
          activeChat: mockActiveChat,
          currentPermissionRequest: mockPermissionRequest,
          sendMessage: mockSendMessage,
        })
      );

      const initialApprove = result.current.handlePermissionApprove;
      const initialReject = result.current.handlePermissionReject;

      rerender();

      expect(result.current.handlePermissionApprove).toBe(initialApprove);
      expect(result.current.handlePermissionReject).toBe(initialReject);
    });
  });
});
