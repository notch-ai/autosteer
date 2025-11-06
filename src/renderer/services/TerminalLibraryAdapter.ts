import {
  Terminal as XTermTerminal,
  type ITerminalOptions,
  type ITerminalInitOnlyOptions,
} from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import log from 'electron-log';

/**
 * Terminal library adapter configuration
 */
export interface TerminalAdapterConfig {
  scrollback?: number;
  fontSize?: number;
  fontFamily?: string;
  cursorBlink?: boolean;
  convertEol?: boolean;
  theme?: {
    background?: string;
    foreground?: string;
    cursor?: string;
    selectionBackground?: string;
    black?: string;
    red?: string;
    green?: string;
    yellow?: string;
    blue?: string;
    magenta?: string;
    cyan?: string;
    white?: string;
    brightBlack?: string;
    brightRed?: string;
    brightGreen?: string;
    brightYellow?: string;
    brightBlue?: string;
    brightMagenta?: string;
    brightCyan?: string;
    brightWhite?: string;
  };
}

/**
 * Terminal lifecycle event handlers
 */
export interface TerminalEventHandlers {
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  onTitleChange?: (title: string) => void;
  onBell?: () => void;
  onCursorMove?: () => void;
  onScroll?: (yPosition: number) => void;
}

/**
 * Terminal buffer state for persistence
 */
export interface TerminalBufferState {
  content: string;
  cursorX: number;
  cursorY: number;
  scrollback: string[];
  cols: number;
  rows: number;
}

/**
 * TerminalLibraryAdapter - Abstraction layer for XTerm.js
 *
 * Architecture Decision (Phase 0 - Library Evaluation):
 * - Evaluated: react-xtermjs, react-blessed, native XTerm.js
 * - Decision: Custom lifecycle management with native XTerm.js
 * - Rationale:
 *   1. react-xtermjs couples terminal lifecycle to React component lifecycle (undesired)
 *   2. react-blessed has limited ANSI support and different rendering model
 *   3. Native XTerm.js provides full control over terminal lifecycle
 *   4. Custom adapter allows terminal instances to survive component unmounts
 *   5. Performance: Direct XTerm.js access for <16ms input lag requirement
 *
 * This adapter provides:
 * - Terminal instance creation and lifecycle management
 * - Buffer state persistence (10k line scrollback)
 * - Addon management (FitAddon, WebLinksAddon, SearchAddon)
 * - Event handler registration and cleanup
 * - Decoupled from React component lifecycle
 *
 * @see docs/terminal-persistence-architecture.md for full architecture details
 */
export class TerminalLibraryAdapter {
  private terminal: XTermTerminal;
  private fitAddon: FitAddon;
  private webLinksAddon: WebLinksAddon;
  private searchAddon: SearchAddon;
  private isDisposed = false;

  /**
   * Default configuration for terminal instances
   */
  private static readonly DEFAULT_CONFIG: TerminalAdapterConfig = {
    scrollback: 10000, // 10k line scrollback as per Phase 1 requirements
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    cursorBlink: true,
    convertEol: true,
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#aeafad',
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
  };

  /**
   * Create a new terminal adapter instance
   * @param config Optional configuration overrides
   */
  constructor(config?: Partial<TerminalAdapterConfig>) {
    const mergedConfig = { ...TerminalLibraryAdapter.DEFAULT_CONFIG, ...config };

    log.info('[TerminalLibraryAdapter] Creating new terminal instance', {
      scrollback: mergedConfig.scrollback,
      fontSize: mergedConfig.fontSize,
    });

    // Initialize XTerm.js terminal
    // Filter out undefined values for exactOptionalPropertyTypes compliance
    const terminalOptions: Record<string, unknown> = {};
    if (mergedConfig.cursorBlink !== undefined)
      terminalOptions.cursorBlink = mergedConfig.cursorBlink;
    if (mergedConfig.fontSize !== undefined) terminalOptions.fontSize = mergedConfig.fontSize;
    if (mergedConfig.fontFamily !== undefined) terminalOptions.fontFamily = mergedConfig.fontFamily;
    if (mergedConfig.theme !== undefined) terminalOptions.theme = mergedConfig.theme;
    if (mergedConfig.scrollback !== undefined) terminalOptions.scrollback = mergedConfig.scrollback;
    if (mergedConfig.convertEol !== undefined) terminalOptions.convertEol = mergedConfig.convertEol;

    this.terminal = new XTermTerminal(
      terminalOptions as ITerminalOptions & ITerminalInitOnlyOptions
    );

    // Initialize addons for enhanced functionality
    this.fitAddon = new FitAddon();
    this.webLinksAddon = new WebLinksAddon();
    this.searchAddon = new SearchAddon();

    // Load addons into terminal
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.loadAddon(this.webLinksAddon);
    this.terminal.loadAddon(this.searchAddon);

    log.info('[TerminalLibraryAdapter] Terminal instance created successfully');
  }

