/**
 * Service Factory
 * Creates mock service instances and test data for service layer testing
 */

import { Settings, DEFAULT_SETTINGS } from '@/entities/Settings';
import { TerminalData, TerminalCreateParams, TerminalSize } from '@/types/terminal.types';
import Store from 'electron-store';
import { BrowserWindow } from 'electron';
import { IPty } from 'node-pty';

/**
 * Create a mock electron-store instance
 * @param initialData - Initial store data
 * @returns Mocked Store instance
 */
export function createMockStore(initialData: Record<string, unknown> = {}): jest.Mocked<Store> {
  const mockStore = {
    store: { ...initialData },
    get: jest.fn((key: string) => mockStore.store[key]),
    set: jest.fn((key: string, value: unknown) => {
      mockStore.store[key] = value;
    }),
    delete: jest.fn((key: string) => {
      delete mockStore.store[key];
    }),
    clear: jest.fn(() => {
      mockStore.store = {};
    }),
    has: jest.fn((key: string) => key in mockStore.store),
    reset: jest.fn(),
    openInEditor: jest.fn(),
    path: '/mock/settings.json',
    size: 0,
    onDidChange: jest.fn(),
    onDidAnyChange: jest.fn(),
    offDidChange: jest.fn(),
    offDidAnyChange: jest.fn(),
    iterator: jest.fn(),
    '*': Symbol.for('ElectronStore'),
  } as unknown as jest.Mocked<Store>;

  console.log('[Service Factory] Created mock electron-store');
  return mockStore;
}

/**
 * Create mock settings data
 * @param overrides - Partial settings to override defaults
 * @returns Complete Settings object
 */
export function createMockSettings(overrides?: Partial<Settings>): Settings {
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    ...overrides,
  };

  console.log('[Service Factory] Created mock settings');
  return settings;
}

/**
 * Create multiple mock settings variants
 * @param count - Number of settings variations to create
 * @returns Array of Settings objects
 */
export function createMockSettingsVariants(count: number): Settings[] {
  const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
  const variants: Settings[] = [];

  for (let i = 0; i < count; i++) {
    variants.push(
      createMockSettings({
        theme: themes[i % themes.length],
        autoStart: i % 2 === 0,
        vimMode: i % 3 === 0,
        telemetry: i % 4 === 0,
      })
    );
  }

  console.log(`[Service Factory] Created ${count} settings variants`);
  return variants;
}

/**
 * Create mock BrowserWindow instance
 * @returns Mocked BrowserWindow
 */
export function createMockBrowserWindow(): jest.Mocked<BrowserWindow> {
  const mockWindow = {
    isDestroyed: jest.fn().mockReturnValue(false),
    webContents: {
      send: jest.fn(),
    },
    id: Math.floor(Math.random() * 10000),
    destroy: jest.fn(),
    close: jest.fn(),
    focus: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
  } as unknown as jest.Mocked<BrowserWindow>;

  console.log('[Service Factory] Created mock BrowserWindow');
  return mockWindow;
}

/**
 * Create mock PTY instance
 * @param pid - Process ID
 * @returns Mocked IPty
 */
export function createMockPty(pid: number = 12345): jest.Mocked<IPty> {
  const mockDataDisposable = { dispose: jest.fn() };
  const mockExitDisposable = { dispose: jest.fn() };

  const mockPty = {
    pid,
    write: jest.fn(),
    resize: jest.fn(),
    kill: jest.fn(),
    onData: jest.fn().mockReturnValue(mockDataDisposable),
    onExit: jest.fn().mockReturnValue(mockExitDisposable),
    process: 'bash',
    cols: 80,
    rows: 24,
    handleFlowControl: false,
    pause: jest.fn(),
    resume: jest.fn(),
    clear: jest.fn(),
  } as unknown as jest.Mocked<IPty>;

  console.log(`[Service Factory] Created mock PTY with PID ${pid}`);
  return mockPty;
}

/**
 * Create mock terminal data
 * @param overrides - Partial terminal data to override defaults
 * @returns Complete TerminalData object
 */
export function createMockTerminalData(overrides?: Partial<TerminalData>): TerminalData {
  const now = new Date();
  const terminalData: TerminalData = {
    id: `terminal-${Math.random().toString(36).substring(7)}`,
    pid: 12345,
    title: 'Terminal',
    isActive: true,
    createdAt: now.toISOString(),
    lastAccessed: now.toISOString(),
    shell: '/bin/zsh',
    cwd: '/Users/test',
    size: { cols: 80, rows: 24 },
    status: 'running',
    ...overrides,
  };

  console.log('[Service Factory] Created mock terminal data:', terminalData.id);
  return terminalData;
}

/**
 * Create multiple mock terminal data objects
 * @param count - Number of terminals to create
 * @param overrides - Partial terminal data to override defaults
 * @returns Array of TerminalData objects
 */
export function createMockTerminals(
  count: number,
  overrides?: Partial<TerminalData>
): TerminalData[] {
  const terminals: TerminalData[] = [];

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(Date.now() + i * 1000);
    terminals.push(
      createMockTerminalData({
        id: `terminal-${i}`,
        pid: 12345 + i,
        title: `Terminal ${i}`,
        createdAt: timestamp.toISOString(),
        lastAccessed: timestamp.toISOString(),
        ...overrides,
      })
    );
  }

  console.log(`[Service Factory] Created ${count} mock terminals`);
  return terminals;
}

/**
 * Create mock terminal creation parameters
 * @param overrides - Partial params to override defaults
 * @returns Complete TerminalCreateParams object
 */
