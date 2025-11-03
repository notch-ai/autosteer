import { useEffect, useCallback, useState } from 'react';
import { EditorView } from '@codemirror/view';
import { VimMode, getVimMode, setVimMode } from '@/features/chat/components/editor/vim-extension';

export interface UseVimModeOptions {
  editorView: EditorView | null;
  onModeChange?: (mode: VimMode) => void;
}

export function useVimMode(options: UseVimModeOptions) {
  const { editorView, onModeChange } = options;
  const [vimEnabled, setVimEnabled] = useState(false);
  const [currentMode, setCurrentMode] = useState<VimMode>('INSERT');

  // Check vim mode setting on mount and when it changes
  useEffect(() => {
    const checkVimMode = async () => {
      try {
        // Try to read from config file first
        const enabled = await window.electron.worktree.getVimMode();
        setVimEnabled(enabled);
      } catch (error) {
        // Fallback to localStorage for backwards compatibility
        const enabled = localStorage.getItem('vimModeEnabled') !== 'false';
        setVimEnabled(enabled);
      }
    };

    void checkVimMode();

    // Also check localStorage changes for compatibility
    const handleStorageChange = () => {
      void checkVimMode();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Poll for vim mode changes from CodeMirror
  useEffect(() => {
    if (!editorView || !vimEnabled) return;

    const checkMode = () => {
      const mode = getVimMode();
      if (mode !== currentMode) {
        setCurrentMode(mode);
        onModeChange?.(mode);
      }
    };

    // Check mode on a regular interval
    const interval = setInterval(checkMode, 100);

    return () => clearInterval(interval);
  }, [editorView, vimEnabled, currentMode, onModeChange]);

  const handleSetVimMode = useCallback(
    (mode: VimMode) => {
      if (!editorView) return;

      setVimMode(editorView, mode);
      setCurrentMode(mode);
      onModeChange?.(mode);
    },
    [editorView, onModeChange]
  );

  return {
    mode: currentMode,
    isNormalMode: currentMode === 'NORMAL',
    isInsertMode: currentMode === 'INSERT',
    vimEnabled,
    setVimMode: handleSetVimMode,
    setVimEnabled,
  };
}
