import { useCallback, useRef, useEffect } from 'react';
import {
  Terminal,
  TerminalCreateParams,
  TerminalData,
  TerminalResponse,
  TerminalCreateResponse,
} from '@/types/terminal.types';
import { useTerminalPool } from '../renderer/hooks/useTerminalPool';
import { logger } from '@/commons/utils/logger';

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
      logger.debug('[useTerminal] Creating terminal (pooling enabled)', {
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

      logger.debug('[useTerminal] Terminal created', {
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
      logger.debug('[useTerminal] Adding new data listener for:', dataChannel);
      const dataCleanup = window.electron.ipc.on(dataChannel, (_event, data) => {
        // HYPOTHESIS LOGGING: Track frontend IPC listener invocations
        logger.info(
          `[DIAG-H1-IPC-RECV] channel=${dataChannel} terminalId=${terminalId.substring(0, 8)} dataLen=${(data as string).length} dataPreview=${(data as string).substring(0, 30).replace(/\n/g, '\\n')} activeListeners=${Array.from(
            listenersRef.current.keys()
          )
            .map((ch) => ch.split(':')[2]?.substring(0, 8) || 'unknown')
            .join(',')}`
        );
        logger.debug('[useTerminal] Data received on channel:', dataChannel, 'data:', data);
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

    // HYPOTHESIS LOGGING: Track listener removal to detect leaks
    const listenersBefore = Array.from(listenersRef.current.keys())
      .map((ch) => ch.split(':')[2]?.substring(0, 8) || 'unknown')
      .join(',');

    logger.info(
      `[DIAG-H1-IPC-CLEANUP-BEFORE] terminalId=${terminalId.substring(0, 8)} dataChannel=${dataChannel} hadDataListener=${!!dataCleanup} hadExitListener=${!!exitCleanup} listenersBefore=${listenersBefore}`
    );

    if (dataCleanup) {
      dataCleanup();
      listenersRef.current.delete(dataChannel);
    }
    if (exitCleanup) {
      exitCleanup();
      listenersRef.current.delete(exitChannel);
    }

    // Verify cleanup worked
    const listenersAfter = Array.from(listenersRef.current.keys())
      .map((ch) => ch.split(':')[2]?.substring(0, 8) || 'unknown')
      .join(',');

    logger.info(
      `[DIAG-H1-IPC-CLEANUP-AFTER] terminalId=${terminalId.substring(0, 8)} listenersAfter=${listenersAfter} cleanupSuccessful=${!listenersAfter.includes(terminalId.substring(0, 8))}`
    );
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

    // Pool stats (Phase 2)
    getPoolStats,
  };
};
