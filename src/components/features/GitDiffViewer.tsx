import { cn } from '@/commons/utils/cn';
import { toastError, toastInfo } from '@/components/ui/sonner';
import { GitDiscardService } from '@/services/GitDiscardService';
import { Square, Trash2 } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { Button } from './Button';
import { showUndoToast } from './UndoToast';

interface DiffChange {
  type: 'add' | 'del' | 'normal';
  lineNumber?: number;
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
  isConflict?: boolean;
}

interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  changes: DiffChange[];
  hasConflicts: boolean;
}

interface FileDiff {
  from: string;
  to: string;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
  isNew: boolean;
  isDeleted: boolean;
  isRenamed: boolean;
  hasConflicts: boolean;
}

interface GitDiffViewerProps {
  files: FileDiff[];
  className?: string;
  hideFileHeader?: boolean;
  repoPath?: string | undefined;
  onRefresh?: (() => void | Promise<void>) | undefined;
  onClose?: (() => void) | undefined;
  hideCheckboxes?: boolean;
}

export const GitDiffViewer: React.FC<GitDiffViewerProps> = ({
  files,
  className,
  hideFileHeader = false,
  repoPath,
  onRefresh,
  onClose,
}) => {
  if (!files || files.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-muted-foreground text-sm">No changes to display</div>
      </div>
    );
  }

  return (
    <div className={cn('p-0', className)}>
      {files.map((file, fileIndex) => (
        <FileDiff
          key={fileIndex}
          file={file}
          hideHeader={hideFileHeader}
          repoPath={repoPath}
          onRefresh={onRefresh}
          onClose={onClose}
        />
      ))}
    </div>
  );
};

interface FileDiffProps {
  file: FileDiff;
  hideHeader?: boolean;
  repoPath?: string | undefined;
  onRefresh?: (() => void | Promise<void>) | undefined;
  onClose?: (() => void) | undefined;
}

