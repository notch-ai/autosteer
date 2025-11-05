import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import {
  Terminal,
  TerminalState,
  TerminalBufferState,
  TerminalSessionState,
} from '@/types/terminal.types';
import { logger } from '@/commons/utils/logger';

// Enable Map/Set support in Immer
enableMapSet();

interface TerminalSession {
  terminal: Terminal;
  terminalId: string;
  lastActive: Date;
  ownerProjectId: string; // The project that created this terminal
  xtermInstance?: any; // XTerm.Terminal instance
  fitAddon?: any; // FitAddon instance
  bufferContent?: string; // Serialized buffer content (ANSI codes preserved)
  cursorY?: number; // Cursor Y position when saved
  cursorX?: number; // Cursor X position when saved
  cols?: number; // Terminal columns when saved
  rows?: number; // Terminal rows when saved
}

export interface TerminalStore extends TerminalState {
  // Actions
  addTerminal: (terminal: Terminal) => void;
  removeTerminal: (terminalId: string) => void;
  updateTerminal: (terminalId: string, updates: Partial<Terminal>) => void;
  setActiveTerminal: (terminalId: string | null) => void;
  getTerminal: (terminalId: string) => Terminal | undefined;
  getTerminalCount: () => number;
  canCreateTerminal: () => boolean;
  clearTerminals: () => void;

  // Session actions - stored externally to avoid Immer issues
  // CHANGED: Now keyed by terminalId instead of projectId to support multiple terminals per project
  saveTerminalSession: (terminalId: string, session: TerminalSession) => void;
  getTerminalSession: (terminalId: string) => TerminalSession | undefined;
  removeTerminalSession: (terminalId: string) => void;
  hasTerminalSession: (terminalId: string) => boolean;
  // NEW: Get terminals for a specific project
  getTerminalsForProject: (projectId: string) => TerminalSession[];
  getLastTerminalForProject: (projectId: string) => TerminalSession | undefined;

  // Phase 1: Buffer state persistence actions
  saveBufferState: (bufferState: TerminalBufferState) => void;
  getBufferState: (terminalId: string) => TerminalBufferState | undefined;
  removeBufferState: (terminalId: string) => void;
  hasBufferState: (terminalId: string) => boolean;
  clearAllBufferStates: () => void;
  getAllBufferStates: () => TerminalBufferState[];
  getBufferMemoryUsage: () => number;

  // Session state persistence (combines terminal + buffer)
  saveSessionState: (sessionState: TerminalSessionState) => void;
  getSessionState: (terminalId: string) => TerminalSessionState | undefined;
  removeSessionState: (terminalId: string) => void;
  hasSessionState: (terminalId: string) => boolean;
}

// Store terminal sessions outside of Zustand to avoid Immer issues with XTerm instances
// Two-level cache: projectId -> terminalId -> session
// This allows multiple terminals per project while enabling project-based restoration
const terminalSessionsCache = new Map<string, TerminalSession>();
const projectToTerminalMap = new Map<string, Set<string>>(); // projectId -> Set<terminalId>

// Store buffer states outside of Zustand for Phase 1 buffer management
const bufferStatesCache = new Map<string, TerminalBufferState>();

// Store session states (terminal + buffer) outside of Zustand
const sessionStatesCache = new Map<string, TerminalSessionState>();

// Export cache clearing functions for testing
export const clearTerminalCaches = () => {
  terminalSessionsCache.clear();
  projectToTerminalMap.clear();
  bufferStatesCache.clear();
  sessionStatesCache.clear();
};

