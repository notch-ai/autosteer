import { StateCreator } from 'zustand';
import { VimMode } from '@/components/features/codemirror/vim-extension';

export interface VimState {
  mode: VimMode;
  enabled: boolean;
}

export interface VimSlice {
  vim: VimState;
  setVimMode: (mode: VimMode) => void;
  setVimEnabled: (enabled: boolean) => void;
  resetVimState: () => void;
}

const initialVimState: VimState = {
  mode: 'INSERT',
  enabled: false,
};

export const createVimSlice: StateCreator<VimSlice, [], [], VimSlice> = (set) => ({
  vim: initialVimState,

  setVimMode: (mode) =>
    set((state) => ({
      vim: {
        ...state.vim,
        mode,
      },
    })),

  setVimEnabled: (enabled) =>
    set((state) => ({
      vim: {
        ...state.vim,
        enabled,
        mode: enabled ? 'NORMAL' : 'INSERT',
      },
    })),

  resetVimState: () =>
    set(() => ({
      vim: initialVimState,
    })),
});
