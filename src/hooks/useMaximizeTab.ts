import { logger } from '@/commons/utils/logger';
import { useUIStore } from '@/stores';
import { useCallback } from 'react';

export interface UseMaximizeTabReturn {
  createMaximizeTab: (sessionId: string, projectId: string, sessionName?: string) => string | null;
  getMaximizeTabId: (sessionId: string) => string | null;
  hasMaximizeTab: (sessionId: string) => boolean;
  closeMaximizeTab: (sessionId: string) => void;
  switchSubTab: (sessionId: string, subTab: 'todos' | 'status' | 'trace') => void;
}

export function useMaximizeTab(): UseMaximizeTabReturn {
  const addMaximizeTabAction = useUIStore((state) => state.addMaximizeTab);
  const removeMaximizeTabAction = useUIStore((state) => state.removeMaximizeTab);
  const updateMaximizeTabAction = useUIStore((state) => state.updateMaximizeTab);
  const getMaximizeTabAction = useUIStore((state) => state.getMaximizeTab);

  const createMaximizeTab = useCallback(
    (sessionId: string, projectId: string, sessionName?: string) => {
      const existingTab = getMaximizeTabAction(sessionId);
      if (existingTab) {
        logger.warn('[useMaximizeTab] Tab already exists', {
          sessionId,
          existingTabId: existingTab.id,
        });
        return null;
      }

      try {
        addMaximizeTabAction(sessionId, projectId, '', sessionName ? { sessionName } : undefined);
      } catch (error) {
        logger.error('[useMaximizeTab] addMaximizeTabAction failed', { error });
        throw error;
      }

      const newTabId = `maximize-${sessionId}`;
      logger.info('[useMaximizeTab] Maximize tab created', { newTabId, sessionId, projectId });

      return newTabId;
    },
    [addMaximizeTabAction, getMaximizeTabAction]
  );

  const getMaximizeTabId = useCallback(
    (sessionId: string) => {
      const tab = getMaximizeTabAction(sessionId);
      return tab ? tab.id : null;
    },
    [getMaximizeTabAction]
  );

  const hasMaximizeTab = useCallback(
    (sessionId: string) => {
      return getMaximizeTabAction(sessionId) !== undefined;
    },
    [getMaximizeTabAction]
  );

  const closeMaximizeTab = useCallback(
    (sessionId: string) => {
      removeMaximizeTabAction(sessionId);
    },
    [removeMaximizeTabAction]
  );

  const switchSubTab = useCallback(
    (sessionId: string, subTab: 'todos' | 'status' | 'trace') => {
      updateMaximizeTabAction(sessionId, { activeSubTab: subTab });
    },
    [updateMaximizeTabAction]
  );

  return {
    createMaximizeTab,
    getMaximizeTabId,
    hasMaximizeTab,
    closeMaximizeTab,
    switchSubTab,
  };
}
