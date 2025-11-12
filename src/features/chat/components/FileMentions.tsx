import { cn } from '@/commons/utils';
import { Card } from '@/components/ui/card';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFileMentions, FileMention } from '@/hooks/useFileMentions';
import React from 'react';

export interface FileMentionsProps {
  query?: string;
  onSelect: (file: FileMention) => void;
  onTabSelect?: (file: FileMention) => void;
  onClose: () => void;
  position?: {
    top?: number;
    bottom?: number;
    left: number;
    width?: number;
    maxHeight?: number;
  };
  className?: string;
  projectPath?: string | undefined;
}

export const FileMentions: React.FC<FileMentionsProps> = ({
  query = '',
  onSelect,
  onTabSelect,
  onClose,
  position,
  className,
  projectPath,
}) => {
  // Use hook for ALL business logic - keyboard nav is handled internally
  const { filteredFiles, selectedIndex, setSelectedIndex, isLoading, pickerRef, scrollAreaRef } =
    useFileMentions({
      query,
      isOpen: true,
      ...(projectPath && { projectPath }),
      onSelect,
      onClose,
      ...(onTabSelect && { onTabSelect }),
    });

  const calculatePosition = (): React.CSSProperties => {
    if (!position) return {};

    const styles: React.CSSProperties = {
      position: 'fixed',
      left: `${position.left}px`,
      width: position.width ? `${position.width}px` : '600px',
      maxWidth: 'calc(100vw - 32px)',
      zIndex: 50,
    };

    // Handle bottom vs top positioning
    if (position.bottom !== undefined) {
      if (position.maxHeight) {
        styles.maxHeight = `${position.maxHeight}px`;
      }

      // Position from bottom (already calculated in parent)
      styles.bottom = `${position.bottom}px`;
    } else if (position.top !== undefined) {
      styles.top = `${position.top}px`;

      if (position.maxHeight) {
        styles.maxHeight = `${position.maxHeight}px`;
      }
    }

    return styles;
  };

  const positionStyles = calculatePosition();

  if (isLoading) {
    return (
      <Card
        ref={pickerRef}
        className={cn('p-4 bg-background border-border', className)}
        style={positionStyles}
      >
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-2 h-2 bg-primary rounded-full animate-bounce"></span>
          </div>
          <span className="text-sm text-muted-foreground">Loading files...</span>
        </div>
      </Card>
    );
  }

  if (filteredFiles.length === 0) {
    return (
      <Card
        ref={pickerRef}
        className={cn('p-2 bg-background border-border', className)}
        style={positionStyles}
      >
        <p className="text-sm text-muted-foreground text-center py-4">
          {query ? `No files matching "${query}"` : 'No files found'}
        </p>
      </Card>
    );
  }

  return (
    <Card
      ref={pickerRef}
      className={cn('p-0 overflow-hidden bg-background border-border w-full max-w-full', className)}
      style={positionStyles}
    >
      <Command className="border-0 bg-transparent w-full" loop={false} value="">
        <ScrollArea ref={scrollAreaRef} className="max-h-[300px] w-full">
          <CommandList className="bg-transparent !block w-full">
            <CommandGroup className="bg-transparent w-full">
              {filteredFiles.map((file, index) => (
                <CommandItem
                  key={file.path}
                  className={cn(
                    'px-2 py-1 !gap-0 overflow-hidden !grid grid-cols-[1fr_auto]',
                    index === selectedIndex && 'bg-accent text-accent-foreground'
                  )}
                  onSelect={() => onSelect(file)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  title={file.name}
                >
                  <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm">
                    @{file.name}
                  </span>
                  {file.isDirectory && <span className="text-sm text-muted-foreground">/</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </ScrollArea>
      </Command>
    </Card>
  );
};
