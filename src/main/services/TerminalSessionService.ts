import log from 'electron-log';
import { Terminal, TerminalBufferState } from '@/types/terminal.types';
import { TerminalBufferService } from './TerminalBufferService';

/**
 * Terminal session metadata for pooling
 */
export interface TerminalSession {
  terminal: Terminal;
  lastAccessed: Date;
  bufferState?: TerminalBufferState;
}

/**
 * TerminalSessionService -  Instance Pooling
 *
 * Manages terminal session lifecycle for instance pooling (max 10 sessions).
 *
 * Key Features:
 * - Terminal session creation and destruction
 * - Session metadata tracking (last accessed, buffer state)
 * - Integration with TerminalBufferService for persistence
 * - Max 10 concurrent sessions (hard limit)
 * - Session state synchronization
 *
 * Architecture:
 * - Main process service (Electron main)
 * - Coordinates with TerminalBufferService for buffer management
 * - Provides session lifecycle API for IPC handlers
 * - Decoupled from XTerm instances (managed by TerminalPoolManager)
 *
 * Performance Requirements:
 * - <10ms session creation
 * - <5ms session update
 * - <10ms session destruction
 * - O(1) session lookup
 *
 * @see docs/terminal-persistence-architecture.md 
 */
export class TerminalSessionService {
  private static readonly MAX_SESSIONS = 10;

  private sessions: Map<string, TerminalSession>;
  private bufferService: TerminalBufferService;

  constructor(bufferService: TerminalBufferService) {
    this.sessions = new Map();
    this.bufferService = bufferService;

    log.info('[TerminalSessionService] Service initialized', {
      maxSessions: TerminalSessionService.MAX_SESSIONS,
    });
  }

  /**
   * Get maximum sessions allowed
   */
  getMaxSessions(): number {
    return TerminalSessionService.MAX_SESSIONS;
  }

  /**
   * Create a new terminal session
   * @param terminal The terminal to create session for
   */
  createSession(terminal: Terminal): void {
    if (this.sessions.size >= TerminalSessionService.MAX_SESSIONS) {
      throw new Error(`Maximum terminal sessions reached (${TerminalSessionService.MAX_SESSIONS})`);
    }

    const session: TerminalSession = {
      terminal,
      lastAccessed: new Date(),
    };

    this.sessions.set(terminal.id, session);

    log.info('[TerminalSessionService] Session created', {
      terminalId: terminal.id,
      totalSessions: this.sessions.size,
    });
  }

  /**
   * Get terminal session by ID
   * @param terminalId The terminal ID
   * @returns The session or undefined
   */
  getSession(terminalId: string): TerminalSession | undefined {
    return this.sessions.get(terminalId);
  }

  /**
   * Check if session exists
   * @param terminalId The terminal ID
   * @returns True if session exists
   */
  hasSession(terminalId: string): boolean {
    return this.sessions.has(terminalId);
  }

  /**
   * Get all terminal sessions
   * @returns Array of all sessions
   */
  getAllSessions(): TerminalSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session count
   * @returns Number of active sessions
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Update terminal session
   * @param terminalId The terminal ID
   * @param updates Partial terminal updates
   */
  updateSession(terminalId: string, updates: Partial<Terminal>): void {
    const session = this.sessions.get(terminalId);
    if (!session) {
      throw new Error(`Session not found: ${terminalId}`);
    }

    session.terminal = { ...session.terminal, ...updates };
    session.lastAccessed = new Date();

    log.debug('[TerminalSessionService] Session updated', {
      terminalId,
      updates: Object.keys(updates),
    });
  }

  /**
   * Destroy terminal session
   * @param terminalId The terminal ID
   */
  destroySession(terminalId: string): void {
    const session = this.sessions.get(terminalId);
    if (!session) {
      throw new Error(`Session not found: ${terminalId}`);
    }

    // Remove buffer state
    this.bufferService.removeBufferState(terminalId);

    // Remove session
    this.sessions.delete(terminalId);

    log.info('[TerminalSessionService] Session destroyed', {
      terminalId,
      remainingSessions: this.sessions.size,
    });
  }

  /**
   * Save session state (terminal + buffer)
   * @param terminalId The terminal ID
   * @param bufferState The buffer state to save
   */
  saveSessionState(terminalId: string, bufferState: TerminalBufferState): void {
    const session = this.sessions.get(terminalId);
    if (!session) {
      throw new Error(`Session not found: ${terminalId}`);
    }

    // Save buffer state through buffer service
    this.bufferService.saveBufferState(bufferState);

    // Update session metadata
    session.bufferState = bufferState;
    session.lastAccessed = new Date();

    log.debug('[TerminalSessionService] Session state saved', {
      terminalId,
      bufferLines: bufferState.scrollback.length,
      bufferSize: bufferState.sizeBytes,
    });
  }

  /**
   * Restore session state
   * @param terminalId The terminal ID
   * @returns The buffer state or undefined
   */
  restoreSessionState(terminalId: string): TerminalBufferState | undefined {
    const bufferState = this.bufferService.getBufferState(terminalId);

    if (bufferState) {
      log.debug('[TerminalSessionService] Session state restored', {
        terminalId,
        bufferLines: bufferState.scrollback.length,
      });
    }

    return bufferState;
  }

  /**
   * Clear all sessions
   */
  clearAllSessions(): void {
    const count = this.sessions.size;
    this.sessions.clear();
    this.bufferService.clearAllBufferStates();

    log.info('[TerminalSessionService] All sessions cleared', { count });
  }
}
