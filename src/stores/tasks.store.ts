/**
 * Tasks Store - Task/Todo Management
 *
 * Handles task tracking and focus management (separate from TodoWrite tool)
 *
 * Key features:
 * - Track general application tasks (not TodoWrite todos)
 * - Manage task status (pending, in_progress, completed)
 * - Focus tracking for UI highlighting
 * - Badge notifications on task completion
 * - Task lifecycle management
 *
 * Note: This is for general app tasks, not the TodoWrite tool's todos.
 * TodoWrite todos are managed via TodoActivityMonitor.
 *
 * @see docs/guides-architecture.md - Store Architecture
 */

import { logger } from '@/commons/utils/logger';
import { Task } from '@/types/todo';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// DevTools configuration - only in development
const withDevtools = process.env.NODE_ENV === 'development' ? devtools : (f: any) => f;

/**
 * TasksStore Interface
 * Defines all state and actions for tasks management
 */
export interface TasksStore {
  // ==================== STATE ====================

  // Tasks State
  tasks: Task[];
  focusedTodoId: string | null;

  // ==================== COMPUTED ====================

  // Computed Values
  hasActiveTasks: () => boolean;

  // ==================== ACTIONS ====================

  // Tasks Actions
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  setFocusedTodo: (id: string | null) => void;
  clearAllTasks: () => void;
}

/**
 * Tasks Store
 * Manages application tasks
 */
export const useTasksStore = create<TasksStore>()(
  withDevtools(
    immer<TasksStore>((set, get) => ({
      // ==================== STATE ====================

      tasks: [],
      focusedTodoId: null,

      // ==================== COMPUTED ====================

      hasActiveTasks: () => {
        return get().tasks.some((task) => task.status === 'in_progress');
      },

      // ==================== ACTIONS ====================

      addTask: (task: Task) => {
        set((state) => {
          state.tasks.push(task);
        });

        logger.debug(`[TasksStore] Added task: ${task.id}`);
      },

      updateTask: (id: string, updates: Partial<Task>) => {
        set((state) => {
          const taskIndex = state.tasks.findIndex((task) => task.id === id);
          if (taskIndex !== -1) {
            const previousStatus = state.tasks[taskIndex].status;
            state.tasks[taskIndex] = { ...state.tasks[taskIndex], ...updates };

            // Trigger badge notification on task completion
            // The badge will be shown if the window is not focused
            if (updates.status && previousStatus !== updates.status) {
              if (updates.status === 'completed') {
                // Use type assertion to access badge API
                const electronWithBadge = window.electron as any;
                if (electronWithBadge.badge) {
                  electronWithBadge.badge.show().catch((error: any) => {
                    logger.error('Failed to show badge notification:', error);
                  });
                }
              }
            }
          }
        });

        logger.debug(`[TasksStore] Updated task: ${id}`, updates);
      },

      deleteTask: (id: string) => {
        set((state) => {
          state.tasks = state.tasks.filter((task) => task.id !== id);
          if (state.focusedTodoId === id) {
            state.focusedTodoId = null;
          }
        });

        logger.debug(`[TasksStore] Deleted task: ${id}`);
      },

      setFocusedTodo: (id: string | null) => {
        set((state) => {
          state.focusedTodoId = id;
        });

        logger.debug(`[TasksStore] Set focused todo: ${id}`);
      },

      clearAllTasks: () => {
        set((state) => {
          state.tasks = [];
          state.focusedTodoId = null;
        });

        logger.info('[TasksStore] Cleared all tasks');
      },
    })),
    { name: 'tasks-store', trace: true }
  )
);

/**
 * React Hooks for Tasks
 * Convenient hooks for accessing tasks state
 */

export const useTasks = () => {
  return useTasksStore((state) => state.tasks);
};

export const useFocusedTodoId = () => {
  return useTasksStore((state) => state.focusedTodoId);
};

export const useHasActiveTasks = () => {
  return useTasksStore((state) => state.hasActiveTasks());
};

export const useTasksActions = () => {
  return useTasksStore((state) => ({
    addTask: state.addTask,
    updateTask: state.updateTask,
    deleteTask: state.deleteTask,
    setFocusedTodo: state.setFocusedTodo,
    clearAllTasks: state.clearAllTasks,
  }));
};
