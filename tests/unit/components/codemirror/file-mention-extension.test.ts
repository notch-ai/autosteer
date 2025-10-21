import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  createFileMentionExtension,
  insertFileMention,
} from '../../../../src/components/features/codemirror/file-mention-extension';

describe('file-mention-extension', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('createFileMentionExtension', () => {
    it('should create extension with default options', () => {
      const extension = createFileMentionExtension({});
      expect(extension).toBeDefined();
      expect(Array.isArray(extension)).toBe(true);
    });

    it('should detect @file syntax and trigger onTrigger callback', () => {
      const onTrigger = jest.fn();
      const extension = createFileMentionExtension({ onTrigger });

      const state = EditorState.create({
        doc: '@',
        extensions: [extension],
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      // Simulate typing after @
      view.dispatch({
        changes: { from: 1, insert: 'f' },
      });

      expect(onTrigger).toHaveBeenCalledWith(
        'f',
        expect.objectContaining({
          top: expect.any(Number),
          left: expect.any(Number),
        })
      );

      view.destroy();
    });

    it('should hide file mention picker when @ is deleted', () => {
      const onTrigger = jest.fn();
      const onHide = jest.fn();
      const extension = createFileMentionExtension({ onTrigger, onHide });

      const state = EditorState.create({
        doc: '@file',
        extensions: [extension],
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      // Delete the @ symbol
      view.dispatch({
        changes: { from: 0, to: 5, insert: '' },
      });

      expect(onHide).toHaveBeenCalled();

      view.destroy();
    });

    it('should support autocomplete when typing @', () => {
      const onTrigger = jest.fn();
      const extension = createFileMentionExtension({ onTrigger });

      const state = EditorState.create({
        doc: 'Check @src',
        extensions: [extension],
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      expect(onTrigger).toHaveBeenCalledWith(
        'src',
        expect.objectContaining({
          top: expect.any(Number),
          left: expect.any(Number),
        })
      );

      view.destroy();
    });

    it('should only trigger at word boundaries', () => {
      const onTrigger = jest.fn();
      const extension = createFileMentionExtension({ onTrigger });

      const state = EditorState.create({
        doc: 'email@test.com',
        extensions: [extension],
      });

      new EditorView({
        state,
        parent: container,
      });

      // Should not trigger for @ in middle of word
      expect(onTrigger).not.toHaveBeenCalled();
    });
  });

  describe('insertFileMention', () => {
    it('should insert file mention and replace @ trigger', () => {
      const extension = createFileMentionExtension({});

      const state = EditorState.create({
        doc: '@src',
        extensions: [extension],
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      // Position cursor after @src
      view.dispatch({
        selection: { anchor: 4 },
      });

      insertFileMention(view, 'src/components/App.tsx');

      expect(view.state.doc.toString()).toContain('src/components/App.tsx');
      expect(view.state.doc.toString()).not.toContain('@src');

      view.destroy();
    });

    it('should insert file mention at current cursor position', () => {
      const extension = createFileMentionExtension({});

      const state = EditorState.create({
        doc: 'Check @',
        extensions: [extension],
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      view.dispatch({
        selection: { anchor: 7 },
      });

      insertFileMention(view, 'README.md');

      expect(view.state.doc.toString()).toBe('Check README.md');

      view.destroy();
    });

    it('should handle file paths with special characters', () => {
      const extension = createFileMentionExtension({});

      const state = EditorState.create({
        doc: '@',
        extensions: [extension],
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      insertFileMention(view, 'src/components/Button-v2.tsx');

      expect(view.state.doc.toString()).toContain('Button-v2.tsx');

      view.destroy();
    });
  });

  describe('performance', () => {
    it('should handle file mention detection in <16ms', () => {
      const extension = createFileMentionExtension({ onTrigger: jest.fn() });

      const state = EditorState.create({
        doc: '@',
        extensions: [extension],
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      const start = performance.now();

      view.dispatch({
        changes: { from: 1, insert: 'test' },
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(16);

      view.destroy();
    });

    it('should handle large documents efficiently', () => {
      const extension = createFileMentionExtension({ onTrigger: jest.fn() });

      const largeDoc = 'line\n'.repeat(1000) + '@file';

      const state = EditorState.create({
        doc: largeDoc,
        extensions: [extension],
      });

      const start = performance.now();

      const view = new EditorView({
        state,
        parent: container,
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);

      view.destroy();
    });
  });
});
