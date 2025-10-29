import { Task } from '@/types/todo';
import React from 'react';

export type { Task };

interface TaskListProps {
  tasks: Task[];
  onToggleTask: (taskId: string) => void;
}

export const TaskList: React.FC<TaskListProps> = ({ tasks }) => {
  return (
    <div>
      <div>
        {tasks.map((task) => (
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
