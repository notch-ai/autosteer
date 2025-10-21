import { logger } from '@/commons/utils/logger';
import { toastError, toastSuccess } from '@/components/ui/sonner';
import { mockFileDiffs, mockGitStats } from '@/mocks/gitDiffMockData';
import { GitDiscardService } from '@/services/GitDiscardService';
import { useCoreStore, useUIStore } from '@/stores';
import { FileDiff } from '@/types/git-diff.types';
import { FileText, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { FileChangesList } from './FileChangesList';
import { FileDiffViewer } from './FileDiffViewer';

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

interface ChangesTabProps {
  className?: string;
}

export const ChangesTab: React.FC<ChangesTabProps> = ({ className }) => {
  const [stats, setStats] = useState<GitDiffStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState<FileDiff[]>([]);
  const [loadingDiff, setLoadingDiff] = useState(false);

  const selectedProjectId = useCoreStore((state) => state.selectedProjectId);
  const projects = useCoreStore((state) => state.projects);
  const selectedFile = useUIStore((state) => state.changesTab.selectedFile);
  const setSelectedFile = useUIStore((state) => state.setSelectedFile);
  const panelSizes = useUIStore((state) => state.changesTab.panelSizes);
  const setChangesPanelSizes = useUIStore((state) => state.setChangesPanelSizes);

  const currentProject = selectedProjectId ? projects.get(selectedProjectId) : null;
  const workingDirectory = currentProject?.localPath;

  const fetchGitStats = useCallback(async () => {
    if (USE_MOCK_DATA) {
      // Use mock data for UX development
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

    // Cleanup on unmount or when directory changes
    return () => {
      window.electron?.ipcRenderer?.removeListener('git-diff:changes-detected', handleChanges);
      window.electron?.ipcRenderer?.invoke('git-diff:stop-watching', workingDirectory).catch(() => {
        // Ignore errors on cleanup
      });
    };
  }, [workingDirectory, fetchGitStats]);

  const fetchFileDiff = useCallback(
    async (file: string) => {
      setLoadingDiff(true);

      try {
        if (USE_MOCK_DATA) {
          // Use mock data for UX development
          await new Promise((resolve) => setTimeout(resolve, 200));

          const mockDiff = mockFileDiffs.get(file);
          setFileDiff(mockDiff ? [mockDiff] : []);
          setLoadingDiff(false);
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

  const handleFileSelect = async (file: string) => {
    setSelectedFile(file);
    await fetchFileDiff(file);
  };

  // Auto-select first file when stats are loaded and no file is selected
  // OR when the selected file is no longer in the stats list
  useEffect(() => {
    if (stats.length > 0) {
      const selectedFileExists = selectedFile && stats.some((s) => s.file === selectedFile);

      if (!selectedFile || !selectedFileExists) {
        const firstFile = stats[0].file;
        setSelectedFile(firstFile);
        void fetchFileDiff(firstFile);
      }
    }
  }, [stats, selectedFile, setSelectedFile, fetchFileDiff]);

  // Keyboard navigation (up/down arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (stats.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const currentIndex = selectedFile ? stats.findIndex((s) => s.file === selectedFile) : -1;
        const nextIndex = currentIndex < stats.length - 1 ? currentIndex + 1 : 0;
        void handleFileSelect(stats[nextIndex].file);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIndex = selectedFile ? stats.findIndex((s) => s.file === selectedFile) : -1;
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : stats.length - 1;
        void handleFileSelect(stats[prevIndex].file);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [stats, selectedFile, handleFileSelect]);

  const handlePanelResize = (newSizes: { fileList: number; diffViewer: number }) => {
    setChangesPanelSizes(newSizes);
  };

  const handleDiscardFile = async (filePath: string) => {
    if (!workingDirectory) {
      toastError('No working directory selected');
      return;
    }

    try {
      await GitDiscardService.discardFile(workingDirectory, filePath);
      toastSuccess(`Discarded changes in ${filePath}`);

      // Clear selection if the discarded file was selected
      if (selectedFile === filePath) {
        setSelectedFile(null);
        setFileDiff([]);
      }

      // Refresh git stats to update the file list
      await fetchGitStats();
    } catch (error) {
      logger.error('Error discarding file:', error);
      toastError(
        `Failed to discard changes: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
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

  return (
    <div className={`flex h-full ${className || ''}`}>
      {/* Left Panel - File List */}
      <div className="flex-shrink-0" style={{ width: `${panelSizes.fileList}%` }}>
        <FileChangesList
          files={stats}
          selectedFile={selectedFile}
          onSelect={handleFileSelect}
          onDiscardFile={handleDiscardFile}
        />
      </div>

      {/* Resize Handle */}
      <div
        className="w-1 cursor-col-resize hover:bg-primary/20 transition-colors flex-shrink-0"
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startFileListSize = panelSizes.fileList;

          const container = e.currentTarget.parentElement;
          if (!container) return;

          const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaPercent = (deltaX / container.offsetWidth) * 100;
            const newFileListSize = Math.max(20, Math.min(80, startFileListSize + deltaPercent));
            const newDiffViewerSize = 100 - newFileListSize;

            handlePanelResize({ fileList: newFileListSize, diffViewer: newDiffViewerSize });
          };

          const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
          };

          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
          document.body.style.cursor = 'col-resize';
        }}
      />

      {/* Right Panel - Diff Viewer */}
      <div className="flex-1 overflow-hidden">
        {loadingDiff ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : selectedFile ? (
          <FileDiffViewer
            files={fileDiff}
            selectedFile={selectedFile}
            workingDirectory={workingDirectory}
            onRefresh={async () => {
              await fetchGitStats();
              if (selectedFile) {
                await fetchFileDiff(selectedFile);
              }
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">Select a file to view diff</p>
          </div>
        )}
      </div>
    </div>
  );
};
