import { cn } from '@/commons/utils';
import { Button } from '@/components/ui/button';
import React from 'react';

interface Task {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  activeForm?: string; // Present continuous form for in-progress display
}

export interface TodoDisplayProps {
  todos: Task[];
  isActive?: boolean;
  onToggle?: () => void;
}

/**
 * Feature component for TodoDisplay
 * Migrated to use shadcn/ui components while maintaining legacy API
 * Displays todo tasks with interactive status indicators
 */
export const TodoDisplay: React.FC<TodoDisplayProps> = ({ todos, isActive = false, onToggle }) => {
  if (!todos || todos.length === 0) return null;

  const completedCount = todos.filter((task) => task.status === 'completed').length;
  const totalCount = todos.length;
  const remainingCount = totalCount - completedCount;

  const getButtonText = () => {
    if (completedCount === 0) {
      return `${totalCount} todo${totalCount !== 1 ? 's' : ''}`;
    } else if (remainingCount === 0) {
      return `${completedCount} todo${completedCount !== 1 ? 's' : ''} done`;
    } else {
      return `${completedCount} of ${totalCount} todo${totalCount !== 1 ? 's' : ''} done`;
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        'h-auto py-0.5 px-2 text-[11px] focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus-visible:outline-none',
        isActive
          ? 'bg-white text-text border-border shadow-xs hover:bg-white hover:text-text hover:border-border hover:shadow-xs'
          : 'bg-muted text-text-muted border-border hover:bg-white hover:text-text hover:border-border hover:shadow-xs'
      )}
      onClick={onToggle}
    >
      {getButtonText()}
    </Button>
  );
};