  /**
   * Attach terminal to a DOM element
   * @param element The DOM element to attach to
   */
  attach(element: HTMLElement): void {
    if (this.isDisposed) {
      throw new Error('Cannot attach disposed terminal');
    }

    // XTerm.terminal.element is set after open() is called
    const isAlreadyOpened = !!(this.terminal as any).element;
    const terminalElement = (this.terminal as any).element;

    log.info('[TerminalLibraryAdapter] Attaching terminal to DOM element', {
      isAlreadyOpened,
      hasElement: !!element,
      currentCols: this.terminal.cols,
      currentRows: this.terminal.rows,
      // THEORY A: Terminal element state
      terminalElementExists: !!terminalElement,
      terminalElementTagName: terminalElement?.tagName,
      terminalElementHasParent: !!terminalElement?.parentNode,
      terminalElementParentTag: terminalElement?.parentNode?.nodeName,
      // THEORY B: Container element state
      containerTagName: element.tagName,
      containerClassName: element.className,
      containerHasParent: !!element.parentNode,
      containerParentTag: element.parentNode?.nodeName,
      containerChildCount: element.childNodes.length,
      containerIsVisible: element.offsetParent !== null,
      containerComputedDisplay:
        typeof window !== 'undefined' ? window.getComputedStyle(element).display : 'unknown',
      // THEORY C: Buffer state
      bufferLineCount: this.terminal.buffer.active.length,
      bufferCursorY: this.terminal.buffer.active.cursorY,
      bufferCursorX: this.terminal.buffer.active.cursorX,
    });

    if (isAlreadyOpened) {
      // Terminal was previously opened - reattach to new element
      log.info('[TerminalLibraryAdapter] Terminal already opened - performing DOM reattachment', {
        bufferLines: this.terminal.buffer.active.length,
        cursorY: this.terminal.buffer.active.cursorY,
      });

      // Move the terminal's DOM element to the new container
      const terminalElement = (this.terminal as any).element;
      if (terminalElement) {
        // Clear the target container first
        element.innerHTML = '';

        // If terminal has a parent, remove it first (for safety)
        if (terminalElement.parentNode) {
          terminalElement.parentNode.removeChild(terminalElement);
        }

        // Append terminal element to new container
        element.appendChild(terminalElement);
      } else {
        log.error('[TerminalLibraryAdapter] Terminal element not found - cannot reattach', {
          hasTerminalElement: !!terminalElement,
        });
      }
    } else {
      // First time opening - use standard XTerm open()
      log.info('[TerminalLibraryAdapter] First-time terminal open');
      this.terminal.open(element);
    }

    // Always fit after attach (whether new or reattached)

    this.fitAddon.fit();

    // The buffer is preserved but viewport position may be wrong
    if (isAlreadyOpened) {
      // Scroll to the bottom of the buffer (where the cursor is)
      this.terminal.scrollToBottom();

      // Additional fix: Force a refresh of the terminal renderer
      this.terminal.refresh(0, this.terminal.rows - 1);

      // THEORY S: Scroll up by 1 line to ensure cursor line is fully visible
      // Sometimes the cursor line gets cut off at the very bottom
      if (this.terminal.buffer.active.viewportY > 0) {
        this.terminal.scrollLines(-1);
        log.info('[🔧 SCROLL-ADJUST] Scrolled up 1 line to prevent bottom cutoff', {
          newViewportY: this.terminal.buffer.active.viewportY,
        });
      }

      // Force focus to ensure terminal is interactive
      try {
        this.terminal.focus();
        log.info('[🔧 FOCUS-FIX] Terminal focused after reattachment');
      } catch (err) {
        log.warn('[🔧 FOCUS-FIX] Failed to focus terminal', { error: err });
      }

      // Additional rendering diagnostics
      setTimeout(() => {}, 100);
    }
  }

