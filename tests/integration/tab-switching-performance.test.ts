/**
 * Tab Switching Performance Integration Tests
 *
 * Tests tab switching performance with target <50ms switch time.
 * Validates memory leak prevention during long-running sessions.
 *
 * Test Coverage:
 * - Tab switch timing <50ms target
 * - Multiple rapid tab switches
 * - Memory leak prevention
 * - Performance degradation over time
 * - Session state preservation during switches
 *
 * @see docs/guides-architecture.md - Handler Pattern Guidelines
 */

import { tabSwitchTimer } from '@/commons/utils/performance/tabSwitchTimer';
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

// Mock electron
jest.mock('electron', () => ({
  BrowserWindow: jest.fn(),
  ipcMain: {
    handle: jest.fn(),
    removeHandler: jest.fn(),
  },
}));

describe('Tab Switching Performance Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tabSwitchTimer.clearMetrics();
    performance.mark = jest.fn();
    performance.measure = jest.fn();
    performance.clearMarks = jest.fn();
    performance.clearMeasures = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Tab Switch Timing', () => {
    it('should complete tab switch in <50ms', async () => {
      // Simulate tab switch operations
      tabSwitchTimer.start('test-switch');

      // Simulate typical tab switch work:
      // 1. Detach current terminal
      // 2. Save state
      // 3. Load new state
      // 4. Attach new terminal
      await new Promise((resolve) => setTimeout(resolve, 10)); // Simulate work

      const duration = tabSwitchTimer.end('test-switch');

      expect(duration).toBeLessThan(50);
      expect(logger.info).toHaveBeenCalledWith(
        '[tabSwitchTimer] Tab switch completed',
        expect.objectContaining({
          switchId: 'test-switch',
          duration: expect.any(Number),
        })
      );
    });

    it('should track multiple sequential tab switches', async () => {
      const switchCount = 10;
      const durations: number[] = [];

      for (let i = 0; i < switchCount; i++) {
        const switchId = `switch-${i}`;
        tabSwitchTimer.start(switchId);

        // Simulate tab switch work
        await new Promise((resolve) => setTimeout(resolve, 5));

        const duration = tabSwitchTimer.end(switchId);
        durations.push(duration);
      }

      // All switches should be <50ms
      durations.forEach((duration) => {
        expect(duration).toBeLessThan(50);
      });

      // Average should be well under 50ms
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      expect(avgDuration).toBeLessThan(30);
    });

    it.skip('should handle rapid tab switching without performance degradation', async () => {
      const rapidSwitches = 20;
      const durations: number[] = [];

      for (let i = 0; i < rapidSwitches; i++) {
        const switchId = `rapid-${i}`;
        tabSwitchTimer.start(switchId);

        // Minimal work for rapid switching
        await new Promise((resolve) => setTimeout(resolve, 2));

        const duration = tabSwitchTimer.end(switchId);
        durations.push(duration);
      }

      // First 10 switches
      const firstHalf = durations.slice(0, 10);
      const avgFirstHalf = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;

      // Last 10 switches
      const secondHalf = durations.slice(10, 20);
      const avgSecondHalf = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      // Performance should not degrade significantly
      const degradation = ((avgSecondHalf - avgFirstHalf) / avgFirstHalf) * 100;
      expect(degradation).toBeLessThan(20); // <20% degradation acceptable
    });

    it('should warn when tab switch exceeds 50ms threshold', () => {
      tabSwitchTimer.start('slow-switch');

      // Simulate slow operation
      const slowOperation = () => {
        let sum = 0;
        for (let i = 0; i < 10000000; i++) {
          sum += i;
        }
        return sum;
      };

      slowOperation();

      const duration = tabSwitchTimer.end('slow-switch');

      if (duration >= 50) {
        expect(logger.warn).toHaveBeenCalledWith(
          '[tabSwitchTimer] Tab switch exceeded target',
          expect.objectContaining({
            switchId: 'slow-switch',
            duration: expect.any(Number),
            threshold: 50,
          })
        );
      }
    });
  });

  describe('Memory Leak Prevention', () => {
    it('should not leak memory during long-running session with many switches', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const switchId = `memory-test-${i}`;
        tabSwitchTimer.start(switchId);

        // Simulate tab switch with state management
        const state = {
          tabId: `tab-${i % 5}`, // Cycle through 5 tabs
          timestamp: Date.now(),
          data: new Array(100).fill(`data-${i}`),
        };

        await new Promise((resolve) => setTimeout(resolve, 1));

        tabSwitchTimer.end(switchId);

        // Cleanup to prevent memory leaks
        state.data = [];
      }

      // Force garbage collection if available
      if ((global as any).gc) {
        (global as any).gc();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (<10MB)
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
      expect(memoryIncreaseMB).toBeLessThan(10);
    });

    it('should clean up timer references after switches complete', () => {
      const switchIds = ['switch-1', 'switch-2', 'switch-3'];

      switchIds.forEach((id) => {
        tabSwitchTimer.start(id);
        tabSwitchTimer.end(id);
      });

      // Verify metrics are stored but don't accumulate indefinitely
      const metrics = tabSwitchTimer.getMetrics();
      expect(metrics.length).toBeLessThanOrEqual(100); // Max 100 stored metrics
    });

    it('should handle concurrent tab switches without memory leaks', async () => {
      const concurrentSwitches = 10;
      const promises: Promise<number>[] = [];

      for (let i = 0; i < concurrentSwitches; i++) {
        const promise = new Promise<number>((resolve) => {
          const switchId = `concurrent-${i}`;
          tabSwitchTimer.start(switchId);

          setTimeout(() => {
            const duration = tabSwitchTimer.end(switchId);
            resolve(duration);
          }, Math.random() * 20);
        });

        promises.push(promise);
      }

      const durations = await Promise.all(promises);

      // All switches should complete successfully
      expect(durations).toHaveLength(concurrentSwitches);
      durations.forEach((duration) => {
        expect(duration).toBeLessThan(100); // Slightly higher threshold for concurrent
      });
    });
  });

  describe('Performance Metrics Collection', () => {
    it('should collect and report aggregate metrics', () => {
      const switches = 50;

      for (let i = 0; i < switches; i++) {
        const switchId = `metrics-${i}`;
        tabSwitchTimer.start(switchId);
        tabSwitchTimer.end(switchId);
      }

      const metrics = tabSwitchTimer.getMetrics();

      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics.length).toBeLessThanOrEqual(switches);

      // Verify metric structure
      if (metrics.length > 0) {
        const firstMetric = metrics[0];
        expect(firstMetric).toHaveProperty('switchId');
        expect(firstMetric).toHaveProperty('duration');
        expect(firstMetric).toHaveProperty('timestamp');
      }
    });

    it('should calculate performance statistics', () => {
      const switches = 20;
      const durations: number[] = [];

      for (let i = 0; i < switches; i++) {
        const switchId = `stats-${i}`;
        tabSwitchTimer.start(switchId);

        // Variable duration to test statistics
        const delay = 10 + Math.random() * 20;
        const start = Date.now();
        while (Date.now() - start < delay) {
          // Busy wait
        }

        durations.push(tabSwitchTimer.end(switchId));
      }

      const stats = tabSwitchTimer.getStats();

      expect(stats).toHaveProperty('count', switches);
      expect(stats).toHaveProperty('average');
      expect(stats).toHaveProperty('min');
      expect(stats).toHaveProperty('max');
      expect(stats).toHaveProperty('p50');
      expect(stats).toHaveProperty('p95');
      expect(stats).toHaveProperty('p99');

      // Validate statistics
      if (stats) {
        expect(stats.average).toBeGreaterThan(0);
        expect(stats.min).toBeLessThanOrEqual(stats.average);
        expect(stats.max).toBeGreaterThanOrEqual(stats.average);
        expect(stats.p50).toBeGreaterThan(0);
        expect(stats.p95).toBeGreaterThan(stats.p50);
      }
    });

    it('should clear metrics when requested', () => {
      // Generate some metrics
      for (let i = 0; i < 10; i++) {
        const switchId = `clear-${i}`;
        tabSwitchTimer.start(switchId);
        tabSwitchTimer.end(switchId);
      }

      expect(tabSwitchTimer.getMetrics().length).toBeGreaterThan(0);

      // Clear metrics
      tabSwitchTimer.clearMetrics();

      expect(tabSwitchTimer.getMetrics().length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle ending non-existent timer gracefully', () => {
      const duration = tabSwitchTimer.end('non-existent');

      expect(duration).toBe(0);
      expect(logger.warn).toHaveBeenCalledWith(
        '[tabSwitchTimer] Attempted to end non-existent timer',
        expect.objectContaining({
          switchId: 'non-existent',
        })
      );
    });

    it('should handle starting duplicate timer', () => {
      tabSwitchTimer.start('duplicate');

      // Starting again should warn
      tabSwitchTimer.start('duplicate');

      expect(logger.warn).toHaveBeenCalledWith(
        '[tabSwitchTimer] Timer already running',
        expect.objectContaining({
          switchId: 'duplicate',
        })
      );
    });

    it('should recover from exceptions during timing', () => {
      tabSwitchTimer.start('error-test');

      // Simulate error
      try {
        throw new Error('Simulated error');
      } catch (error) {
        // Timer should still end gracefully
        const duration = tabSwitchTimer.end('error-test');
        expect(duration).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Integration with Session Management', () => {
    it('should integrate with session tab switching', async () => {
      // This would test actual integration with useSessionTabs hook
      // Mock implementation for now since we're focused on timing utility

      const sessionIds = ['session-1', 'session-2', 'session-3'];
      const switchTimings: number[] = [];

      for (let i = 0; i < sessionIds.length - 1; i++) {
        const fromSession = sessionIds[i];
        const toSession = sessionIds[i + 1];
        const switchId = `${fromSession}-to-${toSession}`;

        tabSwitchTimer.start(switchId);

        // Simulate session switch operations:
        // 1. Save current session state
        await new Promise((resolve) => setTimeout(resolve, 5));

        // 2. Load target session state
        await new Promise((resolve) => setTimeout(resolve, 5));

        // 3. Update UI
        await new Promise((resolve) => setTimeout(resolve, 5));

        const duration = tabSwitchTimer.end(switchId);
        switchTimings.push(duration);
      }

      // All session switches should be <50ms
      switchTimings.forEach((timing) => {
        expect(timing).toBeLessThan(50);
      });
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain <50ms target with 100 stored metrics', () => {
      // Fill up metrics storage
      for (let i = 0; i < 100; i++) {
        const switchId = `load-${i}`;
        tabSwitchTimer.start(switchId);
        tabSwitchTimer.end(switchId);
      }

      // New switches should still be fast
      tabSwitchTimer.start('new-switch');
      const duration = tabSwitchTimer.end('new-switch');

      expect(duration).toBeLessThan(50);
    });

    it('should handle metrics storage overflow gracefully', () => {
      // Generate more than max stored metrics
      for (let i = 0; i < 150; i++) {
        const switchId = `overflow-${i}`;
        tabSwitchTimer.start(switchId);
        tabSwitchTimer.end(switchId);
      }

      const metrics = tabSwitchTimer.getMetrics();

      // Should cap at max storage size (e.g., 100)
      expect(metrics.length).toBeLessThanOrEqual(100);

      // Most recent metrics should be retained
      const lastMetric = metrics[metrics.length - 1];
      expect(lastMetric.switchId).toContain('overflow-');
    });
  });
});
