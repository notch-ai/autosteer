/**
 * Tab Switch Timer Utility
 *
 * Lightweight performance monitoring for tab switching operations.
 * Uses Performance API for high-precision timing measurements.
 *
 * Target: <50ms tab switch time
 *
 * Features:
 * - High-precision timing with Performance API
 * - Automatic threshold violation warnings
 * - Metrics collection and statistics
 * - Memory-efficient circular buffer (max 100 metrics)
 * - Application logging for monitoring
 *
 * @see docs/guides-architecture.md - Performance Requirements
 */

import { logger } from '../logger';

/**
 * Performance metric for a single tab switch operation
 */
export interface TabSwitchMetric {
  switchId: string;
  duration: number;
  timestamp: number;
  exceededThreshold: boolean;
}

/**
 * Aggregate statistics for tab switch performance
 */
export interface TabSwitchStats {
  count: number;
  average: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

/**
 * Tab Switch Timer Class
 * Manages timing measurements for tab switching operations
 */
class TabSwitchTimer {
  private readonly THRESHOLD_MS = 50;
  private readonly MAX_METRICS = 100;

  private activeTimers: Map<string, number> = new Map();
  private metrics: TabSwitchMetric[] = [];

  /**
   * Start timing a tab switch operation
   * @param switchId Unique identifier for the switch operation
   */
  start(switchId: string): void {
    if (this.activeTimers.has(switchId)) {
      logger.warn('[tabSwitchTimer] Timer already running', {
        switchId,
        existingStartTime: this.activeTimers.get(switchId),
      });
      return;
    }

    const startTime = performance.now();
    this.activeTimers.set(switchId, startTime);

    logger.debug('[tabSwitchTimer] Tab switch started', {
      switchId,
      startTime,
    });
  }

  /**
   * End timing a tab switch operation and record metrics
   * @param switchId Unique identifier for the switch operation
   * @returns Duration in milliseconds, or 0 if timer not found
   */
  end(switchId: string): number {
    const startTime = this.activeTimers.get(switchId);

    if (startTime === undefined) {
      logger.warn('[tabSwitchTimer] Attempted to end non-existent timer', {
        switchId,
      });
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const exceededThreshold = duration >= this.THRESHOLD_MS;

    // Remove from active timers
    this.activeTimers.delete(switchId);

    // Record metric
    const metric: TabSwitchMetric = {
      switchId,
      duration,
      timestamp: Date.now(),
      exceededThreshold,
    };

    this.addMetric(metric);

    // Log based on performance
    if (exceededThreshold) {
      logger.warn('[tabSwitchTimer] Tab switch exceeded target', {
        switchId,
        duration: Math.round(duration * 100) / 100,
        threshold: this.THRESHOLD_MS,
      });
    } else {
      logger.info('[tabSwitchTimer] Tab switch completed', {
        switchId,
        duration: Math.round(duration * 100) / 100,
      });
    }

    return duration;
  }

  /**
   * Add metric to storage with circular buffer behavior
   */
  private addMetric(metric: TabSwitchMetric): void {
    this.metrics.push(metric);

    // Maintain circular buffer - remove oldest if over limit
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift();
    }
  }

  /**
   * Get all recorded metrics
   * @returns Array of tab switch metrics
   */
  getMetrics(): TabSwitchMetric[] {
    return [...this.metrics];
  }

  /**
   * Calculate performance statistics from recorded metrics
   * @returns Aggregate statistics or null if no metrics available
   */
  getStats(): TabSwitchStats | null {
    if (this.metrics.length === 0) {
      return null;
    }

    const durations = this.metrics.map((m) => m.duration).sort((a, b) => a - b);
    const count = durations.length;
    const sum = durations.reduce((a, b) => a + b, 0);

    const stats: TabSwitchStats = {
      count,
      average: sum / count,
      min: durations[0],
      max: durations[count - 1],
      p50: this.percentile(durations, 50),
      p95: this.percentile(durations, 95),
      p99: this.percentile(durations, 99),
    };

    return stats;
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;

    const index = (p / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (upper >= sortedValues.length) {
      return sortedValues[sortedValues.length - 1];
    }

    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Clear all recorded metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    logger.debug('[tabSwitchTimer] Metrics cleared');
  }

  /**
   * Get the current threshold in milliseconds
   */
  getThreshold(): number {
    return this.THRESHOLD_MS;
  }

  /**
   * Get the maximum number of stored metrics
   */
  getMaxMetrics(): number {
    return this.MAX_METRICS;
  }

  /**
   * Check if a timer is currently running
   */
  isRunning(switchId: string): boolean {
    return this.activeTimers.has(switchId);
  }

  /**
   * Get count of currently active timers
   */
  getActiveTimerCount(): number {
    return this.activeTimers.size;
  }
}

// Singleton instance
export const tabSwitchTimer = new TabSwitchTimer();
