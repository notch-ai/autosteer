import { useEffect } from 'react';
import { logger } from '@/commons/utils/logger';
import { useTerminalPool } from '@/renderer/hooks/useTerminalPool';
import { useTerminalStore } from '@/stores';

interface UseGlobalScrollShortcutsOptions {
  /** The currently active tab ID */
  activeTabId: string | null;
}

/**
 * Global keyboard shortcuts for scrolling the main panel
 *
 * Provides Home, End, Page Up, Page Down shortcuts that work regardless of focus.
 * Only scrolls the active tab to avoid interfering with inactive content.
 * Respects existing auto-scroll behavior (e.g., chat sticky-bottom).
 *
 * Uses DOM queries for chat/changes tabs and TerminalPoolManager for terminal tab.
 *
 * @example
 * useGlobalScrollShortcuts({ activeTabId: selectedAgentId });
 */
export const useGlobalScrollShortcuts = ({ activeTabId }: UseGlobalScrollShortcutsOptions) => {
  const { scrollToTop: terminalScrollToTop, scrollToBottom: terminalScrollToBottom } =
    useTerminalPool();
  const activeTerminalId = useTerminalStore((state) => state.activeTerminalId);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      // Only handle our scroll keys
      if (!['home', 'end', 'pageup', 'pagedown'].includes(key)) {
        return;
      }

      // Skip if user is in an input field (but NOT in terminal or active chat/changes tabs)
      const activeElement = document.activeElement;

      // Check if we're inside the active tab - if so, DON'T skip
      const parentWithAgentId = activeElement?.closest('[data-agent-id]');
      const parentAgentId = parentWithAgentId?.getAttribute('data-agent-id');
      const isInsideActiveTab = parentAgentId === activeTabId;

      if (!isInsideActiveTab) {
        // Not in active tab, so check for regular input fields and skip if found
        if (
          activeElement?.tagName === 'INPUT' ||
          activeElement?.tagName === 'TEXTAREA' ||
          activeElement?.getAttribute('contenteditable') === 'true' ||
          activeElement?.classList.contains('cm-content') // CodeMirror editor
        ) {
          logger.debug('[useGlobalScrollShortcuts] Skipping - user in input field', {
            parentAgentId,
            activeTabId,
          });
          return;
        }
      }

      // Skip if modal/dialog is open
      if (document.querySelector('[role="dialog"]')) {
        logger.debug('[useGlobalScrollShortcuts] Skipping - modal/dialog open');
        return;
      }

      // Skip if no active tab
      if (!activeTabId) {
        logger.debug('[useGlobalScrollShortcuts] Skipping - no active tab');
        return;
      }

      // Find the appropriate scroll container based on active tab
      let scrollContainer: HTMLElement | null = null;

      if (activeTabId === 'terminal-tab') {
        // Terminal tab - use TerminalPoolManager API instead of DOM scrolling
        // Page up/down use DOM scrolling (handled below), but Home/End use terminal API
        if (!activeTerminalId) {
          logger.debug('[useGlobalScrollShortcuts] No active terminal ID');
          return;
        }

        // Prevent default browser scrolling
        event.preventDefault();
        event.stopPropagation();

        // Execute terminal scroll action using pool manager
        switch (key) {
          case 'home':
            try {
              terminalScrollToTop(activeTerminalId);
              logger.debug('[useGlobalScrollShortcuts] Terminal scrolled to top');
            } catch (error) {
              logger.error('[useGlobalScrollShortcuts] Failed to scroll terminal to top:', error);
            }
            return;

          case 'end':
            try {
              terminalScrollToBottom(activeTerminalId);
              logger.debug('[useGlobalScrollShortcuts] Terminal scrolled to bottom');
            } catch (error) {
              logger.error(
                '[useGlobalScrollShortcuts] Failed to scroll terminal to bottom:',
                error
              );
            }
            return;

          case 'pageup':
          case 'pagedown':
            // For page up/down, we still need to scroll the viewport
            const terminalElement = document.querySelector('[data-agent-id="terminal-tab"]');
            scrollContainer = terminalElement?.querySelector(
              '.xterm-viewport'
            ) as HTMLElement | null;
            if (!scrollContainer) {
              logger.debug('[useGlobalScrollShortcuts] Terminal .xterm-viewport not found');
              return;
            }
            // Fall through to handle page scrolling below
            break;
        }
      } else if (activeTabId === 'changes-tab') {
        // Changes tab - find the ScrollArea viewport in the right panel (diff viewer)
        // There are TWO ScrollAreas: left panel (file list) and right panel (diff viewer)
        // We want the diff viewer (right panel), which is the last one
        const changesElement = document.querySelector('[data-agent-id="changes-tab"]');
        const viewports = changesElement?.querySelectorAll('[data-radix-scroll-area-viewport]');

        // Get the last viewport (diff viewer on the right)
        if (viewports && viewports.length > 0) {
          scrollContainer = viewports[viewports.length - 1] as HTMLElement;
        }

        if (!scrollContainer) {
          logger.debug('[useGlobalScrollShortcuts] Changes ScrollArea viewport not found');
        }
      } else {
        // It's a chat tab - find the Radix ScrollArea viewport
        const chatElement = document.querySelector(`[data-agent-id="${activeTabId}"]`);
        scrollContainer = chatElement?.querySelector(
          '[data-radix-scroll-area-viewport]'
        ) as HTMLElement | null;

        if (!scrollContainer) {
          logger.debug(
            '[useGlobalScrollShortcuts] Chat ScrollArea viewport not found for:',
            activeTabId
          );
        }
      }

      if (!scrollContainer) {
        logger.debug('[useGlobalScrollShortcuts] No scroll container found for tab:', activeTabId);
        return;
      }

      // Prevent default browser scrolling
      event.preventDefault();
      event.stopPropagation();

      logger.debug('[useGlobalScrollShortcuts] Handling scroll shortcut:', {
        key,
        activeTabId,
        containerFound: !!scrollContainer,
      });

      // Execute scroll action
      switch (key) {
        case 'home':
          scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
          logger.debug('[useGlobalScrollShortcuts] Scrolled to top');
          break;

        case 'end':
          scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
          logger.debug('[useGlobalScrollShortcuts] Scrolled to bottom');
          break;

        case 'pageup': {
          const pageHeight = scrollContainer.clientHeight;
          scrollContainer.scrollBy({ top: -pageHeight, behavior: 'smooth' });
          logger.debug('[useGlobalScrollShortcuts] Scrolled page up:', { pageHeight });
          break;
        }

        case 'pagedown': {
          const pageHeight = scrollContainer.clientHeight;
          scrollContainer.scrollBy({ top: pageHeight, behavior: 'smooth' });
          logger.debug('[useGlobalScrollShortcuts] Scrolled page down:', { pageHeight });
          break;
        }
      }
    };

    // Use capture phase to intercept before other handlers
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [activeTabId, activeTerminalId, terminalScrollToTop, terminalScrollToBottom]);
};
