import { logger } from '@/commons/utils/logger';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LLMConfig, LLMService } from '@/renderer/services/LLMService';
import { logger as rendererLogger } from '@/renderer/services/LoggerService';
import { useSettingsStore } from '@/stores/settings';
import { useUIStore } from '@/stores';
import { MODEL_OPTIONS, ModelOption, DEFAULT_MODEL } from '@/types/model.types';
import React, { useEffect, useState } from 'react';
import { Input } from './Input';
import { Modal } from './Modal';

interface LLMSettingsProps {
  onClose: () => void;
}

export const LLMSettings: React.FC<LLMSettingsProps> = ({ onClose }) => {
  const [config, setConfig] = useState<LLMConfig>({
    provider: 'claude-code',
    apiKey: '',
    apiUrl: '',
    model: '',
    temperature: 0.7,
    maxTokens: 2000,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectDirectoryInput, setProjectDirectoryInput] = useState<string>('');
  const [appVersion, setAppVersion] = useState<string>('');
  const [devMode, setDevMode] = useState<boolean>(false);

  // Use new stores
  const vimEnabled = useUIStore((state) => state.vimEnabled);
  const toggleVimMode = useUIStore((state) => state.toggleVimMode);
  const updateVimState = useUIStore((state) => state.updateVimState);

  // Local state for maxTurns and defaultModel (loaded from settings store)
  const [maxTurns, setMaxTurns] = useState<number>(10);
  const [defaultModel, setDefaultModel] = useState<ModelOption>(DEFAULT_MODEL);

  // Track initial values to detect changes
  const [initialConfig, setInitialConfig] = useState<LLMConfig | null>(null);
  const [initialVimMode, setInitialVimMode] = useState<boolean | null>(null);
  const [initialDevMode, setInitialDevMode] = useState<boolean | null>(null);
  const [initialProjectDirectory, setInitialProjectDirectory] = useState<string | null>(null);
  const [initialMaxTurns, setInitialMaxTurns] = useState<number | null>(null);
  const [initialDefaultModel, setInitialDefaultModel] = useState<ModelOption | null>(null);

  // Check if any settings have changed
  const hasChanges = () => {
    if (
      !initialConfig ||
      initialVimMode === null ||
      initialDevMode === null ||
      initialProjectDirectory === null ||
      initialMaxTurns === null ||
      initialDefaultModel === null
    )
      return false;

    // Check if vim mode changed
    if (vimEnabled !== initialVimMode) return true;

    // Check if dev mode changed
    if (devMode !== initialDevMode) return true;

    // Check if project directory changed
    if (projectDirectoryInput !== initialProjectDirectory) return true;

    // Check if max turns changed
    if (maxTurns !== initialMaxTurns) return true;

    // Check if default model changed
    if (defaultModel !== initialDefaultModel) return true;

    // Check if LLM config changed
    return JSON.stringify(config) !== JSON.stringify(initialConfig);
  };

  useEffect(() => {
    // Load existing configuration
    const existingConfig = LLMService.getConfig();
    if (existingConfig) {
      setConfig(existingConfig);
      setInitialConfig(existingConfig);
    }

    // Load vim mode setting from config file
    const loadVimMode = async () => {
      try {
        const enabled = await window.electron.worktree.getVimMode();
        setInitialVimMode(enabled);
        if (enabled !== vimEnabled) {
          toggleVimMode();
        }
        if (!enabled) {
          updateVimState({ mode: 'INSERT' });
        } else {
          updateVimState({ mode: 'NORMAL' });
        }
      } catch (error) {
        logger.error('Failed to load vim mode:', error);
        // Fallback to localStorage for backwards compatibility
        const savedVimMode = localStorage.getItem('vimModeEnabled');
        if (savedVimMode !== null) {
          const enabled = savedVimMode === 'true';
          setInitialVimMode(enabled);
          if (enabled !== vimEnabled) {
            toggleVimMode();
          }
          if (!enabled) {
            updateVimState({ mode: 'INSERT' });
          }
        }
      }
    };
    void loadVimMode();

    // Load project directory setting
    const loadProjectDirectory = async () => {
      try {
        const projectDir = await window.electron.ipcRenderer.invoke('config:getProjectDirectory');
        setProjectDirectoryInput(projectDir);
        setInitialProjectDirectory(projectDir);
      } catch (error) {
        logger.error('Failed to get project directory:', error);
        setProjectDirectoryInput('');
        setInitialProjectDirectory('');
      }
    };
    void loadProjectDirectory();

    // Load app version
    const loadAppVersion = async () => {
      try {
        const version = await window.electron.app.getVersion();
        setAppVersion(version);
      } catch (error) {
        logger.error('Failed to get app version:', error);
        setAppVersion('Unknown');
      }
    };
    void loadAppVersion();

    // Load dev mode setting from config file
    const loadDevMode = async () => {
      try {
        const enabled = await window.electron.ipcRenderer.invoke('config:getDevMode');
        setDevMode(enabled);
        setInitialDevMode(enabled);
      } catch (error) {
        logger.error('Failed to load dev mode:', error);
        setDevMode(false);
        setInitialDevMode(false);
      }
    };
    void loadDevMode();

    // Load maxTurns from settings store
    const loadMaxTurns = () => {
      const currentMaxTurns = useSettingsStore.getState().preferences.maxTurns || 10;
      setMaxTurns(currentMaxTurns);
      setInitialMaxTurns(currentMaxTurns);
      logger.info('[LLMSettings] Loaded maxTurns:', currentMaxTurns);
    };
    loadMaxTurns();

    // Load defaultModel from settings store
    const loadDefaultModel = () => {
      const currentDefaultModel =
        useSettingsStore.getState().preferences.defaultModel || DEFAULT_MODEL;
      setDefaultModel(currentDefaultModel);
      setInitialDefaultModel(currentDefaultModel);
      logger.info('[LLMSettings] Loaded defaultModel:', currentDefaultModel);
    };
    loadDefaultModel();
  }, []); // Only run once on mount

  // Handle project directory input change
  const handleProjectDirectoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProjectDirectoryInput(e.target.value);
  };

  // Handle keyboard events for form submission
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    // Submit form on Enter if there are changes and not saving
    if (e.key === 'Enter' && !e.shiftKey && hasChanges() && !isSaving) {
      e.preventDefault();
      void handleSave();
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      await LLMService.updateConfig(config);

      // Save vim mode setting to config file with enhanced error handling
      try {
        const result = await window.electron.worktree.setVimMode(vimEnabled);
        if (!result.success) {
          logger.error('Failed to persist VIM mode to config:', result.error);
          throw new Error(result.error || 'Failed to save vim mode');
        }

        // Also update localStorage for backwards compatibility
        localStorage.setItem('vimModeEnabled', vimEnabled.toString());

        // Dispatch custom event to notify VIM mode indicator
        window.dispatchEvent(new Event('vimModeChanged'));

        // Also dispatch storage event for better compatibility
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'vimModeEnabled',
            newValue: vimEnabled.toString(),
            oldValue: (!vimEnabled).toString(),
            storageArea: localStorage,
          })
        );

        // Update vim state based on mode
        if (!vimEnabled) {
          updateVimState({ mode: 'INSERT' });
        } else {
          updateVimState({ mode: 'NORMAL' });
        }
      } catch (error) {
        // Revert UIStore state if persistence fails
        toggleVimMode(); // This will revert the toggle
        throw error;
      }

      // Save dev mode setting to config file
      try {
        await window.electron.ipcRenderer.invoke('config:setDevMode', devMode);

        // Update window object and logger for immediate effect
        (window as any).__DEV_MODE__ = devMode;
        rendererLogger.setDevelopmentMode(devMode);

        // Also update localStorage for backwards compatibility
        localStorage.setItem('devMode', devMode.toString());
      } catch (error) {
        logger.error('Failed to save dev mode:', error);
        throw error;
      }

      // Save project directory if changed
      if (projectDirectoryInput !== initialProjectDirectory && projectDirectoryInput.trim()) {
        try {
          const result = await window.electron.ipcRenderer.invoke(
            'config:setProjectDirectory',
            projectDirectoryInput.trim()
          );

          if (result.success) {
            const { toast } = await import('@/commons/utils/toastUtils');
            toast.success('Project directory updated', {
              description: 'Please restart the application for changes to take effect.',
              duration: 10000,
            });
            // Reload the actual expanded path from config
            const expandedPath = await window.electron.ipcRenderer.invoke(
              'config:getProjectDirectory'
            );
            setProjectDirectoryInput(expandedPath);
            setInitialProjectDirectory(expandedPath);
          } else {
            throw new Error(result.error || 'Failed to save project directory');
          }
        } catch (error) {
          logger.error('Failed to save project directory:', error);
          throw error;
        }
      }

      // Save maxTurns if changed
      if (maxTurns !== initialMaxTurns) {
        try {
          logger.info(
            '[LLMSettings] Saving maxTurns - before:',
            initialMaxTurns,
            'after:',
            maxTurns
          );
          await useSettingsStore.getState().updatePreferences({ maxTurns });
          logger.info('[LLMSettings] Successfully saved maxTurns:', maxTurns);
          setInitialMaxTurns(maxTurns);
        } catch (error) {
          logger.error('[LLMSettings] Failed to save max turns:', error);
          throw error;
        }
      } else {
        logger.info('[LLMSettings] maxTurns unchanged, skipping save:', maxTurns);
      }

      // Save defaultModel if changed
      if (defaultModel !== initialDefaultModel) {
        try {
          logger.info(
            '[LLMSettings] Saving defaultModel - before:',
            initialDefaultModel,
            'after:',
            defaultModel
          );
          await useSettingsStore.getState().updatePreferences({ defaultModel });
          logger.info('[LLMSettings] Successfully saved defaultModel:', defaultModel);
          setInitialDefaultModel(defaultModel);

          // Also update the UI store's selected model to reflect the new default
          // This ensures the model selector in the chat interface uses the new default for new sessions
          const { setSelectedModel } = useUIStore.getState();
          setSelectedModel(defaultModel);
          logger.info(
            '[LLMSettings] Updated UI store selectedModel to match new default:',
            defaultModel
          );
        } catch (error) {
          logger.error('[LLMSettings] Failed to save default model:', error);
          throw error;
        }
      } else {
        logger.info('[LLMSettings] defaultModel unchanged, skipping save:', defaultModel);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Settings"
      description="Configure application preferences and LLM settings"
      showCloseButton={true}
      preventCloseOnEscape={isSaving}
      primaryAction={{
        label: 'Save',
        onClick: handleSave,
        disabled: !hasChanges(),
        loading: isSaving,
        loadingText: 'Saving...',
      }}
    >
      <div className="space-y-6" onKeyDown={handleKeyDown}>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-text tracking-wide">Application Info</h3>
          <div className="space-y-1">
            <p className="text-sm text-text m-0">Version</p>
            <Input
              id="version-input"
              type="text"
              value={appVersion}
              readOnly
              title="Application version"
              className="cursor-default text-text-muted"
            />
            <p className="text-xs text-text-muted mt-0.5 m-0">
              Current version of the AutoSteer Desktop Application
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-text tracking-wide">Editor Settings</h3>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Checkbox
                id="vim-mode-checkbox"
                checked={vimEnabled}
                onCheckedChange={toggleVimMode}
              />
              <label htmlFor="vim-mode-checkbox" className="cursor-pointer">
                <span className="text-sm text-text">Enable Vim Mode</span>
              </label>
            </div>
            <p className="text-xs text-text-muted mt-0.5 m-0">
              When enabled, the editor starts in normal mode. Use 'i' to enter insert mode and 'Esc'
              to return to normal mode.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-text tracking-wide">Developer Settings</h3>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Checkbox
                id="dev-mode-checkbox"
                checked={devMode}
                onCheckedChange={(checked) => setDevMode(checked as boolean)}
              />
              <label htmlFor="dev-mode-checkbox" className="cursor-pointer">
                <span className="text-sm text-text">Enable Development Mode</span>
              </label>
            </div>
            <p className="text-xs text-text-muted mt-0.5 m-0">
              Enable verbose console logging of Claude CLI responses for debugging purposes.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-text tracking-wide">Claude Code Settings</h3>
          <div className="space-y-1">
            <p className="text-sm text-text m-0">Max Turns</p>
            <Select
              value={maxTurns.toString()}
              onValueChange={(value) => {
                const newMaxTurns = parseInt(value, 10);
                setMaxTurns(newMaxTurns);
                logger.info('[LLMSettings] Max turns changed to:', newMaxTurns);
              }}
            >
              <SelectTrigger id="max-turns-select" className="w-full">
                <SelectValue placeholder="Select max turns" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 turns</SelectItem>
                <SelectItem value="20">20 turns</SelectItem>
                <SelectItem value="50">50 turns</SelectItem>
                <SelectItem value="100">100 turns</SelectItem>
                <SelectItem value="200">200 turns</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-text-muted mt-0.5 m-0">
              Maximum number of conversation turns before the session automatically terminates.
              Lower values help prevent excessive API usage.
            </p>
          </div>
          <div className="space-y-1 mt-4">
            <p className="text-sm text-text m-0">Default Model</p>
            <Select
              value={defaultModel}
              onValueChange={(value) => {
                setDefaultModel(value as ModelOption);
                logger.info('[LLMSettings] Default model changed to:', value);
              }}
            >
              <SelectTrigger id="default-model-select" className="w-full">
                <SelectValue placeholder="Select default model" />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label} - {option.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-text-muted mt-0.5 m-0">
              The default AI model to use for new conversations. Sonnet 4.5 is recommended for the
              best balance of performance and speed.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-text tracking-wide">Data Directories</h3>
          <div className="space-y-1">
            <p className="text-sm text-text m-0">Project Directory</p>
            <Input
              id="project-directory-input"
              type="text"
              value={projectDirectoryInput}
              onChange={handleProjectDirectoryChange}
              placeholder="~/.autosteer"
              title="The location where project worktrees and configuration are stored"
            />
            <p className="text-xs text-text-muted mt-0.5 m-0">
              Requires app restart after saving. Defaults to ~/.autosteer if not set.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}
      </div>
    </Modal>
  );
};
