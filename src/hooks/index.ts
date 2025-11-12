/**
 * Hooks Barrel Export
 * Central export point for all custom React hooks
 */

// Agent Management Hooks
export * from './useAgents';
export * from './useAgentActions';
export * from './useAgentChatInstances';
export * from './useContentEditor';

// Chat Management Hooks
export * from './useChatMessages';
export * from './useChatActions';
export * from './useChatInput';
export * from './useChatInputFocus';
export * from './usePermissionHandling';
export * from './useMessageMetadata';
export * from './useAgentChatState';
export * from './useChatMessageHandlers';
export * from './useResourceAttachment';

// Project Management Hooks
export * from './useProjects';
export * from './useProjectActions';
export * from './useProjectHeader';

// Resource Management Hooks
export * from './useResourceActions';

// Git Management Hooks
export * from './useGitStatus';
export * from './useGitActions';
export * from './useGitStats';
export * from './useFileDiff';
export * from './useGitWatcher';

// Terminal Management Hooks
export * from './useTerminals';
export * from './useTerminalActions';

// Other Custom Hooks
export * from './useBadgeNotifications';
export * from './useCodeMirror';
export * from './useFileDragDrop';
export * from './useModalEscape';
export * from './usePickerKeyboardNav';
export * from './useResources';
export * from './useRichTextEditor';
export * from './useRichTextEditor.codemirror';
export * from './useSelection';
export * from './useSessionTabs';
export * from './useTerminal';
export * from './use-toast';
export * from './useVimMode';

// Scroll Management Hooks
export * from './useChatScroll';
export * from './useTerminalScrollPreservation';
export * from './useChangesTabScrollPreservation';
export * from './useVirtualScrollState';

// Content State Hooks
export * from './useMainContentState';
export * from './useAgentContentRenderer';
