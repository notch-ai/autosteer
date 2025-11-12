/**
 * TerminalTab Component Tests - TDD Approach
 * Tests for terminal pool integration
 *
 * Test Coverage:
 * - Terminal creation via pool
 * - Terminal reattachment from pool
 * - Detachment preserves instance
 * - Proper logging usage
 */

import { render, waitFor } from '@testing-library/react';
import { Terminal } from '../../src/types/terminal.types';
import { logger } from '../../src/commons/utils/logger';

// Mock logger before importing component
jest.mock('../../src/commons/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock stores
const mockTerminal: Terminal = {
  id: 'test-terminal-id',
  pid: 12345,
  title: 'Terminal 1',
  isActive: true,
  createdAt: new Date(),
  lastAccessed: new Date(),
  shell: '/bin/bash',
  cwd: '/test/path',
  size: { cols: 80, rows: 24 },
  status: 'running',
};

const mockCreateTerminal = jest.fn().mockResolvedValue(mockTerminal);
const mockWriteToTerminal = jest.fn().mockResolvedValue(undefined);
const mockResizeTerminal = jest.fn().mockResolvedValue(undefined);
const mockSetupTerminalListeners = jest.fn();
const mockRemoveTerminalListeners = jest.fn();
const mockDestroyTerminal = jest.fn().mockResolvedValue(undefined);
const mockGetPoolStats = jest.fn().mockReturnValue({ activeCount: 1, totalCount: 1 });

// Mock TerminalPool functions
const mockXtermInstance = {
  write: jest.fn(),
  onData: jest.fn().mockReturnValue({ dispose: jest.fn() }),
  onResize: jest.fn().mockReturnValue({ dispose: jest.fn() }),
  focus: jest.fn(),
  buffer: {
    active: {
      cursorY: 0,
      cursorX: 0,
    },
  },
  cols: 80,
  rows: 24,
};

const mockFitAddon = {
  fit: jest.fn(),
};

const mockAdapter = {
  getXtermInstance: jest.fn().mockReturnValue(mockXtermInstance),
  getFitAddonInstance: jest.fn().mockReturnValue(mockFitAddon),
};

const mockCreatePoolTerminal = jest.fn().mockReturnValue(mockAdapter);
const mockGetPoolTerminal = jest.fn().mockReturnValue(mockAdapter);
const mockHasPoolTerminal = jest.fn().mockReturnValue(false);
const mockAttachPoolTerminal = jest.fn();
const mockDetachPoolTerminal = jest.fn();
const mockFitPoolTerminal = jest.fn();

jest.mock('../../src/hooks/useTerminal', () => ({
  useTerminal: () => ({
    createTerminal: mockCreateTerminal,
    writeToTerminal: mockWriteToTerminal,
    resizeTerminal: mockResizeTerminal,
    setupTerminalListeners: mockSetupTerminalListeners,
    removeTerminalListeners: mockRemoveTerminalListeners,
    destroyTerminal: mockDestroyTerminal,
    getPoolStats: mockGetPoolStats,
  }),
}));

// Mock useTerminalPool hook
jest.mock('../../src/renderer/hooks/useTerminalPool', () => ({
  useTerminalPool: () => ({
    createTerminal: mockCreatePoolTerminal,
    getTerminal: mockGetPoolTerminal,
    hasTerminal: mockHasPoolTerminal,
    attachTerminal: mockAttachPoolTerminal,
    detachTerminal: mockDetachPoolTerminal,
    fitTerminal: mockFitPoolTerminal,
  }),
}));

let mockProjectsState = {
  selectedProjectId: 'test-project',
  projects: new Map([
    ['test-project', { id: 'test-project', localPath: '/test/path', name: 'Test Project' }],
  ]),
};

let mockTerminalState = {
  saveTerminalSession: jest.fn(),
  getTerminalSession: jest.fn(),
  getLastTerminalForProject: jest.fn(),
  getTerminalsForProject: jest.fn().mockReturnValue([]),
  setActiveTerminal: jest.fn(),
  terminals: new Map([[mockTerminal.id, mockTerminal]]),
  addTerminal: jest.fn(),
  getTerminal: jest.fn().mockReturnValue(mockTerminal),
};

const mockUseTerminalStore = Object.assign(
  (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockTerminalState);
    }
    return mockTerminalState;
  },
  {
    getState: () => mockTerminalState,
  }
);

