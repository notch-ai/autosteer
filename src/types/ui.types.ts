export interface SessionTab {
  id: string;
  agentId: string;
  agentName: string;
  agentType: string;
  isActive: boolean;
  sessionId: string;
  lastAccessed: Date;
  tabType?: 'agent' | 'terminal' | 'changes'; // Add tab type to distinguish between agent, terminal, and changes tabs
}

export interface TabState {
  tabs: SessionTab[];
  activeTabId: string;
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

// Changes Tab State
export interface ChangesTabState {
  selectedFile: string | null;
  panelSizes: { fileList: number; diffViewer: number }; // percentages (40/60 default)
  scrollPosition: number;
}
