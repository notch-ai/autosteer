import { useRef, useCallback, RefObject, useState } from 'react';

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

export function useRichTextEditor(editorRef: RefObject<HTMLDivElement>): UseRichTextEditorReturn {
  const selectedTextRef = useRef('');
  const cursorPositionRef = useRef(0);

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

  // Get current selection
  const getSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      selectedTextRef.current = selection.toString();
      return selection;
    }
    return null;
  }, []);

  // Execute formatting command
  const execCommand = useCallback(
    (command: string, value?: string) => {
      if (editorRef.current) {
        editorRef.current.focus();
        document.execCommand(command, false, value);
      }
    },
    [editorRef]
  );

  // Format text as bold
  const formatBold = useCallback(() => {
    execCommand('bold');
  }, [execCommand]);

  // Format text as italic
  const formatItalic = useCallback(() => {
    execCommand('italic');
  }, [execCommand]);

  // Format text with strikethrough
  const formatStrikethrough = useCallback(() => {
    execCommand('strikethrough');
  }, [execCommand]);

  // Format text as code

  // Insert a link
  const insertLink = useCallback(
    (url: string, text?: string, openInNewTab: boolean = true) => {
      const selection = getSelection();
      if (selection && selection.rangeCount > 0) {
        const linkText = text || selection.toString() || url;
        const linkHtml = openInNewTab
          ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>`
          : `<a href="${url}">${linkText}</a>`;

        document.execCommand('insertHTML', false, linkHtml);
      }
    },
    [getSelection]
  );

  // Insert a list
  const insertList = useCallback(
    (type: 'ul' | 'ol' | 'task') => {
      if (!editorRef.current) return;

      const selection = getSelection();
      if (!selection || selection.rangeCount === 0) return;

      if (type === 'task') {
        // Create task list HTML
        const taskHtml = `<div class="task-list"><div class="task-list-item"><input type="checkbox" /><span contenteditable="true">New task</span></div></div>`;
        document.execCommand('insertHTML', false, taskHtml);
      } else {
        // Create regular list
        execCommand(type === 'ul' ? 'insertUnorderedList' : 'insertOrderedList');
      }
    },
    [editorRef, getSelection, execCommand]
  );

  // Insert emoji
  const insertEmoji = useCallback(
    (emoji: string) => {
      if (!editorRef.current) return;

      // Use execCommand for safer DOM manipulation
      editorRef.current.focus();
      document.execCommand('insertText', false, emoji);
    },
    [editorRef]
  );

  // Insert mention
  const insertMention = useCallback(
    (mention: string) => {
      if (!editorRef.current) return;

      const selection = getSelection();
      if (selection && selection.rangeCount > 0) {
        // Remove the @ trigger and query text
        if (showMentionPicker) {
          const range = selection.getRangeAt(0);
          const textNode = range.startContainer;
          if (textNode.nodeType === Node.TEXT_NODE) {
            const text = textNode.textContent || '';
            const atIndex = text.lastIndexOf('@');
            if (atIndex !== -1) {
              // Select from @ to current position
              range.setStart(textNode, atIndex);
              selection.removeAllRanges();
              selection.addRange(range);
            }
          }
        }

        // Insert the mention using execCommand
        const mentionHtml = `<span class="mention" contenteditable="false">@${mention}</span>&nbsp;`;
        document.execCommand('insertHTML', false, mentionHtml);

        // Close mention picker
        setShowMentionPicker(false);
        setMentionQuery('');
      }
    },
    [editorRef, getSelection, showMentionPicker]
  );

  // Get plain text content
  const getPlainText = useCallback(() => {
    if (!editorRef.current) return '';
    return editorRef.current.textContent || '';
  }, [editorRef]);

  // Set content
  const setContent = useCallback(
    (content: string) => {
      if (editorRef.current) {
        editorRef.current.innerHTML = content;
      }
    },
    [editorRef]
  );

  // Get cursor position relative to viewport
  const getCursorPosition = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Find the rich text editor container
    const richTextEditor = editorRef.current?.closest('.rich-text-editor');

    if (richTextEditor && editorRef.current) {
      // Get the rich text editor's position and width
      const editorContainerRect = richTextEditor.getBoundingClientRect();

      const menuBottomPosition = editorContainerRect.top - 1;

      // Calculate viewport constraints
      const viewportWidth = window.innerWidth;

      return {
        bottom: menuBottomPosition,
        top: menuBottomPosition,
        left: Math.max(10, Math.min(editorContainerRect.left + 1, viewportWidth - 400)),
        width: Math.min(editorContainerRect.width - 2, viewportWidth - 20),
        maxHeight: menuBottomPosition - 10,
      };
    }

    return {
      top: rect.bottom + window.scrollY + 5,
      left: rect.left + window.scrollX,
    };
  }, [editorRef]);

  // Handle input events to detect triggers
  const handleInput = useCallback(
    (_e: React.FormEvent<HTMLDivElement>) => {
      // Get the full plain text content of the editor
      const fullText = getPlainText();
      const fullTextTrimmed = fullText.trim();

      // Check for / command trigger - only at start of input
      if (fullTextTrimmed.length === 0) {
        // If the editor is empty, hide all pickers
        setShowSlashCommands(false);
        setSlashQuery('');
        setShowMentionPicker(false);
        setMentionQuery('');
        return;
      }

      if (fullTextTrimmed.startsWith('/')) {
        // Get the query after the slash (including spaces for multi-word search)
        const query = fullTextTrimmed.substring(1);
        setSlashQuery(query);
        setShowSlashCommands(true);
        setShowMentionPicker(false);
        setShowEmojiPicker(false);

        const pos = getCursorPosition();
        if (pos) setPickerPosition(pos);
      } else {
        // Hide slash commands if input doesn't start with /
        setShowSlashCommands(false);
        setSlashQuery('');
      }

      // Check for @ file mention trigger
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      const textNode = range.startContainer;

      if (textNode.nodeType === Node.TEXT_NODE) {
        const text = textNode.textContent || '';
        const cursorPos = range.startOffset;

        const atIndex = text.lastIndexOf('@', cursorPos - 1);
        if (atIndex !== -1 && (atIndex === 0 || text[atIndex - 1] === ' ')) {
          const query = text.substring(atIndex + 1, cursorPos);
          // Use file mentions instead of mention picker
          setFileMentionQuery(query);
          setShowFileMentions(true);
          setShowSlashCommands(false);
          setShowEmojiPicker(false);
          setShowMentionPicker(false);

          const pos = getCursorPosition();
          if (pos) setPickerPosition(pos);
        } else if (!fullTextTrimmed.startsWith('/')) {
          // Only hide file mentions if we're not showing slash commands
          setShowFileMentions(false);
          setFileMentionQuery('');
          setShowMentionPicker(false);
          setMentionQuery('');
        }
      }
    },
    [getCursorPosition, getPlainText]
  );

  // Handle slash command execution
  const executeSlashCommand = useCallback(
    (command: string) => {
      if (!editorRef.current) return;

      const selection = getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);

        // Remove the slash trigger and query
        const textNode = range.startContainer;
        if (textNode.nodeType === Node.TEXT_NODE) {
          const text = textNode.textContent || '';
          const slashIndex = text.lastIndexOf('/');
          if (slashIndex !== -1) {
            const deleteRange = document.createRange();
            deleteRange.setStart(textNode, slashIndex);
            deleteRange.setEnd(textNode, range.startOffset);
            deleteRange.deleteContents();
          }
        }

        // Execute the command (normalize by removing leading slash if present)
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
            execCommand('formatBlock', 'h1');
            break;
          case 'h2':
            execCommand('formatBlock', 'h2');
            break;
          case 'h3':
            execCommand('formatBlock', 'h3');
            break;
          case 'quote':
            execCommand('formatBlock', 'blockquote');
            break;
          case 'divider':
            execCommand('insertHorizontalRule');
            break;
          case 'link':
            const url = prompt('Enter URL:');
            if (url) insertLink(url);
            break;
          default:
            break;
        }

        setShowSlashCommands(false);
        setSlashQuery('');
      }
    },
    [editorRef, getSelection, insertList, execCommand, insertLink]
  );

  // Define all formatting functions first

  // Format text size
  const formatTextSize = useCallback(
    (size: string) => {
      if (!editorRef.current) return;

      switch (size) {
        case 'small':
          execCommand('fontSize', '2');
          break;
        case 'normal':
          execCommand('fontSize', '3');
          break;
        case 'large':
          execCommand('fontSize', '5');
          break;
        case 'h1':
          execCommand('formatBlock', 'h1');
          break;
        case 'h2':
          execCommand('formatBlock', 'h2');
          break;
        case 'h3':
          execCommand('formatBlock', 'h3');
          break;
        default:
          break;
      }
    },
    [editorRef, execCommand]
  );

  // Format text color
  const formatTextColor = useCallback(
    (color: string) => {
      if (!editorRef.current) return;

      if (color === 'default') {
        execCommand('removeFormat');
      } else {
        const colorMap: { [key: string]: string } = {
          red: '#ef4444',
          orange: '#f97316',
          yellow: '#eab308',
          green: '#22c55e',
          blue: '#3b82f6',
          purple: '#a855f7',
          gray: '#6b7280',
        };

        if (colorMap[color]) {
          execCommand('foreColor', colorMap[color]);
        }
      }
    },
    [editorRef, execCommand]
  );

  // Clear formatting
  const clearFormatting = useCallback(() => {
    execCommand('removeFormat');
  }, [execCommand]);

  // Insert blockquote
  const insertBlockquote = useCallback(() => {
    execCommand('formatBlock', 'blockquote');
  }, [execCommand]);

  // Insert code block
  const insertCodeBlock = useCallback(() => {
    const selection = getSelection();
    if (selection) {
      const selectedText = selection.toString() || 'Code here...';
      const codeHtml = `<pre><code>${selectedText}</code></pre>`;
      document.execCommand('insertHTML', false, codeHtml);
    }
  }, [getSelection]);

  // Insert horizontal rule
  const insertHorizontalRule = useCallback(() => {
    execCommand('insertHorizontalRule');
  }, [execCommand]);

  // Handle keyboard shortcuts
  const handleKeyCommand = useCallback(
    (e: React.KeyboardEvent): boolean => {
      const isMac = navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
      const isCtrlCmd = isMac ? e.metaKey : e.ctrlKey;

      // Handle Escape key to close pickers
      if (e.key === 'Escape') {
        if (showEmojiPicker || showMentionPicker || showSlashCommands) {
          setShowEmojiPicker(false);
          setShowMentionPicker(false);
          setShowSlashCommands(false);
          setMentionQuery('');
          setSlashQuery('');
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
          case 'k':
            // Don't use prompt here, let the component handle it
            return true;
          case '\\':
            clearFormatting();
            return true;
          default:
            return false;
        }
      }

      // Handle Ctrl+Shift shortcuts
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

      // Handle Ctrl+Alt shortcuts for headings
      if (isCtrlCmd && e.altKey) {
        switch (e.key) {
          case '1':
            formatTextSize('h1');
            return true;
          case '2':
            formatTextSize('h2');
            return true;
          case '3':
            formatTextSize('h3');
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
      clearFormatting,
      insertBlockquote,
      insertCodeBlock,
      formatTextSize,
    ]
  );

  // Get selected text
  const getSelectedText = useCallback(() => {
    const selection = window.getSelection();
    return selection ? selection.toString() : '';
  }, []);

  // Check if has selection
  const hasSelection = useCallback(() => {
    const selection = window.getSelection();
    return selection !== null && selection.toString().length > 0;
  }, []);

  // Close slash commands
  const closeSlashCommands = useCallback(() => {
    setShowSlashCommands(false);
    setSlashQuery('');
  }, []);

  // Insert file mention
  const insertFileMention = useCallback(
    (filePath: string) => {
      if (!editorRef.current) return;

      // For now, just insert the file path as text
      // In a more complete implementation, this could create a special mention element
      document.execCommand('insertText', false, filePath);

      // Close the file mentions dropdown
      setShowFileMentions(false);
      setFileMentionQuery('');
    },
    [editorRef]
  );

  // Close file mentions
  const closeFileMentions = useCallback(() => {
    setShowFileMentions(false);
    setFileMentionQuery('');
  }, []);

  return {
    selectedText: selectedTextRef.current,
    cursorPosition: cursorPositionRef.current,
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
    // New properties for pickers
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
    // File mentions properties
    showFileMentions,
    setShowFileMentions,
    fileMentionQuery,
    setFileMentionQuery,
    insertFileMention,
    closeFileMentions,
    // New formatting methods
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
