/**
 * Centralized keyboard shortcuts for the application
 */

import React from 'react';

export const KeyboardShortcuts = {
  // Modal shortcuts
  CLOSE_MODAL: 'Escape',

  // Form shortcuts
  SUBMIT_FORM: 'Enter',

  // Navigation shortcuts
  FOCUS_SEARCH: 'cmd+k',
  FOCUS_SEARCH_ALT: 'ctrl+k',

  // Project shortcuts
  NEW_PROJECT: 'cmd+n',
  NEW_PROJECT_ALT: 'ctrl+n',
  DELETE_PROJECT: 'cmd+d',
  DELETE_PROJECT_ALT: 'ctrl+d',

  // Chat shortcuts
  NEW_MESSAGE: 'cmd+enter',
  NEW_MESSAGE_ALT: 'ctrl+enter',

  // Application shortcuts
  TOGGLE_SIDEBAR: 'cmd+b',
  TOGGLE_SIDEBAR_ALT: 'ctrl+b',
  TOGGLE_DETAIL_PANEL: 'cmd+i',
  TOGGLE_DETAIL_PANEL_ALT: 'ctrl+i',

  // Tab navigation shortcuts
  TAB_1: 'cmd+1',
  TAB_1_ALT: 'ctrl+1',
  TAB_2: 'cmd+2',
  TAB_2_ALT: 'ctrl+2',
  TAB_3: 'cmd+3',
  TAB_3_ALT: 'ctrl+3',
  TAB_4: 'cmd+4',
  TAB_4_ALT: 'ctrl+4',
  TAB_5: 'cmd+5',
  TAB_5_ALT: 'ctrl+5',
  NEW_TAB: 'cmd+t',
  NEW_TAB_ALT: 'ctrl+t',
  CLOSE_TAB: 'cmd+w',
  CLOSE_TAB_ALT: 'ctrl+w',

  // Tab cycling shortcuts
  PREV_TAB: 'cmd+alt+arrowleft',
  PREV_TAB_ALT: 'ctrl+alt+arrowleft',
  NEXT_TAB: 'cmd+alt+arrowright',
  NEXT_TAB_ALT: 'ctrl+alt+arrowright',

  // Chat focus shortcuts
  FOCUS_CHAT_INPUT: 'cmd+alt+enter',
  FOCUS_CHAT_INPUT_ALT: 'ctrl+alt+enter',
} as const;

/**
 * Helper function to check if a keyboard event matches a shortcut
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts[parts.length - 1];

  // Check modifiers
  const hasCmd = parts.includes('cmd');
  const hasCtrl = parts.includes('ctrl');
  const hasShift = parts.includes('shift');
  const hasAlt = parts.includes('alt');

  // Platform-specific command key
  const isMac = navigator.platform.toLowerCase().includes('mac');
  const cmdPressed = isMac ? event.metaKey : event.ctrlKey;

  // Check if all required modifiers are pressed
  if (hasCmd && !cmdPressed) return false;
  if (hasCtrl && !event.ctrlKey) return false;
  if (hasShift && !event.shiftKey) return false;
  if (hasAlt && !event.altKey) return false;

  // Check the main key - handle arrow keys specially
  const eventKey = event.key.toLowerCase();

  // Arrow key normalization (event.key is "ArrowLeft", but shortcut might use "arrowleft" or "left")
  if (eventKey === 'arrowleft' && (key === 'arrowleft' || key === 'left')) return true;
  if (eventKey === 'arrowright' && (key === 'arrowright' || key === 'right')) return true;
  if (eventKey === 'arrowup' && (key === 'arrowup' || key === 'up')) return true;
  if (eventKey === 'arrowdown' && (key === 'arrowdown' || key === 'down')) return true;

  return eventKey === key;
}

/**
 * Hook to use keyboard shortcuts
 */
export function useKeyboardShortcut(
  shortcut: string | string[],
  callback: (event: KeyboardEvent) => void,
  options?: {
    enabled?: boolean;
    preventDefault?: boolean;
    stopPropagation?: boolean;
  }
): void {
  const { enabled = true, preventDefault = true, stopPropagation = false } = options || {};

  React.useEffect(() => {
    if (!enabled) {
      return () => {}; // Return empty cleanup function
    }

    const shortcuts = Array.isArray(shortcut) ? shortcut : [shortcut];

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const s of shortcuts) {
        const matches = matchesShortcut(event, s);
        if (matches) {
          if (preventDefault) event.preventDefault();
          if (stopPropagation) event.stopPropagation();
          callback(event);
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, shortcut, callback, preventDefault, stopPropagation]);
}
