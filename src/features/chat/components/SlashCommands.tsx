import { cn } from '@/commons/utils';
import { Card } from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import React, { useEffect, useRef, useState } from 'react';
import { useSlashCommandLogic } from '@/components/common/useSlashCommandLogic';

interface SlashCommand {
  command: string;
  label: string;
  description: string;
  icon: string;
  action?: () => void;
  content?: string; // Full markdown content for Claude Code commands
}

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
 * Migrated to use shadcn/ui components while maintaining legacy API
 * Provides slash command selection with search and keyboard navigation
 */
export const SlashCommands: React.FC<SlashCommandsProps> = ({
  query = '',
  commands: providedCommands,
  onSelect,
  onClose,
  activeCommand,
  position,
  onTabSelect,
  className,
}) => {
  console.log('[SlashCommands] Component render', {
    query,
    queryLength: query.length,
    hasTrailingSpace: query.endsWith(' '),
    providedCommands: !!providedCommands,
  });

  const [selectedIndex, setSelectedIndex] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [, setMenuHeight] = useState<number>(0);

  // Use provided commands or fetch from logic hook
  const { filteredCommands: hookCommands } = useSlashCommandLogic(query);
  const filteredCommands = providedCommands || hookCommands;

  console.log('[SlashCommands] After useSlashCommandLogic', {
    filteredCommandsCount: filteredCommands.length,
    willReturnNull: !filteredCommands || filteredCommands.length === 0,
  });

  // Reset selection when commands change
  useEffect(() => {
    setSelectedIndex(0);
    // If activeCommand is provided, find its index
    if (activeCommand && filteredCommands) {
      const index = filteredCommands.findIndex(
        (cmd: SlashCommand) => cmd.command === activeCommand.command
      );
      if (index >= 0) {
        setSelectedIndex(index);
      }
    }
  }, [filteredCommands, activeCommand]);

  // Calculate menu height after render
  useEffect(() => {
    if (pickerRef.current) {
      const height = pickerRef.current.scrollHeight;
      setMenuHeight(height);
    }
  }, [filteredCommands]);

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
  }, [selectedIndex, filteredCommands.length]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle events if this component is mounted and visible
      if (!pickerRef.current || !document.body.contains(pickerRef.current)) {
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          event.stopPropagation();
          const newDownIndex = (selectedIndex + 1) % filteredCommands.length;
          setSelectedIndex(newDownIndex);
          break;
        case 'ArrowUp':
          event.preventDefault();
          event.stopPropagation();
          const newUpIndex =
            (selectedIndex - 1 + filteredCommands.length) % filteredCommands.length;
          setSelectedIndex(newUpIndex);
          break;
        case 'Enter':
          event.preventDefault();
          event.stopPropagation();
          if (filteredCommands[selectedIndex]) {
            onSelect(filteredCommands[selectedIndex]);
          }
          break;
        case 'Escape':
          event.preventDefault();
          event.stopPropagation();
          onClose();
          break;
        case 'Tab':
          event.preventDefault();
          event.stopPropagation();
          if (filteredCommands[selectedIndex]) {
            // Use onTabSelect if provided, otherwise use onSelect
            if (onTabSelect) {
              onTabSelect(filteredCommands[selectedIndex]);
            } else {
              onSelect(filteredCommands[selectedIndex]);
            }
            // Close the menu after tab selection (same as Enter behavior)
            onClose();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedIndex, filteredCommands, onSelect, onClose, onTabSelect]);

  // Handle clicks outside the picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

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
    console.log('[SlashCommands] No commands found - returning null');
    // Don't render anything if no commands found to avoid flash during Tab completion
    return null;
  }

  console.log('[SlashCommands] Rendering menu with commands', {
    count: filteredCommands.length,
  });

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
                value={command.command}
                data-index={index}
                data-selected={index === selectedIndex}
                onSelect={() => onSelect(command)}
                className={cn(
                  'flex items-start px-2 py-1.5',
                  index === selectedIndex && 'bg-accent text-accent-foreground'
                )}
                onMouseEnter={() => setSelectedIndex(index)}
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
