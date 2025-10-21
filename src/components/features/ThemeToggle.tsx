import React from 'react';
import { useTheme } from '@/commons/contexts/ThemeContext';
import { IconButton } from './IconButton';
import type { IconName } from './Icon';

export const ThemeToggle: React.FC = () => {
  const { theme, activeTheme, setTheme } = useTheme();

  const themeOptions = [
    { value: 'light', label: 'Light', icon: 'sun' as IconName },
    { value: 'dark', label: 'Dark', icon: 'moon' as IconName },
    { value: 'system', label: 'System', icon: 'computer' as IconName },
  ];

  const handleThemeChange = (newTheme: string) => {
    // Add transition class to prevent jarring changes
    document.documentElement.classList.add('theme-transition-none');

    setTheme(newTheme as 'light' | 'dark' | 'system');

    // Remove transition class after a brief delay
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transition-none');
    }, 100);
  };

  const currentIcon =
    activeTheme === 'dark' || theme === 'dark' ? 'moon' : theme === 'system' ? 'computer' : 'sun';

  return (
    <IconButton
      icon={currentIcon as IconName}
      tooltip="Change theme"
      dropdown={{
        options: themeOptions,
        value: theme,
        onChange: handleThemeChange,
      }}
    />
  );
};
