import { MessageConverter } from '@/services/MessageConverter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/commons/utils';
import { ChevronRight, ChevronDown, CheckCircle, XCircle } from 'lucide-react';
import React, { useState, useMemo } from 'react';

interface ToolCall {
  type: 'tool_use' | 'tool_result';
  id?: string;
  tool_use_id?: string;
  name?: string;
  input?: any;
  content?: any;
}

interface SimplifiedToolCall {
  type: 'tool_use';
  name: string;
  description?: string;
}

interface ToolPairDisplayProps {
  toolCalls?: ToolCall[];
  simplifiedToolCalls?: SimplifiedToolCall[];
  className?: string;
  inline?: boolean;
}

interface PairedTool {
  id: string;
  name: string;
  input: any;
  description: string;
  result?:
    | {
        content: string;
        is_error?: boolean;
      }
    | undefined;
}

function pairToolsByUseId(toolCalls: ToolCall[]): PairedTool[] {
  const toolUseMap = new Map<string, ToolCall>();
  const toolResultMap = new Map<string, ToolCall>();

  toolCalls.forEach((tc) => {
    if (tc.type === 'tool_use' && tc.id) {
      toolUseMap.set(tc.id, tc);
    } else if (tc.type === 'tool_result' && tc.tool_use_id) {
      toolResultMap.set(tc.tool_use_id, tc);
    }
  });

  const paired: PairedTool[] = [];
  toolUseMap.forEach((toolUse, id) => {
    // Skip TodoWrite tools
    if (toolUse.name === 'TodoWrite') {
      return;
    }

    const toolResult = toolResultMap.get(id);

    paired.push({
      id,
      name: toolUse.name || 'Unknown',
      input: toolUse.input,
      description: MessageConverter.formatToolDescription(toolUse.name || '', toolUse.input),
      result: toolResult
        ? {
            content: toolResult.content || '',
            is_error: (toolResult as any).is_error,
          }
        : undefined,
    });
  });

  return paired;
}

interface DiffLine {
  lineNum: string;
  content: string;
  type: 'addition' | 'deletion' | 'context';
}

function createEditDiff(content: string, oldString: string, newString: string): DiffLine[] {
  const oldLines = oldString.split('\n');
  const newLines = newString.split('\n');

  const lineNumberedLines = content.split('\n').filter((line) => /^\s*\d+→/.test(line));
  const lineNumPairs: Array<{ content: string; lineNum: number; used: boolean }> = [];
  lineNumberedLines.forEach((line) => {
    const match = line.match(/^\s*(\d+)→\s*(.*)$/);
    if (match) {
      lineNumPairs.push({ content: match[2], lineNum: parseInt(match[1]), used: false });
    }
  });

  const getLineNumber = (content: string): number | null => {
    const pair = lineNumPairs.find((p) => p.content === content && !p.used);
    if (pair) {
      pair.used = true;
      return pair.lineNum;
    }
    return null;
  };

  const diffLines: DiffLine[] = [];
  let oldIdx = 0;
  let newIdx = 0;
  let inferredLineNum = 1;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oldLine = oldLines[oldIdx];
    const newLine = newLines[newIdx];

    if (oldIdx >= oldLines.length) {
      const actualLineNum = getLineNumber(newLine);
      const lineNum = actualLineNum !== null ? String(actualLineNum) : String(inferredLineNum);
      diffLines.push({ lineNum, content: newLine, type: 'addition' });
      inferredLineNum = actualLineNum !== null ? actualLineNum + 1 : inferredLineNum + 1;
      newIdx++;
    } else if (newIdx >= newLines.length) {
      diffLines.push({ lineNum: String(inferredLineNum), content: oldLine, type: 'deletion' });
      inferredLineNum++;
      oldIdx++;
    } else if (oldLine === newLine) {
      const actualLineNum = getLineNumber(newLine);
      const lineNum = actualLineNum !== null ? String(actualLineNum) : String(inferredLineNum);
      diffLines.push({ lineNum, content: newLine, type: 'context' });
      inferredLineNum = actualLineNum !== null ? actualLineNum + 1 : inferredLineNum + 1;
      oldIdx++;
      newIdx++;
    } else {
      const oldInNew = newLines.slice(newIdx).indexOf(oldLine);
      const newInOld = oldLines.slice(oldIdx).indexOf(newLine);

      if (oldInNew === -1) {
        diffLines.push({ lineNum: String(inferredLineNum), content: oldLine, type: 'deletion' });
        inferredLineNum++;
        oldIdx++;
      } else if (newInOld === -1) {
        const actualLineNum = getLineNumber(newLine);
        const lineNum = actualLineNum !== null ? String(actualLineNum) : String(inferredLineNum);
        diffLines.push({ lineNum, content: newLine, type: 'addition' });
        inferredLineNum = actualLineNum !== null ? actualLineNum + 1 : inferredLineNum + 1;
        newIdx++;
      } else {
        diffLines.push({ lineNum: String(inferredLineNum), content: oldLine, type: 'deletion' });
        const actualLineNum = getLineNumber(newLine);
        const lineNum = actualLineNum !== null ? String(actualLineNum) : String(inferredLineNum);
        diffLines.push({ lineNum, content: newLine, type: 'addition' });
        inferredLineNum = actualLineNum !== null ? actualLineNum + 1 : inferredLineNum + 1;
        oldIdx++;
        newIdx++;
      }
    }
  }

  return diffLines;
}

