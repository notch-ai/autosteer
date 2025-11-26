/**
 * Unit tests for Performance Monitor
 * Work Package 5: Performance Metrics & Documentation
 *
 * Tests verify:
 * - Accurate render time tracking
 * - Interaction performance monitoring
 * - Violation detection and reporting
 * - Component breakdown analysis
 * - Metrics export/import functionality
 */

import {
  PerformanceMonitor,
  performanceMonitor,
} from '@/commons/utils/performance/performanceMonitor';
import { logger } from '@/commons/utils/logger';

// Mock logger
jest.mock('@/commons/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    jest.clearAllMocks();
    monitor = new PerformanceMonitor();
  });

  afterEach(() => {
    monitor.clearMetrics();
  });

  describe('Render Tracking', () => {
    it('should track component render times', () => {
      monitor.trackRender('MessageItem', 8.5);
      monitor.trackRender('VirtualizedList', 12.3);
      monitor.trackRender('ChatInterface', 15.2);

      const report = monitor.getReport();

      expect(report.renders.total).toBe(3);
      expect(report.renders.average).toBeCloseTo((8.5 + 12.3 + 15.2) / 3, 1);
      expect(report.renders.min).toBe(8.5);
      expect(report.renders.max).toBe(15.2);
    });

    it('should detect render budget violations (>16ms)', () => {
      monitor.trackRender('SlowComponent', 25);
      monitor.trackRender('FastComponent', 8);
      monitor.trackRender('AnotherSlowComponent', 18);

      const report = monitor.getReport();

      expect(report.renders.violations).toBe(2);
      expect(logger.warn).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledWith(
        '[PerformanceMonitor] Render budget exceeded',
        expect.objectContaining({
          componentName: 'SlowComponent',
          duration: 25,
          budget: 16,
        })
      );
    });

    it('should calculate percentiles correctly', () => {
      const durations = [5, 8, 10, 12, 15, 18, 20, 25, 30, 40];
      durations.forEach((duration, i) => {
        monitor.trackRender(`Component${i}`, duration);
      });

      const report = monitor.getReport();

      expect(report.renders.p50).toBeGreaterThan(10);
      expect(report.renders.p50).toBeLessThan(20);
      expect(report.renders.p95).toBeGreaterThan(30);
      expect(report.renders.p99).toBeGreaterThan(35);
    });

    it('should limit stored metrics to max capacity', () => {
      // Add 1500 metrics (exceeds 1000 limit)
      for (let i = 0; i < 1500; i++) {
        monitor.trackRender(`Component${i}`, 10);
      }

      const report = monitor.getReport();

      expect(report.renders.total).toBeLessThanOrEqual(1000);
    });
  });

  describe('Interaction Tracking', () => {
    it('should track user interaction times', () => {
      monitor.trackInteraction('button-click', 5.2);
      monitor.trackInteraction('scroll', 8.1);
      monitor.trackInteraction('input-change', 12.5);

      const report = monitor.getReport();

      expect(report.interactions.total).toBe(3);
      expect(report.interactions.average).toBeCloseTo((5.2 + 8.1 + 12.5) / 3, 1);
      expect(report.interactions.min).toBe(5.2);
      expect(report.interactions.max).toBe(12.5);
    });

    it('should detect interaction budget violations (>16ms)', () => {
      monitor.trackInteraction('slow-click', 22);
      monitor.trackInteraction('fast-click', 5);
      monitor.trackInteraction('medium-click', 18);

      const report = monitor.getReport();

      expect(report.interactions.violations).toBe(2);
      expect(logger.warn).toHaveBeenCalledTimes(2);
    });

    it('should handle rapid interactions', () => {
      // Simulate 100 rapid clicks
      for (let i = 0; i < 100; i++) {
        monitor.trackInteraction('rapid-click', 5 + Math.random() * 5);
      }

      const report = monitor.getReport();

      expect(report.interactions.total).toBe(100);
      expect(report.interactions.average).toBeLessThan(16);
      expect(report.interactions.violations).toBe(0);
    });
  });

  describe('Component Breakdown', () => {
    it('should group metrics by component name', () => {
      monitor.trackRender('MessageItem', 8);
      monitor.trackRender('MessageItem', 10);
      monitor.trackRender('MessageItem', 12);
      monitor.trackRender('VirtualizedList', 15);
      monitor.trackRender('VirtualizedList', 18);

      const report = monitor.getReport();
      const breakdown = report.componentBreakdown;

      expect(breakdown.size).toBe(2);

      const messageItem = breakdown.get('MessageItem');
      expect(messageItem).toBeDefined();
      expect(messageItem?.count).toBe(3);
      expect(messageItem?.average).toBeCloseTo(10, 1);
      expect(messageItem?.max).toBe(12);

      const virtualizedList = breakdown.get('VirtualizedList');
      expect(virtualizedList).toBeDefined();
      expect(virtualizedList?.count).toBe(2);
      expect(virtualizedList?.average).toBeCloseTo(16.5, 1);
      expect(virtualizedList?.max).toBe(18);
    });

    it('should track violations per component', () => {
      monitor.trackRender('SlowComponent', 20);
      monitor.trackRender('SlowComponent', 25);
      monitor.trackRender('SlowComponent', 10);
      monitor.trackRender('FastComponent', 8);
      monitor.trackRender('FastComponent', 12);

      const report = monitor.getReport();
      const breakdown = report.componentBreakdown;

      const slow = breakdown.get('SlowComponent');
      expect(slow?.violations).toBe(2);

      const fast = breakdown.get('FastComponent');
      expect(fast?.violations).toBe(0);
    });

    it('should get metrics for specific component', () => {
      monitor.trackRender('TargetComponent', 8);
      monitor.trackRender('TargetComponent', 12);
      monitor.trackRender('TargetComponent', 20);
      monitor.trackRender('OtherComponent', 10);

      const metrics = monitor.getComponentMetrics('TargetComponent');

      expect(metrics).toBeDefined();
      expect(metrics?.count).toBe(3);
      expect(metrics?.average).toBeCloseTo(13.33, 1);
      expect(metrics?.min).toBe(8);
      expect(metrics?.max).toBe(20);
      expect(metrics?.violations).toBe(1);
    });

    it('should return null for non-existent component', () => {
      const metrics = monitor.getComponentMetrics('NonExistent');
      expect(metrics).toBeNull();
    });
  });

  describe('Violation Detection', () => {
    it('should identify all violations', () => {
      monitor.trackRender('Component1', 18);
      monitor.trackRender('Component2', 8);
      monitor.trackRender('Component3', 25);
      monitor.trackInteraction('click1', 20);
      monitor.trackInteraction('click2', 10);

      const violations = monitor.getViolations();

      expect(violations.renders).toHaveLength(2);
      expect(violations.interactions).toHaveLength(1);

      expect(violations.renders[0].componentName).toBe('Component1');
      expect(violations.renders[1].componentName).toBe('Component3');
      expect(violations.interactions[0].type).toBe('click1');
    });

    it('should calculate violation rate', () => {
      monitor.trackRender('Component', 20); // Violation
      monitor.trackRender('Component', 10);
      monitor.trackRender('Component', 25); // Violation
      monitor.trackRender('Component', 8);
      monitor.trackRender('Component', 12);

      const rates = monitor.getViolationRate();

      expect(rates.renders).toBeCloseTo(0.4, 1); // 2/5 = 40%
    });

    it('should detect if any violations exist', () => {
      monitor.trackRender('FastComponent', 8);
      expect(monitor.hasViolations()).toBe(false);

      monitor.trackRender('SlowComponent', 20);
      expect(monitor.hasViolations()).toBe(true);
    });
  });

  describe('Metrics Management', () => {
    it('should clear all metrics', () => {
      monitor.trackRender('Component', 10);
      monitor.trackInteraction('click', 5);

      let report = monitor.getReport();
      expect(report.renders.total).toBe(1);
      expect(report.interactions.total).toBe(1);

      monitor.clearMetrics();

      report = monitor.getReport();
      expect(report.renders.total).toBe(0);
      expect(report.interactions.total).toBe(0);
    });

    it('should export metrics', () => {
      monitor.trackRender('Component1', 10);
      monitor.trackRender('Component2', 15);
      monitor.trackInteraction('click', 5);

      const exported = monitor.exportMetrics();

      expect(exported.renders).toHaveLength(2);
      expect(exported.interactions).toHaveLength(1);
      expect(exported.report).toBeDefined();
      expect(exported.report.renders.total).toBe(2);
    });

    it('should import metrics', () => {
      const data = {
        renders: [
          { componentName: 'ImportedComponent', duration: 12, timestamp: Date.now() },
          { componentName: 'ImportedComponent', duration: 15, timestamp: Date.now() },
        ],
        interactions: [{ type: 'imported-click', duration: 8, timestamp: Date.now() }],
      };

      monitor.importMetrics(data);

      const report = monitor.getReport();
      expect(report.renders.total).toBe(2);
      expect(report.interactions.total).toBe(1);
    });

    it('should handle empty metrics gracefully', () => {
      const report = monitor.getReport();

      expect(report.renders.total).toBe(0);
      expect(report.renders.average).toBe(0);
      expect(report.renders.min).toBe(0);
      expect(report.renders.max).toBe(0);
      expect(report.renders.violations).toBe(0);
    });
  });

  describe('Reporting', () => {
    it('should generate comprehensive report', async () => {
      monitor.trackRender('MessageItem', 8);
      monitor.trackRender('MessageItem', 12);
      monitor.trackRender('VirtualizedList', 15);
      monitor.trackInteraction('scroll', 10);
      monitor.trackInteraction('click', 5);

      // Add small delay to ensure time passes
      await new Promise((resolve) => setTimeout(resolve, 10));

      const report = monitor.getReport();

      expect(report.renders).toBeDefined();
      expect(report.interactions).toBeDefined();
      expect(report.componentBreakdown).toBeDefined();
      expect(report.timeRange).toBeDefined();

      expect(report.timeRange.start).toBeLessThanOrEqual(report.timeRange.end);
      expect(report.timeRange.duration).toBeGreaterThanOrEqual(0);
    });

    it('should log report to console', () => {
      monitor.trackRender('Component1', 10);
      monitor.trackRender('Component2', 15);
      monitor.trackInteraction('click', 5);

      monitor.logReport();

      expect(logger.info).toHaveBeenCalledWith(
        '[PerformanceMonitor] Performance Report',
        expect.objectContaining({
          sessionDuration: expect.any(String),
          renders: expect.any(Object),
          interactions: expect.any(Object),
        })
      );
    });

    it('should log top 5 slowest components', () => {
      // Add 10 components with varying durations
      for (let i = 0; i < 10; i++) {
        monitor.trackRender(`Component${i}`, 10 + i * 2);
      }

      monitor.logReport();

      expect(logger.info).toHaveBeenCalledWith(
        '[PerformanceMonitor] Top 5 Slowest Components',
        expect.objectContaining({
          components: expect.arrayContaining([
            expect.objectContaining({
              name: expect.any(String),
              average: expect.any(String),
              max: expect.any(String),
              count: expect.any(Number),
            }),
          ]),
        })
      );
    });
  });

  describe('Singleton Instance', () => {
    it('should provide global singleton instance', () => {
      expect(performanceMonitor).toBeDefined();
      expect(performanceMonitor).toBeInstanceOf(PerformanceMonitor);
    });

    it('should share state across imports', () => {
      performanceMonitor.trackRender('GlobalComponent', 10);

      const report = performanceMonitor.getReport();
      expect(report.renders.total).toBeGreaterThan(0);

      performanceMonitor.clearMetrics();
    });
  });

  describe('Performance Under Load', () => {
    it('should handle 1000 metrics efficiently', () => {
      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        monitor.trackRender(`Component${i % 10}`, 10 + Math.random() * 10);
      }

      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(100); // Should be fast
      expect(monitor.getReport().renders.total).toBeLessThanOrEqual(1000);
    });

    it('should calculate report efficiently', () => {
      // Add maximum metrics
      for (let i = 0; i < 1000; i++) {
        monitor.trackRender(`Component${i % 50}`, 10 + Math.random() * 10);
      }

      const startTime = performance.now();
      const report = monitor.getReport();
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(50); // Report generation should be fast
      expect(report).toBeDefined();
      expect(report.componentBreakdown.size).toBeLessThanOrEqual(50);
    });
  });
});
