import { TerminalPoolManager } from '@/renderer/services/TerminalPoolManager';
import { Terminal, TerminalBufferState } from '@/types/terminal.types';
import { TerminalLibraryAdapter } from '@/renderer/services/TerminalLibraryAdapter';

// Mock TerminalLibraryAdapter
jest.mock('@/renderer/services/TerminalLibraryAdapter');

// Mock console methods
const mockConsole = {
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

global.console = mockConsole as any;

describe('TerminalPoolManager', () => {
  let poolManager: TerminalPoolManager;
  let mockAdapter: jest.Mocked<TerminalLibraryAdapter>;

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

    // Create mock adapter
    mockAdapter = {
      attach: jest.fn(),
      detach: jest.fn(),
      write: jest.fn(),
      writeln: jest.fn(),
      clear: jest.fn(),
      reset: jest.fn(),
      focus: jest.fn(),
      blur: jest.fn(),
      fit: jest.fn(),
      resize: jest.fn(),
      getDimensions: jest.fn().mockReturnValue({ cols: 80, rows: 24 }),
      getBufferState: jest.fn(),
      restoreBufferState: jest.fn(),
      registerEventHandlers: jest.fn(),
      search: jest.fn(),
      isTerminalDisposed: jest.fn().mockReturnValue(false),
      getXTermInstance: jest.fn(),
      dispose: jest.fn(),
    } as any;

    (TerminalLibraryAdapter as jest.MockedClass<typeof TerminalLibraryAdapter>).mockImplementation(
      () => mockAdapter
    );

    poolManager = new TerminalPoolManager();
  });

  describe('Initialization', () => {
    it('should initialize with empty pool', () => {
      expect(poolManager.getPoolSize()).toBe(0);
      expect(poolManager.getAllTerminalIds()).toEqual([]);
    });

    it('should log initialization', () => {
      expect(mockConsole.info).toHaveBeenCalledWith('[TerminalPoolManager] Initialized', {
        maxPoolSize: 10,
      });
    });

    it('should set max pool size to 10', () => {
      expect(poolManager.getMaxPoolSize()).toBe(10);
    });
  });

  describe('Terminal Instance Creation', () => {
    it('should create terminal instance', () => {
      const terminal = createMockTerminal('term1');
      const element = document.createElement('div');

      poolManager.createTerminal(terminal, element);

      expect(TerminalLibraryAdapter).toHaveBeenCalled();
      expect(mockAdapter.attach).toHaveBeenCalledWith(element);
      expect(poolManager.hasTerminal('term1')).toBe(true);
    });

    it('should store terminal instance in pool', () => {
      const terminal = createMockTerminal('term1');
      const element = document.createElement('div');

      poolManager.createTerminal(terminal, element);

      expect(poolManager.getPoolSize()).toBe(1);
      expect(poolManager.getAllTerminalIds()).toEqual(['term1']);
    });

    it('should throw error when max pool size reached', () => {
      // Create 10 terminals (max limit)
      for (let i = 0; i < 10; i++) {
        const terminal = createMockTerminal(`term${i}`);
        const element = document.createElement('div');
        poolManager.createTerminal(terminal, element);
      }

      // Try to create 11th terminal
      const terminal = createMockTerminal('term11');
      const element = document.createElement('div');

      expect(() => poolManager.createTerminal(terminal, element)).toThrow(
        'Terminal pool limit reached (10)'
      );
    });

    it('should log terminal creation', () => {
      const terminal = createMockTerminal('term1');
      const element = document.createElement('div');

      poolManager.createTerminal(terminal, element);

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[TerminalPoolManager] Terminal created',
        expect.objectContaining({ terminalId: 'term1' })
      );
    });
  });

  describe('Terminal Instance Retrieval', () => {
    beforeEach(() => {
      const element = document.createElement('div');
      poolManager.createTerminal(createMockTerminal('term1'), element);
      poolManager.createTerminal(createMockTerminal('term2'), element);
    });

    it('should get terminal instance', () => {
      const instance = poolManager.getTerminal('term1');

      expect(instance).toBe(mockAdapter);
    });

    it('should return undefined for non-existent terminal', () => {
      const instance = poolManager.getTerminal('nonexistent');

      expect(instance).toBeUndefined();
    });

    it('should check terminal existence', () => {
      expect(poolManager.hasTerminal('term1')).toBe(true);
      expect(poolManager.hasTerminal('nonexistent')).toBe(false);
    });

    it('should get all terminal IDs', () => {
      const ids = poolManager.getAllTerminalIds();

      expect(ids).toHaveLength(2);
      expect(ids).toContain('term1');
      expect(ids).toContain('term2');
    });

    it('should get pool size', () => {
      expect(poolManager.getPoolSize()).toBe(2);
    });
  });

  describe('Terminal Attachment/Detachment', () => {
    beforeEach(() => {
      const element = document.createElement('div');
      poolManager.createTerminal(createMockTerminal('term1'), element);
    });

    it('should attach terminal to element', () => {
      const element = document.createElement('div');

      poolManager.attachTerminal('term1', element);

      expect(mockAdapter.attach).toHaveBeenCalledWith(element);
    });

    it('should detach terminal', () => {
      poolManager.detachTerminal('term1');

      expect(mockAdapter.detach).toHaveBeenCalled();
    });

    it('should throw error when attaching non-existent terminal', () => {
      const element = document.createElement('div');

      expect(() => poolManager.attachTerminal('nonexistent', element)).toThrow(
        'Terminal not found in pool: nonexistent'
      );
    });

    it('should throw error when detaching non-existent terminal', () => {
      expect(() => poolManager.detachTerminal('nonexistent')).toThrow(
        'Terminal not found in pool: nonexistent'
      );
    });

    it('should log attachment', () => {
      const element = document.createElement('div');

      poolManager.attachTerminal('term1', element);

      expect(mockConsole.log).toHaveBeenCalledWith('[TerminalPoolManager] Terminal attached', {
        terminalId: 'term1',
        wasAttached: expect.any(Boolean),
      });
    });

    it('should log detachment', () => {
      poolManager.detachTerminal('term1');

      expect(mockConsole.log).toHaveBeenCalledWith('[TerminalPoolManager] Terminal detached', {
        terminalId: 'term1',
        wasAttached: expect.any(Boolean),
      });
    });
  });

  describe('Buffer State Management', () => {
    beforeEach(() => {
      const element = document.createElement('div');
      poolManager.createTerminal(createMockTerminal('term1'), element);
    });

    it('should capture buffer state', () => {
      const bufferState = createMockBufferState('term1');
      mockAdapter.getBufferState.mockReturnValue(bufferState);

      const captured = poolManager.captureBufferState('term1');

      expect(captured).toMatchObject({
        terminalId: bufferState.terminalId,
        content: bufferState.content,
        scrollback: bufferState.scrollback,
        cursorX: bufferState.cursorX,
        cursorY: bufferState.cursorY,
        cols: bufferState.cols,
        rows: bufferState.rows,
      });
      expect(mockAdapter.getBufferState).toHaveBeenCalled();
    });

    it('should restore buffer state', () => {
      const bufferState = createMockBufferState('term1');

      poolManager.restoreBufferState('term1', bufferState);

      expect(mockAdapter.restoreBufferState).toHaveBeenCalledWith(bufferState);
    });

    it('should throw error when capturing non-existent terminal', () => {
      expect(() => poolManager.captureBufferState('nonexistent')).toThrow(
        'Terminal not found in pool: nonexistent'
      );
    });

    it('should throw error when restoring non-existent terminal', () => {
      const bufferState = createMockBufferState('nonexistent');

      expect(() => poolManager.restoreBufferState('nonexistent', bufferState)).toThrow(
        'Terminal not found in pool: nonexistent'
      );
    });
  });

  describe('Terminal Destruction', () => {
    beforeEach(() => {
      const element = document.createElement('div');
      poolManager.createTerminal(createMockTerminal('term1'), element);
      poolManager.createTerminal(createMockTerminal('term2'), element);
    });

    it('should destroy terminal', () => {
      poolManager.destroyTerminal('term1');

      expect(mockAdapter.dispose).toHaveBeenCalled();
      expect(poolManager.hasTerminal('term1')).toBe(false);
      expect(poolManager.getPoolSize()).toBe(1);
    });

    it('should throw error when destroying non-existent terminal', () => {
      expect(() => poolManager.destroyTerminal('nonexistent')).toThrow(
        'Terminal not found in pool: nonexistent'
      );
    });

    it('should log destruction', () => {
      poolManager.destroyTerminal('term1');

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[TerminalPoolManager] Terminal destroyed',
        expect.objectContaining({ terminalId: 'term1' })
      );
    });
  });

  describe('Terminal Focus Management', () => {
    beforeEach(() => {
      const element = document.createElement('div');
      poolManager.createTerminal(createMockTerminal('term1'), element);
    });

    it('should focus terminal', () => {
      poolManager.focusTerminal('term1');

      expect(mockAdapter.focus).toHaveBeenCalled();
    });

    it('should blur terminal', () => {
      poolManager.blurTerminal('term1');

      expect(mockAdapter.blur).toHaveBeenCalled();
    });

    it('should throw error when focusing non-existent terminal', () => {
      expect(() => poolManager.focusTerminal('nonexistent')).toThrow(
        'Terminal not found in pool: nonexistent'
      );
    });
  });

  describe('Terminal Resize', () => {
    beforeEach(() => {
      const element = document.createElement('div');
      poolManager.createTerminal(createMockTerminal('term1'), element);
    });

    it('should fit terminal to container', () => {
      poolManager.fitTerminal('term1');

      expect(mockAdapter.fit).toHaveBeenCalled();
    });

    it('should resize terminal', () => {
      poolManager.resizeTerminal('term1', 100, 30);

      expect(mockAdapter.resize).toHaveBeenCalledWith(100, 30);
    });

    it('should throw error when resizing non-existent terminal', () => {
      expect(() => poolManager.fitTerminal('nonexistent')).toThrow(
        'Terminal not found in pool: nonexistent'
      );
    });
  });

  describe('Clear All Terminals', () => {
    beforeEach(() => {
      const element = document.createElement('div');
      for (let i = 0; i < 3; i++) {
        poolManager.createTerminal(createMockTerminal(`term${i}`), element);
      }
    });

    it('should clear all terminals', () => {
      poolManager.clearAll();

      expect(poolManager.getPoolSize()).toBe(0);
      expect(poolManager.getAllTerminalIds()).toEqual([]);
    });

    it('should dispose all terminal instances', () => {
      poolManager.clearAll();

      expect(mockAdapter.dispose).toHaveBeenCalledTimes(3);
    });

    it('should log clear operation', () => {
      poolManager.clearAll();

      expect(mockConsole.info).toHaveBeenCalledWith('[TerminalPoolManager] All terminals cleared', {
        count: 3,
      });
    });
  });

  describe('Performance Requirements', () => {
    it('should create terminal in <50ms', () => {
      const terminal = createMockTerminal('term1');
      const element = document.createElement('div');

      const start = performance.now();
      poolManager.createTerminal(terminal, element);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });

    it('should attach terminal in <10ms', () => {
      const terminal = createMockTerminal('term1');
      const element1 = document.createElement('div');
      const element2 = document.createElement('div');

      poolManager.createTerminal(terminal, element1);

      const start = performance.now();
      poolManager.attachTerminal('term1', element2);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
    });

    it('should detach terminal in <5ms', () => {
      const terminal = createMockTerminal('term1');
      const element = document.createElement('div');

      poolManager.createTerminal(terminal, element);

      const start = performance.now();
      poolManager.detachTerminal('term1');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5);
    });

    it('should destroy terminal in <20ms', () => {
      const terminal = createMockTerminal('term1');
      const element = document.createElement('div');

      poolManager.createTerminal(terminal, element);

      const start = performance.now();
      poolManager.destroyTerminal('term1');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(20);
    });
  });

  describe('Pool Limit Enforcement', () => {
    it('should enforce 10 terminal limit', () => {
      const element = document.createElement('div');

      // Create max terminals
      for (let i = 0; i < 10; i++) {
        poolManager.createTerminal(createMockTerminal(`term${i}`), element);
      }

      expect(poolManager.getPoolSize()).toBe(10);
      expect(() => poolManager.createTerminal(createMockTerminal('term11'), element)).toThrow();
    });

    it('should allow creation after destruction', () => {
      const element = document.createElement('div');

      // Fill to max
      for (let i = 0; i < 10; i++) {
        poolManager.createTerminal(createMockTerminal(`term${i}`), element);
      }

      // Destroy one
      poolManager.destroyTerminal('term0');

      // Should allow new creation
      expect(() => poolManager.createTerminal(createMockTerminal('term11'), element)).not.toThrow();
      expect(poolManager.getPoolSize()).toBe(10);
    });
  });

  describe('Error Handling', () => {
    it('should handle adapter creation failure', () => {
      (
        TerminalLibraryAdapter as jest.MockedClass<typeof TerminalLibraryAdapter>
      ).mockImplementation(() => {
        throw new Error('Adapter creation failed');
      });

      const terminal = createMockTerminal('term1');
      const element = document.createElement('div');

      expect(() => poolManager.createTerminal(terminal, element)).toThrow(
        'Adapter creation failed'
      );
    });

    it('should handle disposal errors gracefully', () => {
      const element = document.createElement('div');
      poolManager.createTerminal(createMockTerminal('term1'), element);

      mockAdapter.dispose.mockImplementation(() => {
        throw new Error('Disposal error');
      });

      expect(() => poolManager.destroyTerminal('term1')).toThrow('Disposal error');
    });
  });
});
