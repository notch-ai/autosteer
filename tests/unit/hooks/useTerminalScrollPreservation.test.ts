/**
 * Unit Tests for useTerminalScrollPreservation Hook
 *
 * Tests terminal scroll position preservation for xterm.js viewports.
 * Follows TDD approach with comprehensive coverage.
 *
 * Test Coverage:
 * - Hook initialization
 * - Terminal scroll position save/restore
 * - xterm.js viewport integration
 * - Error handling for missing elements
 * - Cleanup and memory management
 *
 * Target Coverage: 80%+
 */

import { renderHook, act } from '@testing-library/react';
import { useTerminalScrollPreservation } from '@/hooks/useTerminalScrollPreservation';
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

describe('useTerminalScrollPreservation', () => {
  let mockTerminal: any;
  let mockViewportElement: HTMLDivElement;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock viewport element
    mockViewportElement = document.createElement('div');
    mockViewportElement.className = 'xterm-viewport';
    Object.defineProperty(mockViewportElement, 'scrollTop', {
      writable: true,
      value: 0,
    });

    // Create mock terminal with element
    const mockElement = document.createElement('div');
    mockElement.appendChild(mockViewportElement);

    mockTerminal = {
      element: mockElement,
    };

    // Mock requestAnimationFrame
    global.requestAnimationFrame = jest.fn((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Hook Initialization', () => {
    it('should initialize with proper methods', () => {
      const { result } = renderHook(() => useTerminalScrollPreservation());

      expect(result.current.saveTerminalScrollPosition).toBeDefined();
      expect(result.current.restoreTerminalScrollPosition).toBeDefined();
      expect(result.current.clearTerminalScrollPosition).toBeDefined();
      expect(result.current.getTrackedTerminalIds).toBeDefined();
    });
  });

  describe('Terminal Scroll Position Save', () => {
    it('should save terminal scroll position', () => {
      const { result } = renderHook(() => useTerminalScrollPreservation());

      mockViewportElement.scrollTop = 500;

      act(() => {
        result.current.saveTerminalScrollPosition('terminal-1', mockTerminal);
      });

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Saved terminal scroll position'),
        expect.objectContaining({
          terminalId: 'terminal-1',
        })
      );
    });

    it('should handle save with no terminal instance', () => {
      const { result } = renderHook(() => useTerminalScrollPreservation());

      act(() => {
        result.current.saveTerminalScrollPosition('terminal-1', null);
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No terminal instance provided'),
        expect.any(Object)
      );
    });

    it('should handle save with no viewport element', () => {
      const { result } = renderHook(() => useTerminalScrollPreservation());

      const terminalWithoutViewport = {
        element: document.createElement('div'),
      };

      act(() => {
        result.current.saveTerminalScrollPosition('terminal-1', terminalWithoutViewport);
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Viewport element not found'),
        expect.any(Object)
      );
    });

    it('should handle errors during save', () => {
      const { result } = renderHook(() => useTerminalScrollPreservation());

      const brokenTerminal = {
        get element() {
          throw new Error('Element access failed');
        },
      };

      act(() => {
        result.current.saveTerminalScrollPosition('terminal-1', brokenTerminal);
      });

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save scroll position'),
        expect.any(Object)
      );
    });
  });

  describe('Terminal Scroll Position Restore', () => {
    it('should restore terminal scroll position', () => {
      const { result } = renderHook(() => useTerminalScrollPreservation());

      // Save position
      mockViewportElement.scrollTop = 500;
      act(() => {
        result.current.saveTerminalScrollPosition('terminal-1', mockTerminal);
      });

      // Change position
      mockViewportElement.scrollTop = 0;

      // Restore position
      act(() => {
        result.current.restoreTerminalScrollPosition('terminal-1', mockTerminal);
      });

      expect(requestAnimationFrame).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Restored terminal scroll position'),
        expect.any(Object)
      );
    });

    it('should scroll to bottom when no saved position exists', () => {
      const { result } = renderHook(() => useTerminalScrollPreservation());

      // Set scrollHeight to simulate content
      Object.defineProperty(mockViewportElement, 'scrollHeight', {
        writable: true,
        value: 1000,
      });

      // Set current position
      mockViewportElement.scrollTop = 100;

      act(() => {
        result.current.restoreTerminalScrollPosition('new-terminal', mockTerminal);
      });

      expect(requestAnimationFrame).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No saved position, scrolled to bottom'),
        expect.objectContaining({
          terminalId: 'new-terminal',
        })
      );
    });

    it('should handle restore with no terminal instance', () => {
      const { result } = renderHook(() => useTerminalScrollPreservation());

      act(() => {
        result.current.restoreTerminalScrollPosition('terminal-1', null);
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No terminal instance provided'),
        expect.any(Object)
      );
    });

    it('should handle errors during restore', () => {
      const { result } = renderHook(() => useTerminalScrollPreservation());

      // Save position
      mockViewportElement.scrollTop = 500;
      act(() => {
        result.current.saveTerminalScrollPosition('terminal-1', mockTerminal);
      });

      // Broken terminal for restore
      const brokenTerminal = {
        get element() {
          throw new Error('Element access failed');
        },
      };

      act(() => {
        result.current.restoreTerminalScrollPosition('terminal-1', brokenTerminal);
      });

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to restore scroll position'),
        expect.any(Object)
      );
    });
  });

  describe('Multiple Terminals', () => {
    it('should preserve separate positions for different terminals', () => {
      const { result } = renderHook(() => useTerminalScrollPreservation());

      // Save position for terminal-1
      mockViewportElement.scrollTop = 200;
      act(() => {
        result.current.saveTerminalScrollPosition('terminal-1', mockTerminal);
      });

      // Save position for terminal-2
      mockViewportElement.scrollTop = 400;
      act(() => {
        result.current.saveTerminalScrollPosition('terminal-2', mockTerminal);
      });

      // Restore terminal-1 position
      mockViewportElement.scrollTop = 0;
      act(() => {
        result.current.restoreTerminalScrollPosition('terminal-1', mockTerminal);
      });

      expect(requestAnimationFrame).toHaveBeenCalled();
    });
  });

  describe('Clear Terminal Position', () => {
    it('should clear scroll position for a terminal', () => {
      const { result } = renderHook(() => useTerminalScrollPreservation());

      // Save position
      mockViewportElement.scrollTop = 500;
      act(() => {
        result.current.saveTerminalScrollPosition('terminal-1', mockTerminal);
      });

      // Clear position
      act(() => {
        result.current.clearTerminalScrollPosition('terminal-1');
      });

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cleared terminal scroll position'),
        expect.objectContaining({
          terminalId: 'terminal-1',
        })
      );

      // Try to restore - should scroll to bottom since no saved position
      act(() => {
        result.current.restoreTerminalScrollPosition('terminal-1', mockTerminal);
      });

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No saved position, scrolled to bottom'),
        expect.any(Object)
      );
    });
  });

  describe('Get Tracked Terminal IDs', () => {
    it('should return all tracked terminal IDs', () => {
      const { result } = renderHook(() => useTerminalScrollPreservation());

      // Save positions for multiple terminals
      act(() => {
        result.current.saveTerminalScrollPosition('terminal-1', mockTerminal);
        result.current.saveTerminalScrollPosition('terminal-2', mockTerminal);
        result.current.saveTerminalScrollPosition('terminal-3', mockTerminal);
      });

      const trackedIds = result.current.getTrackedTerminalIds();
      expect(trackedIds).toHaveLength(3);
      expect(trackedIds).toContain('terminal-1');
      expect(trackedIds).toContain('terminal-2');
      expect(trackedIds).toContain('terminal-3');
    });

    it('should return empty array when no terminals tracked', () => {
      const { result } = renderHook(() => useTerminalScrollPreservation());

      const trackedIds = result.current.getTrackedTerminalIds();
      expect(trackedIds).toEqual([]);
    });
  });

  describe('Cleanup and Memory Management', () => {
    it('should handle many terminals without errors', () => {
      const { result } = renderHook(() => useTerminalScrollPreservation());

      // Create many terminals
      expect(() => {
        act(() => {
          for (let i = 0; i < 60; i++) {
            mockViewportElement.scrollTop = i * 10;
            result.current.saveTerminalScrollPosition(`terminal-${i}`, mockTerminal);
          }
        });
      }).not.toThrow();

      // Verify we can still save/restore after many terminals
      mockViewportElement.scrollTop = 999;
      act(() => {
        result.current.saveTerminalScrollPosition('test-terminal', mockTerminal);
      });

      mockViewportElement.scrollTop = 0;
      act(() => {
        result.current.restoreTerminalScrollPosition('test-terminal', mockTerminal);
      });

      expect(() => {
        jest.runAllTimers();
      }).not.toThrow();
    });
  });
});
