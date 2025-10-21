import { useState, useEffect, useRef, useCallback } from 'react';

export interface CommandMenuItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  category?: string;
  metadata: unknown;
}

export interface UseCommandMenuOptions {
  items: CommandMenuItem[];
  onSelect: (item: CommandMenuItem) => void;
  onClose: () => void;
  onTabComplete?: (item: CommandMenuItem) => void;
  isOpen: boolean;
}

export interface UseCommandMenuReturn {
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  itemRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
  handleKeyDown: (event: KeyboardEvent) => void;
  handleItemClick: (item: CommandMenuItem, index: number) => void;
  handleItemMouseEnter: (index: number) => void;
}

export const useCommandMenu = ({
  items,
  onSelect,
  onClose,
  onTabComplete,
  isOpen,
}: UseCommandMenuOptions): UseCommandMenuReturn => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  // Scroll selected item into view
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen || items.length === 0) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % items.length);
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
          break;
        case 'Enter':
          event.preventDefault();
          if (items[selectedIndex]) {
            onSelect(items[selectedIndex]);
          }
          break;
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
        case 'Tab':
          event.preventDefault();
          if (items[selectedIndex]) {
            if (onTabComplete) {
              onTabComplete(items[selectedIndex]);
            } else {
              onSelect(items[selectedIndex]);
            }
          }
          break;
      }
    },
    [items, selectedIndex, onSelect, onClose, onTabComplete, isOpen]
  );

  const handleItemClick = useCallback(
    (item: CommandMenuItem, index: number) => {
      setSelectedIndex(index);
      onSelect(item);
    },
    [onSelect]
  );

  const handleItemMouseEnter = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  return {
    selectedIndex,
    setSelectedIndex,
    itemRefs,
    handleKeyDown,
    handleItemClick,
    handleItemMouseEnter,
  };
};
