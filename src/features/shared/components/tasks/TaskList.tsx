import { useTaskListHandler } from '@/hooks/useTaskListHandler';
import { Task } from '@/types/todo';
import React from 'react';

export type { Task };

interface TaskListProps {
  tasks: Task[];
  onToggleTask: (taskId: string) => void;
}

export const TaskList: React.FC<TaskListProps> = ({ tasks }) => {
  const { filteredTasks } = useTaskListHandler();

  const displayTasks = tasks.length > 0 ? tasks : filteredTasks;

  return (
    <div>
      <div>
        {displayTasks.map((task) => (
          <div key={task.id}>
            <div>
              {task.status === 'in_progress' && '🔄'}
              {task.status === 'completed' && '✓'}
              {task.status === 'pending' && '○'}
            </div>
            <label>{task.content}</label>
          </div>
        ))}
      </div>
    </div>
  );
};
