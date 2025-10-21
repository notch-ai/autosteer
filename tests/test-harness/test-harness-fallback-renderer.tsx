/**
 * Fallback Component Renderer for Visual Testing
 *
 * Provides graceful fallbacks when components fail to load or render
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

export class FallbackComponentRenderer extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, _errorInfo: React.ErrorInfo) {
    console.warn(`Fallback renderer activated for ${this.props.componentName}:`, error.message);
  }

  override render() {
    if (this.state.hasError) {
      // Return a clean fallback UI that maintains dimensions
      return (
        <div className="fallback-component-container min-h-[200px] w-full flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg">
          <div className="text-center p-8">
            <div className="text-gray-600 text-lg font-medium mb-2">
              Component: {this.props.componentName}
            </div>
            <div className="text-gray-400 text-sm">Fallback render</div>
            <div className="mt-4 w-16 h-16 mx-auto border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
              <div className="w-6 h-6 bg-gray-300 rounded"></div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component that wraps components with fallback rendering
 */
export const withFallbackRenderer = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string
) => {
  const ComponentWithFallback = (props: P) => (
    <FallbackComponentRenderer componentName={componentName}>
      <WrappedComponent {...props} />
    </FallbackComponentRenderer>
  );

  ComponentWithFallback.displayName = `withFallbackRenderer(${componentName})`;
  return ComponentWithFallback;
};

/**
 * Suspense fallback component for loading states
 */
export const LoadingFallback: React.FC<{ componentName?: string }> = ({
  componentName = 'Component',
}) => (
  <div className="loading-fallback min-h-[200px] w-full flex items-center justify-center bg-gray-50 border border-gray-100 rounded-lg">
    <div className="text-center p-8">
      <div className="animate-pulse">
        <div className="w-16 h-16 mx-auto bg-gray-200 rounded-lg mb-4"></div>
        <div className="text-gray-500 text-sm">Loading {componentName}...</div>
      </div>
    </div>
  </div>
);
