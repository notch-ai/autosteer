import { logger } from '@/commons/utils/logger';
import { useUIStore } from '@/stores';
import { useCallback, useState } from 'react';

/**
 *
 * Business logic handler for sidebar component operations.
 *
 * Key Features:
 * - Panel navigation (chat, agents, projects, settings)
 * - Active panel state management
 * - Collapse/expand toggle
 * - Preference persistence via UIStore
 * - Active item tracking per panel
 *
 * Architecture:
 * - Extracted from Sidebar.tsx for separation of concerns
 * - Integrates with UIStore for state persistence
 * - Provides callbacks for UI interactions
 *
 * Usage:
 * ```tsx
 * const {
 *   activePanel,
 *   isCollapsed,
 *   activeItem,
 *   navigate,
 *   toggleCollapse,
 *   setActiveItem,
 *   error,
 * } = useSidebarHandler();
 * ```
 *
 * @see docs/guides-architecture.md Handler Pattern
 */

export interface UseSidebarHandlerReturn {
  activePanel: 'chat' | 'agents' | 'projects' | 'settings';
  isCollapsed: boolean;
  activeItem: string | null;
  navigate: (panel: 'chat' | 'agents' | 'projects' | 'settings') => void;
  toggleCollapse: () => void;
  setActiveItem: (item: string | null) => void;
  error: string | null;
}

export class NavigationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NavigationError';
  }
}

export const useSidebarHandler = (): UseSidebarHandlerReturn => {
  const [activeItem, setActiveItemState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // UI Store state
  const activePanel = useUIStore((state) => state.activePanel);
  const isCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const setActivePanel = useUIStore((state) => state.setActivePanel);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  /**
   * navigate - Switch between sidebar panels
   *
   * Flow:
   * 1. Validate panel name
   * 2. Update active panel in UIStore
   * 3. Clear active item on panel switch
   * 4. Log navigation event
   *
   * Error Cases:
   * - Invalid panel name
   */
  const navigate = useCallback(
    (panel: 'chat' | 'agents' | 'projects' | 'settings'): void => {
      try {
        setError(null);

        const validPanels = ['chat', 'agents', 'projects', 'settings'] as const;
        if (!validPanels.includes(panel)) {
          throw new NavigationError(`Invalid panel: ${panel}`);
        }

        logger.debug('[useSidebarHandler] Navigating to panel', {
          from: activePanel,
          to: panel,
        });

        setActivePanel(panel);

        // Clear active item when switching panels
        if (panel !== activePanel) {
          setActiveItemState(null);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Navigation failed';
        setError(errorMessage);
        logger.error('[useSidebarHandler] Navigation error', {
          panel,
          error: errorMessage,
        });
      }
    },
    [activePanel, setActivePanel]
  );

  /**
   * toggleCollapse - Toggle sidebar collapse state
   *
   * Flow:
   * 1. Call UIStore toggleSidebar action
   * 2. Persist state to preferences
   * 3. Log toggle event
   */
  const toggleCollapse = useCallback((): void => {
    logger.debug('[useSidebarHandler] Toggling collapse', {
      wasCollapsed: isCollapsed,
    });

    toggleSidebar();
  }, [toggleSidebar, isCollapsed]);

  /**
   * setActiveItem - Track active item within current panel
   *
   * Flow:
   * 1. Update active item state
   * 2. Log item selection
   *
   * Use Cases:
   * - Highlight selected project
   * - Track active agent
   * - Mark selected setting
   */
  const setActiveItem = useCallback(
    (item: string | null): void => {
      logger.debug('[useSidebarHandler] Setting active item', {
        panel: activePanel,
        item: item?.substring(0, 8),
      });

      setActiveItemState(item);
    },
    [activePanel]
  );

  return {
    activePanel,
    isCollapsed,
    activeItem,
    navigate,
    toggleCollapse,
    setActiveItem,
    error,
  };
};
