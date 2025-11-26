import { Compartment } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

export function getCSSVariable(name: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!value) {
    return 'hsl()';
  }
  return `hsl(${value})`;
}

export function createEditorTheme() {
  return EditorView.theme({
    '&': {
      color: getCSSVariable('--foreground'),
      backgroundColor: getCSSVariable('--background'),
    },
    '.cm-scroller': {
      fontFamily: 'inherit !important',
    },
    '.cm-content': {
      caretColor: getCSSVariable('--foreground'),
      fontFamily: 'inherit !important',
    },
    '.cm-line': {
      fontFamily: 'inherit !important',
    },
    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: getCSSVariable('--accent'),
    },
    '.cm-activeLine': {
      backgroundColor: getCSSVariable('--muted'),
    },
    '.cm-gutters': {
      backgroundColor: getCSSVariable('--background'),
      color: getCSSVariable('--muted-foreground'),
      border: 'none',
    },
    '.cm-activeLineGutter': {
      backgroundColor: getCSSVariable('--muted'),
    },
  });
}

export const themeCompartment = new Compartment();

export function setupThemeListener(
  view: EditorView,
  compartment: Compartment = themeCompartment
): MutationObserver {
  const updateTheme = () => {
    view.dispatch({
      effects: compartment.reconfigure(createEditorTheme()),
    });
  };

  const observer = new MutationObserver(updateTheme);

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });

  return observer;
}

export function cleanupThemeListener(observer: MutationObserver): void {
  observer.disconnect();
}
