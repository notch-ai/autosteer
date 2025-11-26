import { logger } from '@/commons/utils/logger';
import { toastError, toastSuccess } from '@/components/ui/sonner';
import { FileChangesList } from '@/features/shared/components/git/FileChangesList';
import { FileDiffViewer } from '@/features/shared/components/git/FileDiffViewer';
import { useChangesTabScrollPreservation, useFileDiff, useGitStats, useGitWatcher } from '@/hooks';
import { GitDiscardService } from '@/services/GitDiscardService';
import { useProjectsStore, useUIStore } from '@/stores';
import { FileText, Loader2 } from 'lucide-react';
import React, { useEffect } from 'react';

// Toggle this to use mock data for UX development
const USE_MOCK_DATA = false;

interface ChangesTabProps {
  className?: string;
}

export const ChangesTab: React.FC<ChangesTabProps> = ({ className }) => {
  // Get selectedProjectId separately - this is stable and won't cause re-renders
  const selectedProjectId = useProjectsStore((state) => state.selectedProjectId);

  // Scroll preservation for file list and diff viewer
  const { fileListRef, diffViewerRef, saveScrollPositions, restoreScrollPositions } =
    useChangesTabScrollPreservation(selectedProjectId || '');

  // CRITICAL FIX: Use useMemo to derive workingDirectory only when selectedProjectId changes
  // This prevents re-renders when the projects Map reference changes
  const workingDirectory = React.useMemo(() => {
    // Access store only when needed, not on every render
    const state = useProjectsStore.getState();
    const project = selectedProjectId ? state.projects.get(selectedProjectId) : null;
    return project?.localPath;
  }, [selectedProjectId]);

  const selectedFile = useUIStore((state) => state.changesTab.selectedFile);
  const setSelectedFile = useUIStore((state) => state.setSelectedFile);
  const panelSizes = useUIStore((state) => state.changesTab.panelSizes);
  const setChangesPanelSizes = useUIStore((state) => state.setChangesPanelSizes);

  // Use git hooks for state management
  const {
    stats,
    loading,
    error,
    refetch: refetchGitStats,
  } = useGitStats({
    workingDirectory,
    polling: true,
    pollingInterval: 5000,
    useMockData: USE_MOCK_DATA,
  });

  const { fileDiff, loadingDiff, fetchFileDiff } = useFileDiff({
    workingDirectory,
    useMockData: USE_MOCK_DATA,
  });

  useGitWatcher({
    workingDirectory,
    onChangesDetected: refetchGitStats,
  });

  // Save scroll positions when project changes
  useEffect(() => {
    return () => {
      if (selectedProjectId) {
        saveScrollPositions();
      }
    };
  }, [selectedProjectId, saveScrollPositions]);

  // Restore scroll positions after stats are loaded
  useEffect(() => {
    if (stats.length > 0 && selectedProjectId) {
      // Delay restoration to allow DOM to update
      const timer = setTimeout(() => {
        restoreScrollPositions();
      }, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [stats.length, selectedProjectId, restoreScrollPositions]);

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
      }

      // Refresh git stats to update the file list
      await refetchGitStats();
    } catch (error) {
      logger.error('Error discarding file:', error);
      toastError(
        `Failed to discard changes: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  if (!workingDirectory && !USE_MOCK_DATA) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background text-muted-foreground p-4">
        <FileText className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm text-center">No worktree selected</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background text-muted-foreground p-4">
        <p className="text-sm text-center text-destructive mb-2">{error}</p>
      </div>
    );
  }

  if (stats.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background text-muted-foreground p-4">
        <FileText className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm text-center">No changes in git</p>
      </div>
    );
  }

  return (
    <div className={`flex h-full bg-background ${className || ''}`}>
      {/* Left Panel - File List */}
      <div
        ref={fileListRef}
        className="flex-shrink-0 h-full overflow-auto"
        style={{ width: `${panelSizes.fileList}%` }}
      >
        <FileChangesList
          files={stats}
          selectedFile={selectedFile}
          onSelect={handleFileSelect}
          onDiscardFile={handleDiscardFile}
          {...(workingDirectory ? { workingDirectory } : {})}
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
      <div ref={diffViewerRef} className="flex-1 overflow-auto h-full">
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
              await refetchGitStats();
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
