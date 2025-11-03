/**
 * Tests for MessageConverter service
 */

import { describe, it, expect } from '@jest/globals';
import { MessageConverter } from '@/services/MessageConverter';
import type {
  SDKAssistantMessage,
  SDKUserMessage,
  SDKResultMessage,
  SDKSystemMessage,
} from '@/types/sdk.types';

describe('MessageConverter', () => {
  describe('convert', () => {
    describe('assistant messages', () => {
      it('should convert assistant message with text to ChatMessage', () => {
        const assistantMsg = {
          type: 'assistant',
          uuid: '550e8400-e29b-41d4-a716-446655440000',
          session_id: 'session-abc',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello world' }],
            usage: {
              input_tokens: 100,
              output_tokens: 50,
            },
          },
          parent_tool_use_id: null,
        } as unknown as SDKAssistantMessage;

        const result = MessageConverter.convert(assistantMsg);

        expect(result.chatMessage).toBeDefined();
        expect(result.chatMessage?.role).toBe('assistant');
        expect(result.chatMessage?.content).toBe('Hello world');
        expect(result.chatMessage?.id).toBe('550e8400-e29b-41d4-a716-446655440000');
        expect(result.sourceType).toBe('assistant');
        expect(result.metadata?.sessionId).toBe('session-abc');
      });

      it('should convert assistant message with token usage', () => {
        const assistantMsg = {
          type: 'assistant',
          uuid: '550e8400-e29b-41d4-a716-446655440001',
          session_id: 'session-id',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Test' }],
            usage: {
              input_tokens: 1500,
              output_tokens: 250,
              cache_creation_input_tokens: 100,
              cache_read_input_tokens: 1200,
            },
          },
          parent_tool_use_id: null,
        } as unknown as SDKAssistantMessage;

        const result = MessageConverter.convert(assistantMsg);

        expect(result.chatMessage?.tokenUsage).toEqual({
          inputTokens: 1500,
          outputTokens: 250,
          cacheCreationInputTokens: 100,
          cacheReadInputTokens: 1200,
        });
      });

      it('should convert assistant message with tool calls', () => {
        const assistantMsg = {
          type: 'assistant',
          uuid: '550e8400-e29b-41d4-a716-446655440002',
          session_id: 'session-id',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: "I'll read that file" },
              {
                type: 'tool_use',
                id: 'tool-123',
                name: 'Read',
                input: { file_path: '/home/user/test.ts' },
              },
            ],
          },
          parent_tool_use_id: null,
        } as unknown as SDKAssistantMessage;

        const result = MessageConverter.convert(assistantMsg);

        expect(result.chatMessage?.simplifiedToolCalls).toHaveLength(1);
        expect(result.chatMessage?.simplifiedToolCalls?.[0]).toEqual({
          type: 'tool_use',
          name: 'Read',
          description: '/home/user/test.ts',
          input: { file_path: '/home/user/test.ts' },
        });
      });

      it('should filter out TodoWrite from tool calls', () => {
        const assistantMsg = {
          type: 'assistant',
          uuid: '550e8400-e29b-41d4-a716-446655440003',
          session_id: 'session-id',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'Read',
                input: { file_path: '/test.ts' },
              },
              {
                type: 'tool_use',
                id: 'tool-2',
                name: 'TodoWrite',
                input: { todos: [] },
              },
            ],
          },
          parent_tool_use_id: null,
        } as unknown as SDKAssistantMessage;

        const result = MessageConverter.convert(assistantMsg);

        expect(result.chatMessage?.simplifiedToolCalls).toHaveLength(1);
        expect(result.chatMessage?.simplifiedToolCalls?.[0].name).toBe('Read');
      });
    });

    describe('user messages', () => {
      it('should convert user message to ChatMessage', () => {
        const userMsg = {
          type: 'user',
          uuid: '550e8400-e29b-41d4-a716-446655440004',
          session_id: 'session-id',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Hello Claude' }],
          },
          parent_tool_use_id: null,
        } as unknown as SDKUserMessage;

        const result = MessageConverter.convert(userMsg);

        expect(result.chatMessage).toBeDefined();
        expect(result.chatMessage?.role).toBe('user');
        expect(result.chatMessage?.content).toBe('Hello Claude');
        expect(result.sourceType).toBe('user');
      });

      it('should generate ID if uuid is missing', () => {
        const userMsg = {
          type: 'user',
          session_id: 'session-id',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Test' }],
          },
          parent_tool_use_id: null,
        } as unknown as SDKUserMessage;

        const result = MessageConverter.convert(userMsg);

        expect(result.chatMessage?.id).toMatch(/^user-\d+$/);
      });
    });

    describe('system messages', () => {
      it('should return null chatMessage for system messages', () => {
        const systemMsg = {
          type: 'system',
          subtype: 'init',
          uuid: '550e8400-e29b-41d4-a716-446655440005',
          session_id: 'session-id',
          apiKeySource: 'user',
          cwd: '/home/user',
          tools: ['Read', 'Write'],
          mcp_servers: [],
          model: 'claude-sonnet-4',
          permissionMode: 'default',
          slash_commands: [],
          output_style: 'default',
        } as unknown as SDKSystemMessage;

        const result = MessageConverter.convert(systemMsg);

        expect(result.chatMessage).toBeNull();
        expect(result.sourceType).toBe('system');
        expect(result.metadata?.sessionId).toBe('session-id');
      });
    });

    describe('result messages', () => {
      it('should return null chatMessage for result messages', () => {
        const resultMsg = {
          type: 'result',
          subtype: 'success',
          uuid: '550e8400-e29b-41d4-a716-446655440006',
          session_id: 'session-id',
          duration_ms: 5000,
          duration_api_ms: 3000,
          is_error: false,
          num_turns: 5,
          result: 'Success',
          total_cost_usd: 0.01,
          usage: {
            input_tokens: 200,
            output_tokens: 100,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
          permission_denials: [],
        } as unknown as SDKResultMessage;

        const result = MessageConverter.convert(resultMsg);

        expect(result.chatMessage).toBeNull();
        expect(result.sourceType).toBe('result');
      });
    });
  });

  describe('formatToolDescription', () => {
    it('should format Read tool description', () => {
      const desc = MessageConverter.formatToolDescription('Read', {
        file_path: '/home/user/file.ts',
      });
      expect(desc).toBe('/home/user/file.ts');
    });

    it('should format Write tool description', () => {
      const desc = MessageConverter.formatToolDescription('Write', {
        file_path: '/home/user/output.txt',
        content: 'test content',
      });
      expect(desc).toBe('/home/user/output.txt');
    });

    it('should format Edit tool description', () => {
      const desc = MessageConverter.formatToolDescription('Edit', {
        file_path: '/home/user/code.js',
        old_string: 'old',
        new_string: 'new',
      });
      expect(desc).toBe('/home/user/code.js');
    });

    it('should format Bash tool description', () => {
      const desc = MessageConverter.formatToolDescription('Bash', {
        command: 'npm test',
      });
      expect(desc).toBe('npm test');
    });

    it('should format Grep tool description', () => {
      const desc = MessageConverter.formatToolDescription('Grep', {
        pattern: 'TODO',
        path: './src',
      });
      expect(desc).toBe('"TODO" in ./src');
    });

    it('should format Glob tool description', () => {
      const desc = MessageConverter.formatToolDescription('Glob', {
        pattern: '**/*.ts',
        path: './src',
      });
      expect(desc).toBe('**/*.ts in ./src');
    });

    it('should format Task tool description', () => {
      const desc = MessageConverter.formatToolDescription('Task', {
        description: 'Run tests',
        prompt: 'Run all unit tests',
        subagent_type: 'general-purpose',
      });
      expect(desc).toBe('Run tests');
    });

    it('should format WebSearch tool description', () => {
      const desc = MessageConverter.formatToolDescription('WebSearch', {
        query: 'TypeScript best practices',
      });
      expect(desc).toBe('TypeScript best practices');
    });

    it('should format WebFetch tool description', () => {
      const desc = MessageConverter.formatToolDescription('WebFetch', {
        url: 'https://example.com',
        prompt: 'Get content',
      });
      expect(desc).toBe('https://example.com');
    });

    it('should format NotebookEdit tool description', () => {
      const desc = MessageConverter.formatToolDescription('NotebookEdit', {
        notebook_path: '/home/user/notebook.ipynb',
        new_source: 'print("hello")',
      });
      expect(desc).toBe('/home/user/notebook.ipynb');
    });

    it('should format ReadMcpResource tool description', () => {
      const desc = MessageConverter.formatToolDescription('ReadMcpResource', {
        server: 'github',
        uri: 'repos/user/repo',
      });
      expect(desc).toBe('github:repos/user/repo');
    });

    it('should format ListMcpResources tool description', () => {
      const desc = MessageConverter.formatToolDescription('ListMcpResources', {
        server: 'github',
      });
      expect(desc).toBe('github');
    });

    it('should format ListMcpResources without server', () => {
      const desc = MessageConverter.formatToolDescription('ListMcpResources', {});
      expect(desc).toBe('all servers');
    });

    it('should handle null input gracefully', () => {
      const desc = MessageConverter.formatToolDescription('Read', null);
      expect(desc).toBe('');
    });

    it('should handle missing fields gracefully', () => {
      const desc = MessageConverter.formatToolDescription('Read', {});
      expect(desc).toBe('');
    });

    it('should use fallback for unknown tools with file_path', () => {
      const desc = MessageConverter.formatToolDescription('UnknownTool', {
        file_path: '/test.txt',
      });
      expect(desc).toBe('/test.txt');
    });

    it('should use fallback for unknown tools with path', () => {
      const desc = MessageConverter.formatToolDescription('UnknownTool', {
        path: '/test/dir',
      });
      expect(desc).toBe('/test/dir');
    });

    it('should use fallback for unknown tools with query', () => {
      const desc = MessageConverter.formatToolDescription('UnknownTool', {
        query: 'search term',
      });
      expect(desc).toBe('search term');
    });
  });

  describe('extractError', () => {
    it('should extract error_max_turns error', () => {
      const resultMsg = {
        type: 'result',
        subtype: 'error_max_turns',
        uuid: '550e8400-e29b-41d4-a716-446655440007',
        session_id: 'session-id',
        duration_ms: 5000,
        duration_api_ms: 3000,
        is_error: true,
        num_turns: 10,
        total_cost_usd: 0.05,
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 800,
        },
        permission_denials: [],
      } as unknown as SDKResultMessage;

      const error = MessageConverter.extractError(resultMsg);

      expect(error).toBeDefined();
      expect(error?.type).toBe('max_turns_error');
      expect(error?.message).toContain('10 turns');
      expect(error?.subtype).toBe('error_max_turns');
    });

    it('should extract error_during_execution error', () => {
      const resultMsg = {
        type: 'result',
        subtype: 'error_during_execution',
        uuid: '550e8400-e29b-41d4-a716-446655440008',
        session_id: 'session-id',
        duration_ms: 5000,
        duration_api_ms: 3000,
        is_error: true,
        num_turns: 5,
        result: 'File not found: /test.txt',
        total_cost_usd: 0.02,
        usage: {
          input_tokens: 500,
          output_tokens: 250,
        },
        permission_denials: [],
      } as unknown as SDKResultMessage;

      const error = MessageConverter.extractError(resultMsg);

      expect(error).toBeDefined();
      expect(error?.type).toBe('execution_error');
      expect(error?.message).toBe('File not found: /test.txt');
      expect(error?.subtype).toBe('error_during_execution');
    });

    it('should infer authentication_error from text', () => {
      const resultMsg = {
        type: 'result',
        subtype: 'success',
        is_error: true,
        num_turns: 1,
        result: 'Invalid API key provided',
      } as unknown as SDKResultMessage;

      const error = MessageConverter.extractError(resultMsg);

      expect(error?.type).toBe('authentication_error');
    });

    it('should infer rate_limit_error from text', () => {
      const resultMsg = {
        type: 'result',
        subtype: 'success',
        is_error: true,
        result: 'Rate limit exceeded',
      } as unknown as SDKResultMessage;

      const error = MessageConverter.extractError(resultMsg);

      expect(error?.type).toBe('rate_limit_error');
    });

    it('should return null for non-error results', () => {
      const resultMsg = {
        type: 'result',
        subtype: 'success',
        is_error: false,
        result: 'Success',
      } as unknown as SDKResultMessage;

      const error = MessageConverter.extractError(resultMsg);

      expect(error).toBeNull();
    });

    it('should default to api_error for unknown error types', () => {
      const resultMsg = {
        type: 'result',
        subtype: 'success',
        is_error: true,
        result: 'Some unknown error occurred',
      } as unknown as SDKResultMessage;

      const error = MessageConverter.extractError(resultMsg);

      expect(error?.type).toBe('api_error');
    });
  });

  describe('convertTokenUsage', () => {
    it('should convert snake_case to camelCase', () => {
      const usage = {
        input_tokens: 1500,
        output_tokens: 250,
        cache_creation_input_tokens: 100,
        cache_read_input_tokens: 1200,
      };

      const converted = MessageConverter.convertTokenUsage(usage);

      expect(converted).toEqual({
        inputTokens: 1500,
        outputTokens: 250,
        cacheCreationInputTokens: 100,
        cacheReadInputTokens: 1200,
      });
    });

    it('should handle null/undefined values', () => {
      const usage = {
        input_tokens: null,
        output_tokens: 250,
        cache_read_input_tokens: null,
      };

      const converted = MessageConverter.convertTokenUsage(usage as any);

      expect(converted).toEqual({
        inputTokens: 0,
        outputTokens: 250,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      });
    });
  });

  describe('formatPermissionDenial', () => {
    it('should format permission denial with Read tool', () => {
      const denial = {
        tool_name: 'Read',
        tool_use_id: 'tool-123',
        tool_input: { file_path: '/etc/passwd' },
      };

      const formatted = MessageConverter.formatPermissionDenial(denial);

      expect(formatted).toEqual({
        toolName: 'Read',
        toolUseId: 'tool-123',
        description: '/etc/passwd',
        toolInput: { file_path: '/etc/passwd' },
      });
    });

    it('should format permission denial with Bash tool', () => {
      const denial = {
        tool_name: 'Bash',
        tool_use_id: 'tool-456',
        tool_input: { command: 'rm -rf /' },
      };

      const formatted = MessageConverter.formatPermissionDenial(denial);

      expect(formatted).toEqual({
        toolName: 'Bash',
        toolUseId: 'tool-456',
        description: 'rm -rf /',
        toolInput: { command: 'rm -rf /' },
      });
    });
  });
});
