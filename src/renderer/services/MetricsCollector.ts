/**
 * Phase 8: Automated Metrics Collection System
 * Tracks velocity metrics and performance improvements
 */

import { BaseService } from './BaseService';

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

export class MetricsCollector extends BaseService {
  private static instance: MetricsCollector;

  constructor() {
    super('MetricsCollector');
  }

  static getInstance(): MetricsCollector {
    if (!this.instance) {
      this.instance = new MetricsCollector();
    }
    return this.instance;
  }
  /**
   * Record metrics data to localStorage
   */
  static async recordMetrics(metrics: MetricsData): Promise<void> {
    const instance = this.getInstance();
    await instance.execute(async () => {
      // Use localStorage for renderer process persistence
      localStorage.setItem(METRICS_KEY, JSON.stringify(metrics));

      // Append to history
      let history: MetricsData[] = [];

      // Keep the try-catch for JSON.parse - this is expected behavior
      try {
        const historyJson = localStorage.getItem(HISTORY_KEY);
        if (historyJson) {
          history = JSON.parse(historyJson);
        }
      } catch (e) {
        // Invalid JSON is expected, start fresh
        history = [];
      }

      history.push(metrics);

      // Keep only last entries to prevent storage bloat
      if (history.length > MAX_HISTORY_ENTRIES) {
        history = history.slice(-MAX_HISTORY_ENTRIES);
      }

      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }, 'recordMetrics');
  }

  /**
   * Get latest metrics from localStorage
   */
  static async getLatestMetrics(): Promise<MetricsData | null> {
    const metricsJson = localStorage.getItem(METRICS_KEY);
    if (!metricsJson) {
      return null;
    }

    // Keep try-catch for JSON.parse - expected behavior
    try {
      return JSON.parse(metricsJson);
    } catch {
      // Invalid JSON is expected, return null
      return null;
    }
  }

  /**
   * Calculate velocity trend from metrics history
   */
  static async calculateVelocityTrend(): Promise<VelocityTrend> {
    const historyJson = localStorage.getItem(HISTORY_KEY);
    if (!historyJson) {
      return { improvement: 0, buildTimeReduction: 0, bundleSizeReduction: 0 };
    }

    // Keep try-catch for JSON.parse - expected behavior
    let history: MetricsData[];
    try {
      history = JSON.parse(historyJson);
    } catch {
      // Invalid JSON is expected
      return { improvement: 0, buildTimeReduction: 0, bundleSizeReduction: 0 };
    }

    if (history.length < 2) {
      return { improvement: 0, buildTimeReduction: 0, bundleSizeReduction: 0 };
    }

    const latest = history[history.length - 1];
    const baseline = history[0];

    const improvement = ((latest.velocity - baseline.velocity) / baseline.velocity) * 100;
    const buildTimeReduction = ((baseline.buildTime - latest.buildTime) / baseline.buildTime) * 100;
    const bundleSizeReduction =
      ((baseline.bundleSize - latest.bundleSize) / baseline.bundleSize) * 100;

    return {
      improvement,
      buildTimeReduction,
      bundleSizeReduction,
    };
  }

  /**
   * Clear all metrics data
   */
  static clearMetrics(): void {
    localStorage.removeItem(METRICS_KEY);
    localStorage.removeItem(HISTORY_KEY);
  }
}
