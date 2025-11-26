import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowRight,
  Binary,
  ExternalLink,
  FilePenLine,
  FilePlus,
  FileX,
  GitBranch,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface GitDiffStat {
  file: string;
  additions: number;
  deletions: number;
  binary?: boolean;
  status?: 'modified' | 'staged' | 'both' | 'untracked';
  isRenamed?: boolean;
  oldPath?: string;
}

interface FileChangesListProps {
  files: GitDiffStat[];
  selectedFile: string | null;
  onSelect: (filePath: string) => void;
  onDiscardFile?: (filePath: string) => void;
  workingDirectory?: string;
}

export const FileChangesList: React.FC<FileChangesListProps> = React.memo(function FileChangesList({
  files,
  selectedFile,
  onSelect,
  onDiscardFile,
  workingDirectory,
}) {
  const [hoveredFile, setHoveredFile] = useState<string | null>(null);
  const [hasEditors, setHasEditors] = useState(false);

  useEffect(() => {
    // Detect available editors on mount
    if (window.electron?.ide) {
      window.electron.ide.detect().then((result: any) => {
        setHasEditors((result.editors || []).length > 0);
      });
    }
  }, []);

  const handleOpenInIde = async (filePath: string) => {
    if (!window.electron?.ide) {
      toast.error('IDE integration not available');
      return;
    }

    if (!workingDirectory) {
      toast.error('No working directory available');
      return;
    }

    try {
      const fullPath = `${workingDirectory}/${filePath}`;
      const result = await window.electron.ide.openFile({ file: fullPath });

      if (!result.success) {
        toast.error(`Failed to open file: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to open file in IDE:', error);
      toast.error('Failed to open file in IDE');
    }
  };

  const addedCount = files.filter((s) => s.status === 'untracked').length;
  const modifiedCount = files.filter(
    (s) => s.status !== 'untracked' && !(s.deletions > 0 && s.additions === 0)
  ).length;
  const deletedCount = files.filter((s) => s.deletions > 0 && s.additions === 0).length;

  const getSummary = () => {
    const parts = [];
    if (addedCount > 0) parts.push(`${addedCount} added`);
    if (modifiedCount > 0) parts.push(`${modifiedCount} updated`);
    if (deletedCount > 0) parts.push(`${deletedCount} deleted`);
    return parts.join(', ');
  };

  const getRenamedFileDisplay = (stat: GitDiffStat): { from: string; to: string } | null => {
    if (stat.isRenamed && stat.oldPath) {
      return { from: stat.oldPath, to: stat.file };
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2">
        <h3 className="text-sm font-medium">{getSummary() || 'No changes'}</h3>
      </div>

      <ScrollArea className="flex-1 overflow-hidden">
        <div className="p-2 space-y-1 max-w-full">
          {files.map((stat, index) => {
            const isSelected = stat.file === selectedFile;
            const renamed = getRenamedFileDisplay(stat);

            return (
              <div
                key={`${stat.file}-${index}`}
                className={`flex items-center justify-between px-2 py-1.5 text-sm rounded-sm group transition-colors min-h-8 cursor-pointer max-w-full ${
                  isSelected ? 'bg-card-active' : 'hover:bg-card-hover text-foreground'
                }`}
                onClick={() => onSelect(stat.file)}
                onMouseEnter={() => setHoveredFile(stat.file)}
                onMouseLeave={() => setHoveredFile(null)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                  {stat.binary ? (
                    <Binary className="h-3 w-3 flex-shrink-0" />
                  ) : stat.status === 'untracked' ? (
                    <FilePlus className="h-3 w-3 flex-shrink-0 text-success" />
                  ) : stat.deletions > 0 && stat.additions === 0 ? (
                    <FileX className="h-3 w-3 flex-shrink-0 text-danger" />
                  ) : stat.status === 'both' ? (
                    <GitBranch className="h-3 w-3 flex-shrink-0 text-danger" />
                  ) : stat.isRenamed ? (
                    <ArrowRight className="h-3 w-3 flex-shrink-0 text-blue dark:text-blue-400" />
                  ) : (
                    <FilePenLine className="h-3 w-3 flex-shrink-0 text-warning" />
                  )}
                  <div
                    className="truncate text-sm min-w-0"
                    style={{ direction: 'rtl', textAlign: 'left' }}
                    title={stat.file}
                  >
                    {renamed ? `${renamed.from} → ${renamed.to}` : stat.file}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 text-right ml-4">
                  {stat.binary && <span className="text-sm font-medium">binary</span>}
                  {stat.status === 'staged' && (
                    <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">
                      staged
                    </span>
                  )}
                  {stat.status === 'both' && (
                    <span className="text-danger text-sm font-medium">conflict</span>
                  )}
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
                  {workingDirectory && hasEditors && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenInIde(stat.file);
                      }}
                      className={`p-1 rounded transition-colors hover:bg-accent ${
                        hoveredFile === stat.file ? 'opacity-100' : 'opacity-0'
                      }`}
                      title="Open in IDE"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                  {onDiscardFile && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDiscardFile(stat.file);
                      }}
                      className={`p-1 rounded transition-colors hover:bg-accent ${
                        hoveredFile === stat.file ? 'opacity-100' : 'opacity-0'
                      }`}
                      title="Discard changes"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
});