  /**
   * Detach terminal from DOM (without disposing)
   * This allows the terminal instance to survive React component unmounts
   */
  detach(): void {
    log.info('[TerminalLibraryAdapter] Detaching terminal from DOM (instance preserved)');

    // Remove the terminal's DOM element from its parent container
    // This hides the terminal while keeping the instance alive for reattachment
    const terminalElement = (this.terminal as any).element;
    if (terminalElement && terminalElement.parentNode) {
      terminalElement.parentNode.removeChild(terminalElement);
      log.info('[TerminalLibraryAdapter] Terminal DOM element removed from parent', {
        hadParent: true,
        elementStillExists: !!terminalElement,
      });
    } else {
      log.warn('[TerminalLibraryAdapter] Terminal element has no parent - already detached?', {
        hasElement: !!terminalElement,
        hasParent: !!terminalElement?.parentNode,
      });
    }
  }

  /**
   * Write data to terminal
   * @param data The data to write
   */
  write(data: string): void {
    if (this.isDisposed) {
      log.warn('[TerminalLibraryAdapter] Attempted write to disposed terminal');
      return;
    }

    this.terminal.write(data);
  }

  /**
   * Write line to terminal (with newline)
   * @param data The data to write
   */
  writeln(data: string): void {
    if (this.isDisposed) {
      log.warn('[TerminalLibraryAdapter] Attempted writeln to disposed terminal');
      return;
    }
    this.terminal.writeln(data);
  }

  /**
   * Clear terminal screen
   */
  clear(): void {
    if (this.isDisposed) {
      log.warn('[TerminalLibraryAdapter] Attempted clear on disposed terminal');
      return;
    }
    this.terminal.clear();
  }

  /**
   * Reset terminal to initial state
   */
  reset(): void {
    if (this.isDisposed) {
      log.warn('[TerminalLibraryAdapter] Attempted reset on disposed terminal');
      return;
    }
    this.terminal.reset();
  }

  /**
   * Focus terminal
   */
  focus(): void {
    if (this.isDisposed) {
      log.warn('[TerminalLibraryAdapter] Attempted focus on disposed terminal');
      return;
    }
    this.terminal.focus();
  }

  /**
   * Blur terminal
   */
  blur(): void {
    if (this.isDisposed) {
      return;
    }
    this.terminal.blur();
  }

