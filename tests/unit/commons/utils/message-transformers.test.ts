/**
 * Unit tests for message transformation utilities
 * Tests shared extraction functions used by JSONL and streaming paths
 */

import {
  extractTextContent,
  extractToolCalls,
  mapTokenUsage,
} from '@/commons/utils/message-transformers';

describe('message-transformers', () => {
  describe('extractTextContent', () => {
    it('should extract text from single text block', () => {
      const content = [{ type: 'text', text: 'Hello world' }];

      expect(extractTextContent(content)).toBe('Hello world');
    });

    it('should extract text from multiple text blocks', () => {
      const content = [
        { type: 'text', text: 'First line' },
        { type: 'text', text: 'Second line' },
        { type: 'text', text: 'Third line' },
      ];

      expect(extractTextContent(content)).toBe('First line\nSecond line\nThird line');
    });

    it('should ignore tool_use blocks', () => {
      const content = [
        { type: 'text', text: 'Before' },
        { type: 'tool_use', id: 'tool-1', name: 'Read', input: {} },
        { type: 'text', text: 'After' },
      ];

      expect(extractTextContent(content)).toBe('Before\nAfter');
    });

    it('should ignore unknown block types', () => {
      const content = [
        { type: 'text', text: 'Valid text' },
        { type: 'unknown', data: 'something' },
        { type: 'text', text: 'More text' },
      ];

      expect(extractTextContent(content)).toBe('Valid text\nMore text');
    });

    it('should return empty string for empty array', () => {
      expect(extractTextContent([])).toBe('');
    });

    it('should return empty string when no text blocks', () => {
      const content = [
        { type: 'tool_use', id: 'tool-1', name: 'Read', input: {} },
        { type: 'unknown', data: 'something' },
      ];

      expect(extractTextContent(content)).toBe('');
    });

    it('should handle empty text blocks', () => {
      const content = [
        { type: 'text', text: '' },
        { type: 'text', text: 'Non-empty' },
        { type: 'text', text: '' },
      ];

      expect(extractTextContent(content)).toBe('\nNon-empty\n');
    });

    it('should preserve whitespace in text', () => {
      const content = [
        { type: 'text', text: '  Leading spaces' },
        { type: 'text', text: 'Trailing spaces  ' },
      ];

      expect(extractTextContent(content)).toBe('  Leading spaces\nTrailing spaces  ');
    });
  });

  describe('extractToolCalls', () => {
    it('should extract single tool call', () => {
      const content = [
        { type: 'tool_use', id: 'tool-1', name: 'Read', input: { file_path: '/foo' } },
      ];

      const result = extractToolCalls(content);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'tool_use',
        id: 'tool-1',
        name: 'Read',
        input: { file_path: '/foo' },
      });
    });

    it('should extract multiple tool calls', () => {
      const content = [
        { type: 'tool_use', id: 'tool-1', name: 'Read', input: { file_path: '/foo' } },
        { type: 'tool_use', id: 'tool-2', name: 'Write', input: { file_path: '/bar' } },
        { type: 'tool_use', id: 'tool-3', name: 'Edit', input: { file_path: '/baz' } },
      ];

      const result = extractToolCalls(content);

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('tool-1');
      expect(result[1].id).toBe('tool-2');
      expect(result[2].id).toBe('tool-3');
    });

    it('should ignore text blocks', () => {
      const content = [
        { type: 'text', text: 'Some text' },
        { type: 'tool_use', id: 'tool-1', name: 'Read', input: {} },
        { type: 'text', text: 'More text' },
      ];

      const result = extractToolCalls(content);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('tool-1');
    });

    it('should ignore unknown block types', () => {
      const content = [
        { type: 'unknown', data: 'something' },
        { type: 'tool_use', id: 'tool-1', name: 'Read', input: {} },
        { type: 'another_unknown', value: 123 },
      ];

      const result = extractToolCalls(content);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('tool-1');
    });

    it('should return empty array for empty input', () => {
      expect(extractToolCalls([])).toEqual([]);
    });

    it('should return empty array when no tool_use blocks', () => {
      const contentWithNoTools = [
        { type: 'text', text: 'Just text' },
        { type: 'unknown', data: 'something' },
      ];

      expect(extractToolCalls(contentWithNoTools)).toEqual([]);
    });

    it('should preserve tool call structure', () => {
      const content = [
        {
          type: 'tool_use',
          id: 'toolu_abc123',
          name: 'Edit',
          input: {
            file_path: '/path/to/file.ts',
            old_string: 'old',
            new_string: 'new',
          },
        },
      ];

      const result = extractToolCalls(content);

      expect(result[0]).toEqual({
        type: 'tool_use',
        id: 'toolu_abc123',
        name: 'Edit',
        input: {
          file_path: '/path/to/file.ts',
          old_string: 'old',
          new_string: 'new',
        },
      });
    });

    it('should handle complex input objects', () => {
      const content = [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'TodoWrite',
          input: {
            todos: [
              { content: 'Task 1', status: 'pending', activeForm: 'Doing task 1' },
              { content: 'Task 2', status: 'completed', activeForm: 'Doing task 2' },
            ],
          },
        },
      ];

      const result = extractToolCalls(content);

      expect(result[0].input.todos).toHaveLength(2);
      expect(result[0].input.todos[0].content).toBe('Task 1');
    });
  });

  describe('mapTokenUsage', () => {
    it('should map all token fields', () => {
      const sdkUsage = {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 25,
        cache_read_input_tokens: 200,
      };

      const result = mapTokenUsage(sdkUsage);

      expect(result).toEqual({
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationInputTokens: 25,
        cacheReadInputTokens: 200,
      });
    });

    it('should default missing tokens to 0', () => {
      const sdkUsage = {
        input_tokens: 100,
      };

      const result = mapTokenUsage(sdkUsage);

      expect(result).toEqual({
        inputTokens: 100,
        outputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      });
    });

    it('should handle empty usage object', () => {
      const result = mapTokenUsage({});

      expect(result).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      });
    });

    it('should handle undefined cache tokens', () => {
      const sdkUsage: any = {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: undefined,
        cache_read_input_tokens: undefined,
      };

      const result = mapTokenUsage(sdkUsage);

      expect(result).toEqual({
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      });
    });

    it('should handle zero values', () => {
      const sdkUsage = {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      };

      const result = mapTokenUsage(sdkUsage);

      expect(result).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      });
    });

    it('should handle large token counts', () => {
      const sdkUsage = {
        input_tokens: 1000000,
        output_tokens: 500000,
        cache_creation_input_tokens: 250000,
        cache_read_input_tokens: 2000000,
      };

      const result = mapTokenUsage(sdkUsage);

      expect(result).toEqual({
        inputTokens: 1000000,
        outputTokens: 500000,
        cacheCreationInputTokens: 250000,
        cacheReadInputTokens: 2000000,
      });
    });

    it('should handle partial cache token data', () => {
      const sdkUsage = {
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 200,
      };

      const result = mapTokenUsage(sdkUsage);

      expect(result).toEqual({
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 200,
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle real assistant message with text and tools', () => {
      const content = [
        { type: 'text', text: 'Let me read that file for you.' },
        { type: 'tool_use', id: 'tool-1', name: 'Read', input: { file_path: '/foo.ts' } },
      ];

      const text = extractTextContent(content);
      const tools = extractToolCalls(content);

      expect(text).toBe('Let me read that file for you.');
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('Read');
    });

    it('should handle message with multiple tools and text blocks', () => {
      const content = [
        { type: 'text', text: 'I need to make several changes:' },
        { type: 'tool_use', id: 'tool-1', name: 'Edit', input: { file_path: '/a.ts' } },
        { type: 'text', text: 'And also:' },
        { type: 'tool_use', id: 'tool-2', name: 'Write', input: { file_path: '/b.ts' } },
        { type: 'text', text: 'Done!' },
      ];

      const text = extractTextContent(content);
      const tools = extractToolCalls(content);

      expect(text).toBe('I need to make several changes:\nAnd also:\nDone!');
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('Edit');
      expect(tools[1].name).toBe('Write');
    });

    it('should handle tool-only message (no text)', () => {
      const content = [
        { type: 'tool_use', id: 'tool-1', name: 'Read', input: {} },
        { type: 'tool_use', id: 'tool-2', name: 'Write', input: {} },
      ];

      const text = extractTextContent(content);
      const tools = extractToolCalls(content);

      expect(text).toBe('');
      expect(tools).toHaveLength(2);
    });

    it('should handle text-only message (no tools)', () => {
      const content = [
        { type: 'text', text: 'Just a regular response' },
        { type: 'text', text: 'with multiple text blocks' },
      ];

      const text = extractTextContent(content);
      const tools = extractToolCalls(content);

      expect(text).toBe('Just a regular response\nwith multiple text blocks');
      expect(tools).toHaveLength(0);
    });
  });
});
