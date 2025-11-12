import { logger } from '@/commons/utils/logger';
import { useTasksStore } from '@/stores/tasks.store';
import { Task } from '@/types/todo';
import { nanoid } from 'nanoid';
import { useCallback, useMemo, useState } from 'react';

/**
 *
 * Business logic handler for task list component operations.
 *
 * Key Features:
 * - CRUD operations for tasks (Create, Read, Update, Delete)
 * - Task filtering by status, search query, and custom filters
 * - Task sorting by various keys with direction toggle
 * - Per-agent task isolation
 * - Task store coordination
 * - Error handling for all operations
 *
 * Architecture:
 * - Extracted from TaskList.tsx for separation of concerns
 * - Integrates with TasksStore for state management
 * - Supports multi-agent isolation via agentId prop
 *
 * Usage:
 * ```tsx
 * const {
 *   tasks,
 *   filteredTasks,
 *   addTask,
 *   updateTask,
 *   deleteTask,
 *   getTasks,
 *   setFilter,
 *   setSortBy,
 *   error,
 * } = useTaskListHandler({ agentId });
 * ```
 *
 * @see docs/guides-architecture.md Handler Pattern
 */

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface TaskFilter {
  status?: TaskStatus | TaskStatus[];
  query?: string;
}

export type SortKey = 'content' | 'status';
export type SortDirection = 'asc' | 'desc';

export interface UseTaskListHandlerProps {
  agentId?: string | null;
}

export interface UseTaskListHandlerReturn {
  tasks: Task[];
  filteredTasks: Task[];
  addTask: (task: Omit<Task, 'id'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  getTasks: () => Task[];
  setFilter: (filter: TaskFilter) => void;
  setSortBy: (sortKey: SortKey) => void;
  error: string | null;
}

export const useTaskListHandler = ({
  agentId,
}: UseTaskListHandlerProps = {}): UseTaskListHandlerReturn => {
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilterState] = useState<TaskFilter>({});
  const [sortKey, setSortKeyState] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Store operations
  const storeTasks = useTasksStore((state) => state.tasks);
  const addTaskToStore = useTasksStore((state) => state.addTask);
  const updateTaskInStore = useTasksStore((state) => state.updateTask);
  const deleteTaskFromStore = useTasksStore((state) => state.deleteTask);

  /**
   * Get tasks filtered by agent (if agentId provided)
   * Note: Current Task type doesn't have agentId, so we return all tasks
   * This is a placeholder for future agent-based task isolation
   */
  const tasks = useMemo(() => {
    if (!agentId) {
      return storeTasks;
    }

    // TODO: Filter by agentId when Task type includes agentId field
    // For now, return all tasks
    return storeTasks;
  }, [storeTasks, agentId]);

  /**
   * Apply filters to tasks
   */
  const applyFilters = useCallback(
    (tasksToFilter: Task[]): Task[] => {
      let filtered = [...tasksToFilter];

      // Filter by status
      if (filter.status) {
        const statusArray = Array.isArray(filter.status) ? filter.status : [filter.status];
        filtered = filtered.filter((task) => statusArray.includes(task.status));
      }

      // Filter by search query (case-insensitive)
      if (filter.query && filter.query.trim() !== '') {
        const query = filter.query.toLowerCase();
        filtered = filtered.filter((task) => task.content.toLowerCase().includes(query));
      }

      return filtered;
    },
    [filter]
  );

  /**
   * Apply sorting to tasks
   */
  const applySorting = useCallback(
    (tasksToSort: Task[]): Task[] => {
      if (!sortKey) {
        return tasksToSort;
      }

      return [...tasksToSort].sort((a, b) => {
        let comparison = 0;

        switch (sortKey) {
          case 'content':
            comparison = a.content.localeCompare(b.content);
            break;
          case 'status':
            comparison = a.status.localeCompare(b.status);
            break;
          default:
            return 0;
        }

        return sortDirection === 'asc' ? comparison : -comparison;
      });
    },
    [sortKey, sortDirection]
  );

  /**
   * Get filtered and sorted tasks
   */
  const filteredTasks = useMemo(() => {
    const filtered = applyFilters(tasks);
    return applySorting(filtered);
  }, [tasks, applyFilters, applySorting]);

