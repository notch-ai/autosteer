import { useSettingsStore } from '@/stores/settings';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Get references to the global mocks from setup.ts
const mockInvoke = window.electron.ipc.invoke as jest.MockedFunction<any>;
const mockSlashCommandsLoad = window.electron.slashCommands.load as jest.MockedFunction<any>;

describe('SettingsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSlashCommandsLoad.mockResolvedValue([]);
    // Reset store to initial state
    useSettingsStore.getState().reset();
  });

  describe('Initialization', () => {
    it('should load settings from config on initialize', async () => {
      const mockConfig = {
        settings: {
          theme: 'dark',
          fontSize: 'large',
          selectedProvider: 'openai',
        },
        apiKeys: {
          anthropic: 'test-key',
        },
        customCommands: [
          {
            id: 'cmd-1',
            name: 'Test Command',
            description: 'Test',
            command: '/test',
            createdAt: new Date(),
          },
        ],
      };

      mockInvoke.mockResolvedValueOnce(mockConfig);

      const { initialize } = useSettingsStore.getState();
      await initialize();

      const state = useSettingsStore.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.preferences.theme).toBe('dark');
      expect(state.preferences.fontSize).toBe('large');
      expect(state.selectedProvider).toBe('openai');
      expect(state.apiKeys).toEqual({ anthropic: 'test-key' });
      expect(state.customCommands).toHaveLength(1);
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Failed to read config');
      mockInvoke.mockRejectedValueOnce(error);

      const { initialize } = useSettingsStore.getState();
      await initialize();

      const state = useSettingsStore.getState();
      expect(state.isInitialized).toBe(false);
      expect(state.initializationError).toBe('Failed to read config');
    });
  });

  describe('Preferences Management', () => {
    it('should update preferences optimistically', async () => {
      mockInvoke.mockResolvedValueOnce({});

      const { updatePreferences } = useSettingsStore.getState();

      await updatePreferences({ theme: 'dark', fontSize: 'large' });

      const state = useSettingsStore.getState();
      expect(state.preferences.theme).toBe('dark');
      expect(state.preferences.fontSize).toBe('large');
      expect(mockInvoke).toHaveBeenCalledWith('config:updateSettings', {
        theme: 'dark',
        fontSize: 'large',
      });
    });

    it('should revert preferences on persistence failure', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Failed to persist'));

      const { updatePreferences } = useSettingsStore.getState();
      const originalTheme = useSettingsStore.getState().preferences.theme;

      await expect(updatePreferences({ theme: 'dark' })).rejects.toThrow('Failed to persist');

      const state = useSettingsStore.getState();
      expect(state.preferences.theme).toBe(originalTheme);
    });

    it('should reset preferences to defaults', async () => {
      mockInvoke.mockResolvedValue({});

      const { updatePreferences, resetPreferences } = useSettingsStore.getState();

      // Modify preferences
      await updatePreferences({ theme: 'dark', fontSize: 'large' });

      // Reset
      await resetPreferences();

      const state = useSettingsStore.getState();
      expect(state.preferences.theme).toBe('system');
      expect(state.preferences.fontSize).toBe('medium');
    });
  });

  describe('API Key Management', () => {
    it('should set API key', async () => {
      mockInvoke.mockResolvedValueOnce({});

      const { setApiKey } = useSettingsStore.getState();
      await setApiKey('anthropic', 'test-key-123');

      const state = useSettingsStore.getState();
      expect(state.apiKeys.anthropic).toBe('test-key-123');
      expect(mockInvoke).toHaveBeenCalledWith('config:setApiKey', 'anthropic', 'test-key-123');
    });

    it('should revert API key on persistence failure', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Failed to persist'));

      const { setApiKey } = useSettingsStore.getState();

      await expect(setApiKey('anthropic', 'test-key')).rejects.toThrow('Failed to persist');

      const state = useSettingsStore.getState();
      expect(state.apiKeys.anthropic).toBeUndefined();
    });

    it('should remove API key', async () => {
      mockInvoke.mockResolvedValue({});

      const { setApiKey, removeApiKey } = useSettingsStore.getState();

      // First set a key
      await setApiKey('anthropic', 'test-key');

      // Then remove it
      await removeApiKey('anthropic');

      const state = useSettingsStore.getState();
      expect(state.apiKeys.anthropic).toBeUndefined();
      expect(mockInvoke).toHaveBeenCalledWith('config:removeApiKey', 'anthropic');
    });

    it('should clear all API keys', async () => {
      mockInvoke.mockResolvedValue({});

      const { setApiKey, clearAllApiKeys } = useSettingsStore.getState();

      // Set multiple keys
      await setApiKey('anthropic', 'key-1');
      await setApiKey('openai', 'key-2');

      // Clear all
      await clearAllApiKeys();

      const state = useSettingsStore.getState();
      expect(state.apiKeys).toEqual({});
      expect(mockInvoke).toHaveBeenCalledWith('config:clearApiKeys');
    });

    it('should revert on clear all failure', async () => {
      mockInvoke.mockResolvedValue({});
      const { setApiKey, clearAllApiKeys } = useSettingsStore.getState();

      // Set keys
      await setApiKey('anthropic', 'key-1');
      await setApiKey('openai', 'key-2');

      // Mock failure for clear
      mockInvoke.mockRejectedValueOnce(new Error('Failed to clear'));

      await expect(clearAllApiKeys()).rejects.toThrow('Failed to clear');

      // Keys should be restored
      const state = useSettingsStore.getState();
      expect(state.apiKeys.anthropic).toBe('key-1');
      expect(state.apiKeys.openai).toBe('key-2');
    });
  });

  describe('Provider Management', () => {
    it('should set provider', async () => {
      mockInvoke.mockResolvedValueOnce({});

      const { setProvider } = useSettingsStore.getState();
      await setProvider('openai');

      const state = useSettingsStore.getState();
      expect(state.selectedProvider).toBe('openai');
      expect(mockInvoke).toHaveBeenCalledWith('config:updateSettings', {
        selectedProvider: 'openai',
      });
    });

    it('should revert provider on persistence failure', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Failed to persist'));

      const { setProvider } = useSettingsStore.getState();

      await expect(setProvider('openai')).rejects.toThrow('Failed to persist');

      const state = useSettingsStore.getState();
      expect(state.selectedProvider).toBe('claude-code');
    });
  });

  describe('Custom Commands Management', () => {
    it('should add custom command', async () => {
      mockInvoke.mockResolvedValueOnce({});

      const { addCustomCommand } = useSettingsStore.getState();
      await addCustomCommand({
        name: 'Test Command',
        description: 'Test description',
        command: '/test',
      });

      const state = useSettingsStore.getState();
      expect(state.customCommands).toHaveLength(1);
      expect(state.customCommands[0].name).toBe('Test Command');
      expect(state.customCommands[0].id).toBeDefined();
      expect(state.customCommands[0].createdAt).toBeDefined();
    });

    it('should revert on add command failure', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Failed to persist'));

      const { addCustomCommand } = useSettingsStore.getState();

      await expect(
        addCustomCommand({
          name: 'Test',
          description: 'Test',
          command: '/test',
        })
      ).rejects.toThrow('Failed to persist');

      const state = useSettingsStore.getState();
      expect(state.customCommands).toHaveLength(0);
    });

    it('should update custom command', async () => {
      mockInvoke.mockResolvedValue({});

      const { addCustomCommand, updateCustomCommand } = useSettingsStore.getState();

      // Add command
      await addCustomCommand({
        name: 'Test',
        description: 'Test',
        command: '/test',
      });

      const commandId = useSettingsStore.getState().customCommands[0].id;

      // Update command
      await updateCustomCommand(commandId, {
        name: 'Updated Test',
        description: 'Updated description',
      });

      const state = useSettingsStore.getState();
      expect(state.customCommands[0].name).toBe('Updated Test');
      expect(state.customCommands[0].description).toBe('Updated description');
    });

    it('should throw error when updating non-existent command', async () => {
      const { updateCustomCommand } = useSettingsStore.getState();

      await expect(updateCustomCommand('non-existent-id', { name: 'Updated' })).rejects.toThrow(
        'Custom command not found'
      );
    });

    it('should remove custom command', async () => {
      mockInvoke.mockResolvedValue({});

      const { addCustomCommand, removeCustomCommand } = useSettingsStore.getState();

      // Add command
      await addCustomCommand({
        name: 'Test',
        description: 'Test',
        command: '/test',
      });

      const commandId = useSettingsStore.getState().customCommands[0].id;

      // Remove command
      await removeCustomCommand(commandId);

      const state = useSettingsStore.getState();
      expect(state.customCommands).toHaveLength(0);
    });

    it('should clear all custom commands', async () => {
      mockInvoke.mockResolvedValue({});

      const { addCustomCommand, clearCustomCommands } = useSettingsStore.getState();

      // Add multiple commands
      await addCustomCommand({
        name: 'Test 1',
        description: 'Test',
        command: '/test1',
      });
      await addCustomCommand({
        name: 'Test 2',
        description: 'Test',
        command: '/test2',
      });

      // Clear all
      await clearCustomCommands();

      const state = useSettingsStore.getState();
      expect(state.customCommands).toHaveLength(0);
    });
  });

  describe('Settings Export/Import', () => {
    it('should export settings as JSON', async () => {
      mockInvoke.mockResolvedValue({});

      const { updatePreferences, setProvider, exportSettings } = useSettingsStore.getState();

      await updatePreferences({ theme: 'dark', fontSize: 'large' });
      await setProvider('openai');

      const exported = await exportSettings();
      const parsed = JSON.parse(exported);

      expect(parsed.preferences.theme).toBe('dark');
      expect(parsed.preferences.fontSize).toBe('large');
      expect(parsed.selectedProvider).toBe('openai');
      expect(parsed.version).toBe('1.0');
      expect(parsed.exportedAt).toBeDefined();
    });

    it('should not export API keys for security', async () => {
      mockInvoke.mockResolvedValue({});

      const { setApiKey, exportSettings } = useSettingsStore.getState();

      await setApiKey('anthropic', 'secret-key');

      const exported = await exportSettings();
      const parsed = JSON.parse(exported);

      expect(parsed.apiKeys).toBeUndefined();
    });

    it('should import settings from JSON', async () => {
      mockInvoke.mockResolvedValue({});

      const importData = {
        preferences: {
          theme: 'light',
          fontSize: 'small',
        },
        selectedProvider: 'mock',
        customCommands: [
          {
            name: 'Imported Command',
            description: 'Test',
            command: '/imported',
          },
        ],
        version: '1.0',
        exportedAt: new Date().toISOString(),
      };

      const { importSettings } = useSettingsStore.getState();
      await importSettings(JSON.stringify(importData));

      const state = useSettingsStore.getState();
      expect(state.preferences.theme).toBe('light');
      expect(state.preferences.fontSize).toBe('small');
      expect(state.selectedProvider).toBe('mock');
      expect(state.customCommands).toHaveLength(1);
      expect(state.customCommands[0].name).toBe('Imported Command');
    });

    it('should validate imported settings structure', async () => {
      const { importSettings } = useSettingsStore.getState();

      const invalidData = {
        version: '1.0',
        // Missing preferences
      };

      await expect(importSettings(JSON.stringify(invalidData))).rejects.toThrow(
        'Invalid settings file: missing preferences'
      );
    });

    it('should handle import parse errors', async () => {
      const { importSettings } = useSettingsStore.getState();

      await expect(importSettings('invalid json')).rejects.toThrow(
        'Failed to import settings: Invalid format or persistence error'
      );
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all store state', async () => {
      mockInvoke.mockResolvedValue({});

      const { updatePreferences, setApiKey, setProvider, reset } = useSettingsStore.getState();

      // Modify state
      await updatePreferences({ theme: 'dark', fontSize: 'large' });
      await setApiKey('anthropic', 'test-key');
      await setProvider('openai');

      // Reset
      reset();

      const state = useSettingsStore.getState();
      expect(state.preferences.theme).toBe('system');
      expect(state.preferences.fontSize).toBe('medium');
      expect(state.apiKeys).toEqual({});
      expect(state.selectedProvider).toBe('claude-code');
      expect(state.isInitialized).toBe(false);
    });
  });

  describe('Selector Hooks', () => {
    // Note: These tests verify the selectors exist and return correct values
    // In real usage, these would be tested with React Testing Library

    it('should have theme selector', () => {
      const state = useSettingsStore.getState();
      expect(state.preferences.theme).toBe('system');
    });

    it('should have font settings selector', () => {
      const state = useSettingsStore.getState();
      expect(state.preferences.fontSize).toBe('medium');
      expect(state.preferences.fontFamily).toBeTruthy();
    });

    it('should have provider selector', () => {
      const state = useSettingsStore.getState();
      expect(state.selectedProvider).toBe('claude-code');
    });
  });

  describe('Session Tab Deletion Confirmation Preference', () => {
    it('should have confirmSessionTabDeletion default to true', () => {
      const state = useSettingsStore.getState();
      expect(state.preferences.confirmSessionTabDeletion).toBe(true);
    });

    it('should update confirmSessionTabDeletion preference', async () => {
      mockInvoke.mockResolvedValueOnce({});

      const { updatePreferences } = useSettingsStore.getState();
      await updatePreferences({ confirmSessionTabDeletion: true });

      const state = useSettingsStore.getState();
      expect(state.preferences.confirmSessionTabDeletion).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('config:updateSettings', {
        confirmSessionTabDeletion: true,
      });
    });

    it('should persist confirmSessionTabDeletion preference across initialization', async () => {
      const mockConfig = {
        settings: {
          confirmSessionTabDeletion: true,
        },
      };

      mockInvoke.mockResolvedValueOnce(mockConfig);

      const { initialize } = useSettingsStore.getState();
      await initialize();

      const state = useSettingsStore.getState();
      expect(state.preferences.confirmSessionTabDeletion).toBe(true);
    });

    it('should include confirmSessionTabDeletion in settings export', async () => {
      mockInvoke.mockResolvedValue({});

      const { updatePreferences, exportSettings } = useSettingsStore.getState();
      await updatePreferences({ confirmSessionTabDeletion: true });

      const exported = await exportSettings();
      const parsed = JSON.parse(exported);

      expect(parsed.preferences.confirmSessionTabDeletion).toBe(true);
    });

    it('should import confirmSessionTabDeletion from settings JSON', async () => {
      mockInvoke.mockResolvedValue({});

      const importData = {
        preferences: {
          confirmSessionTabDeletion: true,
        },
        version: '1.0',
        exportedAt: new Date().toISOString(),
      };

      const { importSettings } = useSettingsStore.getState();
      await importSettings(JSON.stringify(importData));

      const state = useSettingsStore.getState();
      expect(state.preferences.confirmSessionTabDeletion).toBe(true);
    });
  });

  describe('Auto-Select First Tab Preference', () => {
    it('should have autoSelectFirstTab field in settings schema', () => {
      const state = useSettingsStore.getState();
      expect(state.preferences).toHaveProperty('autoSelectFirstTab');
    });

    it('should default autoSelectFirstTab to true', () => {
      const state = useSettingsStore.getState();
      expect(state.preferences.autoSelectFirstTab).toBe(true);
    });

    it('should validate autoSelectFirstTab as boolean', async () => {
      mockInvoke.mockResolvedValueOnce({});

      const { updatePreferences } = useSettingsStore.getState();

      // Valid boolean values should work
      await updatePreferences({ autoSelectFirstTab: true });
      expect(useSettingsStore.getState().preferences.autoSelectFirstTab).toBe(true);

      await updatePreferences({ autoSelectFirstTab: false });
      expect(useSettingsStore.getState().preferences.autoSelectFirstTab).toBe(false);
    });

    it('should update autoSelectFirstTab preference', async () => {
      mockInvoke.mockResolvedValueOnce({});

      const { updatePreferences } = useSettingsStore.getState();
      await updatePreferences({ autoSelectFirstTab: false });

      const state = useSettingsStore.getState();
      expect(state.preferences.autoSelectFirstTab).toBe(false);
      expect(mockInvoke).toHaveBeenCalledWith('config:updateSettings', {
        autoSelectFirstTab: false,
      });
    });

    it('should persist autoSelectFirstTab preference across initialization', async () => {
      const mockConfig = {
        settings: {
          autoSelectFirstTab: false,
        },
      };

      mockInvoke.mockResolvedValueOnce(mockConfig);

      const { initialize } = useSettingsStore.getState();
      await initialize();

      const state = useSettingsStore.getState();
      expect(state.preferences.autoSelectFirstTab).toBe(false);
    });

    it('should include autoSelectFirstTab in settings export', async () => {
      mockInvoke.mockResolvedValue({});

      const { updatePreferences, exportSettings } = useSettingsStore.getState();
      await updatePreferences({ autoSelectFirstTab: false });

      const exported = await exportSettings();
      const parsed = JSON.parse(exported);

      expect(parsed.preferences.autoSelectFirstTab).toBe(false);
    });

    it('should import autoSelectFirstTab from settings JSON', async () => {
      mockInvoke.mockResolvedValue({});

      const importData = {
        preferences: {
          autoSelectFirstTab: false,
        },
        version: '1.0',
        exportedAt: new Date().toISOString(),
      };

      const { importSettings } = useSettingsStore.getState();
      await importSettings(JSON.stringify(importData));

      const state = useSettingsStore.getState();
      expect(state.preferences.autoSelectFirstTab).toBe(false);
    });
  });
});
