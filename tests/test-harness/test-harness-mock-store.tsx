import React, { createContext, useContext, ReactNode } from 'react';
import {
  Agent,
  AgentStatus,
  AgentType,
  Resource,
  ResourceType,
  ToolUsage,
  StreamingEvent,
  ChatMessage,
} from '@/entities';
import { Task } from '@/components/features/TaskList';
import { VimState } from '@/stores/vimStore';
import { Project } from '@/types/project.types';
import { AppStore } from '@/stores/types';

// Mock initial VimState
const mockVimState: VimState = {
  mode: 'NORMAL',
  enabled: false,
};

// Mock store implementation
const createMockStore = (): AppStore => ({
  // State
  agents: [],
  selectedAgentId: null,
  agentsLoading: false,
  agentsError: null,

  chatHistoryCache: new Map<string, ChatMessage[]>(),

  resources: {},
  resourcesLoading: false,
  resourcesError: null,

  searchQuery: '',
  searchResults: [],
  isSearching: false,

  chatLoading: false,
  chatError: null,
  attachedResourceIds: [],
  isCompactingConversation: false,
  pendingCompactResult: null,

  isStreaming: false,
  streamingMessageId: null,
  streamingContent: '',
  streamingToolUsages: [],
  streamingEvents: [],

  sidebarCollapsed: false,
  detailPanelCollapsed: false,
  activeView: 'list' as const,
  leftPanelWidth: 260,
  rightPanelWidth: 360,

  tasks: [],
  focusedTodoId: null,

  vim: mockVimState,

  projects: [],
  selectedProjectId: null,
  projectsLoading: false,
  projectsError: null,
  showProjectCreation: false,

  slashCommands: [],
  slashCommandsLoading: false,
  slashCommandsError: null,

  worktreeStats: {},

  // Actions - all return promises that resolve immediately or safe defaults
  loadAgents: async () => {
    // Mock implementation - do nothing
  },

  createAgent: async (agentData) => {
    const mockAgent: Agent = {
      id: `mock-agent-${Date.now()}`,
      ...agentData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return mockAgent;
  },

  updateAgent: async () => {
    // Mock implementation - do nothing
  },

  deleteAgent: async () => {
    // Mock implementation - do nothing
  },

  selectAgent: () => {
    // Mock implementation - do nothing
  },

  loadResources: async () => {
    // Mock implementation - do nothing
  },

  uploadResource: async (file) => {
    const mockResource: Resource = {
      id: `mock-resource-${Date.now()}`,
      name: file.name,
      type: ResourceType.OTHER,
      path: '',
      size: file.size,
      mimeType: file.type,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return mockResource;
  },

  deleteResource: async () => {
    // Mock implementation - do nothing
  },

  openResource: async () => {
    // Mock implementation - do nothing
  },

  searchAgents: async () => {
    // Mock implementation - do nothing
  },

  clearSearch: () => {
    // Mock implementation - do nothing
  },

  sendMessage: async () => {
    // Mock implementation - do nothing
  },

  sendStreamingMessage: async () => {
    // Mock implementation - do nothing
  },

  attachResourceToChat: () => {
    // Mock implementation - do nothing
  },

  removeAttachedResource: () => {
    // Mock implementation - do nothing
  },

  clearAttachedResources: () => {
    // Mock implementation - do nothing
  },

  loadChatHistory: async () => {
    return [];
  },

  stopStreaming: () => {
    // Mock implementation - do nothing
  },

  addToolUsage: () => {
    // Mock implementation - do nothing
  },

  updateToolUsage: () => {
    // Mock implementation - do nothing
  },

  clearStreamingToolUsages: () => {
    // Mock implementation - do nothing
  },

  addStreamingEvent: () => {
    // Mock implementation - do nothing
  },

  clearStreamingEvents: () => {
    // Mock implementation - do nothing
  },

  clearChat: async () => {
    // Mock implementation - do nothing
  },

  toggleSidebar: () => {
    // Mock implementation - do nothing
  },

  toggleDetailPanel: () => {
    // Mock implementation - do nothing
  },

  setActiveView: () => {
    // Mock implementation - do nothing
  },

  setLeftPanelWidth: () => {
    // Mock implementation - do nothing
  },

  setRightPanelWidth: () => {
    // Mock implementation - do nothing
  },

  setFocusedTodo: () => {
    // Mock implementation - do nothing
  },

  addTask: () => {
    // Mock implementation - do nothing
  },

  toggleTask: () => {
    // Mock implementation - do nothing
  },

  clearTasks: () => {
    // Mock implementation - do nothing
  },

  updateTasksFromMessage: () => {
    // Mock implementation - do nothing
  },

  setVimMode: () => {
    // Mock implementation - do nothing
  },

  resetVimState: () => {
    // Mock implementation - do nothing
  },

  updateVimState: () => {
    // Mock implementation - do nothing
  },

  reset: () => {
    // Mock implementation - do nothing
  },

  loadProjects: async () => {
    // Mock implementation - do nothing
  },

  createProject: async (projectData) => {
    const mockProject: Project = {
      id: `mock-project-${Date.now()}`,
      ...projectData,
      localPath: projectData.localPath || '',
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return mockProject;
  },

  updateProject: async () => {
    // Mock implementation - do nothing
  },

  deleteProject: async () => {
    // Mock implementation - do nothing
  },

  selectProject: async () => {
    // Mock implementation - do nothing
  },

  setShowProjectCreation: () => {
    // Mock implementation - do nothing
  },

  loadSlashCommands: async () => {
    // Mock implementation - do nothing
  },

  updateWorktreeStats: () => {
    // Mock implementation - do nothing
  },

  resetWorktreeStats: () => {
    // Mock implementation - do nothing
  },
});

// Create mock store context
const MockStoreContext = createContext<AppStore | null>(null);

// Mock hook that provides the store
export const useAppStore = <T,>(selector?: (state: AppStore) => T) => {
  const store = useContext(MockStoreContext);
  if (!store) {
    throw new Error('useAppStore must be used within MockStoreProvider');
  }

  if (selector) {
    return selector(store);
  }

  return store as any; // Return the entire store if no selector
};

// Mock store provider component
export interface MockStoreProviderProps {
  children: ReactNode;
  initialState?: Partial<AppStore>;
}

export const MockStoreProvider: React.FC<MockStoreProviderProps> = ({
  children,
  initialState = {},
}) => {
  const mockStore = createMockStore();

  // Merge any initial state overrides
  const storeWithOverrides = {
    ...mockStore,
    ...initialState,
  };

  return (
    <MockStoreContext.Provider value={storeWithOverrides}>{children}</MockStoreContext.Provider>
  );
};

// Export helper for creating mock data in tests
export const createMockAgent = (overrides: Partial<Agent> = {}): Agent => ({
  id: `mock-agent-${Date.now()}`,
  title: 'Mock Agent',
  content: 'Mock agent content',
  preview: 'Mock preview',
  type: AgentType.TEXT,
  status: AgentStatus.DRAFT,
  createdAt: new Date(),
  updatedAt: new Date(),
  tags: [],
  resourceIds: [],
  projectId: 'mock-project',
  chatHistory: [],
  ...overrides,
});

export const createMockResource = (overrides: Partial<Resource> = {}): Resource => ({
  id: `mock-resource-${Date.now()}`,
  name: 'Mock Resource',
  type: ResourceType.OTHER,
  path: '/mock/path',
  size: 1024,
  mimeType: 'text/plain',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: `mock-task-${Date.now()}`,
  content: 'Mock task',
  status: 'pending',
  activeForm: 'Mock task',
  ...overrides,
});

export const createMockProject = (overrides: Partial<Project> = {}): Project => ({
  id: `mock-project-${Date.now()}`,
  name: 'Mock Project',
  localPath: '/mock/project/path',
  isActive: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockChatMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: `mock-message-${Date.now()}`,
  role: 'user',
  content: 'Mock message content',
  timestamp: new Date(),
  ...overrides,
});

export const createMockChatMessageWithError = (
  overrides: Partial<ChatMessage> = {}
): ChatMessage => ({
  id: `mock-error-message-${Date.now()}`,
  role: 'assistant',
  content: 'I encountered an error while processing your request.',
  timestamp: new Date(),
  error: {
    type: 'api_error',
    message:
      'API Error: 400 due to tool use concurrency issues. Run /rewind to recover the conversation.',
  },
  requestId: 'req_mock_123456789',
  ...overrides,
});

export const createMockToolUsage = (overrides: Partial<ToolUsage> = {}): ToolUsage => ({
  id: `mock-tool-${Date.now()}`,
  name: 'mock-tool',
  input: {},
  isRunning: false,
  timestamp: new Date(),
  ...overrides,
});

export const createMockStreamingEvent = (
  overrides: Partial<StreamingEvent> = {}
): StreamingEvent => ({
  id: `mock-event-${Date.now()}`,
  type: 'content',
  timestamp: new Date(),
  content: 'Mock event content',
  ...overrides,
});
