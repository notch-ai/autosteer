/**
 * Mock for @xterm/xterm terminal library
 * Used in tests to avoid actual terminal instantiation
 */

export const Terminal = jest.fn().mockImplementation(() => ({
  onData: jest.fn((_callback: (data: string) => void) => ({
    dispose: jest.fn(),
  })),
  onResize: jest.fn((_callback: (dimensions: { cols: number; rows: number }) => void) => ({
    dispose: jest.fn(),
  })),
  write: jest.fn(),
  writeln: jest.fn(),
  clear: jest.fn(),
  reset: jest.fn(),
  focus: jest.fn(),
  blur: jest.fn(),
  resize: jest.fn(),
  dispose: jest.fn(),
  loadAddon: jest.fn(),
  cols: 80,
  rows: 24,
}));

export default { Terminal };
