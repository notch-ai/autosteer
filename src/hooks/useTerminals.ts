/**
 * useTerminals Hook
 * React hook for accessing terminal sessions from TerminalStore
 */

import { useTerminalStore } from '@/stores';

/**
 * Hook for accessing terminal sessions state
 * Returns current terminals and active terminal
 */
export function useTerminals() {
  const terminals = useTerminalStore((state) => state.terminals);
  const activeTerminalId = useTerminalStore((state) => state.activeTerminalId);
  const maxTerminals = useTerminalStore((state) => state.maxTerminals);

  // Convert Map to array for easier consumption
  const terminalsArray = Array.from(terminals.values());

  // Get active terminal
  const activeTerminal = activeTerminalId ? terminals.get(activeTerminalId) : null;

  // Get terminal count and capacity check
  const terminalCount = terminals.size;
  const canCreate = terminalCount < maxTerminals;

  return {
    terminals: terminalsArray,
    terminalsMap: terminals,
    activeTerminal,
    activeTerminalId,
    terminalCount,
    maxTerminals,
    canCreate,
  };
}
