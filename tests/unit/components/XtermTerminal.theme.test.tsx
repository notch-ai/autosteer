import { Terminal } from '@xterm/xterm';
import {
  getCSSVariableRGB,
  getTerminalTheme,
  setupTerminalTheme,
} from '@/features/shared/components/terminal/theme';

describe('XTerm Terminal Theme Integration', () => {
  let mockGetComputedStyle: jest.Mock;

  beforeEach(() => {
    mockGetComputedStyle = jest.fn((element: Element) => {
      const nightThemeColors: Record<string, string> = {
        '--background': '2 5 12',
        '--foreground': '248 250 252',
        '--muted': '22 22 28',
        '--muted-foreground': '139 140 145',
        '--accent': '29 30 38',
        '--destructive': '156 23 23',
        '--primary': '248 250 252',
      };

      const dayThemeColors: Record<string, string> = {
        '--background': '255 255 255',
        '--foreground': '2 5 12',
        '--muted': '245 245 245',
        '--muted-foreground': '143 147 157',
        '--accent': '239 239 239',
        '--destructive': '248 113 113',
        '--primary': '20 25 35',
      };

      const isDayTheme = element.classList.contains('theme-day');
      const colors = isDayTheme ? dayThemeColors : nightThemeColors;

      return {
        getPropertyValue: (name: string) => colors[name] || '',
      } as CSSStyleDeclaration;
    });

    global.getComputedStyle = mockGetComputedStyle as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.documentElement.classList.remove('theme-day');
  });

  describe('getCSSVariableRGB', () => {
    it('should read CSS variables as RGB string', () => {
      const backgroundColor = getCSSVariableRGB('--background');
      expect(backgroundColor).toBe('rgb(2 5 12)');
      expect(mockGetComputedStyle).toHaveBeenCalledWith(document.documentElement);
    });

    it('should handle trimming whitespace', () => {
      mockGetComputedStyle.mockReturnValueOnce({
        getPropertyValue: () => '  248 250 252  ',
      } as CSSStyleDeclaration);

      const color = getCSSVariableRGB('--foreground');
      expect(color).toBe('rgb(248 250 252)');
    });

    it('should return rgb() for missing variables', () => {
      const missing = getCSSVariableRGB('--non-existent');
      expect(missing).toBe('rgb()');
    });
  });

  describe('getTerminalTheme', () => {
    it('should create theme with CSS variable colors', () => {
      const theme = getTerminalTheme();

      expect(theme).toHaveProperty('background');
      expect(theme).toHaveProperty('foreground');
      expect(theme).toHaveProperty('cursor');
      expect(theme).toHaveProperty('selectionBackground');
    });

    it('should map ANSI colors to CSS variables', () => {
      const theme = getTerminalTheme();

      expect(theme.black).toBe('rgb(22 22 28)');
      expect(theme.red).toBe('rgb(156 23 23)');
    });

    it('should read different colors for night theme', () => {
      document.documentElement.classList.remove('theme-day');

      const theme = getTerminalTheme();
      expect(theme.background).toBe('rgb(2 5 12)');
      expect(theme.foreground).toBe('rgb(248 250 252)');
    });

    it('should read different colors for day theme', () => {
      document.documentElement.classList.add('theme-day');

      const theme = getTerminalTheme();
      expect(theme.background).toBe('rgb(255 255 255)');
      expect(theme.foreground).toBe('rgb(2 5 12)');
    });
  });

  describe('setupTerminalTheme', () => {
    let mockTerminal: any;
    let mockObserver: MutationObserver | null;

    beforeEach(() => {
      mockTerminal = {
        options: {
          theme: {},
        },
      };
    });

    afterEach(() => {
      if (mockObserver) {
        mockObserver.disconnect();
        mockObserver = null;
      }
    });

    it('should set initial theme on terminal', () => {
      setupTerminalTheme(mockTerminal as Terminal);

      expect(mockTerminal.options.theme).toHaveProperty('background');
      expect(mockTerminal.options.theme).toHaveProperty('foreground');
    });

    it('should create MutationObserver', () => {
      const observer = setupTerminalTheme(mockTerminal as Terminal);
      expect(observer).toBeInstanceOf(MutationObserver);
      mockObserver = observer;
    });

    it('should observe documentElement class attribute changes', () => {
      const observeSpy = jest.spyOn(MutationObserver.prototype, 'observe');
      const observer = setupTerminalTheme(mockTerminal as Terminal);

      expect(observeSpy).toHaveBeenCalledWith(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      });

      mockObserver = observer;
    });

    it('should update theme when class changes', async () => {
      const observer = setupTerminalTheme(mockTerminal as Terminal);
      mockObserver = observer;

      const initialBg = mockTerminal.options.theme.background;

      document.documentElement.classList.add('theme-day');

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockTerminal.options.theme.background).not.toBe(initialBg);
    });

    it('should preserve terminal content during theme switch', async () => {
      const mockBuffer = 'test content';
      mockTerminal.buffer = mockBuffer;

      const observer = setupTerminalTheme(mockTerminal as Terminal);
      mockObserver = observer;

      document.documentElement.classList.add('theme-day');

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockTerminal.buffer).toBe(mockBuffer);
    });
  });

  describe('Dynamic Theme Switching', () => {
    it('should handle theme transitions without errors', () => {
      document.documentElement.classList.remove('theme-day');
      const nightTheme = getTerminalTheme();

      document.documentElement.classList.add('theme-day');
      const dayTheme = getTerminalTheme();

      expect(nightTheme.background).not.toBe(dayTheme.background);
      expect(nightTheme.foreground).not.toBe(dayTheme.foreground);
    });
  });
});
