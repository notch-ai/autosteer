import { TerminalPoolManager } from '@/renderer/services/TerminalPoolManager';
import { Terminal } from '@/types/terminal.types';
import { TerminalLibraryAdapter } from '@/renderer/services/TerminalLibraryAdapter';

// Mock TerminalLibraryAdapter
jest.mock('@/renderer/services/TerminalLibraryAdapter');

describe('TerminalPoolManager - Z-Index Stacking', () => {
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

  // Helper: Map terminal ID to project ID (backwards compat)
  const getProjectId = (termId: string): string => `project-${termId}`;

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
      expect(poolManager.getAllProjectIds()).toEqual([]);
    });

    it('should set max pool size to 10', () => {
      expect(poolManager.getMaxPoolSize()).toBe(10);
    });
  });

  describe('Terminal Instance Creation', () => {
    it('should create terminal instance', () => {
      const terminal = createMockTerminal('term1');
      const element = document.createElement('div');

      poolManager.createTerminal(getProjectId('term1'), terminal, element);

      expect(TerminalLibraryAdapter).toHaveBeenCalled();
      expect(mockAdapter.attach).toHaveBeenCalledWith(element);
      expect(poolManager.hasTerminal(getProjectId('term1'))).toBe(true);
    });

    it('should store terminal instance in pool', () => {
      const terminal = createMockTerminal('term1');
      const element = document.createElement('div');

      poolManager.createTerminal(getProjectId('term1'), terminal, element);

      expect(poolManager.getPoolSize()).toBe(1);
      expect(poolManager.getAllProjectIds()).toEqual([getProjectId('term1')]);
    });

    it('should throw error when max pool size reached', () => {
      // Create 10 terminals (max limit)
      for (let i = 0; i < 10; i++) {
        const terminal = createMockTerminal(`term${i}`);
        const element = document.createElement('div');
        poolManager.createTerminal(getProjectId(`term${i}`), terminal, element);
      }

      // Try to create 11th terminal
      const terminal = createMockTerminal('term11');
      const element = document.createElement('div');

      expect(() => poolManager.createTerminal(getProjectId('term11'), terminal, element)).toThrow(
        'Terminal pool limit reached (10)'
      );
    });
  });

  describe('Terminal Instance Retrieval', () => {
    beforeEach(() => {
      const element = document.createElement('div');
      poolManager.createTerminal(getProjectId('term1'), createMockTerminal('term1'), element);
      poolManager.createTerminal(getProjectId('term2'), createMockTerminal('term2'), element);
    });

    it('should get terminal instance', () => {
      const instance = poolManager.getTerminal(getProjectId('term1'));

      expect(instance).toBe(mockAdapter);
    });

    it('should return undefined for non-existent terminal', () => {
      const instance = poolManager.getTerminal(getProjectId('nonexistent'));

      expect(instance).toBeUndefined();
    });

    it('should check terminal existence', () => {
      expect(poolManager.hasTerminal(getProjectId('term1'))).toBe(true);
      expect(poolManager.hasTerminal(getProjectId('nonexistent'))).toBe(false);
    });

    it('should get all terminal IDs', () => {
      const ids = poolManager.getAllProjectIds();

      expect(ids).toHaveLength(2);
      expect(ids).toContain(getProjectId('term1'));
      expect(ids).toContain(getProjectId('term2'));
    });

    it('should get pool size', () => {
      expect(poolManager.getPoolSize()).toBe(2);
    });
  });

  describe('Terminal Destruction', () => {
    beforeEach(() => {
      const element = document.createElement('div');
      poolManager.createTerminal(getProjectId('term1'), createMockTerminal('term1'), element);
      poolManager.createTerminal(getProjectId('term2'), createMockTerminal('term2'), element);
    });

    it('should destroy terminal', () => {
      poolManager.destroyTerminal(getProjectId('term1'));

      expect(mockAdapter.dispose).toHaveBeenCalled();
      expect(poolManager.hasTerminal(getProjectId('term1'))).toBe(false);
      expect(poolManager.getPoolSize()).toBe(1);
    });

    it('should throw error when destroying non-existent terminal', () => {
      expect(() => poolManager.destroyTerminal(getProjectId('nonexistent'))).toThrow(
        'No terminal found for project: project-nonexistent'
      );
    });
  });

  describe('Terminal Focus Management', () => {
    beforeEach(() => {
      const element = document.createElement('div');
      poolManager.createTerminal(getProjectId('term1'), createMockTerminal('term1'), element);
    });

    it('should focus terminal', () => {
      poolManager.focusTerminal(getProjectId('term1'));

      expect(mockAdapter.focus).toHaveBeenCalled();
    });

    it('should blur terminal', () => {
      poolManager.blurTerminal(getProjectId('term1'));

      expect(mockAdapter.blur).toHaveBeenCalled();
    });

    it('should throw error when focusing non-existent terminal', () => {
      expect(() => poolManager.focusTerminal(getProjectId('nonexistent'))).toThrow(
        'No terminal found for project: project-nonexistent'
      );
    });
  });

  describe('Terminal Resize', () => {
    beforeEach(() => {
      const element = document.createElement('div');
      poolManager.createTerminal(getProjectId('term1'), createMockTerminal('term1'), element);
    });

    it('should fit terminal to container', () => {
      poolManager.fitTerminal(getProjectId('term1'));

      expect(mockAdapter.fit).toHaveBeenCalled();
    });

    it('should resize terminal', () => {
      poolManager.resizeTerminal(getProjectId('term1'), 100, 30);

      expect(mockAdapter.resize).toHaveBeenCalledWith(100, 30);
    });

    it('should throw error when resizing non-existent terminal', () => {
      expect(() => poolManager.fitTerminal(getProjectId('nonexistent'))).toThrow(
        'No terminal found for project: project-nonexistent'
      );
    });
  });

  describe('Clear All Terminals', () => {
    beforeEach(() => {
      const element = document.createElement('div');
      for (let i = 0; i < 3; i++) {
        poolManager.createTerminal(
          getProjectId(`term${i}`),
          createMockTerminal(`term${i}`),
          element
        );
      }
    });

    it('should clear all terminals', () => {
      poolManager.clearAll();

      expect(poolManager.getPoolSize()).toBe(0);
      expect(poolManager.getAllProjectIds()).toEqual([]);
    });

    it('should dispose all terminal instances', () => {
      poolManager.clearAll();

      expect(mockAdapter.dispose).toHaveBeenCalledTimes(3);
    });
  });

  describe('Performance Requirements', () => {
    it('should create terminal in <50ms', () => {
      const terminal = createMockTerminal('term1');
      const element = document.createElement('div');

      const start = performance.now();
      poolManager.createTerminal(getProjectId('term1'), terminal, element);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });

    it('should destroy terminal in <20ms', () => {
      const terminal = createMockTerminal('term1');
      const element = document.createElement('div');

      poolManager.createTerminal(getProjectId('term1'), terminal, element);

      const start = performance.now();
      poolManager.destroyTerminal(getProjectId('term1'));
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(20);
    });
  });

  describe('Pool Limit Enforcement', () => {
    it('should enforce 10 terminal limit', () => {
      const element = document.createElement('div');

      // Create max terminals
      for (let i = 0; i < 10; i++) {
        poolManager.createTerminal(
          getProjectId(`term${i}`),
          createMockTerminal(`term${i}`),
          element
        );
      }

      expect(poolManager.getPoolSize()).toBe(10);
      expect(() =>
        poolManager.createTerminal(getProjectId('term11'), createMockTerminal('term11'), element)
      ).toThrow();
    });

    it('should allow creation after destruction', () => {
      const element = document.createElement('div');

      // Fill to max
      for (let i = 0; i < 10; i++) {
        poolManager.createTerminal(
          getProjectId(`term${i}`),
          createMockTerminal(`term${i}`),
          element
        );
      }

      // Destroy one
      poolManager.destroyTerminal(getProjectId('term0'));

      // Should allow new creation
      expect(() =>
        poolManager.createTerminal(getProjectId('term11'), createMockTerminal('term11'), element)
      ).not.toThrow();
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

      expect(() => poolManager.createTerminal(getProjectId('term1'), terminal, element)).toThrow(
        'Adapter creation failed'
      );
    });

    it('should handle disposal errors gracefully', () => {
      const element = document.createElement('div');
      poolManager.createTerminal(getProjectId('term1'), createMockTerminal('term1'), element);

      mockAdapter.dispose.mockImplementation(() => {
        throw new Error('Disposal error');
      });

      expect(() => poolManager.destroyTerminal(getProjectId('term1'))).toThrow('Disposal error');
    });
  });
});
