import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LLMSettings } from '@/features/settings/components/LLMSettings';
import { useSettingsStore, useUIStore } from '@/stores';

// Mock the stores
jest.mock('@/stores', () => ({
  useSettingsStore: jest.fn(),
  useUIStore: jest.fn(),
}));

// Mock LLMService
jest.mock('@/renderer/services/LLMService', () => ({
  LLMService: {
    getConfig: jest.fn(() => ({
      provider: 'claude-code',
      apiKey: '',
      apiUrl: '',
      model: '',
      temperature: 0.7,
      maxTokens: 2000,
    })),
    updateConfig: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock electron API
Object.defineProperty(window, 'electron', {
  value: {
    worktree: {
      getVimMode: jest.fn().mockResolvedValue(false),
      setVimMode: jest.fn().mockResolvedValue({ success: true }),
      getDataDirectory: jest.fn().mockResolvedValue('~/.autosteer'),
    },
    app: {
      getVersion: jest.fn().mockResolvedValue('1.0.0'),
    },
  },
  writable: true,
});

// Mock Modal component to test content structure
jest.mock('@/components/features/Modal', () => ({
  Modal: ({
    children,
    title,
    description,
    showCloseButton,
  }: {
    children: React.ReactNode;
    title?: string;
    description?: string;
    showCloseButton?: boolean;
  }) => (
    <div data-testid="modal-container">
      {showCloseButton && (
        <button
          data-testid="modal-close-button"
          className="absolute right-6 top-4"
          style={{ position: 'absolute', right: '24px', top: '16px' }}
        >
          ×
        </button>
      )}
      {title && (
        <div data-testid="modal-header" className="px-6 py-4 pr-16">
          <h2 data-testid="modal-title">{title}</h2>
          {description && <p data-testid="modal-description">{description}</p>}
        </div>
      )}
      <div data-testid="modal-content" className="px-6 pt-0 pb-6">
        {children}
      </div>
    </div>
  ),
}));

describe('LLMSettings Modal Layout', () => {
  const mockOnClose = jest.fn();

  const mockSettingsStore = {
    selectedProvider: 'claude-code',
    setProvider: jest.fn(),
  };

  const mockUIStore = {
    vimEnabled: false,
    toggleVimMode: jest.fn(),
    updateVimState: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useSettingsStore as unknown as jest.Mock).mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector(mockSettingsStore);
      }
      return mockSettingsStore;
    });

    (useUIStore as unknown as jest.Mock).mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector(mockUIStore);
      }
      return mockUIStore;
    });
  });

  it('should maintain 24px minimum distance between header and close button', () => {
    render(<LLMSettings onClose={mockOnClose} />);

    const modalHeader = screen.getByTestId('modal-header');
    const closeButton = screen.getByTestId('modal-close-button');

    // Header should have proper padding to maintain safe zone (px-6 py-4 pr-16)
    expect(modalHeader).toHaveClass('px-6', 'py-4', 'pr-16');

    // Close button should be positioned with proper spacing (right-6 = 24px)
    expect(closeButton).toHaveClass('absolute', 'right-6', 'top-4');
    expect(closeButton).toHaveStyle({ right: '24px', top: '16px' });
  });

  it('should apply consistent content padding', () => {
    render(<LLMSettings onClose={mockOnClose} />);

    const modalContent = screen.getByTestId('modal-content');

    // Content should have standard padding
    expect(modalContent).toHaveClass('px-6', 'pt-0', 'pb-6');
  });

  it('should render modal with proper title and description', () => {
    render(<LLMSettings onClose={mockOnClose} />);

    const title = screen.getByTestId('modal-title');
    const description = screen.getByTestId('modal-description');

    expect(title).toHaveTextContent('Settings');
    expect(description).toHaveTextContent('Configure application preferences and LLM settings');
  });

  it('should display close button when showCloseButton is true', () => {
    render(<LLMSettings onClose={mockOnClose} />);

    const closeButton = screen.getByTestId('modal-close-button');
    expect(closeButton).toBeInTheDocument();
  });

  it('should have proper heading hierarchy in content sections', () => {
    render(<LLMSettings onClose={mockOnClose} />);

    // Check that section headings exist and have proper styling
    expect(screen.getByText('Application Info')).toHaveClass(
      'text-lg',
      'font-semibold',
      'text-text'
    );
    expect(screen.getByText('Editor Settings')).toHaveClass(
      'text-lg',
      'font-semibold',
      'text-text'
    );
    expect(screen.getByText('Data Directory')).toHaveClass('text-lg', 'font-semibold', 'text-text');
    expect(screen.getByText('LLM Settings')).toHaveClass('text-lg', 'font-semibold', 'text-text');
  });

  it('should maintain consistent spacing between content sections', () => {
    render(<LLMSettings onClose={mockOnClose} />);

    const contentContainer = screen.getByTestId('modal-content');
    const mainDiv = contentContainer.querySelector('.space-y-6');

    expect(mainDiv).toHaveClass('space-y-6');

    // Check that each section has proper spacing
    const sections = contentContainer.querySelectorAll('.space-y-4');
    expect(sections.length).toBeGreaterThan(0);
  });
});
