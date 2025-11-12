import { TerminalBufferService } from '@/main/services/TerminalBufferService';
import { TerminalBufferState } from '@/types/terminal.types';
import log from 'electron-log';

// Mock electron-log
jest.mock('electron-log', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('TerminalBufferService - Phase 1 Buffer Management', () => {
  let service: TerminalBufferService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TerminalBufferService();
  });

  describe('Configuration', () => {
    it('should initialize with correct default limits', () => {
      expect(service.getMaxScrollbackLines()).toBe(10000);
      expect(service.getMaxBufferSizeBytes()).toBe(50 * 1024 * 1024); // 50MB
    });

    it('should log service initialization', () => {
      expect(log.info).toHaveBeenCalledWith(
        '[TerminalBufferService] Service initialized',
        expect.objectContaining({
          maxScrollbackLines: 10000,
          maxBufferSizeBytes: 52428800,
          memoryWarningThreshold: expect.any(Number),
          trimPerformanceTarget: expect.any(Number),
        })
      );
    });
  });

  describe('Buffer State Management', () => {
    const mockBufferState: TerminalBufferState = {
      terminalId: 'terminal-123',
      content: 'Line 1\nLine 2\nLine 3',
      scrollback: ['Line 1', 'Line 2', 'Line 3'],
      cursorX: 0,
      cursorY: 2,
      cols: 80,
      rows: 24,
      timestamp: new Date('2025-01-01T00:00:00Z'),
      sizeBytes: 300,
    };

    it('should save buffer state', () => {
      service.saveBufferState(mockBufferState);

      const retrieved = service.getBufferState('terminal-123');
      expect(retrieved).toBeDefined();
      expect(retrieved?.terminalId).toBe('terminal-123');
      expect(retrieved?.scrollback).toHaveLength(3);
    });

    it('should update existing buffer state', () => {
      service.saveBufferState(mockBufferState);

      const updatedState: TerminalBufferState = {
        ...mockBufferState,
        content: 'Updated content',
        scrollback: ['Line 1', 'Line 2', 'Line 3', 'Line 4'],
        sizeBytes: 400,
      };
      service.saveBufferState(updatedState);

      const retrieved = service.getBufferState('terminal-123');
      expect(retrieved?.scrollback).toHaveLength(4);
      expect(retrieved?.sizeBytes).toBe(400);
    });

    it('should retrieve buffer state by terminal ID', () => {
      service.saveBufferState(mockBufferState);

      const retrieved = service.getBufferState('terminal-123');
      expect(retrieved).toEqual(mockBufferState);
    });

    it('should return undefined for non-existent terminal', () => {
      const retrieved = service.getBufferState('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should remove buffer state', () => {
      service.saveBufferState(mockBufferState);
      expect(service.hasBufferState('terminal-123')).toBe(true);

      service.removeBufferState('terminal-123');
      expect(service.hasBufferState('terminal-123')).toBe(false);
      expect(service.getBufferState('terminal-123')).toBeUndefined();
    });

    it('should check if buffer state exists', () => {
      expect(service.hasBufferState('terminal-123')).toBe(false);

      service.saveBufferState(mockBufferState);
      expect(service.hasBufferState('terminal-123')).toBe(true);
    });

    it('should clear all buffer states', () => {
      service.saveBufferState(mockBufferState);
      service.saveBufferState({ ...mockBufferState, terminalId: 'terminal-456' });

      expect(service.getAllBufferStates()).toHaveLength(2);

      service.clearAllBufferStates();
      expect(service.getAllBufferStates()).toHaveLength(0);
    });

    it('should get all buffer states', () => {
      const state1 = { ...mockBufferState, terminalId: 'terminal-1' };
      const state2 = { ...mockBufferState, terminalId: 'terminal-2' };

      service.saveBufferState(state1);
      service.saveBufferState(state2);

      const all = service.getAllBufferStates();
      expect(all).toHaveLength(2);
      expect(all.map((s) => s.terminalId)).toEqual(['terminal-1', 'terminal-2']);
    });
  });

  describe('FIFO Buffer Trimming - 10k Line Limit', () => {
    it('should not trim buffer under 10k lines', () => {
      const lines = Array.from({ length: 5000 }, (_, i) => `Line ${i}`);
      const bufferState: TerminalBufferState = {
        terminalId: 'terminal-123',
        content: lines.join('\n'),
        scrollback: lines,
        cursorX: 0,
        cursorY: 5000,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: lines.join('\n').length,
      };

      const trimmed = service.trimBufferIfNeeded(bufferState);

      expect(trimmed.scrollback).toHaveLength(5000);
      expect(trimmed.scrollback[0]).toBe('Line 0');
    });

    it('should trim buffer to 10k lines using FIFO', () => {
      const lines = Array.from({ length: 12000 }, (_, i) => `Line ${i}`);
      const bufferState: TerminalBufferState = {
        terminalId: 'terminal-123',
        content: lines.join('\n'),
        scrollback: lines,
        cursorX: 0,
        cursorY: 12000,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: lines.join('\n').length,
      };

      const trimmed = service.trimBufferIfNeeded(bufferState);

      expect(trimmed.scrollback).toHaveLength(10000);
      // FIFO: Should keep lines 2000-11999 (most recent 10k)
      expect(trimmed.scrollback[0]).toBe('Line 2000');
      expect(trimmed.scrollback[9999]).toBe('Line 11999');
    });

    it('should log trimming operation', () => {
      const lines = Array.from({ length: 12000 }, (_, i) => `Line ${i}`);
      const bufferState: TerminalBufferState = {
        terminalId: 'terminal-123',
        content: lines.join('\n'),
        scrollback: lines,
        cursorX: 0,
        cursorY: 12000,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: lines.join('\n').length,
      };

      service.trimBufferIfNeeded(bufferState);

      expect(log.info).toHaveBeenCalledWith(
        '[TerminalBufferService] Buffer trimmed (optimized)',
        expect.objectContaining({
          terminalId: 'terminal-123',
          linesBefore: 12000,
          linesAfter: 10000,
        })
      );
    });

    it('should update content after trimming', () => {
      const lines = Array.from({ length: 11000 }, (_, i) => `Line ${i}`);
      const bufferState: TerminalBufferState = {
        terminalId: 'terminal-123',
        content: lines.join('\n'),
        scrollback: lines,
        cursorX: 0,
        cursorY: 11000,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: lines.join('\n').length,
      };

      const trimmed = service.trimBufferIfNeeded(bufferState);

      expect(trimmed.content).toBe(trimmed.scrollback.join('\n'));
      expect(trimmed.content).not.toContain('Line 0');
      expect(trimmed.content).toContain('Line 10999');
    });
  });

  describe('FIFO Buffer Trimming - 50MB Size Limit', () => {
    it('should not trim buffer under 50MB', () => {
      const lines = Array.from({ length: 1000 }, (_, i) => `Line ${i}`.padEnd(100, 'x'));
      const content = lines.join('\n');
      const bufferState: TerminalBufferState = {
        terminalId: 'terminal-123',
        content,
        scrollback: lines,
        cursorX: 0,
        cursorY: 1000,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: content.length,
      };

      const trimmed = service.trimBufferIfNeeded(bufferState);

      expect(trimmed.scrollback).toHaveLength(1000);
    });

    it('should trim buffer exceeding 50MB using FIFO', () => {
      // Create buffer > 50MB (each line ~1KB, need ~52k lines for >50MB)
      const largeLines = Array.from({ length: 60000 }, (_, i) => `Line ${i}`.padEnd(1000, 'x'));
      const content = largeLines.join('\n');
      const bufferState: TerminalBufferState = {
        terminalId: 'terminal-123',
        content,
        scrollback: largeLines,
        cursorX: 0,
        cursorY: 60000,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: content.length,
      };

      const trimmed = service.trimBufferIfNeeded(bufferState);

      // Should trim to stay under 50MB
      expect(trimmed.sizeBytes).toBeLessThan(50 * 1024 * 1024);
      expect(trimmed.scrollback.length).toBeLessThan(60000);

      // FIFO: Should keep most recent lines
      expect(trimmed.scrollback[trimmed.scrollback.length - 1]).toContain('Line 59999');
    });

    it('should recalculate sizeBytes after trimming', () => {
      const largeLines = Array.from({ length: 60000 }, (_, i) => `Line ${i}`.padEnd(1000, 'x'));
      const content = largeLines.join('\n');
      const bufferState: TerminalBufferState = {
        terminalId: 'terminal-123',
        content,
        scrollback: largeLines,
        cursorX: 0,
        cursorY: 60000,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: content.length,
      };

      const trimmed = service.trimBufferIfNeeded(bufferState);

      expect(trimmed.sizeBytes).toBe(trimmed.content.length);
      expect(trimmed.sizeBytes).toBeLessThan(bufferState.sizeBytes);
    });
  });

  describe('Buffer Trimming Statistics', () => {
    it('should return trim statistics when buffer is trimmed', () => {
      const lines = Array.from({ length: 15000 }, (_, i) => `Line ${i}`);
      const bufferState: TerminalBufferState = {
        terminalId: 'terminal-123',
        content: lines.join('\n'),
        scrollback: lines,
        cursorX: 0,
        cursorY: 15000,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: lines.join('\n').length,
      };

      const stats = service.getTrimStats(bufferState);

      expect(stats).toBeDefined();
      expect(stats!.linesBefore).toBe(15000);
      expect(stats!.linesAfter).toBe(10000);
      expect(stats!.bytesRemoved).toBeGreaterThan(0);
      expect(stats!.timestamp).toBeInstanceOf(Date);
    });

    it('should return null when no trimming needed', () => {
      const lines = Array.from({ length: 5000 }, (_, i) => `Line ${i}`);
      const bufferState: TerminalBufferState = {
        terminalId: 'terminal-123',
        content: lines.join('\n'),
        scrollback: lines,
        cursorX: 0,
        cursorY: 5000,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: lines.join('\n').length,
      };

      const stats = service.getTrimStats(bufferState);

      expect(stats).toBeNull();
    });
  });

  describe('Buffer Calculation', () => {
    it('should calculate buffer size in bytes', () => {
      const content = 'Hello, World!';
      const size = service.calculateBufferSize(content);

      expect(size).toBe(content.length);
    });

    it('should calculate buffer size for multi-line content', () => {
      const lines = ['Line 1', 'Line 2', 'Line 3'];
      const content = lines.join('\n');
      const size = service.calculateBufferSize(content);

      expect(size).toBe(content.length);
    });

    it('should handle empty content', () => {
      const size = service.calculateBufferSize('');

      expect(size).toBe(0);
    });
  });

  describe('Auto-Trimming on Save', () => {
    it('should automatically trim buffer when saving oversized state', () => {
      const lines = Array.from({ length: 12000 }, (_, i) => `Line ${i}`);
      const bufferState: TerminalBufferState = {
        terminalId: 'terminal-123',
        content: lines.join('\n'),
        scrollback: lines,
        cursorX: 0,
        cursorY: 12000,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: lines.join('\n').length,
      };

      service.saveBufferState(bufferState);

      const retrieved = service.getBufferState('terminal-123');
      expect(retrieved?.scrollback).toHaveLength(10000);
    });

    it('should log when auto-trimming occurs on save', () => {
      const lines = Array.from({ length: 11000 }, (_, i) => `Line ${i}`);
      const bufferState: TerminalBufferState = {
        terminalId: 'terminal-123',
        content: lines.join('\n'),
        scrollback: lines,
        cursorX: 0,
        cursorY: 11000,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: lines.join('\n').length,
      };

      service.saveBufferState(bufferState);

      expect(log.info).toHaveBeenCalledWith(
        '[TerminalBufferService] Auto-trimming on save',
        expect.any(Object)
      );
    });
  });

  describe('Memory Management', () => {
    it('should track buffer count', () => {
      expect(service.getBufferCount()).toBe(0);

      service.saveBufferState({
        terminalId: 'terminal-1',
        content: 'test',
        scrollback: ['test'],
        cursorX: 0,
        cursorY: 0,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: 4,
      });

      expect(service.getBufferCount()).toBe(1);

      service.saveBufferState({
        terminalId: 'terminal-2',
        content: 'test',
        scrollback: ['test'],
        cursorX: 0,
        cursorY: 0,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: 4,
      });

      expect(service.getBufferCount()).toBe(2);
    });

    it('should calculate total memory usage', () => {
      const state1: TerminalBufferState = {
        terminalId: 'terminal-1',
        content: 'test1',
        scrollback: ['test1'],
        cursorX: 0,
        cursorY: 0,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: 1000,
      };

      const state2: TerminalBufferState = {
        terminalId: 'terminal-2',
        content: 'test2',
        scrollback: ['test2'],
        cursorX: 0,
        cursorY: 0,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: 2000,
      };

      service.saveBufferState(state1);
      service.saveBufferState(state2);

      const totalMemory = service.getTotalMemoryUsage();
      expect(totalMemory).toBe(3000);
    });

    it('should enforce 10 terminal limit from store', () => {
      // TerminalBufferService should work with store's maxTerminals: 10
      // Create 11 buffers to test behavior
      for (let i = 0; i < 11; i++) {
        service.saveBufferState({
          terminalId: `terminal-${i}`,
          content: `test ${i}`,
          scrollback: [`test ${i}`],
          cursorX: 0,
          cursorY: 0,
          cols: 80,
          rows: 24,
          timestamp: new Date(),
          sizeBytes: 10,
        });
      }

      // Service should store all 11, enforcement happens at store level
      expect(service.getBufferCount()).toBe(11);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty scrollback', () => {
      const bufferState: TerminalBufferState = {
        terminalId: 'terminal-123',
        content: '',
        scrollback: [],
        cursorX: 0,
        cursorY: 0,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: 0,
      };

      const trimmed = service.trimBufferIfNeeded(bufferState);

      expect(trimmed.scrollback).toHaveLength(0);
      expect(trimmed.content).toBe('');
    });

    it('should handle single line buffer', () => {
      const bufferState: TerminalBufferState = {
        terminalId: 'terminal-123',
        content: 'Single line',
        scrollback: ['Single line'],
        cursorX: 11,
        cursorY: 0,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: 11,
      };

      const trimmed = service.trimBufferIfNeeded(bufferState);

      expect(trimmed.scrollback).toHaveLength(1);
      expect(trimmed.scrollback[0]).toBe('Single line');
    });

    it('should handle buffer exactly at 10k line limit', () => {
      const lines = Array.from({ length: 10000 }, (_, i) => `Line ${i}`);
      const bufferState: TerminalBufferState = {
        terminalId: 'terminal-123',
        content: lines.join('\n'),
        scrollback: lines,
        cursorX: 0,
        cursorY: 10000,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: lines.join('\n').length,
      };

      const trimmed = service.trimBufferIfNeeded(bufferState);

      expect(trimmed.scrollback).toHaveLength(10000);
      expect(trimmed.scrollback[0]).toBe('Line 0');
    });
  });

  describe('Performance Requirements', () => {
    it('should handle 10k line buffer efficiently', () => {
      const lines = Array.from({ length: 10000 }, (_, i) => `Line ${i}`);
      const bufferState: TerminalBufferState = {
        terminalId: 'terminal-123',
        content: lines.join('\n'),
        scrollback: lines,
        cursorX: 0,
        cursorY: 10000,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: lines.join('\n').length,
      };

      const startTime = Date.now();
      service.saveBufferState(bufferState);
      const saveTime = Date.now() - startTime;

      expect(saveTime).toBeLessThan(100); // Should save in <100ms
    });

    it('should trim 60k lines to 10k efficiently', () => {
      const lines = Array.from({ length: 60000 }, (_, i) => `Line ${i}`);
      const bufferState: TerminalBufferState = {
        terminalId: 'terminal-123',
        content: lines.join('\n'),
        scrollback: lines,
        cursorX: 0,
        cursorY: 60000,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: lines.join('\n').length,
      };

      const startTime = Date.now();
      const trimmed = service.trimBufferIfNeeded(bufferState);
      const trimTime = Date.now() - startTime;

      expect(trimTime).toBeLessThan(200); // Should trim in <200ms
      expect(trimmed.scrollback).toHaveLength(10000);
    });
  });
});
