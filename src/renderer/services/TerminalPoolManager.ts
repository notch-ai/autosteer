import { Terminal, TerminalBufferState } from '@/types/terminal.types';
import { TerminalLibraryAdapter } from './TerminalLibraryAdapter';

/**
 * Terminal pool entry
 */
interface TerminalPoolEntry {
  terminal: Terminal;
  adapter: TerminalLibraryAdapter;
  lastAccessed: Date;
  isAttached: boolean;
}

/**
 * TerminalPoolManager - Instance Pooling (Renderer Process)
 *
 * Manages terminal instance pooling in the renderer process.
 *
 * Key Features:
 * - Terminal instance creation and lifecycle management
 * - Max 10 terminal instances (hard limit)
 * - Attach/detach operations for DOM lifecycle decoupling
 * - Buffer state capture/restore for session persistence
 * - Terminal instance reuse across component mounts
 *
 * Architecture:
 * - Renderer process service (React)
 * - Manages TerminalLibraryAdapter instances
 * - Decouples terminal instances from React component lifecycle
 * - Coordinates with useTerminalPool hook
 *
 * Performance Requirements:
 * - <50ms terminal creation
 * - <10ms attach/detach operations
 * - <100ms terminal switch time
 * - O(1) instance lookup
 *
 * @see docs/terminal-persistence-architecture.md
 */
export class TerminalPoolManager {
  private static readonly MAX_POOL_SIZE = 10;

  private pool: Map<string, TerminalPoolEntry>;

  constructor() {
    this.pool = new Map();
  }

  /**
   * Get maximum pool size
   */
  getMaxPoolSize(): number {
    return TerminalPoolManager.MAX_POOL_SIZE;
  }

  /**
   * Create a new terminal instance
   * @param terminal The terminal metadata
   * @param element The DOM element to attach to
   * @returns The created adapter instance
   */
  createTerminal(terminal: Terminal, element: HTMLElement): TerminalLibraryAdapter {
    if (this.pool.size >= TerminalPoolManager.MAX_POOL_SIZE) {
      throw new Error(`Terminal pool limit reached (${TerminalPoolManager.MAX_POOL_SIZE})`);
    }

    // Create new adapter instance
    const adapter = new TerminalLibraryAdapter({
      scrollback: 10000,
      fontSize: terminal.size.rows === 24 ? 14 : 13,
    });

    // Attach to DOM element
    adapter.attach(element);

    // Store in pool
    const entry: TerminalPoolEntry = {
      terminal,
      adapter,
      lastAccessed: new Date(),
      isAttached: true,
    };

    this.pool.set(terminal.id, entry);

    return adapter;
  }

  /**
   * Get terminal adapter from pool
   * @param terminalId The terminal ID
   * @returns The adapter or undefined
   */
  getTerminal(terminalId: string): TerminalLibraryAdapter | undefined {
    const entry = this.pool.get(terminalId);
    if (entry) {
      entry.lastAccessed = new Date();
    }
    return entry?.adapter;
  }

  /**
   * Check if terminal exists in pool
   * @param terminalId The terminal ID
   * @returns True if terminal exists
   */
  hasTerminal(terminalId: string): boolean {
    return this.pool.has(terminalId);
  }

  /**
   * Get all terminal IDs in pool
   * @returns Array of terminal IDs
   */
  getAllTerminalIds(): string[] {
    return Array.from(this.pool.keys());
  }

  /**
   * Get pool size
   * @returns Number of terminals in pool
   */
  getPoolSize(): number {
    return this.pool.size;
  }

  /**
   * Attach terminal to DOM element
   * @param terminalId The terminal ID
   * @param element The DOM element to attach to
   */
  attachTerminal(terminalId: string, element: HTMLElement): void {
    const entry = this.pool.get(terminalId);
    if (!entry) {
      throw new Error(`Terminal not found in pool: ${terminalId}`);
    }

    entry.adapter.attach(element);
    entry.isAttached = true;
    entry.lastAccessed = new Date();
  }

