/**
 * Unit Tests for useContentEditor Hook
 *
 * Tests content editing state and operations with keyboard shortcuts.
 * Follows TDD approach with comprehensive coverage.
 *
 * Test Coverage:
 * - Hook initialization
 * - Edit mode enable/disable
 * - Content change handling
 * - Save operation with success/error
 * - Cancel operation
 * - Keyboard shortcuts (Esc, Ctrl+Enter)
 * - Error handling with rollback
 * - Callback stability
 *
 * Target Coverage: 80%+
 */

import { renderHook, act } from '@testing-library/react';
import { useContentEditor } from '@/hooks/useContentEditor';
import { logger } from '@/commons/utils/logger';
import { Agent, AgentStatus, AgentType } from '@/entities';

// Mock logger
jest.mock('@/commons/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('useContentEditor', () => {
  const mockAgent: Agent = {
    id: 'agent-123',
    title: 'Test Agent',
    content: 'Original content for the agent',
    preview: 'Test preview',
    type: AgentType.TEXT,
    status: AgentStatus.DRAFT,
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: [],
    resourceIds: [],
  };

  const mockUpdateAgent = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() =>
        useContentEditor({
          selectedAgent: mockAgent,
          updateAgent: mockUpdateAgent,
        })
      );

      expect(result.current.isEditingContent).toBe(false);
      expect(result.current.editedContent).toBe('');
      expect(result.current.setEditedContent).toBeDefined();
      expect(result.current.handleContentClick).toBeDefined();
      expect(result.current.handleContentChange).toBeDefined();
      expect(result.current.handleContentSave).toBeDefined();
      expect(result.current.handleContentCancel).toBeDefined();
      expect(result.current.handleContentKeyDown).toBeDefined();
    });
  });

  describe('Enable Edit Mode', () => {
    it('should enable edit mode and load content', () => {
      const { result } = renderHook(() =>
        useContentEditor({
          selectedAgent: mockAgent,
          updateAgent: mockUpdateAgent,
        })
      );

      act(() => {
        result.current.handleContentClick();
      });

      expect(result.current.isEditingContent).toBe(true);
      expect(result.current.editedContent).toBe('Original content for the agent');

      expect(logger.debug).toHaveBeenCalledWith(
        '[useContentEditor] Edit mode enabled',
        expect.objectContaining({
          agentId: 'agent-123',
          contentLength: mockAgent.content.length,
        })
      );
    });

    it('should warn when no agent is selected', () => {
      const { result } = renderHook(() =>
        useContentEditor({
          selectedAgent: null,
          updateAgent: mockUpdateAgent,
        })
      );

      act(() => {
        result.current.handleContentClick();
      });

      expect(result.current.isEditingContent).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        '[useContentEditor] Cannot edit - no agent selected'
      );
    });
  });

  describe('Content Change Handling', () => {
    it('should update edited content on change', () => {
      const { result } = renderHook(() =>
        useContentEditor({
          selectedAgent: mockAgent,
          updateAgent: mockUpdateAgent,
        })
      );

      act(() => {
        result.current.handleContentClick();
      });

      const mockEvent = {
        target: { value: 'Updated content' },
      } as React.ChangeEvent<HTMLTextAreaElement>;

      act(() => {
        result.current.handleContentChange(mockEvent);
      });

      expect(result.current.editedContent).toBe('Updated content');
    });

    it('should allow direct content setting', () => {
      const { result } = renderHook(() =>
        useContentEditor({
          selectedAgent: mockAgent,
          updateAgent: mockUpdateAgent,
        })
      );

      act(() => {
        result.current.setEditedContent('Directly set content');
      });

      expect(result.current.editedContent).toBe('Directly set content');
    });
  });

  describe('Save Operation', () => {
    it('should save content successfully', async () => {
      mockUpdateAgent.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useContentEditor({
          selectedAgent: mockAgent,
          updateAgent: mockUpdateAgent,
        })
      );

      act(() => {
        result.current.handleContentClick();
      });

      act(() => {
        result.current.setEditedContent('Updated content');
      });

      await act(async () => {
        await result.current.handleContentSave();
      });

      expect(mockUpdateAgent).toHaveBeenCalledWith('agent-123', {
        content: 'Updated content',
      });

      expect(result.current.isEditingContent).toBe(false);

      expect(logger.debug).toHaveBeenCalledWith(
        '[useContentEditor] Content saved successfully',
        expect.objectContaining({ agentId: 'agent-123' })
      );
    });

    it('should handle save errors and revert content', async () => {
      const testError = new Error('Update failed');
      mockUpdateAgent.mockRejectedValue(testError);

      const { result } = renderHook(() =>
        useContentEditor({
          selectedAgent: mockAgent,
          updateAgent: mockUpdateAgent,
        })
      );

      act(() => {
        result.current.handleContentClick();
      });

      const originalContent = result.current.editedContent;

      act(() => {
        result.current.setEditedContent('Updated content');
      });

      await act(async () => {
        await result.current.handleContentSave();
      });

      expect(logger.error).toHaveBeenCalledWith(
        '[useContentEditor] Failed to save content',
        expect.objectContaining({
          agentId: 'agent-123',
          error: 'Error: Update failed',
        })
      );

      // Should revert to original content
      expect(result.current.editedContent).toBe(originalContent);
      expect(result.current.isEditingContent).toBe(false);
    });

    it('should warn when saving without selected agent', async () => {
      const { result } = renderHook(() =>
        useContentEditor({
          selectedAgent: null,
          updateAgent: mockUpdateAgent,
        })
      );

      await act(async () => {
        await result.current.handleContentSave();
      });

      expect(logger.warn).toHaveBeenCalledWith(
        '[useContentEditor] Cannot save - no agent selected'
      );
      expect(mockUpdateAgent).not.toHaveBeenCalled();
    });
  });

  describe('Cancel Operation', () => {
    it('should cancel editing and revert content', () => {
      const { result } = renderHook(() =>
        useContentEditor({
          selectedAgent: mockAgent,
          updateAgent: mockUpdateAgent,
        })
      );

      act(() => {
        result.current.handleContentClick();
      });

      act(() => {
        result.current.setEditedContent('Modified content');
      });

      expect(result.current.editedContent).toBe('Modified content');

      act(() => {
        result.current.handleContentCancel();
      });

      expect(result.current.isEditingContent).toBe(false);
      expect(result.current.editedContent).toBe('Original content for the agent');

      expect(logger.debug).toHaveBeenCalledWith(
        '[useContentEditor] Edit mode cancelled',
        expect.objectContaining({ agentId: 'agent-123' })
      );
    });

    it('should warn when cancelling without selected agent', () => {
      const { result } = renderHook(() =>
        useContentEditor({
          selectedAgent: null,
          updateAgent: mockUpdateAgent,
        })
      );

      act(() => {
        result.current.handleContentCancel();
      });

      expect(logger.warn).toHaveBeenCalledWith(
        '[useContentEditor] Cannot cancel - no agent selected'
      );
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should cancel on Escape key', () => {
      const { result } = renderHook(() =>
        useContentEditor({
          selectedAgent: mockAgent,
          updateAgent: mockUpdateAgent,
        })
      );

      act(() => {
        result.current.handleContentClick();
      });

      act(() => {
        result.current.setEditedContent('Modified content');
      });

      const escapeEvent = {
        key: 'Escape',
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      act(() => {
        result.current.handleContentKeyDown(escapeEvent);
      });

      expect(escapeEvent.preventDefault).toHaveBeenCalled();
      expect(result.current.isEditingContent).toBe(false);
    });

    it('should save on Ctrl+Enter', async () => {
      mockUpdateAgent.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useContentEditor({
          selectedAgent: mockAgent,
          updateAgent: mockUpdateAgent,
        })
      );

      act(() => {
        result.current.handleContentClick();
      });

      act(() => {
        result.current.setEditedContent('Updated content');
      });

      const ctrlEnterEvent = {
        key: 'Enter',
        ctrlKey: true,
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      await act(async () => {
        result.current.handleContentKeyDown(ctrlEnterEvent);
      });

      expect(ctrlEnterEvent.preventDefault).toHaveBeenCalled();
      expect(mockUpdateAgent).toHaveBeenCalledWith('agent-123', {
        content: 'Updated content',
      });
    });

    it('should not trigger on Enter without Ctrl', () => {
      const { result } = renderHook(() =>
        useContentEditor({
          selectedAgent: mockAgent,
          updateAgent: mockUpdateAgent,
        })
      );

      act(() => {
        result.current.handleContentClick();
      });

      const enterEvent = {
        key: 'Enter',
        ctrlKey: false,
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      act(() => {
        result.current.handleContentKeyDown(enterEvent);
      });

      expect(enterEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockUpdateAgent).not.toHaveBeenCalled();
    });

    it('should not trigger on other keys', () => {
      const { result } = renderHook(() =>
        useContentEditor({
          selectedAgent: mockAgent,
          updateAgent: mockUpdateAgent,
        })
      );

      act(() => {
        result.current.handleContentClick();
      });

      const otherEvent = {
        key: 'a',
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      act(() => {
        result.current.handleContentKeyDown(otherEvent);
      });

      expect(otherEvent.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('Agent Changes', () => {
    it('should update content when agent changes', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useContentEditor({ selectedAgent: agent, updateAgent: mockUpdateAgent }),
        { initialProps: { agent: mockAgent } }
      );

      act(() => {
        result.current.handleContentClick();
      });

      expect(result.current.editedContent).toBe('Original content for the agent');

      // Change agent
      const newAgent: Agent = {
        ...mockAgent,
        id: 'agent-456',
        content: 'New agent content',
      };

      rerender({ agent: newAgent });

      act(() => {
        result.current.handleContentClick();
      });

      expect(result.current.editedContent).toBe('New agent content');
    });
  });

  describe('Callback Stability', () => {
    it('should maintain stable callback references', () => {
      const { result, rerender } = renderHook(() =>
        useContentEditor({
          selectedAgent: mockAgent,
          updateAgent: mockUpdateAgent,
        })
      );

      const initialClick = result.current.handleContentClick;
      const initialChange = result.current.handleContentChange;
      const initialCancel = result.current.handleContentCancel;

      rerender();

      expect(result.current.handleContentClick).toBe(initialClick);
      expect(result.current.handleContentChange).toBe(initialChange);
      expect(result.current.handleContentCancel).toBe(initialCancel);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      const emptyAgent: Agent = {
        ...mockAgent,
        content: '',
      };

      const { result } = renderHook(() =>
        useContentEditor({
          selectedAgent: emptyAgent,
          updateAgent: mockUpdateAgent,
        })
      );

      act(() => {
        result.current.handleContentClick();
      });

      expect(result.current.editedContent).toBe('');
      expect(result.current.isEditingContent).toBe(true);
    });

    it('should handle very long content', () => {
      const longContent = 'x'.repeat(100000);
      const longAgent: Agent = {
        ...mockAgent,
        content: longContent,
      };

      const { result } = renderHook(() =>
        useContentEditor({
          selectedAgent: longAgent,
          updateAgent: mockUpdateAgent,
        })
      );

      act(() => {
        result.current.handleContentClick();
      });

      expect(result.current.editedContent).toBe(longContent);
      expect(result.current.editedContent.length).toBe(100000);
    });
  });
});
