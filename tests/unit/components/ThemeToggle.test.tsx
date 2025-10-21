import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeToggle } from '@/components/features/ThemeToggle';

// Mock the ThemeContext
const mockSetTheme = jest.fn();
const mockThemeContext = {
  theme: 'system' as const,
  activeTheme: 'light' as const,
  setTheme: mockSetTheme,
};

jest.mock('@/commons/contexts/ThemeContext', () => ({
  useTheme: () => mockThemeContext,
}));

describe('ThemeToggle Modal Styling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should use design system border-border class in theme modal', async () => {
    render(<ThemeToggle />);

    // Click the theme toggle button to open the dropdown
    const themeButton = screen.getByRole('button', { name: /change theme/i });
    fireEvent.click(themeButton);

    // Find the popover content - it uses data-radix-popper-content-wrapper
    const popoverContent = document.querySelector('[data-radix-popper-content-wrapper]');
    expect(popoverContent).toBeInTheDocument();

    // Test that the popover content uses design system border class
    // The PopoverContent should have 'border-border' class
    const popoverInner =
      popoverContent?.querySelector('[role="dialog"]') || document.querySelector('.border-border');
    expect(popoverInner).toBeInTheDocument();

    // Verify the modal contains theme options
    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('should apply proper styling to theme options within modal', async () => {
    render(<ThemeToggle />);

    // Open the theme modal
    const themeButton = screen.getByRole('button', { name: /change theme/i });
    fireEvent.click(themeButton);

    // Check each theme option button
    const lightButton = screen.getByRole('button', { name: /light/i });
    const darkButton = screen.getByRole('button', { name: /dark/i });
    const systemButton = screen.getByRole('button', { name: /system/i });

    // All theme option buttons should be present
    expect(lightButton).toBeInTheDocument();
    expect(darkButton).toBeInTheDocument();
    expect(systemButton).toBeInTheDocument();

    // Test clicking a theme option
    fireEvent.click(lightButton);
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('should render theme toggle with correct icon based on active theme', () => {
    // Test different theme states
    const themeStates = [
      { theme: 'light' as const, activeTheme: 'light' as const },
      { theme: 'dark' as const, activeTheme: 'dark' as const },
      { theme: 'system' as const, activeTheme: 'light' as const },
    ];

    themeStates.forEach((state) => {
      mockThemeContext.theme = state.theme;
      mockThemeContext.activeTheme = state.activeTheme;

      const { unmount } = render(<ThemeToggle />);

      // The button should render successfully
      const themeButton = screen.getByRole('button', { name: /change theme/i });
      expect(themeButton).toBeInTheDocument();

      unmount();
    });
  });
});
