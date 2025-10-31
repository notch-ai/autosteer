// Feature components that preserve legacy APIs while using new UI components internally
// These components maintain backward compatibility for existing code

export { Button, buttonVariants, type ButtonProps } from './Button';
export { ConfirmDialog } from './ConfirmDialog';
export { DropdownSelector, type DropdownOption } from './DropdownSelector';
export { FormButton, type FormButtonProps } from './FormButton';
export {
  Input,
  Select,
  Textarea,
  inputVariants,
  type InputProps,
  type SelectProps,
  type TextareaProps,
} from './Input';
export { Modal, type ModalFooterAction, type ModalProps } from './Modal';
export { Skeleton, SkeletonAgent, SkeletonContent, SkeletonResource } from './Skeleton';
export {
  Toast,
  ToastContainer,
  toast,
  toastError,
  toastInfo,
  toastSuccess,
  toastWarning,
  type ToastProps,
  type ToastType,
} from './Toast';

// New migrated components
export { AnchoredModal, type AnchoredModalProps } from './AnchoredModal';
export { CommandMenu, CommandMenuItem, type CommandMenuProps } from './CommandMenu';
export { Icon, type IconName } from './Icon';
export { IconButton, type IconButtonProps } from './IconButton';
export { LinkDialog } from './LinkDialog';
export { MenuBar, type MenuBarProps } from './MenuBar';
export { ResizablePanel } from './ResizablePanel';
export { ThemeToggle } from './ThemeToggle';
export { ThemeVariantToggle } from './ThemeVariantToggle';
export { ToastProvider, type ToastProviderProps } from './ToastProvider';

// Layout components
export { DetailPanel } from './DetailPanel';
export { MainContent } from './MainContent';
export { SessionTimeTracking } from './SessionTimeTracking';
export { Sidebar } from './Sidebar';
export { StatsPanel } from './StatsPanel';
export { ThreeColumnLayout } from './ThreeColumnLayout';
export { VerticalSplitPanel } from './VerticalSplitPanel';

// Complex components
export { ChatInterface, type ChatInterfaceRef } from './ChatInterface';
export { DiffViewer } from './DiffViewer';
export { EditorToolbar, type EditorToolbarProps } from './EditorToolbar';
export { EmojiPicker } from './EmojiPicker';
export { ErrorBoundary } from './ErrorBoundary';
export { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
export { MarkdownRenderer, type MarkdownRendererProps } from './MarkdownRenderer';
export { RichTextEditor, type RichTextEditorProps } from './RichTextEditor';

// Display components (newly migrated)
export { FileMentions, type FileMentionsProps } from './FileMentions';
export { MentionPicker, type MentionPickerProps } from './MentionPicker';
export { RequestTiming, type RequestTimingProps } from './RequestTiming';
export { SlashCommands, type SlashCommandsProps } from './SlashCommands';
export { StatusDisplay } from './StatusDisplay';
export { StreamingEventDisplay, type StreamingEventDisplayProps } from './StreamingEventDisplay';
export { TextFormattingMenu } from './TextFormattingMenu';
export { TodoDisplay, type TodoDisplayProps } from './TodoDisplay';
export { ToolPairDisplay } from './ToolPairDisplay';
export { ToolUsageDisplay, type ToolUsageDisplayProps } from './ToolUsageDisplay';

// Newly moved components from root
export { KeyboardShortcutTooltip } from './KeyboardShortcutTooltip';
export { LLMSettings } from './LLMSettings';
export { PermissionModeSelector } from './PermissionModeSelector';
export { PlanEditModeIndicator } from './PlanEditModeIndicator';
export { SlashCommandAdapter } from './SlashCommandAdapter';
export { TaskList, type Task } from './TaskList';
export { TodoActivityTracker } from './TodoActivityTracker';
export { UpdateNotification } from './UpdateNotification';
export { UsageDashboard } from './UsageDashboard';
export { UsageMonitor } from './UsageMonitor';
export { UsageStats } from './UsageStats';
