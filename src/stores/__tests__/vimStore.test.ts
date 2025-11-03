import { describe, it, expect } from '@jest/globals';
import { createVimSlice, VimSlice } from '@/stores/vimStore';
import { create } from 'zustand';

// Helper to create a test store with VimSlice
const createTestStore = () => {
  return create<VimSlice>()((...args) => createVimSlice(...args));
};

describe('VimStore Slice', () => {
  describe('Initial State', () => {
    it('should initialize with default vim state', () => {
      const store = createTestStore();
      const state = store.getState();

      expect(state.vim).toEqual({
        mode: 'INSERT',
        enabled: false,
      });
    });
  });

  describe('setVimMode', () => {
    it('should set vim mode to NORMAL', () => {
      const store = createTestStore();
      const { setVimMode } = store.getState();

      setVimMode('NORMAL');

      const state = store.getState();
      expect(state.vim.mode).toBe('NORMAL');
    });

    it('should set vim mode to INSERT', () => {
      const store = createTestStore();
      const { setVimMode } = store.getState();

      setVimMode('INSERT');

      const state = store.getState();
      expect(state.vim.mode).toBe('INSERT');
    });

    it('should change between NORMAL and INSERT modes', () => {
      const store = createTestStore();
      const { setVimMode } = store.getState();

      setVimMode('NORMAL');
      expect(store.getState().vim.mode).toBe('NORMAL');

      setVimMode('INSERT');
      expect(store.getState().vim.mode).toBe('INSERT');
    });

    it('should preserve enabled state when changing mode', () => {
      const store = createTestStore();
      const { setVimMode, setVimEnabled } = store.getState();

      setVimEnabled(true);
      setVimMode('INSERT');

      const state = store.getState();
      expect(state.vim.mode).toBe('INSERT');
      expect(state.vim.enabled).toBe(true);
    });
  });

  describe('setVimEnabled', () => {
    it('should enable vim mode', () => {
      const store = createTestStore();
      const { setVimEnabled } = store.getState();

      setVimEnabled(true);

      const state = store.getState();
      expect(state.vim.enabled).toBe(true);
      expect(state.vim.mode).toBe('NORMAL'); // Should switch to NORMAL when enabled
    });

    it('should disable vim mode', () => {
      const store = createTestStore();
      const { setVimEnabled } = store.getState();

      // First enable
      setVimEnabled(true);

      // Then disable
      setVimEnabled(false);

      const state = store.getState();
      expect(state.vim.enabled).toBe(false);
      expect(state.vim.mode).toBe('INSERT'); // Should switch to INSERT when disabled
    });

    it('should set mode to NORMAL when enabling', () => {
      const store = createTestStore();
      const { setVimEnabled } = store.getState();

      // Start in INSERT mode (default)
      expect(store.getState().vim.mode).toBe('INSERT');

      // Enable vim
      setVimEnabled(true);

      const state = store.getState();
      expect(state.vim.mode).toBe('NORMAL');
    });

    it('should set mode to INSERT when disabling', () => {
      const store = createTestStore();
      const { setVimEnabled } = store.getState();

      // Enable (sets to NORMAL)
      setVimEnabled(true);
      expect(store.getState().vim.mode).toBe('NORMAL');

      // Disable vim (sets back to INSERT)
      setVimEnabled(false);

      const state = store.getState();
      expect(state.vim.mode).toBe('INSERT');
    });
  });

  describe('resetVimState', () => {
    it('should reset vim state to initial values', () => {
      const store = createTestStore();
      const { setVimEnabled, setVimMode, resetVimState } = store.getState();

      // Modify state
      setVimEnabled(true);
      setVimMode('NORMAL');

      // Reset
      resetVimState();

      const state = store.getState();
      expect(state.vim).toEqual({
        mode: 'INSERT',
        enabled: false,
      });
    });

    it('should reset from any mode', () => {
      const store = createTestStore();
      const { setVimMode, resetVimState } = store.getState();

      setVimMode('NORMAL');
      resetVimState();

      let state = store.getState();
      expect(state.vim.mode).toBe('INSERT');
      expect(state.vim.enabled).toBe(false);

      setVimMode('INSERT');
      resetVimState();

      state = store.getState();
      expect(state.vim.mode).toBe('INSERT');
      expect(state.vim.enabled).toBe(false);
    });
  });

  describe('Mode Transitions', () => {
    it('should transition between all modes', () => {
      const store = createTestStore();
      const { setVimMode } = store.getState();

      const modes: Array<'NORMAL' | 'INSERT'> = ['NORMAL', 'INSERT'];

      modes.forEach((mode) => {
        setVimMode(mode);
        expect(store.getState().vim.mode).toBe(mode);
      });
    });

    it('should allow multiple enable/disable cycles', () => {
      const store = createTestStore();
      const { setVimEnabled } = store.getState();

      // Cycle 1
      setVimEnabled(true);
      expect(store.getState().vim.enabled).toBe(true);
      setVimEnabled(false);
      expect(store.getState().vim.enabled).toBe(false);

      // Cycle 2
      setVimEnabled(true);
      expect(store.getState().vim.enabled).toBe(true);
      setVimEnabled(false);
      expect(store.getState().vim.enabled).toBe(false);
    });
  });

  describe('State Immutability', () => {
    it('should not mutate state directly', () => {
      const store = createTestStore();
      const { setVimMode } = store.getState();

      const stateBefore = store.getState().vim;
      setVimMode('NORMAL');
      const stateAfter = store.getState().vim;

      // State objects should be different references
      expect(stateBefore).not.toBe(stateAfter);
    });
  });

  describe('Integration with Store', () => {
    it('should work as part of a larger store', () => {
      // Create a store that includes VimSlice plus other state
      interface TestStore extends VimSlice {
        counter: number;
        incrementCounter: () => void;
      }

      const testStore = create<TestStore>()((set, get, store) => ({
        ...createVimSlice(set, get, store),
        counter: 0,
        incrementCounter: () => set((state) => ({ counter: state.counter + 1 })),
      }));

      // Test vim functionality
      testStore.getState().setVimEnabled(true);
      expect(testStore.getState().vim.enabled).toBe(true);

      // Test other store functionality
      testStore.getState().incrementCounter();
      expect(testStore.getState().counter).toBe(1);

      // Verify vim state is preserved
      expect(testStore.getState().vim.enabled).toBe(true);
    });
  });
});
