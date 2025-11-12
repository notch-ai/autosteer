import log from 'electron-log';
import { TerminalBufferState, BufferTrimStats } from '@/types/terminal.types';

/**
 * TerminalBufferService
 *
 * Provides buffer state persistence with optimized FIFO trimming and memory monitoring.
 *
 * Key Features:
 * - 10k line scrollback buffer per terminal
 * - 50MB memory limit per session
 * - Optimized FIFO trimming (removes oldest lines when limits exceeded)
 * - Automatic trimming on save with performance optimization
 * - Real-time memory usage monitoring
 * - XTerm instance reuse support
 *
 * - Optimized trimming algorithm for better performance
 * - Enhanced memory monitoring with detailed metrics
 * - Support for high-throughput buffer operations
 * - Improved logging for manual testing and debugging
 *
 * Architecture:
 * - Main process service (decoupled from renderer)
 * - In-memory buffer state storage with O(1) access
 * - Integrates with TerminalLibraryAdapter for buffer capture/restore
 *
 * Performance Requirements:
 * - <100ms save operation for 10k lines
 * - <200ms trim operation for 60k → 10k lines
 * - O(1) buffer retrieval for instance reuse
 *
 * @see docs/terminal-persistence-architecture.md
 */
export class TerminalBufferService {
  private static readonly MAX_SCROLLBACK_LINES = 10000;
  private static readonly MAX_BUFFER_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
  private static readonly TRIM_PERFORMANCE_THRESHOLD_MS = 200;
  private static readonly MEMORY_WARNING_THRESHOLD_BYTES = 400 * 1024 * 1024; // 400MB total

  private bufferStates: Map<string, TerminalBufferState>;
  private trimOperationCount: number = 0;
  private totalBytesTrimmed: number = 0;

  constructor() {
    this.bufferStates = new Map();

    log.info('[TerminalBufferService] Service initialized', {
      maxScrollbackLines: TerminalBufferService.MAX_SCROLLBACK_LINES,
      maxBufferSizeBytes: TerminalBufferService.MAX_BUFFER_SIZE_BYTES,
      memoryWarningThreshold: TerminalBufferService.MEMORY_WARNING_THRESHOLD_BYTES,
      trimPerformanceTarget: TerminalBufferService.TRIM_PERFORMANCE_THRESHOLD_MS,
    });
  }

  /**
   * Get maximum scrollback lines allowed
   */
  getMaxScrollbackLines(): number {
    return TerminalBufferService.MAX_SCROLLBACK_LINES;
  }

  /**
   * Get maximum buffer size in bytes
   */
  getMaxBufferSizeBytes(): number {
    return TerminalBufferService.MAX_BUFFER_SIZE_BYTES;
  }

  /**
   * Save buffer state with automatic trimming and memory monitoring
   * @param bufferState The buffer state to save
   */
  saveBufferState(bufferState: TerminalBufferState): void {
    const startTime = Date.now();

    log.debug('[TerminalBufferService] Saving buffer state', {
      terminalId: bufferState.terminalId,
      lines: bufferState.scrollback.length,
      sizeBytes: bufferState.sizeBytes,
    });

    // Auto-trim if needed
    let stateToSave = bufferState;
    if (this.needsTrimming(bufferState)) {
      log.info('[TerminalBufferService] Auto-trimming on save', {
        terminalId: bufferState.terminalId,
        linesBefore: bufferState.scrollback.length,
        bytesBefore: bufferState.sizeBytes,
      });
      stateToSave = this.trimBufferIfNeeded(bufferState);
    }

    this.bufferStates.set(stateToSave.terminalId, stateToSave);

    const duration = Date.now() - startTime;

    log.debug('[TerminalBufferService] Buffer state saved', {
      terminalId: stateToSave.terminalId,
      lines: stateToSave.scrollback.length,
      sizeBytes: stateToSave.sizeBytes,
      durationMs: duration,
    });

    // Memory monitoring with warnings
    this.checkMemoryPressure();

    // Performance logging for manual testing
    if (duration > 100) {
      log.warn('[TerminalBufferService] Save operation exceeded 100ms target', {
        terminalId: stateToSave.terminalId,
        durationMs: duration,
        lines: stateToSave.scrollback.length,
      });
    }
  }