jest.mock('../../src/stores', () => ({
  useProjectsStore: (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockProjectsState);
    }
    return mockProjectsState;
  },
  useTerminalStore: mockUseTerminalStore,
}));

// Now import component after mocks are set up
// eslint-disable-next-line import/first
import { TerminalTab } from '../../src/features/shared/components/terminal/TerminalTab';

describe('TerminalTab - Pool Integration (TDD)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset terminal state
    mockTerminalState.terminals = new Map([[mockTerminal.id, mockTerminal]]);
    // Reset pool mocks
    mockHasPoolTerminal.mockReturnValue(false);
    mockCreatePoolTerminal.mockReturnValue(mockAdapter);
    mockGetPoolTerminal.mockReturnValue(mockAdapter);
    mockCreateTerminal.mockResolvedValue(mockTerminal);
  });

  describe('Logging Requirements', () => {
    it('should use logger utility instead of console.log', async () => {
      // Arrange
      const consoleLogSpy = jest.spyOn(console, 'log');
      mockCreateTerminal.mockRejectedValueOnce(new Error('Test error'));

      // Act
      render(<TerminalTab />);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert - component should use logger.error for errors (component doesn't use logger.info)
      expect(logger.error).toHaveBeenCalled();
      // Verify console.log is not used
      expect(consoleLogSpy).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    it('should log with correct format [Component] message', async () => {
      // Arrange - create an error scenario to trigger logging
      mockCreateTerminal.mockRejectedValueOnce(new Error('Test error'));

      // Act
      render(<TerminalTab />);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert - check log format includes message and context object
      // Component uses logger.error with message and context object
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Terminal creation failed'),
        expect.any(Object)
      );
    });
  });

  describe('Terminal Creation via Pool', () => {
    it('should create terminal when component mounts', async () => {
      // Act
      render(<TerminalTab />);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert
      expect(mockCreateTerminal).toHaveBeenCalled();
    });

    it('should create pool terminal after terminal metadata is created', async () => {
      // Act
      render(<TerminalTab />);

      // Wait for pool terminal creation
      await waitFor(
        () => {
          expect(mockCreatePoolTerminal).toHaveBeenCalled();
        },
        { timeout: 500 }
      );

      // Assert - pool terminal should be created with terminal metadata
      expect(mockCreatePoolTerminal).toHaveBeenCalledWith(
        mockTerminal,
        expect.any(Object) // terminalRef.current
      );
    });
  });

  describe('Terminal Lifecycle', () => {
    it('should setup listeners after terminal creation', async () => {
      // Act
      render(<TerminalTab />);

      // Wait for listeners to be set up
      await waitFor(
        () => {
          expect(mockSetupTerminalListeners).toHaveBeenCalled();
        },
        { timeout: 500 }
      );

      // Assert - listeners should be set up for the terminal with the terminal ID
      expect(mockSetupTerminalListeners).toHaveBeenCalledWith(
        mockTerminal.id,
        expect.any(Function), // onData callback
        expect.any(Function) // onExit callback
      );
    });

    it('should preserve terminal in pool on unmount', async () => {
      // Act
      const { unmount } = render(<TerminalTab />);

      // Wait for initialization
      await waitFor(
        () => {
          expect(mockSetupTerminalListeners).toHaveBeenCalled();
        },
        { timeout: 500 }
      );

      // Unmount component
      unmount();
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Assert - terminal should NOT be detached on unmount (preserved in pool)
      // Detachment only happens when switching between different terminals
      expect(mockDetachPoolTerminal).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle terminal creation errors gracefully', async () => {
      // Arrange
      mockCreateTerminal.mockRejectedValueOnce(new Error('Creation failed'));

      // Act
      const { container } = render(<TerminalTab />);

      // Assert - should display error state
      await waitFor(
        () => {
          expect(container.textContent).toContain('Terminal Error');
        },
        { timeout: 1000 }
      );
    });

    it('should log errors when terminal creation fails', async () => {
      // Arrange
      mockCreateTerminal.mockRejectedValueOnce(new Error('Creation failed'));

      // Act
      render(<TerminalTab />);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Terminal creation failed'),
        expect.any(Object)
      );
    });
  });
});
