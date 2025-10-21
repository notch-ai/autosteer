import React, { useEffect } from 'react';
import { Popover, PopoverContent } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { useCommandMenu } from './useCommandMenu';
import type { CommandMenuItem } from './useCommandMenu';

export interface CommandMenuProps {
  items: CommandMenuItem[];
  isOpen: boolean;
  anchorRef?: React.RefObject<HTMLElement>;
  position?: { top: number; left: number };
  onSelect: (item: CommandMenuItem) => void;
  onClose: () => void;
  onTabComplete?: (item: CommandMenuItem) => void;
  searchQuery?: string;
  maxHeight?: number;
  emptyMessage?: string;
  className?: string;
}

export const CommandMenu: React.FC<CommandMenuProps> = ({
  items,
  isOpen,
  anchorRef,
  position,
  onSelect,
  onClose,
  onTabComplete,
  searchQuery = '',
  maxHeight = 270,
  emptyMessage,
}) => {
  const { selectedIndex, itemRefs, handleKeyDown, handleItemClick, handleItemMouseEnter } =
    useCommandMenu({
      items,
      onSelect,
      onClose,
      ...(onTabComplete && { onTabComplete }),
      isOpen,
    });

  // Handle keyboard events
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
    return undefined;
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  // Render empty state
  const defaultEmptyMessage = searchQuery
    ? `No commands found for "${searchQuery}"`
    : 'No commands available';

  const emptyMessage_ = emptyMessage || defaultEmptyMessage;

  const commandContent = (
    <Command className="rounded-lg border shadow-md">
      <CommandList style={{ maxHeight: `${maxHeight}px` }}>
        {items.length === 0 ? (
          <CommandEmpty>{emptyMessage_}</CommandEmpty>
        ) : (
          <CommandGroup>
            {items.map((item, index) => (
              <CommandItem
                key={item.id}
                ref={(el) => (itemRefs.current[index] = el as any)}
                onSelect={() => handleItemClick(item, index)}
                onMouseMove={() => handleItemMouseEnter(index)}
                data-selected={selectedIndex === index}
                className="flex items-center gap-2 cursor-pointer"
              >
                {item.icon && <span className="text-text-muted">{item.icon}</span>}
                <div className="flex-1 min-w-0">
                  <span className="block truncate text-sm">{item.label}</span>
                  {item.description && (
                    <span className="block text-sm text-text-muted truncate">
                      {item.description}
                    </span>
                  )}
                </div>
                {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );

  // Use Popover if anchor ref is provided
  if (anchorRef) {
    return (
      <Popover open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <PopoverContent
          className="p-0 w-auto"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div data-testid="command-menu">{commandContent}</div>
        </PopoverContent>
      </Popover>
    );
  }

  // Legacy position-based rendering
  const style = position
    ? {
        position: 'fixed' as const,
        top: `${position.top}px`,
        left: `${position.left}px`,
      }
    : {};

  return (
    <div style={style} data-testid="command-menu">
      {commandContent}
    </div>
  );
};

export { CommandMenuItem };
