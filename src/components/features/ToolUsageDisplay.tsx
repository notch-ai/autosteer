import React, { useState } from 'react';
import { ToolUsage } from '@/entities/ChatMessage';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/commons/utils';
import { ChevronRight, ChevronDown, Loader2, AlertCircle } from 'lucide-react';

export interface ToolUsageDisplayProps {
  toolUsages: ToolUsage[];
  isCompact?: boolean;
  className?: string;
}

const getToolIcon = (toolName: string): string => {
  // Return simple text indicators instead of emojis
  if (toolName.startsWith('mcp__')) {
    return 'MCP';
  }

  switch (toolName) {
    case 'Read':
      return 'R';
    case 'Write':
      return 'W';
    case 'Edit':
    case 'MultiEdit':
      return 'E';
    case 'Bash':
      return '$';
    case 'Grep':
      return 'G';
    case 'Glob':
      return 'F';
    case 'LS':
      return 'L';
    case 'WebFetch':
    case 'WebSearch':
      return '@';
    case 'TodoWrite':
      return 'T';
    case 'NotebookRead':
    case 'NotebookEdit':
      return 'N';
    case 'Task':
      return 'A';
    case 'ExitPlanMode':
      return 'X';
    default:
      return '?';
  }
};

const formatToolInput = (toolName: string, input: any): string => {
  if (!input) return '';

  switch (toolName) {
    case 'Read':
      return `${input.file_path || input.path || ''}`;
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
      return `${input.file_path || input.path || ''}`;
    case 'Bash':
      return input.command || '';
    case 'Grep':
      return `"${input.pattern}" in ${input.path || '.'}`;
    case 'Glob':
      return `${input.pattern} in ${input.path || '.'}`;
    case 'LS':
      return input.path || '.';
    case 'WebFetch':
    case 'WebSearch':
      return input.url || input.query || '';
    case 'TodoWrite':
      return `${input.todos?.length || 0} tasks`;
    default:
      // For unknown tools, try to extract meaningful info
      if (typeof input === 'string') return input;
      if (input.path) return input.path;
      if (input.file_path) return input.file_path;
      if (input.query) return input.query;
      if (input.prompt) return input.prompt.substring(0, 50) + '...';
      return JSON.stringify(input).substring(0, 50) + '...';
  }
};

/**
 * Feature component for ToolUsageDisplay
 * Migrated to use shadcn/ui components while maintaining legacy API
 * Displays tool usage information with expandable results
 */
export const ToolUsageDisplay: React.FC<ToolUsageDisplayProps> = ({
  toolUsages,
  isCompact = false,
  className,
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

  if (toolUsages.length === 0) return null;

  if (isCompact) {
    // Compact view - just show icons in badges
    return (
      <div className={cn('flex flex-wrap gap-1', className)}>
        {toolUsages.map((tool) => (
          <Badge
            key={tool.id}
            variant="outline"
            className="text-sm font-mono"
            title={`${tool.name}: ${formatToolInput(tool.name, tool.input)}`}
          >
            {getToolIcon(tool.name)}
          </Badge>
        ))}
      </div>
    );
  }

  // Full view with expandable results
  return (
    <div className={cn('space-y-2', className)}>
      {toolUsages.map((tool) => {
        const isExpanded = expandedTools.has(tool.id);
        const hasResult = tool.result !== undefined;

        return (
          <Card key={tool.id} className="p-2">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'w-full justify-start text-left font-mono text-sm',
                'hover:bg-muted/50'
              )}
              onClick={() => hasResult && toggleExpanded(tool.id)}
              disabled={!hasResult}
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

                <Badge variant="secondary" className="font-mono text-sm">
                  {getToolIcon(tool.name)}
                </Badge>

                <span className="font-medium">{tool.name}</span>

                <span className="text-muted-foreground flex-1 truncate">
                  {formatToolInput(tool.name, tool.input)}
                </span>

                {tool.isRunning && (
                  <Badge variant="default" className="animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Running
                  </Badge>
                )}

                {tool.isError && (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Error
                  </Badge>
                )}
              </div>
            </Button>

            {isExpanded && tool.result && (
              <div className="mt-2 pl-7">
                <ScrollArea className="max-h-60">
                  <pre
                    className={cn(
                      'text-sm p-3 rounded',
                      'bg-muted font-mono',
                      'whitespace-pre-wrap break-words'
                    )}
                  >
                    {tool.result}
                  </pre>
                </ScrollArea>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};
