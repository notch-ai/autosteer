/**
 * useChatInputHandler Hook Unit Tests
 *
 * Comprehensive test coverage for chat input handler logic.
 * Tests command parsing, validation, submission, and built-in commands.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useChatInputHandler } from '@/hooks/useChatInputHandler';
import { useAgentsStore, useChatStore, useProjectsStore, useUIStore } from '@/stores';
import { COMPACT_PROMPT } from '@/commons/constants/compactPrompt';
import { todoActivityMonitor } from '@/renderer/services/TodoActivityMonitor';

// Mock stores
jest.mock('@/stores', () => ({
  useAgentsStore: jest.fn(),
  useChatStore: jest.fn(),
  useProjectsStore: jest.fn(),
  useUIStore: jest.fn(),
}));

// Mock todo activity monitor
jest.mock('@/renderer/services/TodoActivityMonitor', () => ({
  todoActivityMonitor: {
    clearWorktree: jest.fn(),
  },
}));

// Mock window.electron
const mockElectron = {
  ipcRenderer: {
    invoke: jest.fn(),
  },
};

// Properly set up window.electron for Jest/JSDOM
Object.defineProperty(window, 'electron', {
  writable: true,
  value: mockElectron,
});

describe('useChatInputHandler', () => {
  let mockOnSendMessage: jest.Mock;
  let mockClearChat: jest.Mock;
  let mockSetSelectedModel: jest.Mock;

  const mockAgentId = 'test-agent-id';
  const mockProjectId = 'test-project-id';

  beforeEach(() => {
    jest.clearAllMocks();

    mockOnSendMessage = jest.fn();
    mockClearChat = jest.fn();
    mockSetSelectedModel = jest.fn();

    // Setup store mocks
    (useAgentsStore as unknown as jest.Mock).mockImplementation((selector) => {
      const store = {
        selectedAgentId: mockAgentId,
        agents: new Map([
          [
            mockAgentId,
            {
              id: mockAgentId,
              name: 'Test Agent',
            },
          ],
        ]),
      };
      return selector ? selector(store) : store;
    });

    (useAgentsStore as any).getState = jest.fn(() => ({
      selectedAgentId: mockAgentId,
      agents: new Map([
        [
          mockAgentId,
          {
            id: mockAgentId,
            name: 'Test Agent',
          },
        ],
      ]),
    }));

    (useChatStore as unknown as jest.Mock).mockImplementation((selector) => {
      const store = {
        clearChat: mockClearChat,
      };
      return selector(store);
    });

    (useProjectsStore as any).getState = jest.fn(() => ({
      selectedProjectId: mockProjectId,
    }));

    (useUIStore as unknown as jest.Mock).mockImplementation((selector) => {
      const store = {
        selectedModel: 'claude-sonnet-4-20250514',
        setSelectedModel: mockSetSelectedModel,
      };
      return selector(store);
    });

    mockElectron.ipcRenderer.invoke.mockResolvedValue(undefined);
  });

  describe('Initial State', () => {
    it('should initialize with empty message', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      expect(result.current.message).toBe('');
      expect(result.current.isValid).toBe(false);
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should initialize with default permission mode', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      expect(result.current.permissionMode).toBe('acceptEdits');
    });

    it('should get model from UI store', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      expect(result.current.model).toBe('claude-sonnet-4-20250514');
    });
  });

  describe('handleCommandParse', () => {
    it('should detect slash commands', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      const parsed = result.current.handleCommandParse('/commit');

      expect(parsed.isCommand).toBe(true);
      expect(parsed.command).toBe('commit');
      expect(parsed.args).toBe('');
    });

    it('should parse command with arguments', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      const parsed = result.current.handleCommandParse('/commit Add new feature');

      expect(parsed.isCommand).toBe(true);
      expect(parsed.command).toBe('commit');
      expect(parsed.args).toBe('Add new feature');
    });

    it('should not detect regular text as command', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      const parsed = result.current.handleCommandParse('Hello world');

      expect(parsed.isCommand).toBe(false);
      expect(parsed.command).toBeUndefined();
    });

    it('should handle text with slash in middle', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      const parsed = result.current.handleCommandParse('path/to/file');

      expect(parsed.isCommand).toBe(false);
    });

    it('should trim whitespace before parsing', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      const parsed = result.current.handleCommandParse('  /clear  ');

      expect(parsed.isCommand).toBe(true);
      expect(parsed.command).toBe('clear');
    });
  });

  describe('Message Validation', () => {
    it('should validate non-empty message', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      act(() => {
        result.current.setMessage('Hello');
      });

      expect(result.current.isValid).toBe(true);
    });

    it('should invalidate empty message', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      act(() => {
        result.current.setMessage('');
      });

      expect(result.current.isValid).toBe(false);
    });

    it('should invalidate whitespace-only message', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      act(() => {
        result.current.setMessage('   ');
      });

      expect(result.current.isValid).toBe(false);
    });

    it('should extract plain text from HTML', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      act(() => {
        result.current.setMessage('<p>Hello</p>');
      });

      expect(result.current.isValid).toBe(true);
    });

    it('should invalidate HTML with only tags', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      act(() => {
        result.current.setMessage('<p></p>');
      });

      expect(result.current.isValid).toBe(false);
    });
  });

  describe('handleSubmit', () => {
    it('should submit valid message', async () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      act(() => {
        result.current.setMessage('Hello Claude');
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(mockOnSendMessage).toHaveBeenCalledWith('Hello Claude', {
        permissionMode: 'acceptEdits',
        model: 'claude-sonnet-4-20250514',
      });
      expect(result.current.message).toBe('');
    });

    it('should not submit when loading', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: true,
        })
      );

      act(() => {
        result.current.setMessage('Hello');
      });

      act(() => {
        result.current.handleSubmit();
      });

      expect(mockOnSendMessage).not.toHaveBeenCalled();
    });

    it('should not submit empty message', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      act(() => {
        result.current.handleSubmit();
      });

      expect(mockOnSendMessage).not.toHaveBeenCalled();
    });

    it('should extract plain text before submitting', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      act(() => {
        result.current.setMessage('<p>Hello <strong>Claude</strong></p>');
      });

      act(() => {
        result.current.handleSubmit();
      });

      expect(mockOnSendMessage).toHaveBeenCalled();
    });

    it('should handle submission errors', () => {
      mockOnSendMessage.mockImplementation(() => {
        throw new Error('Network error');
      });

      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      act(() => {
        result.current.setMessage('Hello');
      });

      act(() => {
        result.current.handleSubmit();
      });

      expect(result.current.error).toBe('Network error');
    });

    it('should clear message on successful submit', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      act(() => {
        result.current.setMessage('Test message');
      });

      act(() => {
        result.current.handleSubmit();
      });

      expect(result.current.message).toBe('');
    });
  });

  describe('Built-in Commands', () => {
    describe('/clear command', () => {
      it('should intercept /clear command', async () => {
        const { result } = renderHook(() =>
          useChatInputHandler({
            onSendMessage: mockOnSendMessage,
            isLoading: false,
          })
        );

        act(() => {
          result.current.setMessage('/clear');
        });

        await act(async () => {
          await result.current.handleSubmit();
        });

        // Wait for async operations to complete
        await waitFor(() => {
          expect(mockClearChat).toHaveBeenCalledWith(mockAgentId);
        });

        expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith(
          'claude-code:clear-session-for-entry',
          mockAgentId
        );
        expect(todoActivityMonitor.clearWorktree).toHaveBeenCalledWith(mockProjectId);
        expect(mockOnSendMessage).not.toHaveBeenCalled();
        expect(result.current.message).toBe('');
      });

      it('should handle /clear when no agent selected', async () => {
        (useAgentsStore as any).getState = jest.fn(() => ({
          selectedAgentId: null,
          agents: new Map(),
        }));

        const { result } = renderHook(() =>
          useChatInputHandler({
            onSendMessage: mockOnSendMessage,
            isLoading: false,
          })
        );

        act(() => {
          result.current.setMessage('/clear');
        });

        await act(async () => {
          result.current.handleSubmit();
        });

        expect(mockElectron.ipcRenderer.invoke).not.toHaveBeenCalled();
        expect(mockClearChat).not.toHaveBeenCalled();
      });

      it('should handle IPC errors gracefully', async () => {
        mockElectron.ipcRenderer.invoke.mockRejectedValue(new Error('IPC failed'));

        const { result } = renderHook(() =>
          useChatInputHandler({
            onSendMessage: mockOnSendMessage,
            isLoading: false,
          })
        );

        act(() => {
          result.current.setMessage('/clear');
        });

        await act(async () => {
          result.current.handleSubmit();
        });

        // Should still clear local state even if IPC fails
        expect(mockClearChat).toHaveBeenCalledWith(mockAgentId);
      });
    });

    describe('/compact command', () => {
      it('should intercept /compact command', async () => {
        const { result } = renderHook(() =>
          useChatInputHandler({
            onSendMessage: mockOnSendMessage,
            isLoading: false,
          })
        );

        act(() => {
          result.current.setMessage('/compact');
        });

        await act(async () => {
          result.current.handleSubmit();
        });

        expect(mockOnSendMessage).toHaveBeenCalledWith(COMPACT_PROMPT, {
          permissionMode: 'acceptEdits',
          model: 'claude-sonnet-4-20250514',
        });
        expect(result.current.message).toBe('');
      });

      it('should handle /compact when no agent selected', async () => {
        (useAgentsStore as any).getState = jest.fn(() => ({
          selectedAgentId: null,
          agents: new Map(),
        }));

        const { result } = renderHook(() =>
          useChatInputHandler({
            onSendMessage: mockOnSendMessage,
            isLoading: false,
          })
        );

        act(() => {
          result.current.setMessage('/compact');
        });

        await act(async () => {
          result.current.handleSubmit();
        });

        expect(mockOnSendMessage).not.toHaveBeenCalled();
      });

      it('should handle /compact with no agent in store', async () => {
        (useAgentsStore as any).getState = jest.fn(() => ({
          selectedAgentId: mockAgentId,
          agents: new Map(),
        }));

        const { result } = renderHook(() =>
          useChatInputHandler({
            onSendMessage: mockOnSendMessage,
            isLoading: false,
          })
        );

        act(() => {
          result.current.setMessage('/compact');
        });

        await act(async () => {
          result.current.handleSubmit();
        });

        expect(mockOnSendMessage).not.toHaveBeenCalled();
      });
    });
  });

  describe('handleSlashCommand', () => {
    it('should send slash command as message', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      act(() => {
        result.current.handleSlashCommand('/commit Add feature');
      });

      expect(mockOnSendMessage).toHaveBeenCalledWith('/commit Add feature', {
        permissionMode: 'acceptEdits',
        model: 'claude-sonnet-4-20250514',
      });
    });

    it('should not send empty slash command', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      act(() => {
        result.current.handleSlashCommand('');
      });

      expect(mockOnSendMessage).not.toHaveBeenCalled();
    });

    it('should not send whitespace-only command', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      act(() => {
        result.current.handleSlashCommand('   ');
      });

      expect(mockOnSendMessage).not.toHaveBeenCalled();
    });

    it('should clear message after sending', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      act(() => {
        result.current.setMessage('test');
        result.current.handleSlashCommand('/commit');
      });

      expect(result.current.message).toBe('');
    });
  });

  describe('Permission Mode', () => {
    it('should update permission mode', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      act(() => {
        result.current.setPermissionMode('plan');
      });

      expect(result.current.permissionMode).toBe('plan');
    });

    it('should use permission mode in submission', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      act(() => {
        result.current.setPermissionMode('bypassPermissions');
        result.current.setMessage('Test');
      });

      act(() => {
        result.current.handleSubmit();
      });

      expect(mockOnSendMessage).toHaveBeenCalledWith('Test', {
        permissionMode: 'bypassPermissions',
        model: 'claude-sonnet-4-20250514',
      });
    });
  });

  describe('Model Selection', () => {
    it('should update model', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      act(() => {
        result.current.setModel('claude-opus-4-20250514');
      });

      expect(mockSetSelectedModel).toHaveBeenCalledWith('claude-opus-4-20250514');
    });

    it('should use selected model in submission', () => {
      (useUIStore as unknown as jest.Mock).mockImplementation((selector) => {
        const store = {
          selectedModel: 'claude-opus-4-20250514',
          setSelectedModel: mockSetSelectedModel,
        };
        return selector(store);
      });

      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      act(() => {
        result.current.setMessage('Test');
      });

      act(() => {
        result.current.handleSubmit();
      });

      expect(mockOnSendMessage).toHaveBeenCalledWith('Test', {
        permissionMode: 'acceptEdits',
        model: 'claude-opus-4-20250514',
      });
    });
  });

  describe('Error Handling', () => {
    it('should set error on submission failure', () => {
      mockOnSendMessage.mockImplementation(() => {
        throw new Error('API error');
      });

      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      act(() => {
        result.current.setMessage('Test');
      });

      act(() => {
        result.current.handleSubmit();
      });

      expect(result.current.error).toBe('API error');
      expect(result.current.isSubmitting).toBe(false);
    });

    it('should clear error on successful submit', async () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      // First submit with error
      mockOnSendMessage.mockImplementationOnce(() => {
        throw new Error('Error');
      });

      await act(async () => {
        result.current.setMessage('Test');
        await result.current.handleSubmit();
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Error');
      });

      // Second submit should clear error
      mockOnSendMessage.mockImplementation(() => {});

      await act(async () => {
        result.current.setMessage('Test again');
        await result.current.handleSubmit();
      });

      expect(result.current.error).toBeNull();
    });

    it('should handle non-Error exceptions', () => {
      mockOnSendMessage.mockImplementation(() => {
        throw 'String error';
      });

      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      act(() => {
        result.current.setMessage('Test');
      });

      act(() => {
        result.current.handleSubmit();
      });

      expect(result.current.error).toBe('Failed to send message');
    });
  });

  describe('Edge Cases', () => {
    it('should handle HTML with nested tags', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      act(() => {
        result.current.setMessage('<div><p>Hello <span>world</span></p></div>');
      });

      expect(result.current.isValid).toBe(true);
    });

    it('should handle special characters in message', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      act(() => {
        result.current.setMessage('Test &lt;script&gt;');
      });

      act(() => {
        result.current.handleSubmit();
      });

      expect(mockOnSendMessage).toHaveBeenCalled();
    });

    it('should handle very long messages', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      const longMessage = 'a'.repeat(10000);

      act(() => {
        result.current.setMessage(longMessage);
      });

      expect(result.current.isValid).toBe(true);
    });

    it('should handle unicode characters', () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      act(() => {
        result.current.setMessage('Hello 世界 🌍');
      });

      act(() => {
        result.current.handleSubmit();
      });

      expect(mockOnSendMessage).toHaveBeenCalledWith('Hello 世界 🌍', expect.any(Object));
    });

    it('should handle rapid submit calls', async () => {
      const { result } = renderHook(() =>
        useChatInputHandler({
          onSendMessage: mockOnSendMessage,
          isLoading: false,
        })
      );

      await act(async () => {
        result.current.setMessage('Test');
        await result.current.handleSubmit();
      });

      // Message should be cleared after first submit
      await waitFor(() => {
        expect(result.current.message).toBe('');
      });

      await act(async () => {
        await result.current.handleSubmit();
        await result.current.handleSubmit();
      });

      // Should only send once since message is empty after first submit
      expect(mockOnSendMessage).toHaveBeenCalledTimes(1);
    });
  });
});
