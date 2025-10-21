import { useCallback, useState, RefObject } from 'react';
import { EditorView } from '@codemirror/view';

interface UseRichTextEditorReturn {
  selectedText: string;
  cursorPosition: number;
  formatBold: () => void;
  formatItalic: () => void;
  formatStrikethrough: () => void;
  insertLink: (url: string, text?: string, openInNewTab?: boolean) => void;
  insertList: (type: 'ul' | 'ol' | 'task') => void;
  insertEmoji: (emoji: string) => void;
  insertMention: (mention: string) => void;
  getPlainText: () => string;
  setContent: (content: string) => void;
  handleKeyCommand: (e: React.KeyboardEvent) => boolean;
  // New properties for pickers
  showEmojiPicker: boolean;
  setShowEmojiPicker: (show: boolean) => void;
  showMentionPicker: boolean;
  setShowMentionPicker: (show: boolean) => void;
  mentionQuery: string;
  showSlashCommands: boolean;
  setShowSlashCommands: (show: boolean) => void;
  slashQuery: string;
  setSlashQuery: (query: string) => void;
  pickerPosition: {
    top?: number;
    bottom?: number;
    left: number;
    width?: number;
    maxHeight?: number;
  } | null;
  setPickerPosition: (
    position: {
      top?: number;
      bottom?: number;
      left: number;
      width?: number;
      maxHeight?: number;
    } | null
  ) => void;
  handleInput: (e: React.FormEvent<HTMLDivElement>) => void;
  executeSlashCommand: (command: string) => void;
  closeSlashCommands: () => void;
  // File mentions properties
  showFileMentions: boolean;
  setShowFileMentions: (show: boolean) => void;
  fileMentionQuery: string;
  setFileMentionQuery: (query: string) => void;
  insertFileMention: (filePath: string) => void;
  closeFileMentions: () => void;
  // New formatting methods
  formatTextSize: (size: string) => void;
  formatTextColor: (color: string) => void;
  clearFormatting: () => void;
  insertBlockquote: () => void;
  insertCodeBlock: () => void;
  insertHorizontalRule: () => void;
  getSelectedText: () => string;
  hasSelection: () => boolean;
}

/**
 * CodeMirror-based rich text editor hook
 * Refactored to use CodeMirror EditorView instead of contentEditable
 * Maintains existing API surface for backward compatibility
 */
