/**
 * Represents a session tab in the application.
 * Tabs can be agent-specific, system tabs (terminal/changes), or maximize views.
 * Per-project tab isolation ensures agents only appear for their associated project.
 */
export interface SessionTab {
  /** Unique identifier for the tab */
  id: string;
  /** ID of the agent or system component */
  agentId: string;
  /** Display name of the agent or system tab */
  agentName: string;
  /** Type of agent (general, text, terminal, changes, maximize) */
  agentType: string;
  /** Whether this tab is currently active */
  isActive: boolean;
  /** Claude Code session ID associated with this tab */
  sessionId: string;
  /** Generated session name like "Swift River" (optional) */
  sessionName?: string;
  /** Last time this tab was accessed */
  lastAccessed: Date;
  /** Type of tab to distinguish between different tab categories */
  tabType?: 'agent' | 'terminal' | 'changes' | 'tools' | 'maximize';
}

/**
 * Specialized tab type for maximize views.
 * Extends SessionTab with additional metadata for maximize functionality.
 */
export interface MaximizeTab extends SessionTab {
  /** Always 'maximize' for maximize tabs */
  tabType: 'maximize';
  /** The session ID this maximize tab belongs to */
  parentSessionId: string;
  /** Which panel is currently active in the maximize view */
  activeSubTab?: 'todos' | 'status' | 'trace';
  /** Project ID this maximize tab belongs to - for project scoping */
  projectId: string;
  /** Whether this tab is persistent (cannot be closed manually) */
  persistent?: boolean;
}

/**
 * Global tab state for the application.
 * Manages all session tabs, active tab selection, and tab limits.
 * Tabs are scoped per project - only tabs for the selected project are visible.
 */
export interface TabState {
  /** Array of all session tabs for the current project */
  tabs: SessionTab[];
  /** ID of the currently active tab */
  activeTabId: string;
  /** Maximum number of tabs allowed (default: 10) */
  maxTabs: number;
}

export interface TabKeyboardShortcuts {
  'cmd+1': () => void; // Switch to tab 1
  'cmd+2': () => void; // Switch to tab 2
  'cmd+3': () => void; // Switch to tab 3
  'cmd+4': () => void; // Switch to tab 4
  'cmd+5': () => void; // Switch to tab 5
  'ctrl+1': () => void; // Switch to tab 1 (Windows/Linux)
  'ctrl+2': () => void; // Switch to tab 2 (Windows/Linux)
  'ctrl+3': () => void; // Switch to tab 3 (Windows/Linux)
  'ctrl+4': () => void; // Switch to tab 4 (Windows/Linux)
  'ctrl+5': () => void; // Switch to tab 5 (Windows/Linux)
  'cmd+t': () => void; // New tab
  'ctrl+t': () => void; // New tab (Windows/Linux)
  'cmd+w': () => void; // Close current tab
  'ctrl+w': () => void; // Close current tab (Windows/Linux)
}

/**
 * State for the Changes tab.
 * Manages file selection, panel sizes, and scroll position.
 */
export interface ChangesTabState {
  /** Currently selected file path for diff viewing */
  selectedFile: string | null;
  /** Panel size percentages for file list and diff viewer (default: 30/70) */
  panelSizes: { fileList: number; diffViewer: number };
  /** Current vertical scroll position */
  scrollPosition: number;
}
