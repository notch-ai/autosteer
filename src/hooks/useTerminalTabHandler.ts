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
}

/**
 *
 * Business logic handler for terminal tab component operations.
 * Manages complete terminal lifecycle including XTerm initialization,
 * event handlers, and cleanup.
 *
 * Key Features:
 * - Pool-based terminal creation (attach/detach pattern)
 * - Complete lifecycle management (no useEffect needed in component)
 * - XTerm initialization with IPC listeners
 * - Event handlers (onData, onResize)
 * - Automatic cleanup on unmount
 * - Session coordination with TerminalStore
 * - Error handling for pool limits and creation failures
 *
 * @param projectId - Current project ID
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
}: UseTerminalTabHandlerParams) => {
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const xtermRef = useRef<XTerm | null>(null);
  const terminalIdRef = useRef<string | null>(null);
  const terminalOwnerProjectRef = useRef<string | null>(null);
  const isCreatingRef = useRef<boolean>(false);
  const prevProjectIdRef = useRef<string | null>(null);
  const lastRestoredTerminalIdRef = useRef<string | null>(null);

  const saveTerminalSession = useTerminalStore((state) => state.saveTerminalSession);
  const getTerminalSession = useTerminalStore((state) => state.getTerminalSession);
  const getLastTerminalForProject = useTerminalStore((state) => state.getLastTerminalForProject);
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
    attachTerminal: attachPoolTerminal,
    detachTerminal: detachPoolTerminal,
    fitTerminal: fitPoolTerminal,
  } = useTerminalPool();

  const { saveTerminalScrollPosition, restoreTerminalScrollPosition } =
    useTerminalScrollPreservation();

  const handleCreateTerminal = useCallback(async () => {
    if (isCreatingRef.current) {
      return;
    }

    isCreatingRef.current = true;

    try {
      setIsLoading(true);
      setError(null);

      const newTerminal = await createTerminalIPC(
        projectPath
          ? {
              size: { cols: 80, rows: 24 },
              cwd: projectPath,
            }
          : { size: { cols: 80, rows: 24 } }
      );

      const { addTerminal } = useTerminalStore.getState();
      try {
        addTerminal(newTerminal);
      } catch (err) {
        logger.error('[useTerminalTabHandler] Failed to add terminal to store', {
          terminalId: newTerminal.id,
          error: err,
        });
        throw err;
      }

      terminalIdRef.current = newTerminal.id;
      terminalOwnerProjectRef.current = projectId;
      setTerminal(newTerminal);
      onTerminalCreated?.(newTerminal);
      isCreatingRef.current = false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create terminal';
      setError(errorMessage);
      logger.error('[useTerminalTabHandler] Terminal creation failed', {
        error: errorMessage,
        projectPath,
      });
      isCreatingRef.current = false;
    } finally {
      setIsLoading(false);
    }
  }, [createTerminalIPC, onTerminalCreated, projectPath, projectId]);

  const handleRetry = useCallback(() => {
    void handleCreateTerminal();
  }, [handleCreateTerminal]);

  // Effect 1: XTerm initialization + event handlers
  useEffect(() => {
    if (!terminal || !terminalRef.current || xtermRef.current) {
      return undefined;
    }

    const terminalId = terminal.id;
    const container = terminalRef.current;

    try {
      // Initialize XTerm with pool
      let adapter;
      if (hasPoolTerminal(terminalId)) {
        attachPoolTerminal(terminalId, container);
        adapter = getPoolTerminal(terminalId);
      } else {
        adapter = createPoolTerminal(terminal, container);
      }

      if (!adapter) {
        return undefined;
      }

      const xterm = adapter.getXtermInstance();
      xtermRef.current = xterm;
      fitPoolTerminal(terminalId);

      // Restore scroll position from previous session
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

      // Set up XTerm event handlers
      const terminalIdForHandlers = { current: terminalId };

      const onDataDisposable = xterm.onData((data) => {
        const terminals = useTerminalStore.getState().terminals;
        const isInStore = terminals.has(terminalIdForHandlers.current);

        if (!isInStore) {
          return;
        }
        writeToTerminal(terminalIdForHandlers.current, data).catch((err) => {
          logger.error('[useTerminalTabHandler] Failed to write to terminal', {
            terminalId: terminalIdForHandlers.current,
            error: err,
          });
        });
      });

      const onResizeDisposable = xterm.onResize(({ cols, rows }) => {
        const terminals = useTerminalStore.getState().terminals;
        if (!terminals.has(terminalIdForHandlers.current)) {
          return;
        }
        resizeTerminal(terminalIdForHandlers.current, cols, rows).catch((err) => {
          logger.error('[useTerminalTabHandler] Failed to resize terminal', {
            terminalId: terminalIdForHandlers.current,
            cols,
            rows,
            error: err,
          });
        });
      });

      // Window resize handler
      const handleResize = () => {
        if (hasPoolTerminal(terminalId)) {
          fitPoolTerminal(terminalId);
        }
      };

      window.addEventListener('resize', handleResize);

      // Cleanup function
      return () => {
        onDataDisposable.dispose();
        onResizeDisposable.dispose();
        window.removeEventListener('resize', handleResize);
      };
    } catch (error) {
      logger.error('[useTerminalTabHandler] Failed to initialize terminal', {
        terminalId: terminalId.substring(0, 8),
        error,
      });
      return undefined;
    }
  }, [
    terminal,
    terminalRef,
    hasPoolTerminal,
    attachPoolTerminal,
    getPoolTerminal,
    createPoolTerminal,
    fitPoolTerminal,
    setupTerminalListeners,
    writeToTerminal,
    resizeTerminal,
  ]);

  // Effect 2: Project switching and session management
  useEffect(() => {
    const currentProjectId = projectId;
    const prevProjectId = prevProjectIdRef.current;

    if (!currentProjectId) {
      return undefined;
    }

    const projectChanged = prevProjectId !== null && prevProjectId !== currentProjectId;

    if (projectChanged) {
      lastRestoredTerminalIdRef.current = null;
    }

    if (projectChanged && prevProjectId && terminal && terminalIdRef.current) {
      const ownerProject = terminalOwnerProjectRef.current || prevProjectId;
      const adapter = getPoolTerminal(terminalIdRef.current);

      if (adapter) {
        const xterm = adapter.getXtermInstance();
        const cursorY = xterm?.buffer?.active.cursorY || 0;
        const cursorX = xterm?.buffer?.active.cursorX || 0;
        const cols = xterm?.cols || 0;
        const rows = xterm?.rows || 0;

        // Save scroll position before switching
        saveTerminalScrollPosition(terminal.id, xterm);

        saveTerminalSession(terminal.id, {
          terminal,
          terminalId: terminal.id,
          ownerProjectId: ownerProject,
          xtermInstance: undefined,
          fitAddon: undefined,
          cursorY,
          cursorX,
          cols,
          rows,
          lastActive: new Date(),
        });
      }

      removeTerminalListeners(terminal.id);

      if (terminal.id && hasPoolTerminal(terminal.id)) {
        detachPoolTerminal(terminal.id);
      }

      setTerminal(null);
      xtermRef.current = null;
      terminalIdRef.current = null;
      terminalOwnerProjectRef.current = null;
      isCreatingRef.current = false;
    }

    let existingSession;

    if (terminalIdRef.current) {
      existingSession = getTerminalSession(terminalIdRef.current);
    } else if (currentProjectId) {
      existingSession = getLastTerminalForProject(currentProjectId);
    }

    // Restore terminal if:
    // 1. We found an existing session for this project
    // 2. AND (no current terminal OR project just changed)
    if (existingSession && (!terminal || projectChanged)) {
      if (lastRestoredTerminalIdRef.current === existingSession.terminalId) {
        return undefined;
      }

      const inPool = hasPoolTerminal(existingSession.terminalId);

      // ✅ FIX: If terminal NOT in pool, don't restore - create new instead
      if (!inPool) {
        logger.warn('[useTerminalTabHandler] 🚨 Terminal in cache but NOT in pool - creating new', {
          terminalId: existingSession.terminalId.substring(0, 8),
          ownerProjectId: existingSession.ownerProjectId?.substring(0, 8),
          action: 'Will create NEW terminal instead of corrupted session',
        });

        // Don't restore corrupted session - create new terminal
        const timeoutId = setTimeout(() => {
          void handleCreateTerminal();
        }, 10);

        prevProjectIdRef.current = currentProjectId;

        return () => clearTimeout(timeoutId);
      }

      // ✅ Session exists AND in pool - safe to restore
      setTerminal(existingSession.terminal);
      setActiveTerminal(existingSession.terminalId);
      terminalOwnerProjectRef.current = existingSession.ownerProjectId;
      lastRestoredTerminalIdRef.current = existingSession.terminalId;

      prevProjectIdRef.current = currentProjectId;
    } else if (!existingSession && !terminal && !isLoading && !error) {
      const timeoutId = setTimeout(() => {
        void handleCreateTerminal();
      }, 10);

      prevProjectIdRef.current = currentProjectId;

      return () => clearTimeout(timeoutId);
    } else if (terminal && prevProjectId === null) {
      prevProjectIdRef.current = currentProjectId;
    }

    return undefined;
  }, [
    projectId,
    terminal,
    isLoading,
    error,
    handleCreateTerminal,
    saveTerminalSession,
    getTerminalSession,
    getLastTerminalForProject,
    getPoolTerminal,
    removeTerminalListeners,
    hasPoolTerminal,
    detachPoolTerminal,
  ]);

  // Effect 3: Cleanup on unmount
  useEffect(() => {
    return () => {
      if (terminal?.id && xtermRef.current) {
        // Save scroll position before cleanup
        saveTerminalScrollPosition(terminal.id, xtermRef.current);

        removeTerminalListeners(terminal.id);
        if (hasPoolTerminal(terminal.id)) {
          detachPoolTerminal(terminal.id);
        }
        xtermRef.current = null;
      }
    };
  }, [
    terminal?.id,
    removeTerminalListeners,
    detachPoolTerminal,
    hasPoolTerminal,
    saveTerminalScrollPosition,
  ]);

  return {
    terminal,
    error,
    isLoading,
    xtermRef,
    handleRetry,
  };
};
