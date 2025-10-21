/**
 * Test Harness Component for Visual Testing
 *
 * Displays components in isolation when in test mode.
 * Listens for IPC messages to switch components and themes.
 */

import React, { useEffect, useState, Suspense, lazy } from 'react';
import './test-harness.css';

// Import all components from central export
import { ALL_COMPONENTS } from '@/components';
import { TestHarnessPortalContainer } from './test-harness-portal-container';
import { SilentErrorBoundary } from './test-harness-silent-boundary';
import { MockStoreProvider } from './test-harness-mock-store';
import { ErrorSuppressionProvider } from './test-harness-error-suppression';

// Create dynamic component registry from the central export
const createComponentRegistry = () => {
  const registry: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {};

  // Create lazy imports for all components
  ALL_COMPONENTS.forEach((componentName) => {
    registry[componentName] = lazy(() =>
      import('@/components').then((module) => ({
        default: module[componentName as keyof typeof module] as React.ComponentType<any>,
      }))
    );
  });

  return registry;
};

const componentRegistry = createComponentRegistry();

interface TestHarnessState {
  currentComponent: string | null;
  componentProps: any;
  testThemeVariant: 'day' | 'night';
}

const TestHarness: React.FC = () => {
  const [state, setState] = useState<TestHarnessState>({
    currentComponent: null,
    componentProps: {},
    testThemeVariant: 'day',
  });

  useEffect(() => {
    // Check if we're in test mode
    const isElectron = !!(window as any).electron;
    if (!isElectron) return () => {}; // Return empty cleanup function

    const electron = (window as any).electron;

    // Listen for component changes from main process
    const handleComponentChange = (_event: any, data: { component: string; props: any }) => {
      console.log('Test harness: Component changed to', data.component, data.props);
      setState((prev) => ({
        ...prev,
        currentComponent: data.component,
        componentProps: data.props || {},
      }));
    };

    // Listen for theme changes from main process
    const handleThemeChange = (_event: any, themeVariant: 'day' | 'night') => {
      console.log('Test harness: Theme changed to', themeVariant);
      setState((prev) => ({
        ...prev,
        testThemeVariant: themeVariant,
      }));

      // Apply theme immediately
      console.log('Applying theme:', themeVariant);
      if (themeVariant === 'day') {
        document.documentElement.classList.add('theme-day');
      } else {
        document.documentElement.classList.remove('theme-day');
      }
    };

    // Listen for reset
    const handleReset = () => {
      console.log('Test harness: Reset');
      setState({
        currentComponent: null,
        componentProps: {},
        testThemeVariant: 'day',
      });
    };

    // Register IPC listeners
    electron.ipcRenderer.on('test-mode:component-changed', handleComponentChange);
    electron.ipcRenderer.on('test-mode:theme-changed', handleThemeChange);
    electron.ipcRenderer.on('test-mode:reset', handleReset);

    // Get initial state
    electron.ipcRenderer
      .invoke('test-mode:getState')
      .then((initialState: any) => {
        if (initialState.isActive) {
          setState({
            currentComponent: initialState.currentComponent,
            componentProps: initialState.componentProps || {},
            testThemeVariant: initialState.themeVariant || 'day',
          });

          // Apply initial theme
          if (initialState.themeVariant) {
            console.log('Initial theme:', initialState.themeVariant);
            if (initialState.themeVariant === 'day') {
              document.documentElement.classList.add('theme-day');
            } else {
              document.documentElement.classList.remove('theme-day');
            }
          }
        }
      })
      .catch((error: any) => {
        console.warn('Failed to get initial test mode state:', error);
      });

    // Cleanup listeners
    return () => {
      electron.ipcRenderer.removeListener('test-mode:component-changed', handleComponentChange);
      electron.ipcRenderer.removeListener('test-mode:theme-changed', handleThemeChange);
      electron.ipcRenderer.removeListener('test-mode:reset', handleReset);
    };
  }, []);

  // If no component is selected, show placeholder
  if (!state.currentComponent) {
    return (
      <div className="test-harness-container">
        <div className="test-harness-placeholder">
          <h2>Visual Test Mode</h2>
          <p>Waiting for component selection...</p>
          <p>Current theme: {state.testThemeVariant}</p>
        </div>
      </div>
    );
  }

  // Get the component from registry
  const ComponentToRender = state.currentComponent
    ? componentRegistry[state.currentComponent]
    : null;

  if (!ComponentToRender) {
    return (
      <div className="test-harness-container">
        <div className="test-harness-error">
          <h2>Component Not Found</h2>
          <p>Component "{state.currentComponent}" is not registered in the test harness.</p>
          <p>Available components:</p>
          <ul>
            {Object.keys(componentRegistry).map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <>
      <TestHarnessPortalContainer />
      <div className="test-harness-container">
        <div className="test-harness-component">
          <ErrorSuppressionProvider>
            <MockStoreProvider>
              <SilentErrorBoundary>
                <Suspense
                  fallback={<div className="test-harness-loading">Loading component...</div>}
                >
                  <ComponentToRender {...state.componentProps} />
                </Suspense>
              </SilentErrorBoundary>
            </MockStoreProvider>
          </ErrorSuppressionProvider>
        </div>
        <div className="test-harness-info">
          <small>
            Component: {state.currentComponent} | Theme: {state.testThemeVariant}
          </small>
        </div>
      </div>
    </>
  );
};

export default TestHarness;