  /**
   * Get buffer state by terminal ID
   * @param terminalId The terminal ID
   * @returns The buffer state or undefined
   */
  getBufferState(terminalId: string): TerminalBufferState | undefined {
    return this.bufferStates.get(terminalId);
  }

  /**
   * Remove buffer state
   * @param terminalId The terminal ID
   */
  removeBufferState(terminalId: string): void {
    const removed = this.bufferStates.delete(terminalId);
    if (removed) {
      log.debug('[TerminalBufferService] Buffer state removed', { terminalId });
    }
  }

  /**
   * Check if buffer state exists
   * @param terminalId The terminal ID
   * @returns True if buffer state exists
   */
  hasBufferState(terminalId: string): boolean {
    return this.bufferStates.has(terminalId);
  }

  /**
   * Clear all buffer states
   */
  clearAllBufferStates(): void {
    const count = this.bufferStates.size;
    this.bufferStates.clear();
    log.info('[TerminalBufferService] All buffer states cleared', { count });
  }

  /**
   * Get all buffer states
   * @returns Array of all buffer states
   */
  getAllBufferStates(): TerminalBufferState[] {
    return Array.from(this.bufferStates.values());
  }

  /**
   * Get buffer count
   * @returns Number of buffers stored
   */
  getBufferCount(): number {
    return this.bufferStates.size;
  }

  /**
   * Get total memory usage across all buffers
   * @returns Total bytes used
   */
  getTotalMemoryUsage(): number {
    let total = 0;
    for (const state of this.bufferStates.values()) {
      total += state.sizeBytes;
    }
    return total;
  }

  /**
   * Check if buffer needs trimming
   * @param bufferState The buffer state to check
   * @returns True if trimming needed
   */
  private needsTrimming(bufferState: TerminalBufferState): boolean {
    return (
      bufferState.scrollback.length > TerminalBufferService.MAX_SCROLLBACK_LINES ||
      bufferState.sizeBytes > TerminalBufferService.MAX_BUFFER_SIZE_BYTES
    );
  }

  /**
   * Trim buffer if it exceeds limits using optimized FIFO strategy 
   * @param bufferState The buffer state to trim
   * @returns Trimmed buffer state
   */
  trimBufferIfNeeded(bufferState: TerminalBufferState): TerminalBufferState {
    if (!this.needsTrimming(bufferState)) {
      return bufferState;
    }

    const trimStartTime = Date.now();
    const linesBefore = bufferState.scrollback.length;
    const bytesBefore = bufferState.sizeBytes;

    let trimmedScrollback = [...bufferState.scrollback];

    //  Optimization: Trim by line count first (more efficient)
    if (trimmedScrollback.length > TerminalBufferService.MAX_SCROLLBACK_LINES) {
      const linesToRemove = trimmedScrollback.length - TerminalBufferService.MAX_SCROLLBACK_LINES;
      trimmedScrollback = trimmedScrollback.slice(linesToRemove);
      log.debug('[TerminalBufferService] Trimmed by line count', {
        terminalId: bufferState.terminalId,
        linesRemoved: linesToRemove,
        linesRemaining: trimmedScrollback.length,
      });
    }

    //  Optimization: Batch size calculation for better performance
    let trimmedContent = trimmedScrollback.join('\n');
    let currentSize = trimmedContent.length;

    // Trim by size (FIFO - remove oldest lines until under limit)
    if (currentSize > TerminalBufferService.MAX_BUFFER_SIZE_BYTES) {
      // : Estimate lines to remove based on average line size
      const avgLineSize = currentSize / trimmedScrollback.length;
      const bytesOverLimit = currentSize - TerminalBufferService.MAX_BUFFER_SIZE_BYTES;
      const estimatedLinesToRemove = Math.ceil(bytesOverLimit / avgLineSize);

      // Remove estimated lines in one operation (faster than shift loop)
      if (estimatedLinesToRemove > 0 && estimatedLinesToRemove < trimmedScrollback.length) {
        trimmedScrollback = trimmedScrollback.slice(estimatedLinesToRemove);
        trimmedContent = trimmedScrollback.join('\n');
        currentSize = trimmedContent.length;

        log.debug('[TerminalBufferService] Fast trim estimation', {
          terminalId: bufferState.terminalId,
          estimatedLinesToRemove,
          bytesOverLimit,
        });
      }

      // Fine-tune if still over limit (fallback to precise trimming)
      while (
        currentSize > TerminalBufferService.MAX_BUFFER_SIZE_BYTES &&
        trimmedScrollback.length > 0
      ) {
        trimmedScrollback.shift();
        trimmedContent = trimmedScrollback.join('\n');
        currentSize = trimmedContent.length;
      }
    }

    const trimmedSizeBytes = trimmedContent.length;
    const bytesRemoved = bytesBefore - trimmedSizeBytes;
    const trimDuration = Date.now() - trimStartTime;

    // : Track trim statistics
    this.trimOperationCount++;
    this.totalBytesTrimmed += bytesRemoved;

    log.info('[TerminalBufferService] Buffer trimmed (optimized)', {
      terminalId: bufferState.terminalId,
      linesBefore,
      linesAfter: trimmedScrollback.length,
      bytesBefore,
      bytesAfter: trimmedSizeBytes,
      bytesRemoved,
      trimDurationMs: trimDuration,
      totalTrimsPerformed: this.trimOperationCount,
    });

    // Performance warning for manual testing
    if (trimDuration > TerminalBufferService.TRIM_PERFORMANCE_THRESHOLD_MS) {
      log.warn('[TerminalBufferService] Trim operation exceeded performance threshold', {
        terminalId: bufferState.terminalId,
        trimDurationMs: trimDuration,
        threshold: TerminalBufferService.TRIM_PERFORMANCE_THRESHOLD_MS,
        linesBefore,
      });
    }

    return {
      ...bufferState,
      content: trimmedContent,
      scrollback: trimmedScrollback,
      sizeBytes: trimmedSizeBytes,
      timestamp: new Date(),
    };
  }

