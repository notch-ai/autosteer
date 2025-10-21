/**
 * Phase 8: Automated Metrics Collection System
 * Tracks velocity metrics and performance improvements
 */

import * as fs from 'fs/promises';
import * as path from 'path';

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

export default class MetricsCollector {
  private metricsDir: string;

  constructor(metricsDir: string) {
    this.metricsDir = metricsDir;
  }

  async recordMetrics(metrics: MetricsData): Promise<void> {
    await fs.mkdir(this.metricsDir, { recursive: true });

    const metricsFile = path.join(this.metricsDir, 'latest-metrics.json');
    const historyFile = path.join(this.metricsDir, 'metrics-history.json');

    // Save latest metrics
    await fs.writeFile(metricsFile, JSON.stringify(metrics, null, 2));

    // Append to history
    let history: MetricsData[] = [];
    try {
      const historyContent = await fs.readFile(historyFile, 'utf-8');
      history = JSON.parse(historyContent);
    } catch (e) {
      // File doesn't exist, start fresh
    }

    history.push(metrics);
    await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
  }

  async getLatestMetrics(): Promise<MetricsData> {
    const metricsFile = path.join(this.metricsDir, 'latest-metrics.json');
    const content = await fs.readFile(metricsFile, 'utf-8');
    return JSON.parse(content);
  }

  async calculateVelocityTrend(): Promise<VelocityTrend> {
    const historyFile = path.join(this.metricsDir, 'metrics-history.json');
    const content = await fs.readFile(historyFile, 'utf-8');
    const history: MetricsData[] = JSON.parse(content);

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
}
