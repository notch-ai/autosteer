/**
 * Unit tests for message filtering utilities
 * Filter synthetic messages from chat and trace display
 */

import {
  isSyntheticMessage,
  type MessageWithSyntheticIndicators,
} from '@/commons/utils/message-filters';

describe('message-filters', () => {
  describe('isSyntheticMessage', () => {
    describe('Non-user messages (should always return false)', () => {
      it('should return false for assistant messages', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'assistant',
          isSynthetic: true,
          sourceToolUseId: 'tool-123',
          parentUuid: 'parent-456',
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });

      it('should return false for system messages', () => {
        const message: MessageWithSyntheticIndicators = {
          role: 'system',
          isSynthetic: true,
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });

      it('should return false for messages without type or role', () => {
        const message: MessageWithSyntheticIndicators = {
          isSynthetic: true,
          sourceToolUseId: 'tool-123',
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });
    });

    describe('User messages with sourceToolUseId indicator', () => {
      it('should return true when type=user and sourceToolUseId is present (string)', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          sourceToolUseId: 'tool-use-123',
        };

        expect(isSyntheticMessage(message)).toBe(true);
      });

      it('should return true when role=user and sourceToolUseId is present', () => {
        const message: MessageWithSyntheticIndicators = {
          role: 'user',
          sourceToolUseId: 'tool-use-456',
        };

        expect(isSyntheticMessage(message)).toBe(true);
      });

      it('should return false when sourceToolUseId is null', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          sourceToolUseId: null,
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });

      it('should return false when sourceToolUseId is undefined', () => {
        const message: any = {
          type: 'user',
          sourceToolUseId: undefined,
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });

      it('should return false when sourceToolUseId is missing', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });
    });

    describe('User messages with isSynthetic indicator', () => {
      it('should return true when type=user and isSynthetic=true', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          isSynthetic: true,
        };

        expect(isSyntheticMessage(message)).toBe(true);
      });

      it('should return true when role=user and isSynthetic=true', () => {
        const message: MessageWithSyntheticIndicators = {
          role: 'user',
          isSynthetic: true,
        };

        expect(isSyntheticMessage(message)).toBe(true);
      });

      it('should return false when isSynthetic=false', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          isSynthetic: false,
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });

      it('should return false when isSynthetic is undefined', () => {
        const message: any = {
          type: 'user',
          isSynthetic: undefined,
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });

      it('should return false when isSynthetic is missing', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });
    });

    describe('User messages with parentUuid indicator', () => {
      it('should return true when type=user and parentUuid is present (string)', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          parentUuid: 'parent-123',
        };

        expect(isSyntheticMessage(message)).toBe(true);
      });

      it('should return true when role=user and parentUuid is present', () => {
        const message: MessageWithSyntheticIndicators = {
          role: 'user',
          parentUuid: 'parent-456',
        };

        expect(isSyntheticMessage(message)).toBe(true);
      });

      it('should return false when parentUuid is null', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          parentUuid: null,
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });

      it('should return false when parentUuid is undefined', () => {
        const message: any = {
          type: 'user',
          parentUuid: undefined,
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });

      it('should return false when parentUuid is missing', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });
    });

    describe('Defense-in-depth: Multiple indicators', () => {
      it('should return true when all 3 indicators are present', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          sourceToolUseId: 'tool-123',
          isSynthetic: true,
          parentUuid: 'parent-456',
        };

        expect(isSyntheticMessage(message)).toBe(true);
      });

      it('should return true when only sourceToolUseId and isSynthetic are present', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          sourceToolUseId: 'tool-123',
          isSynthetic: true,
        };

        expect(isSyntheticMessage(message)).toBe(true);
      });

      it('should return true when only sourceToolUseId and parentUuid are present', () => {
        const message: MessageWithSyntheticIndicators = {
          role: 'user',
          sourceToolUseId: 'tool-123',
          parentUuid: 'parent-456',
        };

        expect(isSyntheticMessage(message)).toBe(true);
      });

      it('should return true when only isSynthetic and parentUuid are present', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          isSynthetic: true,
          parentUuid: 'parent-456',
        };

        expect(isSyntheticMessage(message)).toBe(true);
      });

      it('should return false when no indicators are present', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });

      it('should return false when all indicators are null', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          sourceToolUseId: null,
          isSynthetic: false,
          parentUuid: null,
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });
    });

    describe('Real-world scenarios', () => {
      it('should filter synthetic skill invocation message (JSONL path)', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          role: 'user',
          sourceToolUseId: 'toolu_abc123',
          isSynthetic: true,
          parentUuid: 'msg-parent-xyz',
        };

        expect(isSyntheticMessage(message)).toBe(true);
      });

      it('should allow genuine user message through', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          role: 'user',
          sourceToolUseId: null,
          isSynthetic: false,
          parentUuid: null,
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });

      it('should filter streaming synthetic message (only isSynthetic)', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          isSynthetic: true,
        };

        expect(isSyntheticMessage(message)).toBe(true);
      });

      it('should allow streaming user message without synthetic flags', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });

      it('should filter trace hydration synthetic message', () => {
        const message: MessageWithSyntheticIndicators = {
          role: 'user',
          isSynthetic: true,
        };

        expect(isSyntheticMessage(message)).toBe(true);
      });

      it('should allow trace hydration genuine user message', () => {
        const message: MessageWithSyntheticIndicators = {
          role: 'user',
          isSynthetic: false,
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });
    });

    describe('User messages with parent_tool_use_id indicator', () => {
      it('should return true when type=user and parent_tool_use_id is present (string)', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          parent_tool_use_id: 'toolu_01AgaVYJmfc8SmsEbDiXZbMd',
        };

        expect(isSyntheticMessage(message)).toBe(true);
      });

      it('should return true when role=user and parent_tool_use_id is present', () => {
        const message: MessageWithSyntheticIndicators = {
          role: 'user',
          parent_tool_use_id: 'toolu_01Khvi8EU9npYSParw2jTGeV',
        };

        expect(isSyntheticMessage(message)).toBe(true);
      });

      it('should return false when parent_tool_use_id is null', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          parent_tool_use_id: null,
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });

      it('should return false when parent_tool_use_id is undefined', () => {
        const message: any = {
          type: 'user',
          parent_tool_use_id: undefined,
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });

      it('should return false when parent_tool_use_id is missing', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });
    });

    describe('User messages with <command-message> text content', () => {
      it('should return true when text content starts with <command-message> (direct content array)', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          content: [
            {
              type: 'text',
              text: '<command-message>The "engineering-check-trd" skill is running</command-message>\n<command-name>engineering-check-trd</command-name>',
            },
          ],
        };

        expect(isSyntheticMessage(message)).toBe(true);
      });

      it('should return true when text content starts with <command-message> (nested message.content)', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          message: {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '<command-message>The "engineering-check-trd" skill is running</command-message>\n<command-name>engineering-check-trd</command-name>',
              },
            ],
          },
        };

        expect(isSyntheticMessage(message)).toBe(true);
      });

      it('should return true when text content starts with <command-message> with whitespace', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          content: [
            {
              type: 'text',
              text: '  \n<command-message>Skill running</command-message>',
            },
          ],
        };

        expect(isSyntheticMessage(message)).toBe(true);
      });

      it('should return false when text content does not start with <command-message>', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          content: [
            {
              type: 'text',
              text: 'Normal user message with <command-message> somewhere in the middle',
            },
          ],
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });

      it('should return false when content is empty array', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          content: [],
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });

      it('should return false when content has no text blocks', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_123',
            },
          ],
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });

      it('should handle string content with <command-message>', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          content: '<command-message>Test</command-message>',
        };

        expect(isSyntheticMessage(message)).toBe(true);
      });

      it('should handle string content without <command-message>', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          content: 'Normal message',
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });
    });

    describe('Edge cases', () => {
      it('should handle empty object', () => {
        const message: MessageWithSyntheticIndicators = {};

        expect(isSyntheticMessage(message)).toBe(false);
      });

      it('should handle message with only type', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });

      it('should handle message with only role', () => {
        const message: MessageWithSyntheticIndicators = {
          role: 'user',
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });

      it('should handle empty string sourceToolUseId (truthy check)', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          sourceToolUseId: '',
        };

        // Empty string is truthy for null/undefined check but falsy for boolean
        // Our implementation checks !== null && !== undefined
        // Empty string passes this check
        expect(isSyntheticMessage(message)).toBe(true);
      });

      it('should handle empty string parentUuid (truthy check)', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          parentUuid: '',
        };

        // Same as above
        expect(isSyntheticMessage(message)).toBe(true);
      });

      it('should handle empty string parent_tool_use_id (truthy check)', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          parent_tool_use_id: '',
        };

        expect(isSyntheticMessage(message)).toBe(true);
      });
    });

    describe('Real-world scenarios from JSONL logs', () => {
      it('should filter message with parent_tool_use_id from task agent', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          role: 'user',
          parent_tool_use_id: 'toolu_01AgaVYJmfc8SmsEbDiXZbMd',
          message: {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze all test file changes in this branch and identify tested functionality.',
              },
            ],
          },
        };

        expect(isSyntheticMessage(message)).toBe(true);
      });

      it('should filter skill execution message with <command-message>', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          role: 'user',
          parent_tool_use_id: null,
          message: {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '<command-message>The "engineering-check-trd" skill is running</command-message>\n<command-name>engineering-check-trd</command-name>',
              },
            ],
          },
        };

        expect(isSyntheticMessage(message)).toBe(true);
      });

      it('should allow genuine user message through (no synthetic indicators)', () => {
        const message: MessageWithSyntheticIndicators = {
          type: 'user',
          role: 'user',
          parent_tool_use_id: null,
          sourceToolUseId: null,
          isSynthetic: false,
          parentUuid: null,
          message: {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Can you help me with this feature?',
              },
            ],
          },
        };

        expect(isSyntheticMessage(message)).toBe(false);
      });
    });
  });
});
