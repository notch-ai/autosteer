import { Extension, StateEffect, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';

export interface SlashCommand {
  command: string;
  label: string;
  description?: string;
  content?: string;
}

export interface SlashCommandExtensionOptions {
  commands?: SlashCommand[];
  onTrigger?: (query: string, position: { top: number; left: number }) => void;
  onHide?: () => void;
}

const setSlashCommandTrigger = StateEffect.define<{ query: string; pos: number } | null>();

const slashCommandState = StateField.define<{ query: string; pos: number } | null>({
  create() {
    return null;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSlashCommandTrigger)) {
        return effect.value;
      }
    }
    // Don't auto-clear on document changes
    // Let the ViewPlugin explicitly manage state clearing
    return value;
  },
});

export function createSlashCommandExtension(options: SlashCommandExtensionOptions): Extension {
  const { onTrigger, onHide } = options;

  const slashCommandPlugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(public view: EditorView) {
        this.decorations = Decoration.none;
        this.checkForSlashCommand(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet) {
          this.checkForSlashCommand(update.view);
        }
      }

      destroy() {
        onHide?.();
      }

      private checkForSlashCommand(view: EditorView) {
        const { state } = view;
        const { from } = state.selection.main;
        const line = state.doc.lineAt(from);
        const textBefore = line.text.slice(0, from - line.from);

        // Check if we're typing / at the start of the line only (like Claude Code CLI)
        // Allow word characters and spaces after /
        const slashMatch = textBefore.match(/^\/([\w\s]*)$/);

        if (slashMatch) {
          const query = slashMatch[1]; // Group 1 is the query after /
          const slashPos = from - query.length - 1;

          // Defer all view operations until after update cycle completes
          setTimeout(() => {
            view.dispatch({
              effects: setSlashCommandTrigger.of({ query, pos: slashPos }),
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
          const current = state.field(slashCommandState, false);
          if (current) {
            // Defer dispatch until after update cycle completes
            setTimeout(() => {
              view.dispatch({
                effects: setSlashCommandTrigger.of(null),
              });
            }, 0);
            onHide?.();
          }
        }
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );

  return [slashCommandState, slashCommandPlugin];
}

export function insertSlashCommand(view: EditorView, command: string): void {
  const { state } = view;
  const slashState = state.field(slashCommandState, false);

  if (slashState) {
    const { pos, query } = slashState;
    const from = pos;
    const to = pos + query.length + 1;

    view.dispatch({
      changes: { from, to, insert: command },
      effects: setSlashCommandTrigger.of(null),
    });
  }
}
