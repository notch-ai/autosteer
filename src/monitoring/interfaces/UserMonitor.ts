import { SessionBlock } from '@/entities/SessionBlock';

/**
 * Interface for monitoring user activity and usage data.
 * Implementations should track and aggregate usage metrics into session blocks.
 */
export interface UserMonitor extends Disposable {
  /**
   * Get the currently active session block.
   * Returns null if no active session exists.
   */
  getActiveBlock(): Promise<SessionBlock | null>;

  /**
   * Get all session blocks, including historical and active ones.
   * Blocks are sorted by start time (newest first).
   */
  getAllBlocks(): Promise<SessionBlock[]>;

  /**
   * Clear all cached data and reset the monitor state.
   * This forces a full reload on the next operation.
   */
  clearCache(): void;

  /**
   * Dispose of resources and clean up.
   * Part of the Disposable interface for proper resource management.
   */
  [Symbol.dispose](): void;
}
