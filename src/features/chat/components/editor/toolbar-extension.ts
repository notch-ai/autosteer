import { Extension } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { EditorView } from '@codemirror/view';

export type FormatType = 'bold' | 'italic' | 'strikethrough' | 'code' | 'link';

export interface ToolbarExtensionOptions {
  onFormat?: (type: FormatType, selectedText: string) => void;
}

export function createToolbarExtension(options: ToolbarExtensionOptions): Extension {
  const { onFormat } = options;

  return keymap.of([
    {
      key: 'Mod-b',
      run: (view: EditorView) => {
        const selectedText = getSelectedText(view);
        onFormat?.('bold', selectedText);
        return true;
      },
    },
    {
      key: 'Mod-i',
      run: (view: EditorView) => {
        const selectedText = getSelectedText(view);
        onFormat?.('italic', selectedText);
        return true;
      },
    },
    {
      key: 'Mod-k',
      run: (view: EditorView) => {
        const selectedText = getSelectedText(view);
        onFormat?.('link', selectedText);
        return true;
      },
    },
    {
      key: 'Mod-`',
      run: (view: EditorView) => {
        const selectedText = getSelectedText(view);
        onFormat?.('code', selectedText);
        return true;
      },
    },
  ]);
}

function getSelectedText(view: EditorView): string {
  const { from, to } = view.state.selection.main;
  return view.state.doc.sliceString(from, to);
}