function renderToolResult(
  content: string,
  toolName: string,
  toolInput?: any,
  isError?: boolean
): JSX.Element {
  const allLines = content.split('\n');

  if (toolName === 'Edit' && toolInput?.old_string && toolInput?.new_string) {
    const diffLines = createEditDiff(content, toolInput.old_string, toolInput.new_string);
    const linesToShow = diffLines.slice(0, 10);
    const hiddenCount = Math.max(0, diffLines.length - 10);

    return (
      <div className="space-y-0 overflow-hidden">
        {linesToShow.map((line, i) => {
          const bgClass =
            line.type === 'addition'
              ? 'bg-[#0d2818] dark:bg-[#0d2818]'
              : line.type === 'deletion'
                ? 'bg-[#2d0a0a] dark:bg-[#2d0a0a]'
                : 'bg-background dark:bg-[#0d1117]';

          const textClass =
            line.type === 'addition'
              ? 'text-[#3fb950] dark:text-[#3fb950]'
              : line.type === 'deletion'
                ? 'text-[#f85149] dark:text-[#f85149]'
                : 'text-text dark:text-[#e6edf3]';

          const prefix = line.type === 'addition' ? '+ ' : line.type === 'deletion' ? '- ' : '  ';

          return (
            <div key={i} className={cn('flex font-mono text-sm leading-5', bgClass)}>
              <span
                className={cn(
                  'inline-block px-2 text-right select-none w-16 bg-surface text-text-muted',
                  'dark:bg-[#0d1117] dark:text-[#7d8590]'
                )}
              >
                {prefix}
                {line.lineNum}
              </span>
              <span className={cn('flex-1 pr-3', textClass)}>{line.content || ' '}</span>
            </div>
          );
        })}
        {hiddenCount > 0 && (
          <div className="px-2 py-1 text-sm text-text-muted">... +{hiddenCount} more lines</div>
        )}
      </div>
    );
  }

  if (toolName === 'Write') {
    const lines = allLines.slice(0, 10);
    const hiddenCount = Math.max(0, allLines.length - 10);

    return (
      <div className="space-y-0 overflow-hidden">
        <pre
          className={cn(
            'font-mono text-sm p-2 rounded whitespace-pre-wrap break-words',
            isError ? 'bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-100' : 'bg-muted'
          )}
        >
          {lines.join('\n')}
        </pre>
        {hiddenCount > 0 && (
          <div className="px-2 py-1 text-sm text-text-muted">... +{hiddenCount} more lines</div>
        )}
      </div>
    );
  }

  const lines = allLines.slice(0, 2);
  const hiddenCount = Math.max(0, allLines.length - 2);

  return (
    <div className="space-y-0 overflow-hidden">
      <pre
        className={cn(
          'font-mono text-sm p-2 rounded whitespace-pre-wrap break-words',
          isError ? 'bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-100' : 'bg-muted'
        )}
      >
        {lines.join('\n')}
      </pre>
      {hiddenCount > 0 && (
        <div className="px-2 py-1 text-sm text-text-muted">... +{hiddenCount} more lines</div>
      )}
    </div>
  );
}

