import { logger } from '@/commons/utils/logger';
import {
  Terminal,
  TerminalCreateParams,
  TerminalCreateResponse,
  TerminalData,
  TerminalResponse,
} from '@/types/terminal.types';
import { useCallback, useEffect, useRef } from 'react';
import { useTerminalPool } from '../renderer/hooks/useTerminalPool';

/**
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
 * @see docs/terminal-persistence-architecture.md
 */
export const useTerminal = () => {
  const listenersRef = useRef<Map<string, () => void>>(new Map()); // Store cleanup functions
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
      const currentPoolSize = getPoolSize();
      const maxPoolSize = 10;

      logger.debug('[useTerminal] Creating terminal (pooling enabled)', {
        poolSize: currentPoolSize,
        maxPoolSize,
      });

      // Warn if approaching pool limit (8+ terminals)
      if (currentPoolSize >= 8) {
        logger.warn('[useTerminal] Approaching terminal pool limit', {
          currentSize: currentPoolSize,
          maxSize: maxPoolSize,
          availableSlots: maxPoolSize - currentPoolSize,
        });
      }

      const response: TerminalCreateResponse = await window.electron.ipc.invoke(
        'terminal:create',
        params
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create terminal');
      }

      const terminal = convertTerminalData(response.data);

      const newPoolSize = getPoolSize();

      logger.debug('[useTerminal] Terminal created', {
        terminalId: terminal.id,
        poolSize: newPoolSize,
      });

      // Warn if pool is nearly full (9+ terminals)
      if (newPoolSize >= 9) {
        logger.warn('[useTerminal] Terminal pool nearly full', {
          poolSize: newPoolSize,
          maxPoolSize,
          availableSlots: maxPoolSize - newPoolSize,
        });
      }

      return terminal;
    },
    [convertTerminalData, getPoolSize]
  );

  /**
   * Write data to terminal
   */
  const writeToTerminal = useCallback(async (terminalId: string, data: string): Promise<void> => {
    logger.debug('[useTerminal] writeToTerminal called:', {
      terminalId,
      data,
      dataLength: data.length,
      charCodes: Array.from(data).map((c) => c.charCodeAt(0)),
    });

    const response: TerminalResponse = await window.electron.ipc.invoke('terminal:write', {
      terminalId,
      data,
    });

    logger.debug('[useTerminal] writeToTerminal response:', response);

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
      logger.debug('[useTerminal] Destroying terminal (pooling enabled)', {
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

      logger.debug('[useTerminal] Terminal destroyed', {
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

      logger.debug('[useTerminal] setupTerminalListeners called for:', terminalId);

      // Remove any existing listeners first to prevent duplicates
      const existingDataCleanup = listenersRef.current.get(dataChannel);
      const existingExitCleanup = listenersRef.current.get(exitChannel);

      if (existingDataCleanup) {
        logger.debug('[useTerminal] Removing existing data listener for:', dataChannel);
        existingDataCleanup();
        listenersRef.current.delete(dataChannel);
      }
      if (existingExitCleanup) {
        existingExitCleanup();
        listenersRef.current.delete(exitChannel);
      }

      // Set up data listener and store cleanup function
      const dataCleanup = window.electron.ipc.on(dataChannel, (_event, data) => {
        onData(data as string);
      });
      listenersRef.current.set(dataChannel, dataCleanup);

      // Set up exit listener and store cleanup function
      const exitCleanup = window.electron.ipc.on(exitChannel, (_event, exitCode) =>
        onExit(exitCode as { exitCode: number; signal?: number })
      );
      listenersRef.current.set(exitChannel, exitCleanup);

      logger.debug('[useTerminal] Listeners setup complete for:', terminalId);
    },
    []
  );

  /**
   * Remove terminal listeners
   */
  const removeTerminalListeners = useCallback((terminalId: string) => {
    const dataChannel = `terminal:data:${terminalId}`;
    const exitChannel = `terminal:exit:${terminalId}`;

    // Call cleanup functions if they exist
    const dataCleanup = listenersRef.current.get(dataChannel);
    const exitCleanup = listenersRef.current.get(exitChannel);

    if (dataCleanup) {
      dataCleanup();
      listenersRef.current.delete(dataChannel);
    }
    if (exitCleanup) {
      exitCleanup();
      listenersRef.current.delete(exitChannel);
    }
  }, []);

  /**
   * Cleanup all listeners on unmount
   */
  useEffect(() => {
    return () => {
      // Call all cleanup functions
      listenersRef.current.forEach((cleanup) => {
        cleanup();
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

    // Pool stats 
    getPoolStats,
  };
};
