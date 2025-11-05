/**
 * ClaudeCodeCLIService Test Suite
 *
 * Comprehensive unit tests for the ClaudeCodeCLIService using TDD approach.
 * Tests CLI spawn operations, streaming output parsing, session management, and error handling.
 *
 * Coverage target: 80%+
 * Test approach: Mock child process spawn, test output parsing, validate CLI integration
 */

import { ClaudeCodeCLIService } from '@/services/ClaudeCodeCLIService';
import type { Attachment } from '@/services/ClaudeCodeCLIService';
import { ChildProcessWithoutNullStreams } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';

// Mock child_process
jest.mock('child_process');
const { spawn: mockSpawn, execSync: mockExecSync } = jest.requireMock('child_process');

// Mock electron-log
jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock fix-path
jest.mock('fix-path', () => jest.fn());

// Mock fs/promises
jest.mock('fs/promises', () => ({
  mkdtemp: jest.fn(),
  writeFile: jest.fn(),
  rm: jest.fn().mockResolvedValue(undefined),
}));

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
}));

// Mock os
jest.mock('os', () => ({
  tmpdir: jest.fn(() => '/tmp'),
  homedir: jest.fn(() => '/home/test-user'),
}));

// Mock path
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  isAbsolute: jest.fn((path) => path.startsWith('/')),
  basename: jest.fn((path) => {
    const parts = path.split('/');
    return parts[parts.length - 1];
  }),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

