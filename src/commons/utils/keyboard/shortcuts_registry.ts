/**
 * Centralized keyboard shortcuts registry for the entire application
 * This consolidates all shortcuts with their descriptions and categories
 */

export interface Shortcut {
  id: string;
  keys: string[];
  description: string;
  when?: string;
}

export interface ShortcutGroup {
  id: string;
  name: string;
  description: string;
  shortcuts: Shortcut[];
}

/**
 * Complete registry organized by groups based on existing shortcuts in codebase
 */
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    id: 'project',
    name: 'Project',
    description: 'Project management',
    shortcuts: [
      {
        id: 'new-project',
        keys: ['cmd+n', 'ctrl+n'],
        description: 'Create new project',
      },
      {
        id: 'prev-project',
        keys: ['alt+arrowup'],
        description: 'Switch to previous project',
      },
      {
        id: 'next-project',
        keys: ['alt+arrowdown'],
        description: 'Switch to next project',
      },
    ],
  },
  {
    id: 'navigation',
    name: 'Navigation',
    description: 'Navigate between tabs',
    shortcuts: [
      {
        id: 'new-tab',
        keys: ['cmd+t', 'ctrl+t'],
        description: 'Open new session tab',
      },
      {
        id: 'close-tab',
        keys: ['cmd+w', 'ctrl+w'],
        description: 'Close current session tab',
      },
      {
        id: 'rename-tab',
        keys: ['cmd+l', 'ctrl+l'],
        description: 'Rename current session tab',
      },
      {
        id: 'next-tab',
        keys: ['cmd+alt+arrowright', 'ctrl+alt+arrowright'],
        description: 'Cycle to next tab',
      },
      {
        id: 'prev-tab',
        keys: ['cmd+alt+arrowleft', 'ctrl+alt+arrowleft'],
        description: 'Cycle to previous tab',
      },
    ],
  },
  {
    id: 'chat',
    name: 'Chat & Messaging',
    description: 'Chat and communication features',
    shortcuts: [
      {
        id: 'focus-chat-input',
        keys: ['cmd+alt+enter', 'ctrl+alt+enter'],
        description: 'Focus on chat input',
      },
      {
        id: 'send-message',
        keys: ['enter'],
        description: 'Send message',
        when: 'In chat input',
      },
      {
        id: 'new-line',
        keys: ['shift+enter'],
        description: 'Insert new line',
        when: 'In chat input',
      },
      {
        id: 'cancel-operation',
        keys: ['esc esc'],
        description: 'Cancel ongoing Claude Code operation',
        when: 'During streaming',
      },
      { id: 'mention', keys: ['@'], description: 'Mention file', when: 'In chat input' },
      { id: 'command', keys: ['/'], description: 'Mention command', when: 'In chat input' },
    ],
  },
  {
    id: 'general',
    name: 'General',
    description: 'General application shortcuts',
    shortcuts: [
      { id: 'close-dialog', keys: ['escape'], description: 'Close dialog/modal' },
      { id: 'submit-form', keys: ['enter'], description: 'Submit form', when: 'In form' },
      { id: 'show-shortcuts', keys: ['cmd+/', 'ctrl+/'], description: 'Show keyboard shortcuts' },
    ],
  },
];

/**
 * Format shortcut keys for display based on platform (VS Code style)
 */
export function formatShortcutKeys(keys: string[]): string[] {
  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');

  return keys.map((key) => {
    // Don't format slash commands or @ symbols
    if (key.startsWith('/') || key.startsWith('@')) return key;

    return key
      .split('+')
      .map((part) => {
        const p = part.toLowerCase().trim();
        if (p === 'cmd' || p === 'meta') return isMac ? '⌘' : 'Ctrl';
        if (p === 'ctrl') return isMac ? '⌃' : 'Ctrl';
        if (p === 'win') return 'Win';
        if (p === 'alt' || p === 'option') return isMac ? '⌥' : 'Alt';
        if (p === 'shift') return 'Shift';
        if (p === 'enter' || p === 'return') return 'Enter';
        if (p === 'escape' || p === 'esc') return 'Esc';
        if (p === 'backspace' || p === 'delete') return 'Backspace';
        if (p === 'tab') return 'Tab';
        if (p === 'space') return 'Space';
        if (p === 'arrowup' || p === 'up') return '↑';
        if (p === 'arrowdown' || p === 'down') return '↓';
        if (p === 'arrowleft' || p === 'left') return '←';
        if (p === 'arrowright' || p === 'right') return '→';
        // Capitalize single letters
        if (p.length === 1) return p.toUpperCase();
        return p;
      })
      .join('+');
  });
}

/**
 * Search shortcuts by query
 */
export function searchShortcuts(query: string): ShortcutGroup[] {
  const lowerQuery = query.toLowerCase();

  return SHORTCUT_GROUPS.map((group) => ({
    ...group,
    shortcuts: group.shortcuts.filter(
      (shortcut) =>
        shortcut.description.toLowerCase().includes(lowerQuery) ||
        shortcut.keys.some((key) => key.toLowerCase().includes(lowerQuery)) ||
        group.name.toLowerCase().includes(lowerQuery)
    ),
  })).filter((group) => group.shortcuts.length > 0);
}

/**
 * Get total shortcut count
 */
export function getTotalShortcutCount(): number {
  return SHORTCUT_GROUPS.reduce((total, group) => total + group.shortcuts.length, 0);
}
