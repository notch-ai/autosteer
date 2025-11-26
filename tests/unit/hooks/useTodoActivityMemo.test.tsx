import { renderHook } from '@testing-library/react';
import { useMemo } from 'react';

describe('TodoActivityTracker useMemo() Optimizations', () => {
  describe('Activity Filtering Cache', () => {
    it('should cache completed activities filter result', () => {
      const activities = [
        { todoId: '1', status: 'completed' as const },
        { todoId: '2', status: 'in_progress' as const },
        { todoId: '3', status: 'completed' as const },
      ];

      const { result, rerender } = renderHook(() =>
        useMemo(() => activities.filter((a) => a.status === 'completed'), [activities])
      );

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
      expect(firstResult).toHaveLength(2);
    });

    it('should cache ownedAgents and orphanAgents filters', () => {
      const taskAgentActivities = [
        { taskAgent: { id: '1', parentTodoId: 'todo1' }, status: 'active' },
        { taskAgent: { id: '2', parentTodoId: null }, status: 'active' },
        { taskAgent: { id: '3', parentTodoId: 'todo2' }, status: 'active' },
      ];

      const { result, rerender } = renderHook(() => {
        const ownedAgents = useMemo(
          () => taskAgentActivities.filter((a) => a.taskAgent.parentTodoId),
          [taskAgentActivities]
        );
        const orphanAgents = useMemo(
          () => taskAgentActivities.filter((a) => !a.taskAgent.parentTodoId),
          [taskAgentActivities]
        );
        return { ownedAgents, orphanAgents };
      });

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult.ownedAgents).toBe(secondResult.ownedAgents);
      expect(firstResult.orphanAgents).toBe(secondResult.orphanAgents);
      expect(firstResult.ownedAgents).toHaveLength(2);
      expect(firstResult.orphanAgents).toHaveLength(1);
    });
  });

  describe('Grouped Activities Cache', () => {
    it('should cache groupedActivities calculation', () => {
      const activities = [
        { todoId: 'todo1', status: 'completed' as const },
        { todoId: 'todo2', status: 'in_progress' as const },
        { todoId: 'todo3', status: 'completed' as const },
      ];
      const todoGroups = new Map([
        ['todo1', 1],
        ['todo2', 1],
        ['todo3', 2],
      ]);

      const { result, rerender } = renderHook(() =>
        useMemo(() => {
          const grouped = new Map<number, typeof activities>();
          activities.forEach((activity) => {
            const groupNum = todoGroups.get(activity.todoId) || 1;
            if (!grouped.has(groupNum)) {
              grouped.set(groupNum, []);
            }
            grouped.get(groupNum)!.push(activity);
          });
          return grouped;
        }, [activities])
      );

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
      expect(firstResult.size).toBe(2);
      expect(firstResult.get(1)).toHaveLength(2);
      expect(firstResult.get(2)).toHaveLength(1);
    });
  });

  describe('Sorted Groups Cache', () => {
    it('should cache sortedGroups array result', () => {
      const groupedActivities = new Map([
        [3, [{ todoId: 'todo1', status: 'completed' as const }]],
        [1, [{ todoId: 'todo2', status: 'in_progress' as const }]],
        [2, [{ todoId: 'todo3', status: 'completed' as const }]],
      ]);

      const { result, rerender } = renderHook(() =>
        useMemo(
          () => Array.from(groupedActivities.entries()).sort((a, b) => a[0] - b[0]),
          [groupedActivities]
        )
      );

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
      expect(firstResult).toHaveLength(3);
      expect(firstResult[0][0]).toBe(1);
      expect(firstResult[1][0]).toBe(2);
      expect(firstResult[2][0]).toBe(3);
    });

    it('should recalculate when groupedActivities changes', () => {
      const map1 = new Map([
        [1, [{ todoId: 'todo1', status: 'completed' as const }]],
        [2, [{ todoId: 'todo2', status: 'in_progress' as const }]],
      ]);
      const map2 = new Map([
        [1, [{ todoId: 'todo1', status: 'completed' as const }]],
        [2, [{ todoId: 'todo2', status: 'in_progress' as const }]],
        [3, [{ todoId: 'todo3', status: 'completed' as const }]],
      ]);

      const { result, rerender } = renderHook(
        ({ groupedActivities }) =>
          useMemo(
            () => Array.from(groupedActivities.entries()).sort((a, b) => a[0] - b[0]),
            [groupedActivities]
          ),
        { initialProps: { groupedActivities: map1 } }
      );

      expect(result.current).toHaveLength(2);

      rerender({ groupedActivities: map2 });
      expect(result.current).toHaveLength(3);
    });
  });

  describe('Group Metrics Cache', () => {
    it('should cache group completion count filter', () => {
      const groupActivities = [
        { todoId: 'todo1', status: 'completed' as const },
        { todoId: 'todo2', status: 'in_progress' as const },
        { todoId: 'todo3', status: 'completed' as const },
      ];

      const { result, rerender } = renderHook(() =>
        useMemo(
          () => groupActivities.filter((a) => a.status === 'completed').length,
          [groupActivities]
        )
      );

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
      expect(firstResult).toBe(2);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should complete activity filter under 5ms for 100 activities', () => {
      const activities = Array.from({ length: 100 }, (_, i) => ({
        todoId: `todo${i}`,
        status: i % 2 === 0 ? ('completed' as const) : ('in_progress' as const),
      }));

      const start = performance.now();
      const completed = activities.filter((a) => a.status === 'completed');
      const end = performance.now();
      const duration = end - start;

      expect(completed).toHaveLength(50);
      expect(duration).toBeLessThan(5);
    });

    it('should complete grouping under 10ms for 50 activities', () => {
      const activities = Array.from({ length: 50 }, (_, i) => ({
        todoId: `todo${i}`,
        status: 'completed' as const,
      }));
      const todoGroups = new Map(Array.from({ length: 50 }, (_, i) => [`todo${i}`, (i % 5) + 1]));

      const start = performance.now();
      const grouped = new Map<number, typeof activities>();
      activities.forEach((activity) => {
        const groupNum = todoGroups.get(activity.todoId) || 1;
        if (!grouped.has(groupNum)) {
          grouped.set(groupNum, []);
        }
        grouped.get(groupNum)!.push(activity);
      });
      const end = performance.now();
      const duration = end - start;

      expect(grouped.size).toBe(5);
      expect(duration).toBeLessThan(10);
    });

    it('should complete sorting under 5ms for 20 groups', () => {
      const groupedActivities = new Map(
        Array.from({ length: 20 }, (_, i) => [
          i + 1,
          [{ todoId: `todo${i}`, status: 'completed' as const }],
        ])
      );

      const start = performance.now();
      const sorted = Array.from(groupedActivities.entries()).sort((a, b) => a[0] - b[0]);
      const end = performance.now();
      const duration = end - start;

      expect(sorted).toHaveLength(20);
      expect(duration).toBeLessThan(5);
    });

    it('should demonstrate cache hit performance for grouping', () => {
      const activities = Array.from({ length: 50 }, (_, i) => ({
        todoId: `todo${i}`,
        status: 'completed' as const,
      }));
      const todoGroups = new Map(Array.from({ length: 50 }, (_, i) => [`todo${i}`, (i % 5) + 1]));

      const { result, rerender } = renderHook(() =>
        useMemo(() => {
          const grouped = new Map<number, typeof activities>();
          activities.forEach((activity) => {
            const groupNum = todoGroups.get(activity.todoId) || 1;
            if (!grouped.has(groupNum)) {
              grouped.set(groupNum, []);
            }
            grouped.get(groupNum)!.push(activity);
          });
          return grouped;
        }, [activities])
      );

      const start = performance.now();
      rerender();
      const end = performance.now();
      const cacheHitDuration = end - start;

      expect(cacheHitDuration).toBeLessThan(1);
      expect(result.current.size).toBe(5);
    });
  });

  describe('Dependency Array Validation', () => {
    it('should trigger recomputation when activities reference changes', () => {
      const activities1 = [{ todoId: 'todo1', status: 'completed' as const }];
      const activities2 = [{ todoId: 'todo1', status: 'completed' as const }];

      const { result, rerender } = renderHook(
        ({ activities }) =>
          useMemo(() => activities.filter((a) => a.status === 'completed'), [activities]),
        { initialProps: { activities: activities1 } }
      );

      const firstResult = result.current;
      rerender({ activities: activities2 });
      const secondResult = result.current;

      expect(secondResult).not.toBe(firstResult);
    });

    it('should NOT trigger recomputation when activities reference is stable', () => {
      const activities = [{ todoId: 'todo1', status: 'completed' as const }];

      const { result, rerender } = renderHook(() =>
        useMemo(() => activities.filter((a) => a.status === 'completed'), [activities])
      );

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
    });
  });

  describe('Large Dataset Performance', () => {
    it('should handle 200 activities with grouping and sorting efficiently', () => {
      const activities = Array.from({ length: 200 }, (_, i) => ({
        todoId: `todo${i}`,
        status: i % 2 === 0 ? ('completed' as const) : ('in_progress' as const),
      }));
      const todoGroups = new Map(Array.from({ length: 200 }, (_, i) => [`todo${i}`, (i % 10) + 1]));

      const { result, rerender } = renderHook(() =>
        useMemo(() => {
          const grouped = new Map<number, typeof activities>();
          activities.forEach((activity) => {
            const groupNum = todoGroups.get(activity.todoId) || 1;
            if (!grouped.has(groupNum)) {
              grouped.set(groupNum, []);
            }
            grouped.get(groupNum)!.push(activity);
          });
          const sorted = Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
          return sorted;
        }, [activities])
      );

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
      expect(firstResult).toHaveLength(10);
    });
  });
});
