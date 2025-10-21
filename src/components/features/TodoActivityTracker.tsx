import { cn } from '@/commons/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TaskAgentActivity, TodoActivities } from '@/renderer/services/TodoActivityMonitor';
import { getTodoMonitor } from '@/renderer/services/TodoActivityMonitorManager';
import { useCoreStore } from '@/stores';
import { CheckCircle2, Loader2, Wrench } from 'lucide-react';
import React, { useEffect, useState } from 'react';

export const TodoActivityTracker: React.FC = () => {
  const [activities, setActivities] = useState<TodoActivities[]>([]);
  const [taskAgentActivities, setTaskAgentActivities] = useState<TaskAgentActivity[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const focusedTodoId = useCoreStore((state) => state.focusedTodoId);
  const selectedAgentId = useCoreStore((state) => state.selectedAgentId);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusedTodoId) {
      setIsExpanded(true);
    }
  }, [focusedTodoId]);

  useEffect(() => {
    setActivities([]);
    setTaskAgentActivities([]);

    const loadActivities = () => {
      if (!selectedAgentId) return;
      const monitor = getTodoMonitor(selectedAgentId);
      if (!monitor) return;

      const currentActivities = monitor.getAllActivities();
      const currentTaskAgents = monitor.getAllTaskAgentActivities();

      setActivities((prev) => {
        const hasNewActivities =
          currentActivities.length !== prev.length ||
          JSON.stringify(currentActivities) !== JSON.stringify(prev);
        if (hasNewActivities) {
          // Scroll to bottom when new activities are added
          setTimeout(() => {
            const scrollArea = scrollAreaRef.current?.querySelector(
              '[data-radix-scroll-area-viewport]'
            );
            if (scrollArea) {
              scrollArea.scrollTop = scrollArea.scrollHeight;
            }
          }, 100);
        }
        return [...currentActivities];
      });

      setTaskAgentActivities([...currentTaskAgents]);
    };

    const timeoutId = setTimeout(loadActivities, 100);
    const interval = setInterval(loadActivities, 500);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [selectedAgentId]);

  if (activities.length === 0 && taskAgentActivities.length === 0) {
    return null;
  }

  const completedCount = activities.filter((a) => a.status === 'completed').length;
  const totalCount = activities.length;
  const remainingCount = totalCount - completedCount;

  const getTodosText = () => {
    if (completedCount === 0) {
      return `${totalCount} todo${totalCount !== 1 ? 's' : ''}`;
    } else if (remainingCount === 0) {
      return `${completedCount} todo${completedCount !== 1 ? 's' : ''} done`;
    } else {
      return `${completedCount} of ${totalCount} todo${totalCount !== 1 ? 's' : ''} done`;
    }
  };

  return (
    <div className="space-y-1 w-full min-w-0">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">{getTodosText()}</span>
      </div>

      {isExpanded && (
        <ScrollArea ref={scrollAreaRef} className="w-full">
          <div className="space-y-1 pr-2">
            {/* Group agents by parent todo */}
            {(() => {
              // Separate agents into owned (have parentTodoId) and orphan (no parentTodoId)
              const ownedAgents = taskAgentActivities.filter((a) => a.taskAgent.parentTodoId);
              const orphanAgents = taskAgentActivities.filter((a) => !a.taskAgent.parentTodoId);

              // Group owned agents by parent todo
              const agentsByTodo = new Map<string, TaskAgentActivity[]>();
              for (const agent of ownedAgents) {
                const todoId = agent.taskAgent.parentTodoId!;
                if (!agentsByTodo.has(todoId)) {
                  agentsByTodo.set(todoId, []);
                }
                agentsByTodo.get(todoId)!.push(agent);
              }

              return (
                <>
                  {/* Display Todos with their nested agents */}
                  {activities.map((activity) => (
                    <div key={activity.todoId}>
                      <TodoActivityItem
                        activity={activity}
                        isFocused={focusedTodoId === activity.todoId}
                      />
                      {/* Display child agents under this todo */}
                      {agentsByTodo.get(activity.todoId)?.map((taskActivity) => (
                        <div key={taskActivity.taskAgent.id} className="ml-6">
                          <TaskAgentActivityItem activity={taskActivity} />
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* Display orphan agents (no parent todo) at the end */}
                  {orphanAgents.map((taskActivity) => (
                    <TaskAgentActivityItem
                      key={taskActivity.taskAgent.id}
                      activity={taskActivity}
                    />
                  ))}
                </>
              );
            })()}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

interface TodoActivityItemProps {
  activity: TodoActivities;
  isFocused: boolean;
}

const TodoActivityItem: React.FC<TodoActivityItemProps> = ({ activity, isFocused }) => {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (isFocused) {
      setShowDetails(true);
    }
  }, [isFocused]);

  const getStatusIcon = () => {
    switch (activity.status) {
      case 'pending':
        return <CheckCircle2 className="h-4 w-4 text-text-muted" />;
      case 'in_progress':
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-text-muted" />;
    }
  };

  return (
    <div className="space-y-0 pb-3">
      <div className="flex items-start gap-2 w-full">
        <div className="w-4 flex-shrink-0 pt-0.5">{getStatusIcon()}</div>
        <span className="text-sm flex-1 text-left leading-normal min-w-0">
          {activity.todoContent}
        </span>
      </div>
      {activity.inferredMessages.length > 0 && (
        <div className="flex items-start gap-2 w-full mt-1 py-2">
          <div className="w-4 flex-shrink-0" />
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-auto py-0.5 px-2 text-[11px] focus-visible:ring-0 focus-visible:ring-offset-0',
              showDetails
                ? 'bg-background text-text border-border shadow-xs hover:bg-background hover:text-text hover:border-border hover:shadow-xs'
                : 'bg-muted text-text-muted border-border hover:bg-background hover:text-text hover:border-border hover:shadow-xs'
            )}
            onClick={() => setShowDetails(!showDetails)}
          >
            {activity.inferredMessages.length} action
            {activity.inferredMessages.length !== 1 ? 's' : ''}
          </Button>
        </div>
      )}

      {showDetails && activity.inferredMessages.length > 0 && (
        <div className="ml-0 mt-3 space-y-0">
          {activity.inferredMessages.map((msg: any, index: number) => (
            <div key={index} className="flex items-start gap-2">
              <Wrench className="h-4 w-4 text-blue ml-6" />
              <div className="flex-1 text-sm">
                {msg.toolName}
                {msg.toolInput && (
                  <>
                    {msg.toolName === 'Read' && 'file_path' in msg.toolInput && (
                      <span className="ml-2">{String(msg.toolInput?.file_path || '')}</span>
                    )}
                    {msg.toolName === 'Grep' && 'pattern' in msg.toolInput && (
                      <span className="ml-2">"{String(msg.toolInput?.pattern || '')}"</span>
                    )}
                    {msg.toolName === 'Task' && 'description' in msg.toolInput && (
                      <span className="ml-2">{String(msg.toolInput?.description || '')}</span>
                    )}
                    {(msg.toolName === 'Write' ||
                      msg.toolName === 'Edit' ||
                      msg.toolName === 'MultiEdit') &&
                      'file_path' in msg.toolInput && (
                        <span className="ml-2">{String(msg.toolInput?.file_path || '')}</span>
                      )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface TaskAgentActivityItemProps {
  activity: TaskAgentActivity;
}

const TaskAgentActivityItem: React.FC<TaskAgentActivityItemProps> = ({ activity }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="space-y-0 pb-3">
      <div className="flex items-start gap-2">
        <Wrench className="h-4 w-4 text-blue" />
        <div className="flex-1 text-sm">
          {activity.taskAgent.description}
          {activity.taskAgent.subagent_type && (
            <span className="ml-2 text-text-muted">({activity.taskAgent.subagent_type})</span>
          )}
          {activity.inferredMessages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'ml-2 h-auto py-0.5 px-2 text-[11px] focus-visible:ring-0 focus-visible:ring-offset-0',
                showDetails
                  ? 'bg-background text-text border-border shadow-xs hover:bg-background hover:text-text hover:border-border hover:shadow-xs'
                  : 'bg-muted text-text-muted border-border hover:bg-background hover:text-text hover:border-border hover:shadow-xs'
              )}
              onClick={() => setShowDetails(!showDetails)}
            >
              {activity.inferredMessages.length} action
              {activity.inferredMessages.length !== 1 ? 's' : ''}
            </Button>
          )}
        </div>
      </div>

      {showDetails && activity.inferredMessages.length > 0 && (
        <div className="ml-6 mt-3 space-y-0">
          {activity.inferredMessages.map((msg: any, index: number) => (
            <div key={index} className="flex items-start gap-2">
              <Wrench className="h-4 w-4 text-blue ml-6" />
              <div className="flex-1 text-sm">
                {msg.toolName}
                {msg.toolInput && (
                  <>
                    {msg.toolName === 'Read' && 'file_path' in msg.toolInput && (
                      <span className="ml-2">{String(msg.toolInput?.file_path || '')}</span>
                    )}
                    {(msg.toolName === 'Write' ||
                      msg.toolName === 'Edit' ||
                      msg.toolName === 'MultiEdit') &&
                      'file_path' in msg.toolInput && (
                        <span className="ml-2">{String(msg.toolInput?.file_path || '')}</span>
                      )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
