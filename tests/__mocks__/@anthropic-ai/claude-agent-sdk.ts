/**
 * Mock for @anthropic-ai/claude-agent-sdk
 * Used in tests to avoid ESM import issues
 */

export interface Options {
  pathToClaudeCodeExecutable?: string;
  settingSources?: string[];
  resume?: string;
  permissionMode?: string;
  maxTurns?: number;
  systemPrompt?: string;
  allowedTools?: string[];
  model?: string;
  cwd?: string;
}

export interface SDKMessage {
  type: string;
  [key: string]: any;
}

export interface Query {
  [Symbol.asyncIterator](): AsyncIterator<SDKMessage>;
  interrupt(): void;
}

export function query(_options: { prompt: string; options: Options }): Query {
  throw new Error('Mock implementation - should not be called in tests');
}
