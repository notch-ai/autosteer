import { cn } from '@/commons/utils';
import { logger } from '@/commons/utils/logger';
import { convertSlashCommandFormat } from '@/commons/utils/slashCommandUtils';
import { ModelSelector } from '@/components/ModelSelector';
import { Button } from '@/components/ui/button';
import { useCodeMirror } from '@/hooks/useCodeMirror';
import { useCoreStore } from '@/stores';
import { ModelOption } from '@/types/model.types';
import { PermissionMode } from '@/types/permission.types';
import { Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { Paperclip } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ContextUsageIndicator } from './ContextUsageIndicator';
import { EditorToolbar } from './EditorToolbar';
import { FileMentions } from './FileMentions';
import { MentionPicker } from './MentionPicker';
import { PermissionModeSelector } from './PermissionModeSelector';
import { SlashCommands } from './SlashCommands';
import { createFileMentionExtension, insertFileMention } from './codemirror/file-mention-extension';
import {
  createSlashCommandExtension,
  insertSlashCommand,
} from './codemirror/slash-command-extension';
import { FormatType, createToolbarExtension } from './codemirror/toolbar-extension';
import { createVimExtension } from './codemirror/vim-extension';

export interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
  attachedResourceIds?: string[];
  onRemoveResource?: (resourceId: string) => void;
  onAttachResources?: (resourceIds: string[]) => void;
  onSlashCommand?: (command: string) => void;
  isStreaming?: boolean;
  onStopStreaming?: () => void;
  permissionMode?: PermissionMode;
  onPermissionModeChange?: (mode: PermissionMode) => void;
  model?: ModelOption;
  onModelChange?: (model: ModelOption) => void;
  resources?: Map<string, unknown>;
}

/**
 * Feature component for RichTextEditor
 * Uses CodeMirror 6 for rich text editing with vim mode, formatting, and slash commands
 * Migrated from contentEditable to CodeMirror for better vim support and bug fixes
 */