export const useTerminalStore = create<TerminalStore>()(
  immer((set, get) => ({
    // State
    terminals: new Map(),
    activeTerminalId: null,
    maxTerminals: 10,

    // Actions
    addTerminal: (terminal: Terminal) =>
      set((state) => {
        if (state.terminals.size >= state.maxTerminals) {
          throw new Error(`Maximum terminal limit reached (${state.maxTerminals})`);
        }
        state.terminals.set(terminal.id, terminal);
        if (!state.activeTerminalId) {
          state.activeTerminalId = terminal.id;
        }
      }),

    removeTerminal: (terminalId: string) =>
      set((state) => {
        state.terminals.delete(terminalId);
        if (state.activeTerminalId === terminalId) {
          // Set active terminal to the first available terminal
          const firstTerminal = state.terminals.values().next().value;
          state.activeTerminalId = firstTerminal ? firstTerminal.id : null;
        }
      }),

    updateTerminal: (terminalId: string, updates: Partial<Terminal>) =>
      set((state) => {
        const terminal = state.terminals.get(terminalId);
        if (terminal) {
          state.terminals.set(terminalId, { ...terminal, ...updates });
        }
      }),

    setActiveTerminal: (terminalId: string | null) =>
      set((state) => {
        state.activeTerminalId = terminalId;
      }),

    getTerminal: (terminalId: string) => {
      const state = get();
      return state.terminals.get(terminalId);
    },

    getTerminalCount: () => {
      const state = get();
      return state.terminals.size;
    },

    canCreateTerminal: () => {
      const state = get();
      return state.terminals.size < state.maxTerminals;
    },

    clearTerminals: () =>
      set((state) => {
        state.terminals.clear();
        state.activeTerminalId = null;
      }),

    // Session actions - use external cache to avoid Immer issues
    // CHANGED: Now keyed by terminalId instead of projectId
    saveTerminalSession: (terminalId: string, session: TerminalSession) => {
      // 🔍 HYPOTHESIS A2: Track store-level save operation
      logger.info('[HYPO-A2-STORE-SAVE] saveTerminalSession called', {
        terminalId: terminalId.substring(0, 8),
        ownerProjectId: session.ownerProjectId.substring(0, 8),
        hasBufferContent: !!session.bufferContent,
        bufferContentSize: session.bufferContent?.length || 0,
        cacheSize: terminalSessionsCache.size,
        timestamp: new Date().toISOString(),
      });

      console.error('[🔍 SAVE] Saving session:', {
        terminalId: terminalId.substring(0, 8),
        ownerProjectId: session.ownerProjectId,
        cacheSize: terminalSessionsCache.size,
      });
      terminalSessionsCache.set(terminalId, {
        ...session,
        lastActive: new Date(),
      });

      // 🔍 HYPOTHESIS A2: Verify save was successful
      const savedSession = terminalSessionsCache.get(terminalId);
      logger.info('[HYPO-A2-STORE-SAVED] Session stored in cache', {
        terminalId: terminalId.substring(0, 8),
        savedSuccessfully: !!savedSession,
        savedBufferSize: savedSession?.bufferContent?.length || 0,
        bufferMatches: savedSession?.bufferContent === session.bufferContent,
      });

      // Update project -> terminal mapping
      const projectId = session.ownerProjectId;
      if (!projectToTerminalMap.has(projectId)) {
        projectToTerminalMap.set(projectId, new Set());
      }
      projectToTerminalMap.get(projectId)!.add(terminalId);

      console.error('[🔍 SAVE COMPLETE] Cache now has:', {
        cacheSize: terminalSessionsCache.size,
        projectMapSize: projectToTerminalMap.size,
        terminalsForProject: Array.from(projectToTerminalMap.get(projectId) || []).map((id) =>
          id.substring(0, 8)
        ),
      });
    },

    getTerminalSession: (terminalId: string) => {
      const session = terminalSessionsCache.get(terminalId);

      // 🔍 HYPOTHESIS A2: Track store-level retrieve operation
      logger.info('[HYPO-A2-STORE-GET] getTerminalSession called', {
        terminalId: terminalId.substring(0, 8),
        found: !!session,
        hasBufferContent: !!session?.bufferContent,
        bufferContentSize: session?.bufferContent?.length || 0,
        ownerProjectId: session?.ownerProjectId?.substring(0, 8),
        cacheSize: terminalSessionsCache.size,
        timestamp: new Date().toISOString(),
      });

      logger.debug('[TerminalStore] Getting session:', {
        terminalId,
        found: !!session,
        ownerProjectId: session?.ownerProjectId,
        cacheSize: terminalSessionsCache.size,
      });
      return session;
    },

    removeTerminalSession: (terminalId: string) => {
      const session = terminalSessionsCache.get(terminalId);
      if (session) {
        // Remove from project -> terminal mapping
        const projectTerminals = projectToTerminalMap.get(session.ownerProjectId);
        if (projectTerminals) {
          projectTerminals.delete(terminalId);
          if (projectTerminals.size === 0) {
            projectToTerminalMap.delete(session.ownerProjectId);
          }
        }
      }
      terminalSessionsCache.delete(terminalId);
    },

    hasTerminalSession: (terminalId: string) => {
      return terminalSessionsCache.has(terminalId);
    },

    // NEW: Get all terminals for a specific project
    getTerminalsForProject: (projectId: string) => {
      const terminalIds = projectToTerminalMap.get(projectId);
      if (!terminalIds) return [];

      const sessions: TerminalSession[] = [];
      for (const terminalId of terminalIds) {
        const session = terminalSessionsCache.get(terminalId);
        if (session) {
          sessions.push(session);
        }
      }
      return sessions.sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime());
    },

    // NEW: Get the most recently used terminal for a project
    getLastTerminalForProject: (projectId: string) => {
      logger.info('[🔍 TERMINAL-STORE] getLastTerminalForProject called', {
        lookupProjectId: projectId,
        projectIdType: typeof projectId,
        projectIdLength: projectId?.length,
        projectMapSize: projectToTerminalMap.size,
        hasProject: projectToTerminalMap.has(projectId),
        terminalIds: projectToTerminalMap.get(projectId)
          ? Array.from(projectToTerminalMap.get(projectId)!).map((id) => id.substring(0, 8))
          : [],
        allProjectsInMap: Array.from(projectToTerminalMap.keys()),
      });
      const sessions = get().getTerminalsForProject(projectId);
      logger.info('[🔍 TERMINAL-STORE] getLastTerminalForProject result', {
        sessionsCount: sessions.length,
        terminalIds: sessions.map((s) => s.terminalId.substring(0, 8)),
        sessionOwnerIds: sessions.map((s) => s.ownerProjectId),
      });
      return sessions.length > 0 ? sessions[0] : undefined;
    },

    // Phase 1: Buffer state persistence actions
    saveBufferState: (bufferState: TerminalBufferState) => {
      bufferStatesCache.set(bufferState.terminalId, bufferState);
    },

    getBufferState: (terminalId: string) => {
      return bufferStatesCache.get(terminalId);
    },

    removeBufferState: (terminalId: string) => {
      bufferStatesCache.delete(terminalId);
    },

    hasBufferState: (terminalId: string) => {
      return bufferStatesCache.has(terminalId);
    },

    clearAllBufferStates: () => {
      bufferStatesCache.clear();
    },

    getAllBufferStates: () => {
      return Array.from(bufferStatesCache.values());
    },

    getBufferMemoryUsage: () => {
      let total = 0;
      for (const state of bufferStatesCache.values()) {
        total += state.sizeBytes;
      }
      return total;
    },

    // Session state persistence (combines terminal + buffer)
    saveSessionState: (sessionState: TerminalSessionState) => {
      sessionStatesCache.set(sessionState.terminal.id, sessionState);
    },

    getSessionState: (terminalId: string) => {
      return sessionStatesCache.get(terminalId);
    },

    removeSessionState: (terminalId: string) => {
      sessionStatesCache.delete(terminalId);
    },

    hasSessionState: (terminalId: string) => {
      return sessionStatesCache.has(terminalId);
    },
  }))
);

export type { TerminalSession };
