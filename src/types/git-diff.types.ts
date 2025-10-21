// Type definitions for Git Diff functionality

export interface DiffChange {
  type: 'add' | 'del' | 'normal';
  lineNumber?: number;
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
  isConflict?: boolean;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  changes: DiffChange[];
  hasConflicts: boolean;
}

export interface FileDiff {
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

export interface GitDiffOptions {
  repoPath: string;
  from?: string;
  to?: string;
  filePath?: string;
  contextLines?: number;
}

export interface DiscardLineInfo {
  lineNumber: number;
  type: 'add' | 'del';
}

export interface DiscardOperation {
  type: 'file' | 'hunk' | 'lines';
  filePath: string;
  hunk?: DiffHunk;
  lines?: DiscardLineInfo[];
}
