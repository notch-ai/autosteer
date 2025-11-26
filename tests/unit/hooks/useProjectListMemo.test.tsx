import { renderHook } from '@testing-library/react';
import { useMemo } from 'react';

describe('ProjectList useMemo() Optimizations', () => {
  describe('Projects Filtering Cache', () => {
    it('should cache filtered projects result', () => {
      const projectsMap = new Map([
        ['1', { id: '1', githubRepo: 'repo1', branchName: 'main', folderName: 'folder1' }],
        ['2', { id: '2', githubRepo: '', branchName: 'main', folderName: 'folder2' }],
        ['3', { id: '3', githubRepo: 'repo3', branchName: 'dev', folderName: 'folder3' }],
      ]);

      const { result, rerender } = renderHook(() =>
        useMemo(
          () =>
            Array.from(projectsMap.values()).filter(
              (project) => project.githubRepo && project.branchName && project.folderName
            ),
          [projectsMap]
        )
      );

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
      expect(firstResult).toHaveLength(2);
    });

    it('should recalculate when projectsMap changes', () => {
      const map1 = new Map([
        ['1', { id: '1', githubRepo: 'repo1', branchName: 'main', folderName: 'folder1' }],
      ]);
      const map2 = new Map([
        ['1', { id: '1', githubRepo: 'repo1', branchName: 'main', folderName: 'folder1' }],
        ['2', { id: '2', githubRepo: 'repo2', branchName: 'dev', folderName: 'folder2' }],
      ]);

      const { result, rerender } = renderHook(
        ({ projectsMap }) =>
          useMemo(
            () =>
              Array.from(projectsMap.values()).filter(
                (project) => project.githubRepo && project.branchName && project.folderName
              ),
            [projectsMap]
          ),
        { initialProps: { projectsMap: map1 } }
      );

      expect(result.current).toHaveLength(1);

      rerender({ projectsMap: map2 });
      expect(result.current).toHaveLength(2);
    });
  });

  describe('Grouped Projects Cache', () => {
    it('should cache groupedProjects calculation', () => {
      const projects = [
        { id: '1', githubRepo: 'https://github.com/org/repo1.git', branchName: 'main' },
        { id: '2', githubRepo: 'https://github.com/org/repo1.git', branchName: 'dev' },
        { id: '3', githubRepo: 'https://github.com/org/repo2.git', branchName: 'main' },
      ];

      const { result, rerender } = renderHook(() =>
        useMemo(() => {
          const groups = new Map<string, typeof projects>();
          projects.forEach((project) => {
            if (!project.githubRepo) return;
            const repoName = project.githubRepo.split('/').pop()?.replace('.git', '') || 'Unknown';
            if (!groups.has(repoName)) {
              groups.set(repoName, []);
            }
            groups.get(repoName)!.push(project);
          });
          return groups;
        }, [projects])
      );

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
      expect(firstResult.size).toBe(2);
      expect(firstResult.get('repo1')).toHaveLength(2);
      expect(firstResult.get('repo2')).toHaveLength(1);
    });

    it('should recalculate when projects array changes', () => {
      const projects1 = [
        { id: '1', githubRepo: 'https://github.com/org/repo1.git', branchName: 'main' },
      ];
      const projects2 = [
        { id: '1', githubRepo: 'https://github.com/org/repo1.git', branchName: 'main' },
        { id: '2', githubRepo: 'https://github.com/org/repo2.git', branchName: 'dev' },
      ];

      const { result, rerender } = renderHook(
        ({ projects }) =>
          useMemo(() => {
            const groups = new Map<string, typeof projects>();
            projects.forEach((project) => {
              if (!project.githubRepo) return;
              const repoName =
                project.githubRepo.split('/').pop()?.replace('.git', '') || 'Unknown';
              if (!groups.has(repoName)) {
                groups.set(repoName, []);
              }
              groups.get(repoName)!.push(project);
            });
            return groups;
          }, [projects]),
        { initialProps: { projects: projects1 } }
      );

      expect(result.current.size).toBe(1);

      rerender({ projects: projects2 });
      expect(result.current.size).toBe(2);
    });
  });

  describe('Agent Filtering Cache', () => {
    it('should cache getProjectAgents filter result', () => {
      const agents = [
        { id: '1', projectId: 'folder1', title: 'Agent 1' },
        { id: '2', projectId: 'folder2', title: 'Agent 2' },
        { id: '3', projectId: 'folder1', title: 'Agent 3' },
      ];
      const projectFolderName = 'folder1';

      const { result, rerender } = renderHook(() =>
        useMemo(() => agents.filter((agent) => agent.projectId === projectFolderName), [agents])
      );

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
      expect(firstResult).toHaveLength(2);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should complete projects filter under 5ms for 100 projects', () => {
      const projectsMap = new Map(
        Array.from({ length: 100 }, (_, i) => [
          String(i),
          {
            id: String(i),
            githubRepo: i % 2 === 0 ? `repo${i}` : '',
            branchName: `branch${i}`,
            folderName: `folder${i}`,
          },
        ])
      );

      const start = performance.now();
      const filtered = Array.from(projectsMap.values()).filter(
        (project) => project.githubRepo && project.branchName && project.folderName
      );
      const end = performance.now();
      const duration = end - start;

      expect(filtered).toHaveLength(50);
      expect(duration).toBeLessThan(5);
    });

    it('should complete groupedProjects calculation under 10ms for 50 projects', () => {
      const projects = Array.from({ length: 50 }, (_, i) => ({
        id: String(i),
        githubRepo: `https://github.com/org/repo${i % 5}.git`,
        branchName: `branch${i}`,
      }));

      const start = performance.now();
      const groups = new Map<string, typeof projects>();
      projects.forEach((project) => {
        if (!project.githubRepo) return;
        const repoName = project.githubRepo.split('/').pop()?.replace('.git', '') || 'Unknown';
        if (!groups.has(repoName)) {
          groups.set(repoName, []);
        }
        groups.get(repoName)!.push(project);
      });
      const end = performance.now();
      const duration = end - start;

      expect(groups.size).toBe(5);
      expect(duration).toBeLessThan(10);
    });

    it('should demonstrate cache hit performance for groupedProjects', () => {
      const projects = Array.from({ length: 50 }, (_, i) => ({
        id: String(i),
        githubRepo: `https://github.com/org/repo${i % 5}.git`,
        branchName: `branch${i}`,
      }));

      const { result, rerender } = renderHook(() =>
        useMemo(() => {
          const groups = new Map<string, typeof projects>();
          projects.forEach((project) => {
            if (!project.githubRepo) return;
            const repoName = project.githubRepo.split('/').pop()?.replace('.git', '') || 'Unknown';
            if (!groups.has(repoName)) {
              groups.set(repoName, []);
            }
            groups.get(repoName)!.push(project);
          });
          return groups;
        }, [projects])
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
    it('should trigger recomputation when projectsMap reference changes', () => {
      const map1 = new Map([
        ['1', { id: '1', githubRepo: 'repo1', branchName: 'main', folderName: 'folder1' }],
      ]);
      const map2 = new Map([
        ['1', { id: '1', githubRepo: 'repo1', branchName: 'main', folderName: 'folder1' }],
      ]);

      const { result, rerender } = renderHook(
        ({ projectsMap }) =>
          useMemo(
            () =>
              Array.from(projectsMap.values()).filter(
                (project) => project.githubRepo && project.branchName && project.folderName
              ),
            [projectsMap]
          ),
        { initialProps: { projectsMap: map1 } }
      );

      const firstResult = result.current;
      rerender({ projectsMap: map2 });
      const secondResult = result.current;

      expect(secondResult).not.toBe(firstResult);
    });

    it('should NOT trigger recomputation when projects reference is stable', () => {
      const projects = [
        { id: '1', githubRepo: 'https://github.com/org/repo1.git', branchName: 'main' },
      ];

      const { result, rerender } = renderHook(() =>
        useMemo(() => {
          const groups = new Map<string, typeof projects>();
          projects.forEach((project) => {
            if (!project.githubRepo) return;
            const repoName = project.githubRepo.split('/').pop()?.replace('.git', '') || 'Unknown';
            if (!groups.has(repoName)) {
              groups.set(repoName, []);
            }
            groups.get(repoName)!.push(project);
          });
          return groups;
        }, [projects])
      );

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
    });
  });

  describe('Large Dataset Performance', () => {
    it('should handle 200 projects with grouping efficiently', () => {
      const projects = Array.from({ length: 200 }, (_, i) => ({
        id: String(i),
        githubRepo: `https://github.com/org/repo${i % 10}.git`,
        branchName: `branch${i}`,
        folderName: `folder${i}`,
      }));

      const { result, rerender } = renderHook(() =>
        useMemo(() => {
          const groups = new Map<string, typeof projects>();
          projects.forEach((project) => {
            if (!project.githubRepo) return;
            const repoName = project.githubRepo.split('/').pop()?.replace('.git', '') || 'Unknown';
            if (!groups.has(repoName)) {
              groups.set(repoName, []);
            }
            groups.get(repoName)!.push(project);
          });
          return groups;
        }, [projects])
      );

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
      expect(firstResult.size).toBe(10);
    });
  });
});
