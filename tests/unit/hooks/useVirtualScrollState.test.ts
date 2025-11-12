/**
 * Unit Tests for useVirtualScrollState Hook
 *
 * Tests virtual scroll state management with expansion, height calculation, and caching.
 * Follows TDD approach with comprehensive coverage.
 *
 * Test Coverage:
 * - Hook initialization
 * - Expansion state management (toggle, Set operations)
 * - Row height calculation with caching
 * - Cache invalidation on expansion changes
 * - List ref management
 * - Callback stability
 *
 * Target Coverage: 80%+
 */

import { renderHook, act } from '@testing-library/react';
import { useVirtualScrollState } from '@/hooks/useVirtualScrollState';

describe('useVirtualScrollState', () => {
  interface TestItem {
    id: string;
    name: string;
    content: string;
  }

  const mockItems: TestItem[] = [
    { id: '1', name: 'Item 1', content: 'Short content' },
    { id: '2', name: 'Item 2', content: 'Medium content that is longer' },
    { id: '3', name: 'Item 3', content: 'Very long content that will expand' },
  ];

  const getItemId = (item: TestItem) => item.id;
  const calculateHeight = (_item: TestItem, isExpanded: boolean) => (isExpanded ? 300 : 60);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    it('should initialize with empty expansion state', () => {
      const { result } = renderHook(() =>
        useVirtualScrollState(mockItems, getItemId, calculateHeight)
      );

      expect(result.current.expandedItems).toBeInstanceOf(Set);
      expect(result.current.expandedItems.size).toBe(0);
      expect(result.current.toggleExpanded).toBeDefined();
      expect(result.current.getRowHeight).toBeDefined();
      expect(result.current.listRef).toBeDefined();
      expect(result.current.clearCache).toBeDefined();
    });

    it('should initialize with listRef as null', () => {
      const { result } = renderHook(() =>
        useVirtualScrollState(mockItems, getItemId, calculateHeight)
      );

      expect(result.current.listRef.current).toBe(null);
    });
  });

  describe('Expansion State Management', () => {
    it('should expand an item when toggled', () => {
      const { result } = renderHook(() =>
        useVirtualScrollState(mockItems, getItemId, calculateHeight)
      );

      expect(result.current.expandedItems.has('1')).toBe(false);

      act(() => {
        result.current.toggleExpanded('1');
      });

      expect(result.current.expandedItems.has('1')).toBe(true);
      expect(result.current.expandedItems.size).toBe(1);
    });

    it('should collapse an expanded item when toggled', () => {
      const { result } = renderHook(() =>
        useVirtualScrollState(mockItems, getItemId, calculateHeight)
      );

      // Expand item
      act(() => {
        result.current.toggleExpanded('1');
      });

      expect(result.current.expandedItems.has('1')).toBe(true);

      // Collapse item
      act(() => {
        result.current.toggleExpanded('1');
      });

      expect(result.current.expandedItems.has('1')).toBe(false);
      expect(result.current.expandedItems.size).toBe(0);
    });

    it('should handle multiple expanded items', () => {
      const { result } = renderHook(() =>
        useVirtualScrollState(mockItems, getItemId, calculateHeight)
      );

      act(() => {
        result.current.toggleExpanded('1');
        result.current.toggleExpanded('2');
        result.current.toggleExpanded('3');
      });

      expect(result.current.expandedItems.has('1')).toBe(true);
      expect(result.current.expandedItems.has('2')).toBe(true);
      expect(result.current.expandedItems.has('3')).toBe(true);
      expect(result.current.expandedItems.size).toBe(3);
    });

    it('should maintain independent expansion states', () => {
      const { result } = renderHook(() =>
        useVirtualScrollState(mockItems, getItemId, calculateHeight)
      );

      act(() => {
        result.current.toggleExpanded('1');
        result.current.toggleExpanded('3');
      });

      expect(result.current.expandedItems.has('1')).toBe(true);
      expect(result.current.expandedItems.has('2')).toBe(false);
      expect(result.current.expandedItems.has('3')).toBe(true);
    });
  });

  describe('Row Height Calculation', () => {
    it('should calculate collapsed height for non-expanded item', () => {
      const { result } = renderHook(() =>
        useVirtualScrollState(mockItems, getItemId, calculateHeight)
      );

      const height = result.current.getRowHeight(0);

      expect(height).toBe(60); // Collapsed height
    });

    it('should calculate expanded height for expanded item', () => {
      const { result } = renderHook(() =>
        useVirtualScrollState(mockItems, getItemId, calculateHeight)
      );

      act(() => {
        result.current.toggleExpanded('1');
      });

      const height = result.current.getRowHeight(0);

      expect(height).toBe(300); // Expanded height
    });

    it('should use correct height for each item index', () => {
      const { result } = renderHook(() =>
        useVirtualScrollState(mockItems, getItemId, calculateHeight)
      );

      act(() => {
        result.current.toggleExpanded('2'); // Expand second item
      });

      expect(result.current.getRowHeight(0)).toBe(60); // First item collapsed
      expect(result.current.getRowHeight(1)).toBe(300); // Second item expanded
      expect(result.current.getRowHeight(2)).toBe(60); // Third item collapsed
    });
  });

  describe('Height Caching', () => {
    it('should cache row heights for performance', () => {
      const mockCalculateHeight = jest.fn((_item: TestItem, isExpanded: boolean) =>
        isExpanded ? 300 : 60
      );

      const { result } = renderHook(() =>
        useVirtualScrollState(mockItems, getItemId, mockCalculateHeight)
      );

      // First call - should calculate
      result.current.getRowHeight(0);
      expect(mockCalculateHeight).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      result.current.getRowHeight(0);
      expect(mockCalculateHeight).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should clear cache when expansion changes', () => {
      const mockCalculateHeight = jest.fn((_item: TestItem, isExpanded: boolean) =>
        isExpanded ? 300 : 60
      );

      const { result } = renderHook(() =>
        useVirtualScrollState(mockItems, getItemId, mockCalculateHeight)
      );

      // Calculate initial height
      result.current.getRowHeight(0);
      expect(mockCalculateHeight).toHaveBeenCalledTimes(1);

      // Toggle expansion - should clear cache
      act(() => {
        result.current.toggleExpanded('1');
      });

      // Calculate height again - should recalculate
      result.current.getRowHeight(0);
      expect(mockCalculateHeight).toHaveBeenCalledTimes(2);
    });

    it('should cache heights for different indices independently', () => {
      const mockCalculateHeight = jest.fn((_item: TestItem, isExpanded: boolean) =>
        isExpanded ? 300 : 60
      );

      const { result } = renderHook(() =>
        useVirtualScrollState(mockItems, getItemId, mockCalculateHeight)
      );

      // Calculate for index 0
      result.current.getRowHeight(0);
      expect(mockCalculateHeight).toHaveBeenCalledTimes(1);

      // Calculate for index 1 - should call calculate
      result.current.getRowHeight(1);
      expect(mockCalculateHeight).toHaveBeenCalledTimes(2);

      // Calculate for index 0 again - should use cache
      result.current.getRowHeight(0);
      expect(mockCalculateHeight).toHaveBeenCalledTimes(2); // Still 2
    });
  });

  describe('Clear Cache', () => {
    it('should clear all cached heights when called', () => {
      const mockCalculateHeight = jest.fn((_item: TestItem, isExpanded: boolean) =>
        isExpanded ? 300 : 60
      );

      const { result } = renderHook(() =>
        useVirtualScrollState(mockItems, getItemId, mockCalculateHeight)
      );

      // Cache some heights
      result.current.getRowHeight(0);
      result.current.getRowHeight(1);
      result.current.getRowHeight(2);
      expect(mockCalculateHeight).toHaveBeenCalledTimes(3);

      // Clear cache
      act(() => {
        result.current.clearCache();
      });

      // Recalculate - should call calculate again
      result.current.getRowHeight(0);
      expect(mockCalculateHeight).toHaveBeenCalledTimes(4);
    });
  });

  describe('List Ref Management', () => {
    it('should provide a ref for VariableSizeList', () => {
      const { result } = renderHook(() =>
        useVirtualScrollState(mockItems, getItemId, calculateHeight)
      );

      expect(result.current.listRef).toBeDefined();
      expect(result.current.listRef.current).toBe(null);
    });

    it('should call resetAfterIndex when expansion changes', () => {
      const mockResetAfterIndex = jest.fn();
      const mockList = {
        resetAfterIndex: mockResetAfterIndex,
      };

      const { result } = renderHook(() =>
        useVirtualScrollState(mockItems, getItemId, calculateHeight)
      );

      // Attach mock list to ref
      // @ts-expect-error - Setting ref for test purposes
      result.current.listRef.current = mockList;

      // Toggle expansion - should reset list
      act(() => {
        result.current.toggleExpanded('1');
      });

      expect(mockResetAfterIndex).toHaveBeenCalledWith(0);
    });

    it('should call resetAfterIndex when cache is cleared', () => {
      const mockResetAfterIndex = jest.fn();
      const mockList = {
        resetAfterIndex: mockResetAfterIndex,
      };

      const { result } = renderHook(() =>
        useVirtualScrollState(mockItems, getItemId, calculateHeight)
      );

      // Attach mock list to ref
      // @ts-expect-error - Setting ref for test purposes
      result.current.listRef.current = mockList;

      // Clear cache
      act(() => {
        result.current.clearCache();
      });

      expect(mockResetAfterIndex).toHaveBeenCalledWith(0);
    });
  });

  describe('Items Array Changes', () => {
    it('should recalculate heights when items change', () => {
      const mockCalculateHeight = jest.fn((_item: TestItem, isExpanded: boolean) =>
        isExpanded ? 300 : 60
      );

      const { result, rerender } = renderHook(
        ({ items }) => useVirtualScrollState(items, getItemId, mockCalculateHeight),
        { initialProps: { items: mockItems } }
      );

      // Calculate initial height
      const height1 = result.current.getRowHeight(0);
      expect(mockCalculateHeight).toHaveBeenCalledTimes(1);
      expect(height1).toBe(60);

      // Change items
      const newItems = [{ id: '4', name: 'Item 4', content: 'New content' }, ...mockItems];

      rerender({ items: newItems });

      // Clear cache to see new items
      act(() => {
        result.current.clearCache();
      });

      // Recalculate - should use new items (new item '4' is now at index 0)
      const height2 = result.current.getRowHeight(0);
      expect(mockCalculateHeight).toHaveBeenCalledWith(expect.objectContaining({ id: '4' }), false);
      expect(height2).toBe(60);
    });
  });

  describe('Callback Stability', () => {
    it('should maintain stable callback references across renders', () => {
      const { result, rerender } = renderHook(() =>
        useVirtualScrollState(mockItems, getItemId, calculateHeight)
      );

      const initialToggleExpanded = result.current.toggleExpanded;
      const initialClearCache = result.current.clearCache;

      rerender();

      expect(result.current.toggleExpanded).toBe(initialToggleExpanded);
      expect(result.current.clearCache).toBe(initialClearCache);
      // Note: getRowHeight depends on items/expandedItems, so may change
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty items array', () => {
      const { result } = renderHook(() => useVirtualScrollState([], getItemId, calculateHeight));

      expect(result.current.expandedItems.size).toBe(0);
      expect(() => result.current.toggleExpanded('1')).not.toThrow();
    });

    it('should handle toggling non-existent item ID', () => {
      const { result } = renderHook(() =>
        useVirtualScrollState(mockItems, getItemId, calculateHeight)
      );

      expect(() => {
        act(() => {
          result.current.toggleExpanded('non-existent');
        });
      }).not.toThrow();

      expect(result.current.expandedItems.has('non-existent')).toBe(true);
    });

    it('should handle invalid index in getRowHeight', () => {
      const { result } = renderHook(() =>
        useVirtualScrollState(mockItems, getItemId, calculateHeight)
      );

      // Invalid index will cause error - this is expected behavior
      // react-window will not call getRowHeight with invalid indices
      // The hook delegates validation to the caller
      expect(() => {
        result.current.getRowHeight(999);
      }).toThrow();
    });
  });
});
