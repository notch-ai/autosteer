import {
  createEditorState,
  createEditorView,
  createEditor,
  destroyEditor,
  getEditorContent,
  setEditorContent,
  focusEditor,
} from '@/features/chat/components/editor/setup';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

describe('CodeMirror Setup', () => {
  describe('createEditorState', () => {
    it('should create an EditorState with empty document by default', () => {
      const state = createEditorState();
      expect(state).toBeInstanceOf(EditorState);
      expect(state.doc.toString()).toBe('');
    });

    it('should create an EditorState with initial document', () => {
      const doc = 'Hello, CodeMirror!';
      const state = createEditorState({ doc });
      expect(state.doc.toString()).toBe(doc);
    });

    it('should apply custom extensions', () => {
      const customExtension = EditorState.readOnly.of(true);
      const state = createEditorState({ extensions: [customExtension] });
      expect(state).toBeInstanceOf(EditorState);
    });
  });

  describe('createEditorView', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it('should create an EditorView', () => {
      const state = createEditorState();
      const view = createEditorView(state, { parent: container });
      expect(view).toBeInstanceOf(EditorView);
      view.destroy();
    });

    it('should mount EditorView to parent element', () => {
      const state = createEditorState();
      const view = createEditorView(state, { parent: container });
      expect(container.querySelector('.cm-editor')).toBeTruthy();
      view.destroy();
    });

    it('should create read-only editor when readOnly is true', () => {
      const state = createEditorState();
      const view = createEditorView(state, { parent: container, readOnly: true });
      expect(view.state.facet(EditorState.readOnly)).toBe(true);
      view.destroy();
    });
  });

  describe('createEditor', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it('should create editor instance with view and state', () => {
      const instance = createEditor({ parent: container });
      expect(instance.view).toBeInstanceOf(EditorView);
      expect(instance.state).toBeInstanceOf(EditorState);
      destroyEditor(instance);
    });

    it('should initialize editor in under 100ms', () => {
      const startTime = performance.now();
      const instance = createEditor({ parent: container });
      const initTime = performance.now() - startTime;
      expect(initTime).toBeLessThan(100);
      destroyEditor(instance);
    });

    it('should create editor with initial content', () => {
      const doc = 'Test content';
      const instance = createEditor({ doc, parent: container });
      expect(instance.state.doc.toString()).toBe(doc);
      destroyEditor(instance);
    });
  });

  describe('destroyEditor', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it('should destroy editor instance', () => {
      const instance = createEditor({ parent: container });
      destroyEditor(instance);
      expect(container.querySelector('.cm-editor')).toBeNull();
    });
  });

  describe('getEditorContent', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it('should get editor content', () => {
      const doc = 'Test content';
      const instance = createEditor({ doc, parent: container });
      expect(getEditorContent(instance)).toBe(doc);
      destroyEditor(instance);
    });
  });

  describe('setEditorContent', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it('should set editor content', () => {
      const instance = createEditor({ parent: container });
      const newContent = 'New content';
      setEditorContent(instance, newContent);
      expect(getEditorContent(instance)).toBe(newContent);
      destroyEditor(instance);
    });

    it('should replace existing content', () => {
      const instance = createEditor({ doc: 'Old content', parent: container });
      const newContent = 'New content';
      setEditorContent(instance, newContent);
      expect(getEditorContent(instance)).toBe(newContent);
      destroyEditor(instance);
    });
  });

  describe('focusEditor', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it('should focus editor', () => {
      const instance = createEditor({ parent: container });
      focusEditor(instance);
      expect(instance.view.hasFocus).toBe(true);
      destroyEditor(instance);
    });
  });

  describe('Performance Requirements', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it('should meet <100ms initialization target', () => {
      const iterations = 10;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const instance = createEditor({ parent: container });
        const time = performance.now() - start;
        times.push(time);
        destroyEditor(instance);
      }

      const avgTime = times.reduce((sum, t) => sum + t, 0) / iterations;
      expect(avgTime).toBeLessThan(100);
    });
  });
});
