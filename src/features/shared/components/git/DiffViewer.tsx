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
              className={cn(
                'flex bg-[#0d2818] border-l-4 border-success dark:bg-[#0d2818] dark:border-[#3fb950]'
              )}
            >
              <span
                data-testid="diff-line-number"
                className={cn(
                  'flex select-none text-text-muted bg-surface',
                  'dark:text-[#7d8590] dark:bg-[#0d1117]'
                )}
              >
                <span className="w-10 px-2 text-right"></span>
                <span
                  className={cn(
                    'w-10 px-2 text-right border-r border-border',
                    'dark:border-[#30363d]'
                  )}
                >
                  {index + 1}
                </span>
              </span>
              <span className={cn('px-2 text-success select-none', 'dark:text-[#3fb950]')}>+</span>
              <span
                className={cn(
                  'text-[#3fb950] bg-[#0d2818]',
                  'dark:text-[#3fb950] dark:bg-[#0d2818]'
                )}
              >
                {line}
              </span>
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
                  className={cn(
                    'flex bg-[#2d0a0a] border-l-4 border-[#f85149] dark:bg-[#2d0a0a] dark:border-[#f85149]'
                  )}
                >
                  <span
                    data-testid="diff-line-number"
                    className={cn(
                      'flex select-none text-text-muted bg-surface',
                      'dark:text-[#7d8590] dark:bg-[#0d1117]'
                    )}
                  >
                    <span className="w-10 px-2 text-right">{index + 1}</span>
                    <span
                      className={cn(
                        'w-10 px-2 text-right border-r border-border',
                        'dark:border-[#30363d]'
                      )}
                    ></span>
                  </span>
                  <span className={cn('px-2 text-[#f85149] select-none', 'dark:text-[#f85149]')}>
                    -
                  </span>
                  <span
                    className={cn(
                      'text-[#f85149] bg-[#2d0a0a]',
                      'dark:text-[#f85149] dark:bg-[#2d0a0a]'
                    )}
                  >
                    {line}
                  </span>
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
                  className={cn(
                    'flex bg-[#0d2818] border-l-4 border-[#3fb950] dark:bg-[#0d2818] dark:border-[#3fb950]'
                  )}
                >
                  <span
                    data-testid="diff-line-number"
                    className={cn(
                      'flex select-none text-text-muted bg-surface',
                      'dark:text-[#7d8590] dark:bg-[#0d1117]'
                    )}
                  >
                    <span className="w-10 px-2 text-right"></span>
                    <span
                      className={cn(
                        'w-10 px-2 text-right border-r border-border',
                        'dark:border-[#30363d]'
                      )}
                    >
                      {index + 1}
                    </span>
                  </span>
                  <span className={cn('px-2 text-[#3fb950] select-none', 'dark:text-[#3fb950]')}>
                    +
                  </span>
                  <span
                    className={cn(
                      'text-[#3fb950] bg-[#0d2818]',
                      'dark:text-[#3fb950] dark:bg-[#0d2818]'
                    )}
                  >
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
                <div
                  className={cn(
                    'px-4 py-1 text-info bg-surface-hover',
                    'dark:text-[#58a6ff] dark:bg-[#0d1117]'
                  )}
                >
                  @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                </div>
                {hunk.lines.map((line, lineIndex) => {
                  const operation = line[0];
                  const content = line.substring(1);

                  let lineClass = '';
                  let bgClass = '';
                  let textClass = '';

                  if (operation === '+') {
                    lineClass = 'border-l-4 border-[#3fb950] dark:border-[#3fb950]';
                    bgClass = 'bg-[#0d2818] dark:bg-[#0d2818]';
                    textClass = 'text-[#3fb950] dark:text-[#3fb950]';
                  } else if (operation === '-') {
                    lineClass = 'border-l-4 border-[#f85149] dark:border-[#f85149]';
                    bgClass = 'bg-[#2d0a0a] dark:bg-[#2d0a0a]';
                    textClass = 'text-[#f85149] dark:text-[#f85149]';
                  } else {
                    lineClass = '';
                    bgClass = 'bg-background dark:bg-[#0d1117]';
                    textClass = 'text-text-muted dark:text-[#7d8590]';
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
                        className={cn(
                          'flex select-none text-text-muted bg-surface',
                          'dark:text-[#7d8590] dark:bg-[#0d1117]'
                        )}
                      >
                        <span className="w-10 px-2 text-right">{displayOldLine}</span>
                        <span
                          className={cn(
                            'w-10 px-2 text-right border-r border-border',
                            'dark:border-[#30363d]'
                          )}
                        >
                          {displayNewLine}
                        </span>
                      </span>
                      <span className={cn('px-2 select-none', textClass)}>{operation}</span>
                      <span className={cn('text-text', 'dark:text-[#e6edf3]')}>{content}</span>
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
      <div
        className={cn(
          'px-4 py-2 bg-surface border-b border-border font-mono text-sm',
          'dark:bg-[#0d1117] dark:border-[#30363d]'
        )}
      >
        {filePath}
      </div>
      <ScrollArea className="max-h-[600px]">{renderDiff()}</ScrollArea>
    </div>
  );
};
