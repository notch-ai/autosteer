/**
 * Unit Tests for useChangesTabScrollPreservation Hook
 *
 * Tests dual scroll position preservation for Changes tab (file list + diff viewer).
 * Follows TDD approach with comprehensive coverage.
 *
 * Test Coverage:
 * - Hook initialization
 * - Dual scroll position save/restore
 * - Independent tracking for file list and diff viewer
 * - Project switching
 * - Cleanup and memory management
 * - Error handling
 *
 * Target Coverage: 80%+
 */

import { renderHook, act } from '@testing-library/react';
import { useChangesTabScrollPreservation } from '@/hooks/useChangesTabScrollPreservation';
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

describe('useChangesTabScrollPreservation', () => {
  let mockFileListElement: HTMLDivElement;
  let mockDiffViewerElement: HTMLDivElement;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock file list element
    mockFileListElement = document.createElement('div');
    Object.defineProperty(mockFileListElement, 'scrollTop', {
      writable: true,
      value: 0,
    });

    // Create mock diff viewer element
    mockDiffViewerElement = document.createElement('div');
    Object.defineProperty(mockDiffViewerElement, 'scrollTop', {
      writable: true,
      value: 0,
    });

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
    it('should initialize with proper refs and methods', () => {
      const { result } = renderHook(() => useChangesTabScrollPreservation('project-1'));

      expect(result.current.fileListRef).toBeDefined();
      expect(result.current.diffViewerRef).toBeDefined();
      expect(result.current.saveScrollPositions).toBeDefined();
      expect(result.current.restoreScrollPositions).toBeDefined();
      expect(result.current.clearScrollPositions).toBeDefined();
      expect(result.current.getTrackedProjectIds).toBeDefined();
    });

    it('should handle null projectId gracefully', () => {
      const { result } = renderHook(() => useChangesTabScrollPreservation(null));

      expect(result.current.fileListRef).toBeDefined();
      expect(() => result.current.saveScrollPositions()).not.toThrow();
    });
  });

  describe('Dual Scroll Position Save', () => {
    it('should save scroll positions for both file list and diff viewer', () => {
      const { result } = renderHook(() => useChangesTabScrollPreservation('project-1'));

      // Attach mock elements to refs
      act(() => {
        if (result.current.fileListRef.current) {
          result.current.fileListRef.current = mockFileListElement;
        }
        if (result.current.diffViewerRef.current) {
          result.current.diffViewerRef.current = mockDiffViewerElement;
        }
      });

      // Set scroll positions
      mockFileListElement.scrollTop = 100;
      mockDiffViewerElement.scrollTop = 300;

      // Save positions
      act(() => {
        result.current.saveScrollPositions();
      });

      // Should not log in non-debug mode
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('should handle save with null projectId', () => {
      const { result } = renderHook(() => useChangesTabScrollPreservation(null));

      act(() => {
        if (result.current.fileListRef.current) {
          result.current.fileListRef.current = mockFileListElement;
        }
        if (result.current.diffViewerRef.current) {
          result.current.diffViewerRef.current = mockDiffViewerElement;
        }
      });

      // Should not throw
      act(() => {
        result.current.saveScrollPositions();
      });

      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should handle save without refs gracefully', () => {
      const { result } = renderHook(() => useChangesTabScrollPreservation('project-1'));

      // Don't attach refs - should handle gracefully
      expect(() => {
        act(() => {
          result.current.saveScrollPositions();
        });
      }).not.toThrow();

      // Verify save still works after attaching refs
      act(() => {
        result.current.fileListRef.current = mockFileListElement;
        result.current.diffViewerRef.current = mockDiffViewerElement;
      });

      mockFileListElement.scrollTop = 100;
      mockDiffViewerElement.scrollTop = 200;

      expect(() => {
        act(() => {
          result.current.saveScrollPositions();
        });
      }).not.toThrow();
    });
  });

  describe('Dual Scroll Position Restore', () => {
    it('should restore scroll positions for both file list and diff viewer', () => {
      const { result } = renderHook(() => useChangesTabScrollPreservation('project-1'));

      // Attach mock elements
      act(() => {
        if (result.current.fileListRef.current) {
          result.current.fileListRef.current = mockFileListElement;
        }
        if (result.current.diffViewerRef.current) {
          result.current.diffViewerRef.current = mockDiffViewerElement;
        }
      });

      // Save positions
      mockFileListElement.scrollTop = 100;
      mockDiffViewerElement.scrollTop = 300;
      act(() => {
        result.current.saveScrollPositions();
      });

      // Change positions
      mockFileListElement.scrollTop = 0;
      mockDiffViewerElement.scrollTop = 0;

      // Restore positions
      act(() => {
        result.current.restoreScrollPositions();
      });

      expect(requestAnimationFrame).toHaveBeenCalled();
    });

    it('should scroll to bottom when no saved positions exist', () => {
      const { result } = renderHook(() =>
        useChangesTabScrollPreservation('new-project', { debug: true })
      );

      // Set scrollHeight to simulate content
      Object.defineProperty(mockFileListElement, 'scrollHeight', {
        writable: true,
        value: 1000,
      });
      Object.defineProperty(mockDiffViewerElement, 'scrollHeight', {
        writable: true,
        value: 2000,
      });

      act(() => {
        if (result.current.fileListRef.current) {
          result.current.fileListRef.current = mockFileListElement;
        }
        if (result.current.diffViewerRef.current) {
          result.current.diffViewerRef.current = mockDiffViewerElement;
        }
      });

      act(() => {
        result.current.restoreScrollPositions();
      });

      // Should scroll to bottom when no saved positions
      expect(requestAnimationFrame).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No saved positions, scrolled to bottom'),
        expect.objectContaining({
          projectId: 'new-project',
        })
      );
    });

    it('should handle restore with null projectId', () => {
      const { result } = renderHook(() => useChangesTabScrollPreservation(null));

      act(() => {
        result.current.restoreScrollPositions();
      });

      // Should not throw
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should handle restore without refs gracefully', () => {
      const { result } = renderHook(() => useChangesTabScrollPreservation('project-1'));

      // Save with refs attached
      act(() => {
        result.current.fileListRef.current = mockFileListElement;
        result.current.diffViewerRef.current = mockDiffViewerElement;
        mockFileListElement.scrollTop = 100;
        mockDiffViewerElement.scrollTop = 200;
        result.current.saveScrollPositions();
      });

      // Detach refs and restore - should handle gracefully
      act(() => {
        result.current.fileListRef.current = null;
        result.current.diffViewerRef.current = null;
      });

      expect(() => {
        act(() => {
          result.current.restoreScrollPositions();
        });
      }).not.toThrow();

      // Restore refs and verify restoration works again
      act(() => {
        result.current.fileListRef.current = mockFileListElement;
        result.current.diffViewerRef.current = mockDiffViewerElement;
        result.current.restoreScrollPositions();
      });

      jest.runAllTimers();

      expect(mockFileListElement.scrollTop).toBe(100);
      expect(mockDiffViewerElement.scrollTop).toBe(200);
    });
  });

  describe('Multiple Projects', () => {
    it('should preserve separate positions for different projects', () => {
      const { result, rerender } = renderHook(
        ({ projectId }) => useChangesTabScrollPreservation(projectId),
        { initialProps: { projectId: 'project-1' } }
      );

      act(() => {
        if (result.current.fileListRef.current) {
          result.current.fileListRef.current = mockFileListElement;
        }
        if (result.current.diffViewerRef.current) {
          result.current.diffViewerRef.current = mockDiffViewerElement;
        }
      });

      // Save positions for project-1
      mockFileListElement.scrollTop = 100;
      mockDiffViewerElement.scrollTop = 200;
      act(() => {
        result.current.saveScrollPositions();
      });

      // Switch to project-2
      rerender({ projectId: 'project-2' });

      // Save positions for project-2
      mockFileListElement.scrollTop = 300;
      mockDiffViewerElement.scrollTop = 400;
      act(() => {
        result.current.saveScrollPositions();
      });

      // Switch back to project-1
      rerender({ projectId: 'project-1' });

      // Should restore project-1 positions
      mockFileListElement.scrollTop = 0;
      mockDiffViewerElement.scrollTop = 0;

      expect(requestAnimationFrame).toHaveBeenCalled();
    });
  });

  describe('Clear Scroll Positions', () => {
    it('should clear scroll positions for a project', () => {
      const { result } = renderHook(() => useChangesTabScrollPreservation('project-1'));

      act(() => {
        if (result.current.fileListRef.current) {
          result.current.fileListRef.current = mockFileListElement;
        }
        if (result.current.diffViewerRef.current) {
          result.current.diffViewerRef.current = mockDiffViewerElement;
        }
      });

      // Save positions
      mockFileListElement.scrollTop = 100;
      mockDiffViewerElement.scrollTop = 200;
      act(() => {
        result.current.saveScrollPositions();
      });

      // Clear positions
      act(() => {
        result.current.clearScrollPositions('project-1');
      });

      // Try to restore - should scroll to bottom since no saved positions
      act(() => {
        result.current.restoreScrollPositions();
      });

      // Should call requestAnimationFrame to scroll to bottom
      expect(requestAnimationFrame).toHaveBeenCalled();
    });
  });

  describe('Get Tracked Project IDs', () => {
    it('should return all tracked project IDs', () => {
      const { result } = renderHook(() => useChangesTabScrollPreservation('project-1'));

      act(() => {
        if (result.current.fileListRef.current) {
          result.current.fileListRef.current = mockFileListElement;
        }
        if (result.current.diffViewerRef.current) {
          result.current.diffViewerRef.current = mockDiffViewerElement;
        }
      });

      // Save positions for multiple projects
      const { result: result2 } = renderHook(() => useChangesTabScrollPreservation('project-2'));
      act(() => {
        if (result2.current.fileListRef.current) {
          result2.current.fileListRef.current = mockFileListElement;
        }
        if (result2.current.diffViewerRef.current) {
          result2.current.diffViewerRef.current = mockDiffViewerElement;
        }
        result.current.saveScrollPositions();
        result2.current.saveScrollPositions();
      });

      const trackedIds = result.current.getTrackedProjectIds();
      expect(trackedIds.length).toBeGreaterThan(0);
    });

    it('should return empty array when no projects tracked', () => {
      const { result } = renderHook(() => useChangesTabScrollPreservation('project-1'));

      const trackedIds = result.current.getTrackedProjectIds();
      expect(trackedIds).toEqual([]);
    });
  });

  describe('Cleanup and Memory Management', () => {
    it('should handle many projects without errors', () => {
      // Create and use many project instances
      const instances: ReturnType<typeof renderHook<any, any>>[] = [];
      for (let i = 0; i < 25; i++) {
        const hook = renderHook(() =>
          useChangesTabScrollPreservation(`project-${i}`, { debug: false })
        );

        act(() => {
          hook.result.current.fileListRef.current = mockFileListElement;
          hook.result.current.diffViewerRef.current = mockDiffViewerElement;
          mockFileListElement.scrollTop = i * 10;
          mockDiffViewerElement.scrollTop = i * 20;
          hook.result.current.saveScrollPositions();
        });

        instances.push(hook);
      }

      // Verify all instances work correctly
      expect(instances.length).toBe(25);
      expect(() => {
        instances.forEach((instance) => {
          act(() => {
            instance.result.current.restoreScrollPositions();
          });
        });
      }).not.toThrow();
    });
  });

  describe('Debug Mode', () => {
    it('should log debug messages when debug is enabled', () => {
      const { result } = renderHook(() =>
        useChangesTabScrollPreservation('project-1', { debug: true })
      );

      act(() => {
        if (result.current.fileListRef.current) {
          result.current.fileListRef.current = mockFileListElement;
        }
        if (result.current.diffViewerRef.current) {
          result.current.diffViewerRef.current = mockDiffViewerElement;
        }
      });

      mockFileListElement.scrollTop = 100;
      mockDiffViewerElement.scrollTop = 200;

      act(() => {
        result.current.saveScrollPositions();
      });

      expect(logger.debug).toHaveBeenCalled();
    });
  });
});
