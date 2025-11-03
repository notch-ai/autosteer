import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAgentsStore } from '@/stores';
import { Command, CommandList, CommandGroup, CommandItem } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/commons/utils';
import { User, Hash, Bot } from 'lucide-react';

export interface MentionPickerProps {
  query: string;
  onSelect: (mention: { id: string; label: string; type: 'agent' | 'channel' | 'user' }) => void;
  onClose: () => void;
  position?: { top: number; left: number };
  className?: string;
}

interface MentionItem {
  id: string;
  label: string;
  type: 'agent' | 'channel' | 'user';
  description?: string;
}

// Mock data for channels and users - in a real app, these would come from the store
const mockChannels = [
  { id: 'general', label: 'general', type: 'channel' as const, description: 'General discussion' },
  { id: 'random', label: 'random', type: 'channel' as const, description: 'Random thoughts' },
  { id: 'ideas', label: 'ideas', type: 'channel' as const, description: 'Share your ideas' },
  { id: 'feedback', label: 'feedback', type: 'channel' as const, description: 'Product feedback' },
];

const mockUsers = [
  { id: 'john', label: 'John Doe', type: 'user' as const, description: 'Product Manager' },
  { id: 'jane', label: 'Jane Smith', type: 'user' as const, description: 'Designer' },
  { id: 'bob', label: 'Bob Johnson', type: 'user' as const, description: 'Developer' },
  { id: 'alice', label: 'Alice Williams', type: 'user' as const, description: 'Marketing Lead' },
];

/**
 * Feature component for MentionPicker
 * Migrated to use shadcn/ui components while maintaining legacy API
 * Provides mention selection for agents, channels, and users
 */
export const MentionPicker: React.FC<MentionPickerProps> = ({
  query,
  onSelect,
  onClose,
  position,
  className,
}): JSX.Element => {
  // Use a stable selector that returns the same reference if agents haven't changed
  const agentsMap = useAgentsStore((state) => state.agents);
  const agents = useMemo(() => Array.from(agentsMap.values()), [agentsMap]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredItems, setFilteredItems] = useState<MentionItem[]>([]);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Convert agents to mention items
  const agentItems: MentionItem[] = useMemo(
    () =>
      agents.map((agent) => ({
        id: agent.id,
        label: agent.title,
        type: 'agent' as const,
        description: agent.preview,
      })),
    [agents]
  );

  // Combine all mention items
  useEffect(() => {
    const allItems = [...agentItems, ...mockChannels, ...mockUsers];

    if (!query) {
      setFilteredItems(allItems.slice(0, 10)); // Show first 10 items
    } else {
      const filtered = allItems.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          (item.description && item.description.toLowerCase().includes(query.toLowerCase()))
      );
      setFilteredItems(filtered.slice(0, 10)); // Limit to 10 results
    }

    setSelectedIndex(0);
  }, [query, agentItems]);

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
          setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
          break;
        case 'ArrowUp':
          event.preventDefault();
          event.stopPropagation();
          setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
          break;
        case 'Enter':
          event.preventDefault();
          event.stopPropagation();
          if (filteredItems[selectedIndex]) {
            onSelect(filteredItems[selectedIndex]);
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
          if (filteredItems[selectedIndex]) {
            onSelect(filteredItems[selectedIndex]);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [filteredItems, selectedIndex, onSelect, onClose]);

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

  // Adjust position to prevent cut-off (legacy support)
  useEffect(() => {
    if (position && pickerRef.current) {
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const pickerHeight = 300;
      const pickerWidth = 320;
      const EDGE_PADDING = 20;

      let adjustedTop = position.top;
      let adjustedLeft = position.left;

      if (position.top + pickerHeight > viewportHeight - EDGE_PADDING) {
        adjustedTop = position.top - pickerHeight - 10;
        if (adjustedTop < EDGE_PADDING) {
          adjustedTop = EDGE_PADDING;
        }
      }

      if (position.left + pickerWidth > viewportWidth - EDGE_PADDING) {
        adjustedLeft = viewportWidth - pickerWidth - EDGE_PADDING;
        if (adjustedLeft < EDGE_PADDING) {
          adjustedLeft = EDGE_PADDING;
        }
      }

      pickerRef.current.style.position = 'fixed';
      pickerRef.current.style.top = `${adjustedTop}px`;
      pickerRef.current.style.left = `${adjustedLeft}px`;
      pickerRef.current.style.zIndex = '50';
    }
  }, [position]);

  const getIcon = (type: MentionItem['type']) => {
    switch (type) {
      case 'agent':
        return <Bot className="h-4 w-4" />;
      case 'channel':
        return <Hash className="h-4 w-4" />;
      case 'user':
        return <User className="h-4 w-4" />;
    }
  };

  const getVariant = (type: MentionItem['type']) => {
    switch (type) {
      case 'agent':
        return 'default';
      case 'channel':
        return 'secondary';
      case 'user':
        return 'outline';
    }
  };

  if (filteredItems.length === 0) {
    return (
      <div
        ref={pickerRef}
        className={cn(
          'fixed z-50 w-80 rounded-md border bg-popover p-2 text-popover-foreground shadow-md',
          className
        )}
        data-testid="mention-picker"
      >
        <p className="text-sm text-muted-foreground text-center py-6">No matches found</p>
      </div>
    );
  }

  return (
    <div
      ref={pickerRef}
      className={cn(
        'fixed z-50 w-80 rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none',
        className
      )}
      data-testid="mention-picker"
    >
      <Command className="border-0">
        <CommandList>
          <CommandGroup>
            {filteredItems.map((item, index) => (
              <CommandItem
                key={item.id}
                value={item.id}
                onSelect={() => onSelect(item)}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5',
                  index === selectedIndex && 'bg-accent'
                )}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="flex items-center gap-2 flex-1">
                  {getIcon(item.type)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{item.label}</span>
                      <Badge variant={getVariant(item.type)} className="text-sm">
                        {item.type}
                      </Badge>
                    </div>
                    {item.description && (
                      <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                    )}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
};
