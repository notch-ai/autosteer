import { createContext, useContext, useEffect, useRef, ReactNode } from 'react';

// Error patterns to suppress during visual testing
const ERROR_PATTERNS_TO_SUPPRESS = [
  'Warning: validateDOMNesting',
  'Warning: React does not recognize',
  "Failed to execute 'removeChild'",
  "Failed to execute 'insertBefore'",
  'Cannot read properties of null',
  'Application Error',
];

interface ErrorSuppressionContextType {
  isSuppressionActive: boolean;
  suppressedErrorCount: number;
}

const ErrorSuppressionContext = createContext<ErrorSuppressionContextType>({
  isSuppressionActive: false,
  suppressedErrorCount: 0,
});

interface ErrorSuppressionProviderProps {
  children: ReactNode;
}

export function ErrorSuppressionProvider({ children }: ErrorSuppressionProviderProps) {
  const originalConsoleError = useRef<typeof console.error>();
  const suppressedErrorCount = useRef(0);
  const isVisualTestMode = (window as any).electron?.env?.VISUAL_TEST_MODE === 'true';

  useEffect(() => {
    if (!isVisualTestMode) {
      return () => {}; // Return empty cleanup function
    }

    // Store original console.error
    originalConsoleError.current = console.error;

    // Create filtered console.error
    console.error = (...args: any[]) => {
      const errorMessage = args.join(' ');

      // Check if error should be suppressed
      const shouldSuppress = ERROR_PATTERNS_TO_SUPPRESS.some((pattern) =>
        errorMessage.includes(pattern)
      );

      if (shouldSuppress) {
        suppressedErrorCount.current++;

        // Log to debug channel if needed (can be enabled via env var)
        if ((window as any).electron?.env?.DEBUG_SUPPRESSED_ERRORS === 'true') {
          console.debug('[SUPPRESSED ERROR]', ...args);
        }

        return;
      }

      // Allow non-suppressed errors through
      if (originalConsoleError.current) {
        originalConsoleError.current(...args);
      }
    };

    // Cleanup function
    return () => {
      if (originalConsoleError.current) {
        console.error = originalConsoleError.current;
      }
    };
  }, [isVisualTestMode]);

  const contextValue: ErrorSuppressionContextType = {
    isSuppressionActive: isVisualTestMode,
    suppressedErrorCount: suppressedErrorCount.current,
  };

  return (
    <ErrorSuppressionContext.Provider value={contextValue}>
      {children}
    </ErrorSuppressionContext.Provider>
  );
}

export function useErrorSuppression(): ErrorSuppressionContextType {
  const context = useContext(ErrorSuppressionContext);

  if (!context) {
    throw new Error('useErrorSuppression must be used within an ErrorSuppressionProvider');
  }

  return context;
}

// Hook for manual error suppression control (useful for specific test cases)
export function useManualErrorSuppression() {
  const originalConsoleError = useRef<typeof console.error>();
  const suppressedCount = useRef(0);
  const isActive = useRef(false);

  const startSuppression = () => {
    if (isActive.current) return;

    originalConsoleError.current = console.error;
    isActive.current = true;
    suppressedCount.current = 0;

    console.error = (...args: any[]) => {
      const errorMessage = args.join(' ');

      const shouldSuppress = ERROR_PATTERNS_TO_SUPPRESS.some((pattern) =>
        errorMessage.includes(pattern)
      );

      if (shouldSuppress) {
        suppressedCount.current++;

        if ((window as any).electron?.env?.DEBUG_SUPPRESSED_ERRORS === 'true') {
          console.debug('[MANUALLY SUPPRESSED ERROR]', ...args);
        }

        return;
      }

      if (originalConsoleError.current) {
        originalConsoleError.current(...args);
      }
    };
  };

  const stopSuppression = () => {
    if (!isActive.current) return;

    if (originalConsoleError.current) {
      console.error = originalConsoleError.current;
    }

    isActive.current = false;
  };

  const getSuppressedCount = () => suppressedCount.current;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSuppression();
    };
  }, []);

  return {
    startSuppression,
    stopSuppression,
    getSuppressedCount,
    isActive: isActive.current,
  };
}

// Utility component for wrapping test components with error suppression
interface ErrorSuppressedTestWrapperProps {
  children: ReactNode;
  suppressionEnabled?: boolean;
}

export function ErrorSuppressedTestWrapper({
  children,
  suppressionEnabled = true,
}: ErrorSuppressedTestWrapperProps) {
  if (!suppressionEnabled || (window as any).electron?.env?.VISUAL_TEST_MODE !== 'true') {
    return <>{children}</>;
  }

  return <ErrorSuppressionProvider>{children}</ErrorSuppressionProvider>;
}

// Debug component to show suppression stats (useful for development)
export function ErrorSuppressionDebugInfo() {
  const { isSuppressionActive, suppressedErrorCount } = useErrorSuppression();

  if ((window as any).electron?.env?.NODE_ENV === 'production' || !isSuppressionActive) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 10,
        right: 10,
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        fontFamily: 'monospace',
        zIndex: 9999,
      }}
    >
      Error Suppression Active
      <br />
      Suppressed: {suppressedErrorCount}
    </div>
  );
}
