import { logger } from '@/commons/utils/logger';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { mockFileDiffs, mockGitStats } from '@/mocks/gitDiffMockData';
import { useProjectsStore } from '@/stores';
import { FileDiff } from '@/types/git-diff.types';
import {
  ArrowRight,
  Binary,
  FilePenLine,
  FilePlus,
  FileText,
  FileX,
  GitBranch,
  Loader2,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { GitDiffViewer } from '@/features/shared/components/git/GitDiffViewer';

// Toggle this to use mock data for UX development
const USE_MOCK_DATA = false;

interface GitDiffStat {
  file: string;
  additions: number;
  deletions: number;
  binary?: boolean;
  status?: 'modified' | 'staged' | 'both' | 'untracked';
  isRenamed?: boolean;
  oldPath?: string;
}

interface GitDiffStatsResponse {
  success: boolean;
  stats: GitDiffStat[];
  error: string | null;
}

export const GitDiffStats: React.FC = () => {
  const [stats, setStats] = useState<GitDiffStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState<FileDiff[]>([]);
  const [loadingDiff, setLoadingDiff] = useState(false);

  // Get selectedProjectId separately - this is stable and won't cause re-renders
  const selectedProjectId = useProjectsStore((state) => state.selectedProjectId);

  // CRITICAL FIX: Use useMemo to derive workingDirectory only when selectedProjectId changes
  // This prevents re-renders when the projects Map reference changes
  const workingDirectory = React.useMemo(() => {
    // Access store only when needed, not on every render
    const state = useProjectsStore.getState();
    const project = selectedProjectId ? state.projects.get(selectedProjectId) : null;
    return project?.localPath;
  }, [selectedProjectId]);

  const fetchGitStats = useCallback(async () => {
    // Use mock data for UX development
    if (USE_MOCK_DATA) {
      setLoading(true);
      setError(null);
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 300));
      setStats(mockGitStats);
      setLoading(false);
      return;
    }

    if (!workingDirectory) {
      setStats([]);
      setError('No worktree selected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = (await window.electron?.ipcRenderer?.invoke?.(
        'git:diff-stats',
        workingDirectory
      )) as GitDiffStatsResponse | undefined;

      if (!result || !result.success) {
        throw new Error(result?.error || 'Failed to get git diff stats');
      }

      setStats(result.stats || []);
    } catch (err) {
      logger.error('Error fetching git stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch git stats');
      setStats([]);
    } finally {
      setLoading(false);
    }
  }, [workingDirectory]);

  // Fetch stats on mount and when working directory changes
  useEffect(() => {
    void fetchGitStats();
  }, [fetchGitStats]);

  // Polling fallback - refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchGitStats();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [fetchGitStats]);

  // Setup file watching for automatic updates
  useEffect(() => {
    if (!workingDirectory) {
      return;
    }

    // NOTE: During rapid project switching, you may see MaxListenersExceededWarning
    // This is EXPECTED BEHAVIOR - React batches cleanup asynchronously
    // All listeners ARE properly cleaned up, just delayed by React's scheduling
    // The warning is harmless and will resolve once switching stabilizes

    // Log listener state BEFORE adding
    const ipcRenderer = window.electron?.ipcRenderer as any;
    const listenerCountBefore = ipcRenderer?.listenerCount?.('git-diff:changes-detected') ?? 0;
    console.log('📊 [GitDiffStats] BEFORE ADD:', {
      event: 'git-diff:changes-detected',
      count: listenerCountBefore,
      allEvents: ipcRenderer?.eventNames?.() ?? [],
    });

    // Start watching for git changes
    window.electron?.ipcRenderer
      ?.invoke('git-diff:start-watching', workingDirectory)
      .catch((err) => {
        logger.error('Failed to start git watching:', err);
      });

    // Listen for change events from main process
    const handleChanges = (_event: unknown, ...args: unknown[]) => {
      const data = args[0] as { repoPath: string };

      if (data.repoPath === workingDirectory) {
        // Refresh git stats when changes are detected
        void fetchGitStats();
      }
    };

    window.electron?.ipcRenderer?.on('git-diff:changes-detected', handleChanges);

    // Log listener state AFTER adding
    const listenerCountAfter = ipcRenderer?.listenerCount?.('git-diff:changes-detected') ?? 0;
    console.log('📊 [GitDiffStats] AFTER ADD:', {
      event: 'git-diff:changes-detected',
      count: listenerCountAfter,
      added: listenerCountAfter - listenerCountBefore,
    });

    // Cleanup on unmount or when directory changes
    return () => {
      // Log listener state BEFORE cleanup
      const listenerCountBeforeCleanup =
        ipcRenderer?.listenerCount?.('git-diff:changes-detected') ?? 0;
      console.log('📊 [GitDiffStats] BEFORE CLEANUP:', {
        event: 'git-diff:changes-detected',
        count: listenerCountBeforeCleanup,
      });

      window.electron?.ipcRenderer?.removeListener('git-diff:changes-detected', handleChanges);

      // Log listener state AFTER cleanup
      const listenerCountAfterCleanup =
        ipcRenderer?.listenerCount?.('git-diff:changes-detected') ?? 0;
      console.log('📊 [GitDiffStats] AFTER CLEANUP:', {
        event: 'git-diff:changes-detected',
        count: listenerCountAfterCleanup,
        removed: listenerCountBeforeCleanup - listenerCountAfterCleanup,
      });
      window.electron?.ipcRenderer?.invoke('git-diff:stop-watching', workingDirectory).catch(() => {
        // Ignore errors on cleanup
      });
    };
    // fetchGitStats is intentionally omitted from deps to prevent listener leaks
    // It only changes when workingDirectory changes, which already triggers this effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workingDirectory]);

  const fetchFileDiff = useCallback(
    async (file: string) => {
      setLoadingDiff(true);

      try {
        // Use mock data for UX development
        if (USE_MOCK_DATA) {
          // Simulate network delay
          await new Promise((resolve) => setTimeout(resolve, 200));
          const mockDiff = mockFileDiffs.get(file);
          setFileDiff(mockDiff ? [mockDiff] : []);
          return;
        }

        if (!workingDirectory) return;

        const result = (await window.electron?.ipcRenderer?.invoke?.('git-diff:get-uncommitted', {
          repoPath: workingDirectory,
          filePath: file,
        })) as FileDiff[] | undefined;

        setFileDiff(result || []);
      } catch (err) {
        logger.error('Error fetching file diff:', err);
        setFileDiff([]);
      } finally {
        setLoadingDiff(false);
      }
    },
    [workingDirectory]
  );

  const handleFileClick = async (file: string) => {
    setSelectedFile(file);
    await fetchFileDiff(file);
  };

  const handleCloseDiff = () => {
    setSelectedFile(null);
    setFileDiff([]);
  };

  const isFileRenamed = (stat: GitDiffStat): boolean => {
    if (USE_MOCK_DATA) {
      const mockDiff = mockFileDiffs.get(stat.file);
      return mockDiff?.isRenamed ?? false;
    }
    return stat.isRenamed ?? false;
  };

  const getRenamedFileDisplay = (stat: GitDiffStat): { from: string; to: string } | null => {
    if (USE_MOCK_DATA) {
      const mockDiff = mockFileDiffs.get(stat.file);
      if (mockDiff?.isRenamed) {
        return { from: mockDiff.from, to: mockDiff.to };
      }
    }
    if (stat.isRenamed && stat.oldPath) {
      return { from: stat.oldPath, to: stat.file };
    }
    return null;
  };

  if (!workingDirectory && !USE_MOCK_DATA) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <FileText className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm text-center">No worktree selected</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <p className="text-sm text-center text-destructive mb-2">{error}</p>
      </div>
    );
  }

  if (stats.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <FileText className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm text-center">No changes in git</p>
      </div>
    );
  }

  const addedCount = stats.filter((s) => s.status === 'untracked').length;
  const modifiedCount = stats.filter(
    (s) => s.status !== 'untracked' && !(s.deletions > 0 && s.additions === 0)
  ).length;
  const deletedCount = stats.filter((s) => s.deletions > 0 && s.additions === 0).length;

  const getSummary = () => {
    const parts = [];
    if (addedCount > 0) parts.push(`${addedCount} added`);
    if (modifiedCount > 0) parts.push(`${modifiedCount} updated`);
    if (deletedCount > 0) parts.push(`${deletedCount} deleted`);
    return parts.join(', ');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2">
        <h3 className="text-sm">{getSummary() || ''}</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {stats.map((stat, index) => (
            <div
              key={`${stat.file}-${index}`}
              className={`flex items-center justify-between px-2 py-1 text-sm hover:bg-muted rounded-sm group ${stat.binary || isFileRenamed(stat) ? 'cursor-default' : 'cursor-pointer'}`}
              onClick={() => !stat.binary && !isFileRenamed(stat) && handleFileClick(stat.file)}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {stat.binary ? (
                  <Binary className="h-3 w-3 flex-shrink-0 text-foreground" />
                ) : stat.status === 'untracked' ? (
                  <FilePlus className="h-3 w-3 flex-shrink-0 text-success" />
                ) : stat.deletions > 0 && stat.additions === 0 ? (
                  <FileX className="h-3 w-3 flex-shrink-0 text-danger" />
                ) : stat.status === 'both' ? (
                  <GitBranch className="h-3 w-3 flex-shrink-0 text-danger" />
                ) : isFileRenamed(stat) ? (
                  <ArrowRight className="h-3 w-3 flex-shrink-0 text-blue dark:text-blue-400" />
                ) : (
                  <FilePenLine className="h-3 w-3 flex-shrink-0 text-warning" />
                )}
                <span className="truncate text-foreground text-sm" title={stat.file}>
                  {(() => {
                    const renamed = getRenamedFileDisplay(stat);
                    return renamed ? `${renamed.from} → ${renamed.to}` : stat.file;
                  })()}
                </span>
                {stat.binary && <span className="text-foreground text-sm font-medium">binary</span>}
                {stat.status === 'staged' && (
                  <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">
                    staged
                  </span>
                )}
                {stat.status === 'both' && (
                  <span className="text-danger text-sm font-medium">conflict</span>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {!stat.binary && (
                  <>
                    {stat.additions > 0 && (
                      <span className="text-success font-mono text-sm">+{stat.additions}</span>
                    )}
                    {stat.deletions > 0 && (
                      <span className="text-danger font-mono text-sm">-{stat.deletions}</span>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Diff Viewer Sheet */}
      <Sheet
        open={selectedFile !== null}
        onOpenChange={(open) => {
          if (!open) handleCloseDiff();
        }}
      >
        <SheetContent
          side="right"
          className="w-[900px] sm:max-w-[900px] bg-background p-0 border-0"
        >
          <SheetHeader className="px-6 py-4">
            <SheetTitle className="flex items-center gap-3 text-sm text-foreground">
              {fileDiff[0]?.isNew && <FilePlus className="h-4 w-4 text-success" />}
              {fileDiff[0]?.isDeleted && <FileX className="h-4 w-4 text-danger" />}
              {fileDiff[0]?.isRenamed && (
                <ArrowRight className="h-4 w-4 text-blue dark:text-blue-400" />
              )}
              {fileDiff[0]?.hasConflicts && <GitBranch className="h-4 w-4 text-danger" />}
              {!fileDiff[0]?.isNew &&
                !fileDiff[0]?.isDeleted &&
                !fileDiff[0]?.isRenamed &&
                !fileDiff[0]?.hasConflicts && <FilePenLine className="h-4 w-4 text-warning" />}
              <span>
                {fileDiff[0]?.isRenamed ? `${fileDiff[0].from} → ${fileDiff[0].to}` : selectedFile}
              </span>
              {fileDiff[0]?.hasConflicts && (
                <span className="text-danger text-sm font-medium">conflict</span>
              )}
              {stats.find((s) => s.file === selectedFile)?.status === 'staged' && (
                <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">staged</span>
              )}
              {fileDiff[0] && (
                <span className="text-sm ml-5">
                  <span className="text-green-600 dark:text-green-400">
                    +{fileDiff[0].additions}
                  </span>
                  <span className="ml-1 text-red-600 dark:text-red-400">
                    -{fileDiff[0].deletions}
                  </span>
                </span>
              )}
            </SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100vh-80px)] overflow-auto bg-background">
            {loadingDiff ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <GitDiffViewer
                files={fileDiff}
                repoPath={workingDirectory}
                onRefresh={async () => {
                  await fetchGitStats();
                  if (selectedFile) {
                    await fetchFileDiff(selectedFile);
                  }
                }}
                onClose={handleCloseDiff}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
