import { renderHook, act } from '@testing-library/react';
import {
  useTerminalPool,
  __resetGlobalPoolManagerForTesting,
} from '@/renderer/hooks/useTerminalPool';
import { TerminalPoolManager } from '@/renderer/services/TerminalPoolManager';
import { Terminal } from '@/types/terminal.types';
import { logger } from '@/commons/utils/logger';

// Mock TerminalPoolManager
jest.mock('@/renderer/services/TerminalPoolManager');

// Mock logger
jest.mock('@/commons/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('useTerminalPool - Z-Index Stacking Pattern', () => {
  let mockPoolManager: jest.Mocked<TerminalPoolManager>;

  const createMockTerminal = (id: string): Terminal => ({
    id,
    pid: 12345,
    title: `Terminal ${id}`,
    isActive: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    lastAccessed: new Date('2025-01-01T00:00:00Z'),
    shell: '/bin/bash',
    cwd: '/home/user',
    size: { cols: 80, rows: 24 },
    status: 'running',
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset global singleton for test isolation
    __resetGlobalPoolManagerForTesting();

    // Create mock pool manager instance (simplified API - no attach/detach/capture/restore)
    mockPoolManager = {
      createTerminal: jest.fn(),
      getTerminal: jest.fn(),
      hasTerminal: jest.fn(),
      focusTerminal: jest.fn(),
      blurTerminal: jest.fn(),
      fitTerminal: jest.fn(),
      resizeTerminal: jest.fn(),
      scrollToTop: jest.fn(),
      scrollToBottom: jest.fn(),
      destroyTerminal: jest.fn(),
      getPoolSize: jest.fn().mockReturnValue(0),
      getMaxPoolSize: jest.fn().mockReturnValue(10),
      getAllProjectIds: jest.fn().mockReturnValue([]),
      getTerminalId: jest.fn(),
      getTerminalMetadata: jest.fn(),
      clearAll: jest.fn(),
    } as any;

    (TerminalPoolManager as jest.MockedClass<typeof TerminalPoolManager>).mockImplementation(
      () => mockPoolManager
    );
  });

  describe('Hook Initialization', () => {
    it('should initialize pool manager singleton', () => {
      const { result } = renderHook(() => useTerminalPool());

      expect(TerminalPoolManager).toHaveBeenCalledTimes(1);
      expect(result.current).toBeDefined();
    });

    it('should reuse same pool manager instance across renders', () => {
      const { rerender } = renderHook(() => useTerminalPool());

      rerender();
      rerender();

      expect(TerminalPoolManager).toHaveBeenCalledTimes(1);
    });

    it('should log initialization', () => {
      renderHook(() => useTerminalPool());

      expect(logger.debug).toHaveBeenCalledWith(
        '[useTerminalPool] 🌍 Global TerminalPoolManager created'
      );
    });
  });

  describe('Terminal Lifecycle Operations', () => {
    it('should create terminal', () => {
      const { result } = renderHook(() => useTerminalPool());
      const projectId = 'project1';
      const terminal = createMockTerminal('term1');
      const element = document.createElement('div');
      const mockAdapter = {} as any;

      mockPoolManager.createTerminal.mockReturnValue(mockAdapter);

      act(() => {
        result.current.createTerminal(projectId, terminal, element);
      });

      expect(mockPoolManager.createTerminal).toHaveBeenCalledWith(projectId, terminal, element);
      expect(logger.debug).toHaveBeenCalledWith(
        '[useTerminalPool] Creating terminal',
        expect.objectContaining({ projectId, terminalId: 'term1' })
      );
    });

    it('should get terminal from pool', () => {
      const { result } = renderHook(() => useTerminalPool());
      const mockAdapter = {} as any;

      mockPoolManager.getTerminal.mockReturnValue(mockAdapter);

      act(() => {
        const adapter = result.current.getTerminal('term1');
        expect(adapter).toBe(mockAdapter);
      });

      expect(mockPoolManager.getTerminal).toHaveBeenCalledWith('term1');
    });

    it('should check if terminal exists', () => {
      const { result } = renderHook(() => useTerminalPool());

      mockPoolManager.hasTerminal.mockReturnValue(true);

      act(() => {
        const exists = result.current.hasTerminal('term1');
        expect(exists).toBe(true);
      });

      expect(mockPoolManager.hasTerminal).toHaveBeenCalledWith('term1');
    });

    it('should destroy terminal', () => {
      const { result } = renderHook(() => useTerminalPool());

      act(() => {
        result.current.destroyTerminal('project1');
      });

      expect(mockPoolManager.destroyTerminal).toHaveBeenCalledWith('project1');
      expect(logger.debug).toHaveBeenCalledWith(
        '[useTerminalPool] Destroying terminal',
        expect.objectContaining({ projectId: 'project1' })
      );
    });
  });

  describe('Terminal Control Operations', () => {
    it('should focus terminal', () => {
      const { result } = renderHook(() => useTerminalPool());

      act(() => {
        result.current.focusTerminal('term1');
      });

      expect(mockPoolManager.focusTerminal).toHaveBeenCalledWith('term1');
    });

    it('should blur terminal', () => {
      const { result } = renderHook(() => useTerminalPool());

      act(() => {
        result.current.blurTerminal('term1');
      });

      expect(mockPoolManager.blurTerminal).toHaveBeenCalledWith('term1');
    });

    it('should fit terminal to container', () => {
      const { result } = renderHook(() => useTerminalPool());

      act(() => {
        result.current.fitTerminal('term1');
      });

      expect(mockPoolManager.fitTerminal).toHaveBeenCalledWith('term1');
    });

    it('should resize terminal', () => {
      const { result } = renderHook(() => useTerminalPool());

      act(() => {
        result.current.resizeTerminal('term1', 100, 30);
      });

      expect(mockPoolManager.resizeTerminal).toHaveBeenCalledWith('term1', 100, 30);
    });
  });

  describe('Pool Information Operations', () => {
    it('should get pool size', () => {
      const { result } = renderHook(() => useTerminalPool());

      mockPoolManager.getPoolSize.mockReturnValue(5);

      act(() => {
        const size = result.current.getPoolSize();
        expect(size).toBe(5);
      });

      expect(mockPoolManager.getPoolSize).toHaveBeenCalled();
    });

    it('should get max pool size', () => {
      const { result } = renderHook(() => useTerminalPool());

      mockPoolManager.getMaxPoolSize.mockReturnValue(10);

      act(() => {
        const maxSize = result.current.getMaxPoolSize();
        expect(maxSize).toBe(10);
      });

      expect(mockPoolManager.getMaxPoolSize).toHaveBeenCalled();
    });

    it('should get all project IDs', () => {
      const { result } = renderHook(() => useTerminalPool());

      mockPoolManager.getAllProjectIds.mockReturnValue(['project1', 'project2', 'project3']);

      act(() => {
        const ids = result.current.getAllProjectIds();
        expect(ids).toEqual(['project1', 'project2', 'project3']);
      });

      expect(mockPoolManager.getAllProjectIds).toHaveBeenCalled();
    });

    it('should get terminal metadata', () => {
      const { result } = renderHook(() => useTerminalPool());
      const terminal = createMockTerminal('term1');

      mockPoolManager.getTerminalMetadata.mockReturnValue(terminal);

      act(() => {
        const metadata = result.current.getTerminalMetadata('term1');
        expect(metadata).toBe(terminal);
      });

      expect(mockPoolManager.getTerminalMetadata).toHaveBeenCalledWith('term1');
    });

    it('should get pool stats', () => {
      const { result } = renderHook(() => useTerminalPool());

      mockPoolManager.getPoolSize.mockReturnValue(3);
      mockPoolManager.getMaxPoolSize.mockReturnValue(10);
      mockPoolManager.getAllProjectIds.mockReturnValue(['project1', 'project2', 'project3']);

      act(() => {
        const stats = result.current.getPoolStats();

        expect(stats).toEqual({
          size: 3,
          maxSize: 10,
          terminalIds: ['project1', 'project2', 'project3'],
          availableSlots: 7,
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle pool limit errors with user-friendly message', () => {
      const projectId = 'project1';
      const terminal = createMockTerminal('term1');
      const element = document.createElement('div');

      mockPoolManager.createTerminal.mockImplementation(() => {
        throw new Error('Terminal pool limit reached (10)');
      });

      const { result } = renderHook(() => useTerminalPool());

      expect(() => {
        act(() => {
          result.current.createTerminal(projectId, terminal, element);
        });
      }).toThrow('Terminal pool limit reached (10)');

      expect(logger.error).toHaveBeenCalledWith(
        '[useTerminalPool] Failed to create terminal',
        expect.objectContaining({
          projectId,
          terminalId: 'term1',
          error: 'Terminal pool limit reached (10)',
        })
      );
    });

    it('should handle destroy errors gracefully', () => {
      mockPoolManager.destroyTerminal.mockImplementation(() => {
        throw new Error('Terminal not found in pool: project1');
      });

      const { result } = renderHook(() => useTerminalPool());

      expect(() => {
        act(() => {
          result.current.destroyTerminal('project1');
        });
      }).toThrow('Terminal not found in pool: project1');

      expect(logger.error).toHaveBeenCalledWith(
        '[useTerminalPool] Failed to destroy terminal',
        expect.objectContaining({
          projectId: 'project1',
          error: 'Terminal not found in pool: project1',
        })
      );
    });
  });

  describe('Hook Cleanup', () => {
    it('should log on unmount without clearing pool', () => {
      const { unmount } = renderHook(() => useTerminalPool());

      unmount();

      expect(logger.debug).toHaveBeenCalledWith(
        '[useTerminalPool] Hook unmounting (pool persists)'
      );
      expect(mockPoolManager.clearAll).not.toHaveBeenCalled();
    });
  });

  describe('Callback Stability', () => {
    it('should maintain callback references across renders', () => {
      const { result, rerender } = renderHook(() => useTerminalPool());

      const initialCreateTerminal = result.current.createTerminal;
      const initialDestroyTerminal = result.current.destroyTerminal;
      const initialFocusTerminal = result.current.focusTerminal;

      rerender();

      expect(result.current.createTerminal).toBe(initialCreateTerminal);
      expect(result.current.destroyTerminal).toBe(initialDestroyTerminal);
      expect(result.current.focusTerminal).toBe(initialFocusTerminal);
    });
  });

  describe('Scroll Operations', () => {
    it('should scroll terminal to top', () => {
      const { result } = renderHook(() => useTerminalPool());

      act(() => {
        result.current.scrollToTop('project1');
      });

      expect(mockPoolManager.scrollToTop).toHaveBeenCalledWith('project1');
      expect(logger.debug).toHaveBeenCalledWith(
        '[useTerminalPool] Scrolling terminal to top',
        expect.objectContaining({ projectId: 'project1' })
      );
    });

    it('should scroll terminal to bottom', () => {
      const { result } = renderHook(() => useTerminalPool());

      act(() => {
        result.current.scrollToBottom('project1');
      });

      expect(mockPoolManager.scrollToBottom).toHaveBeenCalledWith('project1');
      expect(logger.debug).toHaveBeenCalledWith(
        '[useTerminalPool] Scrolling terminal to bottom',
        expect.objectContaining({ projectId: 'project1' })
      );
    });

    it('should handle scroll to top errors', () => {
      mockPoolManager.scrollToTop.mockImplementation(() => {
        throw new Error('No terminal found for project: project1');
      });

      const { result } = renderHook(() => useTerminalPool());

      expect(() => {
        act(() => {
          result.current.scrollToTop('project1');
        });
      }).toThrow('No terminal found for project: project1');

      expect(logger.error).toHaveBeenCalledWith(
        '[useTerminalPool] Failed to scroll terminal to top',
        expect.objectContaining({
          projectId: 'project1',
          error: 'No terminal found for project: project1',
        })
      );
    });

    it('should handle scroll to bottom errors', () => {
      mockPoolManager.scrollToBottom.mockImplementation(() => {
        throw new Error('No terminal found for project: project1');
      });

      const { result } = renderHook(() => useTerminalPool());

      expect(() => {
        act(() => {
          result.current.scrollToBottom('project1');
        });
      }).toThrow('No terminal found for project: project1');

      expect(logger.error).toHaveBeenCalledWith(
        '[useTerminalPool] Failed to scroll terminal to bottom',
        expect.objectContaining({
          projectId: 'project1',
          error: 'No terminal found for project: project1',
        })
      );
    });
  });
});
