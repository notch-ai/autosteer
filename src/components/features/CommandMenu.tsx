import React, { useEffect, useRef } from 'react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '../ui/command';
import { useCommandMenu } from '../common/CommandMenu/useCommandMenu';
import type { CommandMenuItem } from '../common/CommandMenu/useCommandMenu';

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
  forceVisible?: boolean;
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
  forceVisible = false,
}) => {
  const commandRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { handleItemClick } = useCommandMenu({
    items,
    onSelect,
    onClose,
    ...(onTabComplete && { onTabComplete }),
    isOpen,
  });

  // Add keyboard event handling with DOM containment check (like SlashCommands pattern)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle events if this CommandMenu is mounted and visible in DOM
      if (!containerRef.current || !document.body.contains(containerRef.current)) {
        return;
      }

      // Handle keyboard navigation
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          event.stopPropagation();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Auto-focus the Command component when dropdown opens so it can receive keyboard events
  // BUT: Skip auto-focus when anchored to an element (like an input field) to preserve input focus
  useEffect(() => {
    if (isOpen && commandRef.current && !anchorRef) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        commandRef.current?.focus();
      }, 0);
    }
  }, [isOpen, anchorRef]);

  if (!isOpen && !forceVisible) {
    return null;
  }

  const defaultEmptyMessage = searchQuery
    ? `No commands found for "${searchQuery}"`
    : 'No commands available';

  const emptyMessage_ = emptyMessage || defaultEmptyMessage;

  const commandContent = (
    <Command
      ref={commandRef}
      className="rounded-lg shadow-md bg-popover outline-none w-full"
      shouldFilter={false}
      loop
      tabIndex={anchorRef ? -1 : 0}
    >
      <CommandList style={{ maxHeight: `${maxHeight}px` }} className="overflow-x-hidden">
        {items.length === 0 ? (
          <CommandEmpty>{emptyMessage_}</CommandEmpty>
        ) : (
          <CommandGroup className="overflow-hidden">
            {items.map((item) => (
              <CommandItem
                key={item.id}
                value={item.id}
                onSelect={() => handleItemClick(item)}
                className="flex items-center gap-2 cursor-pointer overflow-hidden"
                title={item.label}
              >
                {item.icon && <span className="flex-shrink-0 text-text-muted">{item.icon}</span>}
                <span className="flex-1 min-w-0 block overflow-hidden text-ellipsis whitespace-nowrap text-sm">
                  {item.label}
                </span>
                {item.description && (
                  <span className="flex-1 min-w-0 truncate text-sm text-text-muted">
                    {item.description}
                  </span>
                )}
                {item.shortcut && (
                  <div className="flex-shrink-0">
                    <CommandShortcut>{item.shortcut}</CommandShortcut>
                  </div>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );

  if (anchorRef && anchorRef.current) {
    const style: React.CSSProperties = {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: '4px',
      zIndex: 10000,
    };

    return (
      <div ref={containerRef} style={style} data-testid="command-menu">
        {commandContent}
      </div>
    );
  }

  const style = position
    ? {
        position: 'fixed' as const,
        top: `${position.top}px`,
        left: `${position.left}px`,
      }
    : {};

  return (
    <div ref={containerRef} style={style} data-testid="command-menu">
      {commandContent}
    </div>
  );
};

export { CommandMenuItem };
