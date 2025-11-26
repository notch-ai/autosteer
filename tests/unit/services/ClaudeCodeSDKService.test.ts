import { ClaudeCodeSDKService } from '@/services/ClaudeCodeSDKService';
import type { ClaudeCodeQueryOptions, Attachment } from '@/types/claudeCode.types';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { useSettingsStore } from '@/stores/settings';
import * as fs from 'fs/promises';

// Mock @anthropic-ai/claude-agent-sdk
jest.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: jest.fn(),
}));

// Mock fs/promises
jest.mock('fs/promises', () => ({
  mkdtemp: jest.fn(),
  writeFile: jest.fn(),
  rm: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
}));

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
}));

// Mock os
jest.mock('os', () => ({
  tmpdir: jest.fn(() => '/tmp'),
  homedir: jest.fn(() => '/home/test-user'),
}));

// Mock path
jest.mock('path', () => {
  const actualPath = {
    join: (...args: string[]) => args.join('/'),
    resolve: (...args: string[]) => args.join('/'),
    isAbsolute: (p: string) => p.startsWith('/'),
    dirname: (p: string) => {
      const parts = p.split('/');
      parts.pop();
      return parts.join('/');
    },
    basename: (p: string) => {
      const parts = p.split('/');
      return parts[parts.length - 1];
    },
  };
  return actualPath;
});

// Mock electron-log
jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

// Mock settings store
jest.mock('@/stores/settings', () => ({
  useSettingsStore: {
    getState: jest.fn(() => ({
      preferences: {
        enableSkills: true, // Default to true
      } as any, // Cast to allow partial UserPreferences in tests
    })),
  },
}));

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockMkdtemp = fs.mkdtemp as jest.MockedFunction<typeof fs.mkdtemp>;
const mockWriteFile = fs.writeFile as jest.MockedFunction<typeof fs.writeFile>;
const mockRm = fs.rm as jest.MockedFunction<typeof fs.rm>;
const mockGetState = useSettingsStore.getState as jest.MockedFunction<
  typeof useSettingsStore.getState
>;

