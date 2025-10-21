/**
 * Phase 8: Automated Metrics Collection System
 * Tracks velocity metrics and performance improvements
 */

import { logger } from '@/commons/utils/logger';

export interface MetricsData {
  timestamp: number;
  buildTime: number;
  bundleSize: number;
  componentCount: number;
  velocity: number;
  codeReduction: number;
}

export interface VelocityTrend {
  improvement: number;
  buildTimeReduction: number;
  bundleSizeReduction: number;
}

const METRICS_KEY = 'notch-metrics';
const HISTORY_KEY = 'notch-metrics-history';
const MAX_HISTORY_ENTRIES = 100;

export class MetricsCollector {
  /**
   * Record metrics data to localStorage
   */
  static async recordMetrics(metrics: MetricsData): Promise<void> {
    try {
      // Use localStorage for renderer process persistence
      localStorage.setItem(METRICS_KEY, JSON.stringify(metrics));

      // Append to history
      let history: MetricsData[] = [];
      try {
        const historyJson = localStorage.getItem(HISTORY_KEY);
        if (historyJson) {
          history = JSON.parse(historyJson);
        }
      } catch (e) {
        // Invalid JSON, start fresh
        history = [];
      }

      history.push(metrics);

      // Keep only last entries to prevent storage bloat
      if (history.length > MAX_HISTORY_ENTRIES) {
        history = history.slice(-MAX_HISTORY_ENTRIES);
      }

      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      logger.error('Failed to record metrics:', error);
    }
  }

  /**
   * Get latest metrics from localStorage
   */
  static async getLatestMetrics(): Promise<MetricsData | null> {
    try {
      const metricsJson = localStorage.getItem(METRICS_KEY);
      if (!metricsJson) {
        return null;
      }
      return JSON.parse(metricsJson);
    } catch (error) {
      logger.error('Failed to load latest metrics:', error);
      return null;
    }
  }

  /**
   * Calculate velocity trend from metrics history
   */
  static async calculateVelocityTrend(): Promise<VelocityTrend> {
    try {
      const historyJson = localStorage.getItem(HISTORY_KEY);
      if (!historyJson) {
        return { improvement: 0, buildTimeReduction: 0, bundleSizeReduction: 0 };
      }

      const history: MetricsData[] = JSON.parse(historyJson);

      if (history.length < 2) {
        return { improvement: 0, buildTimeReduction: 0, bundleSizeReduction: 0 };
      }

      const latest = history[history.length - 1];
      const baseline = history[0];

      const improvement = ((latest.velocity - baseline.velocity) / baseline.velocity) * 100;
      const buildTimeReduction =
        ((baseline.buildTime - latest.buildTime) / baseline.buildTime) * 100;
      const bundleSizeReduction =
        ((baseline.bundleSize - latest.bundleSize) / baseline.bundleSize) * 100;

      return {
        improvement,
        buildTimeReduction,
        bundleSizeReduction,
      };
    } catch (error) {
      logger.error('Failed to calculate velocity trend:', error);
      return { improvement: 0, buildTimeReduction: 0, bundleSizeReduction: 0 };
    }
  }

  /**
   * Clear all metrics data
   */
  static clearMetrics(): void {
    localStorage.removeItem(METRICS_KEY);
    localStorage.removeItem(HISTORY_KEY);
  }
}
