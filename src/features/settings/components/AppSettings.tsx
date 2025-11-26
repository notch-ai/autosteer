import { logger } from '@/commons/utils/logger';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/features/shared/components/ui/Input';
import { Modal } from '@/features/shared/components/ui/Modal';
import { LLMConfig, LLMService } from '@/renderer/services/LLMService';
import { useUIStore } from '@/stores';
import { useSettingsStore } from '@/stores/settings';
import { DEFAULT_MODEL, MODEL_OPTIONS, ModelOption } from '@/types/model.types';
import {
  DEFAULT_PERMISSION_MODE,
  PERMISSION_MODES,
  PermissionMode,
} from '@/types/permission.types';
import type { IconName } from '@/features/shared/components/ui/Icon';
import { Icon } from '@/features/shared/components/ui/Icon';
import React, { useCallback, useEffect, useState } from 'react';

interface AppSettingsProps {
  onClose: () => void;
}

export const AppSettings: React.FC<AppSettingsProps> = ({ onClose }) => {
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
  const [maxTurns, setMaxTurns] = useState<number | null>(null); // null = unlimited
  const [defaultModel, setDefaultModel] = useState<ModelOption>(DEFAULT_MODEL);
  const [fontFamily, setFontFamily] = useState<string>(
    'Fira Code, SF Mono, Monaco, Consolas, monospace'
  );
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [confirmSessionTabDeletion, setConfirmSessionTabDeletion] = useState<boolean>(true);
  const [enableSkills, setEnableSkills] = useState<boolean>(true);
  const [preferredEditor, setPreferredEditor] = useState<string>('');
  const [availableEditors, setAvailableEditors] = useState<string[]>([]);
  const [pythonTestState, setPythonTestState] = useState<'idle' | 'testing' | 'success' | 'error'>(
    'idle'
  );
  const [pythonTestResults, setPythonTestResults] = useState<{
    pythonVersion?: string;
    sdkVersion?: string;
    importStatus?: string;
    error?: string;
  } | null>(null);
  const [defaultPermissionMode, setDefaultPermissionMode] = useState<PermissionMode | undefined>(
    DEFAULT_PERMISSION_MODE
  );

  // Track initial values to detect changes
  const [initialConfig, setInitialConfig] = useState<LLMConfig | null>(null);
  const [initialVimMode, setInitialVimMode] = useState<boolean | null>(null);
  const [initialDevMode, setInitialDevMode] = useState<boolean | null>(null);
  const [initialProjectDirectory, setInitialProjectDirectory] = useState<string | null>(null);
  const [initialMaxTurns, setInitialMaxTurns] = useState<number | null>(null); // null = unlimited
  const [initialDefaultModel, setInitialDefaultModel] = useState<ModelOption | null>(null);
  const [initialFontFamily, setInitialFontFamily] = useState<string | null>(null);
  const [initialFontSize, setInitialFontSize] = useState<'small' | 'medium' | 'large' | null>(null);
  const [initialConfirmSessionTabDeletion, setInitialConfirmSessionTabDeletion] = useState<
    boolean | null
  >(null);
  const [initialEnableSkills, setInitialEnableSkills] = useState<boolean | null>(null);
  const [initialPreferredEditor, setInitialPreferredEditor] = useState<string | null>(null);
  const [initialDefaultPermissionMode, setInitialDefaultPermissionMode] = useState<
    PermissionMode | undefined
  >(undefined);

  // Check if any settings have changed
  const hasChanges = () => {
    if (
      !initialConfig ||
      initialVimMode === null ||
      initialDevMode === null ||
      initialProjectDirectory === null ||
      initialMaxTurns === undefined ||
      initialDefaultModel === null ||
      initialFontFamily === null ||
      initialConfirmSessionTabDeletion === null
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

    // Check if font family changed
    if (fontFamily !== initialFontFamily) return true;

    // Check if font size changed
    if (fontSize !== initialFontSize) return true;

    // Check if confirmSessionTabDeletion changed
    if (confirmSessionTabDeletion !== initialConfirmSessionTabDeletion) return true;

    // Check if enableSkills changed
    if (enableSkills !== initialEnableSkills) return true;

    // Check if preferredEditor changed
    if (preferredEditor !== initialPreferredEditor) return true;

    // Check if defaultPermissionMode changed
    if (defaultPermissionMode !== initialDefaultPermissionMode) return true;

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
      const currentMaxTurns = useSettingsStore.getState().preferences.maxTurns ?? null; // null = unlimited
      setMaxTurns(currentMaxTurns);
      setInitialMaxTurns(currentMaxTurns);
      logger.info(
        '[LLMSettings] Loaded maxTurns:',
        currentMaxTurns === null ? 'unlimited' : currentMaxTurns
      );
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

    // Load fontFamily from settings store
    const loadFontFamily = () => {
      const currentFontFamily =
        useSettingsStore.getState().preferences.fontFamily ||
        'Fira Code, SF Mono, Monaco, Consolas, monospace';
      setFontFamily(currentFontFamily);
      setInitialFontFamily(currentFontFamily);
      logger.info('[LLMSettings] Loaded fontFamily:', currentFontFamily);
    };
    loadFontFamily();

    // Load fontSize from settings store
    const loadFontSize = () => {
      const currentFontSize = useSettingsStore.getState().preferences.fontSize || 'medium';
      setFontSize(currentFontSize);
      setInitialFontSize(currentFontSize);
      logger.info('[LLMSettings] Loaded fontSize:', currentFontSize);
    };
    loadFontSize();

    // Load confirmSessionTabDeletion from settings store
    const loadConfirmSessionTabDeletion = () => {
      const currentConfirmSessionTabDeletion =
        useSettingsStore.getState().preferences.confirmSessionTabDeletion ?? true;
      setConfirmSessionTabDeletion(currentConfirmSessionTabDeletion);
      setInitialConfirmSessionTabDeletion(currentConfirmSessionTabDeletion);
      logger.info(
        '[AppSettings] Loaded confirmSessionTabDeletion:',
        currentConfirmSessionTabDeletion
      );
    };
    loadConfirmSessionTabDeletion();

    // Load enableSkills from settings store
    const loadEnableSkills = () => {
      const currentEnableSkills = useSettingsStore.getState().preferences.enableSkills ?? true;
      setEnableSkills(currentEnableSkills);
      setInitialEnableSkills(currentEnableSkills);
      logger.info('[AppSettings] Loaded enableSkills:', currentEnableSkills);
    };
    loadEnableSkills();

    // Load preferred editor from IDE settings
    const loadPreferredEditor = async () => {
      if (window.electron?.ide) {
        try {
          const result = await window.electron.ide.detect();
          setAvailableEditors(result.editors || []);
          setPreferredEditor(result.preferred || '');
          setInitialPreferredEditor(result.preferred || '');
        } catch (error) {
          logger.error('[AppSettings] Failed to load preferred editor:', error);
        }
      }
    };
    void loadPreferredEditor();

    // Load defaultPermissionMode from settings store
    const loadDefaultPermissionMode = () => {
      const currentDefaultPermissionMode =
        useSettingsStore.getState().preferences.defaultPermissionMode || DEFAULT_PERMISSION_MODE;
      setDefaultPermissionMode(currentDefaultPermissionMode);
      setInitialDefaultPermissionMode(currentDefaultPermissionMode);
      logger.info('[AppSettings] Loaded defaultPermissionMode:', currentDefaultPermissionMode);
    };
    loadDefaultPermissionMode();
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

  const handleTestPythonRuntime = useCallback(async () => {
    setPythonTestState('testing');
    setPythonTestResults(null);

    try {
      logger.info('[AppSettings] Testing Python runtime');

      const result = await window.electron.ipcRenderer.invoke('test-python-runtime');

      if (result.success && result.result) {
        setPythonTestState('success');
        setPythonTestResults({
          pythonVersion: result.result.pythonVersion,
          sdkVersion: result.result.sdkVersion,
          importStatus: result.result.importStatus,
        });
        logger.info('[AppSettings] Python runtime test succeeded', result.result);
      } else {
        setPythonTestState('error');
        setPythonTestResults({ error: result.error || 'Unknown error occurred' });
        logger.error('[AppSettings] Python runtime test failed', result.error);
      }
    } catch (error) {
      setPythonTestState('error');
      setPythonTestResults({
        error: error instanceof Error ? error.message : 'Failed to test Python runtime',
      });
      logger.error('[AppSettings] Python runtime test error', error);
    }
  }, []);

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

        // Update window object for immediate effect
        (window as any).__DEV_MODE__ = devMode;

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
            const { toast } = await import('@/commons/utils/ui/toast_utils');
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

      // Save fontFamily if changed
      if (fontFamily !== initialFontFamily) {
        try {
          logger.info(
            '[LLMSettings] Saving fontFamily - before:',
            initialFontFamily,
            'after:',
            fontFamily
          );
          await useSettingsStore.getState().updatePreferences({ fontFamily });
          logger.info('[LLMSettings] Successfully saved fontFamily:', fontFamily);
          setInitialFontFamily(fontFamily);
        } catch (error) {
          logger.error('[LLMSettings] Failed to save font family:', error);
          throw error;
        }
      } else {
        logger.info('[LLMSettings] fontFamily unchanged, skipping save:', fontFamily);
      }

      // Save fontSize if changed
      if (fontSize !== initialFontSize) {
        try {
          logger.info(
            '[LLMSettings] Saving fontSize - before:',
            initialFontSize,
            'after:',
            fontSize
          );
          await useSettingsStore.getState().updatePreferences({ fontSize });
          logger.info('[LLMSettings] Successfully saved fontSize:', fontSize);
          setInitialFontSize(fontSize);
        } catch (error) {
          logger.error('[LLMSettings] Failed to save font size:', error);
          throw error;
        }
      } else {
        logger.info('[LLMSettings] fontSize unchanged, skipping save:', fontSize);
      }

      // Save confirmSessionTabDeletion if changed
      if (confirmSessionTabDeletion !== initialConfirmSessionTabDeletion) {
        try {
          logger.info(
            '[LLMSettings] Saving confirmSessionTabDeletion - before:',
            initialConfirmSessionTabDeletion,
            'after:',
            confirmSessionTabDeletion
          );
          await useSettingsStore.getState().updatePreferences({ confirmSessionTabDeletion });
          logger.info(
            '[LLMSettings] Successfully saved confirmSessionTabDeletion:',
            confirmSessionTabDeletion
          );
          setInitialConfirmSessionTabDeletion(confirmSessionTabDeletion);
        } catch (error) {
          logger.error('[LLMSettings] Failed to save confirmSessionTabDeletion:', error);
          throw error;
        }
      } else {
        logger.info(
          '[LLMSettings] confirmSessionTabDeletion unchanged, skipping save:',
          confirmSessionTabDeletion
        );
      }

      // Save enableSkills if changed
      if (enableSkills !== initialEnableSkills) {
        try {
          logger.info(
            '[AppSettings] Saving enableSkills - before:',
            initialEnableSkills,
            'after:',
            enableSkills
          );
          await useSettingsStore.getState().updatePreferences({ enableSkills });
          logger.info('[AppSettings] Successfully saved enableSkills:', enableSkills);
          setInitialEnableSkills(enableSkills);
        } catch (error) {
          logger.error('[AppSettings] Failed to save enableSkills:', error);
          throw error;
        }
      } else {
        logger.info('[AppSettings] enableSkills unchanged, skipping save:', enableSkills);
      }

      // Save preferred editor if changed
      if (preferredEditor !== initialPreferredEditor) {
        try {
          if (window.electron?.ide) {
            await window.electron.ide.setPreferred(preferredEditor);
          }
          setInitialPreferredEditor(preferredEditor);
        } catch (error) {
          logger.error('[AppSettings] Failed to save preferredEditor:', error);
          throw error;
        }
      }

      // Save defaultPermissionMode if changed
      if (defaultPermissionMode !== initialDefaultPermissionMode) {
        try {
          logger.info(
            '[AppSettings] Saving defaultPermissionMode - before:',
            initialDefaultPermissionMode,
            'after:',
            defaultPermissionMode
          );
          // Only include defaultPermissionMode in the update if it's defined
          await useSettingsStore
            .getState()
            .updatePreferences(
              defaultPermissionMode !== undefined ? { defaultPermissionMode } : {}
            );
          logger.info(
            '[AppSettings] Successfully saved defaultPermissionMode:',
            defaultPermissionMode
          );
          setInitialDefaultPermissionMode(defaultPermissionMode);
        } catch (error) {
          logger.error('[AppSettings] Failed to save defaultPermissionMode:', error);
          throw error;
        }
      } else {
        logger.info(
          '[AppSettings] defaultPermissionMode unchanged, skipping save:',
          defaultPermissionMode
        );
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
          <h3 className="text-sm font-semibold text-foreground tracking-wide">Application Info</h3>
          <div className="space-y-1">
            <p className="text-sm text-foreground m-0">Version</p>
            <Input
              id="version-input"
              type="text"
              value={appVersion}
              readOnly
              title="Application version"
              className="cursor-default text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground mt-0.5 m-0">
              Current version of the AutoSteer Desktop Application
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground tracking-wide">Editor Settings</h3>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Checkbox
                id="vim-mode-checkbox"
                checked={vimEnabled}
                onCheckedChange={toggleVimMode}
              />
              <label htmlFor="vim-mode-checkbox" className="cursor-pointer">
                <span className="text-sm text-foreground">Enable Vim Mode</span>
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 m-0">
              When enabled, the editor starts in normal mode. Use 'i' to enter insert mode and 'Esc'
              to return to normal mode.
            </p>
          </div>
          <div className="space-y-1 mt-4">
            <p className="text-sm text-foreground m-0">Font Size</p>
            <Select
              value={fontSize}
              onValueChange={(value) => {
                setFontSize(value as 'small' | 'medium' | 'large');
                logger.info('[LLMSettings] Font size changed to:', value);
              }}
            >
              <SelectTrigger id="font-size-select" className="w-full">
                <SelectValue placeholder="Select font size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small (12px)</SelectItem>
                <SelectItem value="medium">Medium (13px) - Recommended</SelectItem>
                <SelectItem value="large">Large (14px)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-0.5 m-0">
              Base font size for the entire application. Medium (13px) aligns with Electron
              standards. Changes apply immediately without restart.
            </p>
          </div>
          <div className="space-y-1 mt-4">
            <p className="text-sm text-foreground m-0">Font Family</p>
            <Input
              id="font-family-input"
              type="text"
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              placeholder="Fira Code, SF Mono, Monaco, Consolas, monospace"
              title="The font family to use for code and terminal"
            />
            <p className="text-xs text-muted-foreground mt-0.5 m-0">
              Font family for code editor, terminal, and all text. Changes apply immediately without
              restart. Use comma-separated font names with fallbacks.
            </p>
          </div>
          <div className="space-y-1 mt-4">
            <p className="text-sm text-text m-0">Preferred IDE</p>
            <Select
              value={preferredEditor}
              onValueChange={setPreferredEditor}
              disabled={availableEditors.length === 0}
            >
              <SelectTrigger id="preferred-editor-select" className="w-full">
                <SelectValue
                  placeholder={
                    availableEditors.length === 0 ? 'No editors detected' : 'Select preferred IDE'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableEditors.map((editor) => {
                  const displayNames: Record<string, string> = {
                    code: 'VS Code',
                    cursor: 'Cursor',
                    windsurf: 'Windsurf',
                    webstorm: 'WebStorm',
                    phpstorm: 'PhpStorm',
                    pycharm: 'PyCharm',
                    idea: 'IntelliJ IDEA',
                    subl: 'Sublime Text',
                    atom: 'Atom',
                    vim: 'Vim',
                    nvim: 'NeoVim',
                    emacs: 'Emacs',
                    zed: 'Zed',
                  };
                  return (
                    <SelectItem key={editor} value={editor}>
                      {displayNames[editor] || editor}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-text-muted mt-0.5 m-0">
              Choose your preferred IDE for opening files and directories. Only installed editors
              are shown.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground tracking-wide">User Experience</h3>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Checkbox
                id="confirm-session-tab-deletion-checkbox"
                checked={confirmSessionTabDeletion}
                onCheckedChange={(checked) => setConfirmSessionTabDeletion(checked as boolean)}
              />
              <label htmlFor="confirm-session-tab-deletion-checkbox" className="cursor-pointer">
                <span className="text-sm text-foreground">
                  Confirm before deleting session tabs
                </span>
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 m-0">
              When enabled, a confirmation dialog will appear before deleting a session tab to
              prevent accidental deletions.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground tracking-wide">
            Developer Settings
          </h3>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Checkbox
                id="dev-mode-checkbox"
                checked={devMode}
                onCheckedChange={(checked) => setDevMode(checked as boolean)}
              />
              <label htmlFor="dev-mode-checkbox" className="cursor-pointer">
                <span className="text-sm text-foreground">Enable Development Mode</span>
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 m-0">
              Enable verbose console logging of Claude CLI responses for debugging purposes.
            </p>
          </div>
        </div>

        {/* Python Runtime Settings */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground tracking-wide">Python Runtime</h3>
          <div className="space-y-4">
            {/* Test Button */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-foreground">Test Python Bridge</p>
                <p className="text-xs text-muted-foreground">
                  Verify Python runtime and Claude Agent SDK installation
                </p>
              </div>
              <Button
                onClick={handleTestPythonRuntime}
                disabled={pythonTestState === 'testing'}
                variant="default"
                size="default"
              >
                {pythonTestState === 'testing' ? 'Testing...' : 'Test Runtime'}
              </Button>
            </div>

            {/* Success Results */}
            {pythonTestState === 'success' && pythonTestResults && (
              <Alert variant="default" className="border-green-500 bg-green-50 dark:bg-green-950">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                    ✅ Python Runtime Test Successful
                  </p>
                  <div className="text-xs space-y-1 text-green-800 dark:text-green-200 font-mono">
                    <div>
                      <span className="font-semibold">Python Version:</span>{' '}
                      {pythonTestResults.pythonVersion}
                    </div>
                    <div>
                      <span className="font-semibold">SDK Version:</span>{' '}
                      {pythonTestResults.sdkVersion}
                    </div>
                    <div>
                      <span className="font-semibold">Import Status:</span>{' '}
                      {pythonTestResults.importStatus}
                    </div>
                  </div>
                </div>
              </Alert>
            )}

            {/* Error Results */}
            {pythonTestState === 'error' && pythonTestResults?.error && (
              <Alert variant="destructive">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">❌ Python Runtime Test Failed</p>
                  <p className="text-xs font-mono">{pythonTestResults.error}</p>
                  <p className="text-xs text-muted-foreground">Click "Test Runtime" to try again</p>
                </div>
              </Alert>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground tracking-wide">
            Session Permissions
          </h3>
          <div className="space-y-1">
            <p className="text-sm text-foreground m-0">Default Permission Mode</p>
            <Select
              value={defaultPermissionMode || DEFAULT_PERMISSION_MODE}
              onValueChange={(value) => {
                setDefaultPermissionMode(value as PermissionMode);
                logger.info('[AppSettings] Default permission mode changed to:', value);
              }}
            >
              <SelectTrigger id="default-permission-mode-select" className="w-full">
                <SelectValue>
                  {(() => {
                    const selectedMode = PERMISSION_MODES.find(
                      (m) => m.value === (defaultPermissionMode || DEFAULT_PERMISSION_MODE)
                    );
                    return selectedMode ? (
                      <div className="flex items-center gap-2">
                        <Icon name={selectedMode.icon as IconName} size={16} />
                        <span>{selectedMode.label}</span>
                      </div>
                    ) : (
                      'Edit'
                    );
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PERMISSION_MODES.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value}>
                    <div className="flex items-center gap-2">
                      <Icon name={mode.icon as IconName} size={16} />
                      <span>{mode.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-0.5 m-0">
              Set the default permission mode for new sessions. You can override this for individual
              messages using the permission selector in the chat input.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground tracking-wide">
            Claude Code Settings
          </h3>
          <div className="space-y-1">
            <p className="text-sm text-foreground m-0">Max Turns</p>
            <Select
              value={maxTurns === null ? 'unlimited' : maxTurns.toString()}
              onValueChange={(value) => {
                const newMaxTurns = value === 'unlimited' ? null : parseInt(value, 10);
                setMaxTurns(newMaxTurns);
                logger.info(
                  '[LLMSettings] Max turns changed to:',
                  newMaxTurns === null ? 'unlimited' : newMaxTurns
                );
              }}
            >
              <SelectTrigger id="max-turns-select" className="w-full">
                <SelectValue placeholder="Select max turns" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unlimited">Unlimited</SelectItem>
                <SelectItem value="10">10 turns</SelectItem>
                <SelectItem value="20">20 turns</SelectItem>
                <SelectItem value="50">50 turns</SelectItem>
                <SelectItem value="100">100 turns</SelectItem>
                <SelectItem value="200">200 turns</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-0.5 m-0">
              Maximum number of conversation turns before the session automatically terminates.
              "Unlimited" allows sessions to continue indefinitely.
            </p>
          </div>
          <div className="space-y-1 mt-4">
            <p className="text-sm text-foreground m-0">Default Model</p>
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
            <p className="text-xs text-muted-foreground mt-0.5 m-0">
              The default AI model to use for new conversations. Sonnet 4.5 is recommended for the
              best balance of performance and speed.
            </p>
          </div>
          <div className="space-y-1 mt-4">
            <div className="flex items-center gap-3">
              <Checkbox
                id="enable-skills-checkbox"
                checked={enableSkills}
                onCheckedChange={(checked) => setEnableSkills(checked as boolean)}
              />
              <label htmlFor="enable-skills-checkbox" className="cursor-pointer">
                <span className="text-sm text-text">Enable Skills</span>
              </label>
            </div>
            <p className="text-xs text-text-muted mt-0.5 m-0">
              Allow Claude to autonomously invoke custom skills from .claude/skills/ directory. When
              enabled, Claude can detect and execute workflows defined in skill files without
              explicit slash command invocation.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground tracking-wide">Data Directories</h3>
          <div className="space-y-1">
            <p className="text-sm text-foreground m-0">Project Directory</p>
            <Input
              id="project-directory-input"
              type="text"
              value={projectDirectoryInput}
              onChange={handleProjectDirectoryChange}
              placeholder="~/.autosteer"
              title="The location where project worktrees and configuration are stored"
            />
            <p className="text-xs text-muted-foreground mt-0.5 m-0">
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
