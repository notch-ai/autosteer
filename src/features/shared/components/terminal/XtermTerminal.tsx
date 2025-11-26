import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import React, { useEffect, useRef, useState } from 'react';
import { setupTerminalTheme } from './theme';

export interface XtermTerminalProps {
  shell?: string;
  cwd?: string;
  onReady?: (terminal: Terminal) => void;
  onExit?: (code: number | null) => void;
  className?: string;
}

/**
 * XTerm.js Terminal Component for React
 * Provides a browser-based terminal without native dependencies
 */
export const XtermTerminal: React.FC<XtermTerminalProps> = ({
  shell,
  cwd,
  onReady,
  onExit,
  className = '',
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Read font family from CSS variable
    const fontFamily =
      getComputedStyle(document.documentElement).getPropertyValue('--font-family-mono').trim() ||
      'inherit';

    // Initialize xterm.js with dynamic theme
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily,
      scrollback: 10000,
      convertEol: true,
    });

    // Add addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(searchAddon);

    // Open terminal in DOM
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Setup dynamic theme listener
    const themeObserver = setupTerminalTheme(term);

    // Override xterm decoration inline styles with force using theme variables
    const decorationObserver = new MutationObserver(() => {
      const decorations = terminalRef.current?.querySelectorAll('.xterm-decoration-top');
      decorations?.forEach((decoration) => {
        const el = decoration as HTMLElement;
        // Get theme colors from CSS variables
        const bgColor = getComputedStyle(document.documentElement)
          .getPropertyValue('--color-terminal-bg')
          .trim();
        const fgColor = getComputedStyle(document.documentElement)
          .getPropertyValue('--color-terminal-bright-white')
          .trim();
        el.style.setProperty('background-color', `rgb(${bgColor})`, 'important');
        el.style.setProperty('color', `rgb(${fgColor})`, 'important');
      });
    });

    if (terminalRef.current) {
      decorationObserver.observe(terminalRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style'],
      });
    }

    // Create terminal process via IPC
    createTerminalProcess(term);

    // Setup resize handler
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      themeObserver.disconnect();
      decorationObserver.disconnect();
      if (terminalId) {
        window.electron?.terminal?.kill(terminalId);
      }
      term.dispose();
    };
  }, []);

  /**
   * Create terminal process and setup IPC communication
   */
  const createTerminalProcess = async (term: Terminal) => {
    try {
      // Create terminal via IPC
      const params: { shell?: string; cwd?: string } = {};
      if (shell) params.shell = shell;
      if (cwd) params.cwd = cwd;
      const result = await window.electron?.terminal?.create(params);

      if (!result?.id) {
        term.writeln('\r\n\x1b[31mFailed to create terminal process\x1b[0m');
        return;
      }

      const { id: termId } = result;
      setTerminalId(termId);
      setIsConnected(true);

      // Setup data handler for output from terminal process
      const dataHandler = (data: string) => {
        term.write(data);
      };

      // Setup exit handler
      const exitHandler = ({ code }: { code: number | null }) => {
        setIsConnected(false);
        term.writeln(`\r\n\x1b[33mProcess exited with code ${code}\x1b[0m`);
        if (onExit) {
          onExit(code);
        }
      };

      // Setup error handler
      const errorHandler = (error: string) => {
        term.writeln(`\r\n\x1b[31mError: ${error}\x1b[0m`);
      };

      // Register IPC listeners
      window.electron?.terminal?.onData(termId, dataHandler);
      window.electron?.terminal?.onExit(termId, exitHandler);
      window.electron?.terminal?.onError(termId, errorHandler);

      // Handle input from xterm to terminal process
      term.onData((data: string) => {
        if (isConnected && terminalId) {
          window.electron?.terminal?.write(terminalId, data);
        }
      });

      // Handle resize
      term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        if (terminalId) {
          window.electron?.terminal?.resize(terminalId, cols, rows);
        }
      });

      // Notify parent component
      if (onReady) {
        onReady(term);
      }

      // Welcome message
      term.writeln('Welcome to XTerm.js Terminal');
      term.writeln(`Shell: ${result.shell}`);
      term.writeln(`Working Directory: ${result.cwd}`);
      term.writeln('');
    } catch (error) {
      console.error('Failed to create terminal:', error);
      term.writeln(`\r\n\x1b[31mFailed to create terminal: ${error}\x1b[0m`);
    }
  };

  /**
   * Focus the terminal
   */
  const focus = () => {
    if (xtermRef.current) {
      xtermRef.current.focus();
    }
  };

  /**
   * Clear the terminal
   */
  const clear = () => {
    if (xtermRef.current) {
      xtermRef.current.clear();
    }
  };

  return (
    <div className={`terminal-container ${className}`}>
      <div className="terminal-header flex items-center justify-between p-2 bg-gray-800">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-400">Terminal</span>
          {terminalId && (
            <span className="text-sm text-gray-500">ID: {terminalId.slice(0, 8)}</span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={clear}
            className="text-sm px-2 py-1 text-gray-400 hover:text-white transition-colors"
          >
            Clear
          </button>
          <button
            onClick={focus}
            className="text-sm px-2 py-1 text-gray-400 hover:text-white transition-colors"
          >
            Focus
          </button>
          {!isConnected && <span className="text-sm text-red-400">Disconnected</span>}
        </div>
      </div>
      <div ref={terminalRef} className="terminal-content" style={{ height: 'calc(100% - 40px)' }} />
    </div>
  );
};

export default XtermTerminal;