  /**
   * Detach terminal from DOM (without destroying)
   * @param terminalId The terminal ID
   */
  detachTerminal(terminalId: string): void {
    const entry = this.pool.get(terminalId);
    if (!entry) {
      throw new Error(`Terminal not found in pool: ${terminalId}`);
    }

    entry.adapter.detach();
    entry.isAttached = false;
    entry.lastAccessed = new Date();
  }

  /**
   * Focus terminal
   * @param terminalId The terminal ID
   */
  focusTerminal(terminalId: string): void {
    const entry = this.pool.get(terminalId);
    if (!entry) {
      throw new Error(`Terminal not found in pool: ${terminalId}`);
    }

    entry.adapter.focus();
    entry.lastAccessed = new Date();
  }

  /**
   * Blur terminal
   * @param terminalId The terminal ID
   */
  blurTerminal(terminalId: string): void {
    const entry = this.pool.get(terminalId);
    if (!entry) {
      throw new Error(`Terminal not found in pool: ${terminalId}`);
    }

    entry.adapter.blur();
  }

  /**
   * Fit terminal to container
   * @param terminalId The terminal ID
   */
  fitTerminal(terminalId: string): void {
    const entry = this.pool.get(terminalId);
    if (!entry) {
      throw new Error(`Terminal not found in pool: ${terminalId}`);
    }

    entry.adapter.fit();
  }

  /**
   * Resize terminal
   * @param terminalId The terminal ID
   * @param cols Number of columns
   * @param rows Number of rows
   */
  resizeTerminal(terminalId: string, cols: number, rows: number): void {
    const entry = this.pool.get(terminalId);
    if (!entry) {
      throw new Error(`Terminal not found in pool: ${terminalId}`);
    }

    entry.adapter.resize(cols, rows);
  }

  /**
   * Capture buffer state for persistence
   * @param terminalId The terminal ID
   * @returns The buffer state
   */
  captureBufferState(terminalId: string): TerminalBufferState {
    const entry = this.pool.get(terminalId);
    if (!entry) {
      throw new Error(`Terminal not found in pool: ${terminalId}`);
    }

    const bufferState = entry.adapter.getBufferState();

    return {
      ...bufferState,
      terminalId,
      timestamp: new Date(),
      sizeBytes: bufferState.content.length,
    };
  }

  /**
   * Restore buffer state
   * @param terminalId The terminal ID
   * @param bufferState The buffer state to restore
   */
  restoreBufferState(terminalId: string, bufferState: TerminalBufferState): void {
    const entry = this.pool.get(terminalId);
    if (!entry) {
      throw new Error(`Terminal not found in pool: ${terminalId}`);
    }

    entry.adapter.restoreBufferState(bufferState);
    entry.lastAccessed = new Date();
  }

  /**
   * Destroy terminal instance
   * @param terminalId The terminal ID
   */
  destroyTerminal(terminalId: string): void {
    const entry = this.pool.get(terminalId);
    if (!entry) {
      throw new Error(`Terminal not found in pool: ${terminalId}`);
    }

    entry.adapter.dispose();
    this.pool.delete(terminalId);
  }

  /**
   * Clear all terminals from pool
   */
  clearAll(): void {
    for (const entry of this.pool.values()) {
      entry.adapter.dispose();
    }

    this.pool.clear();
  }

  /**
   * Get terminal metadata
   * @param terminalId The terminal ID
   * @returns Terminal metadata or undefined
   */
  getTerminalMetadata(terminalId: string): Terminal | undefined {
    return this.pool.get(terminalId)?.terminal;
  }

  /**
   * Check if terminal is currently attached
   * @param terminalId The terminal ID
   * @returns True if attached
   */
  isTerminalAttached(terminalId: string): boolean {
    return this.pool.get(terminalId)?.isAttached ?? false;
  }
}
