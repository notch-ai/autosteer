import { EditorView } from '@codemirror/view';
import { useCallback } from 'react';
import { logger } from '@/commons/utils/logger';

/**
 * Hook for stopping streaming with automatic focus restoration
 *
 * Encapsulates the logic for canceling Claude Code queries and restoring
 * focus to the chat input editor. Follows the handler hook pattern with
 * separation of concerns between React lifecycle and focus management.
 *
 * @param viewRef - Ref containing the CodeMirror EditorView instance
 * @param onStopStreaming - Optional callback from parent (chat store's stopStreaming)
 * @returns Object with stopStreamingWithFocus callback
 *
 * @example
 * ```tsx
 * const viewRef = useRef<EditorView | null>(null);
 * const { stopStreamingWithFocus } = useStopStreamingWithFocus(viewRef, onStopStreaming);
 *
 * // ESC ESC handler
 * stopStreamingWithFocus();
 *
 * // Cancel button
 * onClick={stopStreamingWithFocus}
 * ```
 */
export const useStopStreamingWithFocus = (
  viewRef: React.RefObject<EditorView | null>,
  onStopStreaming?: (options?: { focusCallback?: () => void; silentCancel?: boolean }) => void
) => {
  /**
   * Stop streaming and restore focus to the editor
   *
   * Uses requestAnimationFrame to defer focus until after state updates
   * complete, preventing race conditions with rapid cancellations.
   */
  const stopStreamingWithFocus = useCallback(() => {
    if (!onStopStreaming) {
      logger.warn('[useStopStreamingWithFocus] No onStopStreaming callback provided');
      return;
    }

    logger.debug('[useStopStreamingWithFocus] Stopping stream with focus restoration');

    onStopStreaming({
      focusCallback: () => {
        // Focus THIS editor instance (not another agent's editor)
        // Use requestAnimationFrame to defer focus until after state updates
        requestAnimationFrame(() => {
          if (viewRef.current) {
            viewRef.current.focus();
            logger.debug('[useStopStreamingWithFocus] Focus restored to editor');
          } else {
            logger.warn(
              '[useStopStreamingWithFocus] viewRef.current is null, cannot restore focus'
            );
          }
        });
      },
    });
  }, [onStopStreaming, viewRef]);

  return {
    stopStreamingWithFocus,
  };
};
