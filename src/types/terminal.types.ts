import { SessionTab } from './ui.types';

/**
 * Terminal size configuration
 */
export interface TerminalSize {
  cols: number;
  rows: number;
}

/**
 * Terminal status states
 */
export type TerminalStatus = 'running' | 'stopped' | 'error';

/**
 * Core terminal entity
 */
export interface Terminal {
  id: string;
  pid: number;
  title: string;
  isActive: boolean;
  createdAt: Date;
  lastAccessed: Date;
  shell: string;
  cwd: string;
  size: TerminalSize;
  status: TerminalStatus;
}

/**
 * Terminal tab that extends SessionTab for UI integration
 */
export interface TerminalTab extends SessionTab {
  agentType: 'terminal';
  terminalId: string;
  pid: number;
}

/**
 * Terminal store state
 */
export interface TerminalState {
  terminals: Map<string, Terminal>;
  activeTerminalId: string | null;
  maxTerminals: number;
}

/**
 * Terminal creation parameters
 */
export interface TerminalCreateParams {
  shell?: string;
  cwd?: string;
  size?: TerminalSize;
  title?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * Terminal resize parameters for IPC
 */
export interface TerminalResizeParams {
  terminalId: string;
  cols: number;
  rows: number;
}

/**
 * Terminal write parameters for IPC
 */
export interface TerminalWriteParams {
  terminalId: string;
  data: string;
}

/**
 * Terminal IPC response
 */
export interface TerminalResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Terminal create response
 */
export interface TerminalCreateResponse extends TerminalResponse {
  data?: TerminalData;
}

/**
 * Terminal data for IPC serialization
 */
export interface TerminalData {
  id: string;
  pid: number;
  title: string;
  isActive: boolean;
  createdAt: string; // ISO string for serialization
  lastAccessed: string; // ISO string for serialization
  shell: string;
  cwd: string;
  size: TerminalSize;
  status: TerminalStatus;
}

/**
 * Terminal buffer state for session persistence (Phase 1)
 */
export interface TerminalBufferState {
  terminalId: string;
  content: string;
  scrollback: string[];
  cursorX: number;
  cursorY: number;
  cols: number;
  rows: number;
  timestamp: Date;
  sizeBytes: number;
}

/**
 * Terminal session persistence state
 */
export interface TerminalSessionState {
  terminal: Terminal;
  bufferState: TerminalBufferState;
  lastSaved: Date;
}

/**
 * Buffer trimming statistics
 */
export interface BufferTrimStats {
  linesBefore: number;
  linesAfter: number;
  bytesRemoved: number;
  timestamp: Date;
}
