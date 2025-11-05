import { Button } from '@/components/ui/button';
import { useTerminal } from '@/hooks/useTerminal';
import { useProjectsStore, useTerminalStore } from '@/stores';
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
import { logger } from '@/commons/utils/logger';

interface TerminalTabProps {
  onTerminalCreated?: (terminal: Terminal) => void;
  className?: string;
}

export const TerminalTab: React.FC<TerminalTabProps> = ({ onTerminalCreated, className = '' }) => {
  // 🔍 HYPOTHESIS TRACKER: Component instance ID for debugging
  const componentInstanceId = useRef(`TerminalTab-${Math.random().toString(36).substring(7)}`);
  logger.info(`[HYPO-TRACK] Component render: ${componentInstanceId.current}`);

  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const terminalIdRef = useRef<string | null>(null); // Track terminal ID for cleanup
  const isCreatingRef = useRef<boolean>(false); // Prevent duplicate creation
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Get the selected project's local path from domain-specific store
  const selectedProjectId = useProjectsStore((state) => state.selectedProjectId);
  const projects = useProjectsStore((state) => state.projects);
  const selectedProject = selectedProjectId ? projects.get(selectedProjectId) : undefined;

  // Terminal session store
  const saveTerminalSession = useTerminalStore((state) => state.saveTerminalSession);
  const getTerminalSession = useTerminalStore((state) => state.getTerminalSession);
  const getLastTerminalForProject = useTerminalStore((state) => state.getLastTerminalForProject);

  const {
    createTerminal,
    writeToTerminal,
    resizeTerminal,
    setupTerminalListeners,
    removeTerminalListeners,
  } = useTerminal();

  /**
   * Clean problematic ANSI escape sequences from serialized buffer content.
   * Removes cursor positioning and movement codes that cause rendering issues
   * while preserving color and style codes.
   *
   * @param content - Serialized terminal buffer content with ANSI codes
   * @returns Cleaned content safe for restoration
   */
  const cleanSerializedContent = useCallback((content: string): string => {
    const beforeSize = content.length;
    const beforeLines = content.split('\n').length;

    // Count each type of problematic sequence before removal
    /* eslint-disable no-control-regex */
    const counts = {
      cursorPosition: (content.match(/\x1b\[\d+;\d+H/g) || []).length,
      cursorPositionAlt: (content.match(/\x1b\[\d+;\d+f/g) || []).length,
      cursorHome: (content.match(/\x1b\[H/g) || []).length,
      cursorHomeAlt: (content.match(/\x1b\[f/g) || []).length,
      cursorUp: (content.match(/\x1b\[\d*A/g) || []).length,
      cursorDown: (content.match(/\x1b\[\d*B/g) || []).length,
      cursorForward: (content.match(/\x1b\[\d*C/g) || []).length,
      cursorBack: (content.match(/\x1b\[\d*D/g) || []).length,
      clearScreen: (content.match(/\x1b\[2J/g) || []).length,
      clearScrollback: (content.match(/\x1b\[3J/g) || []).length,
      clearLine: (content.match(/\x1b\[K/g) || []).length,
      altBuffer: (content.match(/\x1b\[\?1049[hl]/g) || []).length,
      cursorShowHide: (content.match(/\x1b\[\?25[hl]/g) || []).length,
      bracketedPaste: (content.match(/\x1b\[\?2004[hl]/g) || []).length,
    };

    // Check for color codes (should be preserved)
    const colorCodes = (content.match(/\x1b\[\d+m/g) || []).length;

    const cleaned = content
      // Remove absolute cursor positioning (causes jumps)
      .replace(/\x1b\[\d+;\d+H/g, '') // CSI row;col H (cursor position)
      .replace(/\x1b\[\d+;\d+f/g, '') // CSI row;col f (alternate form)
      .replace(/\x1b\[H/g, '') // Cursor home (1,1)
      .replace(/\x1b\[f/g, '') // Cursor home (alternate)
      // Remove relative cursor movements
      .replace(/\x1b\[\d*A/g, '') // Cursor up
      .replace(/\x1b\[\d*B/g, '') // Cursor down
      .replace(/\x1b\[\d*C/g, '') // Cursor forward
      .replace(/\x1b\[\d*D/g, '') // Cursor back
      // Remove clear sequences
      .replace(/\x1b\[2J/g, '') // Clear screen
      .replace(/\x1b\[3J/g, '') // Clear scrollback
      .replace(/\x1b\[K/g, '') // Clear line
      // Remove mode switching
      .replace(/\x1b\[\?1049[hl]/g, '') // Alt buffer enable/disable
      .replace(/\x1b\[\?25[hl]/g, '') // Cursor show/hide
      .replace(/\x1b\[\?2004[hl]/g, ''); // Bracketed paste mode

    // Verify color codes are still present after cleaning
    const colorCodesAfter = (cleaned.match(/\x1b\[\d+m/g) || []).length;
    /* eslint-enable no-control-regex */

    const afterSize = cleaned.length;
    const afterLines = cleaned.split('\n').length;
    const totalRemoved = Object.values(counts).reduce((sum, count) => sum + count, 0);

    logger.info('[🧹 ANSI-CLEAN] Cleaned serialized content', {
      beforeSize,
      afterSize,
      sizeReduction: beforeSize - afterSize,
      beforeLines,
      afterLines,
      linesChanged: beforeLines !== afterLines,
      sequencesRemoved: totalRemoved,
      breakdown: counts,
      colorCodesPreserved: {
        before: colorCodes,
        after: colorCodesAfter,
        preserved: colorCodes === colorCodesAfter,
      },
      success: totalRemoved > 0 && colorCodes === colorCodesAfter,
    });

    if (totalRemoved === 0) {
      logger.warn('[🧹 ANSI-CLEAN] No problematic sequences found to remove', {
        contentPreview: content.substring(0, 100),
        possibleIssue: 'content_already_clean_or_unexpected_format',
      });
    }

    if (colorCodes !== colorCodesAfter) {
      logger.error('[🧹 ANSI-CLEAN] ERROR: Color codes were removed!', {
        colorCodesBefore: colorCodes,
        colorCodesAfter,
        lost: colorCodes - colorCodesAfter,
        criticalIssue: 'color_preservation_failed',
      });
    }

    return cleaned;
  }, []);

  /**
   * Initialize xterm.js instance
   */
  const initializeXterm = useCallback(
    (terminalId?: string) => {
      // 🔍 HYPOTHESIS B5: Track XTerm instance creation
      logger.info('[HYPO-B5-XTERM-CREATE] initializeXterm called', {
        componentId: componentInstanceId.current,
        terminalId: terminalId?.substring(0, 8),
        hasTerminalRef: !!terminalRef.current,
        hasExistingXterm: !!xtermRef.current,
        existingXtermId: xtermRef.current ? 'exists' : 'none',
        willSkip: !terminalRef.current || !!xtermRef.current,
      });

      if (!terminalRef.current || xtermRef.current) {
        logger.info('[HYPO-B5-XTERM-CREATE] Skipping - ref missing or xterm exists', {
          componentId: componentInstanceId.current,
          reason: !terminalRef.current ? 'no_terminal_ref' : 'xterm_already_exists',
        });
        return;
      }

      logger.info('[HYPO-B5-XTERM-CREATE] Creating new XTerm instance', {
        componentId: componentInstanceId.current,
        terminalId: terminalId?.substring(0, 8),
      });

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
        cursorStyle: 'bar', // Thin vertical bar cursor (like VS Code)
        cursorWidth: 7, // 7px width (1.1x the previous 6px)
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

      // 🔧 FIX: Restore buffer content from saved session if available
      if (terminalId) {
        logger.info('[DEBUG-RESTORE-1] Looking up session', {
          terminalId: terminalId.substring(0, 8),
        });

        const session = getTerminalSession(terminalId);

        logger.info('[DEBUG-RESTORE-2] Session lookup result', {
          terminalId: terminalId.substring(0, 8),
          found: !!session,
          hasBufferContent: !!session?.bufferContent,
          bufferSize: session?.bufferContent?.length || 0,
          sessionTerminalId: session?.terminalId?.substring(0, 8),
          idsMatch: session?.terminalId === terminalId,
        });

        if (session?.bufferContent && session.bufferContent.length > 0) {
          // 🔍 ENHANCED: Check what we're about to restore
          const hasPwdCommand = session.bufferContent.includes('pwd');
          const hasAnsiSequences = session.bufferContent.includes('\x1b[');
          const hasClearSequence =
            session.bufferContent.includes('\x1b[2J') || session.bufferContent.includes('\x1b[H');
          const lastFewLines = session.bufferContent.split('\n').slice(-5).join('\\n');
          const restoreCols = xterm.cols;
          const restoreRows = xterm.rows;
          const restoreCursorYBefore = xterm.buffer.active.cursorY;
          const restoreCursorXBefore = xterm.buffer.active.cursorX;

          logger.info('[DEBUG-RESTORE-3] Before write', {
            terminalId: terminalId.substring(0, 8),
            xtermExists: !!xterm,
            xtermBufferLinesBefore: xterm.buffer.active.length,
            bufferContentToWrite: session.bufferContent.length,
            bufferContentPreview: session.bufferContent.substring(0, 100).replace(/\n/g, '\\n'),
            cursorPositionBefore: `${restoreCursorYBefore},${restoreCursorXBefore}`,
            dimensionsOnRestore: `${restoreCols}x${restoreRows}`,
          });

          // 🔍 CRITICAL: Log pwd detection BEFORE the main log to avoid truncation
          logger.info(
            `[🔍 PWD-RESTORE] terminalId=${terminalId.substring(0, 8)} HAS_PWD=${hasPwdCommand} HAS_ANSI=${hasAnsiSequences} HAS_CLEAR=${hasClearSequence} cursor_before=${restoreCursorYBefore},${restoreCursorXBefore} dims=${restoreCols}x${restoreRows}`
          );

          // 🔍 CRITICAL: Show actual buffer content with pwd if present
          if (hasPwdCommand) {
            const pwdLineIndex = session.bufferContent
              .split('\n')
              .findIndex((line) => line.includes('pwd'));
            const pwdContext = session.bufferContent
              .split('\n')
              .slice(Math.max(0, pwdLineIndex - 2), pwdLineIndex + 3)
              .join('\\n');
            logger.info(
              `[🔍 PWD-RESTORE-CONTENT] PWD FOUND at line ${pwdLineIndex}: ${pwdContext.substring(0, 200)}`
            );
          }

          logger.info('[🔧 BUFFER-RESTORE-NEW] Restoring saved buffer to new XTerm', {
            terminalId: terminalId.substring(0, 8),
            bufferSize: session.bufferContent.length,
            bufferLines: session.bufferContent.split('\n').length,
            bufferPreview: session.bufferContent.substring(0, 100).replace(/\n/g, '\\n'),
            lastFewLines,
            hasPwdCommand,
            hasAnsiSequences,
            hasClearSequence,
            dimensions: `${restoreCols}x${restoreRows}`,
            source: 'saved_session',
          });

          xterm.write(session.bufferContent);

          // 🔧 FIX: Restore cursor position AND viewport after buffer write
          if (session.cursorY !== undefined && session.cursorX !== undefined) {
            // Use ANSI escape sequence to position cursor
            const cursorPositionSequence = `\x1b[${session.cursorY + 1};${session.cursorX + 1}H`;
            xterm.write(cursorPositionSequence);

            // 🔧 FIX: Also scroll viewport to show the cursor position
            // If cursor is at line 9 in a 39-line terminal, we want to scroll so line 9 is visible
            const viewportLine = Math.max(0, session.cursorY - Math.floor(restoreRows / 2));
            xterm.scrollToLine(viewportLine);

            logger.info(
              `[🔧 CURSOR-RESTORE] Restored cursor to saved position: (${session.cursorY},${session.cursorX}), viewport scrolled to line ${viewportLine}`
            );
          } else {
            logger.warn('[🔧 CURSOR-RESTORE] No saved cursor position, cursor at default (0,0)');
          }

          // 🔍 ENHANCED: Compare terminal state after restore
          const restoreCursorYAfter = xterm.buffer.active.cursorY;
          const restoreCursorXAfter = xterm.buffer.active.cursorX;
          const actualBufferLines = xterm.buffer.active.length;

          logger.info('[DEBUG-RESTORE-4] Immediately after write', {
            terminalId: terminalId.substring(0, 8),
            xtermBufferLinesAfter: actualBufferLines,
            writtenSuccessfully: actualBufferLines > 1,
            cursorPositionAfter: `${restoreCursorYAfter},${restoreCursorXAfter}`,
            cursorMoved: `(${restoreCursorYBefore},${restoreCursorXBefore}) → (${restoreCursorYAfter},${restoreCursorXAfter})`,
            savedCursorPosition:
              session.cursorY !== undefined ? `${session.cursorY},${session.cursorX}` : 'not_saved',
          });

          logger.info('[🔧 BUFFER-RESTORE-NEW] Buffer restored successfully', {
            terminalId: terminalId.substring(0, 8),
            xtermBufferLines: actualBufferLines,
            expectedLines: session.bufferContent.split('\n').length,
            linesMismatch: actualBufferLines !== session.bufferContent.split('\n').length,
            cursorPosition: `${restoreCursorYAfter},${restoreCursorXAfter}`,
          });

          // Check if write persists (async verification)
          setTimeout(() => {
            logger.info('[DEBUG-RESTORE-5] 100ms after write', {
              terminalId: terminalId.substring(0, 8),
              xtermBufferLines: xterm.buffer.active.length,
              stillHasContent: xterm.buffer.active.length > 1,
            });
          }, 100);

          setTimeout(() => {
            logger.info('[DEBUG-RESTORE-6] 500ms after write', {
              terminalId: terminalId.substring(0, 8),
              xtermBufferLines: xterm.buffer.active.length,
              stillHasContent: xterm.buffer.active.length > 1,
            });
          }, 500);
        } else {
          logger.debug('[🔧 BUFFER-RESTORE-NEW] No saved buffer content for new terminal', {
            terminalId: terminalId.substring(0, 8),
            hasSession: !!session,
            hasBufferContent: !!session?.bufferContent,
            bufferContentLength: session?.bufferContent?.length || 0,
          });
        }
      }

      // CRITICAL FIX: Set up IPC listeners AFTER XTerm is created and buffer restored
      // This ensures the listener closure captures the correct XTerm instance
      if (terminalId) {
        logger.info('[TerminalTab] Setting up IPC listeners after XTerm creation', {
          terminalId,
          channel: `terminal:data:${terminalId}`,
          capturedInstance: 'xterm (just created)',
        });

        setupTerminalListeners(
          terminalId,
          (data: string) => {
            // Capture the XTerm instance that was just created
            // 🔍 ENHANCED: Track if backend sends fresh prompt that conflicts with restored buffer
            const isPromptLike = data.includes('$') || data.includes('#') || data.includes('>');
            const hasAnsiEscapes = data.includes('\x1b[');
            const hasClearSequence = data.includes('\x1b[2J') || data.includes('\x1b[H');
            const bufferLinesBefore = xterm.buffer.active.length;
            const cursorYBefore = xterm.buffer.active.cursorY;

            logger.info(
              `[DIAG-H3-XTERM-WRITE] terminalId=${terminalId.substring(0, 8)} dataLen=${data.length} dataPreview=${data.substring(0, 30).replace(/\n/g, '\\n')} xtermRefId=${xtermRef.current ? 'ref-instance' : 'null'} capturedXtermId=${'captured-instance'} bufferLines=${bufferLinesBefore} cursorY=${cursorYBefore} isPromptLike=${isPromptLike} hasClear=${hasClearSequence}`
            );

            xterm.write(data);

            const bufferLinesAfter = xterm.buffer.active.length;
            const cursorYAfter = xterm.buffer.active.cursorY;

            logger.debug('[TerminalTab] IPC data written to XTerm', {
              terminalId,
              dataLength: data.length,
              instanceType: 'captured_xterm',
              bufferChange: `${bufferLinesBefore} → ${bufferLinesAfter}`,
              cursorChange: `${cursorYBefore} → ${cursorYAfter}`,
              hasAnsiEscapes,
              hasClearSequence,
            });
          },
          (exitCode) => {
            logger.info('[TerminalTab] Terminal exited', {
              terminalId,
              exitCode,
            });
            setTerminal((prev) => (prev ? { ...prev, status: 'stopped' } : null));
          }
        );

        logger.info('[TerminalTab] IPC listeners set up successfully', {
          terminalId,
        });
      }

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
    },
    [setupTerminalListeners, cleanSerializedContent]
  );

  /**
   * Create new terminal
   */
  const handleCreateTerminal = useCallback(async () => {
    logger.debug('[TerminalTab] handleCreateTerminal called', {
      isCreating: isCreatingRef.current,
      projectPath: selectedProject?.localPath,
      currentTerminalId: terminalIdRef.current,
    });

    // Prevent duplicate creation (React Strict Mode calls effects twice)
    if (isCreatingRef.current) {
      logger.warn('[TerminalTab] Already creating terminal, skipping duplicate call');
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

      logger.info('[TerminalTab] Terminal created successfully', {
        terminalId: newTerminal.id,
        projectPath: selectedProject?.localPath,
      });

      // Add terminal to Zustand store for input handler checks
      const { addTerminal } = useTerminalStore.getState();
      try {
        addTerminal(newTerminal);
        logger.debug('[TerminalTab] Terminal added to store', {
          terminalId: newTerminal.id,
          storeSize: useTerminalStore.getState().terminals.size,
        });
      } catch (err) {
        logger.error('[TerminalTab] Failed to add terminal to store', {
          terminalId: newTerminal.id,
          error: err,
        });
        throw err;
      }

      terminalIdRef.current = newTerminal.id; // Save ID to ref for cleanup
      setTerminal(newTerminal);
      onTerminalCreated?.(newTerminal);

      // NOTE: Do NOT set up listeners here!
      // Listeners will be set up in the initializeXterm effect after XTerm is created
      // This prevents the listener closure from capturing the wrong xtermRef
      logger.debug('[TerminalTab] Terminal created, deferring listener setup to XTerm creation', {
        terminalId: newTerminal.id,
        reason: 'prevent_ref_capture_bug',
      });

      // Reset flag after successful creation to allow future terminal creation
      isCreatingRef.current = false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create terminal';
      setError(errorMessage);
      logger.error('[TerminalTab] Terminal creation failed', {
        error: errorMessage,
        projectPath: selectedProject?.localPath,
      });
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
    // 🔍 HYPOTHESIS B3: Track effect execution count for double-render detection
    const effectExecutionId = `${componentInstanceId.current}-${Date.now()}`;

    logger.info('[HYPO-B3-EFFECT-RUN] XTerm initialization effect triggered', {
      componentId: componentInstanceId.current,
      effectExecutionId,
      hasTerminal: !!terminal,
      terminalId: terminal?.id.substring(0, 8),
      terminalObjectRef: terminal ? `term-obj-${Object.keys(terminal).length}` : 'none',
      hasXtermRef: !!xtermRef.current,
      hasTerminalRef: !!terminalRef.current,
      terminalIdRef: terminalIdRef.current?.substring(0, 8),
      willCreateNew: !!(terminal && !xtermRef.current),
      willRestore: !!(terminal && xtermRef.current && terminalRef.current),
      dependencies: {
        terminalId: terminal?.id.substring(0, 8),
        terminalObjectChanged: 'see_terminalObjectRef_above',
      },
    });

    logger.debug('[🔍 THEORY-A] XTerm initialization effect triggered', {
      hasTerminal: !!terminal,
      terminalId: terminal?.id,
      hasXtermRef: !!xtermRef.current,
      hasTerminalRef: !!terminalRef.current,
      terminalIdRef: terminalIdRef.current,
      willCreateNew: !!(terminal && !xtermRef.current),
      willRestore: !!(terminal && xtermRef.current && terminalRef.current),
    });

    if (terminal && !xtermRef.current) {
      // Create new XTerm instance for newly created terminal
      logger.info('[TerminalTab] Creating new XTerm for new terminal', {
        terminalId: terminal.id,
      });
      // Pass terminal ID so listeners can be set up with correct closure
      initializeXterm(terminal.id);
    } else if (terminal && xtermRef.current && terminalRef.current) {
      // Handle restored terminal - check if XTerm needs reattachment
      const oldXterm = xtermRef.current;

      // ALWAYS refresh when terminal ID changes, even if xterm is attached
      // This ensures we show the correct terminal after restoration
      const terminalIdChanged = terminalIdRef.current !== terminal.id;

      logger.info('[🔍 THEORY-B] Checking if XTerm needs refresh', {
        terminalId: terminal.id,
        previousTerminalId: terminalIdRef.current,
        terminalIdChanged,
        hasOldElement: !!oldXterm.element,
        parentMatch: oldXterm.element?.parentElement === terminalRef.current,
        willRefresh:
          !oldXterm.element ||
          oldXterm.element.parentElement !== terminalRef.current ||
          terminalIdChanged,
      });

      // Check if xterm is not attached to the current ref OR terminal ID changed
      if (
        !oldXterm.element ||
        oldXterm.element.parentElement !== terminalRef.current ||
        terminalIdChanged
      ) {
        logger.info('[TerminalTab] Restored terminal needs fresh XTerm instance', {
          terminalId: terminal.id,
          previousTerminalId: terminalIdRef.current,
          terminalIdChanged,
          hasOldElement: !!oldXterm.element,
          bufferLength: oldXterm.buffer?.active.length,
          reason: !oldXterm.element
            ? 'no_element'
            : oldXterm.element.parentElement !== terminalRef.current
              ? 'parent_mismatch'
              : 'terminal_id_changed',
        });

        // CRITICAL FIX: Remove old terminal listeners BEFORE creating new ones
        if (terminalIdRef.current && terminalIdRef.current !== terminal.id) {
          logger.info('[TerminalTab] Removing old listeners to prevent leak', {
            oldTerminalId: terminalIdRef.current,
            newTerminalId: terminal.id,
            oldChannel: `terminal:data:${terminalIdRef.current}`,
            newChannel: `terminal:data:${terminal.id}`,
          });
          removeTerminalListeners(terminalIdRef.current);
          logger.info('[TerminalTab] Old listeners removed successfully', {
            oldTerminalId: terminalIdRef.current,
          });
        }

        // Extract buffer content from old XTerm using SerializeAddon to preserve ANSI codes
        const serializeAddon = new SerializeAddon();
        oldXterm.loadAddon(serializeAddon);
        const bufferContent = serializeAddon.serialize();

        logger.info('[🔍 BUFFER-EXTRACT] Extracted buffer content with ANSI codes', {
          terminalId: terminal.id.substring(0, 8),
          bufferSize: bufferContent.length,
          bufferLines: oldXterm.buffer?.active.length || 0,
          bufferPreview: bufferContent.substring(0, 100).replace(/\n/g, '\\n'),
          oldXtermCursorY: oldXterm.buffer?.active.cursorY || 0,
          extractionMethod: 'SerializeAddon',
          nextStep: 'will_write_to_new_xterm_after_open',
        });

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
          cursorStyle: 'bar', // Thin vertical bar cursor (like VS Code)
          cursorWidth: 7, // 7px width (1.1x the previous 6px)
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

        // CRITICAL FIX: Set up listeners BEFORE opening XTerm to avoid race condition
        // Capture the new XTerm instance in closure to avoid ref confusion
        logger.info('[TerminalTab] Setting up listeners BEFORE opening XTerm (race fix)', {
          terminalId: terminal.id,
          channel: `terminal:data:${terminal.id}`,
          capturedInstance: 'newXterm (closure)',
        });
        setupTerminalListeners(
          terminal.id,
          (data: string) => {
            // Use captured newXterm instead of xtermRef.current to avoid ref confusion
            // HYPOTHESIS LOGGING: Track XTerm.write() calls for restored terminals
            logger.info(
              `[DIAG-H3-XTERM-WRITE-RESTORED] terminalId=${terminal.id.substring(0, 8)} dataLen=${data.length} dataPreview=${data.substring(0, 30).replace(/\n/g, '\\n')} xtermRefId=${xtermRef.current ? 'ref-instance' : 'null'} capturedNewXtermId=${'captured-newXterm'} bufferLines=${newXterm.buffer.active.length} cursorY=${newXterm.buffer.active.cursorY}`
            );
            newXterm.write(data);
            logger.debug('[TerminalTab] IPC data written to captured XTerm instance', {
              terminalId: terminal.id,
              dataPreview: data.substring(0, 50),
              dataLength: data.length,
              instanceType: 'captured_newXterm',
            });
          },
          (exitCode) => {
            logger.info('[TerminalTab] Terminal exited', {
              terminalId: terminal.id,
              exitCode,
            });
            setTerminal((prev) => (prev ? { ...prev, status: 'stopped' } : null));
          }
        );

        // Dispose old XTerm AFTER setting up new listeners
        logger.debug('[TerminalTab] Disposing old XTerm after listener setup', {
          oldTerminalId: terminalIdRef.current,
          newTerminalId: terminal.id,
        });
        oldXterm.dispose();

        // Clear the container element to ensure no residual content
        if (terminalRef.current) {
          terminalRef.current.innerHTML = '';
          logger.debug('[TerminalTab] Container element cleared', {
            terminalId: terminal.id,
          });
        }

        // Open new XTerm into the clean container (listeners already active)
        newXterm.open(terminalRef.current);
        logger.info('[TerminalTab] New XTerm opened in container', {
          terminalId: terminal.id,
          listenersActive: true,
        });

        // 🔧 FIX: Write extracted buffer content to restore visual state
        // This fixes the "Term A -> Term B -> Term A shows empty terminal" bug
        logger.info('[🔧 BUFFER-RESTORE] Writing extracted buffer to new XTerm', {
          terminalId: terminal.id.substring(0, 8),
          bufferContentLength: bufferContent.length,
          bufferLines: bufferContent.split('\n').length,
          bufferPreview: bufferContent.substring(0, 100).replace(/\n/g, '\\n'),
          newXtermBufferBefore: newXterm.buffer.active.length,
          action: 'restore_visual_state',
        });

        if (bufferContent && bufferContent.length > 0) {
          newXterm.write(bufferContent);
          logger.info('[🔧 BUFFER-RESTORE] Buffer written successfully', {
            terminalId: terminal.id.substring(0, 8),
            newXtermBufferAfter: newXterm.buffer.active.length,
            bufferRestored: true,
          });
        } else {
          logger.warn('[🔧 BUFFER-RESTORE] No buffer content to restore', {
            terminalId: terminal.id.substring(0, 8),
            bufferContentLength: bufferContent.length,
            oldXtermBufferLength: oldXterm.buffer?.active.length || 0,
            possibleIssue: 'oldXterm_had_no_content_or_extraction_failed',
          });
        }

        // Fit and focus
        newFitAddon.fit();
        newXterm.focus();

        // Update refs to point to new instance
        xtermRef.current = newXterm;
        fitAddonRef.current = newFitAddon;

        // CRITICAL FIX: Update terminalIdRef to track the current terminal
        const previousId = terminalIdRef.current;
        terminalIdRef.current = terminal.id;

        logger.info('[✅ SWITCH-COMPLETE] Terminal restoration complete', {
          previousTerminalId: previousId,
          currentTerminalId: terminal.id.substring(0, 8),
          xtermRefUpdated: true,
          terminalIdRefUpdated: true,
          listenersSetup: true,
          bufferRestored: bufferContent.length > 0,
          finalBufferLines: newXterm.buffer.active.length,
          successCriteria: {
            hasXterm: true,
            hasListeners: true,
            hasBuffer: newXterm.buffer.active.length > 1,
            cursorPosition: newXterm.buffer.active.cursorY,
          },
        });

        // 🔍 ONE-LINE DEBUG SUMMARY for Term A → Term B → Term A
        logger.info(
          `[🔍 SUMMARY] Term switch restoration: ${previousId ? previousId.substring(0, 8) : 'initial'} → ${terminal.id.substring(0, 8)} | Buffer: ${bufferContent.length}B (${bufferContent.split('\n').length} lines) → XTerm: ${newXterm.buffer.active.length} lines | Success: ${newXterm.buffer.active.length > 1 ? '✅' : '❌ EMPTY'} | ${newXterm.buffer.active.length > 1 ? 'User should see content' : 'BUG: Check [🔍 BUFFER-EXTRACT] and [🔧 BUFFER-RESTORE] logs'}`
        );
      } else {
        // THEORY-C: XTerm exists and is attached, no refresh needed
        logger.warn('[🔍 THEORY-C] XTerm already attached, skipping refresh', {
          terminalId: terminal.id,
          terminalIdRef: terminalIdRef.current,
          xtermElement: !!oldXterm.element,
          parentMatches: oldXterm.element?.parentElement === terminalRef.current,
          possibleIssue: 'visual_artifact_if_wrong_terminal',
        });
      }
    } else {
      logger.debug('[🔍 THEORY-D] XTerm effect conditions not met', {
        hasTerminal: !!terminal,
        hasXtermRef: !!xtermRef.current,
        hasTerminalRef: !!terminalRef.current,
      });
    }

    // CRITICAL FIX: Add cleanup function to remove listeners when terminal changes
    // Capture the current terminal ID in the cleanup closure
    const currentTerminalId = terminal?.id;
    return () => {
      // Only remove listeners if the terminal ID has actually changed
      // Don't remove if terminalIdRef matches the terminal we just set up
      if (
        terminalIdRef.current &&
        currentTerminalId &&
        terminalIdRef.current !== currentTerminalId
      ) {
        logger.info('[TerminalTab] Effect cleanup: Removing listeners for old terminal', {
          oldTerminalId: terminalIdRef.current,
          newTerminalId: currentTerminalId,
          reason: 'terminal_changed',
        });
        removeTerminalListeners(terminalIdRef.current);
      }
    };
    // 🔧 FIX: Depend on terminal?.id instead of terminal object
    // This prevents double-runs when terminal object reference changes but ID is the same
  }, [terminal?.id, initializeXterm, removeTerminalListeners]);

  // Focus terminal when component mounts or becomes visible
  useEffect(() => {
    if (xtermRef.current) {
      // Focus the terminal to show cursor and enable input
      xtermRef.current.focus();
    }
  }, [terminal, xtermRef.current]);

  // Set up input/resize handlers after both xterm and terminal are ready
  useEffect(() => {
    logger.debug('[TerminalTab] Input handlers effect triggered', {
      hasTerminal: !!terminal,
      terminalId: terminal?.id,
      hasXterm: !!xtermRef.current,
    });

    if (terminal && xtermRef.current) {
      const xterm = xtermRef.current;

      logger.info('[🔍 THEORY-F] Setting up input handlers', {
        terminalId: terminal.id,
        xtermBufferLines: xterm.buffer?.active.length || 0,
        xtermCursorY: xterm.buffer?.active.cursorY || 0,
        willCheckStoreBeforeInput: true,
      });

      // Capture terminal ID in a ref to check if it's still valid
      const terminalIdRef = { current: terminal.id };

      // Set up input handling
      const onDataDisposable = xterm.onData((data) => {
        const terminals = useTerminalStore.getState().terminals;
        const isInStore = terminals.has(terminalIdRef.current);

        logger.debug('[🔍 THEORY-G] XTerm onData received', {
          terminalId: terminalIdRef.current,
          dataLength: data.length,
          charCodes: Array.from(data)
            .map((c) => c.charCodeAt(0))
            .slice(0, 10),
          isInStore,
          storeSize: terminals.size,
          willBlock: !isInStore,
        });

        // Check if terminal still exists in store before writing
        if (!isInStore) {
          logger.error('[🔍 THEORY-G-FAIL] Terminal not in store, input blocked!', {
            terminalId: terminalIdRef.current,
            availableTerminals: Array.from(terminals.keys()).map((id) => id.substring(0, 8)),
            terminalCount: terminals.size,
            possibleCause: 'terminal_removed_during_project_switch',
          });
          return;
        }
        writeToTerminal(terminalIdRef.current, data).catch((err) => {
          logger.error('[TerminalTab] Failed to write to terminal', {
            terminalId: terminalIdRef.current,
            error: err,
          });
        });
      });

      // Set up resize handling
      const onResizeDisposable = xterm.onResize(({ cols, rows }) => {
        logger.debug('[TerminalTab] XTerm onResize received', {
          terminalId: terminalIdRef.current,
          cols,
          rows,
        });
        // Check if terminal still exists in store before resizing
        const terminals = useTerminalStore.getState().terminals;
        if (!terminals.has(terminalIdRef.current)) {
          logger.warn('[TerminalTab] Terminal no longer exists in store, ignoring resize', {
            terminalId: terminalIdRef.current,
            availableTerminals: Array.from(terminals.keys()),
          });
          return;
        }
        resizeTerminal(terminalIdRef.current, cols, rows).catch((err) => {
          logger.error('[TerminalTab] Failed to resize terminal', {
            terminalId: terminalIdRef.current,
            cols,
            rows,
            error: err,
          });
        });
      });

      logger.info('[TerminalTab] Input handlers set up successfully', {
        terminalId: terminal.id,
      });

      return () => {
        logger.debug('[TerminalTab] Cleaning up input handlers', {
          terminalId: terminal.id,
        });
        onDataDisposable.dispose();
        onResizeDisposable.dispose();
      };
    }
    return undefined;
  }, [terminal, writeToTerminal, resizeTerminal]);

  // Track current project and manage session restoration
  const prevProjectIdRef = useRef<string | null>(null);
  const effectRunCountRef = useRef<number>(0);
  const lastRestoredTerminalIdRef = useRef<string | null>(null);

  useEffect(() => {
    effectRunCountRef.current += 1;
    const effectRunId = effectRunCountRef.current;

    const projectId = selectedProjectId;
    const prevProjectId = prevProjectIdRef.current;

    logger.debug('[TerminalTab] Project change effect triggered', {
      effectRunId,
      projectChanged: prevProjectId !== null && prevProjectId !== projectId,
      hasTerminal: !!terminal,
      currentTerminal: terminal?.id,
    });

    if (!projectId) {
      logger.warn('[TerminalTab] No project ID, skipping terminal setup');
      return undefined;
    }

    // Check if project actually changed (not just re-render)
    const projectChanged = prevProjectId !== null && prevProjectId !== projectId;

    // Save current terminal session when switching projects
    if (projectChanged && prevProjectId && terminal && xtermRef.current && fitAddonRef.current) {
      logger.info('[🔍 SWITCH-SAVE] Starting project switch - saving session', {
        scenario: `${prevProjectId.substring(0, 8)} → ${projectId.substring(0, 8)}`,
        previousProjectId: prevProjectId,
        newProjectId: projectId,
        terminalId: terminal.id.substring(0, 8),
        xtermBufferLines: xtermRef.current.buffer?.active.length || 0,
        xtermBufferContent: xtermRef.current.buffer?.active.length || 0,
        action: 'project_switch_save',
      });

      // 🔧 FIX: Extract buffer content BEFORE disposing XTerm
      // This is the ONLY time we have access to the XTerm instance with content

      // 🔍 ENHANCED: Track terminal state before save
      const cursorY = xtermRef.current?.buffer?.active.cursorY || 0;
      const cursorX = xtermRef.current?.buffer?.active.cursorX || 0;
      const cols = xtermRef.current?.cols || 0;
      const rows = xtermRef.current?.rows || 0;

      logger.info('[DEBUG-SAVE-1] Before extraction', {
        terminalId: terminal.id.substring(0, 8),
        xtermExists: !!xtermRef.current,
        bufferLength: xtermRef.current?.buffer?.active.length || 0,
        cursorY,
        cursorX,
        dimensions: `${cols}x${rows}`,
      });

      // 🔧 FIX: Use SerializeAddon with scrollback to capture FULL buffer with ANSI codes
      const serializeAddon = new SerializeAddon();
      xtermRef.current.loadAddon(serializeAddon);

      // CRITICAL: SerializeAddon only captures the viewport by default!
      // We need to serialize INCLUDING scrollback to get all content
      const buffer = xtermRef.current.buffer.active;
      const activeBufferLength = buffer.length;
      const viewportY = buffer.viewportY;
      const baseY = buffer.baseY;
      const bufferCursorY = buffer.cursorY;

      // The actual content range is from baseY to (baseY + rows)
      // baseY is the line index of the first line in the scrollback buffer
      const actualStartLine = baseY;
      const actualEndLine = baseY + rows;

      // 🔧 FIX: Use the CORRECT range based on baseY (scrollback start) and viewport
      logger.info('[🔍 BUFFER-SAVE] Attempting SerializeAddon with range', {
        terminalId: terminal.id.substring(0, 8),
        activeBufferLength,
        viewportY,
        baseY,
        cursorY: bufferCursorY,
        rows,
        actualStartLine,
        actualEndLine,
        totalLinesToCapture: actualEndLine - actualStartLine,
      });

      // Try without range first to see what we get
      let bufferContent = serializeAddon.serialize({
        excludeAltBuffer: true,
        excludeModes: false,
        // Don't use range - it causes errors. Use scrollback instead.
      });

      const beforeCleanSize = bufferContent.length;
      const beforeCleanLines = bufferContent.split('\n').length;
      // eslint-disable-next-line no-control-regex
      const beforeCleanHasAnsi = bufferContent.includes('\x1b[');

      logger.info('[🔍 BUFFER-SAVE] SerializeAddon raw output', {
        terminalId: terminal.id.substring(0, 8),
        rawSize: beforeCleanSize,
        rawLines: beforeCleanLines,
        hasAnsiCodes: beforeCleanHasAnsi,
        // eslint-disable-next-line no-control-regex
        preview: bufferContent.substring(0, 200).replace(/\x1b/g, '<ESC>'),
      });

      // 🔧 FIX: Clean up problematic ANSI sequences that cause rendering issues
      // KEEP color codes (e.g., \x1b[31m for red), REMOVE cursor movement and clear codes
      bufferContent = cleanSerializedContent(bufferContent);

      const serializedLines = bufferContent.split('\n').length;

      logger.info('[🔍 BUFFER-SAVE] SerializeAddon extraction attempt', {
        terminalId: terminal.id.substring(0, 8),
        activeBufferLength,
        serializedLines,
        viewportY,
        baseY,
        rangeUsed: true,
        mismatch: activeBufferLength > serializedLines + 5, // Allow some margin
      });

      // If SerializeAddon STILL failed to capture full buffer, manually serialize (WITHOUT ANSI)
      if (activeBufferLength > serializedLines + 5) {
        logger.warn('[🔍 BUFFER-SAVE] SerializeAddon missed content, using manual serialization', {
          terminalId: terminal.id.substring(0, 8),
          expectedLines: activeBufferLength,
          gotLines: serializedLines,
        });

        // Manual buffer serialization - captures ALL lines including scrollback
        const buffer = xtermRef.current.buffer.active;
        const manualLines: string[] = [];

        for (let i = 0; i < buffer.length; i++) {
          const line = buffer.getLine(i);
          if (line) {
            // 🔧 FIX: Use translateToString with range to preserve ANSI codes
            // Parameters: (trimRight, startCol, endCol)
            // We need to get the FULL line with ANSI sequences
            const lineText = line.translateToString(false);
            manualLines.push(lineText);
          }
        }

        bufferContent = manualLines.join('\n');

        logger.info('[🔍 BUFFER-SAVE] Manual serialization complete', {
          terminalId: terminal.id.substring(0, 8),
          manualLines: manualLines.length,
          manualSize: bufferContent.length,
        });
      }

      // 🔍 ENHANCED: Check for "pwd" command and ANSI sequences
      const hasPwdCommand = bufferContent.includes('pwd');
      const hasAnsiSequences = bufferContent.includes('\x1b[');
      const hasClearSequence =
        bufferContent.includes('\x1b[2J') || bufferContent.includes('\x1b[H');
      const lastFewLines = bufferContent.split('\n').slice(-5).join('\\n');

      // 🔍 CRITICAL: Log pwd detection BEFORE the main log to avoid truncation
      logger.info(
        `[🔍 PWD-SAVE] terminalId=${terminal.id.substring(0, 8)} HAS_PWD=${hasPwdCommand} HAS_ANSI=${hasAnsiSequences} HAS_CLEAR=${hasClearSequence} cursor=${cursorY},${cursorX} dims=${cols}x${rows}`
      );

      // 🔍 CRITICAL: Show actual buffer content with pwd if present
      if (hasPwdCommand) {
        const pwdLineIndex = bufferContent.split('\n').findIndex((line) => line.includes('pwd'));
        const pwdContext = bufferContent
          .split('\n')
          .slice(Math.max(0, pwdLineIndex - 2), pwdLineIndex + 3)
          .join('\\n');
        logger.info(
          `[🔍 PWD-SAVE-CONTENT] PWD FOUND at line ${pwdLineIndex}: ${pwdContext.substring(0, 200)}`
        );
      }

      logger.info('[🔍 BUFFER-SAVE] Final buffer extracted', {
        terminalId: terminal.id.substring(0, 8),
        bufferSize: bufferContent.length,
        bufferLines: bufferContent.split('\n').length,
        bufferPreview: bufferContent.substring(0, 100).replace(/\n/g, '\\n'),
        lastFewLines,
        hasPwdCommand,
        hasAnsiSequences,
        hasClearSequence,
        cursorPosition: `${cursorY},${cursorX}`,
        dimensions: `${cols}x${rows}`,
        xtermBufferLines: activeBufferLength,
        method: activeBufferLength > serializedLines + 5 ? 'manual' : 'SerializeAddon',
        reason: 'save_for_later_restoration',
      });

      logger.info('[DEBUG-SAVE-2] After extraction', {
        terminalId: terminal.id.substring(0, 8),
        contentLength: bufferContent.length,
        contentLines: bufferContent.split('\n').length,
        contentPreview: bufferContent.substring(0, 200).replace(/\n/g, '\\n'),
        contentHasData: bufferContent.length > 100,
        lastChars: bufferContent
          .substring(Math.max(0, bufferContent.length - 50))
          .replace(/\n/g, '\\n'),
      });

      // DON'T save XTerm instances - they can't be reused safely!
      // Save the terminal metadata AND buffer content so we can restore it later
      // CHANGED: Now keyed by terminalId instead of projectId

      // 🔍 HYPOTHESIS A1: Track session save operation timing and content
      logger.info('[HYPO-A1-SESSION-SAVE] Saving terminal session to store', {
        componentId: componentInstanceId.current,
        terminalId: terminal.id.substring(0, 8),
        ownerProjectId: prevProjectId.substring(0, 8),
        bufferContentSize: bufferContent.length,
        bufferContentLines: bufferContent.split('\n').length,
        bufferContentPreview: bufferContent.substring(0, 50).replace(/\n/g, '\\n'),
        xtermDisposed: !xtermRef.current || (xtermRef.current as any)._isDisposed,
        saveTimestamp: new Date().toISOString(),
      });

      saveTerminalSession(terminal.id, {
        terminal,
        terminalId: terminal.id,
        ownerProjectId: prevProjectId,
        xtermInstance: undefined, // Don't save XTerm instance!
        fitAddon: undefined, // Don't save fitAddon!
        bufferContent, // 🔧 FIX: Save extracted buffer content!
        cursorY, // 🔧 FIX: Save cursor position!
        cursorX,
        cols, // Save terminal dimensions
        rows,
        lastActive: new Date(),
      });

      // 🔍 HYPOTHESIS A1: Verify session was saved correctly
      const savedSession = getTerminalSession(terminal.id);
      logger.info('[HYPO-A1-SESSION-SAVED] Session save verification', {
        componentId: componentInstanceId.current,
        terminalId: terminal.id.substring(0, 8),
        savedSuccessfully: !!savedSession,
        savedBufferSize: savedSession?.bufferContent?.length || 0,
        savedBufferMatches: savedSession?.bufferContent === bufferContent,
        savedTerminalIdMatches: savedSession?.terminalId === terminal.id,
      });

      logger.info('[🔍 SWITCH-SAVE] Session saved (metadata + buffer), clearing frontend state', {
        scenario: `${prevProjectId.substring(0, 8)} → ${projectId.substring(0, 8)}`,
        previousProjectId: prevProjectId,
        newProjectId: projectId,
        savedTerminalId: terminal.id.substring(0, 8),
        savedXTermInstance: false,
        savedBufferContent: true,
        bufferSize: bufferContent.length,
        cacheSize: useTerminalStore.getState().getTerminalsForProject(prevProjectId).length,
      });

      // 🔧 FIX: Clean up IPC listeners for old terminal before clearing state
      removeTerminalListeners(terminal.id);

      // DON'T remove terminal from store - it's still alive in backend!
      // The store should reflect actual backend terminal count.
      // When we restore, we'll reuse the same terminal metadata.
      logger.debug('[TerminalTab] Terminal kept in store (backend still alive)', {
        terminalId: terminal.id,
        storeSize: useTerminalStore.getState().terminals.size,
      });

      // 🔧 FIX-4: Dispose XTerm instance and clear DOM to prevent visual artifacts
      if (xtermRef.current) {
        logger.info('[🔧 FIX-4] Disposing XTerm instance on project switch', {
          terminalId: terminal.id,
          reason: 'prevent_visual_artifacts',
        });
        xtermRef.current.dispose();

        // Clear the container element to ensure no residual content
        if (terminalRef.current) {
          terminalRef.current.innerHTML = '';
          logger.debug('[🔧 FIX-4] Container element cleared', {
            terminalId: terminal.id,
          });
        }
      }

      // Clear frontend state but keep backend terminal alive
      setTerminal(null);
      xtermRef.current = null;
      fitAddonRef.current = null;
      terminalIdRef.current = null;
      isCreatingRef.current = false;
    }

    // Try to restore terminal session for this terminal instance
    // CHANGED: Use two-level cache - first check if this specific terminal has a session,
    // otherwise get the last terminal for this project
    let existingSession: ReturnType<typeof getTerminalSession> | undefined;

    if (terminalIdRef.current) {
      // Check if THIS specific terminal has a cached session
      logger.debug('[TerminalTab] Checking for specific terminal session', {
        terminalIdRef: terminalIdRef.current,
      });
      existingSession = getTerminalSession(terminalIdRef.current);
    } else if (projectId) {
      // If no specific terminal ID, get the most recently used terminal for this project
      logger.info('[🔍 RESTORE-DEBUG] No terminalIdRef, checking last terminal for project', {
        projectId,
        projectIdType: typeof projectId,
        projectIdLength: projectId?.length,
      });
      existingSession = getLastTerminalForProject(projectId);
      logger.info('[🔍 RESTORE-DEBUG] Last terminal for project result', {
        found: !!existingSession,
        terminalId: existingSession?.terminalId,
        sessionOwnerProjectId: existingSession?.ownerProjectId,
        projectIdsMatch: existingSession?.ownerProjectId === projectId,
      });
    }

    logger.debug('[TerminalTab] Session check', {
      terminalIdRef: terminalIdRef.current,
      projectId,
      hasExistingSession: !!existingSession,
      sessionTerminalId: existingSession?.terminalId,
      willRestore: !!(existingSession && !terminal),
      willCreateFresh: !!(!existingSession && !terminal && !isLoading && !error),
    });

    if (existingSession && !terminal) {
      // 🔧 GUARD: Prevent duplicate restoration in React Strict Mode
      // Strict Mode runs effects twice - skip second invocation
      if (lastRestoredTerminalIdRef.current === existingSession.terminalId) {
        logger.debug('[TerminalTab] Skipping duplicate restoration (Strict Mode)', {
          terminalId: existingSession.terminalId,
        });
        return undefined;
      }

      logger.info('[🔍 SWITCH-RESTORE] Restoring terminal session from cache', {
        scenario: `? → ${projectId.substring(0, 8)}`,
        projectId,
        terminalId: existingSession.terminalId.substring(0, 8),
        sessionAge: new Date().getTime() - existingSession.lastActive.getTime(),
        sessionOwnerProjectId: existingSession.ownerProjectId,
        action: 'session_restore',
        willCreateFreshXTerm: true,
        nextStep: 'xterm_init_effect_will_extract_and_write_buffer',
      });

      // Restore terminal state (but NOT the XTerm instance - we'll create a fresh one)
      setTerminal(existingSession.terminal);

      // Mark this terminal as restored to prevent Strict Mode duplicate
      lastRestoredTerminalIdRef.current = existingSession.terminalId;

      // Terminal should already be in store (we didn't remove it during save)
      // Just verify it's there
      const { getTerminal } = useTerminalStore.getState();
      const terminalInStore = getTerminal(existingSession.terminalId);
      logger.info('[🔍 SWITCH-RESTORE] Restored terminal verification', {
        terminalId: existingSession.terminalId.substring(0, 8),
        inStore: !!terminalInStore,
        storeSize: useTerminalStore.getState().terminals.size,
        backendPtyAlive: !!terminalInStore,
      });

      // 🔧 FIX: DON'T set terminalIdRef yet - let the XTerm effect detect this as a "new" terminal
      // This ensures the restoration path (line 270-440) runs and sets up IPC listeners
      // terminalIdRef.current will be set by the XTerm effect after listeners are configured
      // DON'T restore xtermRef or fitAddon - let the effect create fresh ones
      xtermRef.current = null;
      fitAddonRef.current = null;

      // Update ref
      prevProjectIdRef.current = projectId;

      // ❌ REMOVED: Ctrl+L hack that was clearing the screen instead of restoring buffer
      // The buffer restoration now happens in the XTerm initialization effect (line 437-462)
      logger.info('[TerminalTab] Ctrl+L repaint hack removed - buffer restore via SerializeAddon', {
        terminalId: existingSession.terminalId.substring(0, 8),
        reason: 'ctrl-l_clears_screen_instead_of_restoring',
        newApproach: 'write_extracted_buffer_directly',
      });
    } else if (!existingSession && !terminal && !isLoading && !error) {
      // Create fresh terminal if no session exists
      logger.info('[TerminalTab] No cached session found, creating fresh terminal', {
        projectId,
        action: 'fresh_terminal_create',
      });

      const timeoutId = setTimeout(() => {
        handleCreateTerminal();
      }, 10);

      // Update the ref to track this project
      prevProjectIdRef.current = projectId;

      return () => clearTimeout(timeoutId);
    } else if (terminal && prevProjectId === null) {
      // Update ref on initial render
      logger.debug('[TerminalTab] Initial render, tracking project', {
        projectId,
        terminalId: terminal.id,
      });
      prevProjectIdRef.current = projectId;
    }

    return undefined;
  }, [
    selectedProjectId,
    terminal,
    isLoading,
    error,
    handleCreateTerminal,
    saveTerminalSession,
    getTerminalSession,
    getLastTerminalForProject,
  ]);

  // 🔍 HYPOTHESIS LOGGING: Track component mount/unmount lifecycle
  useEffect(() => {
    logger.info('[HYPO-LIFECYCLE-MOUNT] TerminalTab component MOUNTED', {
      componentId: componentInstanceId.current,
      timestamp: new Date().toISOString(),
    });

    return () => {
      logger.info('[HYPO-LIFECYCLE-UNMOUNT] TerminalTab component UNMOUNTING', {
        componentId: componentInstanceId.current,
        timestamp: new Date().toISOString(),
        terminalId: terminalIdRef.current?.substring(0, 8),
        hadXterm: !!xtermRef.current,
      });
    };
  }, []); // Empty deps = runs only on mount/unmount

  // NOTE: Component now stays mounted when switching tabs (hidden via CSS)
  // No need for tab-switch save/restore - only project switches trigger unmount
  // Session save/restore logic only runs on project change (above effect)

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
