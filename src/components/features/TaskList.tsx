import React from 'react';
export interface Task {
  id: string;
  content: string;
  completed: boolean;
  timestamp: Date;
  status?: 'pending' | 'in-progress' | 'completed' | 'failed';
}

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
              {task.status === 'in-progress' && '🔄'}
              {task.status === 'completed' && '✓'}
              {task.status === 'failed' && '❌'}
              {(!task.status || task.status === 'pending') && '○'}
            </div>
            <label>{task.content}</label>
          </div>
        ))}
      </div>
    </div>
  );
};
