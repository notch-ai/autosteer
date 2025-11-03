import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { createToolbarExtension } from '@/features/chat/components/editor/toolbar-extension';

describe('toolbar-extension', () => {
  let view: EditorView;
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    view?.destroy();
    container.remove();
  });

  describe('createToolbarExtension', () => {
    it('should create extension with keyboard shortcuts', () => {
      const extension = createToolbarExtension({});
      expect(extension).toBeDefined();
      expect(Array.isArray(extension)).toBe(true);
    });

    it('should handle Cmd+B for bold formatting', () => {
      const onFormat = jest.fn();
      const extension = createToolbarExtension({ onFormat });

      const state = EditorState.create({
        doc: 'Hello World',
        extensions: [extension],
      });

      view = new EditorView({
        state,
        parent: container,
      });

      // Select "World"
      view.dispatch({
        selection: { anchor: 6, head: 11 },
      });

      // Simulate Cmd+B
      const event = new KeyboardEvent('keydown', {
        key: 'b',
        metaKey: true,
        bubbles: true,
      });

      view.contentDOM.dispatchEvent(event);

      expect(onFormat).toHaveBeenCalledWith('bold', 'World');
    });

    it('should handle Cmd+I for italic formatting', () => {
      const onFormat = jest.fn();
      const extension = createToolbarExtension({ onFormat });

      const state = EditorState.create({
        doc: 'Hello World',
        extensions: [extension],
      });

      view = new EditorView({
        state,
        parent: container,
      });

      // Select "Hello"
      view.dispatch({
        selection: { anchor: 0, head: 5 },
      });

      // Simulate Cmd+I
      const event = new KeyboardEvent('keydown', {
        key: 'i',
        metaKey: true,
        bubbles: true,
      });

      view.contentDOM.dispatchEvent(event);

      expect(onFormat).toHaveBeenCalledWith('italic', 'Hello');
    });

    it('should not interfere with normal typing', () => {
      const onFormat = jest.fn();
      const extension = createToolbarExtension({ onFormat });

      const state = EditorState.create({
        doc: '',
        extensions: [extension],
      });

      view = new EditorView({
        state,
        parent: container,
      });

      // Type normal text
      view.dispatch({
        changes: { from: 0, insert: 'test' },
      });

      expect(view.state.doc.toString()).toBe('test');
      expect(onFormat).not.toHaveBeenCalled();
    });

    it('should handle Cmd+K for link insertion', () => {
      const onFormat = jest.fn();
      const extension = createToolbarExtension({ onFormat });

      const state = EditorState.create({
        doc: 'Click here',
        extensions: [extension],
      });

      view = new EditorView({
        state,
        parent: container,
      });

      // Select "here"
      view.dispatch({
        selection: { anchor: 6, head: 10 },
      });

      // Simulate Cmd+K
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        bubbles: true,
      });

      view.contentDOM.dispatchEvent(event);

      expect(onFormat).toHaveBeenCalledWith('link', 'here');
    });

    it('should work on Windows with Ctrl key', () => {
      const onFormat = jest.fn();
      const extension = createToolbarExtension({ onFormat });

      const state = EditorState.create({
        doc: 'Test',
        extensions: [extension],
      });

      view = new EditorView({
        state,
        parent: container,
      });

      view.dispatch({
        selection: { anchor: 0, head: 4 },
      });

      // Simulate Ctrl+B (Windows)
      const event = new KeyboardEvent('keydown', {
        key: 'b',
        ctrlKey: true,
        bubbles: true,
      });

      view.contentDOM.dispatchEvent(event);

      expect(onFormat).toHaveBeenCalledWith('bold', 'Test');
    });
  });
});
