import React, { createContext, useContext, useEffect, useState } from 'react';

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

  // Apply theme class to document element
  const applyThemeClass = (isDark: boolean) => {
    if (isDark) {
      // Night theme (default) - remove the day class and add dark class for Tailwind
      document.documentElement.classList.remove('theme-day');
      document.documentElement.classList.add('dark');
    } else {
      // Day theme - add the day class and remove dark class
      document.documentElement.classList.add('theme-day');
      document.documentElement.classList.remove('dark');
    }
  };

  // Update active theme and apply CSS class
  const updateActiveTheme = async (themeMode: ThemeMode) => {
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
  };

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
  }, [isElectron]);

  // Update when theme mode changes
  useEffect(() => {
    updateActiveTheme(theme);
  }, [theme]);

  const setTheme = async (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    await updateActiveTheme(newTheme);

    if (isElectron) {
      await (window as any).electron.theme.set(newTheme);
    }
  };

  const toggleTheme = () => {
    // Simple toggle between light and dark
    const newTheme = activeTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, activeTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
