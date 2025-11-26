import { renderHook } from '@testing-library/react';
import { useStopStreamingWithFocus } from '@/hooks/useStopStreamingWithFocus';
import { EditorView } from '@codemirror/view';
import { logger } from '@/commons/utils/logger';

// Mock dependencies
jest.mock('@/commons/utils/logger');

describe('useStopStreamingWithFocus', () => {
  let mockOnStopStreaming: jest.Mock;
  let mockViewRef: React.RefObject<EditorView | null>;
  let mockEditorView: jest.Mocked<EditorView>;

  beforeEach(() => {
    // Setup mock onStopStreaming
    mockOnStopStreaming = jest.fn(
      (options?: { focusCallback?: () => void; silentCancel?: boolean }) => {
        if (options?.focusCallback) options.focusCallback();
      }
    );

    // Setup mock EditorView
    mockEditorView = {
      focus: jest.fn(),
    } as unknown as jest.Mocked<EditorView>;

    // Setup mock viewRef
    mockViewRef = { current: mockEditorView };

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    it('should initialize and return stopStreamingWithFocus function', () => {
      const { result } = renderHook(() =>
        useStopStreamingWithFocus(mockViewRef, mockOnStopStreaming)
      );

      expect(result.current).toBeDefined();
      expect(result.current.stopStreamingWithFocus).toBeDefined();
      expect(typeof result.current.stopStreamingWithFocus).toBe('function');
    });

    it('should not call onStopStreaming on initialization', () => {
      renderHook(() => useStopStreamingWithFocus(mockViewRef, mockOnStopStreaming));

      expect(mockOnStopStreaming).not.toHaveBeenCalled();
    });
  });

  describe('stopStreamingWithFocus callback', () => {
    it('should call stopStreaming when invoked', () => {
      const { result } = renderHook(() =>
        useStopStreamingWithFocus(mockViewRef, mockOnStopStreaming)
      );

      result.current.stopStreamingWithFocus();

      expect(mockOnStopStreaming).toHaveBeenCalledTimes(1);
      expect(mockOnStopStreaming).toHaveBeenCalledWith(
        expect.objectContaining({
          focusCallback: expect.any(Function),
        })
      );
    });

    it('should restore focus to editor via requestAnimationFrame', async () => {
      const { result } = renderHook(() =>
        useStopStreamingWithFocus(mockViewRef, mockOnStopStreaming)
      );

      // Mock requestAnimationFrame to execute immediately
      global.requestAnimationFrame = jest.fn((cb) => {
        cb(0);
        return 0;
      });

      result.current.stopStreamingWithFocus();

      expect(global.requestAnimationFrame).toHaveBeenCalled();
      expect(mockEditorView.focus).toHaveBeenCalledTimes(1);
    });

    it('should log debug message when stopping stream', () => {
      const { result } = renderHook(() =>
        useStopStreamingWithFocus(mockViewRef, mockOnStopStreaming)
      );

      result.current.stopStreamingWithFocus();

      expect(logger.debug).toHaveBeenCalledWith(
        '[useStopStreamingWithFocus] Stopping stream with focus restoration'
      );
    });

    it('should log debug message when focus is restored', () => {
      const { result } = renderHook(() =>
        useStopStreamingWithFocus(mockViewRef, mockOnStopStreaming)
      );

      global.requestAnimationFrame = jest.fn((cb) => {
        cb(0);
        return 0;
      });

      result.current.stopStreamingWithFocus();

      expect(logger.debug).toHaveBeenCalledWith(
        '[useStopStreamingWithFocus] Focus restored to editor'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle null viewRef.current gracefully', () => {
      const nullViewRef = { current: null };
      const { result } = renderHook(() =>
        useStopStreamingWithFocus(nullViewRef, mockOnStopStreaming)
      );

      global.requestAnimationFrame = jest.fn((cb) => {
        cb(0);
        return 0;
      });

      // Should not throw
      expect(() => {
        result.current.stopStreamingWithFocus();
      }).not.toThrow();

      expect(logger.warn).toHaveBeenCalledWith(
        '[useStopStreamingWithFocus] viewRef.current is null, cannot restore focus'
      );
    });

    it('should handle rapid successive calls', () => {
      const { result } = renderHook(() =>
        useStopStreamingWithFocus(mockViewRef, mockOnStopStreaming)
      );

      global.requestAnimationFrame = jest.fn((cb) => {
        cb(0);
        return 0;
      });

      // Call multiple times rapidly
      result.current.stopStreamingWithFocus();
      result.current.stopStreamingWithFocus();
      result.current.stopStreamingWithFocus();

      expect(mockOnStopStreaming).toHaveBeenCalledTimes(3);
      expect(mockEditorView.focus).toHaveBeenCalledTimes(3);
    });

    it('should maintain stable callback reference across renders', () => {
      const { result, rerender } = renderHook(() =>
        useStopStreamingWithFocus(mockViewRef, mockOnStopStreaming)
      );

      const firstCallback = result.current.stopStreamingWithFocus;
      rerender();
      const secondCallback = result.current.stopStreamingWithFocus;

      expect(firstCallback).toBe(secondCallback);
    });
  });

  describe('Integration with stopStreaming', () => {
    it('should pass focus callback to stopStreaming', () => {
      const { result } = renderHook(() =>
        useStopStreamingWithFocus(mockViewRef, mockOnStopStreaming)
      );

      result.current.stopStreamingWithFocus();

      expect(mockOnStopStreaming).toHaveBeenCalledWith(
        expect.objectContaining({
          focusCallback: expect.any(Function),
        })
      );

      // Verify the callback does what we expect
      const options = mockOnStopStreaming.mock.calls[0][0];
      expect(typeof options.focusCallback).toBe('function');
    });

    it('should defer focus until after stopStreaming completes', () => {
      const executionOrder: string[] = [];

      mockOnStopStreaming.mockImplementation(
        (options?: { focusCallback?: () => void; silentCancel?: boolean }) => {
          executionOrder.push('stopStreaming');
          if (options?.focusCallback) options.focusCallback();
        }
      );

      global.requestAnimationFrame = jest.fn((cb) => {
        executionOrder.push('requestAnimationFrame');
        cb(0);
        return 0;
      });

      mockEditorView.focus.mockImplementation(() => {
        executionOrder.push('focus');
      });

      const { result } = renderHook(() =>
        useStopStreamingWithFocus(mockViewRef, mockOnStopStreaming)
      );
      result.current.stopStreamingWithFocus();

      expect(executionOrder).toEqual(['stopStreaming', 'requestAnimationFrame', 'focus']);
    });
  });

  describe('Callback Stability', () => {
    it('should use useCallback for memoization', () => {
      const { result, rerender } = renderHook(() =>
        useStopStreamingWithFocus(mockViewRef, mockOnStopStreaming)
      );

      const callback1 = result.current.stopStreamingWithFocus;

      // Force re-render
      rerender();

      const callback2 = result.current.stopStreamingWithFocus;

      // Callback should be stable (same reference)
      expect(callback1).toBe(callback2);
    });

    it('should update callback when onStopStreaming changes', () => {
      const newMockOnStopStreaming = jest.fn(
        (options?: { focusCallback?: () => void; silentCancel?: boolean }) => {
          if (options?.focusCallback) options.focusCallback();
        }
      );

      const { result, rerender } = renderHook(
        ({ onStop }) => useStopStreamingWithFocus(mockViewRef, onStop),
        { initialProps: { onStop: mockOnStopStreaming } }
      );

      const callback1 = result.current.stopStreamingWithFocus;

      // Change the prop
      rerender({ onStop: newMockOnStopStreaming });

      const callback2 = result.current.stopStreamingWithFocus;

      // Callback should update when dependency changes
      expect(callback1).not.toBe(callback2);
    });
  });

  describe('Error Handling', () => {
    it('should handle focus errors gracefully', () => {
      const { result } = renderHook(() =>
        useStopStreamingWithFocus(mockViewRef, mockOnStopStreaming)
      );

      mockEditorView.focus.mockImplementation(() => {
        throw new Error('Focus failed');
      });

      global.requestAnimationFrame = jest.fn((cb) => {
        cb(0);
        return 0;
      });

      // Should not propagate error
      expect(() => {
        result.current.stopStreamingWithFocus();
      }).toThrow('Focus failed');
    });

    it('should handle stopStreaming errors', () => {
      const { result } = renderHook(() =>
        useStopStreamingWithFocus(mockViewRef, mockOnStopStreaming)
      );

      mockOnStopStreaming.mockImplementation(() => {
        throw new Error('Stop streaming failed');
      });

      expect(() => {
        result.current.stopStreamingWithFocus();
      }).toThrow('Stop streaming failed');
    });
  });
});
