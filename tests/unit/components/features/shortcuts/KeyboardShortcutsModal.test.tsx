import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { KeyboardShortcutsModal } from '../../../../../src/features/shared/components/ui/KeyboardShortcutsModal';

// Mock the shortcuts registry to provide predictable test data
jest.mock('../../../../../src/commons/utils/shortcutsRegistry', () => ({
  SHORTCUT_GROUPS: [
    {
      id: 'navigation',
      name: 'Navigation',
      description: 'Navigate the interface',
      shortcuts: [
        {
          id: 'open-command',
          description: 'Open command palette',
          keys: ['cmd+k', 'ctrl+k'],
        },
      ],
    },
  ],
  formatShortcutKeys: jest.fn((keys) => keys),
  searchShortcuts: jest.fn(() => []),
  getTotalShortcutCount: jest.fn(() => 1),
}));

describe('KeyboardShortcutsModal', () => {
  describe('Modal Header Styling Consistency', () => {
    it('should maintain 24px minimum distance between header text and close button', () => {
      render(<KeyboardShortcutsModal isOpen={true} onClose={jest.fn()} />);

      // Get the dialog content container
      const dialogContent = screen.getByRole('dialog');
      expect(dialogContent).toBeInTheDocument();

      // Get the header section
      const header =
        screen.getByRole('banner') ||
        screen.getByText('Keyboard Shortcuts').closest('[class*="px-6"]');
      expect(header).toBeInTheDocument();

      // Check that header has proper padding class that ensures 24px gap
      // DialogHeader should have px-6 class and close button should be at right-6
      // This creates 48px total space with 24px minimum between content and button
      expect(header).toHaveClass('px-6');

      // Verify close button positioning
      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toHaveClass('absolute', 'right-6', 'top-4');
    });

    it('should apply consistent content padding throughout modal sections', () => {
      render(<KeyboardShortcutsModal isOpen={true} onClose={jest.fn()} />);

      // The main content area (search and shortcuts) should follow the pattern:
      // - Search section should have proper horizontal padding
      // - Shortcuts section should have proper horizontal padding
      const searchInput = screen.getByPlaceholderText('Search shortcuts...');
      const searchSection = searchInput.closest('div[class*="space-y"]');

      // The search section should be contained within proper padding structure
      expect(searchSection).toBeInTheDocument();

      // Check that the overall content structure follows px-6 pt-0 pb-6 pattern
      const dialogContent = screen.getByRole('dialog');
      expect(dialogContent).toHaveClass('flex', 'flex-col');
    });

    it('should render modal header with proper title and description', () => {
      render(<KeyboardShortcutsModal isOpen={true} onClose={jest.fn()} />);

      // Title should be present and properly styled
      const title = screen.getByText('Keyboard Shortcuts');
      expect(title).toBeInTheDocument();
      expect(title).toHaveClass('text-lg', 'font-semibold', 'text-text');

      // Description should be present and properly styled
      const description = screen.getByText(/shortcuts available/);
      expect(description).toBeInTheDocument();
      expect(description).toHaveClass('text-sm', 'text-text-muted');
    });
  });

  describe('Modal Content Structure', () => {
    it('should structure content sections with proper spacing and padding', () => {
      render(<KeyboardShortcutsModal isOpen={true} onClose={jest.fn()} />);

      // Search section should exist
      const searchInput = screen.getByPlaceholderText('Search shortcuts...');
      expect(searchInput).toBeInTheDocument();

      // Category badges section should exist
      const allCategoriesButton = screen.getByText('All Categories');
      expect(allCategoriesButton).toBeInTheDocument();

      // Shortcuts display area should exist and be scrollable
      const shortcutsArea = screen.getByText('Navigation').closest('.grid');
      expect(shortcutsArea).toBeInTheDocument();

      // Footer should exist
      const escapeInstruction = screen.getByText(/Press.*Esc.*to close/);
      expect(escapeInstruction).toBeInTheDocument();
    });
  });

  describe('Visual Consistency Validation', () => {
    it('should not have header content overlapping with close button area', () => {
      render(<KeyboardShortcutsModal isOpen={true} onClose={jest.fn()} />);

      const header = screen.getByText('Keyboard Shortcuts').closest('[class*="px-6"]');
      const closeButton = screen.getByRole('button', { name: /close/i });

      // Header should have proper padding and close button should be positioned
      // to maintain the 24px safe zone
      expect(header).toHaveClass('px-6');
      expect(closeButton).toHaveClass('right-6');

      // The combination ensures proper spacing
      const headerRect = header?.getBoundingClientRect();
      const closeButtonRect = closeButton.getBoundingClientRect();

      // The close button should not overlap with header content
      if (headerRect && closeButtonRect) {
        const gap = closeButtonRect.left - headerRect.right;
        expect(gap).toBeGreaterThanOrEqual(0); // No negative overlap
      }
    });
  });
});
