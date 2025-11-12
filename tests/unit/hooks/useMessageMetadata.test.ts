/**
 * Unit Tests for useMessageMetadata Hook
 *
 * Tests metadata tab state management with toggle behavior and auto-scroll.
 * Follows TDD approach with comprehensive coverage.
 *
 * Test Coverage:
 * - Hook initialization
 * - Metadata tab state management (Map-based)
 * - Toggle behavior (same tab closes, different tab switches)
 * - Auto-scroll for last message
 * - Multiple messages with independent states
 * - Callback stability
 *
 * Target Coverage: 80%+
 */

import { renderHook, act } from '@testing-library/react';
import { useMessageMetadata } from '@/hooks/useMessageMetadata';
import { logger } from '@/commons/utils/logger';

// Mock logger
jest.mock('@/commons/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('useMessageMetadata', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Hook Initialization', () => {
    it('should initialize with empty metadata tab map', () => {
      const { result } = renderHook(() => useMessageMetadata());

      expect(result.current.activeMetadataTab).toBeInstanceOf(Map);
      expect(result.current.activeMetadataTab.size).toBe(0);
      expect(result.current.setActiveMetadataTab).toBeDefined();
      expect(result.current.handleMetadataToggle).toBeDefined();
    });

    it('should work without onScrollToBottom callback', () => {
      const { result } = renderHook(() => useMessageMetadata());

      expect(() => {
        act(() => {
          result.current.handleMetadataToggle('msg-1', 'tools', true);
        });
      }).not.toThrow();
    });
  });

  describe('Set Active Metadata Tab', () => {
    it('should set active tab for a message', () => {
      const { result } = renderHook(() => useMessageMetadata());

      act(() => {
        result.current.setActiveMetadataTab('msg-1', 'tools');
      });

      expect(result.current.activeMetadataTab.get('msg-1')).toBe('tools');
      expect(logger.debug).toHaveBeenCalledWith(
        '[useMessageMetadata] Setting active tab',
        expect.objectContaining({ messageId: 'msg-1', tab: 'tools' })
      );
    });

    it('should update tab for existing message', () => {
      const { result } = renderHook(() => useMessageMetadata());

      act(() => {
        result.current.setActiveMetadataTab('msg-1', 'tools');
      });

      expect(result.current.activeMetadataTab.get('msg-1')).toBe('tools');

      act(() => {
        result.current.setActiveMetadataTab('msg-1', 'tokens');
      });

      expect(result.current.activeMetadataTab.get('msg-1')).toBe('tokens');
    });

    it('should remove tab when set to null', () => {
      const { result } = renderHook(() => useMessageMetadata());

      act(() => {
        result.current.setActiveMetadataTab('msg-1', 'tools');
      });

      expect(result.current.activeMetadataTab.get('msg-1')).toBe('tools');

      act(() => {
        result.current.setActiveMetadataTab('msg-1', null);
      });

      expect(result.current.activeMetadataTab.has('msg-1')).toBe(false);
    });

    it('should handle multiple messages independently', () => {
      const { result } = renderHook(() => useMessageMetadata());

      act(() => {
        result.current.setActiveMetadataTab('msg-1', 'tools');
        result.current.setActiveMetadataTab('msg-2', 'tokens');
        result.current.setActiveMetadataTab('msg-3', 'todos');
      });

      expect(result.current.activeMetadataTab.get('msg-1')).toBe('tools');
      expect(result.current.activeMetadataTab.get('msg-2')).toBe('tokens');
      expect(result.current.activeMetadataTab.get('msg-3')).toBe('todos');
      expect(result.current.activeMetadataTab.size).toBe(3);
    });
  });

  describe('Toggle Metadata Tab', () => {
    it('should open tab when no tab is active', () => {
      const { result } = renderHook(() => useMessageMetadata());

      act(() => {
        result.current.handleMetadataToggle('msg-1', 'tools');
      });

      expect(result.current.activeMetadataTab.get('msg-1')).toBe('tools');
      expect(logger.debug).toHaveBeenCalledWith(
        '[useMessageMetadata] Opened metadata tab',
        expect.objectContaining({ messageId: 'msg-1', tab: 'tools' })
      );
    });

    it('should close tab when same tab is active', () => {
      const { result } = renderHook(() => useMessageMetadata());

      act(() => {
        result.current.handleMetadataToggle('msg-1', 'tools');
      });

      expect(result.current.activeMetadataTab.get('msg-1')).toBe('tools');

      act(() => {
        result.current.handleMetadataToggle('msg-1', 'tools');
      });

      expect(result.current.activeMetadataTab.has('msg-1')).toBe(false);
      expect(logger.debug).toHaveBeenCalledWith(
        '[useMessageMetadata] Closed metadata tab',
        expect.objectContaining({ messageId: 'msg-1', tab: 'tools' })
      );
    });

    it('should switch to different tab when different tab is clicked', () => {
      const { result } = renderHook(() => useMessageMetadata());

      act(() => {
        result.current.handleMetadataToggle('msg-1', 'tools');
      });

      expect(result.current.activeMetadataTab.get('msg-1')).toBe('tools');

      act(() => {
        result.current.handleMetadataToggle('msg-1', 'tokens');
      });

      expect(result.current.activeMetadataTab.get('msg-1')).toBe('tokens');
    });

    it('should handle all tab types', () => {
      const { result } = renderHook(() => useMessageMetadata());

      const tabs: Array<'tools' | 'tokens' | 'todos'> = ['tools', 'tokens', 'todos'];

      tabs.forEach((tab) => {
        act(() => {
          result.current.handleMetadataToggle('msg-1', tab);
        });

        expect(result.current.activeMetadataTab.get('msg-1')).toBe(tab);
      });
    });
  });

  describe('Auto-scroll Behavior', () => {
    it('should call onScrollToBottom when opening tab on last message', () => {
      const mockScrollToBottom = jest.fn();

      const { result } = renderHook(() =>
        useMessageMetadata({ onScrollToBottom: mockScrollToBottom })
      );

      act(() => {
        result.current.handleMetadataToggle('msg-1', 'tools', true);
      });

      // Fast-forward timer for auto-scroll
      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(mockScrollToBottom).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        '[useMessageMetadata] Auto-scrolled to bottom',
        expect.objectContaining({ messageId: 'msg-1' })
      );
    });

    it('should not call onScrollToBottom when opening tab on non-last message', () => {
      const mockScrollToBottom = jest.fn();

      const { result } = renderHook(() =>
        useMessageMetadata({ onScrollToBottom: mockScrollToBottom })
      );

      act(() => {
        result.current.handleMetadataToggle('msg-1', 'tools', false);
      });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(mockScrollToBottom).not.toHaveBeenCalled();
    });

    it('should not call onScrollToBottom when closing tab', () => {
      const mockScrollToBottom = jest.fn();

      const { result } = renderHook(() =>
        useMessageMetadata({ onScrollToBottom: mockScrollToBottom })
      );

      // Open tab
      act(() => {
        result.current.handleMetadataToggle('msg-1', 'tools', true);
      });

      // Advance timers to complete the first scroll call
      act(() => {
        jest.advanceTimersByTime(100);
      });

      // Should have been called once for opening
      expect(mockScrollToBottom).toHaveBeenCalledTimes(1);
      mockScrollToBottom.mockClear();

      // Close tab
      act(() => {
        result.current.handleMetadataToggle('msg-1', 'tools', true);
      });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      // Should not be called again when closing
      expect(mockScrollToBottom).not.toHaveBeenCalled();
    });

    it('should call onScrollToBottom when switching tabs on last message', () => {
      const mockScrollToBottom = jest.fn();

      const { result } = renderHook(() =>
        useMessageMetadata({ onScrollToBottom: mockScrollToBottom })
      );

      // Open tools tab
      act(() => {
        result.current.handleMetadataToggle('msg-1', 'tools', true);
      });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(mockScrollToBottom).toHaveBeenCalledTimes(1);

      // Switch to tokens tab
      act(() => {
        result.current.handleMetadataToggle('msg-1', 'tokens', true);
      });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(mockScrollToBottom).toHaveBeenCalledTimes(2);
    });
  });

  describe('Multiple Messages', () => {
    it('should maintain independent tab states for different messages', () => {
      const { result } = renderHook(() => useMessageMetadata());

      act(() => {
        result.current.handleMetadataToggle('msg-1', 'tools');
        result.current.handleMetadataToggle('msg-2', 'tokens');
        result.current.handleMetadataToggle('msg-3', 'todos');
      });

      expect(result.current.activeMetadataTab.get('msg-1')).toBe('tools');
      expect(result.current.activeMetadataTab.get('msg-2')).toBe('tokens');
      expect(result.current.activeMetadataTab.get('msg-3')).toBe('todos');
    });

    it('should toggle one message without affecting others', () => {
      const { result } = renderHook(() => useMessageMetadata());

      act(() => {
        result.current.handleMetadataToggle('msg-1', 'tools');
        result.current.handleMetadataToggle('msg-2', 'tokens');
      });

      // Close msg-1 tab
      act(() => {
        result.current.handleMetadataToggle('msg-1', 'tools');
      });

      expect(result.current.activeMetadataTab.has('msg-1')).toBe(false);
      expect(result.current.activeMetadataTab.get('msg-2')).toBe('tokens');
    });
  });

  describe('Map-based State', () => {
    it('should use Map for O(1) lookups', () => {
      const { result } = renderHook(() => useMessageMetadata());

      // Add many messages
      for (let i = 0; i < 100; i++) {
        act(() => {
          result.current.setActiveMetadataTab(`msg-${i}`, 'tools');
        });
      }

      expect(result.current.activeMetadataTab.size).toBe(100);

      // Lookup should be fast
      expect(result.current.activeMetadataTab.get('msg-50')).toBe('tools');
    });
  });

  describe('Callback Stability', () => {
    it('should maintain stable callback references', () => {
      const mockScrollToBottom = jest.fn();

      const { result, rerender } = renderHook(() =>
        useMessageMetadata({ onScrollToBottom: mockScrollToBottom })
      );

      const initialSetActiveTab = result.current.setActiveMetadataTab;
      const initialHandleToggle = result.current.handleMetadataToggle;

      rerender();

      expect(result.current.setActiveMetadataTab).toBe(initialSetActiveTab);
      expect(result.current.handleMetadataToggle).toBe(initialHandleToggle);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message IDs', () => {
      const { result } = renderHook(() => useMessageMetadata());

      expect(() => {
        act(() => {
          result.current.handleMetadataToggle('', 'tools');
        });
      }).not.toThrow();

      expect(result.current.activeMetadataTab.get('')).toBe('tools');
    });

    it('should handle rapid toggling', () => {
      const { result } = renderHook(() => useMessageMetadata());

      expect(() => {
        act(() => {
          result.current.handleMetadataToggle('msg-1', 'tools');
          result.current.handleMetadataToggle('msg-1', 'tools');
          result.current.handleMetadataToggle('msg-1', 'tools');
          result.current.handleMetadataToggle('msg-1', 'tools');
        });
      }).not.toThrow();

      // Should be closed after even number of toggles
      expect(result.current.activeMetadataTab.has('msg-1')).toBe(false);
    });
  });
});
