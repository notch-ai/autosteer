/**
 * Agent Type Definitions
 * Type-only file containing agent-related types and interfaces
 */

/**
 * Agent status types
 */
export type AgentStatus = 'active' | 'idle' | 'archived' | 'error';

/**
 * Agent type classifications
 */
export type AgentType = 'assistant' | 'agent' | 'custom';

/**
 * Agent configuration stored in config.json
 */
export interface AgentConfig {
  id: string;
  title: string;
  content: string;
  preview: string;
  type: AgentType;
  status: AgentStatus;
  project_id: string;
  created_at: string;
  updated_at: string;
  tags?: string[];
  resource_ids?: string[];
  metadata?: Record<string, unknown>;
  chat_history?: ChatMessageConfig[];
  claude_session_id?: string;
}

/**
 * Chat message configuration
 */
export interface ChatMessageConfig {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachedResources?: string[];
}

/**
 * Agent session mapping for multi-agent support
 */
export interface AgentSessionMapping {
  agentId: string;
  sessionId: string;
  createdAt: Date;
  lastAccessedAt: Date;
  additionalDirectories?: string[];
}

/**
 * Worktree session manifest
 */
export interface WorktreeSessionManifest {
  worktreeId: string;
  sessions: Record<string, AgentSessionMapping>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Agent creation parameters
 */
export interface CreateAgentParams {
  title: string;
  content: string;
  preview?: string;
  type?: AgentType;
  status?: AgentStatus;
  projectId?: string;
  tags?: string[];
  resourceIds?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Agent update parameters
 */
export interface UpdateAgentParams {
  title?: string;
  content?: string;
  preview?: string;
  status?: AgentStatus;
  tags?: string[];
  resourceIds?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Agent filter options
 */
export interface AgentFilterOptions {
  status?: AgentStatus | AgentStatus[];
  type?: AgentType | AgentType[];
  projectId?: string;
  tags?: string[];
  searchQuery?: string;
}

/**
 * Agent sort options
 */
export interface AgentSortOptions {
  field: 'title' | 'createdAt' | 'updatedAt' | 'status';
  direction: 'asc' | 'desc';
}
