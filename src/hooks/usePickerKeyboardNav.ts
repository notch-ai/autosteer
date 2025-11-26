import { useEffect, useState } from 'react';

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
 * - Git Repository Picker (AddProjectModal)
 *
 * Features:
 * - ArrowUp/ArrowDown navigation with wrapping
 * - Enter key selection
 * - Escape key to close
 * - Optional Tab key handling
 * - Uses document-level keyboard listeners (required because focus is on input field)
 * - Debug logging support
 *
 * @example
 * ```tsx
 * const { selectedIndex, setSelectedIndex } = usePickerKeyboardNav({
 *   items: filteredItems,
 *   isOpen: isPickerOpen,
 *   pickerRef,
 *   onSelect: handleSelect,
 *   onClose: handleClose,
 *   onTabSelect: handleTabSelect, // optional
 *   enableLogging: true,
 *   componentName: 'MyPicker',
 * });
 *
 * // Render with className-based highlighting
 * <Command shouldFilter={false} loop={false}>
 *   {items.map((item, index) => (
 *     <CommandItem
 *       className={index === selectedIndex ? 'bg-accent text-accent-foreground' : ''}
 *       onMouseEnter={() => setSelectedIndex(index)}
 *     />
 *   ))}
 * </Command>
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
  // Start with first item (0) selected by default
  // Mouse hover will immediately supersede this
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection to first item (0) when items change (new search results)
  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  // Document-level keyboard handler
  // REQUIRED: Focus is on input field, not picker, so Command's onKeyDown won't fire
  useEffect(() => {
    if (!isOpen || items.length === 0) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if picker is open and visible
      if (!pickerRef || !pickerRef.current) return;

      // IMPORTANT: Never intercept text editing keys - let them pass through to editor
      // This fixes Backspace/Delete not working during file mention
      if (event.key === 'Backspace' || event.key === 'Delete') {
        return; // Let the event propagate naturally to CodeMirror
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          event.stopPropagation();
          setSelectedIndex((prev) => {
            const newIndex = (prev + 1) % items.length;
            return newIndex;
          });
          break;

        case 'ArrowUp':
          event.preventDefault();
          event.stopPropagation();
          setSelectedIndex((prev) => {
            const newIndex = (prev - 1 + items.length) % items.length;
            return newIndex;
          });
          break;

        case 'Enter':
          event.preventDefault();
          event.stopPropagation();
          if (items[selectedIndex]) {
            onSelect(items[selectedIndex]);
          }
          break;

        case 'Escape':
          event.preventDefault();
          onClose();
          break;

        case 'Tab':
          if (onTabSelect) {
            event.preventDefault();
            if (items[selectedIndex]) {
              onTabSelect(items[selectedIndex]);
            }
          }
          break;

        default:
          // Check additional keys
          // Note: handlers are responsible for calling event.preventDefault() if needed
          for (const { key, handler } of additionalKeys) {
            if (event.key === key) {
              handler(event, selectedIndex, items);
              break;
            }
          }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [
    isOpen,
    items,
    selectedIndex,
    pickerRef,
    onSelect,
    onClose,
    onTabSelect,
    additionalKeys,
    enableLogging,
    componentName,
  ]);

  return {
    selectedIndex,
    setSelectedIndex,
  };
}
