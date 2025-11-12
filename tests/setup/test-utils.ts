/**
 * Test Utilities Module
 * Provides common testing utilities, helpers, and wrappers for autosteer tests
 */

import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { Agent, AgentStatus, AgentType } from '@/entities';

/**
 * Custom render function that wraps components with necessary providers
 * @param ui - The React component to render
 * @param options - Additional render options
 * @returns Render result with testing utilities
 */
export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  console.log('[Test Utils] Rendering component with providers');
  return render(ui, { ...options });
}

/**
 * Wait for async operations to complete with a timeout
 * @param ms - Milliseconds to wait
 * @returns Promise that resolves after the specified time
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a mock agent for testing
 * @param overrides - Partial agent properties to override defaults
 * @returns Mock Agent object
 */
export function createMockAgent(overrides?: Partial<Agent>): Agent {
  const now = new Date();
  return {
    id: 'mock-agent-id',
    title: 'Mock Agent',
    content: 'Mock content',
    preview: 'Mock preview',
    type: 'assistant' as AgentType,
    status: 'active' as AgentStatus,
    createdAt: now,
    updatedAt: now,
    tags: [],
    resourceIds: [],
    projectId: 'mock-project',
    ...overrides,
  };
}

/**
 * Create multiple mock agents
 * @param count - Number of agents to create
 * @param overrides - Partial agent properties to override defaults
 * @returns Array of mock Agent objects
 */
export function createMockAgents(count: number, overrides?: Partial<Agent>): Agent[] {
  console.log(`[Test Utils] Creating ${count} mock agents`);
  return Array.from({ length: count }, (_, index) =>
    createMockAgent({
      id: `mock-agent-${index}`,
      title: `Mock Agent ${index}`,
      ...overrides,
    })
  );
}

/**
 * Mock IPC invoke function for Electron testing
 * @param channel - IPC channel name
 * @param response - Response to return
 * @returns Mock function
 */
export function mockIpcInvoke(channel: string, response: unknown) {
  console.log(`[Test Utils] Mocking IPC channel: ${channel}`);
  return jest.fn().mockImplementation((invokedChannel: string) => {
    if (invokedChannel === channel) {
      return Promise.resolve(response);
    }
    return Promise.reject(new Error(`Unhandled IPC channel: ${invokedChannel}`));
  });
}

/**
 * Create a mock Electron API object for testing
 * @returns Mock Electron API
 */
export function createMockElectronAPI() {
  console.log('[Test Utils] Creating mock Electron API');
  return {
    ipcRenderer: {
      invoke: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      removeListener: jest.fn(),
    },
    worktree: {
      getVimMode: jest.fn().mockResolvedValue(false),
      setVimMode: jest.fn().mockResolvedValue({ success: true }),
      getDataDirectory: jest.fn().mockResolvedValue('~/.autosteer'),
    },
    app: {
      getVersion: jest.fn().mockResolvedValue('1.0.0'),
    },
    update: {
      onUpdateAvailable: jest.fn(),
      onUpdateDownloaded: jest.fn(),
      onDownloadProgress: jest.fn(),
      onUpdateError: jest.fn(),
      onUpdateNotAvailable: jest.fn(),
      checkForUpdates: jest.fn(),
      downloadUpdate: jest.fn(),
      installUpdate: jest.fn(),
    },
  };
}

/**
 * Setup mock window.electron for testing
 * @param customAPI - Custom Electron API overrides
 */
export function setupMockElectron(customAPI?: Partial<ReturnType<typeof createMockElectronAPI>>) {
  const mockAPI = { ...createMockElectronAPI(), ...customAPI };

  // Check if electron property already exists
  const descriptor = Object.getOwnPropertyDescriptor(window, 'electron');

  if (descriptor) {
    // If it exists and is configurable, delete it first
    if (descriptor.configurable) {
      delete (window as unknown as { electron?: unknown }).electron;
    } else {
      // If not configurable, we can't redefine it - just update its value if writable
      if (descriptor.writable) {
        (window as unknown as { electron: unknown }).electron = mockAPI;
        console.log('[Test Utils] Mock Electron API updated on window object');
        return mockAPI;
      }
    }
  }

  // Define the property
  Object.defineProperty(window, 'electron', {
    value: mockAPI,
    writable: true,
    configurable: true,
  });
  console.log('[Test Utils] Mock Electron API set up on window object');
  return mockAPI;
}

/**
 * Cleanup mock window.electron after testing
 */
export function cleanupMockElectron() {
  try {
    delete (window as unknown as { electron?: unknown }).electron;
    console.log('[Test Utils] Mock Electron API cleaned up');
  } catch (error) {
    console.warn('[Test Utils] Failed to cleanup electron mock:', error);
  }
}

/**
 * Suppress console errors during tests
 * Useful for testing error boundaries and error states
 * @returns Object with restore function
 */
export function suppressConsoleError() {
  const originalError = console.error;
  console.error = jest.fn() as unknown as typeof console.error;

  return {
    restore: () => {
      console.error = originalError;
    },
  };
}

/**
 * Create a mock file for testing file operations
 * @param overrides - File properties to override
 * @returns Mock File object
 */
export function createMockFile(overrides?: Partial<File>): File {
  const mockFile = new File(['test content'], 'test-file.txt', {
    type: 'text/plain',
    lastModified: Date.now(),
    ...overrides,
  });
  console.log('[Test Utils] Created mock file:', mockFile.name);
  return mockFile;
}
