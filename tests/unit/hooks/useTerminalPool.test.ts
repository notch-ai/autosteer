import { renderHook, act } from '@testing-library/react';
import { useTerminalPool } from '@/renderer/hooks/useTerminalPool';
import { TerminalPoolManager } from '@/renderer/services/TerminalPoolManager';
import { Terminal, TerminalBufferState } from '@/types/terminal.types';
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

describe('useTerminalPool', () => {
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

  const createMockBufferState = (terminalId: string): TerminalBufferState => ({
    terminalId,
    content: 'test content',
    scrollback: ['line1', 'line2', 'line3'],
    cursorX: 0,
    cursorY: 0,
    cols: 80,
    rows: 24,
    timestamp: new Date('2025-01-01T00:00:00Z'),
    sizeBytes: 1024,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock pool manager instance
    mockPoolManager = {
      createTerminal: jest.fn(),
      getTerminal: jest.fn(),
      hasTerminal: jest.fn(),
      attachTerminal: jest.fn(),
      detachTerminal: jest.fn(),
      focusTerminal: jest.fn(),
      blurTerminal: jest.fn(),
      fitTerminal: jest.fn(),
      resizeTerminal: jest.fn(),
      captureBufferState: jest.fn(),
      restoreBufferState: jest.fn(),
      destroyTerminal: jest.fn(),
      getPoolSize: jest.fn().mockReturnValue(0),
      getMaxPoolSize: jest.fn().mockReturnValue(10),
      getAllTerminalIds: jest.fn().mockReturnValue([]),
      getTerminalMetadata: jest.fn(),
      isTerminalAttached: jest.fn(),
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

      expect(logger.debug).toHaveBeenCalledWith('[useTerminalPool] Pool manager initialized');
    });
  });

  describe('Terminal Lifecycle Operations', () => {
    it('should create terminal', () => {
      const { result } = renderHook(() => useTerminalPool());
      const terminal = createMockTerminal('term1');
      const element = document.createElement('div');
      const mockAdapter = {} as any;

      mockPoolManager.createTerminal.mockReturnValue(mockAdapter);

      act(() => {
        result.current.createTerminal(terminal, element);
      });

      expect(mockPoolManager.createTerminal).toHaveBeenCalledWith(terminal, element);
      expect(logger.debug).toHaveBeenCalledWith(
        '[useTerminalPool] Creating terminal',
        expect.objectContaining({ terminalId: 'term1' })
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
        result.current.destroyTerminal('term1');
      });

      expect(mockPoolManager.destroyTerminal).toHaveBeenCalledWith('term1');
      expect(logger.debug).toHaveBeenCalledWith(
        '[useTerminalPool] Destroying terminal',
        expect.objectContaining({ terminalId: 'term1' })
      );
    });
  });

  describe('DOM Attachment Operations', () => {
    it('should attach terminal to element', () => {
      const { result } = renderHook(() => useTerminalPool());
      const element = document.createElement('div');

      act(() => {
        result.current.attachTerminal('term1', element);
      });

      expect(mockPoolManager.attachTerminal).toHaveBeenCalledWith('term1', element);
      expect(logger.debug).toHaveBeenCalledWith(
        '[useTerminalPool] Attaching terminal',
        expect.objectContaining({ terminalId: 'term1' })
      );
    });

    it('should detach terminal from DOM', () => {
      const { result } = renderHook(() => useTerminalPool());

      act(() => {
        result.current.detachTerminal('term1');
      });

      expect(mockPoolManager.detachTerminal).toHaveBeenCalledWith('term1');
      expect(logger.debug).toHaveBeenCalledWith(
        '[useTerminalPool] Detaching terminal',
        expect.objectContaining({ terminalId: 'term1' })
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

  describe('Buffer State Operations', () => {
    it('should capture buffer state', () => {
      const { result } = renderHook(() => useTerminalPool());
      const mockBufferState = createMockBufferState('term1');

      mockPoolManager.captureBufferState.mockReturnValue(mockBufferState);

      act(() => {
        const state = result.current.captureBufferState('term1');
        expect(state).toBe(mockBufferState);
      });

      expect(mockPoolManager.captureBufferState).toHaveBeenCalledWith('term1');
      expect(logger.debug).toHaveBeenCalledWith(
        '[useTerminalPool] Capturing buffer state',
        expect.objectContaining({ terminalId: 'term1' })
      );
    });

    it('should restore buffer state', () => {
      const { result } = renderHook(() => useTerminalPool());
      const mockBufferState = createMockBufferState('term1');

      act(() => {
        result.current.restoreBufferState('term1', mockBufferState);
      });

      expect(mockPoolManager.restoreBufferState).toHaveBeenCalledWith('term1', mockBufferState);
      expect(logger.debug).toHaveBeenCalledWith(
        '[useTerminalPool] Restoring buffer state',
        expect.objectContaining({ terminalId: 'term1' })
      );
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

    it('should get all terminal IDs', () => {
      const { result } = renderHook(() => useTerminalPool());

      mockPoolManager.getAllTerminalIds.mockReturnValue(['term1', 'term2', 'term3']);

      act(() => {
        const ids = result.current.getAllTerminalIds();
        expect(ids).toEqual(['term1', 'term2', 'term3']);
      });

      expect(mockPoolManager.getAllTerminalIds).toHaveBeenCalled();
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

    it('should check if terminal is attached', () => {
      const { result } = renderHook(() => useTerminalPool());

      mockPoolManager.isTerminalAttached.mockReturnValue(true);

      act(() => {
        const isAttached = result.current.isTerminalAttached('term1');
        expect(isAttached).toBe(true);
      });

      expect(mockPoolManager.isTerminalAttached).toHaveBeenCalledWith('term1');
    });

    it('should get pool stats', () => {
      const { result } = renderHook(() => useTerminalPool());

      mockPoolManager.getPoolSize.mockReturnValue(3);
      mockPoolManager.getMaxPoolSize.mockReturnValue(10);
      mockPoolManager.getAllTerminalIds.mockReturnValue(['term1', 'term2', 'term3']);

      act(() => {
        const stats = result.current.getPoolStats();

        expect(stats).toEqual({
          size: 3,
          maxSize: 10,
          terminalIds: ['term1', 'term2', 'term3'],
          availableSlots: 7,
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle pool limit errors with user-friendly message', () => {
      const { result } = renderHook(() => useTerminalPool());
      const terminal = createMockTerminal('term1');
      const element = document.createElement('div');

      mockPoolManager.createTerminal.mockImplementation(() => {
        throw new Error('Terminal pool limit reached (10)');
      });

      expect(() => {
        act(() => {
          result.current.createTerminal(terminal, element);
        });
      }).toThrow('Terminal pool limit reached (10)');

      expect(logger.error).toHaveBeenCalledWith(
        '[useTerminalPool] Failed to create terminal',
        expect.objectContaining({
          terminalId: 'term1',
          error: 'Terminal pool limit reached (10)',
        })
      );
    });

    it('should handle attach errors gracefully', () => {
      const { result } = renderHook(() => useTerminalPool());
      const element = document.createElement('div');

      mockPoolManager.attachTerminal.mockImplementation(() => {
        throw new Error('Terminal not found in pool: term1');
      });

      expect(() => {
        act(() => {
          result.current.attachTerminal('term1', element);
        });
      }).toThrow('Terminal not found in pool: term1');

      expect(logger.error).toHaveBeenCalledWith(
        '[useTerminalPool] Failed to attach terminal',
        expect.objectContaining({
          terminalId: 'term1',
          error: 'Terminal not found in pool: term1',
        })
      );
    });

    it('should handle detach errors gracefully', () => {
      const { result } = renderHook(() => useTerminalPool());

      mockPoolManager.detachTerminal.mockImplementation(() => {
        throw new Error('Terminal not found in pool: term1');
      });

      expect(() => {
        act(() => {
          result.current.detachTerminal('term1');
        });
      }).toThrow('Terminal not found in pool: term1');

      expect(logger.error).toHaveBeenCalledWith(
        '[useTerminalPool] Failed to detach terminal',
        expect.objectContaining({
          terminalId: 'term1',
          error: 'Terminal not found in pool: term1',
        })
      );
    });

    it('should handle destroy errors gracefully', () => {
      const { result } = renderHook(() => useTerminalPool());

      mockPoolManager.destroyTerminal.mockImplementation(() => {
        throw new Error('Terminal not found in pool: term1');
      });

      expect(() => {
        act(() => {
          result.current.destroyTerminal('term1');
        });
      }).toThrow('Terminal not found in pool: term1');

      expect(logger.error).toHaveBeenCalledWith(
        '[useTerminalPool] Failed to destroy terminal',
        expect.objectContaining({
          terminalId: 'term1',
          error: 'Terminal not found in pool: term1',
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
      const initialAttachTerminal = result.current.attachTerminal;
      const initialDetachTerminal = result.current.detachTerminal;

      rerender();

      expect(result.current.createTerminal).toBe(initialCreateTerminal);
      expect(result.current.attachTerminal).toBe(initialAttachTerminal);
      expect(result.current.detachTerminal).toBe(initialDetachTerminal);
    });
  });
});
