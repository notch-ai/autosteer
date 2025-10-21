/**
 * Terminal Performance Benchmarks - Phase 5
 *
 * Performance validation tests for terminal session operations.
 * Uses Vitest with performance assertions to validate targets.
 *
 * Performance Targets:
 * - Terminal switch time: <100ms
 * - Input lag: <16ms (60fps)
 * - Terminal creation: <200ms
 * - Buffer save operation: <100ms for 10k lines
 * - Buffer trim operation: <200ms for 60k → 10k lines
 * - Memory per session: <50MB
 *
 * @see docs/terminal-persistence-architecture.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalBufferService } from '@/main/services/TerminalBufferService';
import type { TerminalBufferState } from '@/types/terminal.types';

// Mock electron-log
vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock electron
vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
  },
}));

// Mock node-pty
vi.mock('node-pty', () => ({
  spawn: vi.fn(() => ({
    pid: Math.floor(Math.random() * 10000),
    onData: vi.fn(),
    onExit: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
  })),
}));

describe('Terminal Performance Benchmarks', () => {
  let bufferService: TerminalBufferService;

  beforeEach(() => {
    console.log('[Performance Test] Setting up test environment');
    bufferService = new TerminalBufferService();
  });

  afterEach(() => {
    console.log('[Performance Test] Cleaning up test environment');
    bufferService.clearAllBufferStates();
  });

  describe('Buffer Save Performance', () => {
    it('should save 10k line buffer in <100ms', () => {
      console.log('[Performance Test] Testing buffer save performance');

      // Create buffer state with 10k lines
      const scrollback = Array.from({ length: 10000 }, (_, i) => `Line ${i + 1} content`);
      const content = scrollback.join('\n');

      const bufferState: TerminalBufferState = {
        terminalId: 'perf-test-1',
        content,
        scrollback,
        cursorX: 0,
        cursorY: 9999,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: content.length,
      };

      // Measure save performance
      const startTime = performance.now();
      bufferService.saveBufferState(bufferState);
      const duration = performance.now() - startTime;

      console.log(`[Performance Test] Buffer save time: ${duration.toFixed(2)}ms`);

      expect(duration).toBeLessThan(100); // Performance target: <100ms
      expect(bufferService.hasBufferState('perf-test-1')).toBe(true);
    });

    it('should save multiple buffers efficiently', () => {
      console.log('[Performance Test] Testing multiple buffer save performance');

      const bufferCount = 5;
      const scrollback = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1}`);
      const content = scrollback.join('\n');

      const startTime = performance.now();

      for (let i = 0; i < bufferCount; i++) {
        const bufferState: TerminalBufferState = {
          terminalId: `perf-test-${i}`,
          content,
          scrollback,
          cursorX: 0,
          cursorY: 999,
          cols: 80,
          rows: 24,
          timestamp: new Date(),
          sizeBytes: content.length,
        };

        bufferService.saveBufferState(bufferState);
      }

      const duration = performance.now() - startTime;
      const avgDuration = duration / bufferCount;

      console.log(`[Performance Test] Multiple buffer save time: ${duration.toFixed(2)}ms total`);
      console.log(`[Performance Test] Average per buffer: ${avgDuration.toFixed(2)}ms`);

      expect(avgDuration).toBeLessThan(50); // Should be faster for smaller buffers
      expect(bufferService.getBufferCount()).toBe(bufferCount);
    });

    it('should retrieve buffer state with O(1) performance', () => {
      console.log('[Performance Test] Testing buffer retrieval performance');

      // Create and save buffer
      const scrollback = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1}`);
      const content = scrollback.join('\n');

      const bufferState: TerminalBufferState = {
        terminalId: 'perf-test-retrieve',
        content,
        scrollback,
        cursorX: 0,
        cursorY: 999,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: content.length,
      };

      bufferService.saveBufferState(bufferState);

      // Measure retrieval performance
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const retrieved = bufferService.getBufferState('perf-test-retrieve');
        expect(retrieved).toBeDefined();
      }

      const duration = performance.now() - startTime;
      const avgDuration = duration / iterations;

      console.log(`[Performance Test] 1000 buffer retrievals: ${duration.toFixed(2)}ms total`);
      console.log(`[Performance Test] Average per retrieval: ${avgDuration.toFixed(4)}ms`);

      expect(avgDuration).toBeLessThan(1); // O(1) lookup should be sub-millisecond
    });
  });

  describe('Buffer Trim Performance', () => {
    it('should trim 60k → 10k lines in <200ms (FIFO)', () => {
      console.log('[Performance Test] Testing buffer trim performance');

      // Create buffer with 60k lines (6x the limit)
      const scrollback = Array.from({ length: 60000 }, (_, i) => `Line ${i + 1} content`);
      const content = scrollback.join('\n');

      const bufferState: TerminalBufferState = {
        terminalId: 'perf-test-trim',
        content,
        scrollback,
        cursorX: 0,
        cursorY: 59999,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: content.length,
      };

      // Measure trim performance
      const startTime = performance.now();
      const trimmedState = bufferService.trimBufferIfNeeded(bufferState);
      const duration = performance.now() - startTime;

      console.log(`[Performance Test] Buffer trim time: ${duration.toFixed(2)}ms`);
      console.log(
        `[Performance Test] Lines: ${bufferState.scrollback.length} → ${trimmedState.scrollback.length}`
      );

      expect(duration).toBeLessThan(200); // Performance target: <200ms
      expect(trimmedState.scrollback.length).toBeLessThanOrEqual(10000);
      // FIFO: Oldest lines removed, newest preserved
      expect(trimmedState.scrollback[0]).toContain('Line 50001');
    });

    it('should handle edge case: trim exactly at limit', () => {
      console.log('[Performance Test] Testing trim at exact limit');

      const scrollback = Array.from({ length: 10000 }, (_, i) => `Line ${i + 1}`);
      const content = scrollback.join('\n');

      const bufferState: TerminalBufferState = {
        terminalId: 'perf-test-exact',
        content,
        scrollback,
        cursorX: 0,
        cursorY: 9999,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: content.length,
      };

      const startTime = performance.now();
      const trimmedState = bufferService.trimBufferIfNeeded(bufferState);
      const duration = performance.now() - startTime;

      console.log(`[Performance Test] Exact limit trim time: ${duration.toFixed(2)}ms`);

      expect(duration).toBeLessThan(50); // Should be very fast - no trimming needed
      expect(trimmedState.scrollback.length).toBe(10000);
      expect(trimmedState).toEqual(bufferState); // No changes
    });

    it('should trim by size constraint (50MB limit)', () => {
      console.log('[Performance Test] Testing size-based trimming');

      // Create large lines to exceed 50MB
      const largeLineSize = 5000; // 5KB per line
      const lineCount = 11000; // ~55MB total
      const scrollback = Array.from(
        { length: lineCount },
        (_, i) => `Line ${i + 1} ${'x'.repeat(largeLineSize)}`
      );
      const content = scrollback.join('\n');

      const bufferState: TerminalBufferState = {
        terminalId: 'perf-test-size',
        content,
        scrollback,
        cursorX: 0,
        cursorY: lineCount - 1,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: content.length,
      };

      console.log(
        `[Performance Test] Initial buffer size: ${(bufferState.sizeBytes / (1024 * 1024)).toFixed(2)}MB`
      );

      const startTime = performance.now();
      const trimmedState = bufferService.trimBufferIfNeeded(bufferState);
      const duration = performance.now() - startTime;

      console.log(`[Performance Test] Size-based trim time: ${duration.toFixed(2)}ms`);
      console.log(
        `[Performance Test] Final buffer size: ${(trimmedState.sizeBytes / (1024 * 1024)).toFixed(2)}MB`
      );

      expect(duration).toBeLessThan(300); // Size-based trimming may be slower
      expect(trimmedState.sizeBytes).toBeLessThanOrEqual(50 * 1024 * 1024); // <50MB
    });
  });

  describe('Memory Usage Performance', () => {
    it('should track memory usage across multiple buffers', () => {
      console.log('[Performance Test] Testing memory usage tracking');

      const bufferCount = 10; // Max terminals
      const scrollback = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1}`);
      const content = scrollback.join('\n');

      // Create 10 buffers
      for (let i = 0; i < bufferCount; i++) {
        const bufferState: TerminalBufferState = {
          terminalId: `memory-test-${i}`,
          content,
          scrollback,
          cursorX: 0,
          cursorY: 999,
          cols: 80,
          rows: 24,
          timestamp: new Date(),
          sizeBytes: content.length,
        };

        bufferService.saveBufferState(bufferState);
      }

      const startTime = performance.now();
      const totalMemory = bufferService.getTotalMemoryUsage();
      const duration = performance.now() - startTime;

      console.log(`[Performance Test] Memory tracking time: ${duration.toFixed(4)}ms`);
      console.log(`[Performance Test] Total memory: ${(totalMemory / (1024 * 1024)).toFixed(2)}MB`);
      console.log(
        `[Performance Test] Per buffer: ${(totalMemory / bufferCount / 1024).toFixed(2)}KB`
      );

      expect(duration).toBeLessThan(10); // Memory tracking should be very fast
      expect(bufferService.getBufferCount()).toBe(bufferCount);

      // Verify total memory is reasonable
      const maxAllowedMemory = 50 * 1024 * 1024 * bufferCount; // 50MB per session
      expect(totalMemory).toBeLessThan(maxAllowedMemory);
    });

    it('should efficiently clear all buffers', () => {
      console.log('[Performance Test] Testing bulk buffer clear performance');

      // Create 10 buffers with 5k lines each
      for (let i = 0; i < 10; i++) {
        const scrollback = Array.from({ length: 5000 }, (_, j) => `Line ${j + 1}`);
        const content = scrollback.join('\n');

        const bufferState: TerminalBufferState = {
          terminalId: `clear-test-${i}`,
          content,
          scrollback,
          cursorX: 0,
          cursorY: 4999,
          cols: 80,
          rows: 24,
          timestamp: new Date(),
          sizeBytes: content.length,
        };

        bufferService.saveBufferState(bufferState);
      }

      expect(bufferService.getBufferCount()).toBe(10);

      const startTime = performance.now();
      bufferService.clearAllBufferStates();
      const duration = performance.now() - startTime;

      console.log(`[Performance Test] Clear all buffers time: ${duration.toFixed(2)}ms`);

      expect(duration).toBeLessThan(50); // Should be very fast
      expect(bufferService.getBufferCount()).toBe(0);
      expect(bufferService.getTotalMemoryUsage()).toBe(0);
    });
  });

  describe('Terminal Switching Performance', () => {
    it('should simulate <100ms terminal switch time', () => {
      console.log('[Performance Test] Testing terminal switch simulation');

      // Create two buffer states
      const scrollback1 = Array.from({ length: 1000 }, (_, i) => `Terminal 1 Line ${i + 1}`);
      const content1 = scrollback1.join('\n');

      const scrollback2 = Array.from({ length: 1000 }, (_, i) => `Terminal 2 Line ${i + 1}`);
      const content2 = scrollback2.join('\n');

      const bufferState1: TerminalBufferState = {
        terminalId: 'switch-test-1',
        content: content1,
        scrollback: scrollback1,
        cursorX: 0,
        cursorY: 999,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: content1.length,
      };

      const bufferState2: TerminalBufferState = {
        terminalId: 'switch-test-2',
        content: content2,
        scrollback: scrollback2,
        cursorX: 0,
        cursorY: 999,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: content2.length,
      };

      bufferService.saveBufferState(bufferState1);
      bufferService.saveBufferState(bufferState2);

      // Simulate terminal switch: save current, retrieve next
      const startTime = performance.now();

      // Save current terminal state
      bufferService.saveBufferState(bufferState1);

      // Retrieve next terminal state
      const retrieved = bufferService.getBufferState('switch-test-2');

      const duration = performance.now() - startTime;

      console.log(`[Performance Test] Terminal switch time: ${duration.toFixed(2)}ms`);

      expect(duration).toBeLessThan(100); // Performance target: <100ms
      expect(retrieved).toBeDefined();
      expect(retrieved?.scrollback.length).toBe(1000);
    });

    it('should handle rapid switching between terminals', () => {
      console.log('[Performance Test] Testing rapid terminal switching');

      // Create 5 buffers
      for (let i = 0; i < 5; i++) {
        const scrollback = Array.from({ length: 500 }, (_, j) => `Terminal ${i + 1} Line ${j + 1}`);
        const content = scrollback.join('\n');

        const bufferState: TerminalBufferState = {
          terminalId: `rapid-switch-${i}`,
          content,
          scrollback,
          cursorX: 0,
          cursorY: 499,
          cols: 80,
          rows: 24,
          timestamp: new Date(),
          sizeBytes: content.length,
        };

        bufferService.saveBufferState(bufferState);
      }

      // Simulate rapid switching (50 switches)
      const switchCount = 50;
      const measurements: number[] = [];

      for (let i = 0; i < switchCount; i++) {
        const terminalIndex = i % 5;
        const startTime = performance.now();

        const retrieved = bufferService.getBufferState(`rapid-switch-${terminalIndex}`);
        expect(retrieved).toBeDefined();

        const duration = performance.now() - startTime;
        measurements.push(duration);
      }

      const avgDuration = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const maxDuration = Math.max(...measurements);

      console.log(`[Performance Test] Average switch time: ${avgDuration.toFixed(2)}ms`);
      console.log(`[Performance Test] Max switch time: ${maxDuration.toFixed(2)}ms`);
      console.log(`[Performance Test] Total switches: ${switchCount}`);

      expect(avgDuration).toBeLessThan(10); // Should be very fast for retrieval
      expect(maxDuration).toBeLessThan(50);
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle concurrent buffer operations efficiently', async () => {
      console.log('[Performance Test] Testing concurrent buffer operations');

      const operations = 100;
      const startTime = performance.now();

      // Simulate concurrent save and retrieve operations
      const promises = Array.from({ length: operations }, async (_, i) => {
        const scrollback = Array.from({ length: 100 }, (_, j) => `Line ${j + 1}`);
        const content = scrollback.join('\n');

        const bufferState: TerminalBufferState = {
          terminalId: `concurrent-${i}`,
          content,
          scrollback,
          cursorX: 0,
          cursorY: 99,
          cols: 80,
          rows: 24,
          timestamp: new Date(),
          sizeBytes: content.length,
        };

        // Save
        bufferService.saveBufferState(bufferState);

        // Retrieve
        const retrieved = bufferService.getBufferState(`concurrent-${i}`);
        expect(retrieved).toBeDefined();

        // Remove
        bufferService.removeBufferState(`concurrent-${i}`);
      });

      await Promise.all(promises);

      const duration = performance.now() - startTime;
      const avgDuration = duration / operations;

      console.log(
        `[Performance Test] ${operations} concurrent operations: ${duration.toFixed(2)}ms total`
      );
      console.log(`[Performance Test] Average per operation: ${avgDuration.toFixed(2)}ms`);

      expect(avgDuration).toBeLessThan(10); // Each operation should be fast
      expect(bufferService.getBufferCount()).toBe(0); // All removed
    });
  });

  describe('Stress Test Scenarios', () => {
    it('should handle max load: 10 terminals with 10k lines each', () => {
      console.log('[Performance Test] Testing maximum load scenario');

      const terminalCount = 10;
      const linesPerTerminal = 10000;

      const startTime = performance.now();

      for (let i = 0; i < terminalCount; i++) {
        const scrollback = Array.from(
          { length: linesPerTerminal },
          (_, j) => `Terminal ${i + 1} Line ${j + 1}`
        );
        const content = scrollback.join('\n');

        const bufferState: TerminalBufferState = {
          terminalId: `stress-test-${i}`,
          content,
          scrollback,
          cursorX: 0,
          cursorY: linesPerTerminal - 1,
          cols: 80,
          rows: 24,
          timestamp: new Date(),
          sizeBytes: content.length,
        };

        bufferService.saveBufferState(bufferState);
      }

      const duration = performance.now() - startTime;
      const totalMemory = bufferService.getTotalMemoryUsage();

      console.log(`[Performance Test] Max load creation time: ${duration.toFixed(2)}ms`);
      console.log(`[Performance Test] Total memory: ${(totalMemory / (1024 * 1024)).toFixed(2)}MB`);
      console.log(
        `[Performance Test] Per terminal: ${(totalMemory / terminalCount / (1024 * 1024)).toFixed(2)}MB`
      );

      expect(duration).toBeLessThan(2000); // 2 seconds for max load is acceptable
      expect(bufferService.getBufferCount()).toBe(terminalCount);

      // Verify memory constraints
      const maxTotalMemory = 50 * 1024 * 1024 * terminalCount; // 50MB × 10
      expect(totalMemory).toBeLessThan(maxTotalMemory);
    });

    it('should maintain performance under sustained operations', () => {
      console.log('[Performance Test] Testing sustained operations performance');

      const iterations = 1000;
      const measurements: number[] = [];

      const scrollback = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`);
      const content = scrollback.join('\n');

      for (let i = 0; i < iterations; i++) {
        const bufferState: TerminalBufferState = {
          terminalId: 'sustained-test',
          content,
          scrollback,
          cursorX: 0,
          cursorY: 99,
          cols: 80,
          rows: 24,
          timestamp: new Date(),
          sizeBytes: content.length,
        };

        const startTime = performance.now();
        bufferService.saveBufferState(bufferState);
        const duration = performance.now() - startTime;

        measurements.push(duration);
      }

      const avgDuration = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const maxDuration = Math.max(...measurements);
      const minDuration = Math.min(...measurements);

      console.log(`[Performance Test] Sustained operations (${iterations} iterations):`);
      console.log(`[Performance Test] Average: ${avgDuration.toFixed(4)}ms`);
      console.log(`[Performance Test] Max: ${maxDuration.toFixed(4)}ms`);
      console.log(`[Performance Test] Min: ${minDuration.toFixed(4)}ms`);

      // Performance should remain consistent
      expect(avgDuration).toBeLessThan(10);
      expect(maxDuration).toBeLessThan(50);
    });
  });
});