const ToolPairItemInline: React.FC<{ tool: PairedTool }> = ({ tool }) => {
  return (
    <div className="my-2 text-sm">
      <div className="font-medium text-text-muted">
        {tool.name} {tool.description}
      </div>
      {tool.result && (
        <div className="mt-1 pl-2 border-l-2 border-border">
          {renderToolResult(tool.result.content, tool.name, tool.input, tool.result.is_error)}
        </div>
      )}
    </div>
  );
};

const ToolPairItem: React.FC<{
  tool: PairedTool;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ tool, isExpanded, onToggle }) => {
  const hasResult = tool.result !== undefined;

  return (
    <Card className="p-2 mb-2">
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-left font-mono text-sm hover:bg-muted/50"
        onClick={hasResult ? onToggle : undefined}
      >
        <div className="flex items-center gap-2 w-full">
          {hasResult && (
            <span className="text-muted-foreground">
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </span>
          )}
          {!hasResult && <span className="w-3" />}

          <span className="font-medium">● {tool.name}</span>

          <span className="text-muted-foreground flex-1 truncate">{tool.description}</span>

          {hasResult && !tool.result?.is_error && <CheckCircle className="h-3 w-3 text-success" />}
          {tool.result?.is_error && <XCircle className="h-3 w-3 text-destructive" />}
        </div>
      </Button>

      {isExpanded && tool.result && (
        <div className="mt-2 pl-5">
          {renderToolResult(tool.result.content, tool.name, tool.input, tool.result.is_error)}
        </div>
      )}
    </Card>
  );
};

export const ToolPairDisplay: React.FC<ToolPairDisplayProps> = ({
  toolCalls,
  simplifiedToolCalls,
  className,
  inline = false,
}) => {
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  const toggleExpanded = (toolId: string) => {
    setExpandedTools((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(toolId)) {
        newSet.delete(toolId);
      } else {
        newSet.add(toolId);
      }
      return newSet;
    });
  };

  const pairedTools = useMemo(() => {
    if (toolCalls && toolCalls.length > 0) {
      return pairToolsByUseId(toolCalls);
    }
    return [];
  }, [toolCalls]);

  if (inline) {
    return (
      <div className={cn('space-y-1', className)}>
        {pairedTools.map((tool) => (
          <ToolPairItemInline key={tool.id} tool={tool} />
        ))}
      </div>
    );
  }

  if (pairedTools.length === 0 && simplifiedToolCalls && simplifiedToolCalls.length > 0) {
    return (
      <div className={cn('space-y-2', className)}>
        {simplifiedToolCalls.map((tc, index) => (
          <div key={index} className="flex items-start gap-2">
            <span className="text-sm">● {tc.name}</span>
            {tc.description && (
              <span className="text-sm text-muted-foreground">{tc.description}</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-0', className)}>
      {pairedTools.map((tool) => (
        <ToolPairItem
          key={tool.id}
          tool={tool}
          isExpanded={expandedTools.has(tool.id)}
          onToggle={() => toggleExpanded(tool.id)}
        />
      ))}
    </div>
  );
};
