import { enableMapSet } from 'immer';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Enable MapSet plugin for Immer to work with Map objects
enableMapSet();

/**
 * Git file status representation
 */
export interface GitFileStatus {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked' | 'staged';
  staged: boolean;
}

/**
 * Git status for a project
 */
export interface GitStatus {
  projectId: string;
  branch: string;
  ahead: number;
  behind: number;
  files: GitFileStatus[];
  lastUpdated: Date;
}

/**
 * Structured patch hunk for diff rendering
 */
export interface StructuredPatch {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

/**
 * Git diff for a file
 */
export interface GitDiff {
  path: string;
  diff: string;
  additions: number;
  deletions: number;
  timestamp: Date;
  structuredPatch?: StructuredPatch[];
}

/**
 * Git store state
 */
interface GitState {
  // Git status per project
  gitStatuses: Map<string, GitStatus>;

  // Diff cache per file path
  diffCache: Map<string, GitDiff>;

  // Loading states
  isLoadingStatus: boolean;
  isLoadingDiff: boolean;

  // Error states
  statusError: string | null;
  diffError: string | null;
}

/**
 * Git store actions
 */
interface GitActions {
  // Git status actions
  fetchGitStatus: (projectId: string) => Promise<void>;
  setGitStatus: (projectId: string, status: Omit<GitStatus, 'projectId'>) => void;
  clearGitStatus: (projectId: string) => void;
  getGitStatus: (projectId: string) => GitStatus | undefined;

  // Diff cache actions
  fetchDiff: (projectId: string, filePath: string) => Promise<void>;
  updateDiffCache: (filePath: string, diff: GitDiff) => void;
  getDiff: (filePath: string) => GitDiff | undefined;
  clearDiffCache: () => void;
  removeDiffFromCache: (filePath: string) => void;

  // Utility actions
  clearAll: () => void;
  setStatusError: (error: string | null) => void;
  setDiffError: (error: string | null) => void;
}

export type GitStore = GitState & GitActions;

/**
 * DevTools configuration
 */
const withDevtools = process.env.NODE_ENV === 'development' ? devtools : (f: any) => f;

/**
 * Git store - manages git status and diff caching for projects
 *
 * Features:
 * - Per-project git status tracking
 * - Diff caching for files
 * - Loading and error states
 * - Project-scoped git state management
 */
export const useGitStore = create<GitStore>()(
  withDevtools(
    immer<GitStore>((set, get) => ({
      // Initial state
      gitStatuses: new Map(),
      diffCache: new Map(),
      isLoadingStatus: false,
      isLoadingDiff: false,
      statusError: null,
      diffError: null,

      // Git status actions
      fetchGitStatus: async (_projectId: string) => {
        set((state) => {
          state.isLoadingStatus = true;
          state.statusError = null;
        });

        try {
          // TODO: Implement actual git status fetching via electron IPC
          // For now, this is a placeholder that can be implemented when needed

          // Simulated implementation:
          // const status = await window.electron.git.getStatus(projectId);
          // Simulate async operation for testability
          await new Promise((resolve) => setTimeout(resolve, 0));

          // set((state) => {
          //   state.gitStatuses.set(projectId, {
          //     projectId,
          //     ...status,
          //     lastUpdated: new Date(),
          //   });
          //   state.isLoadingStatus = false;
          // });

          set((state) => {
            state.isLoadingStatus = false;
          });
        } catch (error) {
          set((state) => {
            state.statusError =
              error instanceof Error ? error.message : 'Failed to fetch git status';
            state.isLoadingStatus = false;
          });
        }
      },

      setGitStatus: (projectId: string, status: Omit<GitStatus, 'projectId'>) => {
        set((state) => {
          state.gitStatuses.set(projectId, {
            projectId,
            ...status,
          });
        });
      },

      clearGitStatus: (projectId: string) => {
        set((state) => {
          state.gitStatuses.delete(projectId);
        });
      },

      getGitStatus: (projectId: string) => {
        return get().gitStatuses.get(projectId);
      },

      // Diff cache actions
      fetchDiff: async (_projectId: string, _filePath: string) => {
        set((state) => {
          state.isLoadingDiff = true;
          state.diffError = null;
        });

        try {
          // TODO: Implement actual diff fetching via electron IPC
          // For now, this is a placeholder that can be implemented when needed

          // Simulated implementation:
          // const diff = await window.electron.git.getDiff(projectId, filePath);
          // Simulate async operation for testability
          await new Promise((resolve) => setTimeout(resolve, 0));

          // set((state) => {
          //   state.diffCache.set(filePath, {
          //     path: filePath,
          //     ...diff,
          //     timestamp: new Date(),
          //   });
          //   state.isLoadingDiff = false;
          // });

          set((state) => {
            state.isLoadingDiff = false;
          });
        } catch (error) {
          set((state) => {
            state.diffError = error instanceof Error ? error.message : 'Failed to fetch diff';
            state.isLoadingDiff = false;
          });
        }
      },

      updateDiffCache: (filePath: string, diff: GitDiff) => {
        set((state) => {
          state.diffCache.set(filePath, diff);
        });
      },

      getDiff: (filePath: string) => {
        return get().diffCache.get(filePath);
      },

      clearDiffCache: () => {
        set((state) => {
          state.diffCache.clear();
        });
      },

      removeDiffFromCache: (filePath: string) => {
        set((state) => {
          state.diffCache.delete(filePath);
        });
      },

      // Utility actions
      clearAll: () => {
        set((state) => {
          state.gitStatuses.clear();
          state.diffCache.clear();
          state.statusError = null;
          state.diffError = null;
        });
      },

      setStatusError: (error: string | null) => {
        set((state) => {
          state.statusError = error;
        });
      },

      setDiffError: (error: string | null) => {
        set((state) => {
          state.diffError = error;
        });
      },
    })),
    { name: 'GitStore' }
  )
);
