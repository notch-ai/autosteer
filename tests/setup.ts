// Jest setup file for desktop app tests

import '@testing-library/jest-dom';

// Polyfill fetch for tests (needed for Anthropic SDK)
// This runs synchronously before tests, but node-fetch is ESM so we need to handle it carefully
if (typeof globalThis.fetch === 'undefined') {
  // Use Node.js 18+ native fetch if available, otherwise we'll need to polyfill in the service
  // In Node.js 18+, fetch is available via globalThis
  try {
    // Node 18+ has native fetch, but it might not be exposed as global in all contexts
    // The Anthropic SDK will handle this by checking for fetch during initialization
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { fetch, Headers, Request, Response } = require('node-fetch');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetch;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Headers = Headers;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Request = Request;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Response = Response;
  } catch (error) {
    // node-fetch might be ESM-only (v3+), skip polyfill
    // Tests will need to handle fetch availability themselves
  }
}

// Mock ResizeObserver for tests that use it
(global as any).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock scrollIntoView for elements that may use it
Element.prototype.scrollIntoView = jest.fn();

// Mock Range.getBoundingClientRect for RichTextEditor tests
if (!global.Range) {
  (global as any).Range = class Range {};
}

Range.prototype.getBoundingClientRect = jest.fn(() => ({
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
  width: 0,
  height: 0,
  x: 0,
  y: 0,
  toJSON: () => ({}),
}));

Range.prototype.getClientRects = jest.fn(() => {
  const list: any = {
    length: 0,
    item: () => null,
    [Symbol.iterator]: function* () {},
  };
  return list;
});

// Mock electron
jest.mock('electron', () => ({
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
  },
  app: {
    getVersion: () => '1.0.0',
    getPath: () => '/mock/path',
  },
  shell: {
    openExternal: jest.fn(),
  },
}));

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: {
    invoke: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
    openExternal: jest.fn(),
  },
  writable: true,
});

// Mock window.electron for worktree and other APIs
Object.defineProperty(window, 'electron', {
  value: {
    worktree: {
      getVimMode: jest.fn().mockResolvedValue(false),
      saveVimMode: jest.fn().mockResolvedValue(undefined),
      setVimMode: jest.fn().mockResolvedValue({ success: true }),
      getWorktrees: jest.fn().mockResolvedValue([]),
      createWorktree: jest.fn().mockResolvedValue(undefined),
      deleteWorktree: jest.fn().mockResolvedValue(undefined),
      getDataDirectory: jest.fn().mockResolvedValue('/mock/data/directory'),
    },
    store: {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    },
    app: {
      getVersion: jest.fn().mockResolvedValue('1.0.0'),
    },
  },
  writable: true,
});

// Suppress console errors in tests
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  // Convert first argument to string for checking
  const message = typeof args[0] === 'string' ? args[0] : String(args[0]);

  if (
    message.includes('Warning: ReactDOM.render is deprecated') ||
    message.includes('Warning: An invalid form control') ||
    message.includes('Failed to get data directory') ||
    message.includes('Failed to load vim mode') ||
    message.includes('not wrapped in act')
  ) {
    return;
  }
  originalConsoleError.call(console, ...args);
};

// Setup global test environment
beforeAll(() => {
  // Setup any global test configuration
});

afterEach(() => {
  jest.clearAllMocks();
});
