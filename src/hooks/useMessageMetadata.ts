import { useCallback, useState } from 'react';
import { logger } from '@/commons/utils/logger';

/**
 * Metadata tab types for message expansion
 */
export type MetadataTab = 'tools' | 'tokens' | 'todos';

/**
 * Parameters for the message metadata hook
 */
export interface UseMessageMetadataParams {
  /** Callback to scroll to bottom when metadata is toggled */
  onScrollToBottom?: () => void;
}

/**
 * Return type for the message metadata hook
 */
export interface UseMessageMetadataReturn {
  /** Active metadata tab per message ID */
  activeMetadataTab: Map<string, MetadataTab | null>;
  /** Set active metadata tab for a message */
  setActiveMetadataTab: (messageId: string, tab: MetadataTab | null) => void;
  /** Toggle metadata tab for a message */
  handleMetadataToggle: (messageId: string, tab: MetadataTab, isLastMessage?: boolean) => void;
}

/**
 * useMessageMetadata Hook
 *
 * Manages metadata tab state (tools/tokens/todos) for each message in the chat.
 *
 * Key Features:
 * - Per-message metadata tab state (Map<messageId, activeTab>)
 * - Toggle behavior (clicking same tab closes it)
 * - Auto-scroll to bottom for last message when opening tabs
 * - Comprehensive logging for debugging
 * - Stable callback references with useCallback
 *
 * Architecture:
 * - React hook pattern
 * - Map-based state for O(1) lookup per message
 * - Coordinates with ChatInterface scroll behavior
 * - Supports multiple messages with independent tab states
 *
 * Usage:
 * ```tsx
 * const {
 *   activeMetadataTab,
 *   setActiveMetadataTab,
 *   handleMetadataToggle
 * } = useMessageMetadata({
 *   onScrollToBottom: scrollToBottomCallback
 * });
 *
 * // Check if a tab is active for a message
 * const isToolsActive = activeMetadataTab.get(messageId) === 'tools';
 *
 * // Toggle tab for a message
 * handleMetadataToggle(messageId, 'tools', true);
 *
 * // Directly set tab state
 * setActiveMetadataTab(messageId, 'tokens');
 * ```
 *
 * @param params - Configuration parameters
 * @returns Message metadata operations and state
 */
export const useMessageMetadata = ({
  onScrollToBottom,
}: UseMessageMetadataParams = {}): UseMessageMetadataReturn => {
  // Use Map for efficient per-message tab state lookup
  const [activeMetadataTab, setActiveMetadataTabState] = useState<Map<string, MetadataTab | null>>(
    new Map()
  );

  /**
   * Set active metadata tab for a specific message
   *
   * @param messageId - Message ID to update
   * @param tab - Tab to set as active (null to close)
   */
  const setActiveMetadataTab = useCallback((messageId: string, tab: MetadataTab | null) => {
    logger.debug('[useMessageMetadata] Setting active tab', {
      messageId,
      tab,
    });

    setActiveMetadataTabState((prev) => {
      const next = new Map(prev);
      if (tab === null) {
        next.delete(messageId);
      } else {
        next.set(messageId, tab);
      }
      return next;
    });
  }, []);

  /**
   * Toggle metadata tab for a message
   *
   * If the same tab is already active, it will be closed (set to null).
   * If a different tab is active, it will be replaced.
   * If no tab is active, the specified tab will be opened.
   *
   * Auto-scrolls to bottom if this is the last message and opening a tab.
   *
   * @param messageId - Message ID to toggle tab for
   * @param tab - Tab type to toggle
   * @param isLastMessage - Whether this is the last message in the chat
   */
  const handleMetadataToggle = useCallback(
    (messageId: string, tab: MetadataTab, isLastMessage = false) => {
      logger.debug('[useMessageMetadata] Toggling metadata tab', {
        messageId,
        tab,
        isLastMessage,
      });

      setActiveMetadataTabState((prev) => {
        const currentTab = prev.get(messageId);
        const newValue = currentTab === tab ? null : tab;
        const next = new Map(prev);

        if (newValue === null) {
          next.delete(messageId);
          logger.debug('[useMessageMetadata] Closed metadata tab', { messageId, tab });
        } else {
          next.set(messageId, newValue);
          logger.debug('[useMessageMetadata] Opened metadata tab', { messageId, tab: newValue });

          // Scroll to bottom if this is the last message and we're opening a tab
          if (isLastMessage && onScrollToBottom) {
            setTimeout(() => {
              onScrollToBottom();
              logger.debug('[useMessageMetadata] Auto-scrolled to bottom', { messageId });
            }, 100);
          }
        }

        return next;
      });
    },
    [onScrollToBottom]
  );

  return {
    activeMetadataTab,
    setActiveMetadataTab,
    handleMetadataToggle,
  };
};
