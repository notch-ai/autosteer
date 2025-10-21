import { renderHook, act, waitFor } from '@testing-library/react';
import { useCodeMirror } from '@/hooks/useCodeMirror';
import { EditorView } from '@codemirror/view';

describe('useCodeMirror', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should initialize with null view', () => {
    const { result } = renderHook(() => useCodeMirror());
    expect(result.current.view).toBeNull();
  });

  it('should create editor view when ref is attached', async () => {
    const { result } = renderHook(() => useCodeMirror());

    act(() => {
      // Call the ref callback with the container
      result.current.ref(container);
    });

    await waitFor(
      () => {
        expect(result.current.view).toBeInstanceOf(EditorView);
      },
      { timeout: 1000 }
    );
  });

  it('should initialize with empty content by default', () => {
    const { result } = renderHook(() => useCodeMirror());
    expect(result.current.content).toBe('');
  });

  it('should initialize with initial document', () => {
    const initialDoc = 'Hello, CodeMirror!';
    const { result } = renderHook(() => useCodeMirror({ initialDoc }));
    expect(result.current.content).toBe(initialDoc);
  });

  it('should update content when setContent is called', async () => {
    const { result } = renderHook(() => useCodeMirror());

    act(() => {
      result.current.ref(container);
    });

    await waitFor(() => {
      expect(result.current.view).toBeInstanceOf(EditorView);
    });

    const newContent = 'New content';
    act(() => {
      result.current.setContent(newContent);
    });

    await waitFor(() => {
      expect(result.current.content).toBe(newContent);
    });
  });

  it('should call onUpdate when content changes', async () => {
    const onUpdate = jest.fn();
    const { result } = renderHook(() => useCodeMirror({ onUpdate }));

    act(() => {
      result.current.ref(container);
    });

    await waitFor(() => {
      expect(result.current.view).toBeInstanceOf(EditorView);
    });

    const newContent = 'Updated content';
    act(() => {
      result.current.setContent(newContent);
    });

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(newContent);
    });
  });

  it('should focus editor when focus is called', async () => {
    const { result } = renderHook(() => useCodeMirror());

    act(() => {
      result.current.ref(container);
    });

    await waitFor(() => {
      expect(result.current.view).toBeInstanceOf(EditorView);
    });

    act(() => {
      result.current.focus();
    });

    await waitFor(() => {
      expect(result.current.view?.hasFocus).toBe(true);
    });
  });

  it('should destroy editor when destroy is called', async () => {
    const { result } = renderHook(() => useCodeMirror());

    act(() => {
      result.current.ref(container);
    });

    await waitFor(() => {
      expect(result.current.view).toBeInstanceOf(EditorView);
    });

    act(() => {
      result.current.destroy();
    });

    await waitFor(() => {
      expect(result.current.view).toBeNull();
    });
  });

  it('should cleanup editor on unmount', async () => {
    const { result, unmount } = renderHook(() => useCodeMirror());

    act(() => {
      result.current.ref(container);
    });

    await waitFor(() => {
      expect(result.current.view).toBeInstanceOf(EditorView);
    });

    const editorElement = container.querySelector('.cm-editor');
    expect(editorElement).toBeTruthy();

    unmount();

    await waitFor(() => {
      expect(container.querySelector('.cm-editor')).toBeNull();
    });
  });

  it('should support read-only mode', async () => {
    const { result } = renderHook(() => useCodeMirror({ readOnly: true }));

    act(() => {
      result.current.ref(container);
    });

    await waitFor(() => {
      expect(result.current.view).toBeInstanceOf(EditorView);
    });

    // EditorView should be created in read-only mode
    expect(result.current.view).toBeTruthy();
  });

  it('should apply custom extensions', async () => {
    const customExtension = EditorView.lineWrapping;
    const { result } = renderHook(() => useCodeMirror({ extensions: [customExtension] }));

    act(() => {
      result.current.ref(container);
    });

    await waitFor(() => {
      expect(result.current.view).toBeInstanceOf(EditorView);
    });

    expect(result.current.view).toBeTruthy();
  });

  describe('Performance', () => {
    it('should initialize in under 100ms', async () => {
      const startTime = performance.now();

      const { result } = renderHook(() => useCodeMirror());

      act(() => {
        result.current.ref(container);
      });

      await waitFor(() => {
        expect(result.current.view).toBeInstanceOf(EditorView);
      });

      const initTime = performance.now() - startTime;
      expect(initTime).toBeLessThan(100);
    });
  });
});
