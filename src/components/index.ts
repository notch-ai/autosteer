/**
 * Central Component Export Index
 *
 * This file exports all components from a single location to support
 * the component showcase system for visual testing.
 */

// Basic UI Components
export { Icon } from '@/features/shared';
export { Button, buttonVariants } from '@/features/shared/components/ui/Button';
export { Input, Textarea, Select, inputVariants } from '@/features/shared/components/ui/Input';
export { FormButton } from '@/features/shared';
export { IconButton } from '@/features/shared';
export { Toast } from '@/features/shared/components/ui/Toast';
export { Skeleton } from '@/features/shared/components/ui/Skeleton';
export { ErrorBoundary } from '@/features/shared/components/ui/ErrorBoundary';

// Modal and Dialog Components
export { Modal } from '@/features/shared/components/ui/Modal';
export { AnchoredModal } from '@/features/shared';
export { ConfirmDialog } from '@/features/shared/components/ui/ConfirmDialog';
export { LinkDialog } from '@/features/chat';
export { ToastProvider } from '@/features/shared';

// Form and Input Components
export { DropdownSelector } from '@/features/shared';
export { PermissionModeSelector } from '@/features/shared';
export { SlashCommandAdapter } from '@/features/chat';

// Theme Components
export { ThemeToggle } from '@/features/settings/components/ThemeToggle';
export { ThemeVariantToggle } from '@/features/settings/components/ThemeVariantToggle';

// Display and Status Components
export { TodoDisplay } from '@/features/shared';
export { RequestTiming } from '@/features/monitoring';
export { SessionTimeTracking } from '@/features/shared/components/session/SessionTimeTracking';
export { PlanEditModeIndicator } from '@/features/shared';
export { VimModeIndicator } from '@/features/settings/components/VimModeIndicator';

// Panel and Layout Components
export { DetailPanel } from '@/features/shared';
export { ResizablePanel } from '@/features/shared/components/layout/ResizablePanel';
export { VerticalSplitPanel } from '@/features/shared/components/layout/VerticalSplitPanel';
export { ThreeColumnLayout } from '@/features/shared/components/layout/ThreeColumnLayout';

// Task and Project Management
export { TaskList } from '@/features/shared';
export { TodoActivityTracker } from '@/features/shared';
export { AddProjectModal } from '@/features/shared/components/projects/AddProjectModal';
export { ProjectList } from '@/features/shared/components/projects/ProjectList';

// Statistics and Monitoring
export { StatsPanel } from '@/features/monitoring/components/StatsPanel';
export { UsageMonitor } from '@/features/monitoring/components/UsageMonitor';
export { UsageStats } from '@/features/monitoring/components/UsageStats';
export { UsageDashboard } from '@/features/monitoring/components/UsageDashboard';

// Main Layout Components
export { MenuBar } from '@/features/shared/components/layout/MenuBar';
export { Sidebar } from '@/features/shared/components/layout/Sidebar';
export { MainContent } from '@/features/shared/components/layout/MainContent';
export { UpdateNotification } from '@/features/shared';
export { ChatInterface } from '@/features/chat/components/ChatInterface';

// Text and Content Components
export { RichTextEditor } from '@/features/chat/components/RichTextEditor';
export { MarkdownRenderer } from '@/features/chat/components/MarkdownRenderer';
export { DiffViewer } from '@/features/shared/components/git/DiffViewer';
export { StreamingEventDisplay } from '@/features/monitoring';

// Tool and Development Components
export { ToolUsageDisplay } from '@/features/monitoring';
export { EditorToolbar } from '@/features/chat';
export { SlashCommands } from '@/features/chat/components/SlashCommands';

// Text Editing and Interaction Components
export { TextFormattingMenu } from '@/features/chat/components/TextFormattingMenu';
export { EmojiPicker } from '@/features/chat/components/EmojiPicker';
export { MentionPicker } from '@/features/chat';
export { KeyboardShortcutsHelp } from '@/features/shared';
export { KeyboardShortcutTooltip } from '@/features/shared';

// Command and Navigation Components
export { CommandMenu } from '@/features/chat/components/CommandMenu';

// Settings and Configuration
export { LLMSettings } from '@/features/settings/components/LLMSettings';

// Export component types for type safety
export type { IconName } from '@/features/shared';
export type { ModalProps } from '@/features/shared/components/ui/Modal';
export type { CommandMenuItem } from '@/features/chat/components/CommandMenu';

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
