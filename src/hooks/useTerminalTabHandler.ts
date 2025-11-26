import { logger } from '@/commons/utils/logger';
import { useTerminal } from '@/hooks/useTerminal';
import { useTerminalScrollPreservation } from '@/hooks/useTerminalScrollPreservation';
import { useTerminalPool } from '@/renderer/hooks/useTerminalPool';
import { useTerminalStore } from '@/stores';
import { Terminal } from '@/types/terminal.types';
import { Terminal as XTerm } from '@xterm/xterm';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseTerminalTabHandlerParams {
  projectId: string | null;
  projectPath?: string | undefined;
  terminalRef: React.RefObject<HTMLDivElement>;
  onTerminalCreated?: ((terminal: Terminal) => void) | undefined;
  isActive?: boolean;
}

/**
 * Business logic handler for terminal tab component operations.
 *
 * SIMPLIFIED ARCHITECTURE:
 * - 1 Project = 1 Terminal (enforced by pool)
 * - Terminal keyed by projectId in pool
 * - No session cache needed (pool IS the cache)
 * - Direct pool lookup by projectId
 *
 * Key Features:
 * - Pool-based terminal management (1:1 with projects)
 * - XTerm initialization with IPC listeners
 * - Event handlers (onData, onResize)
 * - Automatic cleanup on unmount
 * - Terminal reuse across project switches
 *
 * @param projectId - Current project ID (folderName)
 * @param projectPath - Project local path for terminal cwd
 * @param terminalRef - Ref to terminal container element
 * @param onTerminalCreated - Callback when terminal is created
 * @returns Handler state and xtermRef for component
 */
