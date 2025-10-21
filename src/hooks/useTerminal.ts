import { useCallback, useRef, useEffect } from 'react';
import {
  Terminal,
  TerminalCreateParams,
  TerminalData,
  TerminalResponse,
  TerminalCreateResponse,
} from '@/types/terminal.types';
import { useTerminalPool } from '../renderer/hooks/useTerminalPool';

/**
 * useTerminal Hook - Phase 2 Refactored for Instance Pooling
 *
 * Provides terminal operations with integrated pooling support.
 *
 * Key Changes:
 * - Integrates with useTerminalPool for instance pooling
 * - Maintains IPC communication for backend operations
 * - Supports terminal lifecycle decoupling from component lifecycle
 *
 * Usage:
 * ```tsx
 * const { createTerminal, writeToTerminal, setupTerminalListeners } = useTerminal();
 *
 * // Create terminal (automatically added to pool)
 * const terminal = await createTerminal(params);
 *
 * // Write to terminal via IPC
 * await writeToTerminal(terminalId, data);
 * ```
 *
 * @see docs/terminal-persistence-architecture.md Phase 2
 */
export const useTerminal = () => {
  const listenersRef = useRef<Set<string>>(new Set());
  const { getPoolSize, getAllTerminalIds } = useTerminalPool();

  /**
   * Convert TerminalData from IPC to Terminal object
   */
  const convertTerminalData = useCallback((data: TerminalData): Terminal => {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      lastAccessed: new Date(data.lastAccessed),
    };
  }, []);

  /**
   * Create a new terminal (with pool awareness)
   */
  const createTerminal = useCallback(
    async (params?: TerminalCreateParams): Promise<Terminal> => {
      console.log('[useTerminal] Creating terminal (pooling enabled)', {
        poolSize: getPoolSize(),
        maxPoolSize: 10,
      });

      const response: TerminalCreateResponse = await window.electron.ipc.invoke(
        'terminal:create',
        params
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create terminal');
      }

      const terminal = convertTerminalData(response.data);

      console.log('[useTerminal] Terminal created', {
        terminalId: terminal.id,
        poolSize: getPoolSize(),
      });

      return terminal;
    },
    [convertTerminalData, getPoolSize]
  );

  /**
   * Write data to terminal
   */
  const writeToTerminal = useCallback(async (terminalId: string, data: string): Promise<void> => {
    console.log('[useTerminal] writeToTerminal called:', {
      terminalId,
      data,
      dataLength: data.length,
      charCodes: Array.from(data).map((c) => c.charCodeAt(0)),
    });

    const response: TerminalResponse = await window.electron.ipc.invoke('terminal:write', {
      terminalId,
      data,
    });

    console.log('[useTerminal] writeToTerminal response:', response);

    if (!response.success) {
      throw new Error(response.error || 'Failed to write to terminal');
    }
  }, []);

  /**
   * Resize terminal
   */
  const resizeTerminal = useCallback(
    async (terminalId: string, cols: number, rows: number): Promise<void> => {
      const response: TerminalResponse = await window.electron.ipc.invoke('terminal:resize', {
        terminalId,
        cols,
        rows,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to resize terminal');
      }
    },
    []
  );

  /**
   * Destroy terminal (IPC + pool cleanup)
   */
  const destroyTerminal = useCallback(
    async (terminalId: string): Promise<void> => {
      console.log('[useTerminal] Destroying terminal (pooling enabled)', {
        terminalId,
        poolSize: getPoolSize(),
      });

      const response: TerminalResponse = await window.electron.ipc.invoke(
        'terminal:destroy',
        terminalId
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to destroy terminal');
      }

      console.log('[useTerminal] Terminal destroyed', {
        terminalId,
        remainingInPool: getPoolSize(),
      });
    },
    [getPoolSize]
  );

  /**
   * Set up terminal event listeners
   */
  const setupTerminalListeners = useCallback(
    (
      terminalId: string,
      onData: (data: string) => void,
      onExit: (exitCode: { exitCode: number; signal?: number }) => void
    ) => {
      const dataChannel = `terminal:data:${terminalId}`;
      const exitChannel = `terminal:exit:${terminalId}`;

      console.log('[useTerminal] setupTerminalListeners called for:', terminalId);

      // Remove any existing listeners first to prevent duplicates
      console.log('[useTerminal] Removing existing listeners for:', dataChannel);
      window.electron.ipcRenderer.removeAllListeners(dataChannel);
      window.electron.ipcRenderer.removeAllListeners(exitChannel);

      // Set up data listener
      console.log('[useTerminal] Adding new data listener for:', dataChannel);
      window.electron.ipc.on(dataChannel, (_event, data) => {
        console.log('[useTerminal] Data received on channel:', dataChannel, 'data:', data);
        onData(data as string);
      });
      listenersRef.current.add(dataChannel);

      // Set up exit listener
      window.electron.ipc.on(exitChannel, (_event, exitCode) =>
        onExit(exitCode as { exitCode: number; signal?: number })
      );
      listenersRef.current.add(exitChannel);
      console.log('[useTerminal] Listeners setup complete for:', terminalId);
    },
    []
  );

  /**
   * Remove terminal listeners
   */
  const removeTerminalListeners = useCallback((terminalId: string) => {
    const dataChannel = `terminal:data:${terminalId}`;
    const exitChannel = `terminal:exit:${terminalId}`;

    window.electron.ipcRenderer.removeAllListeners(dataChannel);
    window.electron.ipcRenderer.removeAllListeners(exitChannel);

    listenersRef.current.delete(dataChannel);
    listenersRef.current.delete(exitChannel);
  }, []);

  /**
   * Cleanup all listeners on unmount
   */
  useEffect(() => {
    return () => {
      listenersRef.current.forEach((channel) => {
        window.electron.ipcRenderer.removeAllListeners(channel);
      });
      listenersRef.current.clear();
    };
  }, []);

  /**
   * Get pool statistics (for debugging/monitoring)
   */
  const getPoolStats = useCallback(() => {
    return {
      poolSize: getPoolSize(),
      terminalIds: getAllTerminalIds(),
      maxPoolSize: 10,
      availableSlots: 10 - getPoolSize(),
    };
  }, [getPoolSize, getAllTerminalIds]);

  return {
    // IPC operations
    createTerminal,
    writeToTerminal,
    resizeTerminal,
    destroyTerminal,

    // Event listeners
    setupTerminalListeners,
    removeTerminalListeners,

    // Pool stats (Phase 2)
    getPoolStats,
  };
};
