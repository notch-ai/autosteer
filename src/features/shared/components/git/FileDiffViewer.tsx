import { ScrollArea } from '@/components/ui/scroll-area';
import { FileDiff } from '@/types/git-diff.types';
import React from 'react';
import { GitDiffViewer } from '@/features/shared/components/git/GitDiffViewer';

interface FileDiffViewerProps {
  files: FileDiff[];
  selectedFile: string | null;
  workingDirectory: string | undefined;
  onRefresh?: () => void | Promise<void>;
}

export const FileDiffViewer: React.FC<FileDiffViewerProps> = ({
  files,
  selectedFile,
  workingDirectory,
  onRefresh,
}) => {
  if (!selectedFile) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">Select a file to view diff</p>
      </div>
    );
  }

  // Defensive check: ensure files is an array
  if (!Array.isArray(files) || files.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm"></p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col border-l border-border">
      <ScrollArea className="flex-1 overflow-hidden">
        <GitDiffViewer
          files={files}
          repoPath={workingDirectory}
          hideFileHeader={false}
          onRefresh={onRefresh}
        />
      </ScrollArea>
    </div>
  );
};
