import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { App } from '@/views/App';
import { useUIStore } from '@/stores';
import { useAppStore } from '@/stores/useAppStore';

// Mock the stores
jest.mock('@/stores', () => ({
  useUIStore: Object.assign(jest.fn(), {
    getState: jest.fn(() => ({
      vimEnabled: false,
      toggleVimMode: jest.fn(),
      updateVimState: jest.fn(),
    })),
  }),
}));

jest.mock('@/stores/useAppStore', () => ({
  useAppStore: jest.fn(),
}));

// Mock other dependencies
jest.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/projects/AddProjectModal', () => ({
  AddProjectModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="add-project-modal">
      <button onClick={onClose} data-testid="close-modal">
        Close Modal
      </button>
    </div>
  ),
}));

jest.mock('@/components/ThreeColumnLayout', () => ({
  ThreeColumnLayout: () => <div data-testid="three-column-layout">Layout</div>,
}));

jest.mock('@/commons/contexts/ElectronContext', () => ({
  ElectronProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/commons/contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ToastProvider', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useToast: jest.fn(() => ({
    showToast: jest.fn(),
  })),
}));

// Mock electron API
Object.defineProperty(window, 'electron', {
  value: {
    ipcRenderer: {
      invoke: jest.fn(),
    },
    worktree: {
      getVimMode: jest.fn().mockResolvedValue(false),
      setVimMode: jest.fn().mockResolvedValue({ success: true }),
      getDataDirectory: jest.fn().mockResolvedValue('~/.autosteer'),
    },
    app: {
      getVersion: jest.fn().mockResolvedValue('1.0.0'),
    },
    update: {
      onUpdateAvailable: jest.fn(),
      onUpdateDownloaded: jest.fn(),
      onDownloadProgress: jest.fn(),
      onUpdateError: jest.fn(),
      onUpdateNotAvailable: jest.fn(),
      checkForUpdates: jest.fn(),
      downloadUpdate: jest.fn(),
      installUpdate: jest.fn(),
      check: jest.fn(),
      download: jest.fn(),
      install: jest.fn(),
    },
  },
  writable: true,
});

// Mock LLMService
jest.mock('@/renderer/services/LLMService', () => ({
  LLMService: {
    initialize: jest.fn().mockResolvedValue(true),
    getConfig: jest.fn().mockReturnValue({
      provider: 'claude-code',
      apiKey: '',
      apiUrl: '',
      model: '',
      temperature: 0.7,
      maxTokens: 2000,
    }),
  },
}));

describe('App Component - Create Worktree Modal Integration', () => {
  const mockSetShowProjectCreation = jest.fn();
  const mockUIStore = {
    showProjectCreation: false,
    setShowProjectCreation: mockSetShowProjectCreation,
  };

  const mockAppStore = {
    showProjectCreation: false,
    setShowProjectCreation: jest.fn(),
    loadProjects: jest.fn(),
    loadAgents: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useUIStore as unknown as jest.Mock).mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector(mockUIStore);
      }
      return mockUIStore;
    });

    (useAppStore as unknown as jest.Mock).mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector(mockAppStore);
      }
      return mockAppStore;
    });

    // Mock getState for useAppStore
    (useAppStore as any).getState = jest.fn().mockReturnValue(mockAppStore);
  });

  it('should show modal when UIStore.showProjectCreation is true', async () => {
    // Arrange - Set UIStore to show modal
    mockUIStore.showProjectCreation = true;

    // Act
    render(<App />);

    // Assert - Modal should be visible
    await waitFor(() => {
      expect(screen.getByTestId('add-project-modal')).toBeInTheDocument();
    });
  });

  it('should hide modal when UIStore.showProjectCreation is false', async () => {
    // Arrange - Set UIStore to hide modal
    mockUIStore.showProjectCreation = false;

    // Act
    render(<App />);

    // Assert - Modal should not be visible
    await waitFor(() => {
      expect(screen.queryByTestId('add-project-modal')).not.toBeInTheDocument();
    });
  });

  it('should close modal when onClose is called using UIStore', async () => {
    // Arrange - Start with modal open
    mockUIStore.showProjectCreation = true;

    render(<App />);

    // Act - Click close button
    const closeButton = await screen.findByTestId('close-modal');
    fireEvent.click(closeButton);

    // Assert - UIStore setShowProjectCreation should be called with false
    expect(mockSetShowProjectCreation).toHaveBeenCalledWith(false);
  });

  it('should NOT use useAppStore for showProjectCreation state', () => {
    // Arrange & Act
    render(<App />);

    // Assert - App should not read showProjectCreation from useAppStore
    // This test will fail initially, proving we need to fix the store reference
    expect(useUIStore).toHaveBeenCalledWith(
      expect.any(Function) // Any selector function
    );

    // Verify useAppStore is not used for showProjectCreation
    const appStoreCalls = (useAppStore as unknown as jest.Mock).mock.calls;
    const showProjectCreationCalls = appStoreCalls.filter(([selector]) => {
      if (typeof selector === 'function') {
        // Create a mock state to test the selector
        const mockState = { showProjectCreation: true };
        try {
          const result = selector(mockState);
          return result === true; // If selector returns showProjectCreation value
        } catch {
          return false;
        }
      }
      return false;
    });

    // This assertion will fail initially, indicating the bug exists
    expect(showProjectCreationCalls.length).toBe(0);
  });
});
