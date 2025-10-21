import { cn } from '@/commons/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { StreamingEvent } from '@/entities';
import { Wrench } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { TodoDisplay } from './TodoDisplay';

export interface StreamingEventDisplayProps {
  events: StreamingEvent[];
  className?: string;
}

interface Task {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  activeForm?: string; // Present continuous form for in-progress display
}

interface SimplifiedToolCall {
  type: 'tool_use';
  name: string;
  description?: string;
}

// Helper to get tool description
const getToolDescription = (toolName: string, toolInput: any): string => {
  if (!toolInput) return '';

  switch (toolName) {
    case 'Write':
    case 'Read':
    case 'Edit':
    case 'MultiEdit':
      return toolInput.file_path || toolInput.path || '';
    case 'Grep':
      return `"${toolInput.pattern || ''}" in ${toolInput.path || '.'}`;
    case 'Glob':
      return `${toolInput.pattern || ''} in ${toolInput.path || '.'}`;
    case 'LS':
      return toolInput.path || '.';
    case 'Bash':
      return toolInput.command || '';
    case 'Task':
      return toolInput.description || '';
    default:
      if (toolInput.path) return toolInput.path;
      if (toolInput.file_path) return toolInput.file_path;
      if (toolInput.query) return toolInput.query;
      return '';
  }
};

/**
 * Feature component for StreamingEventDisplay
 * Migrated to use shadcn/ui components while maintaining legacy API
 * Displays streaming events including todos, tool calls, and content
 */
export const StreamingEventDisplay: React.FC<StreamingEventDisplayProps> = ({
  events,
  className,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  // Extract todos, tool calls, and content
  const { latestTodos, simplifiedToolCalls, contentText } = useMemo(() => {
    const todoMap = new Map<string, Task>();
    const toolCalls: SimplifiedToolCall[] = [];
    let content = '';

    events.forEach((event) => {
      if (event.type === 'tool_use' && event.toolName === 'TodoWrite') {
        // Update the todo map with the latest state
        const tasks = event.toolInput?.todos || [];
        tasks.forEach((task: Task) => {
          todoMap.set(task.id, task);
        });
      } else if (event.type === 'tool_use' && event.toolName && event.toolName !== 'TodoWrite') {
        const description = getToolDescription(event.toolName, event.toolInput);
        toolCalls.push({
          type: 'tool_use',
          name: event.toolName,
          ...(description && { description }),
        });
      } else if (event.type === 'content' && event.content) {
        content += event.content;
      }
    });

    const todos = Array.from(todoMap.values());
    return { latestTodos: todos, simplifiedToolCalls: toolCalls, contentText: content };
  }, [events]);

  if (events.length === 0) return null;

  const hasTools = simplifiedToolCalls.length > 0;
  const isToolsExpanded = expandedSections.has('tools');

  return (
    <div className={cn('space-y-3', className)}>
      {/* Content text */}
      {contentText && (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <MarkdownRenderer content={contentText} />
        </div>
      )}

      {/* TODO display */}
      {latestTodos.length > 0 && (
        <>
          {contentText && <Separator className="my-3" />}
          <TodoDisplay todos={latestTodos} />
        </>
      )}

      {/* Tool calls display */}
      {hasTools && (
        <>
          {(contentText || latestTodos.length > 0) && <Separator className="my-3" />}
          <Card className="p-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start p-0 h-auto hover:bg-transparent"
              onClick={() => toggleSection('tools')}
            >
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Tool Calls ({simplifiedToolCalls.length})
                </span>
              </div>
            </Button>

            {isToolsExpanded && (
              <div className="mt-3 space-y-2">
                {simplifiedToolCalls.map((toolCall, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="font-mono">
                      {toolCall.name}
                    </Badge>
                    {toolCall.description && (
                      <span className="text-muted-foreground truncate">{toolCall.description}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};
