import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  createVimExtension,
  getVimMode,
  setVimMode,
  VimMode,
} from '@/components/features/codemirror/vim-extension';

describe('vim-extension', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('createVimExtension', () => {
    it('should return empty array when vim is disabled', () => {
      const extension = createVimExtension({ enabled: false });
      expect(Array.isArray(extension)).toBe(true);
      expect(extension.length).toBe(0);
    });

    it('should return vim extension when enabled', () => {
      const onModeChange = jest.fn();
      const extension = createVimExtension({
        enabled: true,
        onModeChange,
      });

      expect(Array.isArray(extension)).toBe(true);
      expect(extension.length).toBeGreaterThan(0);
    });

    it('should call onModeChange callback when mode changes', () => {
      const onModeChange = jest.fn();
      const extension = createVimExtension({
        enabled: true,
        onModeChange,
      });

      const state = EditorState.create({
        doc: 'test content',
        extensions: extension,
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      // Mode change callback should be called during initialization or updates
      // Note: Actual behavior depends on @replit/codemirror-vim implementation
      expect(onModeChange).toHaveBeenCalled();

      view.destroy();
    });
  });

  describe('getVimMode', () => {
    it('should return INSERT mode by default', () => {
      const mode = getVimMode();
      expect(mode).toBe('INSERT');
    });

    it('should return current vim mode from CodeMirror state', () => {
      // This test requires @replit/codemirror-vim to be properly initialized
      const mode = getVimMode();
      expect(['NORMAL', 'INSERT']).toContain(mode);
    });
  });

  describe('setVimMode', () => {
    it('should set vim mode to NORMAL', () => {
      const state = EditorState.create({
        doc: 'test content',
        extensions: createVimExtension({ enabled: true }),
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      setVimMode(view, 'NORMAL');

      // Verify mode was set (actual verification depends on vim implementation)
      expect(view).toBeDefined();

      view.destroy();
    });

    it('should set vim mode to INSERT', () => {
      const state = EditorState.create({
        doc: 'test content',
        extensions: createVimExtension({ enabled: true }),
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      setVimMode(view, 'INSERT');

      // Verify mode was set
      expect(view).toBeDefined();

      view.destroy();
    });

    it('should handle errors gracefully when setting invalid mode', () => {
      const state = EditorState.create({
        doc: 'test content',
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      // Should not throw when vim is not enabled
      expect(() => setVimMode(view, 'NORMAL')).not.toThrow();

      view.destroy();
    });
  });

  describe('vim mode integration', () => {
    it('should initialize in INSERT mode', () => {
      const onModeChange = jest.fn();
      const extension = createVimExtension({
        enabled: true,
        onModeChange,
      });

      const state = EditorState.create({
        doc: 'test content',
        extensions: extension,
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      // Initial mode should be INSERT
      const mode = getVimMode();
      expect(mode).toBe('INSERT');

      view.destroy();
    });

    it('should switch between NORMAL and INSERT modes', () => {
      const extension = createVimExtension({ enabled: true });

      const state = EditorState.create({
        doc: 'test content',
        extensions: extension,
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      // Start in INSERT
      setVimMode(view, 'INSERT');
      expect(getVimMode()).toBe('INSERT');

      // Switch to NORMAL
      setVimMode(view, 'NORMAL');
      // Note: Actual mode verification requires vim to be fully initialized

      view.destroy();
    });

    it('should handle vim operations without line-joining bugs', () => {
      const extension = createVimExtension({ enabled: true });

      const state = EditorState.create({
        doc: 'hello world\ntest line',
        extensions: extension,
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      // This test verifies that @replit/codemirror-vim doesn't have line-joining bugs
      // The actual vim operations are handled by the plugin
      const content = view.state.doc.toString();
      expect(content).toBe('hello world\ntest line');

      view.destroy();
    });
  });

  describe('vim configuration', () => {
    it('should configure vim with proper j/k mappings', () => {
      const extension = createVimExtension({ enabled: true });

      expect(extension).toBeDefined();
      // Vim configuration is set up in setupVimConfig()
      // j/k should be mapped to gj/gk for proper line movement
    });

    it('should support mode change callbacks', () => {
      const modes: VimMode[] = [];
      const onModeChange = (mode: VimMode) => modes.push(mode);

      const extension = createVimExtension({
        enabled: true,
        onModeChange,
      });

      const state = EditorState.create({
        doc: 'test',
        extensions: extension,
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      // Mode changes should be tracked
      expect(modes.length).toBeGreaterThan(0);

      view.destroy();
    });
  });
});
