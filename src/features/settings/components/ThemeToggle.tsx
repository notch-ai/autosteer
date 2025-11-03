import React, { useState } from 'react';
import { useTheme } from '@/commons/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/commons/utils';

export const ThemeToggle: React.FC = () => {
  const { theme, activeTheme, setTheme } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  const handleThemeChange = (newTheme: string) => {
    // Add transition class to prevent jarring changes
    document.documentElement.classList.add('theme-transition-none');

    setTheme(newTheme as 'light' | 'dark' | 'system');
    setIsDropdownOpen(false);

    // Remove transition class after a brief delay
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transition-none');
    }, 100);
  };

  const handleOpenChange = (open: boolean) => {
    setIsDropdownOpen(open);
    // Blur the button when the popover closes to remove focus ring
    if (!open && buttonRef.current) {
      buttonRef.current.blur();
    }
  };

  const CurrentIcon =
    activeTheme === 'dark' || theme === 'dark' ? Moon : theme === 'system' ? Monitor : Sun;

  return (
    <Popover open={isDropdownOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          ref={buttonRef}
          variant="icon-secondary"
          size="icon"
          title="Change theme"
          aria-label="Change theme"
        >
          <CurrentIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2 bg-background border border-border" align="start">
        <div className="space-y-1">
          {themeOptions.map((option) => {
            const isActive = theme === option.value;
            const OptionIcon = option.icon;
            return (
              <Button
                key={option.value}
                variant="ghost"
                size="sm"
                onClick={() => handleThemeChange(option.value)}
                className={cn('w-full justify-start', isActive && 'bg-surface-active text-primary')}
              >
                <OptionIcon className="h-4 w-4" />
                <span className="ml-2">{option.label}</span>
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};
