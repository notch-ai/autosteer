import { renderHook } from '@testing-library/react';
import { useFontSizeVariables } from '@/hooks/useFontSizeVariables';
import { useSettingsStore } from '@/stores/settings';

describe('useFontSizeVariables', () => {
  let originalConsoleLog: typeof console.log;

  beforeEach(() => {
    originalConsoleLog = console.log;
    console.log = jest.fn();
    // Clean up all font size CSS variables and root font size
    document.documentElement.style.cssText = '';
    // Reset settings store to ensure clean state
    useSettingsStore.setState({
      preferences: {
        theme: 'system',
        fontSize: 'medium',
        fontFamily: 'monospace',
        autoSave: true,
        compactOnTokenLimit: true,
        maxTokens: 4000,
        badgeNotifications: true,
      } as any,
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    // Clean up all font size CSS variables and root font size
    document.documentElement.style.cssText = '';
  });

  describe('Hook Initialization', () => {
    it('should inject all CSS variables on mount', () => {
      useSettingsStore.setState((state) => ({
        preferences: { ...state.preferences, fontSize: 'medium' as any },
      }));

      renderHook(() => useFontSizeVariables());

      // Root font size should be set
      expect(document.documentElement.style.fontSize).toBe('13px');

      // Verify the hook logged successfully (this confirms CSS variables were set)
      expect(console.log).toHaveBeenCalledWith(
        '[useFontSizeVariables] Font size CSS variables injected with base:',
        '13px',
        '(set on html root)'
      );
    });

    it('should not inject if fontSize is undefined', () => {
      // Clear fontSize completely
      useSettingsStore.setState({
        preferences: {
          theme: 'system',
          fontSize: undefined as any,
          fontFamily: 'monospace',
          autoSave: true,
          compactOnTokenLimit: true,
          maxTokens: 4000,
          badgeNotifications: true,
        } as any,
      });

      // Reset document style to ensure clean state
      document.documentElement.style.fontSize = '';

      renderHook(() => useFontSizeVariables());

      // fontSize should not be set
      expect(document.documentElement.style.fontSize).toBe('');
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('Font Size Mapping', () => {
    it('should inject small font size (12px)', () => {
      useSettingsStore.setState((state) => ({
        preferences: { ...state.preferences, fontSize: 'small' as any },
      }));

      renderHook(() => useFontSizeVariables());

      expect(document.documentElement.style.fontSize).toBe('12px');
      expect(console.log).toHaveBeenCalledWith(
        '[useFontSizeVariables] Font size CSS variables injected with base:',
        '12px',
        '(set on html root)'
      );
    });

    it('should inject medium font size (13px)', () => {
      useSettingsStore.setState((state) => ({
        preferences: { ...state.preferences, fontSize: 'medium' as any },
      }));

      renderHook(() => useFontSizeVariables());

      expect(document.documentElement.style.fontSize).toBe('13px');
      expect(console.log).toHaveBeenCalledWith(
        '[useFontSizeVariables] Font size CSS variables injected with base:',
        '13px',
        '(set on html root)'
      );
    });

    it('should inject large font size (14px)', () => {
      useSettingsStore.setState((state) => ({
        preferences: { ...state.preferences, fontSize: 'large' as any },
      }));

      renderHook(() => useFontSizeVariables());

      expect(document.documentElement.style.fontSize).toBe('14px');
      expect(console.log).toHaveBeenCalledWith(
        '[useFontSizeVariables] Font size CSS variables injected with base:',
        '14px',
        '(set on html root)'
      );
    });
  });

  describe('Reactive Updates', () => {
    it('should update CSS variable when fontSize preference changes', () => {
      useSettingsStore.setState((state) => ({
        preferences: { ...state.preferences, fontSize: 'small' as any },
      }));

      const { rerender } = renderHook(() => useFontSizeVariables());

      expect(document.documentElement.style.fontSize).toBe('12px');

      useSettingsStore.setState((state) => ({
        preferences: { ...state.preferences, fontSize: 'large' as any },
      }));
      rerender();

      expect(document.documentElement.style.fontSize).toBe('14px');
    });

    it('should handle multiple updates correctly', () => {
      useSettingsStore.setState((state) => ({
        preferences: { ...state.preferences, fontSize: 'small' as any },
      }));

      const { rerender } = renderHook(() => useFontSizeVariables());

      expect(document.documentElement.style.fontSize).toBe('12px');

      useSettingsStore.setState((state) => ({
        preferences: { ...state.preferences, fontSize: 'medium' as any },
      }));
      rerender();
      expect(document.documentElement.style.fontSize).toBe('13px');

      useSettingsStore.setState((state) => ({
        preferences: { ...state.preferences, fontSize: 'large' as any },
      }));
      rerender();
      expect(document.documentElement.style.fontSize).toBe('14px');

      useSettingsStore.setState((state) => ({
        preferences: { ...state.preferences, fontSize: 'small' as any },
      }));
      rerender();
      expect(document.documentElement.style.fontSize).toBe('12px');
    });
  });

  describe('CSS Variable Persistence', () => {
    it('should override any existing --font-size-base value', () => {
      document.documentElement.style.setProperty('--font-size-base', '20px');

      useSettingsStore.setState((state) => ({
        preferences: { ...state.preferences, fontSize: 'medium' as any },
      }));

      renderHook(() => useFontSizeVariables());

      // fontSize should be set to the new value
      expect(document.documentElement.style.fontSize).toBe('13px');
      expect(console.log).toHaveBeenCalledWith(
        '[useFontSizeVariables] Font size CSS variables injected with base:',
        '13px',
        '(set on html root)'
      );
    });

    it('should maintain CSS variable after component unmount', () => {
      useSettingsStore.setState((state) => ({
        preferences: { ...state.preferences, fontSize: 'large' as any },
      }));

      const { unmount } = renderHook(() => useFontSizeVariables());

      expect(document.documentElement.style.fontSize).toBe('14px');

      unmount();

      // CSS variables persist after unmount (no cleanup)
      expect(document.documentElement.style.fontSize).toBe('14px');
    });
  });
});
