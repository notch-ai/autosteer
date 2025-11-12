import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ErrorBoundary } from '@/features/shared/components/ui/ErrorBoundary';
import { toast } from 'sonner';

// Mock logger to prevent console output during tests
jest.mock('@/commons/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
  },
}));

// Test component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  // Clear mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error for expected errors in tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Error Boundary catches rendering errors in component tree', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // Should display error UI
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('Error toast displays with clear error message', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // Toast should be called with error details
    expect(toast.error).toHaveBeenCalledWith(
      'Application Error',
      expect.objectContaining({
        description: 'Test error message',
        duration: 10000,
      })
    );
  });

  it('Bogus message triggers error boundary successfully', () => {
    const BogusComponent = () => {
      throw new Error('Bogus error');
    };

    render(
      <ErrorBoundary>
        <BogusComponent />
      </ErrorBoundary>
    );

    // Error boundary should catch and display the error
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Bogus error')).toBeInTheDocument();
  });

  it('Error boundary properly resets after error displayed', async () => {
    const user = userEvent.setup();

    // Use a component that can toggle throwing errors
    const ToggleErrorComponent = ({ throwError }: { throwError: boolean }) => {
      if (throwError) {
        throw new Error('Test error message');
      }
      return <div>No error</div>;
    };

    // Start with error state
    const { rerender } = render(
      <ErrorBoundary>
        <ToggleErrorComponent throwError={true} />
      </ErrorBoundary>
    );

    // Verify error is displayed
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Rerender with non-throwing component FIRST
    rerender(
      <ErrorBoundary>
        <ToggleErrorComponent throwError={false} />
      </ErrorBoundary>
    );

    // Click "Try Again" button to reset error boundary state
    const tryAgainButton = screen.getByRole('button', { name: /try again/i });
    await user.click(tryAgainButton);

    // After reset, should display the normal content
    expect(screen.getByText('No error')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Child component</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Child component')).toBeInTheDocument();
  });

  it('renders custom fallback UI when provided', () => {
    const customFallback = <div>Custom error UI</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error UI')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('displays reload page button', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const reloadButton = screen.getByRole('button', { name: /reload page/i });
    expect(reloadButton).toBeInTheDocument();
  });

  it('displays error stack in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // In development, component stack should be visible
    const stackTrace = screen.getByText(/at ThrowError/i, { exact: false });
    expect(stackTrace).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });
});
