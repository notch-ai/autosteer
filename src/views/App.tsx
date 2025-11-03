import React, { useEffect, useState } from 'react';
import { ErrorBoundary } from '@/features/shared/components/ui/ErrorBoundary';
import { LLMSettings } from '@/features/settings/components/LLMSettings';
import { MenuBar } from '@/features/shared/components/layout/MenuBar';
import { ThreeColumnLayout } from '@/features/shared/components/layout/ThreeColumnLayout';
import { ToastProvider } from '@/features/shared';
import { UpdateNotification } from '@/features/shared';
import { AddProjectModal } from '@/features/shared/components/projects/AddProjectModal';
import { KeyboardShortcutsModal } from '@/features/shared/components/ui/KeyboardShortcutsModal';
import { ElectronProvider } from '@/commons/contexts/ElectronContext';
import { ThemeProvider } from '@/commons/contexts/ThemeContext';
import { LLMService } from '@/renderer/services/LLMService';
import { useUIStore } from '@/stores/ui';
import { useSlashCommandsStore } from '@/stores';
import { useSettingsStore } from '@/stores/settings';
import { logger } from '@/commons/utils/logger';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import TestHarness from '@/../tests/test-harness/test-harness';
import { ErrorSuppressionProvider } from '@/../tests/test-harness/test-harness-error-suppression';
import { SilentErrorBoundary } from '@/../tests/test-harness/test-harness-silent-boundary';
import { VisualComparisonTool } from './visual-comparison-tool';
import { VisualTestPage } from './visual-test-page';

const AppContent: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [showLLMSettings, setShowLLMSettings] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [showVisualTest, setShowVisualTest] = useState(false);
  const [showComparisonTool, setShowComparisonTool] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const showProjectCreation = useUIStore((state) => state.showProjectCreation);
  const setShowProjectCreation = useUIStore((state) => state.setShowProjectCreation);

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + / to show keyboard shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShowKeyboardShortcuts(true);
      }
      // Ctrl/Cmd + Shift + V to toggle visual test page
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        setShowVisualTest((prev) => !prev);
      }
      // Ctrl/Cmd + Shift + C to toggle comparison tool
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        setShowComparisonTool((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    // Initialize app
    const initializeApp = async () => {
      try {
        // Check if we're in test mode
        const isElectron = !!(window as any).electron;
        if (isElectron) {
          try {
            const testModeState = await (window as any).electron.ipcRenderer.invoke(
              'test-mode:getState'
            );
            if (testModeState.isActive) {
              setIsTestMode(true);
              setIsLoading(false);
              return; // Don't initialize normal app in test mode
            }
          } catch (error) {
            // Test mode not available, continue with normal initialization
          }
        }

        // Initialize IPC service (this sets up window.electron extensions)

        // Initialize settings store (loads from config.json)
        const { initialize: initializeSettings } = useSettingsStore.getState();
        await initializeSettings();

        // Sync selected model with default model from settings
        const defaultModel = useSettingsStore.getState().preferences.defaultModel;
        if (defaultModel) {
          const { setSelectedModel } = useUIStore.getState();
          setSelectedModel(defaultModel);
          logger.info('[App] Synced selected model with settings:', defaultModel);
        }

        // Initialize LLM service with saved config
        await LLMService.initialize();

        // Initialize VIM mode from saved config
        try {
          const savedVimMode = await window.electron.worktree.getVimMode();
          logger.debug('Loaded VIM mode from config:', savedVimMode);
          const { vimEnabled, toggleVimMode, updateVimState } = useUIStore.getState();
          logger.debug('Current UIStore vimEnabled:', vimEnabled);

          if (savedVimMode && !vimEnabled) {
            logger.debug('Enabling VIM mode in UIStore');
            toggleVimMode(); // Set to enabled
            updateVimState({ mode: 'NORMAL' });
          } else if (!savedVimMode && vimEnabled) {
            logger.debug('Disabling VIM mode in UIStore');
            toggleVimMode(); // Set to disabled
            updateVimState({ mode: 'INSERT' });
          } else if (!savedVimMode) {
            updateVimState({ mode: 'INSERT' });
          } else {
            updateVimState({ mode: 'NORMAL' });
          }
          logger.debug('Final UIStore vimEnabled:', useUIStore.getState().vimEnabled);
        } catch (error) {
          logger.error('Failed to load VIM mode:', error);
          // Fallback to localStorage
          const savedVimMode = localStorage.getItem('vimModeEnabled');
          if (savedVimMode === 'true') {
            const { toggleVimMode, updateVimState } = useUIStore.getState();
            toggleVimMode();
            updateVimState({ mode: 'NORMAL' });
          }
        }

        // Load initial data - projects first, then agents, then slash commands
        // Use new domain-specific stores instead of deprecated core.ts methods
        const { useProjectsStore } = await import('@/stores/projects.store');
        const { useAgentsStore } = await import('@/stores/agents.store');
        const projectsStore = useProjectsStore.getState();
        const agentsStore = useAgentsStore.getState();
        const { loadSlashCommands } = useSlashCommandsStore.getState();

        logger.info('[App] ========== APP INITIALIZATION START ==========');

        await projectsStore.loadProjects();
        logger.info('[App] Projects loaded:', projectsStore.projects.size);

        await agentsStore.loadAgents();
        logger.info('[App] Agents loaded:', agentsStore.agents.size);

        // Auto-select the first project if none is selected
        logger.info('[App] Current selectedProjectId:', projectsStore.selectedProjectId);
        if (!projectsStore.selectedProjectId && projectsStore.projects.size > 0) {
          const firstProject = Array.from(projectsStore.projects.values())[0];
          logger.info('[App] Auto-selecting first project:', firstProject.id);
          await projectsStore.selectProject(firstProject.id);
          logger.info('[App] Project selection completed');

          // Verify selection worked
          const afterSelect = useProjectsStore.getState();
          logger.info(
            '[App] selectedProjectId after selectProject:',
            afterSelect.selectedProjectId
          );
          const agentsAfter = useAgentsStore.getState();
          logger.info('[App] selectedAgentId after selectProject:', agentsAfter.selectedAgentId);
        } else {
          logger.warn('[App] Skipping project auto-select:', {
            hasSelectedProject: !!projectsStore.selectedProjectId,
            projectCount: projectsStore.projects.size,
          });
        }

        // Load slash commands for the selected project (or default if no project selected)
        await loadSlashCommands();

        logger.info('[App] ========== APP INITIALIZATION COMPLETE ==========');

        setIsLoading(false);
      } catch (error) {
        logger.error('Failed to initialize app:', error);
        setIsLoading(false);
      }
    };

    void initializeApp();
  }, []); // Empty dependency array - only run once

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <Card className="p-8 flex flex-col items-center justify-center">
          <h1 className="text-2xl font-bold text-text mb-4">Notch AI</h1>
          <div className="flex items-center gap-2 text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            <p className="text-sm">Loading...</p>
          </div>
        </Card>
      </div>
    );
  }

  // Render test harness in test mode
  if (isTestMode) {
    return <TestHarness />;
  }

  // Show visual test page if enabled
  if (showVisualTest) {
    return <VisualTestPage />;
  }

  // Show comparison tool if enabled
  if (showComparisonTool) {
    return <VisualComparisonTool />;
  }

  return (
    <>
      <div className="flex flex-col h-full">
        <MenuBar />
        <ThreeColumnLayout
          onOpenLLMSettings={() => setShowLLMSettings(true)}
          onOpenKeyboardShortcuts={() => setShowKeyboardShortcuts(true)}
        />
      </div>
      {showLLMSettings && <LLMSettings onClose={() => setShowLLMSettings(false)} />}
      {showProjectCreation && <AddProjectModal onClose={() => setShowProjectCreation(false)} />}
      <KeyboardShortcutsModal
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
      />
      <UpdateNotification />
    </>
  );
};

