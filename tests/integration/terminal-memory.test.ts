/**
 * Integration Tests - Memory Optimization
 *
 * Tests automatic buffer trimming, memory monitoring, and XTerm instance reuse
 * under memory constraints.
 *
 * Test Coverage:
 * - Automatic buffer trimming when approaching limits
 * - Memory usage monitoring across all sessions
 * - XTerm instance reuse optimization
 * - Concurrent session memory constraints
 * - Performance under memory pressure
 */

import { TerminalBufferService } from '@/main/services/TerminalBufferService';
import { TerminalBufferState } from '@/types/terminal.types';
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('Phase 4: Memory Optimization Integration Tests', () => {
  let bufferService: TerminalBufferService;

  beforeEach(() => {
    bufferService = new TerminalBufferService();
  });

  describe('Automatic Buffer Trimming', () => {
    it('should automatically trim buffer when saving exceeds line limit', () => {
      console.log('[TEST] Auto-trim on save - line limit exceeded');

      // Create buffer state with 15k lines (exceeds 10k limit)
      const scrollback = Array.from({ length: 15000 }, (_, i) => `Line ${i + 1}`);
      const content = scrollback.join('\n');

      const bufferState: TerminalBufferState = {
        terminalId: 'test-terminal-1',
        content,
        scrollback,
        cursorX: 0,
        cursorY: 10,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: content.length,
      };

      // Save should automatically trim
      bufferService.saveBufferState(bufferState);

      // Retrieve and verify trimming occurred
      const savedState = bufferService.getBufferState('test-terminal-1');
      expect(savedState).toBeDefined();
      expect(savedState!.scrollback.length).toBe(10000);
      expect(savedState!.scrollback.length).toBeLessThanOrEqual(
        bufferService.getMaxScrollbackLines()
      );

      console.log('[TEST] Auto-trim verified: 15k → 10k lines');
    });

    it('should automatically trim buffer when saving exceeds size limit', () => {
      console.log('[TEST] Auto-trim on save - size limit exceeded');

      // Create buffer with large content (>50MB)
      const largeLines = Array.from({ length: 5000 }, () => 'A'.repeat(15000)); // ~75MB
      const content = largeLines.join('\n');

      const bufferState: TerminalBufferState = {
        terminalId: 'test-terminal-2',
        content,
        scrollback: largeLines,
        cursorX: 0,
        cursorY: 10,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: content.length,
      };

      expect(bufferState.sizeBytes).toBeGreaterThan(bufferService.getMaxBufferSizeBytes());

      // Save should automatically trim
      bufferService.saveBufferState(bufferState);

      // Verify size limit is respected
      const savedState = bufferService.getBufferState('test-terminal-2');
      expect(savedState).toBeDefined();
      expect(savedState!.sizeBytes).toBeLessThanOrEqual(bufferService.getMaxBufferSizeBytes());

      console.log(
        `[TEST] Auto-trim verified: ${bufferState.sizeBytes} → ${savedState!.sizeBytes} bytes`
      );
    });

    it('should not trim buffer that is within limits', () => {
      console.log('[TEST] No trimming for buffers within limits');

      const scrollback = Array.from({ length: 5000 }, (_, i) => `Line ${i + 1}`);
      const content = scrollback.join('\n');

      const bufferState: TerminalBufferState = {
        terminalId: 'test-terminal-3',
        content,
        scrollback,
        cursorX: 0,
        cursorY: 10,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: content.length,
      };

      bufferService.saveBufferState(bufferState);

      const savedState = bufferService.getBufferState('test-terminal-3');
      expect(savedState).toBeDefined();
      expect(savedState!.scrollback.length).toBe(5000);
      expect(savedState!.sizeBytes).toBe(content.length);

      console.log('[TEST] No trimming verified: 5k lines preserved');
    });

    it('should perform automatic trimming within 200ms performance target', () => {
      console.log('[TEST] Auto-trim performance validation');

      // Create large buffer (60k lines → 10k lines)
      const scrollback = Array.from({ length: 60000 }, (_, i) => `Line ${i + 1}`);
      const content = scrollback.join('\n');

      const bufferState: TerminalBufferState = {
        terminalId: 'test-terminal-4',
        content,
        scrollback,
        cursorX: 0,
        cursorY: 10,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: content.length,
      };

      const startTime = Date.now();
      bufferService.saveBufferState(bufferState);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200);
      console.log(`[TEST] Auto-trim performance: ${duration}ms (target: <200ms)`);
    });

    it('should update timestamp when auto-trimming occurs', () => {
      console.log('[TEST] Timestamp update on auto-trim');

      const scrollback = Array.from({ length: 15000 }, (_, i) => `Line ${i + 1}`);
      const content = scrollback.join('\n');
      const originalTimestamp = new Date('2024-01-01T00:00:00Z');

      const bufferState: TerminalBufferState = {
        terminalId: 'test-terminal-5',
        content,
        scrollback,
        cursorX: 0,
        cursorY: 10,
        cols: 80,
        rows: 24,
        timestamp: originalTimestamp,
        sizeBytes: content.length,
      };

      bufferService.saveBufferState(bufferState);

      const savedState = bufferService.getBufferState('test-terminal-5');
      expect(savedState).toBeDefined();
      expect(savedState!.timestamp.getTime()).toBeGreaterThan(originalTimestamp.getTime());

      console.log('[TEST] Timestamp updated after auto-trim');
    });
  });

  describe('Memory Usage Monitoring', () => {
    it('should track total memory usage across all buffers', () => {
      console.log('[TEST] Total memory tracking');

      // Create 3 buffers with different sizes
      const buffers = [
        { id: 'mem-1', lines: 1000 },
        { id: 'mem-2', lines: 2000 },
        { id: 'mem-3', lines: 3000 },
      ];

      let expectedTotalSize = 0;

      buffers.forEach(({ id, lines }) => {
        const scrollback = Array.from({ length: lines }, (_, i) => `Line ${i + 1}`);
        const content = scrollback.join('\n');

        const bufferState: TerminalBufferState = {
          terminalId: id,
          content,
          scrollback,
          cursorX: 0,
          cursorY: 10,
          cols: 80,
          rows: 24,
          timestamp: new Date(),
          sizeBytes: content.length,
        };

        bufferService.saveBufferState(bufferState);
        expectedTotalSize += content.length;
      });

      const totalMemory = bufferService.getTotalMemoryUsage();
      expect(totalMemory).toBe(expectedTotalSize);
      expect(bufferService.getBufferCount()).toBe(3);

      console.log(`[TEST] Total memory tracked: ${totalMemory} bytes across 3 buffers`);
    });

    it('should update total memory usage when buffers are removed', () => {
      console.log('[TEST] Memory tracking after buffer removal');

      const scrollback1 = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1}`);
      const content1 = scrollback1.join('\n');

      const bufferState1: TerminalBufferState = {
        terminalId: 'mem-remove-1',
        content: content1,
        scrollback: scrollback1,
        cursorX: 0,
        cursorY: 10,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: content1.length,
      };

      const scrollback2 = Array.from({ length: 2000 }, (_, i) => `Line ${i + 1}`);
      const content2 = scrollback2.join('\n');

      const bufferState2: TerminalBufferState = {
        terminalId: 'mem-remove-2',
        content: content2,
        scrollback: scrollback2,
        cursorX: 0,
        cursorY: 10,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: content2.length,
      };

      bufferService.saveBufferState(bufferState1);
      bufferService.saveBufferState(bufferState2);

      const totalBefore = bufferService.getTotalMemoryUsage();

      // Remove first buffer
      bufferService.removeBufferState('mem-remove-1');

      const totalAfter = bufferService.getTotalMemoryUsage();
      expect(totalAfter).toBe(totalBefore - content1.length);
      expect(totalAfter).toBe(content2.length);

      console.log(`[TEST] Memory updated: ${totalBefore} → ${totalAfter} bytes after removal`);
    });

    it('should reset total memory usage when all buffers cleared', () => {
      console.log('[TEST] Memory reset on clear all');

      // Add multiple buffers
      for (let i = 0; i < 5; i++) {
        const scrollback = Array.from({ length: 1000 }, (_, j) => `Line ${j + 1}`);
        const content = scrollback.join('\n');

        const bufferState: TerminalBufferState = {
          terminalId: `mem-clear-${i}`,
          content,
          scrollback,
          cursorX: 0,
          cursorY: 10,
          cols: 80,
          rows: 24,
          timestamp: new Date(),
          sizeBytes: content.length,
        };

        bufferService.saveBufferState(bufferState);
      }

      expect(bufferService.getTotalMemoryUsage()).toBeGreaterThan(0);
      expect(bufferService.getBufferCount()).toBe(5);

      bufferService.clearAllBufferStates();

      expect(bufferService.getTotalMemoryUsage()).toBe(0);
      expect(bufferService.getBufferCount()).toBe(0);

      console.log('[TEST] Memory reset verified: 0 bytes after clear');
    });

    it('should provide individual buffer memory information', () => {
      console.log('[TEST] Individual buffer memory info');

      const scrollback = Array.from({ length: 5000 }, (_, i) => `Line ${i + 1}`);
      const content = scrollback.join('\n');

      const bufferState: TerminalBufferState = {
        terminalId: 'mem-individual',
        content,
        scrollback,
        cursorX: 0,
        cursorY: 10,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: content.length,
      };

      bufferService.saveBufferState(bufferState);

      const savedState = bufferService.getBufferState('mem-individual');
      expect(savedState).toBeDefined();
      expect(savedState!.sizeBytes).toBe(content.length);
      expect(savedState!.scrollback.length).toBe(5000);

      console.log(
        `[TEST] Individual buffer info: ${savedState!.sizeBytes} bytes, ${savedState!.scrollback.length} lines`
      );
    });

    it('should monitor memory usage with concurrent buffer operations', () => {
      console.log('[TEST] Concurrent memory monitoring');

      const operations = Array.from({ length: 10 }, (_, i) => {
        const scrollback = Array.from({ length: 500 + i * 100 }, (_, j) => `Line ${j + 1}`);
        const content = scrollback.join('\n');

        return {
          terminalId: `concurrent-${i}`,
          content,
          scrollback,
          cursorX: 0,
          cursorY: 10,
          cols: 80,
          rows: 24,
          timestamp: new Date(),
          sizeBytes: content.length,
        } as TerminalBufferState;
      });

      // Save all buffers
      operations.forEach((bufferState) => {
        bufferService.saveBufferState(bufferState);
      });

      expect(bufferService.getBufferCount()).toBe(10);

      const totalMemory = bufferService.getTotalMemoryUsage();
      const expectedTotal = operations.reduce((sum, op) => sum + op.sizeBytes, 0);

      expect(totalMemory).toBe(expectedTotal);

      console.log(`[TEST] Concurrent monitoring verified: ${totalMemory} bytes across 10 buffers`);
    });
  });

  describe('Memory Constraints', () => {
    it('should enforce 50MB limit per session', () => {
      console.log('[TEST] 50MB per-session limit enforcement');

      // Create buffer exceeding 50MB
      const largeLines = Array.from({ length: 6000 }, () => 'X'.repeat(12000)); // ~72MB
      const content = largeLines.join('\n');

      const bufferState: TerminalBufferState = {
        terminalId: 'constraint-50mb',
        content,
        scrollback: largeLines,
        cursorX: 0,
        cursorY: 10,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: content.length,
      };

      expect(bufferState.sizeBytes).toBeGreaterThan(50 * 1024 * 1024);

      bufferService.saveBufferState(bufferState);

      const savedState = bufferService.getBufferState('constraint-50mb');
      expect(savedState).toBeDefined();
      expect(savedState!.sizeBytes).toBeLessThanOrEqual(50 * 1024 * 1024);

      console.log(
        `[TEST] 50MB limit enforced: ${bufferState.sizeBytes} → ${savedState!.sizeBytes} bytes`
      );
    });

    it('should handle 10 concurrent sessions within memory limits', () => {
      console.log('[TEST] 10 concurrent sessions memory test');

      // Create 10 buffers, each ~5MB (total ~50MB)
      for (let i = 0; i < 10; i++) {
        const lines = Array.from({ length: 500 }, () => 'Y'.repeat(10000)); // ~5MB each
        const content = lines.join('\n');

        const bufferState: TerminalBufferState = {
          terminalId: `session-${i}`,
          content,
          scrollback: lines,
          cursorX: 0,
          cursorY: 10,
          cols: 80,
          rows: 24,
          timestamp: new Date(),
          sizeBytes: content.length,
        };

        bufferService.saveBufferState(bufferState);
      }

      expect(bufferService.getBufferCount()).toBe(10);

      const totalMemory = bufferService.getTotalMemoryUsage();
      const allBuffers = bufferService.getAllBufferStates();

      // Each buffer should be within 50MB limit
      allBuffers.forEach((buffer) => {
        expect(buffer.sizeBytes).toBeLessThanOrEqual(50 * 1024 * 1024);
      });

      console.log(
        `[TEST] 10 sessions verified: ${totalMemory} bytes total, ${allBuffers.length} buffers`
      );
    });

    it('should maintain performance under memory pressure', () => {
      console.log('[TEST] Performance under memory pressure');

      // Create 10 buffers near the 50MB limit
      const times: number[] = [];

      for (let i = 0; i < 10; i++) {
        // Create large buffer (~45MB)
        const lines = Array.from({ length: 4500 }, () => 'Z'.repeat(10000));
        const content = lines.join('\n');

        const bufferState: TerminalBufferState = {
          terminalId: `pressure-${i}`,
          content,
          scrollback: lines,
          cursorX: 0,
          cursorY: 10,
          cols: 80,
          rows: 24,
          timestamp: new Date(),
          sizeBytes: content.length,
        };

        const startTime = Date.now();
        bufferService.saveBufferState(bufferState);
        const duration = Date.now() - startTime;
        times.push(duration);
      }

      // All operations should complete within 200ms
      times.forEach((time, index) => {
        expect(time).toBeLessThan(200);
        console.log(`[TEST] Save ${index + 1}: ${time}ms`);
      });

      const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
      console.log(`[TEST] Average save time under pressure: ${avgTime.toFixed(2)}ms`);
    });

    it('should properly trim buffers approaching memory limits', () => {
      console.log('[TEST] Trimming near memory limits');

      // Create buffer at 48MB (close to 50MB limit)
      const lines = Array.from({ length: 4800 }, () => 'M'.repeat(10000)); // ~48MB
      const content = lines.join('\n');

      const bufferState: TerminalBufferState = {
        terminalId: 'near-limit',
        content,
        scrollback: lines,
        cursorX: 0,
        cursorY: 10,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: content.length,
      };

      bufferService.saveBufferState(bufferState);

      const savedState = bufferService.getBufferState('near-limit');
      expect(savedState).toBeDefined();
      expect(savedState!.sizeBytes).toBeLessThanOrEqual(50 * 1024 * 1024);
      expect(savedState!.scrollback.length).toBeLessThanOrEqual(10000);

      console.log(
        `[TEST] Near-limit trim: ${bufferState.sizeBytes} → ${savedState!.sizeBytes} bytes`
      );
    });
  });

  describe('XTerm Instance Reuse Optimization', () => {
    it('should maintain buffer state for instance reuse', () => {
      console.log('[TEST] Buffer state preservation for reuse');

      const scrollback = Array.from({ length: 3000 }, (_, i) => `Command ${i + 1}`);
      const content = scrollback.join('\n');

      const bufferState: TerminalBufferState = {
        terminalId: 'reuse-1',
        content,
        scrollback,
        cursorX: 10,
        cursorY: 15,
        cols: 120,
        rows: 30,
        timestamp: new Date(),
        sizeBytes: content.length,
      };

      // Save buffer state
      bufferService.saveBufferState(bufferState);

      // Simulate instance detach (buffer remains)
      const preserved = bufferService.getBufferState('reuse-1');
      expect(preserved).toBeDefined();
      expect(preserved!.cursorX).toBe(10);
      expect(preserved!.cursorY).toBe(15);
      expect(preserved!.cols).toBe(120);
      expect(preserved!.rows).toBe(30);
      expect(preserved!.scrollback.length).toBe(3000);

      console.log('[TEST] Buffer state preserved for instance reuse');
    });

    it('should support quick buffer retrieval for instance reuse', () => {
      console.log('[TEST] Quick buffer retrieval performance');

      // Create 10 buffers
      for (let i = 0; i < 10; i++) {
        const scrollback = Array.from({ length: 1000 }, (_, j) => `Line ${j + 1}`);
        const content = scrollback.join('\n');

        const bufferState: TerminalBufferState = {
          terminalId: `quick-${i}`,
          content,
          scrollback,
          cursorX: 0,
          cursorY: 10,
          cols: 80,
          rows: 24,
          timestamp: new Date(),
          sizeBytes: content.length,
        };

        bufferService.saveBufferState(bufferState);
      }

      // Test retrieval performance
      const startTime = Date.now();
      const retrieved = bufferService.getBufferState('quick-5');
      const duration = Date.now() - startTime;

      expect(retrieved).toBeDefined();
      expect(duration).toBeLessThan(10); // O(1) lookup should be <10ms

      console.log(`[TEST] Quick retrieval: ${duration}ms (O(1) Map lookup)`);
    });

    it('should handle buffer state updates without creating new instances', () => {
      console.log('[TEST] Buffer update without new instance');

      const scrollback1 = Array.from({ length: 1000 }, (_, i) => `Initial ${i + 1}`);
      const content1 = scrollback1.join('\n');

      const initialState: TerminalBufferState = {
        terminalId: 'update-test',
        content: content1,
        scrollback: scrollback1,
        cursorX: 5,
        cursorY: 10,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: content1.length,
      };

      bufferService.saveBufferState(initialState);
      expect(bufferService.getBufferCount()).toBe(1);

      // Update buffer (e.g., user typed more commands)
      const scrollback2 = Array.from({ length: 2000 }, (_, i) => `Updated ${i + 1}`);
      const content2 = scrollback2.join('\n');

      const updatedState: TerminalBufferState = {
        terminalId: 'update-test',
        content: content2,
        scrollback: scrollback2,
        cursorX: 15,
        cursorY: 20,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: content2.length,
      };

      bufferService.saveBufferState(updatedState);

      // Should still have 1 buffer (updated, not added)
      expect(bufferService.getBufferCount()).toBe(1);

      const current = bufferService.getBufferState('update-test');
      expect(current).toBeDefined();
      expect(current!.scrollback.length).toBe(2000);
      expect(current!.cursorX).toBe(15);
      expect(current!.cursorY).toBe(20);

      console.log('[TEST] Buffer updated in-place: 1k → 2k lines');
    });

    it('should efficiently manage buffer state for multiple reuse cycles', () => {
      console.log('[TEST] Multiple reuse cycles efficiency');

      const terminalId = 'reuse-cycles';
      const times: number[] = [];

      // Simulate 20 attach/detach cycles
      for (let cycle = 0; cycle < 20; cycle++) {
        const scrollback = Array.from(
          { length: 1000 + cycle * 100 },
          (_, i) => `Cycle ${cycle} Line ${i}`
        );
        const content = scrollback.join('\n');

        const bufferState: TerminalBufferState = {
          terminalId,
          content,
          scrollback,
          cursorX: cycle,
          cursorY: cycle,
          cols: 80,
          rows: 24,
          timestamp: new Date(),
          sizeBytes: content.length,
        };

        const startTime = Date.now();
        bufferService.saveBufferState(bufferState);
        const retrieved = bufferService.getBufferState(terminalId);
        const duration = Date.now() - startTime;

        expect(retrieved).toBeDefined();
        times.push(duration);
      }

      // All cycles should be fast
      times.forEach((time) => {
        expect(time).toBeLessThan(100);
      });

      const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
      console.log(`[TEST] 20 reuse cycles completed, avg time: ${avgTime.toFixed(2)}ms`);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty buffer gracefully', () => {
      console.log('[TEST] Empty buffer handling');

      const emptyState: TerminalBufferState = {
        terminalId: 'empty',
        content: '',
        scrollback: [],
        cursorX: 0,
        cursorY: 0,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: 0,
      };

      bufferService.saveBufferState(emptyState);

      const saved = bufferService.getBufferState('empty');
      expect(saved).toBeDefined();
      expect(saved!.scrollback.length).toBe(0);
      expect(saved!.sizeBytes).toBe(0);

      console.log('[TEST] Empty buffer handled correctly');
    });

    it('should handle buffer with exactly 10k lines', () => {
      console.log('[TEST] Exact limit boundary (10k lines)');

      const scrollback = Array.from({ length: 10000 }, (_, i) => `Line ${i + 1}`);
      const content = scrollback.join('\n');

      const bufferState: TerminalBufferState = {
        terminalId: 'exact-10k',
        content,
        scrollback,
        cursorX: 0,
        cursorY: 10,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: content.length,
      };

      bufferService.saveBufferState(bufferState);

      const saved = bufferService.getBufferState('exact-10k');
      expect(saved).toBeDefined();
      expect(saved!.scrollback.length).toBe(10000);

      console.log('[TEST] Exact 10k lines preserved (no trimming)');
    });

    it('should handle buffer with exactly 50MB', () => {
      console.log('[TEST] Exact size limit boundary (50MB)');

      // Create exactly 50MB
      const targetSize = 50 * 1024 * 1024;
      const lineSize = 10000;
      const numLines = Math.floor(targetSize / (lineSize + 1)); // +1 for newline

      const scrollback = Array.from({ length: numLines }, () => 'B'.repeat(lineSize));
      const content = scrollback.join('\n');

      const bufferState: TerminalBufferState = {
        terminalId: 'exact-50mb',
        content,
        scrollback,
        cursorX: 0,
        cursorY: 10,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: content.length,
      };

      bufferService.saveBufferState(bufferState);

      const saved = bufferService.getBufferState('exact-50mb');
      expect(saved).toBeDefined();
      expect(saved!.sizeBytes).toBeLessThanOrEqual(50 * 1024 * 1024);

      console.log(`[TEST] ~50MB buffer handled: ${saved!.sizeBytes} bytes`);
    });

    it('should handle rapid successive saves', () => {
      console.log('[TEST] Rapid successive saves');

      const scrollback = Array.from({ length: 5000 }, (_, i) => `Line ${i + 1}`);
      const content = scrollback.join('\n');

      // Save same buffer 100 times rapidly
      for (let i = 0; i < 100; i++) {
        const bufferState: TerminalBufferState = {
          terminalId: 'rapid-save',
          content,
          scrollback,
          cursorX: i,
          cursorY: i,
          cols: 80,
          rows: 24,
          timestamp: new Date(),
          sizeBytes: content.length,
        };

        bufferService.saveBufferState(bufferState);
      }

      // Should still have only 1 buffer
      expect(bufferService.getBufferCount()).toBe(1);

      const final = bufferService.getBufferState('rapid-save');
      expect(final).toBeDefined();
      expect(final!.cursorX).toBe(99); // Last save

      console.log('[TEST] 100 rapid saves completed, single buffer maintained');
    });
  });
});
