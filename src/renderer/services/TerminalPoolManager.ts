import { Terminal } from '@/types/terminal.types';
import { TerminalLibraryAdapter } from './TerminalLibraryAdapter';
import { logger } from '@/commons/utils/logger';

/**
 * Terminal pool entry
 */
interface TerminalPoolEntry {
  projectId: string;
  terminal: Terminal;
  adapter: TerminalLibraryAdapter;
  lastAccessed: Date;
}

/**
 * TerminalPoolManager - Instance Pooling (Renderer Process)
 *
 * Manages terminal instance pooling with z-index based visibility control.
 *
 * Key Features:
 * - 1:1 relationship between projects and terminals (enforced)
 * - Max 10 terminal instances (hard limit)
 * - Z-index based terminal switching (no attach/detach)
 * - Terminal instance reuse across component mounts
 * - Simplified lifecycle management
 *
 * Architecture:
 * - Renderer process service (React)
 * - Manages TerminalLibraryAdapter instances
 * - Keyed by projectId (folderName) for 1:1 enforcement
 * - Coordinates with useTerminalPool hook
 * - Uses z-index for visibility instead of DOM attach/detach
 *
 * Performance Requirements:
 * - <50ms terminal creation
 * - <100ms terminal switch time
 * - O(1) instance lookup
 */
export class TerminalPoolManager {
  private static readonly MAX_POOL_SIZE = 10;

  private pool: Map<string, TerminalPoolEntry>; // Key: projectId (folderName)

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
   * Create a new terminal instance for a project
   * Enforces 1:1 relationship - throws if project already has terminal
   * Terminal is created and attached to DOM element immediately
   * @param projectId The project ID (folderName)
   * @param terminal The terminal metadata
   * @param element The DOM element to attach to
   * @returns The created adapter instance
   */
  createTerminal(
    projectId: string,
    terminal: Terminal,
    element: HTMLElement
  ): TerminalLibraryAdapter {
    // Enforce 1:1 relationship
    if (this.pool.has(projectId)) {
      logger.error('[TerminalPoolManager] Project already has terminal', { projectId });
      throw new Error(`Project ${projectId} already has a terminal`);
    }

    if (this.pool.size >= TerminalPoolManager.MAX_POOL_SIZE) {
      logger.error('[TerminalPoolManager] Pool limit reached', {
        poolSize: this.pool.size,
        maxSize: TerminalPoolManager.MAX_POOL_SIZE,
      });
      throw new Error(`Terminal pool limit reached (${TerminalPoolManager.MAX_POOL_SIZE})`);
    }

    // Create new adapter instance
    const adapter = new TerminalLibraryAdapter({
      scrollback: 10000, // 10k line scrollback
    });

    // Attach to DOM element immediately (stays attached with z-index control)
    adapter.attach(element);

    // Store in pool keyed by projectId
    const entry: TerminalPoolEntry = {
      projectId,
      terminal,
      adapter,
      lastAccessed: new Date(),
    };

    this.pool.set(projectId, entry);

    return adapter;
  }

  /**
   * Get terminal adapter for a project
   * @param projectId The project ID (folderName)
   * @returns The adapter or undefined
   */
  getTerminal(projectId: string): TerminalLibraryAdapter | undefined {
    const entry = this.pool.get(projectId);
    if (entry) {
      entry.lastAccessed = new Date();
    }
    return entry?.adapter;
  }

  /**
   * Check if project has a terminal in pool
   * @param projectId The project ID (folderName)
   * @returns True if terminal exists
   */
  hasTerminal(projectId: string): boolean {
    return this.pool.has(projectId);
  }

  /**
   * Get all project IDs that have terminals
   * @returns Array of project IDs
   */
  getAllProjectIds(): string[] {
    return Array.from(this.pool.keys());
  }

  /**
   * Get pool size (number of terminals)
   * This should always equal the number of active projects
   * @returns Number of terminals in pool
   */
  getPoolSize(): number {
    return this.pool.size;
  }

  /**
   * Focus terminal
   * @param projectId The project ID (folderName)
   */
  focusTerminal(projectId: string): void {
    const entry = this.pool.get(projectId);
    if (!entry) {
      throw new Error(`No terminal found for project: ${projectId}`);
    }

    entry.adapter.focus();
    entry.lastAccessed = new Date();
  }

  /**
   * Blur terminal
   * @param projectId The project ID (folderName)
   */
  blurTerminal(projectId: string): void {
    const entry = this.pool.get(projectId);
    if (!entry) {
      throw new Error(`No terminal found for project: ${projectId}`);
    }

    entry.adapter.blur();
  }

  /**
   * Fit terminal to container
   * @param projectId The project ID (folderName)
   */
  fitTerminal(projectId: string): void {
    const entry = this.pool.get(projectId);
    if (!entry) {
      throw new Error(`No terminal found for project: ${projectId}`);
    }

    entry.adapter.fit();
  }

  /**
   * Resize terminal
   * @param projectId The project ID (folderName)
   * @param cols Number of columns
   * @param rows Number of rows
   */
  resizeTerminal(projectId: string, cols: number, rows: number): void {
    const entry = this.pool.get(projectId);
    if (!entry) {
      throw new Error(`No terminal found for project: ${projectId}`);
    }

    entry.adapter.resize(cols, rows);
  }

  /**
   * Destroy terminal instance for a project
   * @param projectId The project ID (folderName)
   */
  destroyTerminal(projectId: string): void {
    const entry = this.pool.get(projectId);
    if (!entry) {
      logger.error('[TerminalPoolManager] Terminal not found for destruction', { projectId });
      throw new Error(`No terminal found for project: ${projectId}`);
    }

    entry.adapter.dispose();
    this.pool.delete(projectId);
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
   * Get terminal metadata for a project
   * @param projectId The project ID (folderName)
   * @returns Terminal metadata or undefined
   */
  getTerminalMetadata(projectId: string): Terminal | undefined {
    return this.pool.get(projectId)?.terminal;
  }

  /**
   * Scroll terminal to top
   * @param projectId The project ID (folderName)
   */
  scrollToTop(projectId: string): void {
    const entry = this.pool.get(projectId);
    if (!entry) {
      throw new Error(`No terminal found for project: ${projectId}`);
    }

    entry.adapter.scrollToTop();
  }

  /**
   * Scroll terminal to bottom
   * @param projectId The project ID (folderName)
   */
  scrollToBottom(projectId: string): void {
    const entry = this.pool.get(projectId);
    if (!entry) {
      throw new Error(`No terminal found for project: ${projectId}`);
    }

    entry.adapter.scrollToBottom();
  }

  /**
   * Get terminal ID for a project
   * @param projectId The project ID (folderName)
   * @returns Terminal ID or undefined
   */
  getTerminalId(projectId: string): string | undefined {
    return this.pool.get(projectId)?.terminal.id;
  }
}