// Mock logger
jest.mock('@/commons/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockMkdtemp = fs.mkdtemp as jest.MockedFunction<typeof fs.mkdtemp>;
const mockWriteFile = fs.writeFile as jest.MockedFunction<typeof fs.writeFile>;
const mockRm = fs.rm as jest.MockedFunction<typeof fs.rm>;

/**
 * Helper to create a mock child process with stdout/stderr streams
 */
function createMockChildProcess() {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const mockProcess = new EventEmitter() as unknown as ChildProcessWithoutNullStreams;

  // Add necessary methods for readline.createInterface
  (stdout as any).resume = jest.fn();
  (stdout as any).pause = jest.fn();
  (stdout as any).setEncoding = jest.fn();
  (stderr as any).resume = jest.fn();
  (stderr as any).pause = jest.fn();

  (mockProcess as any).stdout = stdout;
  (mockProcess as any).stderr = stderr;
  (mockProcess as any).kill = jest.fn();

  // Helper to properly close the streams and process
  (mockProcess as any).cleanup = () => {
    // Emit 'end' to signal no more data will be written
    stdout.emit('end');
    stderr.emit('end');
    // Then emit 'close' to fully close the streams
    stdout.emit('close');
    stderr.emit('close');
  };

  return { mockProcess, stdout, stderr };
}

describe('ClaudeCodeCLIService', () => {
  beforeEach(() => {
    console.log('[Test] Setting up ClaudeCodeCLIService test');
    jest.clearAllMocks();

    // Default mock for execSync (claude --version check)
    mockExecSync.mockReturnValue('claude version 1.0.0');

    // Reset singleton
    (ClaudeCodeCLIService as any).instance = null;
  });

  afterEach(() => {
    console.log('[Test] Cleaning up ClaudeCodeCLIService test');
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      console.log('[Test] Testing singleton pattern');
      const instance1 = ClaudeCodeCLIService.getInstance();
      const instance2 = ClaudeCodeCLIService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('initializeSession', () => {
    it('should initialize a new session with default working directory', async () => {
      console.log('[Test] Initializing session with default working directory');

      const { mockProcess, stdout } = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const initPromise = ClaudeCodeCLIService.initializeSession();

      // Simulate CLI output
      setTimeout(() => {
        stdout.emit(
          'data',
          JSON.stringify({
            type: 'system',
            subtype: 'init',
            session_id: 'test-session-id',
          }) + '\n'
        );
        stdout.emit(
          'data',
          JSON.stringify({
            type: 'result',
            subtype: 'success',
            session_id: 'test-session-id',
          }) + '\n'
        );
        (mockProcess as any).emit('exit', 0);
        (mockProcess as any).cleanup();
      }, 10);

      const sessionId = await initPromise;

      expect(sessionId).toBe('test-session-id');
      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining(['--print', 'Session initialized. Ready to assist.']),
        expect.any(Object)
      );
    });

    it('should initialize a new session with custom working directory', async () => {
      console.log('[Test] Initializing session with custom working directory');

      const customDir = '/custom/path';
      const { mockProcess, stdout } = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const initPromise = ClaudeCodeCLIService.initializeSession(customDir);

      setTimeout(() => {
        stdout.emit(
          'data',
          JSON.stringify({
            type: 'system',
            subtype: 'init',
            session_id: 'custom-session-id',
          }) + '\n'
        );
        stdout.emit(
          'data',
          JSON.stringify({
            type: 'result',
            subtype: 'success',
          }) + '\n'
        );
        (mockProcess as any).emit('exit', 0);
        (mockProcess as any).cleanup();
      }, 10);

      const sessionId = await initPromise;

      expect(sessionId).toBe('custom-session-id');
    });

    it('should throw error if CLI is not installed', async () => {
      console.log('[Test] Testing error when CLI is not installed');

      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });

      await expect(ClaudeCodeCLIService.initializeSession()).rejects.toThrow(
        'Claude Code CLI is not installed'
      );
    });

    it('should throw error if no session ID received', async () => {
      console.log('[Test] Testing error when no session ID received');

      const { mockProcess, stdout } = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const initPromise = ClaudeCodeCLIService.initializeSession();

      setTimeout(() => {
        stdout.emit(
          'data',
          JSON.stringify({
            type: 'result',
            subtype: 'success',
          }) + '\n'
        );
        (mockProcess as any).emit('exit', 0);
        (mockProcess as any).cleanup();
      }, 10);

      await expect(initPromise).rejects.toThrow('No session ID received from Claude Code');
    });
  });

  describe('queryClaudeCode', () => {
    let service: ClaudeCodeCLIService;

    beforeEach(() => {
      service = ClaudeCodeCLIService.getInstance();
      mockMkdtemp.mockResolvedValue('/tmp/claude-attachments-123');
      mockWriteFile.mockResolvedValue();
      mockRm.mockResolvedValue(undefined);
    });

    it('should stream messages from CLI output', async () => {
      console.log('[Test] Testing message streaming');

      const { mockProcess, stdout } = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const queryId = 'test-query-id';
      const sessionId = 'test-session-id';

      const queryPromise = (async () => {
        const messages: any[] = [];
        for await (const message of service.queryClaudeCode(queryId, {
          prompt: 'Test prompt',
          sessionId,
        })) {
          messages.push(message);
        }
        return messages;
      })();

      // Simulate CLI output
      setTimeout(() => {
        stdout.emit(
          'data',
          JSON.stringify({
            type: 'system',
            subtype: 'init',
            session_id: sessionId,
            cwd: '/test/path',
            tools: ['Read', 'Write'],
          }) + '\n'
        );
        stdout.emit(
          'data',
          JSON.stringify({
            type: 'message',
            role: 'assistant',
            content: 'Test response',
          }) + '\n'
        );
        stdout.emit(
          'data',
          JSON.stringify({
            type: 'result',
            subtype: 'success',
            session_id: sessionId,
          }) + '\n'
        );
        (mockProcess as any).emit('exit', 0);
        (mockProcess as any).cleanup();
      }, 10);

      const messages = await queryPromise;

      expect(messages).toHaveLength(3);
      expect(messages[0].type).toBe('system');
      expect(messages[0].subtype).toBe('init');
      expect(messages[1].type).toBe('message');
      expect(messages[2].type).toBe('result');
    });

    it('should handle attachments by creating temporary files', async () => {
      console.log('[Test] Testing attachment handling');

      const { mockProcess, stdout } = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const queryId = 'test-query-id';
      const attachment: Attachment = {
        type: 'image',
        media_type: 'image/png',
        data: Buffer.from('test image').toString('base64'),
        filename: 'test.png',
      };

      const queryPromise = (async () => {
        const messages: any[] = [];
        for await (const message of service.queryClaudeCode(queryId, {
          prompt: 'Test with attachment',
          attachments: [attachment],
        })) {
          messages.push(message);
        }
        return messages;
      })();

      setTimeout(() => {
        stdout.emit(
          'data',
          JSON.stringify({
            type: 'result',
            subtype: 'success',
          }) + '\n'
        );
        (mockProcess as any).emit('exit', 0);
        (mockProcess as any).cleanup();
      }, 10);

      await queryPromise;

      expect(mockMkdtemp).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/tmp/claude-attachments-123/test.png',
        expect.any(Buffer)
      );
      expect(mockRm).toHaveBeenCalledWith('/tmp/claude-attachments-123', {
        recursive: true,
        force: true,
      });
    });

    it('should resume existing session when session ID is mapped', async () => {
      console.log('[Test] Testing session resumption');

      const { mockProcess, stdout } = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const queryId = 'test-query-id';
      const agentSessionId = 'agent-session-id';
      const claudeSessionId = 'claude-session-id';

      // Pre-populate session mapping
      service.setSessionMapping(agentSessionId, claudeSessionId);

      const queryPromise = (async () => {
        const messages: any[] = [];
        for await (const message of service.queryClaudeCode(queryId, {
          prompt: 'Continue conversation',
          sessionId: agentSessionId,
        })) {
          messages.push(message);
        }
        return messages;
      })();

      setTimeout(() => {
        stdout.emit(
          'data',
          JSON.stringify({
            type: 'result',
            subtype: 'success',
          }) + '\n'
        );
        (mockProcess as any).emit('exit', 0);
        (mockProcess as any).cleanup();
      }, 10);

      await queryPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining(['--resume', claudeSessionId]),
        expect.any(Object)
      );
    });

    it('should handle permission denials and create permission requests', async () => {
      console.log('[Test] Testing permission denial handling');

      const { mockProcess, stdout } = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const queryId = 'test-query-id';

      const queryPromise = (async () => {
        const messages: any[] = [];
        for await (const message of service.queryClaudeCode(queryId, {
          prompt: 'Test prompt',
        })) {
          messages.push(message);
        }
        return messages;
      })();

      setTimeout(() => {
        stdout.emit(
          'data',
          JSON.stringify({
            type: 'result',
            subtype: 'success',
            session_id: 'test-session',
            permission_denials: [
              {
                tool_name: 'Edit',
                tool_use_id: 'tool-123',
                tool_input: {
                  file_path: '/path/to/file.ts',
                  old_string: 'old content',
                  new_string: 'new content',
                },
              },
            ],
          }) + '\n'
        );
        (mockProcess as any).emit('exit', 0);
        (mockProcess as any).cleanup();
      }, 10);

      const messages = await queryPromise;

      expect(messages[0].__permissionRequest).toBeDefined();
      expect(messages[0].__permissionRequest?.tool_name).toBe('Edit');
      expect(messages[0].__permissionRequest?.file_path).toBe('/path/to/file.ts');
    });

    it('should handle stderr errors', async () => {
      console.log('[Test] Testing stderr error handling');

      const { mockProcess, stderr } = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const queryId = 'test-query-id';
      const sessionId = 'test-session-id';

      const queryPromise = (async () => {
        const messages: any[] = [];
        for await (const message of service.queryClaudeCode(queryId, {
          prompt: 'Test prompt',
          sessionId,
        })) {
          messages.push(message);
        }
        return messages;
      })();

      setTimeout(() => {
        stderr.emit('data', 'No conversation found with session ID');
        (mockProcess as any).emit('exit', 1);
        (mockProcess as any).cleanup();
      }, 10);

      await expect(queryPromise).rejects.toThrow('No conversation found with session ID');

      // Verify session was cleared
      expect(service.getSessionId(sessionId)).toBeUndefined();
    });

    it('should convert slash command format from /command:subcommand to /command/subcommand', async () => {
      console.log('[Test] Testing slash command format conversion');

      const { mockProcess, stdout } = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const queryId = 'test-query-id';

      const queryPromise = (async () => {
        const messages: any[] = [];
        for await (const message of service.queryClaudeCode(queryId, {
          prompt: '/engineering:write-code Implement feature',
        })) {
          messages.push(message);
        }
        return messages;
      })();

      setTimeout(() => {
        stdout.emit(
          'data',
          JSON.stringify({
            type: 'result',
            subtype: 'success',
          }) + '\n'
        );
        (mockProcess as any).emit('exit', 0);
        (mockProcess as any).cleanup();
      }, 10);

      await queryPromise;

      // Verify the prompt was modified
      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining([expect.stringContaining('/engineering/write-code')]),
        expect.any(Object)
      );
    });

    it('should pass all CLI options correctly', async () => {
      console.log('[Test] Testing CLI option passing');

      const { mockProcess, stdout } = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const queryId = 'test-query-id';
      const options = {
        maxTurns: 5,
        systemPrompt: 'You are a helpful assistant',
        allowedTools: ['Read', 'Write'],
        model: 'claude-opus-4-20250514',
        permissionMode: 'strict',
        cwd: '/custom/path',
      };

      const queryPromise = (async () => {
        const messages: any[] = [];
        for await (const message of service.queryClaudeCode(queryId, {
          prompt: 'Test prompt',
          options,
        })) {
          messages.push(message);
        }
        return messages;
      })();

      setTimeout(() => {
        stdout.emit(
          'data',
          JSON.stringify({
            type: 'result',
            subtype: 'success',
          }) + '\n'
        );
        (mockProcess as any).emit('exit', 0);
        (mockProcess as any).cleanup();
      }, 10);

      await queryPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining([
          '--max-turns',
          '5',
          '--system-prompt',
          'You are a helpful assistant',
          '--allowedTools',
          'Read,Write',
          '--model',
          'claude-opus-4-20250514',
          '--permission-mode',
          'strict',
        ]),
        expect.objectContaining({
          cwd: expect.any(String),
        })
      );
    });

    it('should handle tool use messages for permission tracking', async () => {
      console.log('[Test] Testing tool use tracking for permissions');

      const { mockProcess, stdout } = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const queryId = 'test-query-id';

      const queryPromise = (async () => {
        const messages: any[] = [];
        for await (const message of service.queryClaudeCode(queryId, {
          prompt: 'Test prompt',
        })) {
          messages.push(message);
        }
        return messages;
      })();

      setTimeout(() => {
        // First send assistant message with tool use
        stdout.emit(
          'data',
          JSON.stringify({
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'tool_use',
                  tool_use: {
                    id: 'tool-456',
                    name: 'Edit',
                    input: {
                      file_path: '/test/file.ts',
                      old_string: 'old',
                      new_string: 'new',
                    },
                  },
                },
              ],
            },
          }) + '\n'
        );

        // Then send user message with permission error
        stdout.emit(
          'data',
          JSON.stringify({
            type: 'user',
            message: {
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: 'tool-456',
                  is_error: true,
                  content: 'Claude requested permissions to write to /test/file.ts, but was denied',
                },
              ],
            },
          }) + '\n'
        );

        stdout.emit(
          'data',
          JSON.stringify({
            type: 'result',
            subtype: 'success',
          }) + '\n'
        );
        (mockProcess as any).emit('exit', 0);
        (mockProcess as any).cleanup();
      }, 10);

      const messages = await queryPromise;

      // Find the user message with permission request
      const userMsg = messages.find((m) => m.type === 'user' && m.__permissionRequest);
      expect(userMsg).toBeDefined();
      expect(userMsg?.__permissionRequest?.tool_name).toBe('Edit');
      expect(userMsg?.__permissionRequest?.file_path).toBe('/test/file.ts');
    });

    it('should clean up temp directory on error', async () => {
      console.log('[Test] Testing temp directory cleanup on error');

      const { mockProcess } = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      mockMkdtemp.mockResolvedValue('/tmp/claude-attachments-456');

      const queryId = 'test-query-id';
      const attachment: Attachment = {
        type: 'document',
        media_type: 'text/plain',
        data: Buffer.from('test').toString('base64'),
      };

      const queryPromise = (async () => {
        const messages: any[] = [];
        for await (const message of service.queryClaudeCode(queryId, {
          prompt: 'Test prompt',
          attachments: [attachment],
        })) {
          messages.push(message);
        }
        return messages;
      })();

      setTimeout(() => {
        (mockProcess as any).emit('error', new Error('Process error'));
        (mockProcess as any).cleanup();
      }, 10);

      await expect(queryPromise).rejects.toThrow('Process error');

      expect(mockRm).toHaveBeenCalledWith('/tmp/claude-attachments-456', {
        recursive: true,
        force: true,
      });
    });
  });

  describe('abortQuery', () => {
    let service: ClaudeCodeCLIService;

    beforeEach(() => {
      service = ClaudeCodeCLIService.getInstance();
    });

    it('should kill active process', async () => {
      console.log('[Test] Testing process kill');

      const { mockProcess, stdout } = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const queryId = 'test-query-id';

      // Start query but don't await
      const queryPromise = (async () => {
        const messages: any[] = [];
        for await (const message of service.queryClaudeCode(queryId, {
          prompt: 'Test prompt',
        })) {
          messages.push(message);
        }
        return messages;
      })();

      // Give time for process to register
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Abort the query
      service.abortQuery(queryId);

      expect((mockProcess as any).kill).toHaveBeenCalled();

      // Clean up
      setTimeout(() => {
        stdout.emit(
          'data',
          JSON.stringify({
            type: 'result',
            subtype: 'success',
          }) + '\n'
        );
        (mockProcess as any).emit('exit', 0);
        (mockProcess as any).cleanup();
      }, 10);

      try {
        await queryPromise;
      } catch {
        // Expected to fail
      }
    });

    it('should not throw error when aborting non-existent query', () => {
      console.log('[Test] Testing abort of non-existent query');

      expect(() => {
        service.abortQuery('non-existent-query-id');
      }).not.toThrow();
    });
  });

  describe('session management', () => {
    let service: ClaudeCodeCLIService;

    beforeEach(() => {
      service = ClaudeCodeCLIService.getInstance();
    });

    it('should store session mapping on init message', async () => {
      console.log('[Test] Testing session mapping storage');

      const { mockProcess, stdout } = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const queryId = 'test-query-id';
      const agentSessionId = 'agent-session-id';
      const claudeSessionId = 'claude-session-id';

      const queryPromise = (async () => {
        const messages: any[] = [];
        for await (const message of service.queryClaudeCode(queryId, {
          prompt: 'Test prompt',
          sessionId: agentSessionId,
        })) {
          messages.push(message);
        }
        return messages;
      })();

      setTimeout(() => {
        stdout.emit(
          'data',
          JSON.stringify({
            type: 'system',
            subtype: 'init',
            session_id: claudeSessionId,
          }) + '\n'
        );
        stdout.emit(
          'data',
          JSON.stringify({
            type: 'result',
            subtype: 'success',
          }) + '\n'
        );
        (mockProcess as any).emit('exit', 0);
        (mockProcess as any).cleanup();
      }, 10);

      await queryPromise;

      expect(service.getSessionId(agentSessionId)).toBe(claudeSessionId);
    });

    it('should get session ID for agent', () => {
      console.log('[Test] Testing getSessionId');

      const agentId = 'agent-123';
      const claudeSessionId = 'claude-session-123';

      service.setSessionMapping(agentId, claudeSessionId);

      expect(service.getSessionId(agentId)).toBe(claudeSessionId);
    });

    it('should return undefined for non-existent session', () => {
      console.log('[Test] Testing getSessionId for non-existent session');

      expect(service.getSessionId('non-existent')).toBeUndefined();
    });

    it('should clear specific session', () => {
      console.log('[Test] Testing clearSessionForEntry');

      const agentId = 'agent-123';
      const claudeSessionId = 'claude-session-123';

      service.setSessionMapping(agentId, claudeSessionId);

      const result = service.clearSessionForEntry(agentId);

      expect(result).toBe(true);
      expect(service.getSessionId(agentId)).toBeUndefined();
    });

    it('should return false when clearing non-existent session', () => {
      console.log('[Test] Testing clearSessionForEntry for non-existent session');

      const result = service.clearSessionForEntry('non-existent');

      expect(result).toBe(false);
    });

    it('should clear all sessions', () => {
      console.log('[Test] Testing clearSessions');

      service.setSessionMapping('agent-1', 'session-1');
      service.setSessionMapping('agent-2', 'session-2');

      service.clearSessions();

      expect(service.getSessionId('agent-1')).toBeUndefined();
      expect(service.getSessionId('agent-2')).toBeUndefined();
    });
  });

  describe('parseFileChangeMessage', () => {
    let service: ClaudeCodeCLIService;

    beforeEach(() => {
      service = ClaudeCodeCLIService.getInstance();
    });

    it('should parse file change message from tool result', () => {
      console.log('[Test] Testing file change message parsing');

      const message = {
        type: 'result',
        tool_results: [
          {
            type: 'edit',
            file_path: '/path/to/file.ts',
            old_content: 'old code',
            new_content: 'new code',
          },
        ],
        session_id: 'test-session',
      };

      const result = service.parseFileChangeMessage(message);

      expect(result).toBeDefined();
      expect(result?.fileChanges).toHaveLength(1);
      expect(result?.fileChanges[0].filePath).toBe('/path/to/file.ts');
    });

    it('should parse file change from tool_calls', () => {
      console.log('[Test] Testing parseFileChangeMessage with tool_calls');

      const message = {
        type: 'assistant',
        tool_calls: [
          {
            name: 'file_edit',
            input: {
              file_path: '/path/to/file.ts',
              new_content: 'new code',
              old_content: 'old code',
            },
            id: 'tool-123',
          },
        ],
        session_id: 'test-session',
      };

      const result = service.parseFileChangeMessage(message);

      expect(result).toBeDefined();
      expect(result?.fileChanges).toHaveLength(1);
      expect(result?.fileChanges[0].filePath).toBe('/path/to/file.ts');
    });

    it('should return null for non-file-change messages', () => {
      console.log('[Test] Testing parseFileChangeMessage with regular message');

      const message = {
        type: 'message',
        role: 'assistant' as const,
        content: 'Hello',
      };

      const result = service.parseFileChangeMessage(message);

      expect(result).toBeNull();
    });

    it('should parse file change from string JSON', () => {
      console.log('[Test] Testing parseFileChangeMessage with JSON string');

      const messageString = JSON.stringify({
        type: 'result',
        tool_results: [
          {
            type: 'edit',
            file_path: '/path/to/file.ts',
            new_content: 'new code',
          },
        ],
        session_id: 'test-session',
      });

      const result = service.parseFileChangeMessage(messageString);

      expect(result).toBeDefined();
      expect(result?.fileChanges).toHaveLength(1);
    });
  });

  describe('getExtensionFromMimeType', () => {
    let service: ClaudeCodeCLIService;

    beforeEach(() => {
      service = ClaudeCodeCLIService.getInstance();
    });

    it('should return correct extensions for image types', () => {
      console.log('[Test] Testing MIME type to extension conversion for images');

      expect((service as any).getExtensionFromMimeType('image/jpeg')).toBe('.jpg');
      expect((service as any).getExtensionFromMimeType('image/png')).toBe('.png');
      expect((service as any).getExtensionFromMimeType('image/gif')).toBe('.gif');
      expect((service as any).getExtensionFromMimeType('image/webp')).toBe('.webp');
    });

    it('should return correct extensions for document types', () => {
      console.log('[Test] Testing MIME type to extension conversion for documents');

      expect((service as any).getExtensionFromMimeType('text/plain')).toBe('.txt');
      expect((service as any).getExtensionFromMimeType('text/markdown')).toBe('.md');
      expect((service as any).getExtensionFromMimeType('application/pdf')).toBe('.pdf');
    });

    it('should return correct extensions for code types', () => {
      console.log('[Test] Testing MIME type to extension conversion for code');

      expect((service as any).getExtensionFromMimeType('text/javascript')).toBe('.js');
      expect((service as any).getExtensionFromMimeType('application/x-typescript')).toBe('.ts');
      expect((service as any).getExtensionFromMimeType('text/x-python')).toBe('.py');
      expect((service as any).getExtensionFromMimeType('application/json')).toBe('.json');
    });

    it('should return .bin for unknown mime types', () => {
      console.log('[Test] Testing MIME type to extension conversion for unknown types');

      expect((service as any).getExtensionFromMimeType('unknown/type')).toBe('.bin');
      expect((service as any).getExtensionFromMimeType('application/octet-stream')).toBe('.bin');
    });
  });

  describe('Edge cases', () => {
    let service: ClaudeCodeCLIService;

    beforeEach(() => {
      service = ClaudeCodeCLIService.getInstance();
      mockMkdtemp.mockResolvedValue('/tmp/claude-attachments-789');
      mockWriteFile.mockResolvedValue();
    });

    it('should handle attachments without filename', async () => {
      console.log('[Test] Testing attachment without filename');

      const { mockProcess, stdout } = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const attachment: Attachment = {
        type: 'document',
        media_type: 'text/plain',
        data: Buffer.from('test').toString('base64'),
      };

      const queryPromise = (async () => {
        const messages: any[] = [];
        for await (const message of service.queryClaudeCode('query-1', {
          prompt: 'Test',
          attachments: [attachment],
        })) {
          messages.push(message);
        }
        return messages;
      })();

      setTimeout(() => {
        stdout.emit(
          'data',
          JSON.stringify({
            type: 'result',
            subtype: 'success',
          }) + '\n'
        );
        (mockProcess as any).emit('exit', 0);
        (mockProcess as any).cleanup();
      }, 10);

      await queryPromise;

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringMatching(/\/tmp\/claude-attachments-789\/attachment_\d+\.txt/),
        expect.any(Buffer)
      );
    });

    it('should handle malformed JSON lines gracefully', async () => {
      console.log('[Test] Testing malformed JSON handling');

      const { mockProcess, stdout } = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const queryPromise = (async () => {
        const messages: any[] = [];
        for await (const message of service.queryClaudeCode('query-2', {
          prompt: 'Test',
        })) {
          messages.push(message);
        }
        return messages;
      })();

      setTimeout(() => {
        stdout.emit('data', 'This is not JSON\n');
        stdout.emit(
          'data',
          JSON.stringify({
            type: 'result',
            subtype: 'success',
          }) + '\n'
        );
        (mockProcess as any).emit('exit', 0);
        (mockProcess as any).cleanup();
      }, 10);

      const messages = await queryPromise;

      // Should only have the valid message
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('result');
    });

    it('should handle empty lines in output', async () => {
      console.log('[Test] Testing empty line handling');

      const { mockProcess, stdout } = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const queryPromise = (async () => {
        const messages: any[] = [];
        for await (const message of service.queryClaudeCode('query-3', {
          prompt: 'Test',
        })) {
          messages.push(message);
        }
        return messages;
      })();

      setTimeout(() => {
        stdout.emit('data', '\n');
        stdout.emit('data', '  \n');
        stdout.emit(
          'data',
          JSON.stringify({
            type: 'result',
            subtype: 'success',
          }) + '\n'
        );
        (mockProcess as any).emit('exit', 0);
        (mockProcess as any).cleanup();
      }, 10);

      const messages = await queryPromise;

      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('result');
    });
  });
});
