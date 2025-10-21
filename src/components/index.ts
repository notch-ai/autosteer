/**
 * Central Component Export Index
 *
 * This file exports all components from a single location to support
 * the component showcase system for visual testing.
 */

// Basic UI Components
export { Icon } from './features/Icon';
export { Button, buttonVariants } from './features/Button';
export { Input, Textarea, Select, inputVariants } from './features/Input';
export { FormButton } from './features/FormButton';
export { IconButton } from './features/IconButton';
export { Toast } from './features/Toast';
export { Skeleton } from './features/Skeleton';
export { ErrorBoundary } from './features/ErrorBoundary';

// Modal and Dialog Components
export { Modal } from './features/Modal';
export { AnchoredModal } from './features/AnchoredModal';
export { ConfirmDialog } from './features/ConfirmDialog';
export { LinkDialog } from './features/LinkDialog';
export { ToastProvider } from './features/ToastProvider';

// Form and Input Components
export { DropdownSelector } from './features/DropdownSelector';
export { PermissionModeSelector } from './features/PermissionModeSelector';
export { SlashCommandAdapter } from './features/SlashCommandAdapter';

// Theme Components
export { ThemeToggle } from './features/ThemeToggle';
export { ThemeVariantToggle } from './features/ThemeVariantToggle';

// Display and Status Components
export { TodoDisplay } from './features/TodoDisplay';
export { RequestTiming } from './features/RequestTiming';
export { SessionTimeTracking } from './features/SessionTimeTracking';
export { PlanEditModeIndicator } from './features/PlanEditModeIndicator';
export { VimModeIndicator } from '@/renderer/features/settings/components/VimModeIndicator';

// Panel and Layout Components
export { DetailPanel } from './features/DetailPanel';
export { ResizablePanel } from './features/ResizablePanel';
export { VerticalSplitPanel } from './features/VerticalSplitPanel';
export { ThreeColumnLayout } from './features/ThreeColumnLayout';

// Task and Project Management
export { TaskList } from './features/TaskList';
export { TodoActivityTracker } from './features/TodoActivityTracker';
export { AddProjectModal } from '@/renderer/features/shared/components/projects/AddProjectModal';
export { ProjectList } from '@/renderer/features/shared/components/projects/ProjectList';

// Statistics and Monitoring
export { StatsPanel } from './features/StatsPanel';
export { UsageMonitor } from './features/UsageMonitor';
export { UsageStats } from './features/UsageStats';
export { UsageDashboard } from './features/UsageDashboard';

// Main Layout Components
export { MenuBar } from './features/MenuBar';
export { Sidebar } from './features/Sidebar';
export { MainContent } from './features/MainContent';
export { UpdateNotification } from './features/UpdateNotification';
export { ChatInterface } from './features/ChatInterface';

// Text and Content Components
export { RichTextEditor } from './features/RichTextEditor';
export { MarkdownRenderer } from './features/MarkdownRenderer';
export { DiffViewer } from './features/DiffViewer';
export { StreamingEventDisplay } from './features/StreamingEventDisplay';

// Tool and Development Components
export { ToolUsageDisplay } from './features/ToolUsageDisplay';
export { EditorToolbar } from './features/EditorToolbar';
export { SlashCommands } from './features/SlashCommands';

// Text Editing and Interaction Components
export { TextFormattingMenu } from './features/TextFormattingMenu';
export { EmojiPicker } from './features/EmojiPicker';
export { MentionPicker } from './features/MentionPicker';
export { KeyboardShortcutsHelp } from './features/KeyboardShortcutsHelp';
export { KeyboardShortcutTooltip } from './features/KeyboardShortcutTooltip';

// Command and Navigation Components
export { CommandMenu } from './features/CommandMenu';

// Settings and Configuration
export { LLMSettings } from './features/LLMSettings';

// Export component types for type safety
export type { IconName } from './features/Icon';
export type { ModalProps } from './features/Modal';
export type { CommandMenuItem } from './features/CommandMenu';

// Component categories for the test harness
export const COMPONENT_CATEGORIES = {
  'Basic UI': [
    'Icon',
    'Button',
    'Input',
    'Textarea',
    'Select',
    'FormButton',
    'IconButton',
    'Toast',
    'Skeleton',
    'ErrorBoundary',
  ],
  'Modals & Dialogs': ['Modal', 'AnchoredModal', 'ConfirmDialog', 'LinkDialog', 'ToastProvider'],
  'Forms & Inputs': ['DropdownSelector', 'PermissionModeSelector', 'SlashCommandAdapter'],
  Theme: ['ThemeToggle', 'ThemeVariantToggle'],
  'Display & Status': [
    'TodoDisplay',
    'RequestTiming',
    'SessionTimeTracking',
    'PlanEditModeIndicator',
    'VimModeIndicator',
  ],
  'Panels & Layout': ['DetailPanel', 'ResizablePanel', 'VerticalSplitPanel', 'ThreeColumnLayout'],
  'Tasks & Projects': ['TaskList', 'TodoActivityTracker', 'AddProjectModal', 'ProjectList'],
  Monitoring: ['StatsPanel', 'UsageMonitor', 'UsageStats', 'UsageDashboard'],
  'Main Layout': ['MenuBar', 'Sidebar', 'MainContent', 'UpdateNotification', 'ChatInterface'],
  'Text & Content': ['RichTextEditor', 'MarkdownRenderer', 'DiffViewer', 'StreamingEventDisplay'],
  'Tools & Development': ['ToolUsageDisplay', 'EditorToolbar', 'SlashCommands'],
  'Text Editing': [
    'TextFormattingMenu',
    'EmojiPicker',
    'MentionPicker',
    'KeyboardShortcutsHelp',
    'KeyboardShortcutTooltip',
  ],
  'Commands & Navigation': ['CommandMenu'],
  Settings: ['LLMSettings'],
} as const;

// Get all component names as a flat array
export const ALL_COMPONENTS = Object.values(COMPONENT_CATEGORIES).flat();

// Component count for verification
export const COMPONENT_COUNT = ALL_COMPONENTS.length;