export function createMockTerminalParams(
  overrides?: Partial<TerminalCreateParams>
): TerminalCreateParams {
  const params: TerminalCreateParams = {
    shell: '/bin/zsh',
    cwd: '/Users/test',
    size: { cols: 80, rows: 24 },
    title: 'Terminal',
    ...overrides,
  };

  console.log('[Service Factory] Created mock terminal params');
  return params;
}

/**
 * Create mock terminal size
 * @param cols - Number of columns
 * @param rows - Number of rows
 * @returns TerminalSize object
 */
export function createMockTerminalSize(cols: number = 80, rows: number = 24): TerminalSize {
  return { cols, rows };
}

/**
 * Create a running terminal (status: running, isActive: true)
 * @param overrides - Partial terminal data to override defaults
 * @returns Running TerminalData
 */
export function createRunningTerminal(overrides?: Partial<TerminalData>): TerminalData {
  return createMockTerminalData({
    ...overrides,
    status: 'running',
    isActive: true,
  });
}

/**
 * Create a stopped terminal (status: stopped, isActive: false)
 * @param overrides - Partial terminal data to override defaults
 * @returns Stopped TerminalData
 */
export function createStoppedTerminal(overrides?: Partial<TerminalData>): TerminalData {
  return createMockTerminalData({
    ...overrides,
    status: 'stopped',
    isActive: false,
  });
}

/**
 * Create an errored terminal (status: error, isActive: false)
 * @param overrides - Partial terminal data to override defaults
 * @returns Errored TerminalData
 */
export function createErroredTerminal(overrides?: Partial<TerminalData>): TerminalData {
  return createMockTerminalData({
    ...overrides,
    status: 'error',
    isActive: false,
  });
}

/**
 * Create terminal with custom size
 * @param cols - Number of columns
 * @param rows - Number of rows
 * @param overrides - Additional overrides
 * @returns TerminalData with custom size
 */
export function createTerminalWithSize(
  cols: number,
  rows: number,
  overrides?: Partial<TerminalData>
): TerminalData {
  return createMockTerminalData({
    ...overrides,
    size: { cols, rows },
  });
}

/**
 * Create terminal with custom working directory
 * @param cwd - Working directory path
 * @param overrides - Additional overrides
 * @returns TerminalData with custom cwd
 */
export function createTerminalWithCwd(
  cwd: string,
  overrides?: Partial<TerminalData>
): TerminalData {
  return createMockTerminalData({
    ...overrides,
    cwd,
  });
}

/**
 * Create terminal with custom shell
 * @param shell - Shell path
 * @param overrides - Additional overrides
 * @returns TerminalData with custom shell
 */
export function createTerminalWithShell(
  shell: string,
  overrides?: Partial<TerminalData>
): TerminalData {
  return createMockTerminalData({
    ...overrides,
    shell,
  });
}

/**
 * Simulate PTY data event
 * @param mockPty - Mocked PTY instance
 * @param data - Data to send
 */
export function simulatePtyData(mockPty: jest.Mocked<IPty>, data: string): void {
  const dataHandler = mockPty.onData.mock.calls[0]?.[0];
  if (dataHandler) {
    dataHandler(data);
    console.log('[Service Factory] Simulated PTY data event');
  }
}

/**
 * Simulate PTY exit event
 * @param mockPty - Mocked PTY instance
 * @param exitCode - Exit code
 * @param signal - Exit signal (optional)
 */
export function simulatePtyExit(
  mockPty: jest.Mocked<IPty>,
  exitCode: number,
  signal?: number
): void {
  const exitHandler = mockPty.onExit.mock.calls[0]?.[0];
  if (exitHandler) {
    exitHandler({ exitCode, ...(signal !== undefined && { signal }) });
    console.log(`[Service Factory] Simulated PTY exit with code ${exitCode}`);
  }
}

/**
 * Create mock settings with custom values
 * @param customSettings - Custom settings object
 * @returns Settings with custom values merged
 */
export function createSettingsWithCustom(customSettings: Record<string, unknown>): Settings {
  return createMockSettings({
    customSettings,
  });
}

/**
 * Create dark theme settings
 * @param overrides - Additional overrides
 * @returns Settings with dark theme
 */
export function createDarkThemeSettings(overrides?: Partial<Settings>): Settings {
  return createMockSettings({
    ...overrides,
    theme: 'dark',
  });
}

/**
 * Create light theme settings
 * @param overrides - Additional overrides
 * @returns Settings with light theme
 */
export function createLightThemeSettings(overrides?: Partial<Settings>): Settings {
  return createMockSettings({
    ...overrides,
    theme: 'light',
  });
}

/**
 * Create system theme settings
 * @param overrides - Additional overrides
 * @returns Settings with system theme
 */
export function createSystemThemeSettings(overrides?: Partial<Settings>): Settings {
  return createMockSettings({
    ...overrides,
    theme: 'system',
  });
}

/**
 * Create vim mode enabled settings
 * @param overrides - Additional overrides
 * @returns Settings with vim mode enabled
 */
export function createVimModeSettings(overrides?: Partial<Settings>): Settings {
  return createMockSettings({
    ...overrides,
    vimMode: true,
  });
}

/**
 * Create production-ready settings (telemetry enabled, updates enabled)
 * @param overrides - Additional overrides
 * @returns Production settings
 */
export function createProductionSettings(overrides?: Partial<Settings>): Settings {
  return createMockSettings({
    ...overrides,
    telemetry: true,
    checkForUpdates: true,
    autoStart: true,
  });
}

/**
 * Create development-friendly settings (telemetry disabled, minimal features)
 * @param overrides - Additional overrides
 * @returns Development settings
 */
export function createDevelopmentSettings(overrides?: Partial<Settings>): Settings {
  return createMockSettings({
    ...overrides,
    telemetry: false,
    checkForUpdates: false,
    autoStart: false,
  });
}
