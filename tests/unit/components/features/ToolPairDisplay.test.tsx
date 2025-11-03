/**
 * Tests for ToolPairDisplay component
 */

import React from 'react';
import { describe, it, expect } from '@jest/globals';
import { render } from '@testing-library/react';
import { ToolPairDisplay } from '@/components/features/ToolPairDisplay';
import type { ToolCall } from '@/types/chat.types';

describe('ToolPairDisplay', () => {
  describe('pairToolsByUseId', () => {
    it('should pair tool_use with corresponding tool_result', () => {
      const toolCalls: ToolCall[] = [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Edit',
          input: { file_path: '/test.ts', old_string: 'foo', new_string: 'bar' },
        },
        {
          type: 'tool_result',
          tool_use_id: 'tool-1',
          content: '1→bar',
        },
      ];

      const { container } = render(<ToolPairDisplay toolCalls={toolCalls} inline />);

      // Should display Edit tool
      expect(container.textContent).toContain('Edit');
      expect(container.textContent).toContain('/test.ts');
    });

    it('should skip TodoWrite tools', () => {
      const toolCalls: ToolCall[] = [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'TodoWrite',
          input: { todos: [] },
        },
        {
          type: 'tool_result',
          tool_use_id: 'tool-1',
          content: 'Todos updated',
        },
        {
          type: 'tool_use',
          id: 'tool-2',
          name: 'Read',
          input: { file_path: '/test.md' },
        },
      ];

      const { container } = render(<ToolPairDisplay toolCalls={toolCalls} inline />);

      // Should not display TodoWrite
      expect(container.textContent).not.toContain('TodoWrite');
      // Should display Read
      expect(container.textContent).toContain('Read');
    });

    it('should handle tools without results', () => {
      const toolCalls: ToolCall[] = [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Bash',
          input: { command: 'ls' },
        },
      ];

      const { container } = render(<ToolPairDisplay toolCalls={toolCalls} inline />);

      // Should display tool name but no result
      expect(container.textContent).toContain('Bash');
      expect(container.querySelector('[data-testid="tool-result"]')).toBeNull();
    });
  });

  describe('createEditDiff', () => {
    it('should detect additions correctly', () => {
      const toolCalls: ToolCall[] = [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Edit',
          input: {
            file_path: '/test.ts',
            old_string: 'line1\nline2',
            new_string: 'line1\nline2\nline3',
          },
        },
        {
          type: 'tool_result',
          tool_use_id: 'tool-1',
          content: '1→line1\n2→line2\n3→line3',
        },
      ];

      const { container } = render(<ToolPairDisplay toolCalls={toolCalls} inline />);

      // Should show addition with green background
      const additionElements = container.querySelectorAll('.bg-\\[\\#0d2818\\]');
      expect(additionElements.length).toBeGreaterThan(0);
      expect(container.textContent).toContain('+ 3');
      expect(container.textContent).toContain('line3');
    });

    it('should detect deletions correctly', () => {
      const toolCalls: ToolCall[] = [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Edit',
          input: {
            file_path: '/test.ts',
            old_string: 'line1\nline2\nline3',
            new_string: 'line1\nline3',
          },
        },
        {
          type: 'tool_result',
          tool_use_id: 'tool-1',
          content: '1→line1\n2→line3',
        },
      ];

      const { container } = render(<ToolPairDisplay toolCalls={toolCalls} inline />);

      // Should show deletion with red background
      const deletionElements = container.querySelectorAll('.bg-\\[\\#2d0a0a\\]');
      expect(deletionElements.length).toBeGreaterThan(0);
      expect(container.textContent).toContain('- ');
      expect(container.textContent).toContain('line2');
    });

    it('should handle duplicate lines correctly', () => {
      const toolCalls: ToolCall[] = [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Edit',
          input: {
            file_path: '/test.ts',
            old_string: 'foo\n\n\nbar',
            new_string: 'foo\n\nbaz\nbar',
          },
        },
        {
          type: 'tool_result',
          tool_use_id: 'tool-1',
          content: '1→foo\n2→\n3→baz\n4→bar',
        },
      ];

      const { container } = render(<ToolPairDisplay toolCalls={toolCalls} inline />);

      // Should handle empty lines correctly
      expect(container.textContent).toContain('1');
      expect(container.textContent).toContain('foo');
      expect(container.textContent).toContain('3');
      expect(container.textContent).toContain('baz');
    });

    it('should handle complex mixed changes', () => {
      const toolCalls: ToolCall[] = [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Edit',
          input: {
            file_path: '/test.ts',
            old_string: 'const a = 1;\nconst b = 2;\nconst c = 3;',
            new_string: 'const a = 1;\nconst d = 4;\nconst c = 3;',
          },
        },
        {
          type: 'tool_result',
          tool_use_id: 'tool-1',
          content: '1→const a = 1;\n2→const d = 4;\n3→const c = 3;',
        },
      ];

      const { container } = render(<ToolPairDisplay toolCalls={toolCalls} inline />);

      // Should show both addition and deletion
      expect(container.textContent).toContain('- ');
      expect(container.textContent).toContain('const b = 2');
      expect(container.textContent).toContain('+ 2');
      expect(container.textContent).toContain('const d = 4');
    });
  });

  describe('renderToolResult', () => {
    it('should render Write tool with 10 lines max', () => {
      const longContent = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`).join('\n');
      const toolCalls: ToolCall[] = [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Write',
          input: { file_path: '/test.txt' },
        },
        {
          type: 'tool_result',
          tool_use_id: 'tool-1',
          content: longContent,
        },
      ];

      const { container } = render(<ToolPairDisplay toolCalls={toolCalls} inline />);

      // Should show first 10 lines
      expect(container.textContent).toContain('Line 1');
      expect(container.textContent).toContain('Line 10');
      expect(container.textContent).not.toContain('Line 11');
      expect(container.textContent).toContain('... +10 more lines');
    });

    it('should render other tools with 2 lines max', () => {
      const longContent = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`).join('\n');
      const toolCalls: ToolCall[] = [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Read',
          input: { file_path: '/test.txt' },
        },
        {
          type: 'tool_result',
          tool_use_id: 'tool-1',
          content: longContent,
        },
      ];

      const { container } = render(<ToolPairDisplay toolCalls={toolCalls} inline />);

      // Should show first 2 lines only
      expect(container.textContent).toContain('Line 1');
      expect(container.textContent).toContain('Line 2');
      expect(container.textContent).not.toContain('Line 3');
      expect(container.textContent).toContain('... +8 more lines');
    });

    it('should handle error results with proper styling', () => {
      const toolCalls: ToolCall[] = [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Bash',
          input: { command: 'invalid-command' },
        },
        {
          type: 'tool_result',
          tool_use_id: 'tool-1',
          content: 'Error: command not found',
          is_error: true,
        },
      ];

      const { container } = render(<ToolPairDisplay toolCalls={toolCalls} inline />);

      // Should have error styling
      const errorElements = container.querySelectorAll('.bg-red-50');
      expect(errorElements.length).toBeGreaterThan(0);
      expect(container.textContent).toContain('Error: command not found');
    });
  });

  describe('inline vs expandable display', () => {
    const toolCalls: ToolCall[] = [
      {
        type: 'tool_use',
        id: 'tool-1',
        name: 'Edit',
        input: { file_path: '/test.ts' },
      },
      {
        type: 'tool_result',
        tool_use_id: 'tool-1',
        content: 'Result content',
      },
    ];

    it('should render inline display when inline prop is true', () => {
      const { container } = render(<ToolPairDisplay toolCalls={toolCalls} inline />);

      // Should not have Card component
      expect(container.querySelector('.mb-2')).toBeNull();
      // Should have inline container
      expect(container.querySelector('.space-y-1')).toBeDefined();
    });

    it('should render expandable display when inline prop is false', () => {
      const { container } = render(<ToolPairDisplay toolCalls={toolCalls} inline={false} />);

      // Should have Card component
      const cards = container.querySelectorAll('[class*="p-2 mb-2"]');
      expect(cards.length).toBeGreaterThan(0);
    });
  });

  describe('empty and edge cases', () => {
    it('should handle empty toolCalls array', () => {
      const { container } = render(<ToolPairDisplay toolCalls={[]} inline />);
      expect(container.textContent).toBe('');
    });

    it('should handle undefined toolCalls', () => {
      const { container } = render(<ToolPairDisplay inline />);
      expect(container.textContent).toBe('');
    });

    it('should handle simplifiedToolCalls when no toolCalls provided', () => {
      const simplifiedToolCalls = [
        { type: 'tool_use' as const, name: 'Read', description: '/test.md' },
        { type: 'tool_use' as const, name: 'Write', description: '/output.txt' },
      ];

      const { container } = render(
        <ToolPairDisplay simplifiedToolCalls={simplifiedToolCalls} inline={false} />
      );

      expect(container.textContent).toContain('Read');
      expect(container.textContent).toContain('/test.md');
      expect(container.textContent).toContain('Write');
      expect(container.textContent).toContain('/output.txt');
    });
  });
});
