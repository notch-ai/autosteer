import { Extension } from '@codemirror/state';
import { EditorView, ViewPlugin, keymap } from '@codemirror/view';
import { Vim, getCM, vim } from '@replit/codemirror-vim';

export type VimMode = 'NORMAL' | 'INSERT';

export interface VimExtensionOptions {
  enabled: boolean;
  onModeChange?: (mode: VimMode) => void;
}

/**
 * Rate limit interval for vim mode detection (in milliseconds)
 *
 * This controls how frequently the vim extension checks for mode changes.
 * Lower values = more responsive but more CPU usage
 * Higher values = less CPU usage but slightly delayed mode detection
 *
 * Recommended values:
 * - 100ms (default): Good balance - ~10 checks/sec, imperceptible delay
 * - 150ms: Less frequent checks - ~6-7 checks/sec, still responsive
 * - 200ms: Minimal checks - ~5 checks/sec, noticeable on fast typing
 * - 250ms: Very low overhead - ~4 checks/sec, may feel sluggish
 *
 * Note: ESC key press to exit insert mode is still detected within this interval,
 * so even at 250ms the delay is imperceptible for mode switching.
 */
const VIM_MODE_CHECK_INTERVAL_MS = 500;

// Global rate limiter that persists across plugin instances
// This prevents recreation of the extension from resetting the rate limit
let globalLastModeCheck = 0;

export function createVimExtension(options: VimExtensionOptions): Extension {
  const { enabled, onModeChange } = options;

  const vimStatePlugin = ViewPlugin.fromClass(
    class {
      view: EditorView;
      private lastMode: VimMode = 'INSERT';

      constructor(view: EditorView) {
        this.view = view;

        // Set up initial vim configuration
        this.setupVimConfig();

        // Defer INSERT mode initialization to avoid race condition
        // with EditorView.update during construction
        setTimeout(() => {
          this.initializeInsertMode();
        }, 0);
      }

      private initializeInsertMode() {
        let attempts = 0;
        const maxAttempts = 5;

        const trySetInsertMode = () => {
          attempts++;

          try {
            const cm = getCM(this.view);

            if (!cm) {
              if (attempts < maxAttempts) {
                setTimeout(trySetInsertMode, 50);
              }
              return;
            }

            if (!cm.state?.vim) {
              if (attempts < maxAttempts) {
                setTimeout(trySetInsertMode, 50);
              }
              return;
            }

            // Use requestAnimationFrame to ensure we're not in the middle of an update
            requestAnimationFrame(() => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (Vim as any).handleKey(cm, 'i');

                this.lastMode = 'INSERT';
                onModeChange?.('INSERT');
              } catch (error) {
                if (attempts < maxAttempts) {
                  setTimeout(trySetInsertMode, 50);
                }
              }
            });
          } catch (error) {
            if (attempts < maxAttempts) {
              setTimeout(trySetInsertMode, 50);
            }
          }
        };

        trySetInsertMode();
      }

      update(update: any) {
        // If vim is disabled, skip ALL mode detection
        // ESC is disabled via key mappings, so user can't enter NORMAL mode
        if (!enabled) {
          return; // FAST PATH: No mode checking needed when vim is disabled
        }

        // Performance optimization: Only check vim mode on selection changes
        // This avoids expensive mode detection on every keystroke
        if (!update.selectionSet) {
          return;
        }

        // Rate limit: Only check mode at configured interval
        // This reduces checks from ~100/sec (during typing) to ~6-7/sec at 150ms
        // Mode changes (ESC press) are still detected within the interval (imperceptible)
        // Uses global rate limiter to persist across plugin recreation
        const now = Date.now();
        if (now - globalLastModeCheck < VIM_MODE_CHECK_INTERVAL_MS) {
          return;
        }

        globalLastModeCheck = now;

        // Detect mode changes by checking vim state
        const currentMode = this.getVimMode();
        if (currentMode !== this.lastMode) {
          console.log('[vim-extension] Mode changed from', this.lastMode, 'to', currentMode);
          this.lastMode = currentMode;
          onModeChange?.(currentMode);
        }
      }

      destroy() {
        // Cleanup if needed
      }

      private getVimMode(): VimMode {
        try {
          // Get CodeMirror instance from the view
          const cm = getCM(this.view);
          if (!cm) {
            return 'NORMAL';
          }

          // Get vim state from CodeMirror instance
          const vimState = cm.state.vim;
          if (!vimState) {
            return 'NORMAL';
          }

          // Check insertMode property (boolean)
          if (vimState.insertMode) {
            return 'INSERT';
          }

          // If not in insert mode, we're in NORMAL mode
          return 'NORMAL';
        } catch {
          return 'NORMAL';
        }
      }

      private setupVimConfig() {
        // Configure vim settings to match expected behavior
        // Ensure proper line-joining behavior (fix for bug)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (Vim as any).map('j', 'gj', 'normal');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (Vim as any).map('k', 'gk', 'normal');
      }
    }
  );

  // When vim is disabled, add keymap to block ESC key
  const extensions: Extension[] = [vim(), vimStatePlugin];

  if (!enabled) {
    extensions.push(
      keymap.of([
        {
          key: 'Escape',
          run: () => true, // Block ESC by returning true (handled)
        },
      ])
    );
  }

  return extensions;
}

export function getVimMode(): VimMode {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vimMode = (Vim as any).getMode?.() || 'insert';

    switch (vimMode.toLowerCase()) {
      case 'normal':
        return 'NORMAL';
      case 'insert':
        return 'INSERT';
      default:
        return 'INSERT';
    }
  } catch {
    return 'INSERT';
  }
}

export function setVimMode(view: EditorView, mode: VimMode): void {
  try {
    if (mode === 'NORMAL') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (Vim as any).exitInsertMode(view.contentDOM);
    } else if (mode === 'INSERT') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (Vim as any).handleKey(view.contentDOM, 'i');
    }
  } catch {
    // Silently fail if vim mode setting fails
  }
}
