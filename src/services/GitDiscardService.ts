import { DiffHunk } from '@/types/git-diff.types';

export interface DiscardLineInfo {
  lineNumber: number;
  type: 'add' | 'del';
}

export class GitDiscardService {
  static async discardFile(repoPath: string, filePath: string): Promise<void> {
    console.log('[GitDiscardService] Calling discard-file IPC', { repoPath, filePath });
    await window.electron.ipcRenderer.invoke('git-diff:discard-file', { repoPath, filePath });
    console.log('[GitDiscardService] discard-file IPC returned');
  }

  static async discardHunk(repoPath: string, filePath: string, hunk: DiffHunk): Promise<void> {
    console.log('[GitDiscardService] Calling discard-hunk IPC', {
      repoPath,
      filePath,
      oldStart: hunk.oldStart,
      hunk: hunk,
    });

    // Add timeout to detect hanging
    // const timeoutPromise = new Promise((_, reject) => {
    //   setTimeout(() => reject(new Error('IPC call timed out after 5 seconds')), 5000);
    // });

    await window.electron.ipcRenderer.invoke('git-diff:discard-hunk', {
      repoPath,
      filePath,
      hunk,
    });

    // await Promise.race([ipcPromise, timeoutPromise]);
    console.log('[GitDiscardService] discard-hunk IPC returned');
  }

  static async discardLines(
    repoPath: string,
    filePath: string,
    lines: DiscardLineInfo[]
  ): Promise<void> {
    console.log('[GitDiscardService] Calling discard-lines IPC', {
      repoPath,
      filePath,
      lineCount: lines.length,
      lines: lines,
    });

    // Add timeout to detect hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('IPC call timed out after 5 seconds')), 5000);
    });

    const ipcPromise = window.electron.ipcRenderer.invoke('git-diff:discard-lines', {
      repoPath,
      filePath,
      lines,
    });

    await Promise.race([ipcPromise, timeoutPromise]);
    console.log('[GitDiscardService] discard-lines IPC returned');
  }

  static async restoreFile(repoPath: string, filePath: string): Promise<void> {
    console.log('[GitDiscardService] Calling restore-file IPC', { repoPath, filePath });
    await window.electron.ipcRenderer.invoke('git-diff:restore-file', { repoPath, filePath });
    console.log('[GitDiscardService] restore-file IPC returned');
  }
}
