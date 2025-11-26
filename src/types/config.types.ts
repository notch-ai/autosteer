/**
 * Application configuration structure for ~/.autosteer/app.json
 * This file is always at the fixed location and contains only the project directory pointer
 */
export interface AppConfig {
  projectDirectory?: string; // Path to the project directory (defaults to ~/.autosteer if not set)
}

/**
 * Project configuration structure for <project-dir>/config.json
 * This file is stored in the project directory (location determined by app.json)
 */

export interface WorktreeConfig {
  git_repo: string;
  branch_name: string;
  folder_name: string;
  agent_ids?: string[];
  activeTabId?: string;
}

export interface AgentConfig {
  id: string;
  title: string;
  content: string;
  preview: string;
  type: string;
  status: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  resource_ids: string[];
  metadata?: Record<string, unknown>;
  claude_session_id?: string; // Claude Code CLI session ID
  chat_history?: Array<{
    id: string;
    role: string;
    content: string;
    timestamp: string;
    attachedResources?: string[];
  }>;
}

// Custom command interface for user-defined commands
export interface CustomCommand {
  id: string;
  name: string;
  description: string;
  command: string;
  createdAt: Date;
}

export interface AutosteerConfig {
  worktrees: WorktreeConfig[];
  agents?: AgentConfig[];
  settings?: {
    // UI preferences
    theme?: 'light' | 'dark' | 'system';
    fontSize?: number;
    fontFamily?: string;
    vimMode?: boolean;

    // Application preferences
    autoSave?: boolean;
    compactOnTokenLimit?: boolean;
    maxTokens?: number;
    selectedProvider?: 'mock' | 'claude-code' | 'openai';
    devMode?: boolean; // Development mode for verbose logging
    autoSelectFirstTab?: boolean; // Auto-select first tab when no active tab (default: true)

    // Layout state (optional persistence)
    layout?: {
      sidebarCollapsed?: boolean;
      detailPanelCollapsed?: boolean;
      leftPanelWidth?: number;
      rightPanelWidth?: number;
      activePanel?: string;
    };
  };

  // API keys (encrypted in future)
  apiKeys?: Record<string, string>;

  // Custom slash commands
  customCommands?: CustomCommand[];

  // Recent projects (optional)
  recentProjects?: string[];

  // Per-session settings
  sessionSettings?: {
    [agentId: string]: {
      permissionMode?: string; // 'plan' | 'acceptEdits' | 'bypassPermissions'
      model?: string | null; // Model selection
    };
  };

  // Generic store for miscellaneous data
  store?: Record<string, unknown>;
}

export class AutosteerConfigModel implements AutosteerConfig {
  worktrees: WorktreeConfig[];
  settings?: {
    vimMode?: boolean;
  };

  constructor(data?: Partial<AutosteerConfig>) {
    this.worktrees = data?.worktrees || [];
    this.settings = data?.settings || { vimMode: false }; // Default vim mode to false
  }

  addWorktree(worktree: WorktreeConfig): void {
    this.worktrees.push(worktree);
  }

  removeWorktree(folderName: string): void {
    this.worktrees = this.worktrees.filter((w) => w.folder_name !== folderName);
  }

  findWorktree(folderName: string): WorktreeConfig | undefined {
    return this.worktrees.find((w) => w.folder_name === folderName);
  }

  toJSON(): AutosteerConfig {
    const config: AutosteerConfig = {
      worktrees: this.worktrees,
    };

    if (this.settings) {
      config.settings = this.settings;
    }

    return config;
  }
}
