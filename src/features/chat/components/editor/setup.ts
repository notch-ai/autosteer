import { EditorState, Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { bracketMatching } from '@codemirror/language';
import { highlightSelectionMatches } from '@codemirror/search';

export interface EditorConfig {
  doc?: string;
  extensions?: Extension[];
  parent?: Element | DocumentFragment;
  readOnly?: boolean;
  placeholder?: string;
}

export interface EditorInstance {
  view: EditorView;
  state: EditorState;
}

const basicSetup: Extension[] = [
  history(),
  closeBrackets(),
  bracketMatching(),
  highlightSelectionMatches(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap]),
];

export function createEditorState(config: EditorConfig = {}): EditorState {
  const { doc = '', extensions = [] } = config;

  return EditorState.create({
    doc,
    extensions: [...basicSetup, ...extensions],
  });
}

export function createEditorView(
  state: EditorState,
  config: Omit<EditorConfig, 'doc' | 'extensions'> = {}
): EditorView {
  const { parent, readOnly = false } = config;

  const extensions: Extension[] = [];

  if (readOnly) {
    extensions.push(EditorState.readOnly.of(true));
  }

  if (!parent) {
    return new EditorView({
      state,
      extensions,
    });
  }

  return new EditorView({
    state,
    parent,
    extensions,
  });
}

export function createEditor(config: EditorConfig = {}): EditorInstance {
  const startTime = performance.now();

  const state = createEditorState(config);
  const view = createEditorView(state, config);

  const initTime = performance.now() - startTime;

  if (initTime > 100) {
    console.warn(`CodeMirror initialization took ${initTime.toFixed(2)}ms (target: <100ms)`);
  }

  return { view, state };
}

export function destroyEditor(instance: EditorInstance): void {
  instance.view.destroy();
}

export function getEditorContent(instance: EditorInstance): string {
  return instance.view.state.doc.toString();
}

export function setEditorContent(instance: EditorInstance, content: string): void {
  instance.view.dispatch({
    changes: {
      from: 0,
      to: instance.view.state.doc.length,
      insert: content,
    },
  });
}

export function focusEditor(instance: EditorInstance): void {
  instance.view.focus();
}