export function useRichTextEditorCodeMirror(
  editorViewRef: RefObject<EditorView | null>
): UseRichTextEditorReturn {
  // Picker states
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showSlashCommands, setShowSlashCommands] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [showFileMentions, setShowFileMentions] = useState(false);
  const [fileMentionQuery, setFileMentionQuery] = useState('');
  const [pickerPosition, setPickerPosition] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width?: number;
    maxHeight?: number;
  } | null>(null);

  // Get selected text from CodeMirror
  const getSelectedText = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return '';

    const { from, to } = view.state.selection.main;
    return view.state.doc.sliceString(from, to);
  }, [editorViewRef]);

  // Check if has selection
  const hasSelection = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return false;

    const { from, to } = view.state.selection.main;
    return from !== to;
  }, [editorViewRef]);

  // Insert text at current cursor position
  const insertText = useCallback(
    (text: string) => {
      const view = editorViewRef.current;
      if (!view) return;

      const { from, to } = view.state.selection.main;
      view.dispatch({
        changes: { from, to, insert: text },
      });
    },
    [editorViewRef]
  );

  // Format bold (wrap with **)
  const formatBold = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return;

    const selected = getSelectedText();
    if (selected) {
      insertText(`**${selected}**`);
    }
  }, [editorViewRef, getSelectedText, insertText]);

  // Format italic (wrap with *)
  const formatItalic = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return;

    const selected = getSelectedText();
    if (selected) {
      insertText(`*${selected}*`);
    }
  }, [editorViewRef, getSelectedText, insertText]);

  // Format strikethrough (wrap with ~~)
  const formatStrikethrough = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return;

    const selected = getSelectedText();
    if (selected) {
      insertText(`~~${selected}~~`);
    }
  }, [editorViewRef, getSelectedText, insertText]);

  // Insert link
  const insertLink = useCallback(
    (url: string, text?: string, _openInNewTab: boolean = true) => {
      const linkText = text || getSelectedText() || url;
      insertText(`[${linkText}](${url})`);
    },
    [getSelectedText, insertText]
  );

  // Insert list
  const insertList = useCallback(
    (type: 'ul' | 'ol' | 'task') => {
      const view = editorViewRef.current;
      if (!view) return;

      let prefix = '';
      switch (type) {
        case 'ul':
          prefix = '- ';
          break;
        case 'ol':
          prefix = '1. ';
          break;
        case 'task':
          prefix = '- [ ] ';
          break;
      }

      insertText(`\n${prefix}`);
    },
    [editorViewRef, insertText]
  );

  // Insert emoji
  const insertEmoji = useCallback(
    (emoji: string) => {
      insertText(emoji);
      setShowEmojiPicker(false);
    },
    [insertText]
  );

  // Insert mention
  const insertMention = useCallback(
    (mention: string) => {
      insertText(`@${mention} `);
      setShowMentionPicker(false);
      setMentionQuery('');
    },
    [insertText]
  );

  // Insert file mention
  const insertFileMention = useCallback(
    (filePath: string) => {
      insertText(filePath);
      setShowFileMentions(false);
      setFileMentionQuery('');
    },
    [insertText]
  );

  // Get plain text
  const getPlainText = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return '';
    return view.state.doc.toString();
  }, [editorViewRef]);

  // Set content
  const setContent = useCallback(
    (content: string) => {
      const view = editorViewRef.current;
      if (!view) return;

      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: content,
        },
      });
    },
    [editorViewRef]
  );

  // Format text size
  const formatTextSize = useCallback(
    (size: string) => {
      const view = editorViewRef.current;
      if (!view) return;

      const selected = getSelectedText();
      let formatted = '';

      switch (size) {
        case 'h1':
          formatted = `# ${selected}`;
          break;
        case 'h2':
          formatted = `## ${selected}`;
          break;
        case 'h3':
          formatted = `### ${selected}`;
          break;
        default:
          formatted = selected;
      }

      if (formatted !== selected) {
        insertText(formatted);
      }
    },
    [editorViewRef, getSelectedText, insertText]
  );

  // Format text color (no-op for markdown)
  const formatTextColor = useCallback((_color: string) => {
    // Markdown doesn't support colors natively
    // Could be extended with HTML if needed
  }, []);

  // Clear formatting (no-op for plain text)
  const clearFormatting = useCallback(() => {
    // In markdown/plain text, this would remove markdown syntax
    const selected = getSelectedText();
    if (selected) {
      // Remove markdown formatting characters
      const cleaned = selected.replace(/[*_~`#[\]()]/g, '');
      insertText(cleaned);
    }
  }, [getSelectedText, insertText]);

  // Insert blockquote
  const insertBlockquote = useCallback(() => {
    const selected = getSelectedText();
    insertText(`> ${selected}`);
  }, [getSelectedText, insertText]);

  // Insert code block
  const insertCodeBlock = useCallback(() => {
    const selected = getSelectedText();
    insertText(`\`\`\`\n${selected}\n\`\`\``);
  }, [getSelectedText, insertText]);

  // Insert horizontal rule
  const insertHorizontalRule = useCallback(() => {
    insertText('\n---\n');
  }, [insertText]);

  // Handle input - no-op for CodeMirror (handled by extensions)
  const handleInput = useCallback((_e: React.FormEvent<HTMLDivElement>) => {
    // Input handling is done by CodeMirror extensions
  }, []);

  // Execute slash command
  const executeSlashCommand = useCallback(
    (command: string) => {
      const normalizedCommand = command.startsWith('/') ? command.substring(1) : command;

      switch (normalizedCommand) {
        case 'task':
          insertList('task');
          break;
        case 'bullet':
          insertList('ul');
          break;
        case 'number':
          insertList('ol');
          break;
        case 'h1':
        case 'h2':
        case 'h3':
          formatTextSize(normalizedCommand);
          break;
        case 'quote':
          insertBlockquote();
          break;
        case 'divider':
          insertHorizontalRule();
          break;
        case 'link':
          // eslint-disable-next-line no-alert
          const url = prompt('Enter URL:');
          if (url) insertLink(url);
          break;
        default:
          break;
      }

      setShowSlashCommands(false);
      setSlashQuery('');
    },
    [insertList, formatTextSize, insertBlockquote, insertHorizontalRule, insertLink]
  );

  // Close slash commands
  const closeSlashCommands = useCallback(() => {
    setShowSlashCommands(false);
    setSlashQuery('');
  }, []);

  // Close file mentions
  const closeFileMentions = useCallback(() => {
    setShowFileMentions(false);
    setFileMentionQuery('');
  }, []);

  // Handle keyboard shortcuts
  const handleKeyCommand = useCallback(
    (e: React.KeyboardEvent): boolean => {
      const isMac = navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
      const isCtrlCmd = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === 'Escape') {
        if (showEmojiPicker || showMentionPicker || showSlashCommands || showFileMentions) {
          setShowEmojiPicker(false);
          setShowMentionPicker(false);
          setShowSlashCommands(false);
          setShowFileMentions(false);
          setMentionQuery('');
          setSlashQuery('');
          setFileMentionQuery('');
          return true;
        }
      }

      if (isCtrlCmd) {
        switch (e.key.toLowerCase()) {
          case 'b':
            formatBold();
            return true;
          case 'i':
            formatItalic();
            return true;
          case 'u':
            formatStrikethrough();
            return true;
          case '\\':
            clearFormatting();
            return true;
          default:
            return false;
        }
      }

      if (isCtrlCmd && e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case '>':
            insertBlockquote();
            return true;
          case 'c':
            insertCodeBlock();
            return true;
          default:
            return false;
        }
      }

      return false;
    },
    [
      formatBold,
      formatItalic,
      formatStrikethrough,
      showEmojiPicker,
      showMentionPicker,
      showSlashCommands,
      showFileMentions,
      clearFormatting,
      insertBlockquote,
      insertCodeBlock,
    ]
  );

  return {
    selectedText: getSelectedText(),
    cursorPosition: 0, // CodeMirror handles cursor internally
    formatBold,
    formatItalic,
    formatStrikethrough,
    insertLink,
    insertList,
    insertEmoji,
    insertMention,
    getPlainText,
    setContent,
    handleKeyCommand,
    showEmojiPicker,
    setShowEmojiPicker,
    showMentionPicker,
    setShowMentionPicker,
    mentionQuery,
    showSlashCommands,
    setShowSlashCommands,
    slashQuery,
    setSlashQuery,
    pickerPosition,
    setPickerPosition,
    handleInput,
    executeSlashCommand,
    closeSlashCommands,
    showFileMentions,
    setShowFileMentions,
    fileMentionQuery,
    setFileMentionQuery,
    insertFileMention,
    closeFileMentions,
    formatTextSize,
    formatTextColor,
    clearFormatting,
    insertBlockquote,
    insertCodeBlock,
    insertHorizontalRule,
    getSelectedText,
    hasSelection,
  };
}
