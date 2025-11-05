/**
 * Terminal Store Tests
 * Tests all actions with 100% coverage following TRD requirements
 */

// Mock electron-log/renderer before any imports
jest.mock('electron-log/renderer', () => {
  const mockLog: any = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    silly: jest.fn(),
    log: jest.fn(),
    transports: {
      file: {
        level: false,
        format: '',
        maxSize: 0,
      },
      console: {
        level: false,
        format: '',
      },
    },
    initialize: jest.fn(),
    scope: jest.fn(function (this: any) {
      return this;
    }),
  };
  return { __esModule: true, default: mockLog };
});

import { useTerminalStore, clearTerminalCaches } from '@/stores';
import { Terminal, TerminalBufferState, TerminalSessionState } from '@/types/terminal.types';

// Helper function to create a complete Terminal object with default values
const createMockTerminal = (overrides: Partial<Terminal> = {}): Terminal => ({
  id: 'term-1',
  pid: 1234,
  title: 'Terminal 1',
  isActive: false,
  createdAt: new Date(),
  lastAccessed: new Date(),
  shell: '/bin/bash',
  cwd: '/home/user',
  size: { cols: 80, rows: 24 },
  status: 'running',
  ...overrides,
});

describe('TerminalStore', () => {
  beforeEach(() => {
    // Reset store state
    useTerminalStore.setState({
      terminals: new Map(),
      activeTerminalId: null,
      maxTerminals: 10,
    });

    // Clear all external caches
    clearTerminalCaches();

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('State Initialization', () => {
    it('should initialize with empty state', () => {
      const state = useTerminalStore.getState();
      expect(state.terminals).toBeInstanceOf(Map);
      expect(state.terminals.size).toBe(0);
      expect(state.activeTerminalId).toBeNull();
      expect(state.maxTerminals).toBe(10);
    });
  });

  describe('Actions - addTerminal', () => {
    it('should add terminal successfully', () => {
      const terminal = createMockTerminal();

      useTerminalStore.getState().addTerminal(terminal);

      const state = useTerminalStore.getState();
      expect(state.terminals.get('term-1')).toEqual(terminal);
      expect(state.terminals.size).toBe(1);
    });

    it('should set first terminal as active', () => {
      const terminal = createMockTerminal();

      useTerminalStore.getState().addTerminal(terminal);

      const state = useTerminalStore.getState();
      expect(state.activeTerminalId).toBe('term-1');
    });

    it('should not change active terminal when adding second terminal', () => {
      const terminal1 = createMockTerminal({ id: 'term-1' });
      const terminal2 = createMockTerminal({ id: 'term-2' });

      useTerminalStore.getState().addTerminal(terminal1);
      useTerminalStore.getState().addTerminal(terminal2);

      const state = useTerminalStore.getState();
      expect(state.activeTerminalId).toBe('term-1');
      expect(state.terminals.size).toBe(2);
    });

    it('should throw error when max terminals reached', () => {
      // Add 10 terminals (max limit)
      for (let i = 0; i < 10; i++) {
        useTerminalStore.getState().addTerminal(
          createMockTerminal({
            id: `term-${i}`,
            pid: 1000 + i,
            title: `Terminal ${i}`,
          })
        );
      }

      // Try to add 11th terminal
      expect(() => {
        useTerminalStore.getState().addTerminal(createMockTerminal({ id: 'term-11' }));
      }).toThrow('Maximum terminal limit reached (10)');
    });
  });

  describe('Actions - removeTerminal', () => {
    it('should remove terminal successfully', () => {
      const terminal = createMockTerminal();

      useTerminalStore.setState({
        terminals: new Map([[terminal.id, terminal]]),
        activeTerminalId: 'term-1',
      });

      useTerminalStore.getState().removeTerminal('term-1');

      const state = useTerminalStore.getState();
      expect(state.terminals.get('term-1')).toBeUndefined();
      expect(state.terminals.size).toBe(0);
    });

    it('should set active terminal to first available when removing active terminal', () => {
      const terminal1 = createMockTerminal({ id: 'term-1' });
      const terminal2 = createMockTerminal({ id: 'term-2' });

      useTerminalStore.setState({
        terminals: new Map([
          [terminal1.id, terminal1],
          [terminal2.id, terminal2],
        ]),
        activeTerminalId: 'term-1',
      });

      useTerminalStore.getState().removeTerminal('term-1');

      const state = useTerminalStore.getState();
      expect(state.activeTerminalId).toBe('term-2');
    });

    it('should set active terminal to null when removing last terminal', () => {
      const terminal = createMockTerminal();

      useTerminalStore.setState({
        terminals: new Map([[terminal.id, terminal]]),
        activeTerminalId: 'term-1',
      });

      useTerminalStore.getState().removeTerminal('term-1');

      const state = useTerminalStore.getState();
      expect(state.activeTerminalId).toBeNull();
    });

    it('should not change active terminal when removing non-active terminal', () => {
      const terminal1 = createMockTerminal({ id: 'term-1' });
      const terminal2 = createMockTerminal({ id: 'term-2' });

      useTerminalStore.setState({
        terminals: new Map([
          [terminal1.id, terminal1],
          [terminal2.id, terminal2],
        ]),
        activeTerminalId: 'term-1',
      });

      useTerminalStore.getState().removeTerminal('term-2');

      const state = useTerminalStore.getState();
      expect(state.activeTerminalId).toBe('term-1');
    });
  });

  describe('Actions - updateTerminal', () => {
    it('should update terminal successfully', () => {
      const terminal = createMockTerminal();

      useTerminalStore.setState({
        terminals: new Map([[terminal.id, terminal]]),
      });

      useTerminalStore.getState().updateTerminal('term-1', { title: 'Updated Terminal' });

      const state = useTerminalStore.getState();
      const updated = state.terminals.get('term-1');
      expect(updated?.title).toBe('Updated Terminal');
      expect(updated?.id).toBe('term-1');
    });

    it('should handle updating non-existent terminal gracefully', () => {
      expect(() =>
        useTerminalStore.getState().updateTerminal('non-existent', { title: 'Test' })
      ).not.toThrow();
    });
  });

  describe('Actions - setActiveTerminal', () => {
    it('should set active terminal', () => {
      useTerminalStore.getState().setActiveTerminal('term-1');

      const state = useTerminalStore.getState();
      expect(state.activeTerminalId).toBe('term-1');
    });

    it('should set active terminal to null', () => {
      useTerminalStore.setState({ activeTerminalId: 'term-1' });

      useTerminalStore.getState().setActiveTerminal(null);

      const state = useTerminalStore.getState();
      expect(state.activeTerminalId).toBeNull();
    });
  });

  describe('Selectors - getTerminal', () => {
    it('should get terminal by ID', () => {
      const terminal = createMockTerminal();

      useTerminalStore.setState({
        terminals: new Map([[terminal.id, terminal]]),
      });

      const state = useTerminalStore.getState();
      const result = state.getTerminal('term-1');
      expect(result).toEqual(terminal);
    });

    it('should return undefined for non-existent terminal', () => {
      const state = useTerminalStore.getState();
      const result = state.getTerminal('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('Selectors - getTerminalCount', () => {
    it('should return correct terminal count', () => {
      const terminals = new Map([
        ['term-1', createMockTerminal({ id: 'term-1', pid: 1234, title: 'Terminal 1' })],
        ['term-2', createMockTerminal({ id: 'term-2', pid: 5678, title: 'Terminal 2' })],
      ]);

      useTerminalStore.setState({ terminals });

      const state = useTerminalStore.getState();
      expect(state.getTerminalCount()).toBe(2);
    });

    it('should return 0 when no terminals', () => {
      const state = useTerminalStore.getState();
      expect(state.getTerminalCount()).toBe(0);
    });
  });

  describe('Selectors - canCreateTerminal', () => {
    it('should return true when under limit', () => {
      const state = useTerminalStore.getState();
      expect(state.canCreateTerminal()).toBe(true);
    });

    it('should return false when at limit', () => {
      const terminals = new Map();
      for (let i = 0; i < 10; i++) {
        terminals.set(
          `term-${i}`,
          createMockTerminal({
            id: `term-${i}`,
            pid: 1000 + i,
            title: `Terminal ${i}`,
          })
        );
      }

      useTerminalStore.setState({ terminals });

      const state = useTerminalStore.getState();
      expect(state.canCreateTerminal()).toBe(false);
    });
  });

  describe('Actions - clearTerminals', () => {
    it('should clear all terminals', () => {
      const terminals = new Map([
        ['term-1', createMockTerminal({ id: 'term-1', pid: 1234, title: 'Terminal 1' })],
        ['term-2', createMockTerminal({ id: 'term-2', pid: 5678, title: 'Terminal 2' })],
      ]);

      useTerminalStore.setState({
        terminals,
        activeTerminalId: 'term-1',
      });

      useTerminalStore.getState().clearTerminals();

      const state = useTerminalStore.getState();
      expect(state.terminals.size).toBe(0);
      expect(state.activeTerminalId).toBeNull();
    });
  });

  describe('Session Actions - saveTerminalSession', () => {
    it('should save terminal session', () => {
      const session = {
        terminal: createMockTerminal({ id: 'term-1', pid: 1234, title: 'Terminal 1' }),
        terminalId: 'term-1',
        lastActive: new Date(),
        ownerProjectId: 'proj-1',
      };

      const state = useTerminalStore.getState();
      state.saveTerminalSession('proj-1', session);

      const retrieved = state.getTerminalSession('proj-1');
      expect(retrieved?.terminalId).toBe('term-1');
    });
  });

  describe('Session Actions - getTerminalSession', () => {
    it('should get terminal session', () => {
      const session = {
        terminal: createMockTerminal({ id: 'term-1', pid: 1234, title: 'Terminal 1' }),
        terminalId: 'term-1',
        lastActive: new Date(),
        ownerProjectId: 'proj-1',
      };

      const state = useTerminalStore.getState();
      state.saveTerminalSession('proj-1', session);

      const retrieved = state.getTerminalSession('proj-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.terminalId).toBe('term-1');
    });

    it('should return undefined for non-existent session', () => {
      const state = useTerminalStore.getState();
      const retrieved = state.getTerminalSession('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Session Actions - removeTerminalSession', () => {
    it('should remove terminal session', () => {
      const session = {
        terminal: createMockTerminal({ id: 'term-1', pid: 1234, title: 'Terminal 1' }),
        terminalId: 'term-1',
        lastActive: new Date(),
        ownerProjectId: 'proj-1',
      };

      const state = useTerminalStore.getState();
      state.saveTerminalSession('proj-1', session);
      state.removeTerminalSession('proj-1');

      const retrieved = state.getTerminalSession('proj-1');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Session Actions - hasTerminalSession', () => {
    it('should return true when session exists', () => {
      const session = {
        terminal: createMockTerminal({ id: 'term-1', pid: 1234, title: 'Terminal 1' }),
        terminalId: 'term-1',
        lastActive: new Date(),
        ownerProjectId: 'proj-1',
      };

      const state = useTerminalStore.getState();
      state.saveTerminalSession('proj-1', session);

      expect(state.hasTerminalSession('proj-1')).toBe(true);
    });

    it('should return false when session does not exist', () => {
      const state = useTerminalStore.getState();
      expect(state.hasTerminalSession('non-existent')).toBe(false);
    });
  });

  describe('Buffer State Actions - saveBufferState', () => {
    it('should save buffer state', () => {
      const bufferState: TerminalBufferState = {
        terminalId: 'term-1',
        content: 'test output',
        scrollback: [],
        cols: 80,
        rows: 24,
        cursorX: 0,
        cursorY: 0,
        sizeBytes: 11,
        timestamp: new Date(),
      };

      const state = useTerminalStore.getState();
      state.saveBufferState(bufferState);

      const retrieved = state.getBufferState('term-1');
      expect(retrieved).toEqual(bufferState);
    });
  });

  describe('Buffer State Actions - getBufferState', () => {
    it('should return buffer state', () => {
      const bufferState: TerminalBufferState = {
        terminalId: 'term-1',
        content: 'test output',
        scrollback: [],
        cols: 80,
        rows: 24,
        cursorX: 0,
        cursorY: 0,
        sizeBytes: 11,
        timestamp: new Date(),
      };

      const state = useTerminalStore.getState();
      state.saveBufferState(bufferState);

      const retrieved = state.getBufferState('term-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.content).toBe('test output');
    });

    it('should return undefined for non-existent buffer state', () => {
      const state = useTerminalStore.getState();
      const retrieved = state.getBufferState('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Buffer State Actions - removeBufferState', () => {
    it('should remove buffer state', () => {
      const bufferState: TerminalBufferState = {
        terminalId: 'term-1',
        content: 'test output',
        scrollback: [],
        cols: 80,
        rows: 24,
        cursorX: 0,
        cursorY: 0,
        sizeBytes: 11,
        timestamp: new Date(),
      };

      const state = useTerminalStore.getState();
      state.saveBufferState(bufferState);
      state.removeBufferState('term-1');

      const retrieved = state.getBufferState('term-1');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Buffer State Actions - hasBufferState', () => {
    it('should return true when buffer state exists', () => {
      const bufferState: TerminalBufferState = {
        terminalId: 'term-1',
        content: 'test output',
        scrollback: [],
        cols: 80,
        rows: 24,
        cursorX: 0,
        cursorY: 0,
        sizeBytes: 11,
        timestamp: new Date(),
      };

      const state = useTerminalStore.getState();
      state.saveBufferState(bufferState);

      expect(state.hasBufferState('term-1')).toBe(true);
    });

    it('should return false when buffer state does not exist', () => {
      const state = useTerminalStore.getState();
      expect(state.hasBufferState('non-existent')).toBe(false);
    });
  });

  describe('Buffer State Actions - clearAllBufferStates', () => {
    it('should clear all buffer states', () => {
      const bufferState1: TerminalBufferState = {
        terminalId: 'term-1',
        content: 'output 1',
        scrollback: [],
        cols: 80,
        rows: 24,
        cursorX: 0,
        cursorY: 0,
        sizeBytes: 8,
        timestamp: new Date(),
      };

      const bufferState2: TerminalBufferState = {
        terminalId: 'term-2',
        content: 'output 2',
        scrollback: [],
        cols: 80,
        rows: 24,
        cursorX: 0,
        cursorY: 0,
        sizeBytes: 8,
        timestamp: new Date(),
      };

      const state = useTerminalStore.getState();
      state.saveBufferState(bufferState1);
      state.saveBufferState(bufferState2);

      state.clearAllBufferStates();

      expect(state.getAllBufferStates()).toEqual([]);
    });
  });

  describe('Buffer State Actions - getAllBufferStates', () => {
    it('should return all buffer states', () => {
      const bufferState1: TerminalBufferState = {
        terminalId: 'term-1',
        content: 'output 1',
        scrollback: [],
        cols: 80,
        rows: 24,
        cursorX: 0,
        cursorY: 0,
        sizeBytes: 8,
        timestamp: new Date(),
      };

      const bufferState2: TerminalBufferState = {
        terminalId: 'term-2',
        content: 'output 2',
        scrollback: [],
        cols: 80,
        rows: 24,
        cursorX: 0,
        cursorY: 0,
        sizeBytes: 8,
        timestamp: new Date(),
      };

      const state = useTerminalStore.getState();
      state.saveBufferState(bufferState1);
      state.saveBufferState(bufferState2);

      const allStates = state.getAllBufferStates();
      expect(allStates).toHaveLength(2);
      expect(allStates).toEqual(expect.arrayContaining([bufferState1, bufferState2]));
    });
  });

  describe('Buffer State Actions - getBufferMemoryUsage', () => {
    it('should calculate total memory usage', () => {
      const bufferState1: TerminalBufferState = {
        terminalId: 'term-1',
        content: 'output 1',
        scrollback: [],
        cols: 80,
        rows: 24,
        cursorX: 0,
        cursorY: 0,
        sizeBytes: 100,
        timestamp: new Date(),
      };

      const bufferState2: TerminalBufferState = {
        terminalId: 'term-2',
        content: 'output 2',
        scrollback: [],
        cols: 80,
        rows: 24,
        cursorX: 0,
        cursorY: 0,
        sizeBytes: 200,
        timestamp: new Date(),
      };

      const state = useTerminalStore.getState();
      state.saveBufferState(bufferState1);
      state.saveBufferState(bufferState2);

      const memoryUsage = state.getBufferMemoryUsage();
      expect(memoryUsage).toBe(300);
    });

    it('should return 0 when no buffer states', () => {
      const state = useTerminalStore.getState();
      const memoryUsage = state.getBufferMemoryUsage();
      expect(memoryUsage).toBe(0);
    });
  });

  describe('Session State Actions - saveSessionState', () => {
    it('should save session state', () => {
      const sessionState: TerminalSessionState = {
        terminal: createMockTerminal({ id: 'term-1', pid: 1234, title: 'Terminal 1' }),
        bufferState: {
          terminalId: 'term-1',
          content: 'output',
          scrollback: [],
          cols: 80,
          rows: 24,
          cursorX: 0,
          cursorY: 0,
          sizeBytes: 6,
          timestamp: new Date(),
        },
        lastSaved: new Date(),
      };

      const state = useTerminalStore.getState();
      state.saveSessionState(sessionState);

      const retrieved = state.getSessionState('term-1');
      expect(retrieved).toEqual(sessionState);
    });
  });

  describe('Session State Actions - getSessionState', () => {
    it('should return session state', () => {
      const sessionState: TerminalSessionState = {
        terminal: createMockTerminal({ id: 'term-1', pid: 1234, title: 'Terminal 1' }),
        bufferState: {
          terminalId: 'term-1',
          content: 'output',
          scrollback: [],
          cols: 80,
          rows: 24,
          cursorX: 0,
          cursorY: 0,
          sizeBytes: 6,
          timestamp: new Date(),
        },
        lastSaved: new Date(),
      };

      const state = useTerminalStore.getState();
      state.saveSessionState(sessionState);

      const retrieved = state.getSessionState('term-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.terminal.id).toBe('term-1');
    });

    it('should return undefined for non-existent session state', () => {
      const state = useTerminalStore.getState();
      const retrieved = state.getSessionState('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Session State Actions - removeSessionState', () => {
    it('should remove session state', () => {
      const sessionState: TerminalSessionState = {
        terminal: createMockTerminal({ id: 'term-1', pid: 1234, title: 'Terminal 1' }),
        bufferState: {
          terminalId: 'term-1',
          content: 'output',
          scrollback: [],
          cols: 80,
          rows: 24,
          cursorX: 0,
          cursorY: 0,
          sizeBytes: 6,
          timestamp: new Date(),
        },
        lastSaved: new Date(),
      };

      const state = useTerminalStore.getState();
      state.saveSessionState(sessionState);
      state.removeSessionState('term-1');

      const retrieved = state.getSessionState('term-1');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Session State Actions - hasSessionState', () => {
    it('should return true when session state exists', () => {
      const sessionState: TerminalSessionState = {
        terminal: createMockTerminal({ id: 'term-1', pid: 1234, title: 'Terminal 1' }),
        bufferState: {
          terminalId: 'term-1',
          content: 'output',
          scrollback: [],
          cols: 80,
          rows: 24,
          cursorX: 0,
          cursorY: 0,
          sizeBytes: 6,
          timestamp: new Date(),
        },
        lastSaved: new Date(),
      };

      const state = useTerminalStore.getState();
      state.saveSessionState(sessionState);

      expect(state.hasSessionState('term-1')).toBe(true);
    });

    it('should return false when session state does not exist', () => {
      const state = useTerminalStore.getState();
      expect(state.hasSessionState('non-existent')).toBe(false);
    });
  });
});
