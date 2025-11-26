import { cn } from '@/commons/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TaskAgentActivity, TodoActivities } from '@/renderer/services/TodoActivityMonitor';
import { getTodoMonitor } from '@/renderer/services/TodoActivityMonitorManager';
import { useTasksStore, useAgentsStore } from '@/stores';
import { CheckCircle2, Loader2, Wrench, ChevronDown, ChevronRight } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

export const TodoActivityTracker: React.FC = () => {
  const [activities, setActivities] = useState<TodoActivities[]>([]);
  const [taskAgentActivities, setTaskAgentActivities] = useState<TaskAgentActivity[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [todoGroups, setTodoGroups] = useState<Map<string, number>>(new Map());
  const agentGroupDataRef = React.useRef<
    Map<string, { groups: Map<string, number>; nextGroup: number }>
  >(new Map());
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [agentsExpanded, setAgentsExpanded] = useState(true);
  const focusedTodoId = useTasksStore((state) => state.focusedTodoId);
  const selectedAgentId = useAgentsStore((state) => state.selectedAgentId);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusedTodoId) {
      setIsExpanded(true);
    }
  }, [focusedTodoId]);

  useEffect(() => {
    setActivities([]);
    setTaskAgentActivities([]);

    // Load or initialize group data for this agent
    if (!selectedAgentId) {
      setTodoGroups(new Map());
      return;
    }

    let agentData = agentGroupDataRef.current.get(selectedAgentId);
    if (!agentData) {
      agentData = { groups: new Map(), nextGroup: 1 };
      agentGroupDataRef.current.set(selectedAgentId, agentData);
    }
    setTodoGroups(new Map(agentData.groups));

    const loadActivities = () => {
      if (!selectedAgentId) return;
      const monitor = getTodoMonitor(selectedAgentId);
      if (!monitor) return;

      const currentActivities = monitor.getAllActivities();
      const currentTaskAgents = monitor.getAllTaskAgentActivities();

      // Get the agent's group data
      const agentData = agentGroupDataRef.current.get(selectedAgentId);
      if (!agentData) return;

      // Check for new todos and assign them to groups
      let hasNewTodos = false;
      const unassignedTodos: TodoActivities[] = [];

      currentActivities.forEach((activity) => {
        if (!agentData.groups.has(activity.todoId)) {
          hasNewTodos = true;
          unassignedTodos.push(activity);
        }
      });

      if (hasNewTodos) {
        const currentGroupNumber = agentData.nextGroup;
        unassignedTodos.forEach((activity) => {
          agentData.groups.set(activity.todoId, currentGroupNumber);
        });
        agentData.nextGroup = agentData.nextGroup + 1;
        setTodoGroups(new Map(agentData.groups));
      }

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

  // Memoize expensive filter operations to prevent recalculation on every render
  // Must be called before early return to comply with rules of hooks
  const completedCount = useMemo(
    () => activities.filter((a) => a.status === 'completed').length,
    [activities]
  );

  // Memoize agent filtering to prevent recalculation
  const ownedAgents = useMemo(
    () => taskAgentActivities.filter((a) => a.taskAgent.parentTodoId),
    [taskAgentActivities]
  );
  const orphanAgents = useMemo(
    () => taskAgentActivities.filter((a) => !a.taskAgent.parentTodoId),
    [taskAgentActivities]
  );

  // Memoize grouping and sorting operations
  const groupedActivities = useMemo(() => {
    const grouped = new Map<number, TodoActivities[]>();
    activities.forEach((activity) => {
      const groupNum = todoGroups.get(activity.todoId) || 1;
      if (!grouped.has(groupNum)) {
        grouped.set(groupNum, []);
      }
      grouped.get(groupNum)!.push(activity);
    });
    return grouped;
  }, [activities, todoGroups]);

  const sortedGroups = useMemo(
    () => Array.from(groupedActivities.entries()).sort((a, b) => a[0] - b[0]),
    [groupedActivities]
  );

  const totalCount = activities.length;
  const remainingCount = totalCount - completedCount;

  if (activities.length === 0 && taskAgentActivities.length === 0) {
    return null;
  }

  const getTodosText = () => {
    if (completedCount === 0) {
      return `${totalCount} task${totalCount !== 1 ? 's' : ''}`;
    } else if (remainingCount === 0) {
      return `${completedCount} task${completedCount !== 1 ? 's' : ''} done`;
    } else {
      return `${completedCount} of ${totalCount} task${totalCount !== 1 ? 's' : ''} done`;
    }
  };

  const toggleGroup = (groupNumber: number) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupNumber)) {
        newSet.delete(groupNumber);
      } else {
        newSet.add(groupNumber);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-1 w-full min-w-0">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">{getTodosText()}</span>
      </div>

      {isExpanded && (
        <ScrollArea ref={scrollAreaRef} className="w-full">
          <div className="space-y-2 pr-2">
            {(() => {
              // Group owned agents by parent todo (using memoized ownedAgents)
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
                  {sortedGroups.map(([groupNum, groupActivities]) => {
                    const isGroupExpanded = expandedGroups.has(groupNum);
                    const groupCompleted = groupActivities.filter(
                      (a) => a.status === 'completed'
                    ).length;
                    const groupTotal = groupActivities.length;

                    return (
                      <div key={groupNum} className="space-y-1">
                        <button
                          onClick={() => toggleGroup(groupNum)}
                          className="w-full flex items-center gap-2 px-2 py-1 hover:bg-card-hover rounded transition-colors"
                        >
                          {isGroupExpanded ? (
                            <ChevronDown className="h-3 w-3 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-gray-500" />
                          )}
                          <span className="text-sm font-medium">Todo {groupNum}</span>
                          <span className="text-xs text-gray-500">
                            ({groupCompleted}/{groupTotal})
                          </span>
                        </button>

                        {isGroupExpanded && (
                          <div className="ml-5 space-y-1">
                            {groupActivities.map((activity) => (
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
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Agents section (no parent todo) */}
                  {orphanAgents.length > 0 && (
                    <div className="space-y-1">
                      <button
                        onClick={() => setAgentsExpanded(!agentsExpanded)}
                        className="w-full flex items-center gap-2 px-2 py-1 hover:bg-card-hover rounded transition-colors"
                      >
                        {agentsExpanded ? (
                          <ChevronDown className="h-3 w-3 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-gray-500" />
                        )}
                        <span className="text-sm font-medium">Agents</span>
                        <span className="text-xs text-gray-500">({orphanAgents.length})</span>
                      </button>

                      {agentsExpanded && (
                        <div className="ml-5 space-y-1">
                          {orphanAgents.map((taskActivity) => (
                            <TaskAgentActivityItem
                              key={taskActivity.taskAgent.id}
                              activity={taskActivity}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
        return <CheckCircle2 className="h-4 w-4 text-muted-foreground" />;
      case 'in_progress':
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-muted-foreground" />;
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
                ? 'bg-background text-foreground border-border shadow-xs hover:bg-card-hover hover:text-foreground hover:border-border hover:shadow-xs'
                : 'bg-muted text-muted-foreground border-border hover:bg-card-hover hover:text-foreground hover:border-border hover:shadow-xs'
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
            <span className="ml-2 text-muted-foreground">({activity.taskAgent.subagent_type})</span>
          )}
          {activity.inferredMessages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'ml-2 h-auto py-0.5 px-2 text-[11px] focus-visible:ring-0 focus-visible:ring-offset-0',
                showDetails
                  ? 'bg-background text-foreground border-border shadow-xs hover:bg-card-hover hover:text-foreground hover:border-border hover:shadow-xs'
                  : 'bg-muted text-muted-foreground border-border hover:bg-card-hover hover:text-foreground hover:border-border hover:shadow-xs'
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
