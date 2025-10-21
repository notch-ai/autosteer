import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class SilentErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console for debugging but don't display UI
    console.error('SilentErrorBoundary caught error:', error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      // Return null to render nothing instead of error UI
      return null;
    }

    return this.props.children;
  }
}
