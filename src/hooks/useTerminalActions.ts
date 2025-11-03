/**
 * useTerminalActions Hook
 * React hook for terminal management actions from TerminalStore
 */

import { useTerminalStore } from '@/stores';

/**
 * Hook for accessing terminal management actions
 * Returns all terminal-related actions
 */
export function useTerminalActions() {
  const addTerminal = useTerminalStore((state) => state.addTerminal);
  const removeTerminal = useTerminalStore((state) => state.removeTerminal);
  const updateTerminal = useTerminalStore((state) => state.updateTerminal);
  const setActiveTerminal = useTerminalStore((state) => state.setActiveTerminal);
  const getTerminal = useTerminalStore((state) => state.getTerminal);
  const getTerminalCount = useTerminalStore((state) => state.getTerminalCount);
  const canCreateTerminal = useTerminalStore((state) => state.canCreateTerminal);
  const clearTerminals = useTerminalStore((state) => state.clearTerminals);

  // Session actions
  const saveTerminalSession = useTerminalStore((state) => state.saveTerminalSession);
  const getTerminalSession = useTerminalStore((state) => state.getTerminalSession);
  const removeTerminalSession = useTerminalStore((state) => state.removeTerminalSession);
  const hasTerminalSession = useTerminalStore((state) => state.hasTerminalSession);

  // Buffer state actions
  const saveBufferState = useTerminalStore((state) => state.saveBufferState);
  const getBufferState = useTerminalStore((state) => state.getBufferState);
  const removeBufferState = useTerminalStore((state) => state.removeBufferState);
  const hasBufferState = useTerminalStore((state) => state.hasBufferState);
  const clearAllBufferStates = useTerminalStore((state) => state.clearAllBufferStates);
  const getAllBufferStates = useTerminalStore((state) => state.getAllBufferStates);
  const getBufferMemoryUsage = useTerminalStore((state) => state.getBufferMemoryUsage);

  // Session state actions
  const saveSessionState = useTerminalStore((state) => state.saveSessionState);
  const getSessionState = useTerminalStore((state) => state.getSessionState);
  const removeSessionState = useTerminalStore((state) => state.removeSessionState);
  const hasSessionState = useTerminalStore((state) => state.hasSessionState);

  return {
    // Terminal actions
    addTerminal,
    removeTerminal,
    updateTerminal,
    setActiveTerminal,
    getTerminal,
    getTerminalCount,
    canCreateTerminal,
    clearTerminals,

    // Session actions
    saveTerminalSession,
    getTerminalSession,
    removeTerminalSession,
    hasTerminalSession,

    // Buffer state actions
    saveBufferState,
    getBufferState,
    removeBufferState,
    hasBufferState,
    clearAllBufferStates,
    getAllBufferStates,
    getBufferMemoryUsage,

    // Session state actions
    saveSessionState,
    getSessionState,
    removeSessionState,
    hasSessionState,
  };
}
