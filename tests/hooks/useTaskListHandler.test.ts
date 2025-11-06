/**
 * useTaskListHandler Hook Unit Tests
 *
 * Comprehensive test coverage for task list handler logic.
 * Tests CRUD operations, filtering, sorting, and per-agent isolation.
 *
 */

import { renderHook, act } from '@testing-library/react';
import { useTaskListHandler } from '@/hooks/useTaskListHandler';
import { useTasksStore } from '@/stores/tasks.store';
import { useAgentsStore } from '@/stores/agents.store';
import { Task } from '@/types/todo';

jest.mock('@/stores/tasks.store');
jest.mock('@/stores/agents.store');

const mockUseTasksStore = useTasksStore as unknown as jest.Mock;
const mockUseAgentsStore = useAgentsStore as unknown as jest.Mock;

describe('useTaskListHandler', () => {
  let mockAddTask: jest.Mock;
  let mockUpdateTask: jest.Mock;
  let mockDeleteTask: jest.Mock;

  const createMockTasks = (count: number): Task[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `task-${i + 1}`,
      content: `Task ${i + 1}`,
      status: i % 3 === 0 ? 'completed' : i % 3 === 1 ? 'in_progress' : 'pending',
      activeForm: `Testing task ${i + 1}`,
    })) as Task[];
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockAddTask = jest.fn();
    mockUpdateTask = jest.fn();
    mockDeleteTask = jest.fn();

    mockUseTasksStore.mockImplementation((selector) => {
      const store = {
        tasks: [],
        addTask: mockAddTask,
        updateTask: mockUpdateTask,
        deleteTask: mockDeleteTask,
      };
      return selector ? selector(store) : store;
    });

    mockUseAgentsStore.mockImplementation((selector) => {
      const store = {
        selectedAgentId: null,
      };
      return selector ? selector(store) : store;
    });
  });

  describe('Hook Initialization', () => {
    it('should initialize with empty task list', () => {
      const { result } = renderHook(() => useTaskListHandler());

      expect(result.current.tasks).toEqual([]);
      expect(result.current.filteredTasks).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should load existing tasks from store', () => {
      const mockTasks = createMockTasks(3);
      mockUseTasksStore.mockImplementation((selector) => {
        const store = {
          tasks: mockTasks,
          addTask: mockAddTask,
          updateTask: mockUpdateTask,
          deleteTask: mockDeleteTask,
        };
        return selector ? selector(store) : store;
      });

      const { result } = renderHook(() => useTaskListHandler());

      expect(result.current.tasks).toEqual(mockTasks);
      expect(result.current.filteredTasks).toHaveLength(3);
    });
  });

  describe('CRUD Operations', () => {
    describe('addTask', () => {
      it('should create task with generated ID', () => {
        const { result } = renderHook(() => useTaskListHandler());

        act(() => {
          result.current.addTask({
            content: 'New task',
            status: 'pending',
            activeForm: 'Creating new task',
          });
        });

        expect(mockAddTask).toHaveBeenCalledWith(
          expect.objectContaining({
            id: expect.any(String),
            content: 'New task',
            status: 'pending',
            activeForm: 'Creating new task',
          })
        );
      });

      it('should validate required fields', () => {
        const { result } = renderHook(() => useTaskListHandler());

        act(() => {
          result.current.addTask({
            content: '',
            status: 'pending',
            activeForm: 'Testing',
          });
        });

        expect(result.current.error).toBe('Task content is required');
        expect(mockAddTask).not.toHaveBeenCalled();
      });

      it('should clear error on successful add', () => {
        const { result } = renderHook(() => useTaskListHandler());

        act(() => {
          result.current.addTask({
            content: '',
            status: 'pending',
            activeForm: 'Testing',
          });
        });

        expect(result.current.error).toBe('Task content is required');

        act(() => {
          result.current.addTask({
            content: 'Valid task',
            status: 'pending',
            activeForm: 'Creating valid task',
          });
        });

        expect(result.current.error).toBeNull();
      });
    });

    describe('updateTask', () => {
      it('should update task by ID', () => {
        const mockTasks = createMockTasks(3);
        mockUseTasksStore.mockImplementation((selector) => {
          const store = {
            tasks: mockTasks,
            addTask: mockAddTask,
            updateTask: mockUpdateTask,
            deleteTask: mockDeleteTask,
          };
          return selector ? selector(store) : store;
        });

        const { result } = renderHook(() => useTaskListHandler());

        act(() => {
          result.current.updateTask('task-1', { status: 'completed' });
        });

        expect(mockUpdateTask).toHaveBeenCalledWith('task-1', { status: 'completed' });
      });

      it('should handle non-existent task', () => {
        const { result } = renderHook(() => useTaskListHandler());

        act(() => {
          result.current.updateTask('non-existent', { status: 'completed' });
        });

        expect(result.current.error).toBe('Task not found: non-existent');
        expect(mockUpdateTask).not.toHaveBeenCalled();
      });

      it('should allow partial updates', () => {
        const mockTasks = createMockTasks(1);
        mockUseTasksStore.mockImplementation((selector) => {
          const store = {
            tasks: mockTasks,
            addTask: mockAddTask,
            updateTask: mockUpdateTask,
            deleteTask: mockDeleteTask,
          };
          return selector ? selector(store) : store;
        });

        const { result } = renderHook(() => useTaskListHandler());

        act(() => {
          result.current.updateTask('task-1', { content: 'Updated content' });
        });

        expect(mockUpdateTask).toHaveBeenCalledWith('task-1', { content: 'Updated content' });
      });
    });

    describe('deleteTask', () => {
      it('should delete task by ID', () => {
        const mockTasks = createMockTasks(3);
        mockUseTasksStore.mockImplementation((selector) => {
          const store = {
            tasks: mockTasks,
            addTask: mockAddTask,
            updateTask: mockUpdateTask,
            deleteTask: mockDeleteTask,
          };
          return selector ? selector(store) : store;
        });

        const { result } = renderHook(() => useTaskListHandler());

        act(() => {
          result.current.deleteTask('task-1');
        });

        expect(mockDeleteTask).toHaveBeenCalledWith('task-1');
      });

      it('should handle non-existent task', () => {
        const { result } = renderHook(() => useTaskListHandler());

        act(() => {
          result.current.deleteTask('non-existent');
        });

        expect(result.current.error).toBe('Task not found: non-existent');
        expect(mockDeleteTask).not.toHaveBeenCalled();
      });
    });

    describe('getTasks', () => {
      it('should return all tasks when no filter', () => {
        const mockTasks = createMockTasks(5);
        mockUseTasksStore.mockImplementation((selector) => {
          const store = {
            tasks: mockTasks,
            addTask: mockAddTask,
            updateTask: mockUpdateTask,
            deleteTask: mockDeleteTask,
          };
          return selector ? selector(store) : store;
        });

        const { result } = renderHook(() => useTaskListHandler());

        const tasks = result.current.getTasks();

        expect(tasks).toEqual(mockTasks);
      });

      it('should return filtered tasks when filter active', () => {
        const mockTasks = createMockTasks(5);
        mockUseTasksStore.mockImplementation((selector) => {
          const store = {
            tasks: mockTasks,
            addTask: mockAddTask,
            updateTask: mockUpdateTask,
            deleteTask: mockDeleteTask,
          };
          return selector ? selector(store) : store;
        });

        const { result } = renderHook(() => useTaskListHandler());

        act(() => {
          result.current.setFilter({ status: 'completed' });
        });

        const tasks = result.current.getTasks();

        expect(tasks.every((t) => t.status === 'completed')).toBe(true);
      });
    });
  });

  describe('Filtering Logic', () => {
    const mockTasks = [
      { id: '1', content: 'Task 1', status: 'pending', activeForm: 'T1' } as Task,
      { id: '2', content: 'Task 2', status: 'in_progress', activeForm: 'T2' } as Task,
      { id: '3', content: 'Task 3', status: 'completed', activeForm: 'T3' } as Task,
      { id: '4', content: 'Task 4', status: 'pending', activeForm: 'T4' } as Task,
    ];

    beforeEach(() => {
      mockUseTasksStore.mockImplementation((selector) => {
        const store = {
          tasks: mockTasks,
          addTask: mockAddTask,
          updateTask: mockUpdateTask,
          deleteTask: mockDeleteTask,
        };
        return selector ? selector(store) : store;
      });
    });

    it('should filter by status', () => {
      const { result } = renderHook(() => useTaskListHandler());

      act(() => {
        result.current.setFilter({ status: 'pending' });
      });

      expect(result.current.filteredTasks).toHaveLength(2);
      expect(result.current.filteredTasks.every((t) => t.status === 'pending')).toBe(true);
    });

    it('should filter by multiple statuses', () => {
      const { result } = renderHook(() => useTaskListHandler());

      act(() => {
        result.current.setFilter({ status: ['pending', 'in_progress'] });
      });

      expect(result.current.filteredTasks).toHaveLength(3);
      expect(
        result.current.filteredTasks.every((t) => ['pending', 'in_progress'].includes(t.status))
      ).toBe(true);
    });

    it('should filter by search query', () => {
      const { result } = renderHook(() => useTaskListHandler());

      act(() => {
        result.current.setFilter({ query: 'Task 2' });
      });

      expect(result.current.filteredTasks).toHaveLength(1);
      expect(result.current.filteredTasks[0].content).toBe('Task 2');
    });

    it('should support case-insensitive search', () => {
      const { result } = renderHook(() => useTaskListHandler());

      act(() => {
        result.current.setFilter({ query: 'task 2' });
      });

      expect(result.current.filteredTasks).toHaveLength(1);
      expect(result.current.filteredTasks[0].content).toBe('Task 2');
    });

    it('should combine multiple filters', () => {
      const { result } = renderHook(() => useTaskListHandler());

      act(() => {
        result.current.setFilter({ status: 'pending', query: 'Task 1' });
      });

      expect(result.current.filteredTasks).toHaveLength(1);
      expect(result.current.filteredTasks[0].id).toBe('1');
    });

    it('should clear filters', () => {
      const { result } = renderHook(() => useTaskListHandler());

      act(() => {
        result.current.setFilter({ status: 'pending' });
      });

      expect(result.current.filteredTasks).toHaveLength(2);

      act(() => {
        result.current.setFilter({});
      });

      expect(result.current.filteredTasks).toHaveLength(4);
    });
  });

  describe('Sorting Logic', () => {
    const mockTasks = [
      {
        id: '1',
        content: 'C Task',
        status: 'completed',
        activeForm: 'C',
      } as Task,
      {
        id: '2',
        content: 'A Task',
        status: 'in_progress',
        activeForm: 'A',
      } as Task,
      {
        id: '3',
        content: 'B Task',
        status: 'pending',
        activeForm: 'B',
      } as Task,
    ];

    beforeEach(() => {
      mockUseTasksStore.mockImplementation((selector) => {
        const store = {
          tasks: mockTasks,
          addTask: mockAddTask,
          updateTask: mockUpdateTask,
          deleteTask: mockDeleteTask,
        };
        return selector ? selector(store) : store;
      });
    });

    it('should sort by content ascending', () => {
      const { result } = renderHook(() => useTaskListHandler());

      act(() => {
        result.current.setSortBy('content');
      });

      expect(result.current.filteredTasks[0].content).toBe('A Task');
      expect(result.current.filteredTasks[1].content).toBe('B Task');
      expect(result.current.filteredTasks[2].content).toBe('C Task');
    });

    it('should sort by status', () => {
      const { result } = renderHook(() => useTaskListHandler());

      act(() => {
        result.current.setSortBy('status');
      });

      const statuses = result.current.filteredTasks.map((t) => t.status);
      expect(statuses).toEqual(['completed', 'in_progress', 'pending']);
    });

    it('should toggle sort direction', () => {
      const { result } = renderHook(() => useTaskListHandler());

      act(() => {
        result.current.setSortBy('content');
      });

      expect(result.current.filteredTasks[0].content).toBe('A Task');

      act(() => {
        result.current.setSortBy('content');
      });

      expect(result.current.filteredTasks[0].content).toBe('C Task');
    });

    it('should maintain sort during filter changes', () => {
      const { result } = renderHook(() => useTaskListHandler());

      act(() => {
        result.current.setSortBy('content');
        result.current.setFilter({ status: ['pending', 'in_progress'] });
      });

      expect(result.current.filteredTasks[0].content).toBe('A Task');
      expect(result.current.filteredTasks[1].content).toBe('B Task');
    });
  });

  describe('Per-Agent Isolation', () => {
    const allTasks = [
      { id: '1', content: 'Task 1', status: 'pending', activeForm: 'T1' } as Task,
      { id: '2', content: 'Task 2', status: 'completed', activeForm: 'T2' } as Task,
      { id: '3', content: 'Task 3', status: 'pending', activeForm: 'T3' } as Task,
    ];

    it('should accept agentId prop for future agent isolation', () => {
      mockUseTasksStore.mockImplementation((selector) => {
        const store = {
          tasks: allTasks,
          addTask: mockAddTask,
          updateTask: mockUpdateTask,
          deleteTask: mockDeleteTask,
        };
        return selector ? selector(store) : store;
      });

      const { result } = renderHook(() => useTaskListHandler({ agentId: 'agent-1' }));

      // Currently returns all tasks since Task type doesn't include agentId
      // TODO: Update when Task type includes agentId field
      expect(result.current.tasks).toHaveLength(3);
    });

    it('should show all tasks when no agent selected', () => {
      mockUseTasksStore.mockImplementation((selector) => {
        const store = {
          tasks: allTasks,
          addTask: mockAddTask,
          updateTask: mockUpdateTask,
          deleteTask: mockDeleteTask,
        };
        return selector ? selector(store) : store;
      });

      const { result } = renderHook(() => useTaskListHandler());

      expect(result.current.tasks).toHaveLength(3);
    });

    it('should handle agentId prop changes', () => {
      mockUseTasksStore.mockImplementation((selector) => {
        const store = {
          tasks: allTasks,
          addTask: mockAddTask,
          updateTask: mockUpdateTask,
          deleteTask: mockDeleteTask,
        };
        return selector ? selector(store) : store;
      });

      const { result, rerender } = renderHook(({ agentId }) => useTaskListHandler({ agentId }), {
        initialProps: { agentId: 'agent-1' as string | null },
      });

      // Currently returns all tasks
      expect(result.current.tasks).toHaveLength(3);

      rerender({ agentId: 'agent-2' });

      // Still returns all tasks (no filtering until Task type includes agentId)
      expect(result.current.tasks).toHaveLength(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle store errors gracefully', () => {
      mockAddTask.mockImplementation(() => {
        throw new Error('Store error');
      });

      const { result } = renderHook(() => useTaskListHandler());

      act(() => {
        result.current.addTask({
          content: 'New task',
          status: 'pending',
          activeForm: 'Creating',
        });
      });

      expect(result.current.error).toBe('Failed to add task: Store error');
    });

    it('should clear error on successful operation', () => {
      mockUpdateTask.mockImplementationOnce(() => {
        throw new Error('Update failed');
      });

      const mockTasks = createMockTasks(1);
      mockUseTasksStore.mockImplementation((selector) => {
        const store = {
          tasks: mockTasks,
          addTask: mockAddTask,
          updateTask: mockUpdateTask,
          deleteTask: mockDeleteTask,
        };
        return selector ? selector(store) : store;
      });

      const { result } = renderHook(() => useTaskListHandler());

      act(() => {
        result.current.updateTask('task-1', { status: 'completed' });
      });

      expect(result.current.error).toBeTruthy();

      mockUpdateTask.mockClear();

      act(() => {
        result.current.updateTask('task-1', { status: 'pending' });
      });

      expect(result.current.error).toBeNull();
    });

    it('should handle empty task list operations', () => {
      const { result } = renderHook(() => useTaskListHandler());

      act(() => {
        result.current.updateTask('non-existent', { status: 'completed' });
      });

      expect(result.current.error).toBeTruthy();

      act(() => {
        result.current.deleteTask('non-existent');
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid filter changes', () => {
      const mockTasks = createMockTasks(10);
      mockUseTasksStore.mockImplementation((selector) => {
        const store = {
          tasks: mockTasks,
          addTask: mockAddTask,
          updateTask: mockUpdateTask,
          deleteTask: mockDeleteTask,
        };
        return selector ? selector(store) : store;
      });

      const { result } = renderHook(() => useTaskListHandler());

      act(() => {
        result.current.setFilter({ status: 'pending' });
        result.current.setFilter({ status: 'in_progress' });
        result.current.setFilter({ status: 'completed' });
      });

      expect(result.current.filteredTasks.every((t) => t.status === 'completed')).toBe(true);
    });

    it('should handle empty content in search', () => {
      const mockTasks = createMockTasks(3);
      mockUseTasksStore.mockImplementation((selector) => {
        const store = {
          tasks: mockTasks,
          addTask: mockAddTask,
          updateTask: mockUpdateTask,
          deleteTask: mockDeleteTask,
        };
        return selector ? selector(store) : store;
      });

      const { result } = renderHook(() => useTaskListHandler());

      act(() => {
        result.current.setFilter({ query: '' });
      });

      expect(result.current.filteredTasks).toHaveLength(3);
    });

    it('should handle tasks without all properties', () => {
      const incompleteTasks = [{ id: '1', content: 'Task 1', status: 'pending' } as Task];

      mockUseTasksStore.mockImplementation((selector) => {
        const store = {
          tasks: incompleteTasks,
          addTask: mockAddTask,
          updateTask: mockUpdateTask,
          deleteTask: mockDeleteTask,
        };
        return selector ? selector(store) : store;
      });

      const { result } = renderHook(() => useTaskListHandler());

      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.filteredTasks).toHaveLength(1);
    });

    it('should handle special characters in search', () => {
      const mockTasks = [
        { id: '1', content: 'Task (test)', status: 'pending', activeForm: 'T1' } as Task,
        { id: '2', content: 'Task [brackets]', status: 'pending', activeForm: 'T2' } as Task,
      ];

      mockUseTasksStore.mockImplementation((selector) => {
        const store = {
          tasks: mockTasks,
          addTask: mockAddTask,
          updateTask: mockUpdateTask,
          deleteTask: mockDeleteTask,
        };
        return selector ? selector(store) : store;
      });

      const { result } = renderHook(() => useTaskListHandler());

      act(() => {
        result.current.setFilter({ query: '(test)' });
      });

      expect(result.current.filteredTasks).toHaveLength(1);
      expect(result.current.filteredTasks[0].content).toBe('Task (test)');
    });
  });

  describe('Return Interface', () => {
    it('should expose all required functions', () => {
      const { result } = renderHook(() => useTaskListHandler());

      expect(typeof result.current.addTask).toBe('function');
      expect(typeof result.current.updateTask).toBe('function');
      expect(typeof result.current.deleteTask).toBe('function');
      expect(typeof result.current.getTasks).toBe('function');
      expect(typeof result.current.setFilter).toBe('function');
      expect(typeof result.current.setSortBy).toBe('function');
    });

    it('should expose all required state', () => {
      const { result } = renderHook(() => useTaskListHandler());

      expect(Array.isArray(result.current.tasks)).toBe(true);
      expect(Array.isArray(result.current.filteredTasks)).toBe(true);
      expect(result.current.error === null || typeof result.current.error === 'string').toBe(true);
    });
  });
});
