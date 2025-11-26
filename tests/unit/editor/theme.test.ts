import { Compartment } from '@codemirror/state';
import {
  getCSSVariable,
  createEditorTheme,
  setupThemeListener,
  cleanupThemeListener,
  themeCompartment,
} from '@/features/chat/components/editor/theme';

describe('CodeMirror Theme Integration', () => {
  let mockGetComputedStyle: jest.Mock;

  beforeEach(() => {
    mockGetComputedStyle = jest.fn((element: Element) => {
      const nightThemeColors: Record<string, string> = {
        '--background': '222.2 84% 4.9%',
        '--foreground': '210 40% 98%',
        '--muted': '240 12% 10%',
        '--muted-foreground': '234 4% 56%',
        '--accent': '237 13% 13%',
      };

      const dayThemeColors: Record<string, string> = {
        '--background': '0 0% 100%',
        '--foreground': '222.2 84% 4.9%',
        '--muted': '0 0% 96%',
        '--muted-foreground': '223 8% 59%',
        '--accent': '0 0% 94%',
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

  describe('getCSSVariable', () => {
    it('should read CSS variables using getComputedStyle', () => {
      const backgroundColor = getCSSVariable('--background');
      expect(backgroundColor).toBe('hsl(222.2 84% 4.9%)');
      expect(mockGetComputedStyle).toHaveBeenCalledWith(document.documentElement);
    });

    it('should return hsl format for HSL values', () => {
      const foregroundColor = getCSSVariable('--foreground');
      expect(foregroundColor).toBe('hsl(210 40% 98%)');
    });

    it('should handle trimming whitespace', () => {
      mockGetComputedStyle.mockReturnValueOnce({
        getPropertyValue: () => '  222.2 84% 4.9%  ',
      } as unknown as CSSStyleDeclaration);

      const color = getCSSVariable('--background');
      expect(color).toBe('hsl(222.2 84% 4.9%)');
    });

    it('should return hsl() for missing variables', () => {
      const missing = getCSSVariable('--non-existent');
      expect(missing).toBe('hsl()');
    });
  });

  describe('createEditorTheme', () => {
    it('should create theme extension with CSS variable colors', () => {
      const theme = createEditorTheme();
      expect(theme).toBeDefined();
    });

    it('should read colors dynamically from CSS variables', () => {
      const nightTheme = createEditorTheme();
      expect(nightTheme).toBeDefined();

      document.documentElement.classList.add('theme-day');
      const dayTheme = createEditorTheme();
      expect(dayTheme).toBeDefined();

      expect(nightTheme).not.toBe(dayTheme);
    });
  });

  describe('themeCompartment', () => {
    it('should export a Compartment instance', () => {
      expect(themeCompartment).toBeInstanceOf(Compartment);
    });
  });

  describe('Theme Change Listener', () => {
    let mockView: any;
    let mockObserver: MutationObserver | null;
    let mockCompartment: Compartment;

    beforeEach(() => {
      mockCompartment = new Compartment();
      mockView = {
        dispatch: jest.fn(),
      };
    });

    afterEach(() => {
      if (mockObserver) {
        cleanupThemeListener(mockObserver);
        mockObserver = null;
      }
    });

    it('should create MutationObserver on setup', () => {
      const observer = setupThemeListener(mockView, mockCompartment);
      expect(observer).toBeInstanceOf(MutationObserver);
      mockObserver = observer;
    });

    it('should observe documentElement class attribute changes', () => {
      const observeSpy = jest.spyOn(MutationObserver.prototype, 'observe');
      const observer = setupThemeListener(mockView, mockCompartment);

      expect(observeSpy).toHaveBeenCalledWith(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      });

      mockObserver = observer;
    });

    it('should update theme when class changes', async () => {
      const observer = setupThemeListener(mockView, mockCompartment);
      mockObserver = observer;

      document.documentElement.classList.add('theme-day');

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockView.dispatch).toHaveBeenCalled();
      const dispatchCall = mockView.dispatch.mock.calls[0][0];
      expect(dispatchCall).toHaveProperty('effects');
    });

    it('should cleanup observer on disconnect', () => {
      const disconnectSpy = jest.spyOn(MutationObserver.prototype, 'disconnect');
      const observer = setupThemeListener(mockView, mockCompartment);

      cleanupThemeListener(observer);

      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  describe('Dynamic Theme Switching', () => {
    it('should read different colors for night theme', () => {
      document.documentElement.classList.remove('theme-day');

      const backgroundColor = getCSSVariable('--background');
      expect(backgroundColor).toBe('hsl(222.2 84% 4.9%)');
    });

    it('should read different colors for day theme', () => {
      document.documentElement.classList.add('theme-day');

      const backgroundColor = getCSSVariable('--background');
      expect(backgroundColor).toBe('hsl(0 0% 100%)');
    });

    it('should handle theme transitions', () => {
      document.documentElement.classList.remove('theme-day');
      const nightBg = getCSSVariable('--background');

      document.documentElement.classList.add('theme-day');
      const dayBg = getCSSVariable('--background');

      expect(nightBg).not.toBe(dayBg);
    });
  });
});
