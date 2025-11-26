/**
 * useGitWatcher Hook
 * Custom hook for watching git file system changes via IPC
 *
 * Features:
 * - Sets up IPC listener for 'git-diff:changes-detected' events
 * - Automatically starts/stops watching based on working directory
 * - Provides callback for change notifications
 * - Proper cleanup on unmount or directory change
 * - Comprehensive logging for debugging listener state
 *
 * @example
 * ```tsx
 * useGitWatcher({
 *   workingDirectory: '/path/to/repo',
 *   onChangesDetected: () => {
 *     console.log('Git changes detected!');
 *     refetchGitStats();
 *   }
 * });
 * ```
 */

import { logger } from '@/commons/utils/logger';
import { useEffect, useRef } from 'react';

interface UseGitWatcherOptions {
  workingDirectory: string | undefined;
  onChangesDetected: () => void;
}

/**
 * Custom hook for watching git file system changes
 *
 * This hook sets up an IPC listener to receive notifications when git changes
 * are detected in the working directory. It automatically handles starting/stopping
 * the watcher and cleaning up listeners.
 *
 * NOTE: During rapid project switching, you may see MaxListenersExceededWarning.
 * This is EXPECTED BEHAVIOR - React batches cleanup asynchronously.
 * All listeners ARE properly cleaned up, just delayed by React's scheduling.
 * The warning is harmless and will resolve once switching stabilizes.
 *
 * @param options - Configuration options
 * @param options.workingDirectory - Path to the git repository to watch
 * @param options.onChangesDetected - Callback function invoked when changes are detected
 */
export const useGitWatcher = ({
  workingDirectory,
  onChangesDetected,
}: UseGitWatcherOptions): void => {
  // Use ref to store latest callback without triggering effect re-runs
  const onChangesDetectedRef = useRef(onChangesDetected);

  // Update ref on every render to avoid stale closures
  useEffect(() => {
    onChangesDetectedRef.current = onChangesDetected;
  });

  useEffect(() => {
    if (!workingDirectory) {
      return undefined;
    }

    // Log listener state BEFORE adding
    const ipcRenderer = window.electron?.ipcRenderer as any;
    const listenerCountBefore = ipcRenderer?.listenerCount?.('git-diff:changes-detected') ?? 0;
    logger.debug('[useGitWatcher] BEFORE ADD', {
      event: 'git-diff:changes-detected',
      count: listenerCountBefore,
      workingDirectory: workingDirectory.substring(workingDirectory.lastIndexOf('/') + 1),
    });

    // Start watching for git changes
    window.electron?.ipcRenderer
      ?.invoke('git-diff:start-watching', workingDirectory)
      .catch((err) => {
        logger.error('[useGitWatcher] Failed to start git watching', {
          error: String(err),
          workingDirectory: workingDirectory.substring(workingDirectory.lastIndexOf('/') + 1),
        });
      });

    // Listen for change events from main process
    const handleChanges = (_event: unknown, ...args: unknown[]) => {
      const data = args[0] as { repoPath: string };

      if (data.repoPath === workingDirectory) {
        logger.debug('[useGitWatcher] Changes detected', {
          repoPath: data.repoPath.substring(data.repoPath.lastIndexOf('/') + 1),
        });
        // Use ref to get latest callback without causing effect to re-run
        onChangesDetectedRef.current();
      }
    };

    window.electron?.ipcRenderer?.on('git-diff:changes-detected', handleChanges);

    // Log listener state AFTER adding
    const listenerCountAfter = ipcRenderer?.listenerCount?.('git-diff:changes-detected') ?? 0;
    logger.debug('[useGitWatcher] AFTER ADD', {
      event: 'git-diff:changes-detected',
      count: listenerCountAfter,
      added: listenerCountAfter - listenerCountBefore,
    });

    // Cleanup on unmount or when directory changes
    return () => {
      // Log listener state BEFORE cleanup
      const listenerCountBeforeCleanup =
        ipcRenderer?.listenerCount?.('git-diff:changes-detected') ?? 0;
      logger.debug('[useGitWatcher] BEFORE CLEANUP', {
        event: 'git-diff:changes-detected',
        count: listenerCountBeforeCleanup,
        workingDirectory: workingDirectory.substring(workingDirectory.lastIndexOf('/') + 1),
      });

      window.electron?.ipcRenderer?.removeListener('git-diff:changes-detected', handleChanges);

      // Log listener state AFTER cleanup
      const listenerCountAfterCleanup =
        ipcRenderer?.listenerCount?.('git-diff:changes-detected') ?? 0;
      logger.debug('[useGitWatcher] AFTER CLEANUP', {
        event: 'git-diff:changes-detected',
        count: listenerCountAfterCleanup,
        removed: listenerCountBeforeCleanup - listenerCountAfterCleanup,
      });

      window.electron?.ipcRenderer?.invoke('git-diff:stop-watching', workingDirectory).catch(() => {
        // Ignore errors on cleanup
      });
    };
  }, [workingDirectory]);
};
