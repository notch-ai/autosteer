/**
 * useTerminalTabHandler Hook Unit Tests
 *
 * Comprehensive test coverage for terminal tab handler logic.
 * Tests pool-based terminal lifecycle, session management, and React integration.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useTerminalTabHandler } from '@/hooks/useTerminalTabHandler';
import { useTerminalStore, clearTerminalCaches } from '@/stores/terminal.store';
import { useTerminalPool } from '@/renderer/hooks/useTerminalPool';
import { useTerminal } from '@/hooks/useTerminal';
import { Terminal } from '@/types/terminal.types';
import { createRef } from 'react';

jest.mock('@/renderer/hooks/useTerminalPool');
jest.mock('@/hooks/useTerminal');
jest.mock('@/stores/terminal.store', () => {
  const actual = jest.requireActual('@/stores/terminal.store');
  return {
    ...actual,
    useTerminalStore: jest.fn(),
  };
});

const mockUseTerminalPool = useTerminalPool as jest.MockedFunction<typeof useTerminalPool>;
const mockUseTerminal = useTerminal as jest.MockedFunction<typeof useTerminal>;

describe('useTerminalTabHandler', () => {
  const mockTerminalId = 'test-terminal-id';
  const mockProjectId = 'test-project-id';
  const mockProjectPath = '/test/path';

  let mockCreatePoolTerminal: jest.Mock;
  let mockAttachPoolTerminal: jest.Mock;
  let mockDetachPoolTerminal: jest.Mock;
  let mockHasPoolTerminal: jest.Mock;
  let mockGetPoolTerminal: jest.Mock;
  let mockFitPoolTerminal: jest.Mock;

  let mockCreateTerminal: jest.Mock;
  let mockSetupTerminalListeners: jest.Mock;
  let mockRemoveTerminalListeners: jest.Mock;
  let mockWriteToTerminal: jest.Mock;
  let mockResizeTerminal: jest.Mock;

  let mockAddTerminal: jest.Mock;
  let mockSaveTerminalSession: jest.Mock;
  let mockGetTerminalSession: jest.Mock;
  let mockGetLastTerminalForProject: jest.Mock;

  const createMockTerminal = (id: string = mockTerminalId): Terminal => ({
    id,
    pid: 12345,
    status: 'running',
    createdAt: new Date(),
    size: { cols: 80, rows: 24 },
    cwd: mockProjectPath,
    title: 'Test Terminal',
    isActive: true,
    lastAccessed: new Date(),
    shell: '/bin/bash',
  });

  const createMockXTermAdapter = () => ({
    getXtermInstance: jest.fn(() => ({
      write: jest.fn(),
      onData: jest.fn(() => ({ dispose: jest.fn() })),
      onResize: jest.fn(() => ({ dispose: jest.fn() })),
      focus: jest.fn(),
      buffer: {
        active: {
          cursorY: 0,
          cursorX: 0,
        },
      },
      cols: 80,
      rows: 24,
    })),
    getFitAddonInstance: jest.fn(() => ({
      fit: jest.fn(),
    })),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    clearTerminalCaches();

    mockCreatePoolTerminal = jest.fn();
    mockAttachPoolTerminal = jest.fn();
    mockDetachPoolTerminal = jest.fn();
    mockHasPoolTerminal = jest.fn(() => false);
    mockGetPoolTerminal = jest.fn();
    mockFitPoolTerminal = jest.fn();

    mockUseTerminalPool.mockReturnValue({
      // Terminal lifecycle
      createTerminal: mockCreatePoolTerminal,
      getTerminal: mockGetPoolTerminal,
      hasTerminal: mockHasPoolTerminal,
      destroyTerminal: jest.fn(),

      // DOM attachment
      attachTerminal: mockAttachPoolTerminal,
      detachTerminal: mockDetachPoolTerminal,

      // Terminal operations
      focusTerminal: jest.fn(),
      blurTerminal: jest.fn(),
      fitTerminal: mockFitPoolTerminal,
      resizeTerminal: jest.fn(),

      // Buffer state
      captureBufferState: jest.fn((terminalId: string) => ({
        terminalId,
        content: '',
        scrollback: [],
        cursorX: 0,
        cursorY: 0,
        cols: 80,
        rows: 24,
        timestamp: new Date(),
        sizeBytes: 0,
      })),
      restoreBufferState: jest.fn(),

      // Pool info
      getPoolSize: jest.fn(() => 0),
      getMaxPoolSize: jest.fn(() => 10),
      getAllTerminalIds: jest.fn(() => []),
      getTerminalMetadata: jest.fn(),
      isTerminalAttached: jest.fn(() => false),
      getPoolStats: jest.fn(() => ({
        size: 0,
        maxSize: 10,
        terminalIds: [],
        availableSlots: 10,
      })),
    });

    mockCreateTerminal = jest.fn();
    mockSetupTerminalListeners = jest.fn();
    mockRemoveTerminalListeners = jest.fn();
    mockWriteToTerminal = jest.fn();
    mockResizeTerminal = jest.fn();

    mockUseTerminal.mockReturnValue({
      createTerminal: mockCreateTerminal,
      setupTerminalListeners: mockSetupTerminalListeners,
      removeTerminalListeners: mockRemoveTerminalListeners,
      writeToTerminal: mockWriteToTerminal,
      resizeTerminal: mockResizeTerminal,
      destroyTerminal: jest.fn(),
      getPoolStats: jest.fn(() => ({
        poolSize: 0,
        terminalIds: [],
        maxPoolSize: 10,
        availableSlots: 10,
      })),
    });

    mockAddTerminal = jest.fn();
    mockSaveTerminalSession = jest.fn();
    mockGetTerminalSession = jest.fn();
    mockGetLastTerminalForProject = jest.fn();

    (useTerminalStore as unknown as jest.Mock).mockImplementation((selector) => {
      const store = {
        terminals: new Map(),
        addTerminal: mockAddTerminal,
        saveTerminalSession: mockSaveTerminalSession,
        getTerminalSession: mockGetTerminalSession,
        getLastTerminalForProject: mockGetLastTerminalForProject,
      };
      return selector(store);
    });

    (useTerminalStore as any).getState = jest.fn(() => ({
      terminals: new Map(),
      addTerminal: mockAddTerminal,
    }));
  });

  describe('Hook Initialization', () => {
    it('should return correct interface', () => {
      const mockTerminalRef = createRef<HTMLDivElement>();

      const { result } = renderHook(() =>
        useTerminalTabHandler({
          projectId: mockProjectId,
          projectPath: mockProjectPath,
          terminalRef: mockTerminalRef,
        })
      );

      expect(result.current).toHaveProperty('terminal');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('xtermRef');
      expect(result.current).toHaveProperty('handleRetry');
    });

    it('should start with null terminal and no error', () => {
      const mockTerminalRef = createRef<HTMLDivElement>();

      const { result } = renderHook(() =>
        useTerminalTabHandler({
          projectId: mockProjectId,
          projectPath: mockProjectPath,
          terminalRef: mockTerminalRef,
        })
      );

      expect(result.current.terminal).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('Terminal Lifecycle', () => {
    it('should automatically create terminal on mount with project', async () => {
      const mockTerminal = createMockTerminal();
      const mockAdapter = createMockXTermAdapter();
      const mockTerminalRef = createRef<HTMLDivElement>();

      // Set up DOM element
      const div = document.createElement('div');
      (mockTerminalRef as any).current = div;

      mockCreateTerminal.mockResolvedValue(mockTerminal);
      mockCreatePoolTerminal.mockReturnValue(mockAdapter);

      const onTerminalCreated = jest.fn();

      renderHook(() =>
        useTerminalTabHandler({
          projectId: mockProjectId,
          projectPath: mockProjectPath,
          terminalRef: mockTerminalRef,
          onTerminalCreated,
        })
      );

      await waitFor(() => {
        expect(mockCreateTerminal).toHaveBeenCalledWith({
          size: { cols: 80, rows: 24 },
          cwd: mockProjectPath,
        });
      });
    });

    it('should handle terminal creation errors', async () => {
      const mockTerminalRef = createRef<HTMLDivElement>();
      const error = new Error('Failed to create terminal');

      mockCreateTerminal.mockRejectedValue(error);

      const { result } = renderHook(() =>
        useTerminalTabHandler({
          projectId: mockProjectId,
          projectPath: mockProjectPath,
          terminalRef: mockTerminalRef,
        })
      );

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to create terminal');
      });
    });

    it('should provide handleRetry for error recovery', async () => {
      const mockTerminalRef = createRef<HTMLDivElement>();
      const mockTerminal = createMockTerminal();

      mockCreateTerminal
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce(mockTerminal);

      const { result } = renderHook(() =>
        useTerminalTabHandler({
          projectId: mockProjectId,
          projectPath: mockProjectPath,
          terminalRef: mockTerminalRef,
        })
      );

      await waitFor(() => {
        expect(result.current.error).toBe('First attempt failed');
      });

      expect(typeof result.current.handleRetry).toBe('function');
    });
  });

  describe('Session Management', () => {
    it('should restore existing session for project', async () => {
      const mockTerminal = createMockTerminal();
      const mockAdapter = createMockXTermAdapter();
      const mockTerminalRef = createRef<HTMLDivElement>();

      const div = document.createElement('div');
      (mockTerminalRef as any).current = div;

      mockGetLastTerminalForProject.mockReturnValue({
        terminal: mockTerminal,
        terminalId: mockTerminal.id,
        ownerProjectId: mockProjectId,
        lastActive: new Date(),
      });

      mockHasPoolTerminal.mockReturnValue(true);
      mockGetPoolTerminal.mockReturnValue(mockAdapter);

      const { result } = renderHook(() =>
        useTerminalTabHandler({
          projectId: mockProjectId,
          projectPath: mockProjectPath,
          terminalRef: mockTerminalRef,
        })
      );

      await waitFor(() => {
        expect(result.current.terminal).toEqual(mockTerminal);
      });

      expect(mockCreateTerminal).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should detach terminal on unmount', async () => {
      const mockTerminal = createMockTerminal();
      const mockAdapter = createMockXTermAdapter();
      const mockTerminalRef = createRef<HTMLDivElement>();

      const div = document.createElement('div');
      (mockTerminalRef as any).current = div;

      mockCreateTerminal.mockResolvedValue(mockTerminal);
      mockCreatePoolTerminal.mockReturnValue(mockAdapter);

      // Mock hasPoolTerminal to return true so cleanup will call detachPoolTerminal
      mockHasPoolTerminal.mockReturnValue(true);

      const { unmount } = renderHook(() =>
        useTerminalTabHandler({
          projectId: mockProjectId,
          projectPath: mockProjectPath,
          terminalRef: mockTerminalRef,
        })
      );

      await waitFor(() => {
        expect(mockCreateTerminal).toHaveBeenCalled();
      });

      unmount();

      expect(mockRemoveTerminalListeners).toHaveBeenCalled();
      expect(mockDetachPoolTerminal).toHaveBeenCalled();
    });
  });
});