describe('ClaudeCodeSDKService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance
    (ClaudeCodeSDKService as any).instance = null;
  });

  describe('getInstance', () => {
    it('should create a singleton instance', () => {
      const instance1 = ClaudeCodeSDKService.getInstance();
      const instance2 = ClaudeCodeSDKService.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(ClaudeCodeSDKService);
    });
  });

  describe('queryClaudeCode', () => {
    let service: ClaudeCodeSDKService;

    beforeEach(() => {
      service = ClaudeCodeSDKService.getInstance();
      mockMkdtemp.mockResolvedValue('/tmp/claude-attachments-123');
      mockWriteFile.mockResolvedValue();
      mockRm.mockResolvedValue(undefined);
    });

    it('should handle basic query without attachments', async () => {
      const mockMessages = [
        { type: 'init', session_id: 'test-session' },
        { type: 'message', role: 'assistant', content: 'Hello!' },
        { type: 'result', subtype: 'success' },
      ];

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const message of mockMessages) {
            yield message;
          }
        },
        interrupt: jest.fn(),
      } as any);

      const queryOptions: ClaudeCodeQueryOptions = {
        prompt: 'Hello',
        sessionId: 'agent-123',
      };

      const results = [];
      for await (const message of service.queryClaudeCode('query-1', queryOptions)) {
        results.push(message);
      }

      expect(results).toHaveLength(3);
      expect(results[0].type).toBe('system');
      expect(results[0].subtype).toBe('init');
      expect(results[1].type).toBe('message');
      expect(results[2].type).toBe('result');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Hello',
          options: expect.objectContaining({
            pathToClaudeCodeExecutable: expect.any(String),
            settingSources: expect.arrayContaining(['project', 'local', 'user']),
          }),
        })
      );
    });

    it('should handle query with attachments', async () => {
      const attachment: Attachment = {
        type: 'image',
        media_type: 'image/png',
        data: Buffer.from('test image').toString('base64'),
        filename: 'test.png',
      };

      const mockMessages = [
        { type: 'init', session_id: 'test-session' },
        { type: 'result', subtype: 'success' },
      ];

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const message of mockMessages) {
            yield message;
          }
        },
        interrupt: jest.fn(),
      } as any);

      const queryOptions: ClaudeCodeQueryOptions = {
        prompt: 'Analyze this image',
        attachments: [attachment],
      };

      const results = [];
      for await (const message of service.queryClaudeCode('query-2', queryOptions)) {
        results.push(message);
      }

      expect(mockMkdtemp).toHaveBeenCalledWith('/tmp/claude-attachments-');
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/tmp/claude-attachments-123/test.png',
        expect.any(Buffer)
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Attached files:'),
          options: expect.objectContaining({
            allowedTools: expect.arrayContaining(['Read']),
          }),
        })
      );
      expect(mockRm).toHaveBeenCalledWith('/tmp/claude-attachments-123', {
        recursive: true,
        force: true,
      });
    });

    it('should handle session resumption', async () => {
      // Set up session mapping
      service.setSessionMapping('agent-456', 'claude-session-789');

      const mockMessages = [
        { type: 'init', session_id: 'claude-session-789' },
        { type: 'result', subtype: 'success' },
      ];

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const message of mockMessages) {
            yield message;
          }
        },
        interrupt: jest.fn(),
      } as any);

      const queryOptions: ClaudeCodeQueryOptions = {
        prompt: 'Continue conversation',
        sessionId: 'agent-456',
      };

      const results = [];
      for await (const message of service.queryClaudeCode('query-3', queryOptions)) {
        results.push(message);
      }

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Continue conversation',
          options: expect.objectContaining({
            resume: 'claude-session-789',
          }),
        })
      );
    });

    it('should handle query with all options', async () => {
      const mockMessages = [
        { type: 'init', session_id: 'test-session' },
        { type: 'result', subtype: 'success' },
      ];

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const message of mockMessages) {
            yield message;
          }
        },
        interrupt: jest.fn(),
      } as any);

      const queryOptions: ClaudeCodeQueryOptions = {
        prompt: 'Test prompt',
        options: {
          maxTurns: 5,
          systemPrompt: 'You are a helpful assistant',
          allowedTools: ['Read', 'Write'],
          model: 'claude-3-sonnet',
          cwd: '~/projects/test',
          permissionMode: 'strict',
        },
      };

      const results = [];
      for await (const message of service.queryClaudeCode('query-4', queryOptions)) {
        results.push(message);
      }

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Test prompt',
          options: expect.objectContaining({
            maxTurns: 5,
            systemPrompt: 'You are a helpful assistant',
            allowedTools: expect.arrayContaining(['Read', 'Write', 'Skill']), // Skills enabled by default
            model: 'claude-3-sonnet',
            permissionMode: 'strict',
          }),
        })
      );
    });

    it('should store session mapping on init message', async () => {
      const mockMessages = [
        { type: 'init', session_id: 'claude-session-new' },
        { type: 'result', subtype: 'success' },
      ];

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const message of mockMessages) {
            yield message;
          }
        },
        interrupt: jest.fn(),
      } as any);

      const results = [];
      for await (const message of service.queryClaudeCode('query-5', {
        prompt: 'Test',
        sessionId: 'agent-new',
      })) {
        results.push(message);
      }

      expect(service.getSessionId('agent-new')).toBe('claude-session-new');
    });

    it('should handle SDK errors during query', async () => {
      mockQuery.mockImplementation(() => {
        throw new Error('SDK query failed');
      });

      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _message of service.queryClaudeCode('query-6', { prompt: 'Test' })) {
          // Should throw
        }
      }).rejects.toThrow('SDK query failed');
    });

    it('should clean up temp directory on error', async () => {
      mockMkdtemp.mockResolvedValue('/tmp/claude-attachments-456');
      mockWriteFile.mockResolvedValue();

      const attachment: Attachment = {
        type: 'document',
        media_type: 'text/plain',
        data: Buffer.from('test').toString('base64'),
      };

      mockQuery.mockImplementation(() => {
        throw new Error('SDK error');
      });

      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _message of service.queryClaudeCode('query-7', {
          prompt: 'Test',
          attachments: [attachment],
        })) {
          // Should throw
        }
      }).rejects.toThrow('SDK error');

      expect(mockRm).toHaveBeenCalledWith('/tmp/claude-attachments-456', {
        recursive: true,
        force: true,
      });
    });

    it('should convert slash command format', async () => {
      const mockMessages = [
        { type: 'init', session_id: 'test-session' },
        { type: 'result', subtype: 'success' },
      ];

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const message of mockMessages) {
            yield message;
          }
        },
        interrupt: jest.fn(),
      } as any);

      const results = [];
      for await (const message of service.queryClaudeCode('query-8', {
        prompt: '/command:subcommand test',
      })) {
        results.push(message);
      }

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: '/command/subcommand test',
          options: expect.any(Object),
        })
      );
    });
  });

  describe('abortQuery', () => {
    let service: ClaudeCodeSDKService;

    beforeEach(() => {
      service = ClaudeCodeSDKService.getInstance();
    });

    it('should abort active query', async () => {
      const mockInterrupt = jest.fn();
      const mockMessages = [
        { type: 'init', session_id: 'test' },
        { type: 'message', content: 'Processing...' },
      ];

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const message of mockMessages) {
            yield message;
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        },
        interrupt: mockInterrupt,
      } as any);

      const queryPromise = (async () => {
        const results = [];
        for await (const message of service.queryClaudeCode('abort-test', { prompt: 'Test' })) {
          results.push(message);
        }
        return results;
      })();

      // Give it time to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Abort the query
      service.abortQuery('abort-test');

      expect(mockInterrupt).toHaveBeenCalled();

      // Clean up
      try {
        await queryPromise;
      } catch {
        // Expected to fail
      }
    });

    it('should handle aborting non-existent query', () => {
      expect(() => service.abortQuery('non-existent')).not.toThrow();
    });
  });

  describe('Session management methods', () => {
    let service: ClaudeCodeSDKService;

    beforeEach(() => {
      service = ClaudeCodeSDKService.getInstance();
    });

    describe('clearSessions', () => {
      it('should clear all sessions', () => {
        service.setSessionMapping('agent1', 'session1');
        service.setSessionMapping('agent2', 'session2');

        expect(service.getSessionId('agent1')).toBe('session1');
        expect(service.getSessionId('agent2')).toBe('session2');

        service.clearSessions();

        expect(service.getSessionId('agent1')).toBeUndefined();
        expect(service.getSessionId('agent2')).toBeUndefined();
      });
    });

    describe('clearSessionForEntry', () => {
      it('should clear specific session and return true', () => {
        service.setSessionMapping('agent1', 'session1');
        service.setSessionMapping('agent2', 'session2');

        const result = service.clearSessionForEntry('agent1');

        expect(result).toBe(true);
        expect(service.getSessionId('agent1')).toBeUndefined();
        expect(service.getSessionId('agent2')).toBe('session2');
      });

      it('should return false for non-existent entry', () => {
        const result = service.clearSessionForEntry('non-existent');
        expect(result).toBe(false);
      });
    });

    describe('getSessionId', () => {
      it('should return session ID for existing entry', () => {
        service.setSessionMapping('agent1', 'session1');
        expect(service.getSessionId('agent1')).toBe('session1');
      });

      it('should return undefined for non-existent entry', () => {
        expect(service.getSessionId('non-existent')).toBeUndefined();
      });
    });

    describe('setSessionMapping', () => {
      it('should set new session mapping', () => {
        service.setSessionMapping('agent1', 'session1');
        expect(service.getSessionId('agent1')).toBe('session1');
      });

      it('should overwrite existing mapping', () => {
        service.setSessionMapping('agent1', 'session1');
        service.setSessionMapping('agent1', 'session2');
        expect(service.getSessionId('agent1')).toBe('session2');
      });
    });
  });

  describe('Message adaptation', () => {
    let service: ClaudeCodeSDKService;

    beforeEach(() => {
      service = ClaudeCodeSDKService.getInstance();
    });

    it('should adapt init messages', async () => {
      const mockMessages = [
        {
          type: 'init',
          session_id: 'test-session',
          cwd: '/test',
          tools: ['Read', 'Write'],
          model: 'claude-3-sonnet',
        },
      ];

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const message of mockMessages) {
            yield message;
          }
        },
        interrupt: jest.fn(),
      } as any);

      const results = [];
      for await (const message of service.queryClaudeCode('query-1', { prompt: 'Test' })) {
        results.push(message);
      }

      expect(results[0]).toMatchObject({
        type: 'system',
        subtype: 'init',
        session_id: 'test-session',
        cwd: '/test',
        tools: ['Read', 'Write'],
        model: 'claude-3-sonnet',
      });
    });

    it('should adapt message events', async () => {
      const mockMessages = [
        {
          type: 'message',
          role: 'assistant',
          content: 'Test response',
        },
      ];

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const message of mockMessages) {
            yield message;
          }
        },
        interrupt: jest.fn(),
      } as any);

      const results = [];
      for await (const message of service.queryClaudeCode('query-2', { prompt: 'Test' })) {
        results.push(message);
      }

      expect(results[0]).toMatchObject({
        type: 'message',
        role: 'assistant',
        content: 'Test response',
      });
    });

    it('should adapt tool call messages', async () => {
      const mockMessages = [
        {
          type: 'tool_call',
          content: { tool: 'Read', params: {} },
        },
      ];

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const message of mockMessages) {
            yield message;
          }
        },
        interrupt: jest.fn(),
      } as any);

      const results = [];
      for await (const message of service.queryClaudeCode('query-3', { prompt: 'Test' })) {
        results.push(message);
      }

      expect(results[0]).toMatchObject({
        type: 'tool_call',
      });
    });

    it('should adapt result messages', async () => {
      const mockMessages = [
        {
          type: 'result',
          subtype: 'success',
          num_turns: 3,
          duration_ms: 1500,
          total_cost_usd: 0.05,
        },
      ];

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const message of mockMessages) {
            yield message;
          }
        },
        interrupt: jest.fn(),
      } as any);

      const results = [];
      for await (const message of service.queryClaudeCode('query-4', { prompt: 'Test' })) {
        results.push(message);
      }

      expect(results[0]).toMatchObject({
        type: 'result',
        subtype: 'success',
        num_turns: 3,
        duration_ms: 1500,
        total_cost_usd: 0.05,
      });
    });

    it('should adapt error messages', async () => {
      const mockMessages = [
        {
          type: 'error',
          error: 'Test error',
        },
      ];

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const message of mockMessages) {
            yield message;
          }
        },
        interrupt: jest.fn(),
      } as any);

      const results = [];
      for await (const message of service.queryClaudeCode('query-5', { prompt: 'Test' })) {
        results.push(message);
      }

      expect(results[0]).toMatchObject({
        type: 'error',
        error: 'Test error',
        is_error: true,
      });
    });
  });

  describe('getExtensionFromMimeType', () => {
    let service: ClaudeCodeSDKService;

    beforeEach(() => {
      service = ClaudeCodeSDKService.getInstance();
    });

    it('should return correct extensions for image types', () => {
      expect((service as any).getExtensionFromMimeType('image/jpeg')).toBe('.jpg');
      expect((service as any).getExtensionFromMimeType('image/png')).toBe('.png');
      expect((service as any).getExtensionFromMimeType('image/gif')).toBe('.gif');
      expect((service as any).getExtensionFromMimeType('image/webp')).toBe('.webp');
      expect((service as any).getExtensionFromMimeType('image/bmp')).toBe('.bmp');
      expect((service as any).getExtensionFromMimeType('image/svg+xml')).toBe('.svg');
    });

    it('should return correct extensions for document types', () => {
      expect((service as any).getExtensionFromMimeType('text/plain')).toBe('.txt');
      expect((service as any).getExtensionFromMimeType('text/markdown')).toBe('.md');
      expect((service as any).getExtensionFromMimeType('application/pdf')).toBe('.pdf');
      expect((service as any).getExtensionFromMimeType('application/msword')).toBe('.doc');
      expect(
        (service as any).getExtensionFromMimeType(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
      ).toBe('.docx');
    });

    it('should return correct extensions for code types', () => {
      expect((service as any).getExtensionFromMimeType('text/javascript')).toBe('.js');
      expect((service as any).getExtensionFromMimeType('application/x-typescript')).toBe('.ts');
      expect((service as any).getExtensionFromMimeType('text/x-python')).toBe('.py');
      expect((service as any).getExtensionFromMimeType('text/x-java')).toBe('.java');
      expect((service as any).getExtensionFromMimeType('text/html')).toBe('.html');
      expect((service as any).getExtensionFromMimeType('text/css')).toBe('.css');
      expect((service as any).getExtensionFromMimeType('application/json')).toBe('.json');
    });

    it('should return .bin for unknown mime types', () => {
      expect((service as any).getExtensionFromMimeType('unknown/type')).toBe('.bin');
      expect((service as any).getExtensionFromMimeType('application/octet-stream')).toBe('.bin');
    });
  });

  describe('Skills Integration (NOTCH-1534)', () => {
    let service: ClaudeCodeSDKService;

    beforeEach(() => {
      service = ClaudeCodeSDKService.getInstance();
      mockMkdtemp.mockResolvedValue('/tmp/claude-attachments-789');
      mockWriteFile.mockResolvedValue();
      // Reset mockGetState to default (enableSkills: true)
      mockGetState.mockReturnValue({
        preferences: {
          enableSkills: true,
        },
      } as any);
    });

    it('should add "Skill" to allowedTools when enableSkills is true', async () => {
      const mockMessages = [
        { type: 'init', session_id: 'test-session' },
        { type: 'result', subtype: 'success' },
      ];

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const message of mockMessages) {
            yield message;
          }
        },
        interrupt: jest.fn(),
      } as any);

      // Mock settings store with enableSkills: true
      mockGetState.mockReturnValue({
        preferences: {
          enableSkills: true,
        },
      } as any);

      const queryOptions: ClaudeCodeQueryOptions = {
        prompt: 'Test prompt',
        options: {
          allowedTools: ['Read', 'Write'],
        },
      };

      const results = [];
      for await (const message of service.queryClaudeCode('query-skills-1', queryOptions)) {
        results.push(message);
      }

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Test prompt',
          options: expect.objectContaining({
            allowedTools: expect.arrayContaining(['Read', 'Write', 'Skill']),
          }),
        })
      );
    });

    it('should NOT add "Skill" to allowedTools when enableSkills is false', async () => {
      const mockMessages = [
        { type: 'init', session_id: 'test-session' },
        { type: 'result', subtype: 'success' },
      ];

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const message of mockMessages) {
            yield message;
          }
        },
        interrupt: jest.fn(),
      } as any);

      // Mock settings store with enableSkills: false
      mockGetState.mockReturnValue({
        preferences: {
          enableSkills: false,
        },
      } as any);

      const queryOptions: ClaudeCodeQueryOptions = {
        prompt: 'Test prompt',
        options: {
          allowedTools: ['Read', 'Write'],
        },
      };

      const results = [];
      for await (const message of service.queryClaudeCode('query-skills-2', queryOptions)) {
        results.push(message);
      }

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Test prompt',
          options: expect.objectContaining({
            allowedTools: ['Read', 'Write'], // Should NOT include 'Skill'
          }),
        })
      );
    });

    it('should preserve existing allowedTools when adding Skill', async () => {
      const mockMessages = [
        { type: 'init', session_id: 'test-session' },
        { type: 'result', subtype: 'success' },
      ];

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const message of mockMessages) {
            yield message;
          }
        },
        interrupt: jest.fn(),
      } as any);

      // Mock settings store with enableSkills: true
      mockGetState.mockReturnValue({
        preferences: {
          enableSkills: true,
        },
      } as any);

      const queryOptions: ClaudeCodeQueryOptions = {
        prompt: 'Test prompt',
        options: {
          allowedTools: ['Read', 'Write', 'Bash', 'Edit'],
        },
      };

      const results = [];
      for await (const message of service.queryClaudeCode('query-skills-3', queryOptions)) {
        results.push(message);
      }

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Test prompt',
          options: expect.objectContaining({
            allowedTools: expect.arrayContaining(['Read', 'Write', 'Bash', 'Edit', 'Skill']),
          }),
        })
      );

      // Verify exact length (should be 5 tools total)
      const call = (mockQuery as jest.Mock).mock.calls[0][0];
      expect(call.options.allowedTools).toHaveLength(5);
    });

    it('should NOT duplicate "Skill" if already in allowedTools', async () => {
      const mockMessages = [
        { type: 'init', session_id: 'test-session' },
        { type: 'result', subtype: 'success' },
      ];

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const message of mockMessages) {
            yield message;
          }
        },
        interrupt: jest.fn(),
      } as any);

      // Mock settings store with enableSkills: true
      mockGetState.mockReturnValue({
        preferences: {
          enableSkills: true,
        },
      } as any);

      const queryOptions: ClaudeCodeQueryOptions = {
        prompt: 'Test prompt',
        options: {
          allowedTools: ['Read', 'Skill', 'Write'], // Skill already present
        },
      };

      const results = [];
      for await (const message of service.queryClaudeCode('query-skills-4', queryOptions)) {
        results.push(message);
      }

      // Should NOT add duplicate Skill
      const call = (mockQuery as jest.Mock).mock.calls[0][0];
      expect(call.options.allowedTools).toHaveLength(3);
      expect(call.options.allowedTools.filter((tool: string) => tool === 'Skill')).toHaveLength(1);
    });

    it('should add "Skill" to allowedTools when no allowedTools specified', async () => {
      const mockMessages = [
        { type: 'init', session_id: 'test-session' },
        { type: 'result', subtype: 'success' },
      ];

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const message of mockMessages) {
            yield message;
          }
        },
        interrupt: jest.fn(),
      } as any);

      // Mock settings store with enableSkills: true
      mockGetState.mockReturnValue({
        preferences: {
          enableSkills: true,
        },
      } as any);

      const queryOptions: ClaudeCodeQueryOptions = {
        prompt: 'Test prompt',
        options: {
          // No allowedTools specified
        },
      };

      const results = [];
      for await (const message of service.queryClaudeCode('query-skills-5', queryOptions)) {
        results.push(message);
      }

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Test prompt',
          options: expect.objectContaining({
            allowedTools: ['Skill'],
          }),
        })
      );
    });

    it('should NOT set allowedTools when enableSkills is false and no allowedTools specified', async () => {
      const mockMessages = [
        { type: 'init', session_id: 'test-session' },
        { type: 'result', subtype: 'success' },
      ];

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const message of mockMessages) {
            yield message;
          }
        },
        interrupt: jest.fn(),
      } as any);

      // Mock settings store with enableSkills: false
      mockGetState.mockReturnValue({
        preferences: {
          enableSkills: false,
        },
      } as any);

      const queryOptions: ClaudeCodeQueryOptions = {
        prompt: 'Test prompt',
        options: {
          // No allowedTools specified
        },
      };

      const results = [];
      for await (const message of service.queryClaudeCode('query-skills-6', queryOptions)) {
        results.push(message);
      }

      // Should not set allowedTools at all
      const call = (mockQuery as jest.Mock).mock.calls[0][0];
      expect(call.options.allowedTools).toBeUndefined();
    });

    it('should work with attachments when skills are enabled', async () => {
      const attachment: Attachment = {
        type: 'image',
        media_type: 'image/png',
        data: Buffer.from('test image').toString('base64'),
        filename: 'test.png',
      };

      const mockMessages = [
        { type: 'init', session_id: 'test-session' },
        { type: 'result', subtype: 'success' },
      ];

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const message of mockMessages) {
            yield message;
          }
        },
        interrupt: jest.fn(),
      } as any);

      // Mock settings store with enableSkills: true
      mockGetState.mockReturnValue({
        preferences: {
          enableSkills: true,
        },
      } as any);

      const queryOptions: ClaudeCodeQueryOptions = {
        prompt: 'Analyze this image',
        attachments: [attachment],
      };

      const results = [];
      for await (const message of service.queryClaudeCode('query-skills-7', queryOptions)) {
        results.push(message);
      }

      // Should include both Read (for attachments) and Skill
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Attached files:'),
          options: expect.objectContaining({
            allowedTools: expect.arrayContaining(['Read', 'Skill']),
          }),
        })
      );
    });
  });

  describe('Edge cases', () => {
    let service: ClaudeCodeSDKService;

    beforeEach(() => {
      service = ClaudeCodeSDKService.getInstance();
      mockMkdtemp.mockResolvedValue('/tmp/claude-attachments-789');
      mockWriteFile.mockResolvedValue();
    });

    it('should handle attachments without filename', async () => {
      const attachment: Attachment = {
        type: 'document',
        media_type: 'text/plain',
        data: Buffer.from('test').toString('base64'),
      };

      const mockMessages = [
        { type: 'init', session_id: 'test' },
        { type: 'result', subtype: 'success' },
      ];

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const message of mockMessages) {
            yield message;
          }
        },
        interrupt: jest.fn(),
      } as any);

      const results = [];
      for await (const message of service.queryClaudeCode('query-1', {
        prompt: 'Test',
        attachments: [attachment],
      })) {
        results.push(message);
      }

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringMatching(/\/tmp\/claude-attachments-789\/attachment_\d+\.txt/),
        expect.any(Buffer)
      );
    });

    it('should handle empty session ID gracefully', async () => {
      const mockMessages = [{ type: 'message', content: 'Test' }];

      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const message of mockMessages) {
            yield message;
          }
        },
        interrupt: jest.fn(),
      } as any);

      const results = [];
      for await (const message of service.queryClaudeCode('query-2', {
        prompt: 'Test',
      })) {
        results.push(message);
      }

      expect(results[0].session_id).toBe('mock-uuid-1234');
    });
  });
});
