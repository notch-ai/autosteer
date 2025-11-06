import {
  EditorConfig,
  EditorInstance,
  createEditor,
  destroyEditor,
  focusEditor,
  setEditorContent,
} from '@/features/chat/components/editor/setup';
import { Compartment, Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseCodeMirrorOptions {
  initialDoc?: string;
  extensions?: Extension[];
  readOnly?: boolean;
  placeholder?: string;
  onUpdate?: (content: string) => void;
}

export interface UseCodeMirrorReturn {
  ref: React.RefCallback<HTMLDivElement>;
  view: EditorView | null;
  content: string;
  setContent: (content: string) => void;
  focus: (cursorPosition?: number) => void;
  destroy: () => void;
}

export function useCodeMirror(options: UseCodeMirrorOptions = {}): UseCodeMirrorReturn {
  const { initialDoc = '', extensions = [], readOnly = false, placeholder, onUpdate } = options;

  const editorInstanceRef = useRef<EditorInstance | null>(null);
  const [view, setView] = useState<EditorView | null>(null);
  const [content, setContentState] = useState<string>(initialDoc);
  const extensionsCompartment = useRef(new Compartment());

  // Store onUpdate in a ref to avoid recreating the callback
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const destroy = useCallback(() => {
    if (editorInstanceRef.current) {
      destroyEditor(editorInstanceRef.current);
      editorInstanceRef.current = null;
      setView(null);
    }
  }, []);

  const containerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) {
        // React calls ref callback with null during reconciliation
        // Don't destroy editor here - it will be cleaned up in useEffect cleanup
        return;
      }

      // Avoid re-creating if already attached
      if (editorInstanceRef.current) {
        return;
      }

      const config: EditorConfig = {
        doc: initialDoc,
        extensions: [
          extensionsCompartment.current.of(extensions),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const newContent = update.state.doc.toString();
              setContentState(newContent);
              onUpdateRef.current?.(newContent);
            }
          }),
        ],
        parent: node,
        readOnly,
        ...(placeholder !== undefined && { placeholder }),
      };

      const instance = createEditor(config);
      editorInstanceRef.current = instance;
      setView(instance.view);
    },
    [initialDoc, readOnly, placeholder, destroy]
  );

  // Reconfigure extensions when they change
  useEffect(() => {
    if (editorInstanceRef.current && view) {
      view.dispatch({
        effects: extensionsCompartment.current.reconfigure(extensions),
      });
    }
  }, [extensions, view]);

  useEffect(() => {
    return () => {
      destroy();
    };
  }, [destroy]);

  const setContent = useCallback((newContent: string) => {
    if (editorInstanceRef.current) {
      setEditorContent(editorInstanceRef.current, newContent);
      setContentState(newContent);
    }
  }, []);

  const focus = useCallback((cursorPosition?: number) => {
    if (editorInstanceRef.current && !editorInstanceRef.current.view.hasFocus) {
      focusEditor(editorInstanceRef.current, cursorPosition);
    }
  }, []);

  return {
    ref: containerRef,
    view,
    content,
    setContent,
    focus,
    destroy,
  };
}
