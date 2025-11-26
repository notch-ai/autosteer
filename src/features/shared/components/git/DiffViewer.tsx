import React from 'react';
import { cn } from '@/commons/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDiffViewerHandler } from '@/hooks/useDiffViewerHandler';
import { type StructuredPatch } from '@/stores/git.store';

interface DiffViewerProps {
  filePath: string;
  oldContent?: string;
  newContent?: string;
  structuredPatch?: StructuredPatch[];
  type: 'create' | 'edit';
  className?: string;
  commitHash?: string;
  useFetchedDiff?: boolean;
}

/**
 *
 * Pure presentation component for diff visualization.
 * Business logic handled by useDiffViewerHandler hook.
 *
 * Modes:
 * - useFetchedDiff=true: Fetches diff from Git service (uses handler)
 * - useFetchedDiff=false: Uses provided props (backwards compatible)
 *
 * @see useDiffViewerHandler for business logic
 */
export const DiffViewer: React.FC<DiffViewerProps> = ({
  filePath,
  oldContent,
  newContent,
  structuredPatch: propStructuredPatch,
  type,
  className,
  commitHash,
  useFetchedDiff = false,
}) => {
  // Handler integration (only used when useFetchedDiff=true)
  const { diff } = useDiffViewerHandler({
    filePath: useFetchedDiff ? filePath : '',
    ...(commitHash && { commitHash }),
    autoFetch: useFetchedDiff,
  });

  // Use fetched diff if available, otherwise use props
  const structuredPatch = useFetchedDiff ? diff?.structuredPatch : propStructuredPatch;
  const renderDiff = () => {
    if (type === 'create' && newContent) {
      const lines = newContent.split('\n');
      return (
        <div data-testid="diff-content" className="font-mono text-sm">
          {lines.map((line, index) => (
            <div
              key={index}
              data-testid="diff-line"
              className={cn('flex bg-green-50 dark:bg-green-900/20 border-l-4 border-success')}
            >
              <span
                data-testid="diff-line-number"
                className={cn('flex select-none text-muted-foreground bg-card')}
              >
                <span className="w-10 px-2 text-right"></span>
                <span className={cn('w-10 px-2 text-right border-r border-border')}>
                  {index + 1}
                </span>
              </span>
              <span className={cn('px-2 text-success select-none')}>+</span>
              <span className={cn('text-success bg-green-50 dark:bg-green-900/20')}>{line}</span>
            </div>
          ))}
        </div>
      );
    }

    // Handle edit type with old and new content (no structuredPatch)
    if (
      type === 'edit' &&
      oldContent !== undefined &&
      newContent !== undefined &&
      !structuredPatch
    ) {
      const oldLines = oldContent.split('\n');
      const newLines = newContent.split('\n');

      // Simple diff display: show old content as removed and new content as added
      return (
        <div data-testid="diff-content" className="font-mono text-sm">
          {/* Show removed lines */}
          {oldLines.length > 0 && oldContent && (
            <>
              {oldLines.map((line, index) => (
                <div
                  key={`old-${index}`}
                  data-testid="diff-line"
                  className={cn('flex bg-red-50 dark:bg-red-900/20 border-l-4 border-error')}
                >
                  <span
                    data-testid="diff-line-number"
                    className={cn('flex select-none text-muted-foreground bg-card')}
                  >
                    <span className="w-10 px-2 text-right">{index + 1}</span>
                    <span className={cn('w-10 px-2 text-right border-r border-border')}></span>
                  </span>
                  <span className={cn('px-2 text-error select-none')}>-</span>
                  <span className={cn('text-error bg-red-50 dark:bg-red-900/20')}>{line}</span>
                </div>
              ))}
            </>
          )}
          {/* Show added lines */}
          {newLines.length > 0 && newContent && (
            <>
              {newLines.map((line, index) => (
                <div
                  key={`new-${index}`}
                  data-testid="diff-line"
                  className={cn('flex bg-green-50 dark:bg-green-900/20 border-l-4 border-success')}
                >
                  <span
                    data-testid="diff-line-number"
                    className={cn('flex select-none text-muted-foreground bg-card')}
                  >
                    <span className="w-10 px-2 text-right"></span>
                    <span className={cn('w-10 px-2 text-right border-r border-border')}>
                      {index + 1}
                    </span>
                  </span>
                  <span className={cn('px-2 text-success select-none')}>+</span>
                  <span className={cn('text-success bg-green-50 dark:bg-green-900/20')}>
                    {line}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      );
    }

    if (structuredPatch) {
      return (
        <div data-testid="diff-content" className="font-mono text-sm">
          {structuredPatch.map((hunk, hunkIndex) => {
            let oldLineNum = hunk.oldStart;
            let newLineNum = hunk.newStart;

            return (
              <div key={hunkIndex}>
                <div className={cn('px-4 py-1 text-info bg-card-hover')}>
                  @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                </div>
                {hunk.lines.map((line, lineIndex) => {
                  const operation = line[0];
                  const content = line.substring(1);

                  let lineClass = '';
                  let bgClass = '';
                  let textClass = '';

                  if (operation === '+') {
                    lineClass = 'border-l-4 border-success';
                    bgClass = 'bg-green-50 dark:bg-green-900/20';
                    textClass = 'text-success';
                  } else if (operation === '-') {
                    lineClass = 'border-l-4 border-error';
                    bgClass = 'bg-red-50 dark:bg-red-900/20';
                    textClass = 'text-error';
                  } else {
                    lineClass = '';
                    bgClass = 'bg-background';
                    textClass = 'text-muted-foreground';
                  }

                  const displayOldLine = operation !== '+' ? oldLineNum++ : '';
                  const displayNewLine = operation !== '-' ? newLineNum++ : '';

                  return (
                    <div
                      key={`${hunkIndex}-${lineIndex}`}
                      data-testid="diff-line"
                      className={cn('flex', bgClass, lineClass)}
                    >
                      <span
                        data-testid="diff-line-number"
                        className={cn('flex select-none text-muted-foreground bg-card')}
                      >
                        <span className="w-10 px-2 text-right">{displayOldLine}</span>
                        <span className={cn('w-10 px-2 text-right border-r border-border')}>
                          {displayNewLine}
                        </span>
                      </span>
                      <span className={cn('px-2 select-none', textClass)}>{operation}</span>
                      <span className={cn('text-foreground')}>{content}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      );
    }

    return null;
  };

  return (
    <div className={cn('rounded-md border border-border overflow-hidden', className)}>
      <div className={cn('px-4 py-2 bg-card border-b border-border font-mono text-sm')}>
        {filePath}
      </div>
      <ScrollArea className="max-h-[600px]">{renderDiff()}</ScrollArea>
    </div>
  );
};