export const App: React.FC = () => {
  const [isVisualTestMode, setIsVisualTestMode] = useState(false);

  useEffect(() => {
    // Check if we're in visual test mode by asking the main process
    const checkTestMode = async () => {
      const isElectron = !!(window as any).electron;
      if (isElectron) {
        try {
          const testModeState = await (window as any).electron.ipcRenderer.invoke(
            'test-mode:getState'
          );
          setIsVisualTestMode(testModeState.isActive);
        } catch (error) {
          // Test mode not available, continue with normal mode
          setIsVisualTestMode(false);
        }
      }
    };

    void checkTestMode();
  }, []);

  // Use silent error boundary in visual test mode
  const ErrorBoundaryComponent = isVisualTestMode ? SilentErrorBoundary : ErrorBoundary;

  const fallbackUI = isVisualTestMode ? null : (
    <div>
      <h1>Application Error</h1>
      <p>Something went wrong with the application. Please try refreshing the page.</p>
      <button onClick={() => window.location.reload()}>Refresh Application</button>
    </div>
  );

  const content = (
    <ElectronProvider>
      <ThemeProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </ThemeProvider>
    </ElectronProvider>
  );

  // Wrap with error suppression in visual test mode
  const wrappedContent = isVisualTestMode ? (
    <ErrorSuppressionProvider>
      <ErrorBoundaryComponent>{content}</ErrorBoundaryComponent>
    </ErrorSuppressionProvider>
  ) : (
    <ErrorBoundaryComponent fallback={fallbackUI}>{content}</ErrorBoundaryComponent>
  );

  return wrappedContent;
};