  /**
   * addTask - Create new task with generated ID
   *
   * Flow:
   * 1. Validate required fields
   * 2. Generate unique ID
   * 3. Add to store
   * 4. Clear errors on success
   *
   * Error Cases:
   * - Empty content
   * - Store addition failure
   */
  const addTask = useCallback(
    (task: Omit<Task, 'id'>): void => {
      try {
        // Validate required fields
        if (!task.content || task.content.trim() === '') {
          setError('Task content is required');
          logger.error('[useTaskListHandler] Task content is required');
          return;
        }

        // Generate unique ID
        const newTask: Task = {
          ...task,
          id: nanoid(),
        };

        // Add to store
        addTaskToStore(newTask);

        // Clear errors
        setError(null);

        logger.debug('[useTaskListHandler] Task added', {
          taskId: newTask.id.substring(0, 8),
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Failed to add task: ${errorMessage}`);
        logger.error('[useTaskListHandler] Failed to add task', {
          error: errorMessage,
        });
      }
    },
    [addTaskToStore]
  );

  /**
   * updateTask - Update existing task by ID
   *
   * Flow:
   * 1. Validate task exists
   * 2. Update in store
   * 3. Clear errors on success
   *
   * Error Cases:
   * - Task not found
   * - Store update failure
   */
  const updateTask = useCallback(
    (id: string, updates: Partial<Task>): void => {
      try {
        // Validate task exists
        const taskExists = tasks.some((task) => task.id === id);
        if (!taskExists) {
          setError(`Task not found: ${id}`);
          logger.error('[useTaskListHandler] Task not found', {
            taskId: id.substring(0, 8),
          });
          return;
        }

        // Update in store
        updateTaskInStore(id, updates);

        // Clear errors
        setError(null);

        logger.debug('[useTaskListHandler] Task updated', {
          taskId: id.substring(0, 8),
          updates,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Failed to update task: ${errorMessage}`);
        logger.error('[useTaskListHandler] Failed to update task', {
          taskId: id.substring(0, 8),
          error: errorMessage,
        });
      }
    },
    [tasks, updateTaskInStore]
  );

  /**
   * deleteTask - Delete task by ID
   *
   * Flow:
   * 1. Validate task exists
   * 2. Delete from store
   * 3. Clear errors on success
   *
   * Error Cases:
   * - Task not found
   * - Store deletion failure
   */
  const deleteTask = useCallback(
    (id: string): void => {
      try {
        // Validate task exists
        const taskExists = tasks.some((task) => task.id === id);
        if (!taskExists) {
          setError(`Task not found: ${id}`);
          logger.error('[useTaskListHandler] Task not found for deletion', {
            taskId: id.substring(0, 8),
          });
          return;
        }

        // Delete from store
        deleteTaskFromStore(id);

        // Clear errors
        setError(null);

        logger.debug('[useTaskListHandler] Task deleted', {
          taskId: id.substring(0, 8),
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Failed to delete task: ${errorMessage}`);
        logger.error('[useTaskListHandler] Failed to delete task', {
          taskId: id.substring(0, 8),
          error: errorMessage,
        });
      }
    },
    [tasks, deleteTaskFromStore]
  );

  /**
   * getTasks - Get all tasks (filtered or unfiltered)
   *
   * Returns filtered tasks if filter is active, otherwise all tasks
   */
  const getTasks = useCallback((): Task[] => {
    if (Object.keys(filter).length === 0) {
      return tasks;
    }
    return filteredTasks;
  }, [tasks, filteredTasks, filter]);

  /**
   * setFilter - Set task filter
   *
   * Flow:
   * 1. Update filter state
   * 2. Filtered tasks are automatically recomputed via useMemo
   */
  const setFilter = useCallback((newFilter: TaskFilter): void => {
    setFilterState(newFilter);
    logger.debug('[useTaskListHandler] Filter updated', { filter: newFilter });
  }, []);

  /**
   * setSortBy - Set sort key and toggle direction
   *
   * Flow:
   * 1. If same key, toggle direction
   * 2. If new key, set to ascending
   * 3. Sorted tasks are automatically recomputed via useMemo
   */
  const setSortBy = useCallback(
    (newSortKey: SortKey): void => {
      if (sortKey === newSortKey) {
        // Toggle direction
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        logger.debug('[useTaskListHandler] Sort direction toggled', {
          sortKey: newSortKey,
          direction: sortDirection === 'asc' ? 'desc' : 'asc',
        });
      } else {
        // New sort key, default to ascending
        setSortKeyState(newSortKey);
        setSortDirection('asc');
        logger.debug('[useTaskListHandler] Sort key updated', {
          sortKey: newSortKey,
          direction: 'asc',
        });
      }
    },
    [sortKey, sortDirection]
  );

  return {
    tasks,
    filteredTasks,
    addTask,
    updateTask,
    deleteTask,
    getTasks,
    setFilter,
    setSortBy,
    error,
  };
};
