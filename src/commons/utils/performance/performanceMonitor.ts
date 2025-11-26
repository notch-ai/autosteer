/**
 * Performance Monitoring Utility
 * Work Package 5: Performance Metrics & Documentation
 *
 * Collects and reports React component performance metrics.
 * Integrates with React DevTools Profiler API for production monitoring.
 *
 * Usage:
 * ```typescript
 * import { performanceMonitor } from '@/commons/utils/performance/performanceMonitor';
 *
 * // Track component render
 * performanceMonitor.trackRender('MessageItem', 8.5);
 *
 * // Track interaction
 * performanceMonitor.trackInteraction('button-click', 5.2);
 *
 * // Get metrics
 * const report = performanceMonitor.getReport();
 * console.log(report);
 * ```
 */

import { logger } from '../logger';

export interface RenderMetric {
  componentName: string;
  duration: number;
  timestamp: number;
}

export interface InteractionMetric {
  type: string;
  duration: number;
  timestamp: number;
}

export interface PerformanceReport {
  renders: {
    total: number;
    average: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
    violations: number; // >16ms
  };
  interactions: {
    total: number;
    average: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
    violations: number; // >16ms
  };
  componentBreakdown: Map<
    string,
    {
      count: number;
      average: number;
      max: number;
      violations: number;
    }
  >;
  timeRange: {
    start: number;
    end: number;
    duration: number;
  };
}

class PerformanceMonitor {
  private renders: RenderMetric[] = [];
  private interactions: InteractionMetric[] = [];
  private maxStoredMetrics = 1000;
  private renderBudget = 16; // 60fps
  private sessionStartTime: number;

  constructor() {
    this.sessionStartTime = Date.now();
    logger.debug('[PerformanceMonitor] Initialized', {
      renderBudget: this.renderBudget,
      maxStoredMetrics: this.maxStoredMetrics,
    });
  }

  trackRender(componentName: string, duration: number): void {
    const metric: RenderMetric = {
      componentName,
      duration,
      timestamp: Date.now(),
    };

    this.renders.push(metric);

    // Trim if exceeding max storage
    if (this.renders.length > this.maxStoredMetrics) {
      this.renders.shift();
    }

    // Warn if exceeding budget
    if (duration >= this.renderBudget) {
      logger.warn('[PerformanceMonitor] Render budget exceeded', {
        componentName,
        duration,
        budget: this.renderBudget,
        exceedance: duration - this.renderBudget,
      });
    }

    logger.debug('[PerformanceMonitor] Render tracked', {
      componentName,
      duration,
    });
  }

  trackInteraction(type: string, duration: number): void {
    const metric: InteractionMetric = {
      type,
      duration,
      timestamp: Date.now(),
    };

    this.interactions.push(metric);

    // Trim if exceeding max storage
    if (this.interactions.length > this.maxStoredMetrics) {
      this.interactions.shift();
    }

    // Warn if exceeding budget
    if (duration >= this.renderBudget) {
      logger.warn('[PerformanceMonitor] Interaction budget exceeded', {
        type,
        duration,
        budget: this.renderBudget,
        exceedance: duration - this.renderBudget,
      });
    }

    logger.debug('[PerformanceMonitor] Interaction tracked', {
      type,
      duration,
    });
  }

  getReport(): PerformanceReport {
    const now = Date.now();

    return {
      renders: this.calculateMetrics(this.renders.map((r) => r.duration)),
      interactions: this.calculateMetrics(this.interactions.map((i) => i.duration)),
      componentBreakdown: this.getComponentBreakdown(),
      timeRange: {
        start: this.sessionStartTime,
        end: now,
        duration: now - this.sessionStartTime,
      },
    };
  }