const FileDiff: React.FC<FileDiffProps> = ({ file, hideHeader = false, repoPath, onRefresh }) => {
  const [selectedLines, setSelectedLines] = useState<Map<string, Set<string>>>(new Map());

  // Use the correct file path: avoid "/dev/null" for both new and deleted files
  // For new files: file.from === "/dev/null", use file.to
  // For deleted files: file.to === "/dev/null", use file.from
  const filePath =
    file.from === '/dev/null'
      ? file.to
      : file.to === '/dev/null' || file.isDeleted
        ? file.from
        : file.to || file.from;

  // Validate filePath - must be non-empty and not /dev/null
  const isValidFilePath = Boolean(filePath && filePath.trim() !== '' && filePath !== '/dev/null');

  // For new/untracked files, we can only discard the entire file (delete it)
  // We cannot discard individual lines or hunks because git apply doesn't work on untracked files
  const canDiscardLinesOrHunks = isValidFilePath && !file.isNew;

  // Debug logging for invalid filePath
  if (!isValidFilePath) {
    console.error('[GitDiffViewer] Invalid filePath detected:', {
      'file.from': file.from,
      'file.to': file.to,
      'file.isDeleted': file.isDeleted,
      'file.isNew': file.isNew,
      'computed filePath': filePath,
      isValidFilePath: isValidFilePath,
    });
  }

  const fileKey = filePath;
  const fileSelectedLines = selectedLines.get(fileKey) || new Set();
  const hasSelectedLines = fileSelectedLines.size > 0;

  const handleDiscardSelectedLines = useCallback(async () => {
    if (!repoPath || !hasSelectedLines) {
      console.log('[GitDiffViewer] Discard lines early return:', { repoPath, hasSelectedLines });
      return;
    }

    if (!filePath || filePath.trim() === '') {
      toastError('Invalid file path');
      return;
    }

    const linesToDiscard = Array.from(fileSelectedLines).map((lineKey) => {
      const [lineNumber, type] = lineKey.split('-');
      return {
        lineNumber: parseInt(lineNumber, 10),
        type: type as 'add' | 'del',
      };
    });

    console.log('[GitDiffViewer] Discarding lines:', {
      repoPath,
      filePath,
      linesToDiscard,
      lineCount: linesToDiscard.length,
    });

    try {
      await GitDiscardService.discardLines(repoPath, filePath, linesToDiscard);
      console.log('[GitDiffViewer] Discard lines SUCCESS');
      showUndoToast({
        message: `Discarded ${linesToDiscard.length} line(s) in ${filePath}`,
        onUndo: async () => {
          toastInfo('Manual recovery via git reflog', {
            description: `Run: git reflog\nFind commit before discard, then: git checkout <commit-hash> -- ${filePath}`,
            duration: 10000,
          });
        },
      });
      setSelectedLines(new Map());
      await onRefresh?.();
    } catch (error) {
      console.error('[GitDiffViewer] Discard lines ERROR:', error);
      toastError(
        `Failed to discard lines: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }, [repoPath, filePath, hasSelectedLines, fileSelectedLines, onRefresh]);

  return (
    <div className={cn('overflow-hidden', !hideHeader && 'mb-6')}>
      {/* File header - GitHub style */}
      {!hideHeader && (
        <div className="bg-muted px-4 py-0">
          <div className="flex items-center gap-3 min-h-8">
            <div className="ml-auto flex items-center gap-2">
              {repoPath && isValidFilePath && canDiscardLinesOrHunks && hasSelectedLines && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDiscardSelectedLines}
                  className="h-7 px-2 text-sm"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Lines ({fileSelectedLines.size})
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hunks */}
      {file.hunks.map((hunk, hunkIndex) => (
        <Hunk
          key={hunkIndex}
          hunk={hunk}
          filePath={filePath}
          repoPath={repoPath}
          onRefresh={onRefresh}
          selectedLines={selectedLines}
          setSelectedLines={setSelectedLines}
          fileKey={fileKey}
          canDiscardLinesOrHunks={canDiscardLinesOrHunks}
        />
      ))}
    </div>
  );
};

interface HunkProps {
  hunk: DiffHunk;
  filePath: string;
  repoPath?: string | undefined;
  onRefresh?: (() => void | Promise<void>) | undefined;
  selectedLines: Map<string, Set<string>>;
  setSelectedLines: React.Dispatch<React.SetStateAction<Map<string, Set<string>>>>;
  fileKey: string;
  canDiscardLinesOrHunks: boolean;
}

const Hunk: React.FC<HunkProps> = ({
  hunk,
  filePath,
  repoPath,
  onRefresh,
  selectedLines,
  setSelectedLines,
  fileKey,
  canDiscardLinesOrHunks,
}) => {
  // Filter out git metadata lines like "\ No newline at end of file"
  const filteredChanges = hunk.changes.filter(
    (change) => !change.content.startsWith('\\ No newline at end of file')
  );

  const handleDiscardHunk = useCallback(async () => {
    if (!repoPath) {
      toastError('Repository path not available');
      return;
    }

    if (!filePath || filePath.trim() === '') {
      toastError('Invalid file path');
      return;
    }

    console.log('[GitDiffViewer] Discarding hunk:', {
      repoPath,
      filePath,
      hunk: {
        oldStart: hunk.oldStart,
        oldLines: hunk.oldLines,
        newStart: hunk.newStart,
        newLines: hunk.newLines,
        changesCount: hunk.changes.length,
      },
    });

    try {
      await GitDiscardService.discardHunk(repoPath, filePath, hunk);
      console.log('[GitDiffViewer] Discard hunk SUCCESS');
      showUndoToast({
        message: `Discarded hunk in ${filePath}`,
        onUndo: async () => {
          toastInfo('Manual recovery via git reflog', {
            description: `Run: git reflog\nFind commit before discard, then: git checkout <commit-hash> -- ${filePath}`,
            duration: 10000,
          });
        },
      });
      await onRefresh?.();
    } catch (error) {
      console.error('[GitDiffViewer] Discard hunk ERROR:', error);
      toastError(
        `Failed to discard hunk: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }, [repoPath, filePath, hunk, onRefresh]);

  const hasDiscardableLines = filteredChanges.some((c) => c.type === 'add' || c.type === 'del');

  return (
    <div>
      {/* Hunk header with discard button */}
      {repoPath && canDiscardLinesOrHunks && hasDiscardableLines && (
        <div className="bg-muted/50 px-2 py-1 flex items-center justify-between">
          <span className="text-sm text-muted-foreground font-mono">
            @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDiscardHunk}
            className="h-6 px-2 text-sm"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Hunk
          </Button>
        </div>
      )}

      {/* Changes */}
      <div>
        {filteredChanges.map((change, changeIndex) => (
          <DiffLine
            key={changeIndex}
            change={change}
            repoPath={repoPath}
            selectedLines={selectedLines}
            setSelectedLines={setSelectedLines}
            fileKey={fileKey}
            canDiscardLinesOrHunks={canDiscardLinesOrHunks}
          />
        ))}
      </div>
    </div>
  );
};

interface DiffLineProps {
  change: DiffChange;
  repoPath?: string | undefined;
  selectedLines: Map<string, Set<string>>;
  setSelectedLines: React.Dispatch<React.SetStateAction<Map<string, Set<string>>>>;
  fileKey: string;
  canDiscardLinesOrHunks: boolean;
}

const DiffLine: React.FC<DiffLineProps> = ({
  change,
  repoPath,
  selectedLines,
  setSelectedLines,
  fileKey,
  canDiscardLinesOrHunks,
}) => {
  const isConflictMarker =
    change.content.startsWith('<<<<<<<') ||
    change.content.startsWith('=======') ||
    change.content.startsWith('>>>>>>>');

  const getStyles = () => {
    // Conflict markers - yellow background for all markers
    if (isConflictMarker) {
      return {
        line: 'bg-yellow-100 dark:bg-yellow-700',
        lineNumber: 'bg-yellow-100 dark:bg-yellow-700',
      };
    }

    // GitHub-style colors (applies to both normal diffs and conflict content)
    switch (change.type) {
      case 'add':
        return {
          line: 'bg-green-50 dark:bg-green-950',
          lineNumber: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
        };
      case 'del':
        return {
          line: 'bg-red-50 dark:bg-red-950',
          lineNumber: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
        };
      case 'normal':
        return {
          line: 'bg-background',
          lineNumber: 'bg-muted text-muted-foreground',
        };
      default:
        return {
          line: '',
          lineNumber: '',
        };
    }
  };

  const getPrefix = () => {
    if (isConflictMarker) return '';
    switch (change.type) {
      case 'add':
        return '+';
      case 'del':
        return '-';
      case 'normal':
        return ' ';
      default:
        return ' ';
    }
  };

  const getPrefixColor = () => {
    switch (change.type) {
      case 'add':
        return 'text-green-600 dark:text-green-400';
      case 'del':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-muted-foreground';
    }
  };

  const getLineNumbers = () => {
    if (isConflictMarker) return { old: '', new: '' };

    // Always return both old and new line numbers
    // For additions, old is empty; for deletions, new is empty
    return {
      old: change.oldLineNumber !== undefined ? change.oldLineNumber.toString() : '',
      new: change.newLineNumber !== undefined ? change.newLineNumber.toString() : '',
    };
  };

  const lineNumbers = getLineNumbers();
  const styles = getStyles();

  const isDiscardable = change.type === 'add' || change.type === 'del';
  // Use newLineNumber for additions, oldLineNumber for deletions, or lineNumber as fallback
  const effectiveLineNumber = change.lineNumber ?? change.newLineNumber ?? change.oldLineNumber;
  const lineKey = `${effectiveLineNumber}-${change.type}`;
  const fileSelectedLines = selectedLines.get(fileKey) || new Set();
  const isSelected = fileSelectedLines.has(lineKey);

  const handleToggleSelection = useCallback(() => {
    if (!effectiveLineNumber) return;

    setSelectedLines((prev) => {
      const newMap = new Map(prev);
      const fileLines = new Set(newMap.get(fileKey) || []);

      if (isSelected) {
        fileLines.delete(lineKey);
      } else {
        fileLines.add(lineKey);
      }

      if (fileLines.size === 0) {
        newMap.delete(fileKey);
      } else {
        newMap.set(fileKey, fileLines);
      }

      return newMap;
    });
  }, [effectiveLineNumber, fileKey, lineKey, isSelected, setSelectedLines]);

  return (
    <div className={cn('flex items-start font-mono text-sm leading-5', styles.line)}>
      {/* Selection icon + line numbers - clickable area */}
      <div
        className={cn(
          'flex items-center shrink-0',
          isConflictMarker ? styles.lineNumber : 'bg-muted',
          repoPath && isDiscardable && canDiscardLinesOrHunks && 'cursor-pointer hover:bg-muted/50'
        )}
        onClick={
          repoPath && isDiscardable && canDiscardLinesOrHunks ? handleToggleSelection : undefined
        }
      >
        {/* Selection icon for discardable lines */}
        <div className="px-2 py-0 flex items-center cursor-pointer w-7">
          {repoPath && isDiscardable && canDiscardLinesOrHunks && (
            <Square
              className={cn(
                'w-3.5 h-3.5',
                isSelected ? 'text-blue dark:text-blue fill-current' : 'text-muted-foreground/50'
              )}
            />
          )}
        </div>

        {/* Old line number column (left) - fixed width for up to 5 digits */}
        <span
          className={cn(
            'px-2 py-0 w-16 text-right',
            styles.lineNumber,
            repoPath && isDiscardable && 'pl-0'
          )}
        >
          {lineNumbers.old}
        </span>

        {/* New line number column (right) - fixed width for up to 5 digits */}
        <span className={cn('px-2 py-0 w-16 text-right', styles.lineNumber)}>
          {lineNumbers.new}
        </span>
      </div>

      {/* Divider - on the left of prefix */}
      <span className="w-px bg-border shrink-0" />

      {/* Prefix (+/-/ ) */}
      <span className={cn('py-0 w-5 select-none', getPrefixColor())}>{getPrefix()}</span>

      {/* Content */}
      <span className="flex-1 py-0 pl-1 pr-3 whitespace-pre-wrap break-all text-foreground select-text cursor-text">
        {change.content}
      </span>
    </div>
  );
};

// Helper component to show conflict explanation
export const ConflictExplainer: React.FC = () => {
  return (
    <div className="bg-surface p-4 border border-border rounded mb-4 text-sm">
      <h3 className="font-semibold text-text mb-2">Understanding Merge Conflicts</h3>
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <span className="bg-purple text-white px-2 py-0.5 rounded font-mono text-sm min-w-[80px]">
            {'<<<<<<<'}
          </span>
          <span className="text-text-muted">Start of YOUR changes (current branch)</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="bg-yellow text-black px-2 py-0.5 rounded font-mono text-sm min-w-[80px]">
            =======
          </span>
          <span className="text-text-muted">Divider between changes</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="bg-blue text-white px-2 py-0.5 rounded font-mono text-sm min-w-[80px]">
            {'>>>>>>>'}
          </span>
          <span className="text-text-muted">End with THEIR changes (incoming branch)</span>
        </div>
      </div>
      <p className="mt-3 text-text-muted text-sm">
        To resolve: Choose one version, combine both, or write new code. Then remove the conflict
        markers.
      </p>
    </div>
  );
};
