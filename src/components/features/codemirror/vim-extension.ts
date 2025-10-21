import { Extension } from '@codemirror/state';
import { EditorView, ViewPlugin, keymap } from '@codemirror/view';
import { Vim, getCM, vim } from '@replit/codemirror-vim';

export type VimMode = 'NORMAL' | 'INSERT';

export interface VimExtensionOptions {
  enabled: boolean;
  onModeChange?: (mode: VimMode) => void;
}

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

      update() {
        // If vim is disabled, always report INSERT mode
        // ESC is disabled via key mappings, so user can't enter NORMAL mode
        if (!enabled) {
          if (this.lastMode !== 'INSERT') {
            this.lastMode = 'INSERT';
            onModeChange?.('INSERT');
          }
          return;
        }

        // // Only detect mode changes when editor is focused
        // if (!this.view.hasFocus) {
        //   return; // Skip mode detection when not focused
        // }

        // Detect mode changes by checking vim state
        const currentMode = this.getVimMode();
        if (currentMode !== this.lastMode) {
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
