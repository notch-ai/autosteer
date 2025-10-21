import React from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutCategory {
  title: string;
  shortcuts: Array<{
    keys: string;
    description: string;
  }>;
}

const shortcutCategories: ShortcutCategory[] = [
  {
    title: 'Text Formatting',
    shortcuts: [
      { keys: 'Ctrl+B', description: 'Bold text' },
      { keys: 'Ctrl+I', description: 'Italic text' },
      { keys: 'Ctrl+U', description: 'Strikethrough text' },
      { keys: 'Ctrl+K', description: 'Insert link' },
      { keys: 'Ctrl+\\', description: 'Clear formatting' },
    ],
  },
  {
    title: 'Block Formatting',
    shortcuts: [
      { keys: 'Ctrl+Alt+1', description: 'Heading 1' },
      { keys: 'Ctrl+Alt+2', description: 'Heading 2' },
      { keys: 'Ctrl+Alt+3', description: 'Heading 3' },
      { keys: 'Ctrl+Shift+>', description: 'Blockquote' },
      { keys: 'Ctrl+Shift+C', description: 'Code block' },
    ],
  },
  {
    title: 'Lists',
    shortcuts: [
      { keys: '/bullet', description: 'Bullet list' },
      { keys: '/number', description: 'Numbered list' },
      { keys: '/task', description: 'Task list' },
    ],
  },
  {
    title: 'Slash Commands',
    shortcuts: [
      { keys: '/code', description: 'Inline code' },
      { keys: '/h1, /h2, /h3', description: 'Headings' },
      { keys: '/quote', description: 'Blockquote' },
      { keys: '/divider', description: 'Horizontal rule' },
      { keys: '/link', description: 'Insert link' },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { keys: 'Enter', description: 'Send message' },
      { keys: 'Shift+Enter', description: 'New line' },
      { keys: '@', description: 'Mention someone' },
      { keys: 'Esc', description: 'Close pickers/dialogs' },
    ],
  },
];

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  isOpen,
  onClose,
}) => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const formatKeys = (keys: string): string => {
    return keys
      .replace(/Ctrl/g, isMac ? '⌘' : 'Ctrl')
      .replace(/Alt/g, isMac ? '⌥' : 'Alt')
      .replace(/Shift/g, isMac ? '⇧' : 'Shift');
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} />

      {/* Dialog */}
      <div role="dialog" aria-labelledby="shortcuts-title">
        {/* Header */}
        <div>
          <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div>
          {shortcutCategories.map((category) => (
            <div key={category.title}>
              <h3>{category.title}</h3>
              <div>
                {category.shortcuts.map((shortcut, index) => (
                  <div key={index}>
                    <span>{formatKeys(shortcut.keys)}</span>
                    <span>{shortcut.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div>
          <p>
            Press <kbd>Esc</kbd> to close
          </p>
        </div>
      </div>
    </>
  );
};
