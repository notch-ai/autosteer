import { useCallback, useRef, useState } from 'react';
import { VariableSizeList as List } from 'react-window';

/**
 * Virtual scroll state returned by the hook
 */
export interface VirtualScrollState {
  /**
   * Set of expanded item IDs
   */
  expandedItems: Set<string>;

  /**
   * Toggle expansion state for an item
   */
  toggleExpanded: (id: string) => void;

  /**
   * Calculate row height for virtual list
   * Uses cached heights for performance
   */
  getRowHeight: (index: number) => number;

  /**
   * Ref to attach to VariableSizeList component
   */
  listRef: React.RefObject<List>;

  /**
   * Clear all row height caches
   * Call when items change to force recalculation
   */
  clearCache: () => void;
}

/**
 * useVirtualScrollState - Generic virtual scrolling with expansion state
 *
 * Provides expansion state management and row height calculation for react-window
 * VariableSizeList components. Implements performance optimizations:
 * - Cached row heights to avoid recalculation
 * - Automatic cache invalidation on expansion changes
 * - Stable callbacks with useCallback
 *
 * Key Features:
 * - Generic type support for any item type
 * - Expansion state management with Set
 * - Row height caching with Map
 * - Automatic list reset on state changes
 * - Stable callback references
 *
 * Performance:
 * - O(1) height lookups via cache
 * - Minimal re-renders via useCallback
 * - Efficient Set operations for expansion state
 *
 * Usage:
 * ```tsx
 * const { expandedItems, toggleExpanded, getRowHeight, listRef } =
 *   useVirtualScrollState(
 *     tools,
 *     (tool) => tool.id,
 *     (tool, isExpanded) => isExpanded ? 300 : 60
 *   );
 *
 * <List
 *   ref={listRef}
 *   itemCount={tools.length}
 *   itemSize={getRowHeight}
 * >
 *   {({ index, style }) => {
 *     const tool = tools[index];
 *     const isExpanded = expandedItems.has(tool.id);
 *     return <ToolRow tool={tool} isExpanded={isExpanded} />;
 *   }}
 * </List>
 * ```
 *
 * @param items - Array of items to render in the virtual list
 * @param getItemId - Function to extract unique ID from an item
 * @param calculateHeight - Function to calculate height for an item (receives item and expansion state)
 * @returns Virtual scroll state and utilities
 *
 * @see autosteer/src/features/monitoring/components/ToolUsageDisplay.tsx
 * @see autosteer/src/features/monitoring/components/TraceTab.tsx
 * @see docs/guides-architecture.md - Handler Pattern Guidelines
 */
export const useVirtualScrollState = <T>(
  items: T[],
  getItemId: (item: T) => string,
  calculateHeight: (item: T, isExpanded: boolean) => number
): VirtualScrollState => {
  // Expansion state - which items are expanded
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Ref to the virtual list for programmatic control
  const listRef = useRef<List>(null);

  // Cache of calculated row heights to avoid recalculation
  const rowHeights = useRef<Map<number, number>>(new Map());

  /**
   * Toggle expansion state for an item
   * Clears height cache and resets list to recalculate heights
   */
  const toggleExpanded = useCallback((id: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });

    // Clear cache and reset list when expansion changes
    rowHeights.current.clear();
    listRef.current?.resetAfterIndex(0);
  }, []);

  /**
   * Calculate row height for a given index
   * Uses cache for performance, falls back to calculateHeight function
   */
  const getRowHeight = useCallback(
    (index: number): number => {
      // Check cache first for O(1) lookup
      if (rowHeights.current.has(index)) {
        return rowHeights.current.get(index)!;
      }

      // Calculate height based on item and expansion state
      const item = items[index];
      const itemId = getItemId(item);
      const isExpanded = expandedItems.has(itemId);
      const height = calculateHeight(item, isExpanded);

      // Cache the calculated height
      rowHeights.current.set(index, height);
      return height;
    },
    [items, expandedItems, getItemId, calculateHeight]
  );

  /**
   * Clear all cached row heights
   * Useful when items array changes or external factors affect height
   */
  const clearCache = useCallback(() => {
    rowHeights.current.clear();
    listRef.current?.resetAfterIndex(0);
  }, []);

  return {
    expandedItems,
    toggleExpanded,
    getRowHeight,
    listRef,
    clearCache,
  };
};