export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  onSend,
  placeholder = 'Jot something down',
  disabled = false,
  attachedResourceIds = [],
  onAttachResources,
  onSlashCommand,
  isStreaming = false,
  onStopStreaming,
  permissionMode = 'acceptEdits',
  onPermissionModeChange,
  model,
  onModelChange,
  resources,
}) => {
  // Vim mode state - managed locally and by vim extension
  const [vimMode, setVimMode] = useState<'NORMAL' | 'INSERT'>('INSERT');
  const [vimEnabled, setVimEnabled] = useState(false);

  // UI state
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionQuery] = useState('');
  const [showSlashCommands, setShowSlashCommandsState] = useState(false);
  const [slashQuery, setSlashQueryState] = useState('');
  const [showFileMentions, setShowFileMentions] = useState(false);
  const [fileMentionQuery, setFileMentionQuery] = useState('');

  // Wrap state setters with logging (no dependencies to avoid re-renders)
  const setShowSlashCommands = useCallback((value: boolean) => {
    console.log('[RichTextEditor] setShowSlashCommands', { value });
    setShowSlashCommandsState(value);
  }, []);

  const setSlashQuery = useCallback((value: string) => {
    console.log('[RichTextEditor] setSlashQuery', { value });
    setSlashQueryState(value);
  }, []);
  const [pickerPosition, setPickerPosition] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width?: number;
    maxHeight?: number;
  } | null>(null);

  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const lastEscapeTimeRef = useRef<number>(0);

  const selectedProject = useCoreStore((state) => state.getSelectedProject());
  const projectPath = selectedProject?.localPath;
  const selectedAgentId = useCoreStore((state) => state.selectedAgentId);
  const agentContextUsage = useCoreStore((state) => state.agentContextUsage);

  // Check if context usage data exists for the selected agent
  const hasContextUsage = useMemo(() => {
    if (!selectedAgentId || selectedAgentId === 'terminal-tab') return false;
    const usage = agentContextUsage.get(selectedAgentId);
    return !!(usage && usage.modelUsage && Object.keys(usage.modelUsage).length > 0);
  }, [selectedAgentId, agentContextUsage]);

  // Check vim mode setting
  useEffect(() => {
    const checkVimMode = async () => {
      try {
        const enabled = await window.electron.worktree.getVimMode();
        setVimEnabled(enabled);
      } catch (error) {
        const enabled = localStorage.getItem('vimModeEnabled') !== 'false';
        setVimEnabled(enabled);
      }
    };

    void checkVimMode();

    const handleStorageChange = () => {
      void checkVimMode();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Handle slash command trigger
  const handleSlashTrigger = useCallback(
    (query: string, position: { top: number; left: number }) => {
      setSlashQuery(query);
      setShowSlashCommands(true);
      setShowMentionPicker(false);
      setShowFileMentions(false);

      // Get editor container bounds to match its width and position
      if (editorContainerRef.current) {
        const editorRect = editorContainerRef.current.getBoundingClientRect();
        setPickerPosition({
          bottom: window.innerHeight - position.top + 30,
          left: editorRect.left,
          width: editorRect.width,
          maxHeight: 300,
        });
      } else {
        // Fallback to cursor position
        setPickerPosition({
          bottom: window.innerHeight - position.top + 30,
          left: position.left,
          width: 300,
          maxHeight: 300,
        });
      }
    },
    [setSlashQuery, setShowSlashCommands]
  );

  // Handle file mention trigger
  const handleFileMentionTrigger = useCallback(
    (query: string, position: { top: number; left: number }) => {
      setFileMentionQuery(query);
      setShowFileMentions(true);
      setShowSlashCommands(false);
      setShowMentionPicker(false);

      // Get editor container bounds to match its width and position
      if (editorContainerRef.current) {
        const editorRect = editorContainerRef.current.getBoundingClientRect();
        setPickerPosition({
          bottom: window.innerHeight - position.top + 30,
          left: editorRect.left,
          width: editorRect.width,
          maxHeight: 300,
        });
      } else {
        // Fallback to cursor position
        setPickerPosition({
          bottom: window.innerHeight - position.top + 30,
          left: position.left,
          width: 300,
          maxHeight: 300,
        });
      }
    },
    [setShowSlashCommands]
  );

  // Handle toolbar formatting - defined before useCodeMirror to avoid circular dependency
  const formatTextCallback = useRef<(type: FormatType, selectedText: string) => void>();

  // Create refs for prop functions and state to avoid dependency changes
  const onSendRef = useRef(onSend);
  const onStopStreamingRef = useRef(onStopStreaming);
  const showSlashCommandsRef = useRef(showSlashCommands);
  const showFileMentionsRef = useRef(showFileMentions);

  // Update refs when props/state change
  useEffect(() => {
    onSendRef.current = onSend;
    onStopStreamingRef.current = onStopStreaming;
    showSlashCommandsRef.current = showSlashCommands;
    showFileMentionsRef.current = showFileMentions;
  }, [onSend, onStopStreaming, showSlashCommands, showFileMentions]);

  // Memoize extensions to prevent ref callback from being called on every render
  const extensions = useMemo(() => {
    console.log('[RichTextEditor] Rebuilding extensions - vimEnabled:', vimEnabled);
    return [
      // Line wrapping - enable text wrapping
      EditorView.lineWrapping,
      // Enter key handler - MUST be before vim to intercept first
      Prec.highest(
        keymap.of([
          {
            key: 'Enter',
            run: (view) => {
              // Check if we have content to send
              const hasContent = view.state.doc.toString().trim() !== '';

              // If picker is open AND we have no content, let picker handle it
              if ((showSlashCommandsRef.current || showFileMentionsRef.current) && !hasContent) {
                return true; // Let picker handle Enter
              }

              // If we have content, always try to send (picker has its own Enter handler that runs first)
              // The picker's document-level handler will preventDefault if it needs to handle Enter
              // But if user pressed Tab to autocomplete, the picker is likely closed by now
              if (hasContent) {
                try {
                  onSendRef.current();

                  // Clear the editor content after sending
                  view.dispatch({
                    changes: { from: 0, to: view.state.doc.length, insert: '' },
                  });
                } catch (error) {
                  logger.error('[RichTextEditor] Error calling onSend:', error);
                }
                return true;
              }

              return false;
            },
          },
          {
            key: 'ArrowUp',
            run: () => {
              if (showSlashCommandsRef.current || showFileMentionsRef.current) {
                // Consume event to prevent vim from handling it
                // Original event will bubble naturally to document listeners
                return true;
              }
              return false; // Let vim handle it
            },
          },
          {
            key: 'ArrowDown',
            run: () => {
              if (showSlashCommandsRef.current || showFileMentionsRef.current) {
                // Consume event to prevent vim from handling it
                // Original event will bubble naturally to document listeners
                return true;
              }
              return false; // Let vim handle it
            },
          },
          {
            key: 'Escape',
            run: () => {
              const now = Date.now();
              const timeSinceLastEscape = now - lastEscapeTimeRef.current;
              const DOUBLE_ESCAPE_THRESHOLD = 500; // 500ms window for double-escape

              // Check for double-escape (ESC ESC within 500ms)
              if (timeSinceLastEscape < DOUBLE_ESCAPE_THRESHOLD) {
                // Double-escape detected - always try to cancel operation
                logger.debug('[DEBUG RichTextEditor] Double ESC detected - attempting to cancel');
                logger.debug('[DEBUG RichTextEditor] isStreaming:', isStreaming);
                logger.debug(
                  '[DEBUG RichTextEditor] hasStopCallback:',
                  !!onStopStreamingRef.current
                );

                // Always call stopStreaming if available - let the service handle whether there's actually streaming
                if (onStopStreamingRef.current) {
                  onStopStreamingRef.current();
                  lastEscapeTimeRef.current = 0; // Reset the timer
                  return true;
                } else {
                  logger.warn(
                    '[DEBUG RichTextEditor] Double ESC detected but no stop callback available'
                  );
                }
              }

              // Update last escape time
              lastEscapeTimeRef.current = now;

              // If vim is enabled, let vim handle ESC for mode switching
              if (vimEnabled) {
                return false; // Let vim handle ESC
              }
              return false;
            },
          },
        ])
      ),
      // Vim extension - loaded AFTER arrow key handlers so they intercept first
      createVimExtension({
        enabled: vimEnabled,
        onModeChange: setVimMode,
      }),
      // Toolbar extension
      createToolbarExtension({
        onFormat: (type: FormatType, selectedText: string) => {
          formatTextCallback.current?.(type, selectedText);
        },
      }),
      // Slash command extension
      createSlashCommandExtension({
        onTrigger: handleSlashTrigger,
        onHide: () => {
          setShowSlashCommands(false);
          setSlashQuery('');
        },
      }),
      // File mention extension
      createFileMentionExtension({
        onTrigger: handleFileMentionTrigger,
        onHide: () => setShowFileMentions(false),
      }),
      // Paste handler and arrow key handler combined
      EditorView.domEventHandlers({
        paste(event, view) {
          // Prevent default paste behavior
          event.preventDefault();

          // Get plain text from clipboard and trim whitespace/newlines
          const rawText = event.clipboardData?.getData('text/plain') || '';
          const text = rawText.trim();

          if (text) {
            // Insert trimmed plain text at cursor position
            const { from, to } = view.state.selection.main;
            view.dispatch({
              changes: { from, to, insert: text },
              selection: { anchor: from + text.length },
            });
          }

          return true;
        },
        keydown(_event, _view) {
          // Let all keys bubble naturally to document listeners
          // The keymap handler above will prevent vim from consuming arrow keys when pickers are open
          return false;
        },
      }),
      // Custom styling
      EditorView.theme({
        '&': {
          minHeight: '80px',
          maxHeight: '400px',
          backgroundColor: 'transparent',
        },
        '.cm-scroller': {
          overflowX: 'hidden',
          overflowY: 'auto',
        },
        '.cm-content': {
          padding: '0.5rem',
          fontFamily: 'inherit',
          fontSize: '0.875em',
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap',
          caretColor: 'currentColor',
        },
        '.cm-line': {
          padding: '0',
        },
        '.cm-line span:hover': {
          backgroundColor: 'rgb(var(--color-background))',
        },
        '&.cm-focused': {
          outline: 'none',
        },
      }),
    ];
  }, [vimEnabled, handleSlashTrigger, handleFileMentionTrigger]);

  // CodeMirror setup with all extensions
  const { ref, view, setContent, focus } = useCodeMirror({
    initialDoc: value,
    placeholder,
    readOnly: disabled,
    onUpdate: onChange,
    extensions,
  });

  // Note: Vim mode changes require extensions to be recreated
  // The extensions are memoized and will update when vimEnabled changes
  // No need for window reload - React will handle the update

  // // Trigger mode detection after extensions reconfigure
  // useEffect(() => {
  //   if (view) {
  //     // Force a view update to trigger the vim mode detection
  //     view.dispatch({
  //       selection: view.state.selection,
  //     });
  //   }
  // }, [view, vimEnabled]);

  // Set up format callback after view is available
  useEffect(() => {
    formatTextCallback.current = (type: FormatType, selectedText: string) => {
      if (!view) return;

      const { from, to } = view.state.selection.main;
      let formattedText = '';

      switch (type) {
        case 'bold':
          formattedText = `**${selectedText}**`;
          break;
        case 'italic':
          formattedText = `*${selectedText}*`;
          break;
        case 'code':
          formattedText = `\`${selectedText}\``;
          break;
        case 'strikethrough':
          formattedText = `~~${selectedText}~~`;
          break;
        case 'link':
          formattedText = `[${selectedText}](url)`;
          break;
      }

      view.dispatch({
        changes: { from, to, insert: formattedText },
      });

      view.focus();
    };
  }, [view]);

  // Update content when value prop changes (only if not focused)
  useEffect(() => {
    if (view && value !== view.state.doc.toString()) {
      // Only update when not focused to preserve cursor
      const isFocused = view.hasFocus;
      if (!isFocused) {
        setContent(value);
      }
    }
  }, [value, view, setContent]);

  // Apply scrollbar styles directly to the scroller element after mount
  useEffect(() => {
    if (!view) return;

    const scroller = view.scrollDOM;
    if (scroller) {
      // Add a class to target with CSS
      scroller.classList.add('cm-custom-scrollbar');
    }
  }, [view]);

  // Handle resource attachment inline badges
  const insertInlineFileBadge = useCallback(
    (resourceId: string) => {
      if (!view) return;

      const resource = resources?.get(resourceId);
      const fileName = (resource as { name?: string })?.name || `Resource ${resourceId}`;
      const mimeType = (resource as { mimeType?: string })?.mimeType;
      const isImage =
        mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i.test(fileName);

      const badgeText = isImage ? `[Image #${resourceId.slice(-2)}]` : `📎 ${fileName}`;

      const { from } = view.state.selection.main;
      view.dispatch({
        changes: { from, insert: badgeText + ' ' },
      });

      view.focus();
    },
    [view, resources]
  );

  // Insert inline badges when resources are attached
  const prevAttachedResourcesRef = useRef<string[]>([]);
  useEffect(() => {
    const newResourceIds = attachedResourceIds.filter(
      (id) => !prevAttachedResourcesRef.current.includes(id)
    );

    if (newResourceIds.length > 0) {
      newResourceIds.forEach((resourceId) => {
        insertInlineFileBadge(resourceId);
      });
    }

    prevAttachedResourcesRef.current = attachedResourceIds;
  }, [attachedResourceIds, insertInlineFileBadge]);

  // Close slash commands
  const closeSlashCommands = useCallback(() => {
    setShowSlashCommands(false);
    setSlashQuery('');
  }, [setShowSlashCommands, setSlashQuery]);

  // Close file mentions
  const closeFileMentions = useCallback(() => {
    setShowFileMentions(false);
    setFileMentionQuery('');
  }, []);

  const canSend = value.trim() !== '' && !disabled && (!isStreaming || !!onStopStreaming);

  return (
    <div className="relative">
      {/* Main Editor Container with CodeMirror and Controls */}
      <div className="border border-border rounded-md">
        {/* CodeMirror Editor */}
        <div
          ref={(node) => {
            // Set both refs
            if (typeof ref === 'function') {
              ref(node);
            }
            editorContainerRef.current = node;
          }}
          className={cn(
            'editor-content overflow-x-hidden overflow-y-auto border-0 focus:ring-0 min-h-[80px] cursor-text',
            vimEnabled && vimMode === 'NORMAL' && 'vim-normal-mode',
            vimEnabled && vimMode === 'INSERT' && 'vim-insert-mode',
            !vimEnabled && 'vim-disabled'
          )}
          onClick={() => focus()}
          aria-label="Rich text editor"
          aria-disabled={disabled}
        />

        {/* Inline Slash Commands */}
        {showSlashCommands && pickerPosition && (
          <SlashCommands
            query={slashQuery}
            onSelect={(command) => {
              if (!view) {
                closeSlashCommands();
                return;
              }

              // Clear the editor content first
              view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: '' },
              });

              // Format command as /<command> for Claude Code
              const formattedCommand = command.command.startsWith('/')
                ? command.command
                : '/' + command.command;

              // Convert command format (e.g., /engineering:write-docs -> "run command /engineering/write-docs")
              const convertedCommand = convertSlashCommandFormat(formattedCommand);

              // Execute slash command - send converted command to Claude Code
              if (onSlashCommand) {
                onSlashCommand(convertedCommand);
              }

              closeSlashCommands();
            }}
            onTabSelect={(command) => {
              if (!view) return;

              // Format the command with leading slash and trailing space
              const fullCommand = command.command.startsWith('/')
                ? command.command
                : '/' + command.command;

              // Insert command with space - extension will auto-hide when space is detected
              insertSlashCommand(view, fullCommand + ' ');
              view.focus();
            }}
            onClose={closeSlashCommands}
            position={pickerPosition}
          />
        )}

        {/* Inline Mention Picker */}
        {showMentionPicker && pickerPosition && (
          <div
            className="absolute z-50"
            style={{
              top: pickerPosition.top ? `${pickerPosition.top}px` : undefined,
              bottom: pickerPosition.bottom ? `${pickerPosition.bottom}px` : undefined,
              left: `${pickerPosition.left}px`,
            }}
          >
            <MentionPicker
              query={mentionQuery}
              onSelect={() => {}}
              onClose={() => {}}
              position={
                pickerPosition &&
                (pickerPosition.top !== undefined || pickerPosition.bottom !== undefined)
                  ? { top: pickerPosition.top || 0, left: pickerPosition.left }
                  : { top: 0, left: 0 }
              }
            />
          </div>
        )}

        {/* Editor Toolbar - inline with textarea */}
        <div className="flex items-center justify-between" data-testid="toolbar-container">
          {/* Left side - Model Selector, Permission Mode, and Attach */}
          <div className="flex items-center gap-2 px-2">
            {model && onModelChange && (
              <ModelSelector
                model={model}
                onChange={onModelChange}
                disabled={disabled || isStreaming}
              />
            )}
            {permissionMode && onPermissionModeChange && (
              <PermissionModeSelector
                mode={permissionMode}
                onChange={onPermissionModeChange}
                disabled={disabled || isStreaming}
              />
            )}
            {onAttachResources && (
              <Button
                variant="icon-secondary"
                size="icon"
                onClick={async () => {
                  try {
                    const filePaths = await window.electron.dialog?.openFile({
                      properties: ['openFile', 'multiSelections'],
                      filters: [
                        { name: 'All Files', extensions: ['*'] },
                        {
                          name: 'Images',
                          extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'],
                        },
                        { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'md'] },
                        {
                          name: 'Code',
                          extensions: [
                            'js',
                            'ts',
                            'tsx',
                            'jsx',
                            'py',
                            'java',
                            'cpp',
                            'c',
                            'h',
                            'hpp',
                            'css',
                            'html',
                            'json',
                            'xml',
                          ],
                        },
                      ],
                    });

                    if (filePaths && filePaths.length > 0) {
                      const resourceIds: string[] = [];

                      for (const filePath of filePaths) {
                        const resource = await window.electron.resources?.uploadResources(filePath);
                        if (resource) {
                          resourceIds.push(resource.id);
                        }
                      }

                      if (resourceIds.length > 0) {
                        onAttachResources(resourceIds);
                      }
                    }
                  } catch (error) {
                    logger.error('Failed to open file dialog:', error);
                  }
                }}
                disabled={disabled || isStreaming}
                title="Attach files"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            )}
            {/* Vertical divider - only show when VIM mode is enabled */}
            {vimEnabled && <div className="h-5 w-px bg-border ml-3 mr-3" />}
            {/* VIM Mode Indicator */}
            {vimEnabled && (
              <Button
                variant="icon-secondary"
                size="icon"
                disabled
                title={`Current mode: ${vimMode}`}
                className="cursor-default text-text"
              >
                <span className="text-sm font-medium">{vimMode}</span>
              </Button>
            )}

            {/* Context Usage Indicator - inline in toolbar */}
            {hasContextUsage && (
              <>
                <div className="h-5 w-px bg-border mx-2" />
                <ContextUsageIndicator agentId={selectedAgentId} inline />
              </>
            )}
          </div>

          {/* Right side - Toolbar */}
          <EditorToolbar
            onSend={onSend}
            canSend={canSend}
            disabled={disabled}
            isStreaming={isStreaming}
            {...(onStopStreaming && { onStopStreaming })}
            className="border-0 flex-1"
          />
        </div>
      </div>

      {/* File Mentions Dropdown */}
      {showFileMentions && pickerPosition && (
        <FileMentions
          query={fileMentionQuery}
          projectPath={projectPath || undefined}
          onSelect={(file) => {
            if (!view) return;

            // Add space after file name when Enter is pressed (unless it's a directory)
            const textToInsert = '@' + file.name + (file.isDirectory ? '' : ' ');
            insertFileMention(view, textToInsert);

            if (file.isDirectory) {
              setFileMentionQuery(file.name);
              setShowFileMentions(true);
            } else {
              closeFileMentions();
            }

            view.focus();
          }}
          onTabSelect={(file) => {
            if (!view) return;

            // Add space after file name when Tab is pressed (unless it's a directory)
            const textToInsert = '@' + file.name + (file.isDirectory ? '' : ' ');
            insertFileMention(view, textToInsert);

            if (file.isDirectory) {
              setFileMentionQuery(file.name);
              setShowFileMentions(true);
            } else {
              closeFileMentions();
            }

            view.focus();
          }}
          onClose={closeFileMentions}
          position={pickerPosition}
          className="absolute z-50"
        />
      )}
    </div>
  );
};
