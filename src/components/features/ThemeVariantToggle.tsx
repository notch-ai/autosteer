import React from 'react';
import { useTheme } from '@/commons/contexts/ThemeContext';
import { Button } from '../ui/button';

export const ThemeVariantToggle: React.FC = () => {
  const { activeTheme, toggleTheme } = useTheme();

  return (
    <Button
      onClick={toggleTheme}
      variant="ghost"
      size="icon"
      title={`Switch to ${activeTheme === 'dark' ? 'Light' : 'Dark'} theme`}
      aria-label={`Current theme: ${activeTheme}. Click to switch to ${
        activeTheme === 'dark' ? 'light' : 'dark'
      }`}
    >
      {activeTheme === 'dark' ? (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
          {/* Moon icon for night theme */}
          <path
            d="M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9c1.76 0 3.4-.51 4.79-1.38.19-.12.23-.38.09-.56-.45-.58-.71-1.3-.71-2.06 0-1.85 1.5-3.35 3.35-3.35.76 0 1.48.26 2.06.71.18.14.44.1.56-.09C20.49 15.4 21 13.76 21 12c0-4.97-4.03-9-9-9z"
            fill="currentColor"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
          {/* Bat icon for day theme */}
          <path
            d="M12 3c-1.5 0-3 .5-4 1.5C7 3.5 5.5 3 4 3c-1 0-2 .5-2 1.5 0 .5.2 1 .5 1.3-.3.5-.5 1.1-.5 1.7 0 1.5 1 2.5 2.5 3 .5.2 1 .3 1.5.3.5 0 1-.1 1.5-.3.3.7.8 1.3 1.5 1.7V18c0 1.7 1.3 3 3 3s3-1.3 3-3v-5.8c.7-.4 1.2-1 1.5-1.7.5.2 1 .3 1.5.3s1-.1 1.5-.3c1.5-.5 2.5-1.5 2.5-3 0-.6-.2-1.2-.5-1.7.3-.3.5-.8.5-1.3 0-1-1-1.5-2-1.5-1.5 0-3 .5-4 1.5C15 3.5 13.5 3 12 3z"
            fill="currentColor"
          />
        </svg>
      )}
    </Button>
  );
};
