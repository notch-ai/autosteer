import { renderHook, act } from '@testing-library/react';
import { useSettingsStore } from '@/stores/settings';

describe('SettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.getState().reset();
    jest.clearAllMocks();
  });

  describe('Permission Mode Initialization', () => {
    it('should initialize with default permission mode', () => {
      const { result } = renderHook(() => useSettingsStore());

      expect(result.current.preferences.defaultPermissionMode).toBe('acceptEdits');
    });

    it('should load permission mode from config on initialize', async () => {
      const mockConfig = {
        settings: {
          defaultPermissionMode: 'plan' as const,
          theme: 'dark' as const,
          fontSize: 'medium' as const,
          fontFamily: 'monospace',
          autoSave: true,
          compactOnTokenLimit: true,
          maxTokens: 4000,
          badgeNotifications: true,
        },
      };

      window.electron = {
        ipc: {
          invoke: jest.fn().mockResolvedValue(mockConfig),
        },
        slashCommands: {
          load: jest.fn().mockResolvedValue([]),
        },
        store: {
          get: jest.fn().mockResolvedValue(null),
        },
      } as any;

      const { result } = renderHook(() => useSettingsStore());

      await act(async () => {
        await result.current.initialize();
      });

      expect(result.current.preferences.defaultPermissionMode).toBe('plan');
    });
  });

  describe('Permission Mode Update', () => {
    beforeEach(() => {
      window.electron = {
        ipc: {
          invoke: jest.fn().mockResolvedValue({}),
        },
        slashCommands: {
          load: jest.fn().mockResolvedValue([]),
        },
        store: {
          get: jest.fn().mockResolvedValue(null),
        },
      } as any;
    });

    it('should update permission mode to plan', async () => {
      const { result } = renderHook(() => useSettingsStore());

      await act(async () => {
        await result.current.updatePreferences({ defaultPermissionMode: 'plan' });
      });

      expect(result.current.preferences.defaultPermissionMode).toBe('plan');
      expect(window.electron.ipc.invoke).toHaveBeenCalledWith('config:updateSettings', {
        defaultPermissionMode: 'plan',
      });
    });

    it('should update permission mode to edit', async () => {
      const { result } = renderHook(() => useSettingsStore());

      await act(async () => {
        await result.current.updatePreferences({ defaultPermissionMode: 'acceptEdits' });
      });

      expect(result.current.preferences.defaultPermissionMode).toBe('acceptEdits');
    });

    it('should update permission mode to bypass', async () => {
      const { result } = renderHook(() => useSettingsStore());

      await act(async () => {
        await result.current.updatePreferences({ defaultPermissionMode: 'bypassPermissions' });
      });

      expect(result.current.preferences.defaultPermissionMode).toBe('bypassPermissions');
    });

    it('should persist permission mode to config file', async () => {
      const { result } = renderHook(() => useSettingsStore());

      await act(async () => {
        await result.current.updatePreferences({ defaultPermissionMode: 'bypassPermissions' });
      });

      expect(window.electron.ipc.invoke).toHaveBeenCalledWith('config:updateSettings', {
        defaultPermissionMode: 'bypassPermissions',
      });
    });

    it('should revert permission mode on persistence failure', async () => {
      const mockError = new Error('Failed to persist');
      window.electron.ipc.invoke = jest.fn().mockRejectedValue(mockError);

      const { result } = renderHook(() => useSettingsStore());

      const originalMode = result.current.preferences.defaultPermissionMode;

      await expect(
        act(async () => {
          await result.current.updatePreferences({ defaultPermissionMode: 'bypassPermissions' });
        })
      ).rejects.toThrow('Failed to persist');

      expect(result.current.preferences.defaultPermissionMode).toBe(originalMode);
    });
  });

  describe('Permission Mode Handling', () => {
    it('should handle missing defaultPermissionMode in config', async () => {
      const mockConfig = {
        settings: {
          theme: 'dark' as const,
          fontSize: 'medium' as const,
          fontFamily: 'monospace',
          autoSave: true,
          compactOnTokenLimit: true,
          maxTokens: 4000,
          badgeNotifications: true,
        },
      };

      window.electron = {
        ipc: {
          invoke: jest.fn().mockResolvedValue(mockConfig),
        },
        slashCommands: {
          load: jest.fn().mockResolvedValue([]),
        },
        store: {
          get: jest.fn().mockResolvedValue(null),
        },
      } as any;

      const { result } = renderHook(() => useSettingsStore());

      await act(async () => {
        await result.current.initialize();
      });

      expect(result.current.preferences.defaultPermissionMode).toBe('acceptEdits');
    });
  });

  describe('Reset Preferences', () => {
    beforeEach(() => {
      window.electron = {
        ipc: {
          invoke: jest.fn().mockResolvedValue({}),
        },
        slashCommands: {
          load: jest.fn().mockResolvedValue([]),
        },
        store: {
          get: jest.fn().mockResolvedValue(null),
        },
      } as any;
    });

    it('should reset permission mode to default on resetPreferences', async () => {
      const { result } = renderHook(() => useSettingsStore());

      await act(async () => {
        await result.current.updatePreferences({ defaultPermissionMode: 'bypassPermissions' });
      });

      expect(result.current.preferences.defaultPermissionMode).toBe('bypassPermissions');

      await act(async () => {
        await result.current.resetPreferences();
      });

      expect(result.current.preferences.defaultPermissionMode).toBe('acceptEdits');
    });
  });

  describe('Export and Import Settings', () => {
    beforeEach(() => {
      window.electron = {
        ipc: {
          invoke: jest.fn().mockResolvedValue({}),
        },
        slashCommands: {
          load: jest.fn().mockResolvedValue([]),
        },
        store: {
          get: jest.fn().mockResolvedValue(null),
        },
      } as any;
    });

    it('should include defaultPermissionMode in exported settings', async () => {
      const { result } = renderHook(() => useSettingsStore());

      await act(async () => {
        await result.current.updatePreferences({ defaultPermissionMode: 'plan' });
      });

      const exported = await act(async () => {
        return await result.current.exportSettings();
      });

      const parsed = JSON.parse(exported);
      expect(parsed.preferences.defaultPermissionMode).toBe('plan');
    });

    it('should import defaultPermissionMode from settings', async () => {
      const { result } = renderHook(() => useSettingsStore());

      const importData = {
        preferences: {
          defaultPermissionMode: 'bypassPermissions',
          theme: 'dark' as const,
          fontSize: 'medium' as const,
          fontFamily: 'monospace',
          autoSave: true,
          compactOnTokenLimit: true,
          maxTokens: 4000,
          badgeNotifications: true,
        },
        version: '1.0',
      };

      await act(async () => {
        await result.current.importSettings(JSON.stringify(importData));
      });

      expect(result.current.preferences.defaultPermissionMode).toBe('bypassPermissions');
    });
  });
});
