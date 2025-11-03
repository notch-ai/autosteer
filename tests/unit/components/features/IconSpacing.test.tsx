import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeToggle } from '@/features/settings/components/ThemeToggle';

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

describe('Phase 2: Icon Spacing in Settings (TV/Computer Icon)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display System option with computer icon in dropdown', () => {
    render(<ThemeToggle />);

    // Click the theme toggle button to open dropdown
    const themeButton = screen.getByRole('button', { name: /change theme/i });
    fireEvent.click(themeButton);

    // Find the System option with computer icon
    const systemOption = screen.getByText('System');
    expect(systemOption).toBeInTheDocument();

    // Get the parent button that contains both icon and text
    const systemButton = systemOption.closest('button');
    expect(systemButton).toBeInTheDocument();

    // Check that both icon and text are present
    const computerIcon = systemButton?.querySelector('svg');
    expect(computerIcon).toBeInTheDocument();
    expect(systemOption).toBeInTheDocument();
  });

  it('should have 8-12px spacing between TV/computer icon and System text', () => {
    render(<ThemeToggle />);

    // Click to open dropdown
    const themeButton = screen.getByRole('button', { name: /change theme/i });
    fireEvent.click(themeButton);

    // Find the System option button
    const systemOption = screen.getByText('System');
    const systemButton = systemOption.closest('button');
    expect(systemButton).toBeInTheDocument();

    // Check spacing between icon and text
    const icon = systemButton?.querySelector('svg');
    const text = systemButton?.querySelector('span');

    expect(icon).toBeInTheDocument();
    expect(text).toBeInTheDocument();

    // Should have proper spacing classes (ml-2 = 8px)
    if (systemButton) {
      expect(systemButton.className).toMatch(/ml-2|gap-2|space-x-2/);
    }
  });

  it('should maintain consistent icon spacing across all theme options', () => {
    render(<ThemeToggle />);

    const themeButton = screen.getByRole('button', { name: /change theme/i });
    fireEvent.click(themeButton);

    // Check all three options have consistent spacing
    const options = ['Light', 'Dark', 'System'];

    for (const optionText of options) {
      const option = screen.getByText(optionText);
      const button = option.closest('button');
      expect(button).toBeInTheDocument();

      const icon = button?.querySelector('svg');
      const text = button?.querySelector('span');

      expect(icon).toBeInTheDocument();
      expect(text).toBeInTheDocument();

      // All buttons should have the same spacing pattern
      if (button) {
        expect(button.className).toMatch(/ml-2|gap-2|space-x-2/);
      }
    }
  });

  it('should work across light and dark themes', () => {
    // Test light theme
    mockThemeContext.activeTheme = 'light';
    const { rerender } = render(<ThemeToggle />);

    const themeButton = screen.getByRole('button', { name: /change theme/i });
    fireEvent.click(themeButton);

    let systemOption = screen.getByText('System');
    let systemButton = systemOption.closest('button');
    expect(systemButton?.className).toMatch(/ml-2|gap-2|space-x-2/);

    // Close dropdown by clicking outside or pressing escape
    fireEvent.click(document.body);

    // Test dark theme
    mockThemeContext.activeTheme = 'dark';
    rerender(<ThemeToggle />);

    fireEvent.click(themeButton);
    systemOption = screen.getByText('System');
    systemButton = systemOption.closest('button');
    expect(systemButton?.className).toMatch(/ml-2|gap-2|space-x-2/);
  });
});
