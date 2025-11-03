import React, { useEffect, useState } from 'react';
import { useUIStore } from '@/stores/ui';
import type { VimModeIndicatorProps } from '@/features/settings/types';

export const VimModeIndicator: React.FC<VimModeIndicatorProps> = ({
  enabled: propEnabled,
  mode: propMode,
  onToggle,
}) => {
  const vimMode = useUIStore((state) => state.vimMode.mode);
  const [vimEnabled, setVimEnabled] = useState(propEnabled ?? false);

  useEffect(() => {
    if (propEnabled !== undefined) {
      setVimEnabled(propEnabled);
      return;
    }

    const checkVimMode = async () => {
      try {
        const enabled = await window.electron.worktree.getVimMode();
        setVimEnabled(enabled);
      } catch (error) {
        const enabled = localStorage.getItem('vimModeEnabled') !== 'false';
        setVimEnabled(enabled);
      }
    };
    void checkVimMode();

    // Listen for storage changes (settings updates)
    const handleStorageChange = () => {
      void checkVimMode();
    };
    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom settings change event if available
    const handleSettingsChange = () => {
      void checkVimMode();
    };
    window.addEventListener('vimModeChanged', handleSettingsChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('vimModeChanged', handleSettingsChange);
    };
  }, [propEnabled]);

  // Only show indicator when VIM mode is enabled
  if (!vimEnabled) {
    return null;
  }

  // Use prop mode if provided, otherwise use store mode
  const currentMode = propMode || vimMode;
  // Only show INSERT or NORMAL modes
  const displayMode = currentMode === 'INSERT' || currentMode === 'NORMAL' ? currentMode : 'NORMAL';

  return (
    <div data-testid="vim-mode-indicator" className="vim-mode-indicator">
      <span data-testid="vim-mode-text">{displayMode}</span>
      {onToggle && (
        <button onClick={onToggle} className="vim-mode-toggle" aria-label="Toggle Vim Mode">
          ⚙️
        </button>
      )}
    </div>
  );
};
