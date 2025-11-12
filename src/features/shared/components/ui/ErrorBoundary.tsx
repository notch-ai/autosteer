import { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '@/commons/utils/logger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Feature component for ErrorBoundary
 * Uses UI components for consistent styling
 * Provides error recovery and reporting functionality
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Error caught by boundary:', error, errorInfo);
    this.setState({ error, errorInfo });

    // Show error toast notification
    toast.error('Application Error', {
      description: error.message || 'An unexpected error occurred',
      duration: 10000, // 10 seconds
      action: {
        label: 'Dismiss',
        onClick: () => {
          // Toast will auto-dismiss
        },
      },
    });
  }

  isDevelopment = (): boolean => {
    // Check process.env (works in both Node and Vite)
    return typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });

    // Clear chatError from store if it exists
    try {
      // @ts-expect-error - Access global store for emergency cleanup
      if (window.useChatStore) {
        // @ts-expect-error - Dynamic state update for cleanup
        window.useChatStore.setState({ chatError: null });
      }
    } catch (err) {
      // Ignore cleanup errors
    }
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <CardTitle className="text-danger">Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertDescription>
                  {this.state.error?.message || 'An unexpected error occurred'}
                </AlertDescription>
              </Alert>

              {this.isDevelopment() && this.state.errorInfo && (
                <div className="bg-surface p-4 rounded-md overflow-auto max-h-64">
                  <pre className="text-sm text-text-muted">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={this.handleReset} variant="default">
                  Try Again
                </Button>
                <Button onClick={() => window.location.reload()} variant="outline">
                  Reload Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
