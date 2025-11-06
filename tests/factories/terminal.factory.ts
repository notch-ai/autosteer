/**
 * Terminal Test Factory
 * Generates test data for terminal-related tests
 */

import {
  Terminal,
  TerminalData,
  TerminalBufferState,
  TerminalSize,
  TerminalCreateParams,
} from '@/types/terminal.types';

/**
 * Create a mock terminal for testing
 */
export function createTestTerminal(overrides?: Partial<Terminal>): Terminal {
  const now = new Date();
  return {
    id: `terminal-${Math.random().toString(36).substring(7)}`,
    pid: Math.floor(Math.random() * 10000) + 1000,
    title: 'Test Terminal',
    isActive: true,
    createdAt: now,
    lastAccessed: now,
    shell: '/bin/bash',
    cwd: '/home/user/test',
    size: { cols: 80, rows: 24 },
    status: 'running',
    ...overrides,
  };
}

/**
 * Create multiple mock terminals
 */
export function createTestTerminals(count: number, overrides?: Partial<Terminal>): Terminal[] {
  return Array.from({ length: count }, (_, index) =>
    createTestTerminal({
      id: `terminal-${index}`,
      title: `Terminal ${index + 1}`,
      ...overrides,
    })
  );
}

/**
 * Create terminal data for IPC serialization
 */
export function createTestTerminalData(overrides?: Partial<TerminalData>): TerminalData {
  const now = new Date().toISOString();
  return {
    id: `terminal-${Math.random().toString(36).substring(7)}`,
    pid: Math.floor(Math.random() * 10000) + 1000,
    title: 'Test Terminal',
    isActive: true,
    createdAt: now,
    lastAccessed: now,
    shell: '/bin/bash',
    cwd: '/home/user/test',
    size: { cols: 80, rows: 24 },
    status: 'running',
    ...overrides,
  };
}

/**
 * Create terminal buffer state for persistence testing
 */
export function createTestBufferState(
  overrides?: Partial<TerminalBufferState>
): TerminalBufferState {
  const content = `
\x1b[32muser@host\x1b[0m:\x1b[34m~/test\x1b[0m$ echo "Hello World"
Hello World
\x1b[32muser@host\x1b[0m:\x1b[34m~/test\x1b[0m$ ls -la
total 24
drwxr-xr-x  3 user user 4096 Jan 01 12:00 .
drwxr-xr-x 10 user user 4096 Jan 01 12:00 ..
-rw-r--r--  1 user user  220 Jan 01 12:00 .bash_logout
-rw-r--r--  1 user user 3771 Jan 01 12:00 .bashrc
\x1b[32muser@host\x1b[0m:\x1b[34m~/test\x1b[0m$ `;

  return {
    terminalId: `terminal-${Math.random().toString(36).substring(7)}`,
    content,
    scrollback: content.split('\n'),
    cursorX: 0,
    cursorY: 5,
    cols: 80,
    rows: 24,
    timestamp: new Date(),
    sizeBytes: content.length,
    ...overrides,
  };
}

/**
 * Create terminal with ANSI colored buffer
 */
export function createTestTerminalWithColors(): {
  terminal: Terminal;
  bufferState: TerminalBufferState;
} {
  const terminal = createTestTerminal({
    title: 'Colored Terminal',
  });

  const coloredContent = `
\x1b[31mRed text\x1b[0m
\x1b[32mGreen text\x1b[0m
\x1b[33mYellow text\x1b[0m
\x1b[34mBlue text\x1b[0m
\x1b[35mMagenta text\x1b[0m
\x1b[36mCyan text\x1b[0m
\x1b[37mWhite text\x1b[0m
\x1b[1mBold text\x1b[0m
\x1b[4mUnderlined text\x1b[0m
\x1b[7mReversed text\x1b[0m`;

  const bufferState = createTestBufferState({
    terminalId: terminal.id,
    content: coloredContent,
    scrollback: coloredContent.split('\n'),
  });

  return { terminal, bufferState };
}

/**
 * Create terminal creation parameters
 */
export function createTestTerminalParams(
  overrides?: Partial<TerminalCreateParams>
): TerminalCreateParams {
  return {
    shell: '/bin/bash',
    cwd: '/home/user/test',
    size: { cols: 80, rows: 24 },
    title: 'Test Terminal',
    ...overrides,
  };
}

/**
 * Create terminal size configuration
 */
export function createTestTerminalSize(overrides?: Partial<TerminalSize>): TerminalSize {
  return {
    cols: 80,
    rows: 24,
    ...overrides,
  };
}

/**
 * Create a terminal with long buffer for memory testing
 */
export function createTestTerminalWithLargeBuffer(): {
  terminal: Terminal;
  bufferState: TerminalBufferState;
} {
  const terminal = createTestTerminal({
    title: 'Large Buffer Terminal',
  });

  // Generate 5000 lines of content (approximately 500KB)
  const lines = Array.from({ length: 5000 }, (_, i) => `Line ${i + 1}: ${'x'.repeat(100)}`);
  const content = lines.join('\n');

  const bufferState = createTestBufferState({
    terminalId: terminal.id,
    content,
    scrollback: lines,
    sizeBytes: content.length,
  });

  return { terminal, bufferState };
}
