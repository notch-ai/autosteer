import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  createSlashCommandExtension,
  insertSlashCommand,
} from '../../../../src/components/features/codemirror/slash-command-extension';

describe('slash-command-extension', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('createSlashCommandExtension', () => {
    it('should create extension with default options', () => {
      const extension = createSlashCommandExtension({});
      expect(extension).toBeDefined();
      expect(Array.isArray(extension)).toBe(true);
    });

    it('should detect / command and trigger onTrigger callback', () => {
      const onTrigger = jest.fn();
      const extension = createSlashCommandExtension({ onTrigger });

      const state = EditorState.create({
        doc: '/',
        extensions: [extension],
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      // Simulate typing after /
      view.dispatch({
        changes: { from: 1, insert: 't' },
      });

      expect(onTrigger).toHaveBeenCalledWith(
        't',
        expect.objectContaining({
          top: expect.any(Number),
          left: expect.any(Number),
        })
      );

      view.destroy();
    });

    it('should hide command picker when / is deleted', () => {
      const onTrigger = jest.fn();
      const onHide = jest.fn();
      const extension = createSlashCommandExtension({ onTrigger, onHide });

      const state = EditorState.create({
        doc: '/task',
        extensions: [extension],
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      // Delete the / symbol
      view.dispatch({
        changes: { from: 0, to: 5, insert: '' },
      });

      expect(onHide).toHaveBeenCalled();

      view.destroy();
    });

    it('should support autocomplete when typing /', () => {
      const onTrigger = jest.fn();
      const extension = createSlashCommandExtension({ onTrigger });

      const state = EditorState.create({
        doc: '/tas',
        extensions: [extension],
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      expect(onTrigger).toHaveBeenCalledWith(
        'tas',
        expect.objectContaining({
          top: expect.any(Number),
          left: expect.any(Number),
        })
      );

      view.destroy();
    });

    it('should only trigger at start of line', () => {
      const onTrigger = jest.fn();
      const extension = createSlashCommandExtension({ onTrigger });

      const state = EditorState.create({
        doc: 'text /command',
        extensions: [extension],
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      // Should not trigger for / in middle of line with content before it
      expect(onTrigger).not.toHaveBeenCalled();

      view.destroy();
    });

    it('should handle multiple slash commands in sequence', () => {
      const onTrigger = jest.fn();
      const extension = createSlashCommandExtension({ onTrigger });

      const state = EditorState.create({
        doc: '/task',
        extensions: [extension],
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      // First command
      expect(onTrigger).toHaveBeenCalledWith('task', expect.any(Object));

      // Clear and type new command
      view.dispatch({
        changes: { from: 0, to: 5, insert: '/h1' },
      });

      expect(onTrigger).toHaveBeenCalledWith('h1', expect.any(Object));

      view.destroy();
    });
  });

  describe('insertSlashCommand', () => {
    it('should insert command and replace / trigger', () => {
      const extension = createSlashCommandExtension({});

      const state = EditorState.create({
        doc: '/task',
        extensions: [extension],
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      // Position cursor after /task
      view.dispatch({
        selection: { anchor: 5 },
      });

      insertSlashCommand(view, '- [ ] ');

      expect(view.state.doc.toString()).toBe('- [ ] ');
      expect(view.state.doc.toString()).not.toContain('/task');

      view.destroy();
    });

    it('should insert command at current cursor position', () => {
      const extension = createSlashCommandExtension({});

      const state = EditorState.create({
        doc: '/',
        extensions: [extension],
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      view.dispatch({
        selection: { anchor: 1 },
      });

      insertSlashCommand(view, '# Heading');

      expect(view.state.doc.toString()).toBe('# Heading');

      view.destroy();
    });

    it('should handle partial command queries', () => {
      const extension = createSlashCommandExtension({});

      const state = EditorState.create({
        doc: '/ta',
        extensions: [extension],
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      view.dispatch({
        selection: { anchor: 3 },
      });

      insertSlashCommand(view, '- [ ] ');

      expect(view.state.doc.toString()).toBe('- [ ] ');
      expect(view.state.doc.toString()).not.toContain('/ta');

      view.destroy();
    });

    it('should handle commands with special characters', () => {
      const extension = createSlashCommandExtension({});

      const state = EditorState.create({
        doc: '/div',
        extensions: [extension],
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      insertSlashCommand(view, '---');

      expect(view.state.doc.toString()).toBe('---');

      view.destroy();
    });
  });

  describe('performance', () => {
    it('should handle slash command detection in <16ms', () => {
      const extension = createSlashCommandExtension({ onTrigger: jest.fn() });

      const state = EditorState.create({
        doc: '/',
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
      const extension = createSlashCommandExtension({ onTrigger: jest.fn() });

      const largeDoc = 'line\n'.repeat(1000) + '/command';

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

  describe('edge cases', () => {
    it('should handle empty document', () => {
      const onTrigger = jest.fn();
      const extension = createSlashCommandExtension({ onTrigger });

      const state = EditorState.create({
        doc: '',
        extensions: [extension],
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      view.dispatch({
        changes: { from: 0, insert: '/' },
      });

      expect(onTrigger).toHaveBeenCalledWith('', expect.any(Object));

      view.destroy();
    });

    it('should handle rapid typing', () => {
      const onTrigger = jest.fn();
      const extension = createSlashCommandExtension({ onTrigger });

      const state = EditorState.create({
        doc: '/',
        extensions: [extension],
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      // Rapid typing simulation
      'task'.split('').forEach((char) => {
        view.dispatch({
          changes: { from: view.state.doc.length, insert: char },
        });
      });

      expect(onTrigger).toHaveBeenCalledWith('task', expect.any(Object));

      view.destroy();
    });
  });
});
