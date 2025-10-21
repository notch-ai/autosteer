import React, { useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/commons/utils';

interface TextFormattingMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onFormatText: (format: string, value?: string) => void;
  position?: { top: number; left: number };
  anchorEl?: HTMLElement | null;
  className?: string;
}

interface FormatOption {
  label: string;
  value: string;
  icon?: React.ReactNode;
  shortcut?: string;
}

const textSizeOptions: FormatOption[] = [
  { label: 'Small', value: 'small' },
  { label: 'Normal', value: 'normal' },
  { label: 'Large', value: 'large' },
  { label: 'Heading 1', value: 'h1', shortcut: 'Ctrl+Alt+1' },
  { label: 'Heading 2', value: 'h2', shortcut: 'Ctrl+Alt+2' },
  { label: 'Heading 3', value: 'h3', shortcut: 'Ctrl+Alt+3' },
];

const textColorOptions: FormatOption[] = [
  {
    label: 'Default',
    value: 'default',
    icon: <div className="w-4 h-4 rounded border border-border bg-background" />,
  },
  {
    label: 'Red',
    value: 'red',
    icon: <div className="w-4 h-4 rounded bg-red-500" />,
  },
  {
    label: 'Orange',
    value: 'orange',
    icon: <div className="w-4 h-4 rounded bg-orange-500" />,
  },
  {
    label: 'Yellow',
    value: 'yellow',
    icon: <div className="w-4 h-4 rounded bg-yellow-500" />,
  },
  {
    label: 'Green',
    value: 'green',
    icon: <div className="w-4 h-4 rounded bg-green-500" />,
  },
  {
    label: 'Blue',
    value: 'blue',
    icon: <div className="w-4 h-4 rounded bg-blue-500" />,
  },
  {
    label: 'Purple',
    value: 'purple',
    icon: <div className="w-4 h-4 rounded bg-purple-500" />,
  },
  {
    label: 'Gray',
    value: 'gray',
    icon: <div className="w-4 h-4 rounded bg-gray-500" />,
  },
];

const additionalFormats: FormatOption[] = [
  { label: 'Clear Formatting', value: 'clear', shortcut: 'Ctrl+\\' },
  { label: 'Blockquote', value: 'blockquote', shortcut: 'Ctrl+Shift+>' },
  { label: 'Code Block', value: 'codeblock', shortcut: 'Ctrl+Shift+C' },
  { label: 'Horizontal Rule', value: 'hr' },
];

/**
 * Feature component for TextFormattingMenu
 * Migrated to use shadcn/ui components while maintaining legacy API
 * Provides text formatting options with keyboard shortcuts
 */
export const TextFormattingMenu: React.FC<TextFormattingMenuProps> = ({
  isOpen,
  onClose,
  onFormatText,
  position,
  anchorEl,
  className,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && menuRef.current) {
      // Position the menu relative to anchor element or use provided position
      if (anchorEl) {
        const rect = anchorEl.getBoundingClientRect();
        const menuRect = menuRef.current.getBoundingClientRect();

        let top = rect.bottom + 8;
        let left = rect.left;

        // Adjust if menu would go off screen
        if (left + menuRect.width > window.innerWidth) {
          left = window.innerWidth - menuRect.width - 16;
        }
        if (top + menuRect.height > window.innerHeight) {
          top = rect.top - menuRect.height - 8;
        }

        menuRef.current.style.top = `${top}px`;
        menuRef.current.style.left = `${left}px`;
      } else if (position) {
        menuRef.current.style.top = `${position.top}px`;
        menuRef.current.style.left = `${position.left}px`;
      }
    }
  }, [isOpen, anchorEl, position]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const handleFormatClick = (format: string, value?: string) => {
    onFormatText(format, value);
    if (format !== 'color') {
      // Keep color submenu open
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <Card
      ref={menuRef}
      className={cn('fixed z-50 w-80 p-2 shadow-lg', className)}
      data-testid="text-formatting-menu"
    >
      <div className="space-y-2">
        {/* Text Size Section */}
        <div>
          <h4 className="mb-2 px-2 text-sm font-semibold text-muted-foreground">Text Size</h4>
          <div className="space-y-1">
            {textSizeOptions.map((option) => (
              <Button
                key={option.value}
                variant="ghost"
                size="sm"
                className="w-full justify-between"
                onClick={() => handleFormatClick('size', option.value)}
              >
                <span>{option.label}</span>
                {option.shortcut && (
                  <span className="text-sm text-muted-foreground">{option.shortcut}</span>
                )}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Text Color Section */}
        <div>
          <h4 className="mb-2 px-2 text-sm font-semibold text-muted-foreground">Text Color</h4>
          <div className="grid grid-cols-8 gap-1 px-2">
            {textColorOptions.map((option) => (
              <Button
                key={option.value}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => handleFormatClick('color', option.value)}
                title={option.label}
              >
                {option.icon}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Additional Formatting Section */}
        <div>
          <h4 className="mb-2 px-2 text-sm font-semibold text-muted-foreground">
            Additional Formatting
          </h4>
          <div className="space-y-1">
            {additionalFormats.map((option) => (
              <Button
                key={option.value}
                variant="ghost"
                size="sm"
                className="w-full justify-between"
                onClick={() => handleFormatClick(option.value)}
              >
                <span>{option.label}</span>
                {option.shortcut && (
                  <span className="text-sm text-muted-foreground">{option.shortcut}</span>
                )}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};
