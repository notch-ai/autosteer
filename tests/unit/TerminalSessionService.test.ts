import { TerminalSessionService } from '@/main/services/TerminalSessionService';
import { Terminal, TerminalBufferState } from '@/types/terminal.types';
import { TerminalBufferService } from '@/main/services/TerminalBufferService';
import log from 'electron-log';

// Mock electron-log
jest.mock('electron-log', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('TerminalSessionService', () => {
  let service: TerminalSessionService;
  let mockBufferService: jest.Mocked<TerminalBufferService>;

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

    // Create mock buffer service
    mockBufferService = {
      saveBufferState: jest.fn(),
      getBufferState: jest.fn(),
      removeBufferState: jest.fn(),
      hasBufferState: jest.fn(),
      clearAllBufferStates: jest.fn(),
      getAllBufferStates: jest.fn(),
      getBufferCount: jest.fn(),
      getTotalMemoryUsage: jest.fn(),
      trimBufferIfNeeded: jest.fn(),
      getTrimStats: jest.fn(),
      calculateBufferSize: jest.fn(),
      getMaxScrollbackLines: jest.fn(),
      getMaxBufferSizeBytes: jest.fn(),
    } as any;

    service = new TerminalSessionService(mockBufferService);
  });

  describe('Initialization', () => {
    it('should initialize with empty sessions', () => {
      expect(service.getSessionCount()).toBe(0);
      expect(service.getAllSessions()).toEqual([]);
    });

    it('should log initialization', () => {
      expect(log.info).toHaveBeenCalledWith('[TerminalSessionService] Service initialized', {
        maxSessions: 10,
      });
    });

    it('should set max sessions to 10', () => {
      expect(service.getMaxSessions()).toBe(10);
    });
  });

  describe('Session Creation', () => {
    it('should create a new session', () => {
      const terminal = createMockTerminal('term1');

      service.createSession(terminal);

      expect(service.hasSession('term1')).toBe(true);
      expect(service.getSessionCount()).toBe(1);
    });

    it('should update lastAccessed on creation', () => {
      const terminal = createMockTerminal('term1');
      const beforeCreate = new Date();

      service.createSession(terminal);
      const session = service.getSession('term1');

      expect(session).toBeDefined();
      expect(session!.lastAccessed.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
    });

    it('should throw error when max sessions reached', () => {
      // Create 10 sessions (max limit)
      for (let i = 0; i < 10; i++) {
        service.createSession(createMockTerminal(`term${i}`));
      }

      // Try to create 11th session
      expect(() => service.createSession(createMockTerminal('term11'))).toThrow(
        'Maximum terminal sessions reached (10)'
      );
    });

    it('should log session creation', () => {
      const terminal = createMockTerminal('term1');

      service.createSession(terminal);

      expect(log.info).toHaveBeenCalledWith(
        '[TerminalSessionService] Session created',
        expect.objectContaining({ terminalId: 'term1' })
      );
    });
  });

  describe('Session Retrieval', () => {
    beforeEach(() => {
      service.createSession(createMockTerminal('term1'));
      service.createSession(createMockTerminal('term2'));
    });

    it('should get existing session', () => {
      const session = service.getSession('term1');

      expect(session).toBeDefined();
      expect(session!.terminal.id).toBe('term1');
    });

    it('should return undefined for non-existent session', () => {
      const session = service.getSession('nonexistent');

      expect(session).toBeUndefined();
    });

    it('should get all sessions', () => {
      const sessions = service.getAllSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.terminal.id)).toEqual(['term1', 'term2']);
    });

    it('should get session count', () => {
      expect(service.getSessionCount()).toBe(2);
    });

    it('should check session existence', () => {
      expect(service.hasSession('term1')).toBe(true);
      expect(service.hasSession('nonexistent')).toBe(false);
    });
  });

  describe('Session Update', () => {
    beforeEach(() => {
      service.createSession(createMockTerminal('term1'));
    });

    it('should update session with partial terminal data', () => {
      service.updateSession('term1', { title: 'Updated Title' });

      const session = service.getSession('term1');
      expect(session!.terminal.title).toBe('Updated Title');
    });

    it('should update lastAccessed on update', () => {
      const beforeUpdate = new Date();

      service.updateSession('term1', { title: 'Updated' });
      const session = service.getSession('term1');

      expect(session!.lastAccessed.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });

    it('should throw error for non-existent session', () => {
      expect(() => service.updateSession('nonexistent', { title: 'Test' })).toThrow(
        'Session not found: nonexistent'
      );
    });

    it('should log session update', () => {
      service.updateSession('term1', { title: 'Updated' });

      expect(log.debug).toHaveBeenCalledWith(
        '[TerminalSessionService] Session updated',
        expect.objectContaining({ terminalId: 'term1' })
      );
    });
  });

  describe('Session Destruction', () => {
    beforeEach(() => {
      service.createSession(createMockTerminal('term1'));
      service.createSession(createMockTerminal('term2'));
    });

    it('should destroy session', () => {
      service.destroySession('term1');

      expect(service.hasSession('term1')).toBe(false);
      expect(service.getSessionCount()).toBe(1);
    });

    it('should remove buffer state on destruction', () => {
      service.destroySession('term1');

      expect(mockBufferService.removeBufferState).toHaveBeenCalledWith('term1');
    });

    it('should throw error for non-existent session', () => {
      expect(() => service.destroySession('nonexistent')).toThrow('Session not found: nonexistent');
    });

    it('should log session destruction', () => {
      service.destroySession('term1');

      expect(log.info).toHaveBeenCalledWith(
        '[TerminalSessionService] Session destroyed',
        expect.objectContaining({ terminalId: 'term1' })
      );
    });
  });

  describe('Session Persistence', () => {
    beforeEach(() => {
      service.createSession(createMockTerminal('term1'));
    });

    it('should save session state', () => {
      const bufferState = createMockBufferState('term1');

      service.saveSessionState('term1', bufferState);

      expect(mockBufferService.saveBufferState).toHaveBeenCalledWith(bufferState);
    });

    it('should restore session state', () => {
      const bufferState = createMockBufferState('term1');
      mockBufferService.getBufferState.mockReturnValue(bufferState);

      const restored = service.restoreSessionState('term1');

      expect(restored).toEqual(bufferState);
      expect(mockBufferService.getBufferState).toHaveBeenCalledWith('term1');
    });

    it('should return undefined when restoring non-existent buffer', () => {
      mockBufferService.getBufferState.mockReturnValue(undefined);

      const restored = service.restoreSessionState('term1');

      expect(restored).toBeUndefined();
    });

    it('should update lastAccessed on save', () => {
      const bufferState = createMockBufferState('term1');
      const beforeSave = new Date();

      service.saveSessionState('term1', bufferState);
      const session = service.getSession('term1');

      expect(session!.lastAccessed.getTime()).toBeGreaterThanOrEqual(beforeSave.getTime());
    });

    it('should throw error when saving non-existent session', () => {
      const bufferState = createMockBufferState('nonexistent');

      expect(() => service.saveSessionState('nonexistent', bufferState)).toThrow(
        'Session not found: nonexistent'
      );
    });
  });

  describe('Session Lifecycle', () => {
    it('should handle complete lifecycle', () => {
      // Create
      const terminal = createMockTerminal('term1');
      service.createSession(terminal);
      expect(service.hasSession('term1')).toBe(true);

      // Update
      service.updateSession('term1', { title: 'Updated' });
      expect(service.getSession('term1')!.terminal.title).toBe('Updated');

      // Save state
      const bufferState = createMockBufferState('term1');
      service.saveSessionState('term1', bufferState);
      expect(mockBufferService.saveBufferState).toHaveBeenCalled();

      // Restore state
      mockBufferService.getBufferState.mockReturnValue(bufferState);
      const restored = service.restoreSessionState('term1');
      expect(restored).toEqual(bufferState);

      // Destroy
      service.destroySession('term1');
      expect(service.hasSession('term1')).toBe(false);
    });
  });

  describe('Session Pool Management', () => {
    it('should enforce max sessions limit', () => {
      // Create max sessions
      for (let i = 0; i < 10; i++) {
        service.createSession(createMockTerminal(`term${i}`));
      }

      expect(service.getSessionCount()).toBe(10);
      expect(() => service.createSession(createMockTerminal('term11'))).toThrow();
    });

    it('should allow creation after destruction', () => {
      // Fill to max
      for (let i = 0; i < 10; i++) {
        service.createSession(createMockTerminal(`term${i}`));
      }

      // Destroy one
      service.destroySession('term0');

      // Should allow new creation
      expect(() => service.createSession(createMockTerminal('term11'))).not.toThrow();
      expect(service.getSessionCount()).toBe(10);
    });

    it('should track active sessions correctly', () => {
      service.createSession(createMockTerminal('term1'));
      service.createSession(createMockTerminal('term2'));
      service.createSession(createMockTerminal('term3'));

      expect(service.getSessionCount()).toBe(3);

      service.destroySession('term2');
      expect(service.getSessionCount()).toBe(2);
    });
  });

  describe('Clear All Sessions', () => {
    beforeEach(() => {
      service.createSession(createMockTerminal('term1'));
      service.createSession(createMockTerminal('term2'));
      service.createSession(createMockTerminal('term3'));
    });

    it('should clear all sessions', () => {
      service.clearAllSessions();

      expect(service.getSessionCount()).toBe(0);
      expect(service.getAllSessions()).toEqual([]);
    });

    it('should clear all buffer states', () => {
      service.clearAllSessions();

      expect(mockBufferService.clearAllBufferStates).toHaveBeenCalled();
    });

    it('should log clear operation', () => {
      service.clearAllSessions();

      expect(log.info).toHaveBeenCalledWith('[TerminalSessionService] All sessions cleared', {
        count: 3,
      });
    });
  });

  describe('Performance Requirements', () => {
    it('should create session in <10ms', () => {
      const start = performance.now();
      service.createSession(createMockTerminal('term1'));
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
    });

    it('should retrieve session in <5ms', () => {
      service.createSession(createMockTerminal('term1'));

      const start = performance.now();
      service.getSession('term1');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5);
    });

    it('should update session in <5ms', () => {
      service.createSession(createMockTerminal('term1'));

      const start = performance.now();
      service.updateSession('term1', { title: 'Updated' });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5);
    });

    it('should destroy session in <10ms', () => {
      service.createSession(createMockTerminal('term1'));

      const start = performance.now();
      service.destroySession('term1');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
    });
  });

  describe('Error Handling', () => {
    it('should handle duplicate session creation gracefully', () => {
      service.createSession(createMockTerminal('term1'));

      // Creating duplicate should not throw, but should update
      service.createSession(createMockTerminal('term1'));
      expect(service.getSessionCount()).toBe(1);
    });

    it('should handle buffer service errors gracefully', () => {
      service.createSession(createMockTerminal('term1'));
      mockBufferService.saveBufferState.mockImplementation(() => {
        throw new Error('Buffer service error');
      });

      expect(() => {
        service.saveSessionState('term1', createMockBufferState('term1'));
      }).toThrow('Buffer service error');
    });
  });
});
