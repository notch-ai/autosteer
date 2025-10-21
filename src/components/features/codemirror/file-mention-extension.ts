import { Extension, StateField, StateEffect } from '@codemirror/state';
import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';

export interface FileMentionExtensionOptions {
  onTrigger?: (query: string, position: { top: number; left: number }) => void;
  onHide?: () => void;
}

const setFileMentionTrigger = StateEffect.define<{ query: string; pos: number } | null>();

const fileMentionState = StateField.define<{ query: string; pos: number } | null>({
  create() {
    return null;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setFileMentionTrigger)) {
        return effect.value;
      }
    }
    // Don't auto-clear on document changes
    // Let the ViewPlugin explicitly manage state clearing
    return value;
  },
});

export function createFileMentionExtension(options: FileMentionExtensionOptions): Extension {
  const { onTrigger, onHide } = options;

  const fileMentionPlugin = ViewPlugin.fromClass(
    class {
      constructor(public view: EditorView) {
        this.checkForFileMention(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet) {
          this.checkForFileMention(update.view);
        }
      }

      destroy() {
        onHide?.();
      }

      private checkForFileMention(view: EditorView) {
        const { state } = view;
        const { from } = state.selection.main;
        const line = state.doc.lineAt(from);
        const textBefore = line.text.slice(0, from - line.from);

        // Check if we're typing after @ at word boundary
        const fileMentionMatch = textBefore.match(/(^|[\s])@([\w/.-]*)$/);

        if (fileMentionMatch) {
          const query = fileMentionMatch[2];
          const atPos = from - query.length - 1;

          // Defer all view operations until after update cycle completes
          setTimeout(() => {
            view.dispatch({
              effects: setFileMentionTrigger.of({ query, pos: atPos }),
            });

            if (onTrigger) {
              const coords = view.coordsAtPos(from);
              if (coords) {
                onTrigger(query, {
                  top: coords.bottom,
                  left: coords.left,
                });
              }
            }
          }, 0);
        } else {
          const current = state.field(fileMentionState, false);
          if (current) {
            console.log('[file-mention-extension] Pattern no longer matches, calling onHide');
            // Defer dispatch until after update cycle completes
            setTimeout(() => {
              view.dispatch({
                effects: setFileMentionTrigger.of(null),
              });
            }, 0);
            onHide?.();
          }
        }
      }
    }
  );

  return [fileMentionState, fileMentionPlugin];
}

export function insertFileMention(view: EditorView, filePath: string): void {
  const { state } = view;
  const mentionState = state.field(fileMentionState, false);

  if (mentionState) {
    const { pos, query } = mentionState;
    const from = pos;
    const to = pos + query.length + 1; // +1 for @

    view.dispatch({
      changes: { from, to, insert: filePath },
      effects: setFileMentionTrigger.of(null),
    });
  }
}
