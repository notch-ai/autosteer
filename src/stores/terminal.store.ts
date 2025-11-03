import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import {
  Terminal,
  TerminalState,
  TerminalBufferState,
  TerminalSessionState,
} from '@/types/terminal.types';

// Enable Map/Set support in Immer
enableMapSet();

interface TerminalSession {
  terminal: Terminal;
  terminalId: string;
  lastActive: Date;
  xtermInstance?: any; // XTerm.Terminal instance
  fitAddon?: any; // FitAddon instance
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
  saveTerminalSession: (projectId: string, session: TerminalSession) => void;
  getTerminalSession: (projectId: string) => TerminalSession | undefined;
  removeTerminalSession: (projectId: string) => void;
  hasTerminalSession: (projectId: string) => boolean;

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
const terminalSessionsCache = new Map<string, TerminalSession>();

// Store buffer states outside of Zustand for Phase 1 buffer management
const bufferStatesCache = new Map<string, TerminalBufferState>();

// Store session states (terminal + buffer) outside of Zustand
const sessionStatesCache = new Map<string, TerminalSessionState>();

// Export cache clearing functions for testing
export const clearTerminalCaches = () => {
  terminalSessionsCache.clear();
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
    saveTerminalSession: (projectId: string, session: TerminalSession) => {
      console.log('[TerminalStore] Saving session:', {
        projectId,
        terminalId: session.terminalId,
        cacheSize: terminalSessionsCache.size,
      });
      terminalSessionsCache.set(projectId, {
        ...session,
        lastActive: new Date(),
      });
      console.log('[TerminalStore] Session saved. New cache size:', terminalSessionsCache.size);
    },

    getTerminalSession: (projectId: string) => {
      const session = terminalSessionsCache.get(projectId);
      console.log('[TerminalStore] Getting session:', {
        projectId,
        found: !!session,
        terminalId: session?.terminalId,
        cacheSize: terminalSessionsCache.size,
        allKeys: Array.from(terminalSessionsCache.keys()),
      });
      return session;
    },

    removeTerminalSession: (projectId: string) => {
      terminalSessionsCache.delete(projectId);
    },

    hasTerminalSession: (projectId: string) => {
      return terminalSessionsCache.has(projectId);
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
