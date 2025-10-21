import { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

export interface ThemeColors {
  background: string;
  foreground: string;
  caret: string;
  selection: string;
  lineHighlight: string;
  gutterBackground: string;
  gutterForeground: string;
}

export const defaultLightTheme: ThemeColors = {
  background: '#ffffff',
  foreground: '#24292e',
  caret: '#24292e',
  selection: '#0366d625',
  lineHighlight: '#f6f8fa',
  gutterBackground: '#ffffff',
  gutterForeground: '#6a737d',
};

export const defaultDarkTheme: ThemeColors = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  caret: '#d4d4d4',
  selection: '#264f78',
  lineHighlight: '#2a2a2a',
  gutterBackground: '#1e1e1e',
  gutterForeground: '#858585',
};

export function createTheme(colors: ThemeColors): Extension {
  return EditorView.theme(
    {
      '&': {
        color: colors.foreground,
        backgroundColor: colors.background,
      },
      '.cm-content': {
        caretColor: colors.caret,
      },
      '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
        {
          backgroundColor: colors.selection,
        },
      '.cm-activeLine': {
        backgroundColor: colors.lineHighlight,
      },
      '.cm-gutters': {
        backgroundColor: colors.gutterBackground,
        color: colors.gutterForeground,
        border: 'none',
      },
      '.cm-activeLineGutter': {
        backgroundColor: colors.lineHighlight,
      },
    },
    { dark: colors.background === defaultDarkTheme.background }
  );
}

export const lightTheme = createTheme(defaultLightTheme);
export const darkTheme = createTheme(defaultDarkTheme);

export function getThemeFromSystemPreference(): Extension {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? darkTheme : lightTheme;
}
