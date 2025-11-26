import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';
type ActiveTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  activeTheme: ActiveTheme;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  activeTheme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>('system');
  const [activeTheme, setActiveTheme] = useState<ActiveTheme>('dark');
  const isElectron = !!(window as any).electron;

  // Apply theme class to document element (no dependencies - stable function)
  const applyThemeClass = useCallback((isDark: boolean) => {
    if (isDark) {
      // Night theme (default) - add theme-night and dark class
      document.documentElement.classList.add('theme-night', 'dark');
      document.documentElement.classList.remove('theme-day');
    } else {
      // Day theme - add theme-day and remove dark/theme-night classes
      document.documentElement.classList.add('theme-day');
      document.documentElement.classList.remove('theme-night', 'dark');
    }
  }, []);

  // Update active theme and apply CSS class
  const updateActiveTheme = useCallback(
    async (themeMode: ThemeMode) => {
      let newActiveTheme: ActiveTheme;

      if (themeMode === 'system') {
        // Get system preference
        if (isElectron) {
          const systemPref = await (window as any).electron.theme.getSystemPreference();
          newActiveTheme = systemPref as ActiveTheme;
        } else {
          // Fallback to browser API
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          newActiveTheme = prefersDark ? 'dark' : 'light';
        }
      } else {
        newActiveTheme = themeMode as ActiveTheme;
      }

      setActiveTheme(newActiveTheme);
      applyThemeClass(newActiveTheme === 'dark');
    },
    [isElectron, applyThemeClass]
  );

  // Initialize theme on mount
  useEffect(() => {
    if (isElectron) {
      const electron = (window as any).electron;

      // Get saved theme preference
      electron.theme.get().then(async (savedTheme: ThemeMode) => {
        // If no saved theme, default to system
        const themeToUse = savedTheme || 'system';
        setThemeState(themeToUse);
        await updateActiveTheme(themeToUse);
      });

      // Listen for system theme changes
      const unsubscribe = electron.theme.onChange((newTheme: ActiveTheme) => {
        electron.theme.get().then(async (currentTheme: ThemeMode) => {
          if (currentTheme === 'system') {
            setActiveTheme(newTheme);
            applyThemeClass(newTheme === 'dark');
          }
        });
      });

      return unsubscribe;
    } else {
      // Non-Electron environment
      updateActiveTheme('system');

      // Listen for browser theme changes
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        if (theme === 'system') {
          const newActiveTheme = e.matches ? 'dark' : 'light';
          setActiveTheme(newActiveTheme);
          applyThemeClass(e.matches);
        }
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [isElectron, updateActiveTheme, applyThemeClass, theme]);

  // Update when theme mode changes
  useEffect(() => {
    updateActiveTheme(theme);
  }, [theme, updateActiveTheme]);

  // Wrap setTheme in useCallback to maintain stable reference
  const setTheme = useCallback(
    async (newTheme: ThemeMode) => {
      setThemeState(newTheme);
      await updateActiveTheme(newTheme);

      if (isElectron) {
        await (window as any).electron.theme.set(newTheme);
      }
    },
    [isElectron, updateActiveTheme]
  );

  // Wrap toggleTheme in useCallback to maintain stable reference
  const toggleTheme = useCallback(() => {
    // Simple toggle between light and dark
    const newTheme = activeTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  }, [activeTheme, setTheme]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({ theme, activeTheme, setTheme, toggleTheme }),
    [theme, activeTheme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};
