import { Terminal } from '@xterm/xterm';

export function getCSSVariableRGB(name: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!value) {
    return 'rgb()';
  }
  return `rgb(${value})`;
}

export function getTerminalTheme() {
  return {
    background: getCSSVariableRGB('--color-terminal-bg'),
    foreground: getCSSVariableRGB('--foreground'),
    cursor: getCSSVariableRGB('--primary'),
    cursorAccent: getCSSVariableRGB('--primary-foreground'),
    selectionBackground: getCSSVariableRGB('--accent'),
    black: getCSSVariableRGB('--color-terminal-black'),
    red: getCSSVariableRGB('--color-terminal-red'),
    green: getCSSVariableRGB('--color-terminal-green'),
    yellow: getCSSVariableRGB('--color-terminal-yellow'),
    blue: getCSSVariableRGB('--color-terminal-blue'),
    magenta: getCSSVariableRGB('--color-terminal-magenta'),
    cyan: getCSSVariableRGB('--color-terminal-cyan'),
    white: getCSSVariableRGB('--color-terminal-white'),
    brightBlack: getCSSVariableRGB('--color-terminal-bright-black'),
    brightRed: getCSSVariableRGB('--color-terminal-bright-red'),
    brightGreen: getCSSVariableRGB('--color-terminal-bright-green'),
    brightYellow: getCSSVariableRGB('--color-terminal-bright-yellow'),
    brightBlue: getCSSVariableRGB('--color-terminal-bright-blue'),
    brightMagenta: getCSSVariableRGB('--color-terminal-bright-magenta'),
    brightCyan: getCSSVariableRGB('--color-terminal-bright-cyan'),
    brightWhite: getCSSVariableRGB('--color-terminal-bright-white'),
  };
}

export function setupTerminalTheme(terminal: Terminal): MutationObserver {
  const updateTheme = () => {
    terminal.options.theme = getTerminalTheme();
  };

  updateTheme();

  const observer = new MutationObserver(updateTheme);

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });

  return observer;
}
