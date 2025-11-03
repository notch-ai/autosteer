import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { useMonitoringStore } from '@/stores/useMonitoringStore';

// Get references to the global mocks from setup.ts
const mockInitialize = window.electron.monitoring.initialize as jest.MockedFunction<any>;
const mockGetActiveSession = window.electron.monitoring
  .getActiveSession as jest.MockedFunction<any>;
const mockOnSessionUpdate = window.electron.monitoring.onSessionUpdate as jest.MockedFunction<any>;

describe('MonitoringStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store to initial state
    useMonitoringStore.setState({
      isInitialized: false,
      activeSession: null,
      error: null,
    });
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const state = useMonitoringStore.getState();
      expect(state.isInitialized).toBe(false);
      expect(state.activeSession).toBeNull();
      expect(state.error).toBeNull();
    });

    it('should initialize monitoring successfully', async () => {
      mockInitialize.mockResolvedValueOnce({ success: true });

      const { initialize } = useMonitoringStore.getState();
      await initialize();

      const state = useMonitoringStore.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.error).toBeNull();
      expect(mockInitialize).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors', async () => {
      mockInitialize.mockResolvedValueOnce({
        success: false,
        error: 'Initialization failed',
      });

      const { initialize } = useMonitoringStore.getState();
      await initialize();

      const state = useMonitoringStore.getState();
      expect(state.isInitialized).toBe(false);
      expect(state.error).toBe('Initialization failed');
    });

    it('should handle initialization exceptions', async () => {
      mockInitialize.mockRejectedValueOnce(new Error('Connection error'));

      const { initialize } = useMonitoringStore.getState();
      await initialize();

      const state = useMonitoringStore.getState();
      expect(state.isInitialized).toBe(false);
      expect(state.error).toBe('Connection error');
    });

    it('should set up session update listener on successful initialization', async () => {
      mockInitialize.mockResolvedValueOnce({ success: true });

      const { initialize } = useMonitoringStore.getState();
      await initialize();

      expect(mockOnSessionUpdate).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('Session Updates', () => {
    it('should update active session via listener', async () => {
      let sessionUpdateCallback: ((data: any) => void) | undefined;

      mockInitialize.mockResolvedValueOnce({ success: true });
      mockOnSessionUpdate.mockImplementationOnce((callback: any) => {
        sessionUpdateCallback = callback;
      });

      const { initialize } = useMonitoringStore.getState();
      await initialize();

      // Simulate session update
      const mockSession = {
        id: 'session-1',
        startTime: new Date(),
        status: 'active',
      };

      sessionUpdateCallback?.({
        type: 'active',
        session: mockSession,
      });

      const state = useMonitoringStore.getState();
      expect(state.activeSession).toEqual(mockSession);
    });

    it('should not update session if type is not active', async () => {
      let sessionUpdateCallback: ((data: any) => void) | undefined;

      mockInitialize.mockResolvedValueOnce({ success: true });
      mockOnSessionUpdate.mockImplementationOnce((callback: any) => {
        sessionUpdateCallback = callback;
      });

      const { initialize } = useMonitoringStore.getState();
      await initialize();

      // Simulate non-active session update
      sessionUpdateCallback?.({
        type: 'inactive',
        session: { id: 'session-1' },
      });

      const state = useMonitoringStore.getState();
      expect(state.activeSession).toBeNull();
    });

    it('should not update session if session data is missing', async () => {
      let sessionUpdateCallback: ((data: any) => void) | undefined;

      mockInitialize.mockResolvedValueOnce({ success: true });
      mockOnSessionUpdate.mockImplementationOnce((callback: any) => {
        sessionUpdateCallback = callback;
      });

      const { initialize } = useMonitoringStore.getState();
      await initialize();

      // Simulate update without session data
      sessionUpdateCallback?.({
        type: 'active',
        session: null,
      });

      const state = useMonitoringStore.getState();
      expect(state.activeSession).toBeNull();
    });
  });

  describe('Fetch Active Session', () => {
    it('should fetch active session successfully', async () => {
      const mockSession = {
        id: 'session-1',
        startTime: new Date(),
        status: 'active',
      };

      mockGetActiveSession.mockResolvedValueOnce({
        success: true,
        data: mockSession,
      });

      const { fetchActiveSession } = useMonitoringStore.getState();
      await fetchActiveSession();

      const state = useMonitoringStore.getState();
      expect(state.activeSession).toEqual(mockSession);
      expect(state.error).toBeNull();
    });

    it('should handle null session data', async () => {
      mockGetActiveSession.mockResolvedValueOnce({
        success: true,
        data: null,
      });

      const { fetchActiveSession } = useMonitoringStore.getState();
      await fetchActiveSession();

      const state = useMonitoringStore.getState();
      expect(state.activeSession).toBeNull();
      expect(state.error).toBeNull();
    });

    it('should handle fetch errors', async () => {
      mockGetActiveSession.mockResolvedValueOnce({
        success: false,
        error: 'Failed to fetch session',
      });

      const { fetchActiveSession } = useMonitoringStore.getState();
      await fetchActiveSession();

      const state = useMonitoringStore.getState();
      expect(state.activeSession).toBeNull();
      expect(state.error).toBe('Failed to fetch session');
    });

    it('should handle fetch exceptions', async () => {
      mockGetActiveSession.mockRejectedValueOnce(new Error('Network error'));

      const { fetchActiveSession } = useMonitoringStore.getState();
      await fetchActiveSession();

      const state = useMonitoringStore.getState();
      expect(state.activeSession).toBeNull();
      expect(state.error).toBe('Network error');
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all store state', async () => {
      // Set up initial state with data
      mockInitialize.mockResolvedValueOnce({ success: true });
      mockGetActiveSession.mockResolvedValueOnce({
        success: true,
        data: {
          id: 'session-1',
          startTime: new Date(),
          status: 'active',
        },
      });

      const { initialize, fetchActiveSession, reset } = useMonitoringStore.getState();

      await initialize();
      await fetchActiveSession();

      // Verify state is populated
      let state = useMonitoringStore.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.activeSession).not.toBeNull();

      // Reset
      reset();

      // Verify state is reset
      state = useMonitoringStore.getState();
      expect(state.isInitialized).toBe(false);
      expect(state.activeSession).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should clear previous errors on successful operations', async () => {
      // First operation fails
      mockGetActiveSession.mockResolvedValueOnce({
        success: false,
        error: 'First error',
      });

      const { fetchActiveSession } = useMonitoringStore.getState();
      await fetchActiveSession();

      let state = useMonitoringStore.getState();
      expect(state.error).toBe('First error');

      // Second operation succeeds
      mockGetActiveSession.mockResolvedValueOnce({
        success: true,
        data: { id: 'session-1' },
      });

      await fetchActiveSession();

      state = useMonitoringStore.getState();
      expect(state.error).toBeNull();
    });

    it('should handle unknown errors gracefully', async () => {
      mockGetActiveSession.mockRejectedValueOnce('Unknown error');

      const { fetchActiveSession } = useMonitoringStore.getState();
      await fetchActiveSession();

      const state = useMonitoringStore.getState();
      expect(state.error).toBe('Unknown error');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle initialize then fetch workflow', async () => {
      mockInitialize.mockResolvedValueOnce({ success: true });
      mockGetActiveSession.mockResolvedValueOnce({
        success: true,
        data: {
          id: 'session-1',
          startTime: new Date(),
          status: 'active',
        },
      });

      const { initialize, fetchActiveSession } = useMonitoringStore.getState();

      await initialize();
      await fetchActiveSession();

      const state = useMonitoringStore.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.activeSession).not.toBeNull();
      expect(state.error).toBeNull();
    });

    it('should allow multiple session updates', async () => {
      let sessionUpdateCallback: ((data: any) => void) | undefined;

      mockInitialize.mockResolvedValueOnce({ success: true });
      mockOnSessionUpdate.mockImplementationOnce((callback: any) => {
        sessionUpdateCallback = callback;
      });

      const { initialize } = useMonitoringStore.getState();
      await initialize();

      // First update
      sessionUpdateCallback?.({
        type: 'active',
        session: { id: 'session-1', status: 'active' },
      });

      let state = useMonitoringStore.getState();
      expect(state.activeSession?.id).toBe('session-1');

      // Second update
      sessionUpdateCallback?.({
        type: 'active',
        session: { id: 'session-2', status: 'active' },
      });

      state = useMonitoringStore.getState();
      expect(state.activeSession?.id).toBe('session-2');
    });
  });
});