  /**
   * Get trim statistics for a buffer
   * @param bufferState The buffer state to analyze
   * @returns Trim statistics or null if no trimming needed
   */
  getTrimStats(bufferState: TerminalBufferState): BufferTrimStats | null {
    if (!this.needsTrimming(bufferState)) {
      return null;
    }

    const trimmedState = this.trimBufferIfNeeded(bufferState);

    return {
      linesBefore: bufferState.scrollback.length,
      linesAfter: trimmedState.scrollback.length,
      bytesRemoved: bufferState.sizeBytes - trimmedState.sizeBytes,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate buffer size in bytes
   * @param content The buffer content
   * @returns Size in bytes
   */
  calculateBufferSize(content: string): number {
    return content.length;
  }

  /**
   * : Check memory pressure and log warnings
   * Monitors total memory usage across all buffers
   */
  private checkMemoryPressure(): void {
    const totalMemory = this.getTotalMemoryUsage();
    const bufferCount = this.getBufferCount();

    if (totalMemory > TerminalBufferService.MEMORY_WARNING_THRESHOLD_BYTES) {
      log.warn('[TerminalBufferService] Memory pressure detected', {
        totalMemoryBytes: totalMemory,
        totalMemoryMB: (totalMemory / (1024 * 1024)).toFixed(2),
        threshold: TerminalBufferService.MEMORY_WARNING_THRESHOLD_BYTES,
        bufferCount,
        avgBufferSizeMB: (totalMemory / bufferCount / (1024 * 1024)).toFixed(2),
      });
    } else {
      log.debug('[TerminalBufferService] Memory status normal', {
        totalMemoryBytes: totalMemory,
        totalMemoryMB: (totalMemory / (1024 * 1024)).toFixed(2),
        bufferCount,
      });
    }
  }

  /**
   * : Get memory monitoring statistics
   * @returns Detailed memory usage metrics
   */
  getMemoryStats(): {
    totalBytes: number;
    totalMB: number;
    bufferCount: number;
    avgBufferSizeBytes: number;
    avgBufferSizeMB: number;
    maxBufferSizeBytes: number;
    minBufferSizeBytes: number;
    trimOperationCount: number;
    totalBytesTrimmed: number;
    totalBytesTrimmedMB: number;
    isUnderPressure: boolean;
  } {
    const allBuffers = this.getAllBufferStates();
    const totalBytes = this.getTotalMemoryUsage();
    const bufferCount = this.getBufferCount();

    let maxBufferSize = 0;
    let minBufferSize = bufferCount > 0 ? Infinity : 0;

    allBuffers.forEach((buffer) => {
      if (buffer.sizeBytes > maxBufferSize) {
        maxBufferSize = buffer.sizeBytes;
      }
      if (buffer.sizeBytes < minBufferSize) {
        minBufferSize = buffer.sizeBytes;
      }
    });

    if (bufferCount === 0) {
      minBufferSize = 0;
    }

    const avgBufferSize = bufferCount > 0 ? totalBytes / bufferCount : 0;
    const isUnderPressure = totalBytes > TerminalBufferService.MEMORY_WARNING_THRESHOLD_BYTES;

    const stats = {
      totalBytes,
      totalMB: totalBytes / (1024 * 1024),
      bufferCount,
      avgBufferSizeBytes: avgBufferSize,
      avgBufferSizeMB: avgBufferSize / (1024 * 1024),
      maxBufferSizeBytes: maxBufferSize,
      minBufferSizeBytes: minBufferSize,
      trimOperationCount: this.trimOperationCount,
      totalBytesTrimmed: this.totalBytesTrimmed,
      totalBytesTrimmedMB: this.totalBytesTrimmed / (1024 * 1024),
      isUnderPressure,
    };

    log.debug('[TerminalBufferService] Memory statistics retrieved', stats);

    return stats;
  }

  /**
   * : Get individual buffer memory info
   * @param terminalId The terminal ID
   * @returns Buffer memory details or null
   */
  getBufferMemoryInfo(terminalId: string): {
    terminalId: string;
    sizeBytes: number;
    sizeMB: number;
    lineCount: number;
    avgLineSize: number;
    percentOfLimit: number;
  } | null {
    const buffer = this.getBufferState(terminalId);

    if (!buffer) {
      return null;
    }

    const avgLineSize =
      buffer.scrollback.length > 0 ? buffer.sizeBytes / buffer.scrollback.length : 0;

    const percentOfLimit = (buffer.sizeBytes / TerminalBufferService.MAX_BUFFER_SIZE_BYTES) * 100;

    return {
      terminalId: buffer.terminalId,
      sizeBytes: buffer.sizeBytes,
      sizeMB: buffer.sizeBytes / (1024 * 1024),
      lineCount: buffer.scrollback.length,
      avgLineSize,
      percentOfLimit,
    };
  }

  /**
   * : Reset trim statistics (useful for testing)
   */
  resetTrimStats(): void {
    this.trimOperationCount = 0;
    this.totalBytesTrimmed = 0;
    log.info('[TerminalBufferService] Trim statistics reset');
  }

  /**
   * : Log comprehensive memory report (for manual testing/debugging)
   */
  logMemoryReport(): void {
    const stats = this.getMemoryStats();
    const allBuffers = this.getAllBufferStates();

    log.info('[TerminalBufferService] === Memory Report ===', {
      timestamp: new Date().toISOString(),
      summary: {
        totalMemoryMB: stats.totalMB.toFixed(2),
        bufferCount: stats.bufferCount,
        avgBufferSizeMB: stats.avgBufferSizeMB.toFixed(2),
        isUnderPressure: stats.isUnderPressure,
      },
      trimStats: {
        totalOperations: stats.trimOperationCount,
        totalBytesTrimmedMB: stats.totalBytesTrimmedMB.toFixed(2),
      },
      bufferDetails: allBuffers.map((buffer) => ({
        terminalId: buffer.terminalId,
        sizeMB: (buffer.sizeBytes / (1024 * 1024)).toFixed(2),
        lines: buffer.scrollback.length,
        percentOfLimit: (
          (buffer.sizeBytes / TerminalBufferService.MAX_BUFFER_SIZE_BYTES) *
          100
        ).toFixed(1),
      })),
    });
  }
}
