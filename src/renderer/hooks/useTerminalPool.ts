import { useCallback, useEffect, useRef } from 'react';
import { TerminalPoolManager } from '@/renderer/services/TerminalPoolManager';
import { Terminal, TerminalBufferState } from '@/types/terminal.types';

/**
 * useTerminalPool Hook - Phase 2 Instance Pooling
 *
 * Provides access to the terminal instance pool for React components.
 *
 * Key Features:
 * - Singleton TerminalPoolManager instance
 * - Terminal instance lifecycle management
 * - Attach/detach operations for DOM lifecycle
 * - Buffer state capture/restore
 * - Cleanup on unmount
 *
 * Architecture:
 * - React hook pattern
 * - Manages TerminalPoolManager singleton
 * - Decouples terminal instances from component lifecycle
 * - Coordinates with useTerminal hook
 *
 * Usage:
 * ```tsx
 * const { createTerminal, attachTerminal, detachTerminal, destroyTerminal, captureBufferState } = useTerminalPool();
 *
 * // Create terminal
 * const adapter = createTerminal(terminal, element);
 *
 * // Detach when component unmounts
 * detachTerminal(terminalId);
 *
 * // Reattach when component remounts
 * attachTerminal(terminalId, element);
 * ```
 *
 * @see docs/terminal-persistence-architecture.md Phase 2
 */
export const useTerminalPool = () => {
  // Use ref to maintain singleton pool manager instance across renders
  const poolManagerRef = useRef<TerminalPoolManager | null>(null);

  // Initialize pool manager on first render
  if (!poolManagerRef.current) {
    poolManagerRef.current = new TerminalPoolManager();
    console.log('[useTerminalPool] Pool manager initialized');
  }

  const poolManager = poolManagerRef.current;

  /**
   * Create a new terminal in the pool
   */
  const createTerminal = useCallback(
    (terminal: Terminal, element: HTMLElement) => {
      console.log('[useTerminalPool] Creating terminal', { terminalId: terminal.id });
      return poolManager.createTerminal(terminal, element);
    },
    [poolManager]
  );

  /**
   * Get terminal from pool
   */
  const getTerminal = useCallback(
    (terminalId: string) => {
      return poolManager.getTerminal(terminalId);
    },
    [poolManager]
  );

  /**
   * Check if terminal exists in pool
   */
  const hasTerminal = useCallback(
    (terminalId: string) => {
      return poolManager.hasTerminal(terminalId);
    },
    [poolManager]
  );

  /**
   * Attach terminal to DOM element
   */
  const attachTerminal = useCallback(
    (terminalId: string, element: HTMLElement) => {
      console.log('[useTerminalPool] Attaching terminal', { terminalId });
      poolManager.attachTerminal(terminalId, element);
    },
    [poolManager]
  );

  /**
   * Detach terminal from DOM (without destroying)
   */
  const detachTerminal = useCallback(
    (terminalId: string) => {
      console.log('[useTerminalPool] Detaching terminal', { terminalId });
      poolManager.detachTerminal(terminalId);
    },
    [poolManager]
  );

  /**
   * Focus terminal
   */
  const focusTerminal = useCallback(
    (terminalId: string) => {
      poolManager.focusTerminal(terminalId);
    },
    [poolManager]
  );

  /**
   * Blur terminal
   */
  const blurTerminal = useCallback(
    (terminalId: string) => {
      poolManager.blurTerminal(terminalId);
    },
    [poolManager]
  );

  /**
   * Fit terminal to container
   */
  const fitTerminal = useCallback(
    (terminalId: string) => {
      poolManager.fitTerminal(terminalId);
    },
    [poolManager]
  );

  /**
   * Resize terminal
   */
  const resizeTerminal = useCallback(
    (terminalId: string, cols: number, rows: number) => {
      poolManager.resizeTerminal(terminalId, cols, rows);
    },
    [poolManager]
  );

  /**
   * Capture buffer state for persistence
   */
  const captureBufferState = useCallback(
    (terminalId: string): TerminalBufferState => {
      console.log('[useTerminalPool] Capturing buffer state', { terminalId });
      return poolManager.captureBufferState(terminalId);
    },
    [poolManager]
  );

  /**
   * Restore buffer state
   */
  const restoreBufferState = useCallback(
    (terminalId: string, bufferState: TerminalBufferState) => {
      console.log('[useTerminalPool] Restoring buffer state', { terminalId });
      poolManager.restoreBufferState(terminalId, bufferState);
    },
    [poolManager]
  );

  /**
   * Destroy terminal instance
   */
  const destroyTerminal = useCallback(
    (terminalId: string) => {
      console.log('[useTerminalPool] Destroying terminal', { terminalId });
      poolManager.destroyTerminal(terminalId);
    },
    [poolManager]
  );

  /**
   * Get pool size
   */
  const getPoolSize = useCallback(() => {
    return poolManager.getPoolSize();
  }, [poolManager]);

  /**
   * Get all terminal IDs
   */
  const getAllTerminalIds = useCallback(() => {
    return poolManager.getAllTerminalIds();
  }, [poolManager]);

  /**
   * Get terminal metadata
   */
  const getTerminalMetadata = useCallback(
    (terminalId: string) => {
      return poolManager.getTerminalMetadata(terminalId);
    },
    [poolManager]
  );

  /**
   * Check if terminal is attached
   */
  const isTerminalAttached = useCallback(
    (terminalId: string) => {
      return poolManager.isTerminalAttached(terminalId);
    },
    [poolManager]
  );

  /**
   * Cleanup on unmount (optional - terminals can persist)
   */
  useEffect(() => {
    return () => {
      // Note: We don't clear the pool on unmount to support terminal persistence
      // Terminals will be destroyed explicitly when needed
      console.log('[useTerminalPool] Hook unmounting (pool persists)');
    };
  }, []);

  return {
    // Terminal lifecycle
    createTerminal,
    getTerminal,
    hasTerminal,
    destroyTerminal,

    // DOM attachment
    attachTerminal,
    detachTerminal,

    // Terminal operations
    focusTerminal,
    blurTerminal,
    fitTerminal,
    resizeTerminal,

    // Buffer state
    captureBufferState,
    restoreBufferState,

    // Pool info
    getPoolSize,
    getAllTerminalIds,
    getTerminalMetadata,
    isTerminalAttached,
  };
};
