import { cn } from '@/commons/utils';
import { Card } from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { SlashCommand, useSlashCommands } from '@/hooks/useSlashCommands';
import React, { useEffect } from 'react';

export interface SlashCommandsProps {
  query?: string;
  commands?: SlashCommand[]; // For legacy support
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  activeCommand?: SlashCommand; // For legacy support
  position?: {
    top?: number;
    bottom?: number;
    left: number;
    width?: number;
    maxHeight?: number;
  };
  onTabSelect?: (command: SlashCommand) => void;
  className?: string;
}

/**
 * Feature component for SlashCommands
 * Migrated to use shadcn/ui components and useSlashCommands hook
 * Provides slash command selection with search and keyboard navigation
 * Follows the same pattern as FileMentions for consistency
 */
export const SlashCommands: React.FC<SlashCommandsProps> = ({
  query = '',
  commands: providedCommands,
  onSelect,
  onClose,
  activeCommand: _activeCommand,
  position,
  onTabSelect,
  className,
}) => {
  // Use hook for ALL business logic - keyboard nav is handled internally like FileMentions
  const {
    filteredCommands: hookCommands,
    selectedIndex,
    setSelectedIndex,
    pickerRef,
  } = useSlashCommands({
    query,
    isOpen: true,
    onSelect,
    onClose,
    ...(onTabSelect && { onTabSelect }),
  });

  // Use provided commands or fetch from hook
  const filteredCommands = providedCommands || hookCommands;

  // Auto-scroll to selected item when navigating with keyboard
  useEffect(() => {
    if (pickerRef.current && filteredCommands.length > 0) {
      // Find the selected item
      const selectedElement = pickerRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      ) as HTMLElement;

      if (selectedElement) {
        // Use scrollIntoView with block: 'nearest' to only scroll if needed
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [selectedIndex, filteredCommands.length, pickerRef]);

  // Calculate position styles
  const calculatePosition = () => {
    if (!position) return {};

    const styles: React.CSSProperties = {
      position: 'fixed',
      left: `${position.left}px`,
      width: position.width ? `${position.width}px` : 'auto',
      zIndex: 50,
    };

    // Handle bottom vs top positioning
    if (position.bottom !== undefined) {
      // Position above the cursor (for bottom anchor)
      if (position.maxHeight) {
        styles.maxHeight = `${position.maxHeight}px`;
      }

      // Position from bottom (already calculated in parent)
      styles.bottom = `${position.bottom}px`;
    } else if (position.top !== undefined) {
      // Position below the cursor (for top anchor)
      styles.top = `${position.top}px`;

      if (position.maxHeight) {
        styles.maxHeight = `${position.maxHeight}px`;
      }
    }

    return styles;
  };

  if (!filteredCommands || filteredCommands.length === 0) {
    // Don't render anything if no commands found to avoid flash during Tab completion
    return null;
  }

  return (
    <Card
      ref={pickerRef}
      className={cn('p-0 overflow-hidden bg-background border-border', className)}
      style={calculatePosition()}
      data-testid="slash-commands"
    >
      <Command className="border-0 bg-transparent" shouldFilter={false} loop={false} value="">
        <CommandList className="bg-transparent max-h-[350px] overflow-y-auto">
          {/* Empty component that renders nothing to prevent default "No commands found" message */}
          <CommandEmpty />
          <CommandGroup className="bg-transparent">
            {filteredCommands.map((command: SlashCommand, index: number) => (
              <CommandItem
                key={command.command}
                data-index={index}
                onSelect={() => onSelect(command)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={cn(
                  'flex items-start px-2 py-1.5',
                  // Override cmdk's internal selection styles completely
                  '[&[data-selected=true]]:bg-transparent [&[data-selected=true]]:text-foreground',
                  // Apply our manual selection styling
                  index === selectedIndex && 'bg-accent text-accent-foreground'
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm whitespace-nowrap flex-shrink-0">
                      /{command.command}
                    </span>
                    <span className="text-sm text-muted-foreground truncate">
                      - {command.description}
                    </span>
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </Card>
  );
};
