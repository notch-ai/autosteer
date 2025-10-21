import React, { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/commons/utils';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose?: () => void;
  position?: { top: number; left: number };
  trigger?: React.ReactNode;
  className?: string;
}

// Simplified emoji set - most commonly used emojis only
const emojiCategories = {
  'Recently Used': ['😀', '😊', '👍', '❤️', '🎉', '🚀', '✅', '🔥'],
  Smileys: [
    '😀',
    '😃',
    '😄',
    '😁',
    '😅',
    '😂',
    '🤣',
    '😊',
    '😇',
    '🙂',
    '😉',
    '😌',
    '😍',
    '🥰',
    '😘',
    '😋',
    '😎',
    '🤓',
    '🤔',
    '😐',
    '😑',
    '🙄',
    '😬',
    '😴',
    '😷',
    '🤒',
    '🤕',
    '🤢',
    '🥵',
    '🥶',
    '😵',
    '🤯',
    '🥳',
    '😕',
    '🙁',
    '😮',
    '😯',
    '😲',
    '😳',
    '🥺',
    '😦',
    '😧',
    '😨',
    '😰',
    '😥',
    '😢',
    '😭',
    '😱',
    '😖',
    '😣',
  ],
  Gestures: [
    '👍',
    '👎',
    '👌',
    '✌️',
    '🤞',
    '🤟',
    '🤘',
    '🤙',
    '👈',
    '👉',
    '👆',
    '🖕',
    '👇',
    '☝️',
    '👋',
    '🤚',
    '🖐️',
    '✋',
    '🖖',
    '👏',
    '🙌',
    '🤝',
    '🙏',
    '✍️',
    '💪',
    '🦾',
    '🦿',
    '🦵',
    '🦶',
    '👂',
  ],
  Objects: [
    '💻',
    '📱',
    '⌚',
    '📷',
    '📹',
    '🎥',
    '📞',
    '☎️',
    '📠',
    '📺',
    '📻',
    '🎙️',
    '🎚️',
    '🎛️',
    '⏰',
    '⏲️',
    '⏱️',
    '🕰️',
    '💡',
    '🔦',
    '🕯️',
    '🔥',
    '💰',
    '💳',
    '💎',
    '⚖️',
    '🔧',
    '🔨',
    '⚒️',
    '🛠️',
  ],
  Symbols: [
    '❤️',
    '🧡',
    '💛',
    '💚',
    '💙',
    '💜',
    '🖤',
    '🤍',
    '🤎',
    '💔',
    '❣️',
    '💕',
    '💞',
    '💓',
    '💗',
    '💖',
    '💘',
    '💝',
    '💟',
    '☮️',
    '✝️',
    '☪️',
    '🕉️',
    '☸️',
    '✡️',
    '🔯',
    '🕎',
    '☯️',
    '☦️',
    '🛐',
    '⭐',
    '🌟',
    '✨',
    '⚡',
    '☄️',
    '💫',
    '🌙',
    '☀️',
    '🌞',
    '🪐',
  ],
};

const EmojiPicker: React.FC<EmojiPickerProps> = ({
  onEmojiSelect,
  onClose,
  position,
  trigger,
  className,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Recently Used');

  // Flatten all emojis for search
  const allEmojis = useMemo(() => {
    return Object.values(emojiCategories).flat();
  }, []);

  // Filter emojis based on search query
  const filteredEmojis = useMemo(() => {
    if (!searchQuery.trim()) {
      return emojiCategories[selectedCategory as keyof typeof emojiCategories] || [];
    }

    // Simple search - could be enhanced with emoji names/keywords
    return allEmojis.filter(
      (emoji) => emoji.includes(searchQuery) // Basic fallback
    );
  }, [searchQuery, selectedCategory, allEmojis]);

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    onClose?.();
  };

  const categoryTabs = Object.keys(emojiCategories);

  const content = (
    <div className={cn('w-80 h-96 p-4 bg-white border rounded-lg shadow-lg', className)}>
      {/* Search Input */}
      <div className="mb-3">
        <Input
          placeholder="Search emojis..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="text-sm"
        />
      </div>

      {/* Category Tabs */}
      {!searchQuery && (
        <div className="flex gap-1 mb-3 overflow-x-auto">
          {categoryTabs.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className="whitespace-nowrap text-sm"
            >
              {category}
            </Button>
          ))}
        </div>
      )}

      {/* Emoji Grid */}
      <ScrollArea className="h-64">
        <div className="grid grid-cols-8 gap-1 p-2">
          {filteredEmojis.map((emoji, index) => (
            <Button
              key={index}
              variant="ghost"
              size="icon"
              onClick={() => handleEmojiClick(emoji)}
              className="h-8 w-8 text-lg hover:bg-gray-100 p-0"
              title={emoji}
            >
              {emoji}
            </Button>
          ))}
        </div>

        {filteredEmojis.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            {searchQuery ? 'No emojis found' : 'No emojis in this category'}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  // If position is provided, render absolutely positioned
  if (position) {
    return (
      <div
        className="fixed z-50"
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        {content}
      </div>
    );
  }

  // If trigger is provided, use Popover
  if (trigger) {
    return (
      <Popover>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent className="p-0" align="start">
          {content}
        </PopoverContent>
      </Popover>
    );
  }

  // Default render
  return content;
};

export default EmojiPicker;
export { EmojiPicker };
export type { EmojiPickerProps };
