import { useCallback, useEffect } from 'react';
import { TerminalPoolManager } from '@/renderer/services/TerminalPoolManager';
import { Terminal } from '@/types/terminal.types';
import { logger } from '@/commons/utils/logger';

/**
 * Pool statistics interface
 */
export interface TerminalPoolStats {
  size: number;
  maxSize: number;
  terminalIds: string[];
  availableSlots: number;
}

// Global singleton instance - shared across ALL hook calls
let globalPoolManager: TerminalPoolManager | null = null;

/**
 * useTerminalPool Hook - Terminal Instance Pooling
 *
 * Provides simplified access to the terminal instance pool for React components.
 *
 * Key Features:
 * - TRUE GLOBAL Singleton TerminalPoolManager instance (shared across all components)
 * - Terminal instance lifecycle management (create, destroy)
 * - Terminal control operations (focus, blur, resize, fit)
 * - Pool size monitoring and stats
 * - Graceful error handling with user-friendly messages
 * - Application logging for debugging
 *
 * Architecture:
 * - React hook pattern
 * - Uses module-level singleton (not useRef) for true cross-component sharing
 * - Decouples terminal instances from component lifecycle
 * - Simplified API (removed attach/detach/capture/restore)
 *
 * Usage:
 * ```tsx
 * const { createTerminal, destroyTerminal, focusTerminal, getPoolStats } = useTerminalPool();
 *
 * // Create terminal (automatically attaches to element)
 * const adapter = createTerminal(projectId, terminal, element);
 *
 * // Check pool status
 * const stats = getPoolStats();
 * console.log(`Pool: ${stats.size}/${stats.maxSize} terminals`);
 *
 * // Destroy terminal when done
 * destroyTerminal(projectId);
 * ```
 *
 */
export const useTerminalPool = () => {
  // Initialize GLOBAL singleton on first use
  if (!globalPoolManager) {
    globalPoolManager = new TerminalPoolManager();
    logger.debug('[useTerminalPool] 🌍 Global TerminalPoolManager created');
    console.log('[useTerminalPool] 🌍 Global singleton created - shared by ALL components');
  }

  const poolManager = globalPoolManager;

  /**
   * Create a new terminal in the pool
   * @param projectId The project ID (folderName)
   * @param terminal The terminal metadata
   * @param element The DOM element to attach to
   */
  const createTerminal = useCallback(
    (projectId: string, terminal: Terminal, element: HTMLElement) => {
      try {
        logger.debug('[useTerminalPool] Creating terminal', {
          projectId,
          terminalId: terminal.id,
        });
        return poolManager.createTerminal(projectId, terminal, element);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('[useTerminalPool] Failed to create terminal', {
          projectId,
          terminalId: terminal.id,
          error: errorMessage,
        });
        throw error;
      }
    },
    [poolManager]
  );

  /**
   * Get terminal from pool by project ID
   */
  const getTerminal = useCallback(
    (projectId: string) => {
      return poolManager.getTerminal(projectId);
    },
    [poolManager]
  );

  /**
   * Check if project has terminal in pool
   */
  const hasTerminal = useCallback(
    (projectId: string) => {
      return poolManager.hasTerminal(projectId);
    },
    [poolManager]
  );

  /**
   * Focus terminal
   */
  const focusTerminal = useCallback(
    (projectId: string) => {
      poolManager.focusTerminal(projectId);
    },
    [poolManager]
  );

  /**
   * Blur terminal
   */
  const blurTerminal = useCallback(
    (projectId: string) => {
      poolManager.blurTerminal(projectId);
    },
    [poolManager]
  );

  /**
   * Fit terminal to container
   */
  const fitTerminal = useCallback(
    (projectId: string) => {
      poolManager.fitTerminal(projectId);
    },
    [poolManager]
  );

  /**
   * Resize terminal
   */
  const resizeTerminal = useCallback(
    (projectId: string, cols: number, rows: number) => {
      poolManager.resizeTerminal(projectId, cols, rows);
    },
    [poolManager]
  );

  /**
   * Destroy terminal instance
   */
  const destroyTerminal = useCallback(
    (projectId: string) => {
      try {
        logger.debug('[useTerminalPool] Destroying terminal', { projectId });
        poolManager.destroyTerminal(projectId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('[useTerminalPool] Failed to destroy terminal', {
          projectId,
          error: errorMessage,
        });
        throw error;
      }
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
   * Get maximum pool size
   */
  const getMaxPoolSize = useCallback(() => {
    return poolManager.getMaxPoolSize();
  }, [poolManager]);

  /**
   * Get all project IDs that have terminals
   */
  const getAllProjectIds = useCallback(() => {
    return poolManager.getAllProjectIds();
  }, [poolManager]);

  /**
   * Get pool statistics
   */
  const getPoolStats = useCallback((): TerminalPoolStats => {
    const size = poolManager.getPoolSize();
    const maxSize = poolManager.getMaxPoolSize();
    const terminalIds = poolManager.getAllProjectIds();

    return {
      size,
      maxSize,
      terminalIds,
      availableSlots: maxSize - size,
    };
  }, [poolManager]);

  /**
   * Get terminal metadata
   */
  const getTerminalMetadata = useCallback(
    (projectId: string) => {
      return poolManager.getTerminalMetadata(projectId);
    },
    [poolManager]
  );

  /**
   * Get terminal ID for a project
   */
  const getTerminalId = useCallback(
    (projectId: string) => {
      return poolManager.getTerminalId(projectId);
    },
    [poolManager]
  );

  /**
   * Scroll terminal to top
   */
  const scrollToTop = useCallback(
    (projectId: string) => {
      try {
        logger.debug('[useTerminalPool] Scrolling terminal to top', { projectId });
        poolManager.scrollToTop(projectId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('[useTerminalPool] Failed to scroll terminal to top', {
          projectId,
          error: errorMessage,
        });
        throw error;
      }
    },
    [poolManager]
  );

  /**
   * Scroll terminal to bottom
   */
  const scrollToBottom = useCallback(
    (projectId: string) => {
      try {
        logger.debug('[useTerminalPool] Scrolling terminal to bottom', { projectId });
        poolManager.scrollToBottom(projectId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('[useTerminalPool] Failed to scroll terminal to bottom', {
          projectId,
          error: errorMessage,
        });
        throw error;
      }
    },
    [poolManager]
  );

  /**
   * Cleanup on unmount (optional - terminals can persist)
   */
  useEffect(() => {
    return () => {
      logger.debug('[useTerminalPool] Hook unmounting (pool persists)');
      // Note: We don't clear the pool on unmount to support terminal persistence
      // Terminals will be destroyed explicitly when needed
    };
  }, []);

  return {
    // Terminal lifecycle
    createTerminal,
    getTerminal,
    hasTerminal,
    destroyTerminal,

    // Terminal operations
    focusTerminal,
    blurTerminal,
    fitTerminal,
    resizeTerminal,
    scrollToTop,
    scrollToBottom,

    // Pool info
    getPoolSize,
    getMaxPoolSize,
    getAllProjectIds,
    getTerminalId,
    getTerminalMetadata,
    getPoolStats,
  };
};

/**
 * Reset global singleton (TEST ONLY)
 * WARNING: This should ONLY be used in tests to reset state between test runs
 */
export const __resetGlobalPoolManagerForTesting = () => {
  globalPoolManager = null;
};