  /**
   * Fit terminal to container
   * Uses requestAnimationFrame to ensure DOM layout is complete before fitting
   */
  fit(): void {
    if (this.isDisposed) {
      log.warn('[TerminalLibraryAdapter] Attempted fit on disposed terminal');
      return;
    }

    // This prevents intermittent cutoff when terminal content is long
    // requestAnimationFrame ensures we measure container dimensions AFTER layout

    // Get container dimensions BEFORE RAF
    const containerElement = this.terminal.element?.parentElement;
    const beforeWidth = containerElement?.clientWidth || 0;
    const beforeHeight = containerElement?.clientHeight || 0;
    // CRITICAL FIX: If container has 0 dimensions, wait for it to be sized
    if (beforeWidth === 0 || beforeHeight === 0) {
      // Use double RAF to ensure layout is fully complete
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (this.isDisposed) return;

          const retryWidth = containerElement?.clientWidth || 0;
          const retryHeight = containerElement?.clientHeight || 0;

          if (retryWidth === 0 || retryHeight === 0) {
            return;
          }

          this.fitAddon.fit();
        });
      });
      return;
    }

    requestAnimationFrame(() => {
      if (this.isDisposed) {
        return; // Terminal was disposed before RAF callback
      }

      // Get container dimensions AFTER RAF (post-layout)
      const afterWidth = containerElement?.clientWidth || 0;
      const afterHeight = containerElement?.clientHeight || 0;

      // Double-check dimensions are still valid
      if (afterWidth === 0 || afterHeight === 0) {
        return;
      }

      this.fitAddon.fit();
    });
  }

  /**
   * Resize terminal
   * @param cols Number of columns
   * @param rows Number of rows
   */
  resize(cols: number, rows: number): void {
    if (this.isDisposed) {
      log.warn('[TerminalLibraryAdapter] Attempted resize on disposed terminal');
      return;
    }
    this.terminal.resize(cols, rows);
    log.debug('[TerminalLibraryAdapter] Terminal resized', { cols, rows });
  }

  /**
   * Get current terminal dimensions
   */
  getDimensions(): { cols: number; rows: number } {
    return {
      cols: this.terminal.cols,
      rows: this.terminal.rows,
    };
  }

  /**
   * Get terminal buffer state for persistence
   * Captures current terminal state including scrollback buffer
   */
  getBufferState(): TerminalBufferState {
    if (this.isDisposed) {
      throw new Error('Cannot get buffer state from disposed terminal');
    }

    const buffer = this.terminal.buffer.active;
    const scrollback: string[] = [];

    // Extract scrollback buffer content (up to 10k lines)
    const totalLines = buffer.length;
    for (let i = 0; i < totalLines; i++) {
      const line = buffer.getLine(i);
      if (line) {
        scrollback.push(line.translateToString(true));
      }
    }

    log.debug('[TerminalLibraryAdapter] Captured buffer state', {
      lines: scrollback.length,
      cursorX: buffer.cursorX,
      cursorY: buffer.cursorY,
    });

    return {
      content: scrollback.join('\n'),
      cursorX: buffer.cursorX,
      cursorY: buffer.cursorY,
      scrollback,
      cols: this.terminal.cols,
      rows: this.terminal.rows,
    };
  }

  /**
   * Restore terminal buffer state from persistence
   * @param state The buffer state to restore
   */
  restoreBufferState(state: TerminalBufferState): void {
    if (this.isDisposed) {
      throw new Error('Cannot restore buffer state to disposed terminal');
    }

    log.info('[TerminalLibraryAdapter] Restoring buffer state', {
      lines: state.scrollback.length,
    });

    // Clear current terminal content
    this.terminal.clear();

    // Restore scrollback content
    for (const line of state.scrollback) {
      this.terminal.writeln(line);
    }

    // Restore cursor position (approximate - XTerm.js doesn't expose direct cursor control)
    // The cursor will be positioned at the end of the restored content

    log.info('[TerminalLibraryAdapter] Buffer state restored successfully');
  }

  /**
   * Register event handlers
   * @param handlers Event handler callbacks
   */
  registerEventHandlers(handlers: TerminalEventHandlers): void {
    if (this.isDisposed) {
      log.warn('[TerminalLibraryAdapter] Cannot register handlers on disposed terminal');
      return;
    }

    if (handlers.onData) {
      this.terminal.onData(handlers.onData);
      log.debug('[TerminalLibraryAdapter] Registered onData handler');
    }

    if (handlers.onResize) {
      this.terminal.onResize(({ cols, rows }) => handlers.onResize?.(cols, rows));
      log.debug('[TerminalLibraryAdapter] Registered onResize handler');
    }

    if (handlers.onTitleChange) {
      this.terminal.onTitleChange(handlers.onTitleChange);
      log.debug('[TerminalLibraryAdapter] Registered onTitleChange handler');
    }

    if (handlers.onBell) {
      this.terminal.onBell(handlers.onBell);
      log.debug('[TerminalLibraryAdapter] Registered onBell handler');
    }

    if (handlers.onCursorMove) {
      this.terminal.onCursorMove(handlers.onCursorMove);
      log.debug('[TerminalLibraryAdapter] Registered onCursorMove handler');
    }

    if (handlers.onScroll) {
      this.terminal.onScroll(handlers.onScroll);
      log.debug('[TerminalLibraryAdapter] Registered onScroll handler');
    }

    log.info('[TerminalLibraryAdapter] Event handlers registered successfully');
  }

  /**
   * Search for text in terminal
   * @param term The search term
   * @param options Search options
   */
  search(term: string, options?: { incremental?: boolean; caseSensitive?: boolean }): boolean {
    if (this.isDisposed) {
      log.warn('[TerminalLibraryAdapter] Cannot search in disposed terminal');
      return false;
    }
    return this.searchAddon.findNext(term, options);
  }

  /**
   * Check if terminal is disposed
   */
  isTerminalDisposed(): boolean {
    return this.isDisposed;
  }

  /**
   * Get the underlying XTerm.js instance (for advanced use cases)
   * Use with caution - direct access bypasses adapter abstractions
   */
  getXTermInstance(): XTermTerminal {
    if (this.isDisposed) {
      throw new Error('Cannot access disposed terminal instance');
    }
    return this.terminal;
  }

  /**
   * Legacy alias for getXTermInstance (for backward compatibility)
   */
  getXtermInstance(): XTermTerminal {
    return this.getXTermInstance();
  }

  /**
   * Dispose terminal and clean up resources
   * After disposal, the terminal cannot be reused
   */
  dispose(): void {
    if (this.isDisposed) {
      log.warn('[TerminalLibraryAdapter] Terminal already disposed');
      return;
    }

    log.info('[TerminalLibraryAdapter] Disposing terminal instance');
    this.isDisposed = true;
    this.terminal.dispose();
    log.info('[TerminalLibraryAdapter] Terminal disposed successfully');
  }
}