  getComponentMetrics(componentName: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    violations: number;
  } | null {
    const componentRenders = this.renders.filter((r) => r.componentName === componentName);

    if (componentRenders.length === 0) {
      return null;
    }

    const durations = componentRenders.map((r) => r.duration);
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      count: componentRenders.length,
      average: sum / componentRenders.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      violations: durations.filter((d) => d >= this.renderBudget).length,
    };
  }

  clearMetrics(): void {
    this.renders = [];
    this.interactions = [];
    this.sessionStartTime = Date.now();

    logger.info('[PerformanceMonitor] Metrics cleared');
  }

  exportMetrics(): {
    renders: RenderMetric[];
    interactions: InteractionMetric[];
    report: PerformanceReport;
  } {
    return {
      renders: [...this.renders],
      interactions: [...this.interactions],
      report: this.getReport(),
    };
  }

  importMetrics(data: { renders: RenderMetric[]; interactions: InteractionMetric[] }): void {
    this.renders = [...data.renders];
    this.interactions = [...data.interactions];

    logger.info('[PerformanceMonitor] Metrics imported', {
      renders: this.renders.length,
      interactions: this.interactions.length,
    });
  }

  private calculateMetrics(durations: number[]): {
    total: number;
    average: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
    violations: number;
  } {
    if (durations.length === 0) {
      return {
        total: 0,
        average: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        violations: 0,
      };
    }

    const sorted = [...durations].sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      total: durations.length,
      average: sum / durations.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
      violations: durations.filter((d) => d >= this.renderBudget).length,
    };
  }

  private percentile(sortedArray: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  private getComponentBreakdown(): Map<
    string,
    {
      count: number;
      average: number;
      max: number;
      violations: number;
    }
  > {
    const breakdown = new Map<
      string,
      {
        count: number;
        average: number;
        max: number;
        violations: number;
      }
    >();

    // Group by component name
    const componentGroups = new Map<string, number[]>();

    this.renders.forEach((render) => {
      const existing = componentGroups.get(render.componentName) || [];
      existing.push(render.duration);
      componentGroups.set(render.componentName, existing);
    });

    // Calculate metrics for each component
    componentGroups.forEach((durations, componentName) => {
      const sum = durations.reduce((a, b) => a + b, 0);
      breakdown.set(componentName, {
        count: durations.length,
        average: sum / durations.length,
        max: Math.max(...durations),
        violations: durations.filter((d) => d >= this.renderBudget).length,
      });
    });

    return breakdown;
  }

  logReport(): void {
    const report = this.getReport();

    logger.info('[PerformanceMonitor] Performance Report', {
      sessionDuration: `${(report.timeRange.duration / 1000).toFixed(2)}s`,
      renders: {
        total: report.renders.total,
        average: `${report.renders.average.toFixed(2)}ms`,
        p95: `${report.renders.p95.toFixed(2)}ms`,
        violations: report.renders.violations,
      },
      interactions: {
        total: report.interactions.total,
        average: `${report.interactions.average.toFixed(2)}ms`,
        p95: `${report.interactions.p95.toFixed(2)}ms`,
        violations: report.interactions.violations,
      },
    });

    // Log top 5 slowest components
    const componentArray = Array.from(report.componentBreakdown.entries())
      .sort(([, a], [, b]) => b.average - a.average)
      .slice(0, 5);

    if (componentArray.length > 0) {
      logger.info('[PerformanceMonitor] Top 5 Slowest Components', {
        components: componentArray.map(([name, metrics]) => ({
          name,
          average: `${metrics.average.toFixed(2)}ms`,
          max: `${metrics.max.toFixed(2)}ms`,
          count: metrics.count,
          violations: metrics.violations,
        })),
      });
    }
  }

  getViolations(): {
    renders: RenderMetric[];
    interactions: InteractionMetric[];
  } {
    return {
      renders: this.renders.filter((r) => r.duration >= this.renderBudget),
      interactions: this.interactions.filter((i) => i.duration >= this.renderBudget),
    };
  }

  hasViolations(): boolean {
    const violations = this.getViolations();
    return violations.renders.length > 0 || violations.interactions.length > 0;
  }

  getViolationRate(): {
    renders: number;
    interactions: number;
  } {
    if (this.renders.length === 0 && this.interactions.length === 0) {
      return { renders: 0, interactions: 0 };
    }

    const violations = this.getViolations();

    return {
      renders: this.renders.length > 0 ? violations.renders.length / this.renders.length : 0,
      interactions:
        this.interactions.length > 0
          ? violations.interactions.length / this.interactions.length
          : 0,
    };
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export for testing
export { PerformanceMonitor };
