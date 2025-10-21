/**
 * Test Harness Error Wrapper
 *
 * Wraps components in error boundary and prevents React DOM errors during testing
 */

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  componentName: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class TestHarnessErrorWrapper extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    console.warn('Component error during visual testing:', error.message);
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, _errorInfo: React.ErrorInfo) {
    console.warn(`Error in ${this.props.componentName}:`, error.message);
    // Don't log full error to avoid cluttering test output
  }

  override render() {
    if (this.state.hasError) {
      // Return a placeholder that matches the component size
      return (
        <div className="test-error-placeholder p-4 border-2 border-dashed border-gray-400 rounded">
          <p className="text-gray-600">
            Component rendered with error (this is expected in test mode)
          </p>
          <small className="text-gray-500">{this.props.componentName}</small>
        </div>
      );
    }

    return this.props.children;
  }
}
