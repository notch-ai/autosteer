import { useCallback, useState } from 'react';
import { logger } from '@/commons/utils/logger';
import { Agent } from '@/entities';

/**
 * useContentEditor - Content editing state and operations
 *
 * Encapsulates content editing logic for agent content fields with
 * keyboard shortcuts, error handling, and automatic state reversion.
 *
 * Key Features:
 * - Content editing state management (edit mode, content)
 * - Save/Cancel operations with error handling
 * - Keyboard shortcuts (Esc to cancel, Ctrl+Enter to save)
 * - Automatic content reversion on error
 * - Structured logging with context
 *
 * Performance:
 * - Memoized callbacks with useCallback
 * - Minimal re-renders (only content state changes)
 * - Optimistic UI updates with rollback
 *
 * Usage:
 * ```tsx
 * const { isEditingContent, editedContent, ...handlers } = useContentEditor({
 *   selectedAgent: agent,
 *   updateAgent: updateAgentCallback
 * });
 *
 * // Enable edit mode
 * <Button onClick={handlers.handleContentClick}>Edit</Button>
 *
 * // Edit form
 * {isEditingContent && (
 *   <Textarea
 *     value={editedContent}
 *     onChange={handlers.handleContentChange}
 *     onKeyDown={handlers.handleContentKeyDown}
 *   />
 * )}
 * ```
 *
 * @see docs/guides-architecture.md - Handler Pattern Guidelines
 */

/**
 * Hook parameters
 */
interface UseContentEditorParams {
  /** Currently selected agent (null if none selected) */
  selectedAgent: Agent | null;
  /** Callback to update agent in store */
  updateAgent: (id: string, updates: Partial<Agent>) => Promise<void>;
}

/**
 * Hook return value
 */
interface UseContentEditorReturn {
  /** Whether content is currently being edited */
  isEditingContent: boolean;
  /** Current edited content value */
  editedContent: string;
  /** Set edited content directly (for controlled components) */
  setEditedContent: (content: string) => void;
  /** Enable edit mode and load content */
  handleContentClick: () => void;
  /** Handle content change in textarea */
  handleContentChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  /** Save content changes */
  handleContentSave: () => Promise<void>;
  /** Cancel editing and revert changes */
  handleContentCancel: () => void;
  /** Handle keyboard shortcuts (Esc, Ctrl+Enter) */
  handleContentKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

/**
 * Create content editor hook instance
 */
export const useContentEditor = ({
  selectedAgent,
  updateAgent,
}: UseContentEditorParams): UseContentEditorReturn => {
  // ==================== STATE ====================

  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editedContent, setEditedContent] = useState('');

  // ==================== OPERATIONS ====================

  /**
   * Enable edit mode and load current content
   * Called when user clicks to start editing
   */
  const handleContentClick = useCallback(() => {
    if (!selectedAgent) {
      logger.warn('[useContentEditor] Cannot edit - no agent selected');
      return;
    }

    setEditedContent(selectedAgent.content);
    setIsEditingContent(true);

    logger.debug('[useContentEditor] Edit mode enabled', {
      agentId: selectedAgent.id,
      contentLength: selectedAgent.content.length,
    });
  }, [selectedAgent]);

  /**
   * Handle content change in textarea
   * Updates local state only (not persisted until save)
   */
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedContent(e.target.value);
  }, []);

  /**
   * Save content changes to agent
   * Includes error handling with automatic reversion
   */
  const handleContentSave = useCallback(async () => {
    if (!selectedAgent) {
      logger.warn('[useContentEditor] Cannot save - no agent selected');
      return;
    }

    try {
      logger.debug('[useContentEditor] Saving content changes', {
        agentId: selectedAgent.id,
        originalLength: selectedAgent.content.length,
        newLength: editedContent.length,
      });

      await updateAgent(selectedAgent.id, { content: editedContent });

      setIsEditingContent(false);

      logger.debug('[useContentEditor] Content saved successfully', {
        agentId: selectedAgent.id,
      });
    } catch (error) {
      logger.error('[useContentEditor] Failed to save content', {
        agentId: selectedAgent.id,
        error: String(error),
      });

      // Revert to original content on error
      setEditedContent(selectedAgent.content);
      setIsEditingContent(false);
    }
  }, [selectedAgent, editedContent, updateAgent]);

  /**
   * Cancel editing and revert changes
   * Restores original content from selected agent
   */
  const handleContentCancel = useCallback(() => {
    if (!selectedAgent) {
      logger.warn('[useContentEditor] Cannot cancel - no agent selected');
      return;
    }

    setEditedContent(selectedAgent.content);
    setIsEditingContent(false);

    logger.debug('[useContentEditor] Edit mode cancelled', {
      agentId: selectedAgent.id,
    });
  }, [selectedAgent]);

  /**
   * Handle keyboard shortcuts
   * - Escape: Cancel editing
   * - Ctrl+Enter: Save changes
   */
  const handleContentKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleContentCancel();
      } else if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        void handleContentSave();
      }
    },
    [handleContentCancel, handleContentSave]
  );

  // ==================== RETURN ====================

  return {
    isEditingContent,
    editedContent,
    setEditedContent,
    handleContentClick,
    handleContentChange,
    handleContentSave,
    handleContentCancel,
    handleContentKeyDown,
  };
};
