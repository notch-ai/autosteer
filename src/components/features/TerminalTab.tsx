import { Button } from '@/components/ui/button';
import { useTerminal } from '@/hooks/useTerminal';
import { useCoreStore } from '@/stores';
import { useTerminalStore } from '@/stores/terminal';
import { Terminal } from '@/types/terminal.types';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { SerializeAddon } from '@xterm/addon-serialize';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal as XTerm } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

interface TerminalTabProps {
  terminalId?: string;
  onTerminalCreated?: (terminal: Terminal) => void;
  className?: string;
}

export const TerminalTab: React.FC<TerminalTabProps> = ({
  terminalId: existingTerminalId,
  onTerminalCreated,
  className = '',
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const terminalIdRef = useRef<string | null>(null); // Track terminal ID for cleanup
  const isCreatingRef = useRef<boolean>(false); // Prevent duplicate creation
  const previousProjectIdRef = useRef<string | null>(null); // Track previous project ID for session saving
  const restoredProjectIdRef = useRef<string | null>(null); // Track which project's session was restored to prevent re-restoration
  const terminalOwnerProjectIdRef = useRef<string | null>(null); // Track which project owns the current terminal
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Get the selected project's local path
  const selectedProjectId = useCoreStore((state) => state.selectedProjectId);
  const projects = useCoreStore((state) => state.projects);
  const selectedProject = selectedProjectId ? projects.get(selectedProjectId) : undefined;

  // Terminal session store
  const saveTerminalSession = useTerminalStore((state) => state.saveTerminalSession);
  const getTerminalSession = useTerminalStore((state) => state.getTerminalSession);

  const { createTerminal, writeToTerminal, resizeTerminal, setupTerminalListeners } = useTerminal();

  /**
   * Initialize xterm.js instance
   */
  const initializeXterm = useCallback(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const xterm = new XTerm({
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
      fontFamily: '"Code New Roman", "Cascadia Code", "Fira Code", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block', // Match agent chat cursor style (thick block cursor)
      scrollback: 1000,
      allowTransparency: false,
      allowProposedApi: true,
    });

    // Add addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();
    const unicode11Addon = new Unicode11Addon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    xterm.loadAddon(searchAddon);
    xterm.loadAddon(unicode11Addon);

    // Activate unicode handling
    xterm.unicode.activeVersion = '11';

    // Open terminal
    xterm.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  /**
   * Create new terminal
   */
  const handleCreateTerminal = useCallback(async () => {
    console.log('[TerminalTab] handleCreateTerminal called, isCreating:', isCreatingRef.current);

    // Prevent duplicate creation (React Strict Mode calls effects twice)
    if (isCreatingRef.current) {
      console.log('[TerminalTab] Already creating terminal, skipping duplicate call');
      return;
    }

    isCreatingRef.current = true;

    try {
      setIsLoading(true);
      setError(null);

      const newTerminal = await createTerminal(
        selectedProject?.localPath
          ? {
              size: { cols: 80, rows: 24 },
              cwd: selectedProject.localPath,
            }
          : { size: { cols: 80, rows: 24 } }
      );

      console.log('[TerminalTab] Terminal created:', newTerminal.id);
      terminalIdRef.current = newTerminal.id; // Save ID to ref for cleanup
      terminalOwnerProjectIdRef.current = selectedProjectId; // Track which project owns this terminal
      setTerminal(newTerminal);
      onTerminalCreated?.(newTerminal);

      // Set up terminal event listeners
      console.log('[TerminalTab] Setting up terminal listeners for:', newTerminal.id);
      setupTerminalListeners(
        newTerminal.id,
        (data: string) => {
          if (xtermRef.current) {
            xtermRef.current.write(data);
          }
        },
        (exitCode) => {
          console.log('Terminal exited with code:', exitCode);
          setTerminal((prev) => (prev ? { ...prev, status: 'stopped' } : null));
        }
      );
      console.log('[TerminalTab] Terminal listeners set up complete');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create terminal';
      setError(errorMessage);
      console.error('Terminal creation failed:', errorMessage);
      isCreatingRef.current = false; // Reset on error so retry can work
    } finally {
      setIsLoading(false);
    }
  }, [createTerminal, onTerminalCreated, setupTerminalListeners, selectedProject?.localPath]);

  /**
   * Retry terminal creation
   */
  const handleRetry = useCallback(() => {
    setError(null);
    isCreatingRef.current = false; // Reset flag to allow retry
    handleCreateTerminal();
  }, [handleCreateTerminal]);

  // Initialize xterm when terminal is created OR recreate for restored terminal
  useEffect(() => {
    if (terminal && !xtermRef.current) {
      // Create new XTerm instance for newly created terminal
      console.log('[TerminalTab] Creating new XTerm for new terminal:', terminal.id);
      initializeXterm();
    } else if (terminal && xtermRef.current && terminalRef.current) {
      // Handle restored terminal - check if XTerm needs reattachment
      const oldXterm = xtermRef.current;

      // Check if xterm is not attached to the current ref
      if (!oldXterm.element || oldXterm.element.parentElement !== terminalRef.current) {
        console.log('[TerminalTab] Restored terminal needs fresh XTerm instance', {
          terminalId: terminal.id,
          hasOldElement: !!oldXterm.element,
          bufferLength: oldXterm.buffer?.active.length,
        });

        // Extract buffer content from old XTerm using SerializeAddon to preserve ANSI codes
        const serializeAddon = new SerializeAddon();
        oldXterm.loadAddon(serializeAddon);
        const bufferContent = serializeAddon.serialize();

        console.log(
          '[TerminalTab] Extracted buffer content with ANSI codes:',
          bufferContent.length,
          'chars'
        );

        // Create fresh XTerm instance
        const newXterm = new XTerm({
          theme: {
            background: '#1e1e1e',
            foreground: '#d4d4d4',
            cursor: '#d4d4d4',
            selectionBackground: '#264f78',
            black: '#000000',
            red: '#cd3131',
            green: '#0dbc79',
            yellow: '#e5e510',
            blue: '#2472c8',
            magenta: '#bc3fbc',
            cyan: '#11a8cd',
            white: '#e5e5e5',
            brightBlack: '#666666',
            brightRed: '#f14c4c',
            brightGreen: '#23d18b',
            brightYellow: '#f5f543',
            brightBlue: '#3b8eea',
            brightMagenta: '#d670d6',
            brightCyan: '#29b8db',
            brightWhite: '#e5e5e5',
          },
          fontFamily: '"Code New Roman", "Cascadia Code", "Fira Code", monospace',
          fontSize: 13,
          lineHeight: 1.2,
          cursorBlink: true,
          cursorStyle: 'block',
          scrollback: 1000,
          allowTransparency: false,
          allowProposedApi: true,
        });

        // Add addons to new instance
        const newFitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();
        const searchAddon = new SearchAddon();
        const unicode11Addon = new Unicode11Addon();

        newXterm.loadAddon(newFitAddon);
        newXterm.loadAddon(webLinksAddon);
        newXterm.loadAddon(searchAddon);
        newXterm.loadAddon(unicode11Addon);
        newXterm.unicode.activeVersion = '11';

        // Open new XTerm
        newXterm.open(terminalRef.current);

        // Write buffer content to new instance
        if (bufferContent.length > 0) {
          console.log('[TerminalTab] Writing buffer to new XTerm');
          newXterm.write(bufferContent);
        }

        // Fit and focus
        newFitAddon.fit();
        newXterm.focus();

        // Update refs to point to new instance
        xtermRef.current = newXterm;
        fitAddonRef.current = newFitAddon;

        // Dispose old XTerm
        oldXterm.dispose();

        // Re-setup terminal listeners for the fresh XTerm instance
        // The old listeners have a closure over the old xtermRef, so we need new ones
        console.log('[TerminalTab] Re-setting up terminal listeners for fresh XTerm');
        setupTerminalListeners(
          terminal.id,
          (data: string) => {
            if (xtermRef.current) {
              console.log('[TerminalTab] Writing IPC data to fresh XTerm:', data.substring(0, 50));
              xtermRef.current.write(data);
            }
          },
          (exitCode) => {
            console.log('Terminal exited with code:', exitCode);
            setTerminal((prev) => (prev ? { ...prev, status: 'stopped' } : null));
          }
        );

        // Note: Prompt is already included in serialized buffer content, no need to add manually

        console.log('[TerminalTab] Fresh XTerm created with restored buffer and listeners');
      }
    }
  }, [terminal, initializeXterm]);

  // Focus terminal when component mounts or becomes visible
  useEffect(() => {
    if (xtermRef.current) {
      // Focus the terminal to show cursor and enable input
      xtermRef.current.focus();
    }
  }, [terminal, xtermRef.current]);

  // Set up input/resize handlers after both xterm and terminal are ready
  useEffect(() => {
    console.log('[TerminalTab] Input handlers effect:', {
      hasTerminal: !!terminal,
      terminalId: terminal?.id,
      hasXterm: !!xtermRef.current,
    });

    if (terminal && xtermRef.current) {
      const xterm = xtermRef.current;

      console.log('[TerminalTab] Setting up input handlers for terminal:', terminal.id);

      // Set up input handling
      const onDataDisposable = xterm.onData((data) => {
        console.log('[TerminalTab] XTerm onData received:', {
          terminalId: terminal.id,
          data: data,
          dataLength: data.length,
          charCodes: Array.from(data).map((c) => c.charCodeAt(0)),
        });
        writeToTerminal(terminal.id, data).catch((err) => {
          console.error('Failed to write to terminal:', err);
        });
      });

      // Set up resize handling
      const onResizeDisposable = xterm.onResize(({ cols, rows }) => {
        resizeTerminal(terminal.id, cols, rows).catch((err) => {
          console.error('Failed to resize terminal:', err);
        });
      });

      console.log('[TerminalTab] Input handlers set up successfully');

      return () => {
        console.log('[TerminalTab] Cleaning up input handlers');
        onDataDisposable.dispose();
        onResizeDisposable.dispose();
      };
    }
    return undefined;
  }, [terminal, writeToTerminal, resizeTerminal]);

  // Restore or create terminal when project changes (using project ID as unique key)
  useEffect(() => {
    const projectId = selectedProjectId;
    const projectName = selectedProject?.name;
    const projectPath = selectedProject?.localPath;

    console.log('[TerminalTab] 🔍 PROJECT CHANGE EFFECT START', {
      projectId,
      projectName,
      projectPath,
      currentTerminalId: terminal?.id,
      hasTerminal: !!terminal,
      isLoading,
      error,
    });

    if (!projectId) {
      console.log('[TerminalTab] ⚠️ No project ID, skipping terminal setup');
      return;
    }

    // Check if we have an existing session for this project
    const existingSession = getTerminalSession(projectId);

    console.log('[TerminalTab] 📋 SESSION CHECK', {
      projectId,
      hasExistingSession: !!existingSession,
      existingSessionTerminalId: existingSession?.terminalId,
      previousRestored: restoredProjectIdRef.current,
      currentTerminalId: terminal?.id,
      isRestoredAlready: restoredProjectIdRef.current === projectId,
    });

    // If we have an existing session and it's not the current terminal, restore it
    if (existingSession && existingSession.terminalId !== terminal?.id) {
      console.log('[TerminalTab] 🔄 RESTORING terminal session for project:', projectId, {
        sessionTerminalId: existingSession.terminalId,
        currentTerminalId: terminal?.id,
      });
      setTerminal(existingSession.terminal);
      terminalIdRef.current = existingSession.terminalId;
      terminalOwnerProjectIdRef.current = projectId; // Track which project owns this restored terminal
      xtermRef.current = existingSession.xtermInstance;
      fitAddonRef.current = existingSession.fitAddon;

      // DOM attachment will be handled by the XTerm initialization effect (line 173-203)
      // which runs after this effect and ensures proper attachment

      // Mark this project's session as restored
      restoredProjectIdRef.current = projectId;
      console.log('[TerminalTab] ✅ Session restored successfully');
    } else if (!existingSession && !terminal && !isLoading && !error) {
      // Create new terminal only if no session exists and no terminal is currently set
      console.log('[TerminalTab] 🆕 CREATING new terminal for project:', projectId, {
        reason: 'no existing session AND no current terminal',
      });
      handleCreateTerminal();
      // Mark as restored once created
      restoredProjectIdRef.current = projectId;
    } else if (existingSession && existingSession.terminalId === terminal?.id) {
      console.log('[TerminalTab] ✓ Session already active for project:', projectId);
      restoredProjectIdRef.current = projectId;
    } else {
      console.log('[TerminalTab] ⚠️ NO ACTION TAKEN', {
        hasExistingSession: !!existingSession,
        hasTerminal: !!terminal,
        isLoading,
        error,
        reason: 'conditions not met for restore or create',
      });
    }
  }, [
    selectedProjectId,
    existingTerminalId,
    isLoading,
    error,
    handleCreateTerminal,
    getTerminalSession,
    terminal,
  ]);

  // Save terminal session when switching projects or unmounting (detach, don't destroy)
  useEffect(() => {
    const currentProjectId = selectedProjectId;
    console.log('[TerminalTab] 💾 SAVE EFFECT - Project tracking:', {
      previous: previousProjectIdRef.current,
      current: currentProjectId,
      hasTerminal: !!terminal,
      terminalId: terminal?.id,
    });

    // Only update tracking if project actually changed
    if (previousProjectIdRef.current !== currentProjectId) {
      // Save the session for the PREVIOUS project before switching
      const projectIdToSave = previousProjectIdRef.current;
      const terminalBelongsToPreviousProject =
        terminalOwnerProjectIdRef.current === projectIdToSave;

      if (
        projectIdToSave &&
        terminal &&
        xtermRef.current &&
        fitAddonRef.current &&
        terminalBelongsToPreviousProject
      ) {
        console.log(
          '[TerminalTab] 💾 SAVING terminal session for PREVIOUS project:',
          projectIdToSave,
          {
            terminalId: terminal.id,
            terminalOwner: terminalOwnerProjectIdRef.current,
            xtermExists: !!xtermRef.current,
            fitAddonExists: !!fitAddonRef.current,
          }
        );
        saveTerminalSession(projectIdToSave, {
          terminal,
          xtermInstance: xtermRef.current,
          fitAddon: fitAddonRef.current,
          terminalId: terminal.id,
          lastActive: new Date(),
        });
      } else {
        console.log('[TerminalTab] ⚠️ SKIPPING save for previous project:', {
          projectIdToSave,
          hasTerminal: !!terminal,
          terminalOwner: terminalOwnerProjectIdRef.current,
          terminalBelongsToPrevious: terminalBelongsToPreviousProject,
          hasXterm: !!xtermRef.current,
          hasFitAddon: !!fitAddonRef.current,
          reason: !terminalBelongsToPreviousProject
            ? 'terminal does not belong to previous project'
            : 'missing requirements',
        });
      }

      // Clear restored flag when switching projects to allow re-restoration
      console.log('[TerminalTab] 🔄 Clearing restored flag, was:', restoredProjectIdRef.current);
      restoredProjectIdRef.current = null;

      // Update previousProjectId for next change
      console.log('[TerminalTab] 📝 Updating previousProjectId:', {
        from: previousProjectIdRef.current,
        to: currentProjectId,
      });
      previousProjectIdRef.current = currentProjectId ?? null;
    }

    // Save on unmount (when switching away from terminal tab or changing projects)
    // IMPORTANT: Only save if the current terminal was created for THIS project
    // Don't save if we just switched to this project and haven't created a terminal yet
    return () => {
      const wasTerminalCreatedForThisProject =
        terminalOwnerProjectIdRef.current === currentProjectId;

      if (
        currentProjectId &&
        terminal &&
        xtermRef.current &&
        fitAddonRef.current &&
        wasTerminalCreatedForThisProject
      ) {
        console.log(
          '[TerminalTab] 🔚 UNMOUNTING - saving terminal session for:',
          currentProjectId,
          {
            terminalId: terminal.id,
            terminalOwner: terminalOwnerProjectIdRef.current,
            currentProject: currentProjectId,
            wasCreatedForProject: wasTerminalCreatedForThisProject,
          }
        );
        saveTerminalSession(currentProjectId, {
          terminal,
          xtermInstance: xtermRef.current,
          fitAddon: fitAddonRef.current,
          terminalId: terminal.id,
          lastActive: new Date(),
        });
      } else {
        console.log('[TerminalTab] 🔚 UNMOUNTING - SKIPPING save:', {
          currentProjectId,
          hasTerminal: !!terminal,
          terminalOwner: terminalOwnerProjectIdRef.current,
          wasCreatedForProject: wasTerminalCreatedForThisProject,
          reason: !wasTerminalCreatedForThisProject
            ? 'terminal not created for this project'
            : 'missing requirements',
        });
      }
    };
  }, [selectedProjectId, terminal, saveTerminalSession]); // Re-run when project or terminal changes

  // Render loading state
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Starting terminal...</span>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <div>
            <h3 className="font-semibold text-destructive mb-2">Terminal Error</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Ensure your shell is properly configured</p>
              <p>• Check if you have reached the 10-terminal limit</p>
              <p>• Try restarting the application if issues persist</p>
            </div>
          </div>
          <Button onClick={handleRetry} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Render terminal
  return (
    <div className={`flex flex-col h-full bg-terminal-bg ${className}`}>
      <div
        ref={terminalRef}
        className="flex-1 p-2 overflow-hidden text-sm bg-terminal-bg"
        style={{ minHeight: 0 }}
      />
    </div>
  );
};
