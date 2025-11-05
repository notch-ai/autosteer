/**
 * Unit Tests for MonitoringService
 * Tests monitoring service functionality with mocked dependencies
 * Target: 80%+ coverage
 */

import { monitoringService } from '@/services/monitoring';
import { SessionBlock } from '@/entities/SessionBlock';
import { BrowserWindow } from 'electron';

// Mock dependencies
jest.mock('@/monitoring/adapters/CCUsageMonitor');
jest.mock('@/commons/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));
jest.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: jest.fn(),
  },
}));

describe('MonitoringService', () => {
  let mockMonitor: any;
  let originalSetInterval: typeof setInterval;
  let originalClearInterval: typeof clearInterval;

  beforeEach(() => {
    console.log('[MonitoringService Test] Setting up test environment');
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();

    // Store original functions
    originalSetInterval = global.setInterval;
    originalClearInterval = global.clearInterval;

    // Mock setInterval and clearInterval
    global.setInterval = jest.fn(originalSetInterval) as any;
    global.clearInterval = jest.fn(originalClearInterval) as any;

    // Reset the service state
    monitoringService.dispose();

    // Create mock monitor
    mockMonitor = {
      getActiveBlock: jest.fn(),
      getAllBlocks: jest.fn(),
      clearCache: jest.fn(),
      [Symbol.dispose]: jest.fn(),
    };

    // Mock the CCUsageMonitor constructor
    const { CCUsageMonitor } = require('@/monitoring/adapters/CCUsageMonitor');
    CCUsageMonitor.mockClear(); // Clear the mock calls
    CCUsageMonitor.mockImplementation(() => mockMonitor);
  });

  afterEach(() => {
    console.log('[MonitoringService Test] Cleaning up test environment');
    monitoringService.dispose();

    // Restore original functions
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;

    jest.useRealTimers();
  });

  describe('initialize', () => {
    beforeEach(() => {
      // Additional reset for initialize tests to ensure clean state
      const { CCUsageMonitor } = require('@/monitoring/adapters/CCUsageMonitor');
      CCUsageMonitor.mockClear();
    });

    it('should initialize with default config', () => {
      console.log('[Test] Initializing with default config');
      monitoringService.initialize();

      const { CCUsageMonitor } = require('@/monitoring/adapters/CCUsageMonitor');
      expect(CCUsageMonitor).toHaveBeenCalledWith({
        sessionHours: 5,
        costMode: 'auto',
        debug: false,
      });
    });

    it('should initialize with custom config', () => {
      console.log('[Test] Initializing with custom config');
      const customConfig = {
        sessionHours: 10,
        costMode: 'calculate' as const,
        debug: true,
      };

      monitoringService.initialize(customConfig);

      const { CCUsageMonitor } = require('@/monitoring/adapters/CCUsageMonitor');
      expect(CCUsageMonitor).toHaveBeenCalledWith({
        sessionHours: 10,
        costMode: 'calculate',
        debug: true,
      });
    });

    it('should merge partial config with defaults', () => {
      console.log('[Test] Initializing with partial config');
      monitoringService.initialize({ sessionHours: 8 });

      const { CCUsageMonitor } = require('@/monitoring/adapters/CCUsageMonitor');
      expect(CCUsageMonitor).toHaveBeenCalledWith({
        sessionHours: 8,
        costMode: 'auto',
        debug: false,
      });
    });
  });

  describe('getActiveSession', () => {
    beforeEach(() => {
      monitoringService.initialize();
    });

    it('should return active session block', async () => {
      console.log('[Test] Getting active session');
      const mockSessionBlock = new SessionBlock({
        id: 'test-session',
        startTime: new Date(),
        endTime: new Date(),
        isActive: true,
        entries: [],
      });

      mockMonitor.getActiveBlock.mockResolvedValue(mockSessionBlock);

      const result = await monitoringService.getActiveSession();

      expect(result).toBe(mockSessionBlock);
      expect(mockMonitor.getActiveBlock).toHaveBeenCalledTimes(1);
    });

    it('should return null when no active session', async () => {
      console.log('[Test] Getting null for no active session');
      mockMonitor.getActiveBlock.mockResolvedValue(null);

      const result = await monitoringService.getActiveSession();

      expect(result).toBeNull();
    });

    it('should throw error if service not initialized', async () => {
      console.log('[Test] Throwing error for uninitialized service');
      monitoringService.dispose();

      await expect(monitoringService.getActiveSession()).rejects.toThrow(
        'Monitoring service not initialized'
      );
    });
  });

  describe('getAllSessions', () => {
    beforeEach(() => {
      monitoringService.initialize();
    });

    it('should return all session blocks', async () => {
      console.log('[Test] Getting all sessions');
      const mockSessions = [
        new SessionBlock({
          id: 'session-1',
          startTime: new Date('2024-01-01'),
          endTime: new Date('2024-01-01'),
          isActive: false,
          entries: [],
        }),
        new SessionBlock({
          id: 'session-2',
          startTime: new Date('2024-01-02'),
          endTime: new Date('2024-01-02'),
          isActive: true,
          entries: [],
        }),
      ];

      mockMonitor.getAllBlocks.mockResolvedValue(mockSessions);

      const result = await monitoringService.getAllSessions();

      expect(result).toHaveLength(2);
      expect(result).toBe(mockSessions);
      expect(mockMonitor.getAllBlocks).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no sessions', async () => {
      console.log('[Test] Getting empty array for no sessions');
      mockMonitor.getAllBlocks.mockResolvedValue([]);

      const result = await monitoringService.getAllSessions();

      expect(result).toEqual([]);
    });

    it('should throw error if service not initialized', async () => {
      console.log('[Test] Throwing error for uninitialized service');
      monitoringService.dispose();

      await expect(monitoringService.getAllSessions()).rejects.toThrow(
        'Monitoring service not initialized'
      );
    });
  });

  describe('startPolling', () => {
    beforeEach(() => {
      monitoringService.initialize();
    });

    it('should start polling with default interval', () => {
      console.log('[Test] Starting polling with default interval');
      monitoringService.startPolling();

      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 30000);
    });

    it('should start polling with custom interval', () => {
      console.log('[Test] Starting polling with custom interval');
      monitoringService.startPolling(10000);

      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 10000);
    });

    it('should send updates to all windows when active session exists', async () => {
      console.log('[Test] Sending updates to all windows');
      const mockWindow = {
        webContents: {
          send: jest.fn(),
        },
      };
      (BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([mockWindow]);

      const mockSessionBlock = new SessionBlock({
        id: 'test-session',
        startTime: new Date(),
        endTime: new Date(),
        isActive: true,
        entries: [],
      });

      mockMonitor.getActiveBlock.mockResolvedValue(mockSessionBlock);

      monitoringService.startPolling(1000);

      // Fast-forward time to trigger the interval
      await jest.advanceTimersByTimeAsync(1000);

      expect(mockMonitor.getActiveBlock).toHaveBeenCalled();
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('monitoring:sessionUpdate', {
        type: 'active',
        session: mockSessionBlock,
      });
    });

    it('should not send updates when no active session', async () => {
      console.log('[Test] Not sending updates when no active session');
      const mockWindow = {
        webContents: {
          send: jest.fn(),
        },
      };
      (BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([mockWindow]);

      mockMonitor.getActiveBlock.mockResolvedValue(null);

      monitoringService.startPolling(1000);

      await jest.advanceTimersByTimeAsync(1000);

      expect(mockMonitor.getActiveBlock).toHaveBeenCalled();
      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('should handle errors during polling', async () => {
      console.log('[Test] Handling errors during polling');
      const { logger } = require('@/commons/utils/logger');
      mockMonitor.getActiveBlock.mockRejectedValue(new Error('Test error'));

      monitoringService.startPolling(1000);

      await jest.advanceTimersByTimeAsync(1000);

      expect(logger.error).toHaveBeenCalledWith(
        'Error polling monitoring data:',
        expect.any(Error)
      );
    });

    it('should stop previous polling before starting new one', () => {
      console.log('[Test] Stopping previous polling before starting new one');
      monitoringService.startPolling(1000);

      monitoringService.startPolling(2000);

      // Should have cleared the first interval and created a new one
      expect(clearInterval).toHaveBeenCalledTimes(1);
      expect(setInterval).toHaveBeenCalledTimes(2);
    });
  });

  describe('stopPolling', () => {
    beforeEach(() => {
      monitoringService.initialize();
    });

    it('should stop active polling', () => {
      console.log('[Test] Stopping active polling');
      monitoringService.startPolling(1000);
      monitoringService.stopPolling();

      expect(clearInterval).toHaveBeenCalledTimes(1);
    });

    it('should handle stopping when no polling is active', () => {
      console.log('[Test] Handling stop when no polling active');
      expect(() => monitoringService.stopPolling()).not.toThrow();
    });

    it('should be idempotent', () => {
      console.log('[Test] Ensuring stopPolling is idempotent');
      monitoringService.startPolling(1000);
      monitoringService.stopPolling();
      monitoringService.stopPolling();

      // Should only clear once
      expect(clearInterval).toHaveBeenCalledTimes(1);
    });
  });

  describe('dispose', () => {
    it('should stop polling and dispose monitor', () => {
      console.log('[Test] Disposing service');
      monitoringService.initialize();
      monitoringService.startPolling();

      monitoringService.dispose();

      expect(clearInterval).toHaveBeenCalled();
      expect(mockMonitor[Symbol.dispose]).toHaveBeenCalled();
    });

    it('should handle dispose when monitor does not support Symbol.dispose', () => {
      console.log('[Test] Handling dispose without Symbol.dispose');
      monitoringService.initialize();

      // Remove Symbol.dispose
      delete mockMonitor[Symbol.dispose];

      expect(() => monitoringService.dispose()).not.toThrow();
    });

    it('should be safe to call multiple times', () => {
      console.log('[Test] Ensuring dispose is idempotent');
      monitoringService.initialize();
      monitoringService.dispose();
      monitoringService.dispose();

      // Should not throw
      expect(() => monitoringService.dispose()).not.toThrow();
    });

    it('should allow reinitialization after dispose', () => {
      console.log('[Test] Reinitializing after dispose');
      monitoringService.initialize();
      monitoringService.dispose();
      monitoringService.initialize();

      const { CCUsageMonitor } = require('@/monitoring/adapters/CCUsageMonitor');
      expect(CCUsageMonitor).toHaveBeenCalledTimes(2);
    });
  });

  describe('integration scenarios', () => {
    it('should handle full lifecycle: initialize -> poll -> update -> dispose', async () => {
      console.log('[Test] Testing full lifecycle');
      const mockWindow = {
        webContents: {
          send: jest.fn(),
        },
      };
      (BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([mockWindow]);

      const mockSessionBlock = new SessionBlock({
        id: 'lifecycle-session',
        startTime: new Date(),
        endTime: new Date(),
        isActive: true,
        entries: [],
      });

      mockMonitor.getActiveBlock.mockResolvedValue(mockSessionBlock);

      // Initialize
      monitoringService.initialize({ sessionHours: 3 });

      // Start polling
      monitoringService.startPolling(500);

      // Trigger update
      await jest.advanceTimersByTimeAsync(500);

      // Verify update sent
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('monitoring:sessionUpdate', {
        type: 'active',
        session: mockSessionBlock,
      });

      // Dispose
      monitoringService.dispose();

      expect(clearInterval).toHaveBeenCalled();
      expect(mockMonitor[Symbol.dispose]).toHaveBeenCalled();
    });
  });
});
