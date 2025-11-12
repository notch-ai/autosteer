/**
 * SDK Schema Validation Tests
 *
 * Tests Zod schemas that match Claude Code SDK message structures
 * Coverage Target: 80%+
 */

import {
  UsageSchema,
  NonNullableUsageSchema,
  ModelUsageSchema,
  TextContentSchema,
  ToolUseContentSchema,
  ToolResultContentSchema,
  ContentBlockSchema,
  AssistantMessageSchema,
  UserMessageSchema,
  MessageBaseSchema,
  MessageBaseSchemaOptionalUuid,
  SDKUserMessageSchema,
  SDKAssistantMessageSchema,
  SDKResultMessageSchema,
  SDKSystemMessageSchema,
  SDKCompactBoundaryMessageSchema,
  SDKStreamEventSchema,
  StrictSDKMessageSchema,
  RelaxedSDKMessageSchema,
} from '@/types/sdk.schemas';

describe('SDK Schemas', () => {
  describe('Usage Schemas', () => {
    describe('UsageSchema', () => {
      it('should validate valid usage data', () => {
        const validUsage = {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 20,
          cache_read_input_tokens: 10,
        };

        expect(() => UsageSchema.parse(validUsage)).not.toThrow();
      });

      it('should allow optional fields', () => {
        const minimalUsage = {};
        expect(() => UsageSchema.parse(minimalUsage)).not.toThrow();
      });

      it('should reject invalid types', () => {
        const invalidUsage = {
          input_tokens: 'invalid',
        };

        expect(() => UsageSchema.parse(invalidUsage)).toThrow();
      });
    });

    describe('NonNullableUsageSchema', () => {
      it('should validate complete usage data', () => {
        const validUsage = {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 20,
          cache_read_input_tokens: 10,
        };

        expect(() => NonNullableUsageSchema.parse(validUsage)).not.toThrow();
      });

      it('should reject missing required fields', () => {
        const incompleteUsage = {
          input_tokens: 100,
        };

        expect(() => NonNullableUsageSchema.parse(incompleteUsage)).toThrow();
      });
    });

    describe('ModelUsageSchema', () => {
      it('should validate model usage data', () => {
        const validModelUsage = {
          inputTokens: 100,
          outputTokens: 50,
          cacheReadInputTokens: 10,
          cacheCreationInputTokens: 20,
          webSearchRequests: 2,
          costUSD: 0.05,
          contextWindow: 200000,
        };

        expect(() => ModelUsageSchema.parse(validModelUsage)).not.toThrow();
      });

      it('should reject missing fields', () => {
        const incompleteModelUsage = {
          inputTokens: 100,
        };

        expect(() => ModelUsageSchema.parse(incompleteModelUsage)).toThrow();
      });
    });
  });

  describe('Content Block Schemas', () => {
    describe('TextContentSchema', () => {
      it('should validate text content', () => {
        const textContent = {
          type: 'text',
          text: 'Hello, world!',
        };

        expect(() => TextContentSchema.parse(textContent)).not.toThrow();
      });

      it('should reject missing text field', () => {
        const invalidContent = {
          type: 'text',
        };

        expect(() => TextContentSchema.parse(invalidContent)).toThrow();
      });
    });

    describe('ToolUseContentSchema', () => {
      it('should validate tool use content', () => {
        const toolUse = {
          type: 'tool_use',
          id: 'toolu_123',
          name: 'read_file',
          input: { path: '/test.ts' },
        };

        expect(() => ToolUseContentSchema.parse(toolUse)).not.toThrow();
      });

      it('should reject missing required fields', () => {
        const invalidToolUse = {
          type: 'tool_use',
          id: 'toolu_123',
        };

        expect(() => ToolUseContentSchema.parse(invalidToolUse)).toThrow();
      });
    });

    describe('ToolResultContentSchema', () => {
      it('should validate tool result with string content', () => {
        const toolResult = {
          type: 'tool_result',
          tool_use_id: 'toolu_123',
          content: 'File content here',
        };

        expect(() => ToolResultContentSchema.parse(toolResult)).not.toThrow();
      });

      it('should validate tool result with array content', () => {
        const toolResult = {
          type: 'tool_result',
          tool_use_id: 'toolu_123',
          content: [{ type: 'text', text: 'Result text' }],
        };

        expect(() => ToolResultContentSchema.parse(toolResult)).not.toThrow();
      });

      it('should validate error flag', () => {
        const errorResult = {
          type: 'tool_result',
          tool_use_id: 'toolu_123',
          content: 'Error occurred',
          is_error: true,
        };

        expect(() => ToolResultContentSchema.parse(errorResult)).not.toThrow();
      });
    });

    describe('ContentBlockSchema', () => {
      it('should validate text block', () => {
        const textBlock = { type: 'text', text: 'Hello' };
        expect(() => ContentBlockSchema.parse(textBlock)).not.toThrow();
      });

      it('should validate tool use block', () => {
        const toolUseBlock = {
          type: 'tool_use',
          id: 'toolu_123',
          name: 'test',
          input: {},
        };
        expect(() => ContentBlockSchema.parse(toolUseBlock)).not.toThrow();
      });

      it('should validate tool result block', () => {
        const toolResultBlock = {
          type: 'tool_result',
          tool_use_id: 'toolu_123',
          content: 'result',
        };
        expect(() => ContentBlockSchema.parse(toolResultBlock)).not.toThrow();
      });
    });
  });

  describe('Message Schemas', () => {
    describe('AssistantMessageSchema', () => {
      it('should validate complete assistant message', () => {
        const assistantMessage = {
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello!' }],
          model: 'claude-sonnet-4-5-20250929',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: 100,
            output_tokens: 50,
          },
        };

        expect(() => AssistantMessageSchema.parse(assistantMessage)).not.toThrow();
      });

      it('should validate tool_use stop reason', () => {
        const assistantMessage = {
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_123',
              name: 'read_file',
              input: { path: '/test.ts' },
            },
          ],
          model: 'claude-sonnet-4-5-20250929',
          stop_reason: 'tool_use',
          stop_sequence: null,
          usage: {},
        };

        expect(() => AssistantMessageSchema.parse(assistantMessage)).not.toThrow();
      });
    });

    describe('UserMessageSchema', () => {
      it('should validate user message with string content', () => {
        const userMessage = {
          role: 'user',
          content: 'Hello, Claude!',
        };

        expect(() => UserMessageSchema.parse(userMessage)).not.toThrow();
      });

      it('should validate user message with block content', () => {
        const userMessage = {
          role: 'user',
          content: [{ type: 'text', text: 'Hello, Claude!' }],
        };

        expect(() => UserMessageSchema.parse(userMessage)).not.toThrow();
      });
    });
  });

  describe('SDK Message Base Schemas', () => {
    describe('MessageBaseSchema', () => {
      it('should validate base message fields', () => {
        const baseMessage = {
          uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          session_id: 'session_123',
        };

        expect(() => MessageBaseSchema.parse(baseMessage)).not.toThrow();
      });

      it('should allow any UUID format', () => {
        const message = {
          uuid: 'simple-uuid',
          session_id: 'session_123',
        };

        expect(() => MessageBaseSchema.parse(message)).not.toThrow();
      });
    });

    describe('MessageBaseSchemaOptionalUuid', () => {
      it('should validate with UUID', () => {
        const message = {
          uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          session_id: 'session_123',
        };

        expect(() => MessageBaseSchemaOptionalUuid.parse(message)).not.toThrow();
      });

      it('should validate without UUID', () => {
        const message = {
          session_id: 'session_123',
        };

        expect(() => MessageBaseSchemaOptionalUuid.parse(message)).not.toThrow();
      });
    });
  });

  describe('SDK Message Schemas', () => {
    describe('SDKUserMessageSchema', () => {
      it('should validate SDK user message', () => {
        const userMessage = {
          uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          session_id: 'session_123',
          type: 'user',
          message: {
            role: 'user',
            content: 'Hello!',
          },
          parent_tool_use_id: null,
        };

        expect(() => SDKUserMessageSchema.parse(userMessage)).not.toThrow();
      });

      it('should validate synthetic flag', () => {
        const syntheticMessage = {
          uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          session_id: 'session_123',
          type: 'user',
          message: {
            role: 'user',
            content: 'Synthetic message',
          },
          parent_tool_use_id: null,
          isSynthetic: true,
        };

        expect(() => SDKUserMessageSchema.parse(syntheticMessage)).not.toThrow();
      });

      it('should validate replay flag', () => {
        const replayMessage = {
          uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          session_id: 'session_123',
          type: 'user',
          message: {
            role: 'user',
            content: 'Replayed message',
          },
          parent_tool_use_id: null,
          isReplay: true,
        };

        expect(() => SDKUserMessageSchema.parse(replayMessage)).not.toThrow();
      });
    });

    describe('SDKAssistantMessageSchema', () => {
      it('should validate SDK assistant message', () => {
        const assistantMessage = {
          uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          session_id: 'session_123',
          type: 'assistant',
          message: {
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Response' }],
            model: 'claude-sonnet-4-5-20250929',
            stop_reason: 'end_turn',
            stop_sequence: null,
            usage: {},
          },
          parent_tool_use_id: null,
        };

        expect(() => SDKAssistantMessageSchema.parse(assistantMessage)).not.toThrow();
      });
    });

    describe('SDKResultMessageSchema', () => {
      it('should validate success result message', () => {
        const successMessage = {
          uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          session_id: 'session_123',
          type: 'result',
          subtype: 'success',
          duration_ms: 1500,
          duration_api_ms: 1200,
          is_error: false,
          num_turns: 3,
          result: 'Task completed successfully',
          total_cost_usd: 0.05,
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
          modelUsage: {
            'claude-sonnet-4-5-20250929': {
              inputTokens: 100,
              outputTokens: 50,
              cacheReadInputTokens: 0,
              cacheCreationInputTokens: 0,
              webSearchRequests: 0,
              costUSD: 0.05,
              contextWindow: 200000,
            },
          },
          permission_denials: [],
        };

        expect(() => SDKResultMessageSchema.parse(successMessage)).not.toThrow();
      });

      it('should validate error result message', () => {
        const errorMessage = {
          session_id: 'session_123',
          type: 'result',
          subtype: 'error_max_turns',
          duration_ms: 3000,
          is_error: true,
          num_turns: 10,
          total_cost_usd: 0.1,
          usage: {
            input_tokens: 500,
            output_tokens: 200,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
          modelUsage: {},
          permission_denials: [],
        };

        expect(() => SDKResultMessageSchema.parse(errorMessage)).not.toThrow();
      });

      it('should validate permission denials', () => {
        const messageWithDenials = {
          session_id: 'session_123',
          type: 'result',
          subtype: 'success',
          duration_ms: 1500,
          is_error: false,
          num_turns: 3,
          result: 'Completed with denials',
          total_cost_usd: 0.05,
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
          modelUsage: {},
          permission_denials: [
            {
              tool_name: 'write_file',
              tool_use_id: 'toolu_456',
              tool_input: { path: '/restricted.txt' },
            },
          ],
        };

        expect(() => SDKResultMessageSchema.parse(messageWithDenials)).not.toThrow();
      });
    });

    describe('SDKSystemMessageSchema', () => {
      it('should validate system init message', () => {
        const systemMessage = {
          session_id: 'session_123',
          type: 'system',
          subtype: 'init',
          apiKeySource: 'user',
          cwd: '/workspace',
          tools: ['read_file', 'write_file'],
          mcp_servers: [{ name: 'test-server', status: 'connected' }],
          model: 'claude-sonnet-4-5-20250929',
          permissionMode: 'default',
          slash_commands: ['/test', '/help'],
          output_style: 'normal',
        };

        expect(() => SDKSystemMessageSchema.parse(systemMessage)).not.toThrow();
      });

      it('should validate optional agents field', () => {
        const systemMessage = {
          session_id: 'session_123',
          type: 'system',
          subtype: 'init',
          agents: ['agent1', 'agent2'],
          apiKeySource: 'project',
          cwd: '/workspace',
          tools: [],
          mcp_servers: [],
          model: 'claude-sonnet-4-5-20250929',
          permissionMode: 'acceptEdits',
          slash_commands: [],
          output_style: 'compact',
        };

        expect(() => SDKSystemMessageSchema.parse(systemMessage)).not.toThrow();
      });
    });

    describe('SDKCompactBoundaryMessageSchema', () => {
      it('should validate compact boundary message', () => {
        const compactMessage = {
          session_id: 'session_123',
          type: 'system',
          subtype: 'compact_boundary',
          compact_metadata: {
            trigger: 'manual',
            pre_tokens: 50000,
          },
        };

        expect(() => SDKCompactBoundaryMessageSchema.parse(compactMessage)).not.toThrow();
      });

      it('should validate auto trigger', () => {
        const autoCompact = {
          session_id: 'session_123',
          type: 'system',
          subtype: 'compact_boundary',
          compact_metadata: {
            trigger: 'auto',
            pre_tokens: 100000,
          },
        };

        expect(() => SDKCompactBoundaryMessageSchema.parse(autoCompact)).not.toThrow();
      });
    });

    describe('SDKStreamEventSchema', () => {
      it('should validate stream event message', () => {
        const streamMessage = {
          uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          session_id: 'session_123',
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            index: 0,
            delta: {
              type: 'text_delta',
              text: 'Hello',
            },
          },
          parent_tool_use_id: null,
        };

        expect(() => SDKStreamEventSchema.parse(streamMessage)).not.toThrow();
      });
    });
  });

  describe('Union Schemas', () => {
    describe('StrictSDKMessageSchema', () => {
      it('should validate all message types', () => {
        const messages = [
          {
            uuid: 'uuid1',
            session_id: 'session_123',
            type: 'user',
            message: { role: 'user', content: 'Hello' },
            parent_tool_use_id: null,
          },
          {
            uuid: 'uuid2',
            session_id: 'session_123',
            type: 'assistant',
            message: {
              id: 'msg_123',
              type: 'message',
              role: 'assistant',
              content: [{ type: 'text', text: 'Hi' }],
              model: 'claude-sonnet-4-5-20250929',
              stop_reason: 'end_turn',
              stop_sequence: null,
              usage: {},
            },
            parent_tool_use_id: null,
          },
          {
            session_id: 'session_123',
            type: 'system',
            subtype: 'init',
            apiKeySource: 'user',
            cwd: '/workspace',
            tools: [],
            mcp_servers: [],
            model: 'claude-sonnet-4-5-20250929',
            permissionMode: 'default',
            slash_commands: [],
            output_style: 'normal',
          },
        ];

        messages.forEach((message) => {
          expect(() => StrictSDKMessageSchema.parse(message)).not.toThrow();
        });
      });
    });

    describe('RelaxedSDKMessageSchema', () => {
      it('should validate messages with partial data', () => {
        const partialMessage = {
          uuid: 'uuid1',
          session_id: 'session_123',
          type: 'assistant',
          message: {
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Response' }],
            model: 'claude-sonnet-4-5-20250929',
            stop_reason: null,
            stop_sequence: null,
          },
          parent_tool_use_id: null,
        };

        expect(() => RelaxedSDKMessageSchema.parse(partialMessage)).not.toThrow();
      });
    });
  });

  describe('Type Inference', () => {
    it('should infer correct types from schemas', () => {
      const usage: import('@/types/sdk.schemas').Usage = {
        input_tokens: 100,
      };

      const message: import('@/types/sdk.schemas').SDKUserMessage = {
        uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        session_id: 'session_123',
        type: 'user',
        message: { role: 'user', content: 'Test' },
        parent_tool_use_id: null,
      };

      expect(usage).toBeDefined();
      expect(message).toBeDefined();
    });
  });
});