export const useTerminalTabHandler = ({
  projectId,
  projectPath,
  terminalRef,
  onTerminalCreated,
  isActive = false,
}: UseTerminalTabHandlerParams) => {
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const xtermRef = useRef<XTerm | null>(null);
  const isCreatingRef = useRef<boolean>(false);
  const eventHandlersInitializedRef = useRef<boolean>(false);

  const setActiveTerminal = useTerminalStore((state) => state.setActiveTerminal);

  const {
    createTerminal: createTerminalIPC,
    writeToTerminal,
    resizeTerminal,
    setupTerminalListeners,
    removeTerminalListeners,
  } = useTerminal();

  const {
    createTerminal: createPoolTerminal,
    getTerminal: getPoolTerminal,
    hasTerminal: hasPoolTerminal,
    fitTerminal: fitPoolTerminal,
    getPoolSize,
    getMaxPoolSize,
    getTerminalId,
    getTerminalMetadata,
  } = useTerminalPool();

  const { saveTerminalScrollPosition, restoreTerminalScrollPosition } =
    useTerminalScrollPreservation();

  const handleCreateTerminal = useCallback(async () => {
    if (!projectId || isCreatingRef.current) {
      return;
    }

    isCreatingRef.current = true;

    try {
      setIsLoading(true);
      setError(null);

      // Create terminal via IPC
      const newTerminal = await createTerminalIPC(
        projectPath
          ? {
              size: { cols: 80, rows: 24 },
              cwd: projectPath,
            }
          : { size: { cols: 80, rows: 24 } }
      );

      // Add to store
      const { addTerminal } = useTerminalStore.getState();
      addTerminal(newTerminal);

      // Set as active
      setActiveTerminal(newTerminal.id);
      setTerminal(newTerminal);
      onTerminalCreated?.(newTerminal);

      isCreatingRef.current = false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create terminal';
      setError(errorMessage);
      logger.error('[useTerminalTabHandler] Terminal creation failed', {
        projectId: projectId?.substring(0, 20),
        error: errorMessage,
      });
      isCreatingRef.current = false;
    } finally {
      setIsLoading(false);
    }
  }, [
    projectId,
    projectPath,
    createTerminalIPC,
    onTerminalCreated,
    getPoolSize,
    getMaxPoolSize,
    setActiveTerminal,
  ]);

  const handleRetry = useCallback(() => {
    void handleCreateTerminal();
  }, [handleCreateTerminal]);

  // Effect 1: Project changed - attach/create terminal for this project
  useEffect(() => {
    if (!projectId || !terminalRef.current) {
      return undefined;
    }

    // Check if this project already has a terminal in pool
    const existingTerminal = getTerminalMetadata(projectId);
    const hasTerminal = hasPoolTerminal(projectId);

    if (existingTerminal && hasTerminal) {
      // Terminal exists - attach it
      setTerminal(existingTerminal);
      setActiveTerminal(existingTerminal.id);

      // Pool attachment happens in Effect 2 when terminal state is set
    } else {
      // No terminal for this project - create new
      const timeoutId = setTimeout(() => {
        void handleCreateTerminal();
      }, 10);

      return () => clearTimeout(timeoutId);
    }

    return undefined;
  }, [projectId, handleCreateTerminal, getTerminalMetadata, hasPoolTerminal, setActiveTerminal]);

  // Effect 2: XTerm initialization + event handlers (ONCE on creation)
  // Terminal stays permanently attached, no detach on tab switch
  useEffect(() => {
    if (!projectId || !terminal || !terminalRef.current) {
      return undefined;
    }

    const container = terminalRef.current;
    const terminalId = terminal.id;

    // Only initialize if not already initialized
    // Terminal attaches ONCE and stays attached permanently
    if (xtermRef.current && eventHandlersInitializedRef.current) {
      return undefined;
    }

    try {
      // Terminal attaches ONCE on creation and stays permanently attached
      // Get existing terminal adapter (already attached) or create new one (attaches on creation)
      let adapter;
      if (hasPoolTerminal(projectId)) {
        // Terminal exists in pool - already permanently attached
        adapter = getPoolTerminal(projectId);
      } else {
        // Create new terminal in pool - attaches permanently on creation
        adapter = createPoolTerminal(projectId, terminal, container);
      }

      if (!adapter) {
        logger.error('[useTerminalTabHandler] Failed to get/create adapter', {
          projectId: projectId.substring(0, 20),
        });
        return undefined;
      }

      const xterm = adapter.getXtermInstance();
      xtermRef.current = xterm;

      fitPoolTerminal(projectId);

      // Restore scroll position
      restoreTerminalScrollPosition(terminalId, xterm);

      // Set up IPC listeners
      setupTerminalListeners(
        terminalId,
        (data: string) => {
          xterm.write(data);
        },
        () => {
          setTerminal((prev) => (prev ? { ...prev, status: 'stopped' } : null));
        }
      );

      // Focus terminal
      xterm.focus();

      // Mark event handlers as initialized
      eventHandlersInitializedRef.current = true;

      // Set up XTerm event handlers
      const onDataDisposable = xterm.onData((data) => {
        const terminals = useTerminalStore.getState().terminals;
        if (!terminals.has(terminalId)) {
          logger.error('[useTerminalTabHandler] Terminal not in store - blocking input!', {
            terminalId: terminalId.substring(0, 8),
            expectedTerminalId: terminalId,
            storeTerminalIds: Array.from(terminals.keys()),
          });
          return;
        }
        writeToTerminal(terminalId, data).catch((err) => {
          logger.error('[useTerminalTabHandler] Failed to write to terminal', {
            terminalId,
            error: err,
          });
        });
      });

      const onResizeDisposable = xterm.onResize(({ cols, rows }) => {
        const terminals = useTerminalStore.getState().terminals;
        if (!terminals.has(terminalId)) {
          return;
        }
        resizeTerminal(terminalId, cols, rows).catch((err) => {
          logger.error('[useTerminalTabHandler] Failed to resize terminal', {
            terminalId,
            cols,
            rows,
            error: err,
          });
        });
      });

      // Window resize handler
      const handleResize = () => {
        if (hasPoolTerminal(projectId)) {
          fitPoolTerminal(projectId);
        }
      };

      window.addEventListener('resize', handleResize);

      // Cleanup function - dispose handlers but terminal stays attached
      return () => {
        onDataDisposable.dispose();
        onResizeDisposable.dispose();
        window.removeEventListener('resize', handleResize);
        eventHandlersInitializedRef.current = false;
      };
    } catch (error) {
      logger.error('[useTerminalTabHandler] Failed to initialize terminal', {
        projectId: projectId.substring(0, 20),
        error,
      });
      return undefined;
    }
  }, [
    projectId,
    terminal,
    terminalRef,
    hasPoolTerminal,
    getPoolTerminal,
    createPoolTerminal,
    fitPoolTerminal,
    setupTerminalListeners,
    writeToTerminal,
    resizeTerminal,
    restoreTerminalScrollPosition,
    getPoolSize,
    getMaxPoolSize,
  ]);

  // Effect 3: Cleanup when switching projects or unmounting
  // No detach - terminal stays permanently attached for z-index stacking
  useEffect(() => {
    // Capture current projectId for cleanup
    const currentProjectId = projectId;

    return () => {
      if (!currentProjectId || !xtermRef.current) {
        return;
      }

      const terminalId = getTerminalId(currentProjectId);
      if (!terminalId) {
        return;
      }

      // Save scroll position
      saveTerminalScrollPosition(terminalId, xtermRef.current);

      // Remove IPC listeners
      removeTerminalListeners(terminalId);

      // No detach - terminal stays attached permanently
      // Z-index stacking handles visibility

      // Reset refs - Effect 2 will re-initialize for new project
      xtermRef.current = null;
      eventHandlersInitializedRef.current = false;
    };
  }, [projectId, getTerminalId, saveTerminalScrollPosition, removeTerminalListeners]);

  // Effect 4: Focus terminal when tab becomes active
  useEffect(() => {
    if (isActive && xtermRef.current) {
      xtermRef.current.focus();
    }
  }, [isActive]);

  return {
    terminal,
    error,
    isLoading,
    xtermRef,
    handleRetry,
  };
};
