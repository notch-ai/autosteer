import { create } from 'zustand';
import { SessionBlock } from '@/entities/SessionBlock';

interface MonitoringState {
  // State
  isInitialized: boolean;
  activeSession: SessionBlock | null;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  fetchActiveSession: () => Promise<void>;
  reset: () => void;
}

export const useMonitoringStore = create<MonitoringState>((set) => ({
  // Initial state
  isInitialized: false,
  activeSession: null,
  error: null,

  // Initialize monitoring
  initialize: async () => {
    try {
      const result = await window.electron.monitoring.initialize();
      if (result.success) {
        set({ isInitialized: true, error: null });

        // Set up session update listener
        window.electron.monitoring.onSessionUpdate((data) => {
          if (data.type === 'active' && data.session) {
            set({ activeSession: data.session });
          }
        });
      } else {
        set({ error: result.error || 'Failed to initialize' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  // Fetch active session
  fetchActiveSession: async () => {
    try {
      const result = await window.electron.monitoring.getActiveSession();
      if (result.success) {
        set({ activeSession: result.data || null, error: null });
      } else {
        set({ error: result.error || 'Failed to fetch session' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  // Reset store
  reset: () => {
    set({
      isInitialized: false,
      activeSession: null,
      error: null,
    });
  },
}));
