/**
 * Git Store Tests
 * Tests all actions with 100% coverage following TRD requirements
 */

// Mock electron-log/renderer before any imports
jest.mock('electron-log/renderer', () => {
  const mockLog: any = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    silly: jest.fn(),
    log: jest.fn(),
    transports: {
      file: { level: false, format: '', maxSize: 0 },
      console: { level: false, format: '' },
    },
    initialize: jest.fn(),
    scope: jest.fn(function (this: any) {
      return this;
    }),
  };
  return { __esModule: true, default: mockLog };
});

import { useGitStore, GitStatus, GitDiff, GitFileStatus } from '@/stores';

describe('GitStore', () => {
  beforeEach(() => {
    // Reset store
    useGitStore.setState({
      gitStatuses: new Map(),
      diffCache: new Map(),
      isLoadingStatus: false,
      isLoadingDiff: false,
      statusError: null,
      diffError: null,
    });

    jest.clearAllMocks();
  });

  describe('State Initialization', () => {
    it('should initialize with empty state', () => {
      const state = useGitStore.getState();
      expect(state.gitStatuses).toBeInstanceOf(Map);
      expect(state.diffCache).toBeInstanceOf(Map);
      expect(state.gitStatuses.size).toBe(0);
      expect(state.diffCache.size).toBe(0);
      expect(state.isLoadingStatus).toBe(false);
      expect(state.isLoadingDiff).toBe(false);
      expect(state.statusError).toBeNull();
      expect(state.diffError).toBeNull();
    });
  });

  describe('Actions - setGitStatus', () => {
    it('should set git status for a project', () => {
      const files: GitFileStatus[] = [{ path: 'src/file.ts', status: 'modified', staged: false }];

      const status: Omit<GitStatus, 'projectId'> = {
        branch: 'main',
        ahead: 2,
        behind: 0,
        files,
        lastUpdated: new Date(),
      };

      useGitStore.getState().setGitStatus('proj-1', status);

      // Get fresh state after mutation
      const state = useGitStore.getState();
      const retrieved = state.gitStatuses.get('proj-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.projectId).toBe('proj-1');
      expect(retrieved?.branch).toBe('main');
      expect(retrieved?.ahead).toBe(2);
      expect(retrieved?.files).toEqual(files);
    });

    it('should overwrite existing git status', () => {
      useGitStore.getState().setGitStatus('proj-1', {
        branch: 'feature',
        ahead: 1,
        behind: 0,
        files: [],
        lastUpdated: new Date(),
      });

      useGitStore.getState().setGitStatus('proj-1', {
        branch: 'main',
        ahead: 5,
        behind: 2,
        files: [],
        lastUpdated: new Date(),
      });

      // Get fresh state after mutations
      const state = useGitStore.getState();
      const retrieved = state.gitStatuses.get('proj-1');
      expect(retrieved?.branch).toBe('main');
      expect(retrieved?.ahead).toBe(5);
    });
  });

  describe('Actions - clearGitStatus', () => {
    it('should clear git status for a project', () => {
      useGitStore.setState({
        gitStatuses: new Map([
          [
            'proj-1',
            {
              projectId: 'proj-1',
              branch: 'main',
              ahead: 0,
              behind: 0,
              files: [],
              lastUpdated: new Date(),
            },
          ],
        ]),
      });

      useGitStore.getState().clearGitStatus('proj-1');

      // Get fresh state after mutation
      const state = useGitStore.getState();
      expect(state.gitStatuses.get('proj-1')).toBeUndefined();
    });

    it('should handle clearing non-existent project gracefully', () => {
      const state = useGitStore.getState();
      expect(() => state.clearGitStatus('non-existent')).not.toThrow();
    });
  });

  describe('Selectors - getGitStatus', () => {
    it('should get git status for a project', () => {
      const gitStatus: GitStatus = {
        projectId: 'proj-1',
        branch: 'main',
        ahead: 1,
        behind: 2,
        files: [],
        lastUpdated: new Date(),
      };

      useGitStore.setState({
        gitStatuses: new Map([['proj-1', gitStatus]]),
      });

      const state = useGitStore.getState();
      const result = state.getGitStatus('proj-1');
      expect(result).toEqual(gitStatus);
    });

    it('should return undefined for non-existent project', () => {
      const state = useGitStore.getState();
      const result = state.getGitStatus('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('Actions - fetchGitStatus', () => {
    it('should set loading state during fetch', async () => {
      const promise = useGitStore.getState().fetchGitStatus('proj-1');

      const stateDuringLoad = useGitStore.getState();
      expect(stateDuringLoad.isLoadingStatus).toBe(true);
      expect(stateDuringLoad.statusError).toBeNull();

      await promise;
    });

    it('should clear loading state after fetch', async () => {
      await useGitStore.getState().fetchGitStatus('proj-1');

      const state = useGitStore.getState();
      expect(state.isLoadingStatus).toBe(false);
    });
  });

  describe('Actions - updateDiffCache', () => {
    it('should add diff to cache', () => {
      const diff: GitDiff = {
        path: 'src/file.ts',
        diff: '@@ -1,1 +1,1 @@\n-old\n+new',
        additions: 1,
        deletions: 1,
        timestamp: new Date(),
      };

      useGitStore.getState().updateDiffCache('src/file.ts', diff);

      // Get fresh state after mutation
      const state = useGitStore.getState();
      expect(state.diffCache.get('src/file.ts')).toEqual(diff);
    });

    it('should overwrite existing diff', () => {
      const diff1: GitDiff = {
        path: 'src/file.ts',
        diff: 'old diff',
        additions: 1,
        deletions: 0,
        timestamp: new Date(),
      };

      const diff2: GitDiff = {
        path: 'src/file.ts',
        diff: 'new diff',
        additions: 2,
        deletions: 1,
        timestamp: new Date(),
      };

      useGitStore.getState().updateDiffCache('src/file.ts', diff1);
      useGitStore.getState().updateDiffCache('src/file.ts', diff2);

      // Get fresh state after mutations
      const state = useGitStore.getState();
      expect(state.diffCache.get('src/file.ts')).toEqual(diff2);
    });
  });

  describe('Selectors - getDiff', () => {
    it('should get diff for a file', () => {
      const diff: GitDiff = {
        path: 'src/file.ts',
        diff: '@@ -1,1 +1,1 @@',
        additions: 1,
        deletions: 1,
        timestamp: new Date(),
      };

      useGitStore.setState({
        diffCache: new Map([['src/file.ts', diff]]),
      });

      const state = useGitStore.getState();
      const result = state.getDiff('src/file.ts');
      expect(result).toEqual(diff);
    });

    it('should return undefined for non-existent file', () => {
      const state = useGitStore.getState();
      const result = state.getDiff('non-existent.ts');
      expect(result).toBeUndefined();
    });
  });

  describe('Actions - clearDiffCache', () => {
    it('should clear all diffs from cache', () => {
      const diff1: GitDiff = {
        path: 'src/file1.ts',
        diff: 'diff1',
        additions: 1,
        deletions: 0,
        timestamp: new Date(),
      };

      const diff2: GitDiff = {
        path: 'src/file2.ts',
        diff: 'diff2',
        additions: 2,
        deletions: 1,
        timestamp: new Date(),
      };

      useGitStore.setState({
        diffCache: new Map([
          ['src/file1.ts', diff1],
          ['src/file2.ts', diff2],
        ]),
      });

      useGitStore.getState().clearDiffCache();

      // Get fresh state after mutation
      const state = useGitStore.getState();
      expect(state.diffCache.size).toBe(0);
    });
  });

  describe('Actions - removeDiffFromCache', () => {
    it('should remove specific diff from cache', () => {
      const diff: GitDiff = {
        path: 'src/file.ts',
        diff: 'diff',
        additions: 1,
        deletions: 0,
        timestamp: new Date(),
      };

      useGitStore.setState({
        diffCache: new Map([['src/file.ts', diff]]),
      });

      useGitStore.getState().removeDiffFromCache('src/file.ts');

      // Get fresh state after mutation
      const state = useGitStore.getState();
      expect(state.diffCache.get('src/file.ts')).toBeUndefined();
      expect(state.diffCache.size).toBe(0);
    });

    it('should handle removing non-existent diff gracefully', () => {
      const state = useGitStore.getState();
      expect(() => state.removeDiffFromCache('non-existent.ts')).not.toThrow();
    });
  });

  describe('Actions - fetchDiff', () => {
    it('should set loading state during fetch', async () => {
      const promise = useGitStore.getState().fetchDiff('proj-1', 'src/file.ts');

      const stateDuringLoad = useGitStore.getState();
      expect(stateDuringLoad.isLoadingDiff).toBe(true);
      expect(stateDuringLoad.diffError).toBeNull();

      await promise;
    });

    it('should clear loading state after fetch', async () => {
      await useGitStore.getState().fetchDiff('proj-1', 'src/file.ts');

      const state = useGitStore.getState();
      expect(state.isLoadingDiff).toBe(false);
    });
  });

  describe('Actions - clearAll', () => {
    it('should clear all git state', () => {
      useGitStore.setState({
        gitStatuses: new Map([
          [
            'proj-1',
            {
              projectId: 'proj-1',
              branch: 'main',
              ahead: 0,
              behind: 0,
              files: [],
              lastUpdated: new Date(),
            },
          ],
        ]),
        diffCache: new Map([
          [
            'file.ts',
            { path: 'file.ts', diff: 'diff', additions: 1, deletions: 0, timestamp: new Date() },
          ],
        ]),
        statusError: 'Error',
        diffError: 'Error',
      });

      useGitStore.getState().clearAll();

      // Get fresh state after mutation
      const state = useGitStore.getState();
      expect(state.gitStatuses.size).toBe(0);
      expect(state.diffCache.size).toBe(0);
      expect(state.statusError).toBeNull();
      expect(state.diffError).toBeNull();
    });
  });

  describe('Actions - setStatusError', () => {
    it('should set status error', () => {
      useGitStore.getState().setStatusError('Failed to fetch status');

      // Get fresh state after mutation
      const state = useGitStore.getState();
      expect(state.statusError).toBe('Failed to fetch status');
    });

    it('should clear status error', () => {
      useGitStore.setState({ statusError: 'Error' });

      useGitStore.getState().setStatusError(null);

      // Get fresh state after mutation
      const state = useGitStore.getState();
      expect(state.statusError).toBeNull();
    });
  });

  describe('Actions - setDiffError', () => {
    it('should set diff error', () => {
      useGitStore.getState().setDiffError('Failed to fetch diff');

      // Get fresh state after mutation
      const state = useGitStore.getState();
      expect(state.diffError).toBe('Failed to fetch diff');
    });

    it('should clear diff error', () => {
      useGitStore.setState({ diffError: 'Error' });

      useGitStore.getState().setDiffError(null);

      // Get fresh state after mutation
      const state = useGitStore.getState();
      expect(state.diffError).toBeNull();
    });
  });
});
