import { useEffect, useRef, useState } from 'react';

export interface PickerKeyboardNavOptions<T> {
  items: T[];
  isOpen: boolean;
  pickerRef: React.RefObject<HTMLElement>;
  onSelect: (item: T) => void;
  onClose: () => void;
  onTabSelect?: (item: T) => void;
  additionalKeys?: {
    key: string;
    handler: (event: KeyboardEvent, selectedIndex: number, items: T[]) => void;
  }[];
  enableLogging?: boolean;
  componentName?: string;
}

export interface PickerKeyboardNavResult {
  selectedIndex: number;
  setSelectedIndex: (index: number | ((prev: number) => number)) => void;
}

/**
 * Shared keyboard navigation hook for picker components
 *
 * Provides consistent keyboard navigation behavior across:
 * - SlashCommands
 * - FileMentions
 * - Git Repository Picker (AddProjectModal)
 *
 * Features:
 * - ArrowUp/ArrowDown navigation with wrapping
 * - Enter key selection
 * - Escape key to close
 * - Optional Tab key handling
 * - DOM containment validation
 * - Event propagation control
 * - Debug logging support
 *
 * @example
 * ```tsx
 * const { selectedIndex, setSelectedIndex } = usePickerKeyboardNav({
 *   items: filteredItems,
 *   isOpen: isPickerOpen,
 *   pickerRef: pickerRef,
 *   onSelect: handleSelect,
 *   onClose: handleClose,
 *   onTabSelect: handleTabSelect, // optional
 *   enableLogging: true,
 *   componentName: 'MyPicker',
 * });
 * ```
 */
export function usePickerKeyboardNav<T>({
  items,
  isOpen,
  pickerRef,
  onSelect,
  onClose,
  onTabSelect,
  additionalKeys = [],
  enableLogging = false,
  componentName = 'Picker',
}: PickerKeyboardNavOptions<T>): PickerKeyboardNavResult {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const isProcessingRef = useRef(false);

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items.length]);

  // Keyboard event handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent concurrent event processing
      if (isProcessingRef.current) {
        if (enableLogging) {
          console.log(`[${componentName}] Event already being processed, ignoring`);
        }
        return;
      }

      // CRITICAL: Only handle events if picker is mounted and visible in DOM
      if (!pickerRef.current || !document.body.contains(pickerRef.current)) {
        if (enableLogging) {
          console.log(`[${componentName}] Ignoring event - picker not mounted or not in DOM`);
        }
        return;
      }

      // No items to navigate
      if (items.length === 0) return;

      // Mark as processing
      isProcessingRef.current = true;

      let handled = false;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          event.stopPropagation();
          setSelectedIndex((prev) => {
            const newIndex = (prev + 1) % items.length;
            if (enableLogging) {
              console.log(`[${componentName}] ArrowDown: ${prev} -> ${newIndex}`);
            }
            return newIndex;
          });
          handled = true;
          break;

        case 'ArrowUp':
          event.preventDefault();
          event.stopPropagation();
          setSelectedIndex((prev) => {
            const newIndex = (prev - 1 + items.length) % items.length;
            if (enableLogging) {
              console.log(`[${componentName}] ArrowUp: ${prev} -> ${newIndex}`);
            }
            return newIndex;
          });
          handled = true;
          break;

        case 'Enter':
          event.preventDefault();
          event.stopPropagation();
          if (items[selectedIndex]) {
            if (enableLogging) {
              console.log(`[${componentName}] Enter: selecting index ${selectedIndex}`);
            }
            onSelect(items[selectedIndex]);
          }
          handled = true;
          break;

        case 'Escape':
          event.preventDefault();
          event.stopPropagation();
          if (enableLogging) {
            console.log(`[${componentName}] Escape: closing picker`);
          }
          onClose();
          handled = true;
          break;

        case 'Tab':
          if (onTabSelect) {
            event.preventDefault();
            event.stopPropagation();
            if (items[selectedIndex]) {
              if (enableLogging) {
                console.log(`[${componentName}] Tab: selecting index ${selectedIndex}`);
              }
              onTabSelect(items[selectedIndex]);
            }
            handled = true;
          }
          break;

        default:
          // Handle additional custom keys
          for (const customKey of additionalKeys) {
            if (event.key === customKey.key) {
              event.preventDefault();
              event.stopPropagation();
              customKey.handler(event, selectedIndex, items);
              handled = true;
              break;
            }
          }
      }

      // Reset processing flag after a small delay
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 10);

      if (!handled && enableLogging) {
        console.log(`[${componentName}] Key not handled:`, event.key);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      isProcessingRef.current = false;
    };
  }, [
    isOpen,
    items,
    selectedIndex,
    onSelect,
    onClose,
    onTabSelect,
    additionalKeys,
    enableLogging,
    componentName,
    pickerRef,
  ]);

  return { selectedIndex, setSelectedIndex };
}
