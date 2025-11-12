/**
 * Unit Tests for Tab Switch Timer Utility
 *
 * Tests the tabSwitchTimer utility for performance monitoring.
 * Follows TDD approach with comprehensive coverage.
 *
 * Test Coverage:
 * - Timer lifecycle (start/end)
 * - Metrics collection and storage
 * - Statistics calculation
 * - Threshold violations
 * - Error handling
 * - Edge cases
 *
 * Target Coverage: 80%+
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

describe('TabSwitchTimer', () => {
  let currentTime: number;

  beforeEach(() => {
    jest.clearAllMocks();
    tabSwitchTimer.clearMetrics();

    // Clear any active timers by accessing private state
    // This ensures test isolation
    const activeTimers = (tabSwitchTimer as any).activeTimers;
    if (activeTimers) {
      activeTimers.clear();
    }

    // Mock performance.now() for deterministic tests
    currentTime = 1000;
    jest.spyOn(performance, 'now').mockImplementation(() => {
      return currentTime;
    });

    // Helper to advance time
    (global as any).advanceTime = (ms: number) => {
      currentTime += ms;
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (global as any).advanceTime;

    // Clean up any lingering active timers
    const activeTimers = (tabSwitchTimer as any).activeTimers;
    if (activeTimers) {
      activeTimers.clear();
    }
  });

  describe('Timer Lifecycle', () => {
    it('should start a timer successfully', () => {
      tabSwitchTimer.start('test-1');

      expect(tabSwitchTimer.isRunning('test-1')).toBe(true);
      expect(logger.debug).toHaveBeenCalledWith(
        '[tabSwitchTimer] Tab switch started',
        expect.objectContaining({
          switchId: 'test-1',
          startTime: 1000,
        })
      );
    });

    it('should end a timer and return duration', () => {
      tabSwitchTimer.start('test-2');

      (global as any).advanceTime(25);

      const duration = tabSwitchTimer.end('test-2');

      expect(duration).toBe(25);
      expect(tabSwitchTimer.isRunning('test-2')).toBe(false);
      expect(logger.info).toHaveBeenCalledWith(
        '[tabSwitchTimer] Tab switch completed',
        expect.objectContaining({
          switchId: 'test-2',
          duration: 25,
        })
      );
    });

    it('should handle multiple concurrent timers', () => {
      tabSwitchTimer.start('timer-1');
      (global as any).advanceTime(10);

      tabSwitchTimer.start('timer-2');
      (global as any).advanceTime(15);

      const duration1 = tabSwitchTimer.end('timer-1');
      (global as any).advanceTime(5);

      const duration2 = tabSwitchTimer.end('timer-2');

      expect(duration1).toBe(25); // 10 + 15
      expect(duration2).toBe(20); // 15 + 5
    });

    it('should warn when starting duplicate timer', () => {
      tabSwitchTimer.start('duplicate');
      tabSwitchTimer.start('duplicate');

      expect(logger.warn).toHaveBeenCalledWith(
        '[tabSwitchTimer] Timer already running',
        expect.objectContaining({
          switchId: 'duplicate',
        })
      );
    });

    it('should warn when ending non-existent timer', () => {
      const duration = tabSwitchTimer.end('non-existent');

      expect(duration).toBe(0);
      expect(logger.warn).toHaveBeenCalledWith(
        '[tabSwitchTimer] Attempted to end non-existent timer',
        expect.objectContaining({
          switchId: 'non-existent',
        })
      );
    });
  });

  describe('Threshold Violations', () => {
    it('should log info when duration is under threshold', () => {
      tabSwitchTimer.start('fast-switch');
      (global as any).advanceTime(30);
      tabSwitchTimer.end('fast-switch');

      expect(logger.info).toHaveBeenCalledWith(
        '[tabSwitchTimer] Tab switch completed',
        expect.objectContaining({
          duration: 30,
        })
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should warn when duration meets threshold exactly', () => {
      tabSwitchTimer.start('threshold-switch');
      (global as any).advanceTime(50);
      tabSwitchTimer.end('threshold-switch');

      expect(logger.warn).toHaveBeenCalledWith(
        '[tabSwitchTimer] Tab switch exceeded target',
        expect.objectContaining({
          duration: 50,
          threshold: 50,
        })
      );
    });

    it('should warn when duration exceeds threshold', () => {
      tabSwitchTimer.start('slow-switch');
      (global as any).advanceTime(75);
      tabSwitchTimer.end('slow-switch');

      expect(logger.warn).toHaveBeenCalledWith(
        '[tabSwitchTimer] Tab switch exceeded target',
        expect.objectContaining({
          duration: 75,
          threshold: 50,
        })
      );
    });

    it('should mark metric as exceeding threshold', () => {
      tabSwitchTimer.start('exceed-test');
      (global as any).advanceTime(60);
      tabSwitchTimer.end('exceed-test');

      const metrics = tabSwitchTimer.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].exceededThreshold).toBe(true);
    });

    it('should not mark metric as exceeding when under threshold', () => {
      tabSwitchTimer.start('under-test');
      (global as any).advanceTime(40);
      tabSwitchTimer.end('under-test');

      const metrics = tabSwitchTimer.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].exceededThreshold).toBe(false);
    });
  });

  describe('Metrics Collection', () => {
    it('should collect metrics for completed timers', () => {
      tabSwitchTimer.start('metric-1');
      (global as any).advanceTime(20);
      tabSwitchTimer.end('metric-1');

      const metrics = tabSwitchTimer.getMetrics();

      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toMatchObject({
        switchId: 'metric-1',
        duration: 20,
        exceededThreshold: false,
      });
      expect(metrics[0].timestamp).toBeGreaterThan(0);
    });

    it('should store multiple metrics', () => {
      for (let i = 0; i < 5; i++) {
        const switchId = `metric-${i}`;
        tabSwitchTimer.start(switchId);
        (global as any).advanceTime(10 + i * 5);
        tabSwitchTimer.end(switchId);
      }

      const metrics = tabSwitchTimer.getMetrics();
      expect(metrics).toHaveLength(5);
    });

    it('should maintain circular buffer with max 100 metrics', () => {
      // Generate 150 metrics
      for (let i = 0; i < 150; i++) {
        const switchId = `overflow-${i}`;
        tabSwitchTimer.start(switchId);
        (global as any).advanceTime(10);
        tabSwitchTimer.end(switchId);
      }

      const metrics = tabSwitchTimer.getMetrics();

      expect(metrics).toHaveLength(100);
      // First metric should be from index 50 (oldest 50 removed)
      expect(metrics[0].switchId).toBe('overflow-50');
      // Last metric should be from index 149
      expect(metrics[99].switchId).toBe('overflow-149');
    });

    it('should clear all metrics when requested', () => {
      for (let i = 0; i < 10; i++) {
        tabSwitchTimer.start(`clear-${i}`);
        (global as any).advanceTime(15);
        tabSwitchTimer.end(`clear-${i}`);
      }

      expect(tabSwitchTimer.getMetrics()).toHaveLength(10);

      tabSwitchTimer.clearMetrics();

      expect(tabSwitchTimer.getMetrics()).toHaveLength(0);
      expect(logger.debug).toHaveBeenCalledWith('[tabSwitchTimer] Metrics cleared');
    });

    it('should return copy of metrics array', () => {
      tabSwitchTimer.start('immutable');
      (global as any).advanceTime(20);
      tabSwitchTimer.end('immutable');

      const metrics1 = tabSwitchTimer.getMetrics();
      const metrics2 = tabSwitchTimer.getMetrics();

      expect(metrics1).not.toBe(metrics2); // Different array instances
      expect(metrics1).toEqual(metrics2); // Same content
    });
  });

  describe('Statistics Calculation', () => {
    it('should return null stats when no metrics exist', () => {
      const stats = tabSwitchTimer.getStats();
      expect(stats).toBeNull();
    });

    it('should calculate basic statistics', () => {
      const durations = [10, 20, 30, 40, 50];

      durations.forEach((duration, i) => {
        tabSwitchTimer.start(`stat-${i}`);
        (global as any).advanceTime(duration);
        tabSwitchTimer.end(`stat-${i}`);
      });

      const stats = tabSwitchTimer.getStats();

      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(5);
      expect(stats!.average).toBe(30);
      expect(stats!.min).toBe(10);
      expect(stats!.max).toBe(50);
    });

    it('should calculate percentiles correctly', () => {
      const durations = Array.from({ length: 100 }, (_, i) => i + 1); // 1-100

      durations.forEach((duration, i) => {
        tabSwitchTimer.start(`perc-${i}`);
        (global as any).advanceTime(duration);
        tabSwitchTimer.end(`perc-${i}`);
      });

      const stats = tabSwitchTimer.getStats();

      expect(stats).not.toBeNull();
      expect(stats!.p50).toBeCloseTo(50.5, 0);
      expect(stats!.p95).toBeCloseTo(95.05, 0);
      expect(stats!.p99).toBeCloseTo(99.01, 0);
    });

    it('should handle statistics for single metric', () => {
      tabSwitchTimer.start('single');
      (global as any).advanceTime(42);
      tabSwitchTimer.end('single');

      const stats = tabSwitchTimer.getStats();

      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(1);
      expect(stats!.average).toBe(42);
      expect(stats!.min).toBe(42);
      expect(stats!.max).toBe(42);
      expect(stats!.p50).toBe(42);
      expect(stats!.p95).toBe(42);
      expect(stats!.p99).toBe(42);
    });

    it('should recalculate stats after clearing metrics', () => {
      for (let i = 0; i < 5; i++) {
        tabSwitchTimer.start(`calc-${i}`);
        (global as any).advanceTime(20);
        tabSwitchTimer.end(`calc-${i}`);
      }

      const statsBefore = tabSwitchTimer.getStats();
      expect(statsBefore!.count).toBe(5);

      tabSwitchTimer.clearMetrics();

      const statsAfter = tabSwitchTimer.getStats();
      expect(statsAfter).toBeNull();
    });
  });

  describe('Utility Methods', () => {
    it('should return threshold value', () => {
      expect(tabSwitchTimer.getThreshold()).toBe(50);
    });

    it('should return max metrics value', () => {
      expect(tabSwitchTimer.getMaxMetrics()).toBe(100);
    });

    it('should check if timer is running', () => {
      expect(tabSwitchTimer.isRunning('check-1')).toBe(false);

      tabSwitchTimer.start('check-1');
      expect(tabSwitchTimer.isRunning('check-1')).toBe(true);

      tabSwitchTimer.end('check-1');
      expect(tabSwitchTimer.isRunning('check-1')).toBe(false);
    });

    it('should count active timers', () => {
      expect(tabSwitchTimer.getActiveTimerCount()).toBe(0);

      tabSwitchTimer.start('active-1');
      expect(tabSwitchTimer.getActiveTimerCount()).toBe(1);

      tabSwitchTimer.start('active-2');
      expect(tabSwitchTimer.getActiveTimerCount()).toBe(2);

      tabSwitchTimer.end('active-1');
      expect(tabSwitchTimer.getActiveTimerCount()).toBe(1);

      tabSwitchTimer.end('active-2');
      expect(tabSwitchTimer.getActiveTimerCount()).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very short durations (<1ms)', () => {
      tabSwitchTimer.start('short');
      (global as any).advanceTime(0.5);
      const duration = tabSwitchTimer.end('short');

      expect(duration).toBe(0.5);
      expect(logger.info).toHaveBeenCalled();
    });

    it('should handle very long durations (>1000ms)', () => {
      tabSwitchTimer.start('long');
      (global as any).advanceTime(1500);
      const duration = tabSwitchTimer.end('long');

      expect(duration).toBe(1500);
      expect(logger.warn).toHaveBeenCalledWith(
        '[tabSwitchTimer] Tab switch exceeded target',
        expect.objectContaining({
          duration: 1500,
        })
      );
    });

    it('should handle switchId with special characters', () => {
      const specialId = 'tab-switch@123#test';
      tabSwitchTimer.start(specialId);
      (global as any).advanceTime(25);
      const duration = tabSwitchTimer.end(specialId);

      expect(duration).toBe(25);

      const metrics = tabSwitchTimer.getMetrics();
      expect(metrics[0].switchId).toBe(specialId);
    });

    it('should handle empty switchId', () => {
      tabSwitchTimer.start('');
      (global as any).advanceTime(30);
      const duration = tabSwitchTimer.end('');

      expect(duration).toBe(30);
    });

    it('should round duration to 2 decimal places in logs', () => {
      tabSwitchTimer.start('round-test');
      (global as any).advanceTime(25.6789);
      tabSwitchTimer.end('round-test');

      expect(logger.info).toHaveBeenCalledWith(
        '[tabSwitchTimer] Tab switch completed',
        expect.objectContaining({
          duration: 25.68,
        })
      );
    });
  });

  describe('Singleton Behavior', () => {
    it('should maintain state across multiple calls', () => {
      tabSwitchTimer.start('state-1');
      (global as any).advanceTime(20);
      tabSwitchTimer.end('state-1');

      expect(tabSwitchTimer.getMetrics()).toHaveLength(1);

      tabSwitchTimer.start('state-2');
      (global as any).advanceTime(30);
      tabSwitchTimer.end('state-2');

      expect(tabSwitchTimer.getMetrics()).toHaveLength(2);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle starting and ending timers in different order', () => {
      // Reset time for this test
      currentTime = 2000;

      tabSwitchTimer.start('a'); // Start at t=2000
      currentTime += 10; // t=2010

      tabSwitchTimer.start('b'); // Start at t=2010
      currentTime += 10; // t=2020

      tabSwitchTimer.start('c'); // Start at t=2020
      currentTime += 10; // t=2030

      // End in different order: b, a, c
      const durationB = tabSwitchTimer.end('b'); // Started at 2010, ending at 2030 = 20ms
      currentTime += 5; // t=2035

      const durationA = tabSwitchTimer.end('a'); // Started at 2000, ending at 2035 = 35ms
      currentTime += 5; // t=2040

      const durationC = tabSwitchTimer.end('c'); // Started at 2020, ending at 2040 = 20ms

      expect(durationB).toBe(20);
      expect(durationA).toBe(35);
      expect(durationC).toBe(20); // Fixed: C started at 2020, ended at 2040 = 20ms
    });
  });
});
