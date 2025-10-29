import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { enableMapSet } from 'immer';
import { useCoreStore } from '@/stores/core';
import { claudeCodeService } from '@/renderer/services/ClaudeCodeService';
import { AgentStatus, AgentType } from '@/entities';

// Enable MapSet plugin for Immer to work with Map objects
enableMapSet();

// Mock dependencies
jest.mock('@/renderer/services/ClaudeCodeService');
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'test-id-123'),
}));

// Mock electron window
global.window = {
  electron: {
    agents: {
      loadAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      loadChatHistory: jest.fn(),
    },
    worktree: {
      getAll: jest.fn(),
      delete: jest.fn(),
    },
    resources: {
      uploadResources: jest.fn(),
      previewResource: jest.fn(),
      getResources: jest.fn(),
    },
    ipcRenderer: {
      invoke: jest.fn(),
      on: jest.fn(),
      removeListener: jest.fn(),
    },
    updateAgentSession: jest.fn(),
  },
} as any;

describe('CoreStore Claude Code Integration', () => {
  let store: ReturnType<typeof useCoreStore.getState>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the store
    useCoreStore.setState({
      agents: new Map(),
      selectedAgentId: null,
      agentsLoading: false,
      agentsError: null,
      messages: new Map(),
      activeChat: null,
      streamingMessages: new Map(),
      attachments: new Map(),
      streamingStates: new Map(),
      chatError: null,
      projects: new Map(),
      selectedProjectId: null,
      projectsLoading: false,
      projectsError: null,
      resources: new Map(),
      resourcesLoading: false,
      tasks: [],
      focusedTodoId: null,
    });
    store = useCoreStore.getState();
  });

  describe('sendMessage with Claude Code Integration', () => {
    it('should handle errors gracefully', async () => {
      // Setup
      const mockAgent = {
        id: 'agent-1',
        title: 'Test Agent',
        content: 'Test content',
        preview: 'Test preview',
        type: AgentType.TEXT,
        status: AgentStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        resourceIds: [],
      };

      // Add agent to store
      const currentState = useCoreStore.getState();
      currentState.agents.set('agent-1', mockAgent);
      useCoreStore.setState({
        agents: currentState.agents,
        selectedAgentId: 'agent-1',
        activeChat: 'agent-1',
      });

      const mockError = new Error('Claude API error');
      const mockQueryWithStreaming = jest.fn(() => Promise.reject(mockError));
      (claudeCodeService.queryWithStreaming as jest.Mock) = mockQueryWithStreaming;

      // Act & Assert
      await expect(store.sendMessage('Test')).rejects.toThrow('Claude API error');
      const currentStore = useCoreStore.getState();
      expect(currentStore.chatError).toBe('Claude API error');
      expect(currentStore.streamingStates.get('agent-1')).toBeFalsy();
    });

    it('should use project context when available', async () => {
      // Setup
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        localPath: '/test/path',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        folderName: 'test-folder',
      };

      store.projects.set('project-1', mockProject);
      store.selectedProjectId = 'project-1';
      store.selectedAgentId = 'agent-1';
      store.activeChat = 'agent-1';

      // Add agent with project association
      store.agents.set('agent-1', {
        id: 'agent-1',
        title: 'Test Agent',
        content: '',
        preview: '',
        type: AgentType.TEXT,
        status: AgentStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        resourceIds: [],
        projectId: 'test-folder',
      });

      const mockQueryWithStreaming = jest.fn(() => Promise.resolve('Response'));
      (claudeCodeService.queryWithStreaming as jest.Mock) = mockQueryWithStreaming;

      // Act
      await store.sendMessage('Analyze this project');

      // Assert
      expect(mockQueryWithStreaming).toHaveBeenCalledWith(
        'Analyze this project',
        expect.objectContaining({
          sessionId: 'agent-1',
          projectId: 'test-folder',
          conversationOptions: expect.objectContaining({
            cwd: '/test/path',
          }),
        }),
        expect.any(Object)
      );
    });

    it('should handle attachments', async () => {
      // Setup
      const mockAgent = {
        id: 'agent-1',
        title: 'Test Agent',
        content: 'Test content',
        preview: 'Test preview',
        type: AgentType.TEXT,
        status: AgentStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        resourceIds: [],
      };

      // Add agent to store
      const currentState = useCoreStore.getState();
      currentState.agents.set('agent-1', mockAgent);

      // Add mock resources to the store
      const mockResources = new Map([
        [
          'resource-1',
          {
            id: 'resource-1',
            name: 'test.txt',
            type: 'document' as any,
            path: '/tmp/test.txt',
            mimeType: 'text/plain',
            size: 100,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        [
          'resource-2',
          {
            id: 'resource-2',
            name: 'image.png',
            type: 'image' as any,
            path: '/tmp/image.png',
            mimeType: 'image/png',
            size: 200,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      ]);

      useCoreStore.setState({
        agents: currentState.agents,
        selectedAgentId: 'agent-1',
        activeChat: 'agent-1',
        resources: mockResources,
      });

      // Mock previewResource to return base64 data
      const mockPreviewResource = jest.fn();
      let callCount = 0;
      mockPreviewResource.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve('data:text/plain;base64,dGVzdCBjb250ZW50');
        } else {
          return Promise.resolve('data:image/png;base64,aW1hZ2UgZGF0YQ==');
        }
      });
      // Ensure resources object exists
      if (!window.electron.resources) {
        (window.electron as any).resources = {
          uploadResources: jest.fn(),
          previewResource: mockPreviewResource,
          getResources: jest.fn(),
        };
      } else {
        (window.electron.resources.previewResource as any) = mockPreviewResource;
      }

      const mockQueryWithStreaming = jest.fn(() => Promise.resolve('Files processed'));
      (claudeCodeService.queryWithStreaming as jest.Mock) = mockQueryWithStreaming;

      // Act - pass resourceIds instead of Files (second param is undefined for backward compat)
      await store.sendMessage('Process these files', undefined, ['resource-1', 'resource-2']);

      // Assert
      expect(mockQueryWithStreaming).toHaveBeenCalledWith(
        'Process these files',
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              type: 'document',
              media_type: 'text/plain',
              filename: 'test.txt',
            }),
            expect.objectContaining({
              type: 'image',
              media_type: 'image/png',
              filename: 'image.png',
            }),
          ]),
        }),
        expect.any(Object)
      );
    });

    it('should maintain session per agent', async () => {
      // Setup two agents
      store.agents.set('agent-1', {
        id: 'agent-1',
        title: 'Agent 1',
        content: '',
        preview: '',
        type: AgentType.TEXT,
        status: AgentStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        resourceIds: [],
      });

      store.agents.set('agent-2', {
        id: 'agent-2',
        title: 'Agent 2',
        content: '',
        preview: '',
        type: AgentType.TEXT,
        status: AgentStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        resourceIds: [],
      });

      const mockQueryWithStreaming = jest.fn(() => Promise.resolve('Response'));
      (claudeCodeService.queryWithStreaming as jest.Mock) = mockQueryWithStreaming;

      // Mock loadChatHistory - check if window.electron exists first
      if (window.electron?.agents) {
        (window.electron.agents.loadChatHistory as any).mockResolvedValue([]);
      }

      // Send message to agent 1
      await store.selectAgent('agent-1');
      await store.sendMessage('Message to agent 1');

      // Send message to agent 2
      await store.selectAgent('agent-2');
      await store.sendMessage('Message to agent 2');

      // Assert different session IDs were used
      expect(mockQueryWithStreaming).toHaveBeenCalledTimes(2);
      expect(mockQueryWithStreaming).toHaveBeenNthCalledWith(
        1,
        'Message to agent 1',
        expect.objectContaining({ sessionId: 'agent-1' }),
        expect.any(Object)
      );
      expect(mockQueryWithStreaming).toHaveBeenNthCalledWith(
        2,
        'Message to agent 2',
        expect.objectContaining({ sessionId: 'agent-2' }),
        expect.any(Object)
      );
    });

    it('should update streaming state correctly', async () => {
      // Setup
      const mockAgent = {
        id: 'agent-1',
        title: 'Test Agent',
        content: 'Test content',
        preview: 'Test preview',
        type: AgentType.TEXT,
        status: AgentStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        resourceIds: [],
      };

      // Add agent to store
      const currentState = useCoreStore.getState();
      currentState.agents.set('agent-1', mockAgent);
      useCoreStore.setState({
        agents: currentState.agents,
        selectedAgentId: 'agent-1',
        activeChat: 'agent-1',
      });

      const mockQueryWithStreaming = jest
        .fn()
        .mockImplementation(async (_prompt: any, _options: any, callbacks: any) => {
          // Check streaming state is true during streaming
          const currentStore = useCoreStore.getState();
          expect(currentStore.streamingStates.get('agent-1')).toBe(true);

          callbacks.onComplete('Response');
          return 'Response';
        });
      (claudeCodeService.queryWithStreaming as jest.Mock) = mockQueryWithStreaming;

      // Act
      await store.sendMessage('Test');

      // Assert
      const finalStore = useCoreStore.getState();
      expect(finalStore.streamingStates.get('agent-1')).toBeFalsy();
    });
  });

  describe('Error handling', () => {
    it('should handle missing agent gracefully', async () => {
      // No agent selected
      store.selectedAgentId = null;
      store.activeChat = null;

      // Act & Assert
      await expect(store.sendMessage('Test')).rejects.toThrow('No active chat or selected agent');
    });

    it('should clean up on error', async () => {
      // Setup
      const mockAgent = {
        id: 'agent-1',
        title: 'Test Agent',
        content: 'Test content',
        preview: 'Test preview',
        type: AgentType.TEXT,
        status: AgentStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        resourceIds: [],
      };

      // Add agent to store
      const currentState = useCoreStore.getState();
      currentState.agents.set('agent-1', mockAgent);
      useCoreStore.setState({
        agents: currentState.agents,
        selectedAgentId: 'agent-1',
        activeChat: 'agent-1',
      });

      const mockQueryWithStreaming = jest
        .fn()
        .mockImplementation(async (_prompt: any, _options: any, callbacks: any) => {
          callbacks.onError(new Error('Stream error'));
          throw new Error('Stream error');
        });
      (claudeCodeService.queryWithStreaming as jest.Mock) = mockQueryWithStreaming;

      // Act
      try {
        await store.sendMessage('Test');
      } catch (error) {
        // Expected
      }

      // Assert
      const currentStore = useCoreStore.getState();
      expect(currentStore.streamingStates.get('agent-1')).toBeFalsy();
      expect(currentStore.chatError).toBe('Stream error');
    });
  });

  describe('Task State Selectors', () => {
    it('should return false when no tasks exist', () => {
      useCoreStore.setState({ tasks: [] });
      const store = useCoreStore.getState();
      expect(store.hasActiveTasks()).toBe(false);
    });

    it('should return false when all tasks are pending', () => {
      useCoreStore.setState({
        tasks: [
          {
            id: 'task-1',
            content: 'Test task 1',
            completed: false,
            timestamp: new Date(),
            status: 'pending',
          },
          {
            id: 'task-2',
            content: 'Test task 2',
            completed: false,
            timestamp: new Date(),
            status: 'pending',
          },
        ],
      });
      const store = useCoreStore.getState();
      expect(store.hasActiveTasks()).toBe(false);
    });

    it('should return true when any task is in-progress', () => {
      useCoreStore.setState({
        tasks: [
          {
            id: 'task-1',
            content: 'Test task 1',
            completed: false,
            timestamp: new Date(),
            status: 'pending',
          },
          {
            id: 'task-2',
            content: 'Test task 2',
            completed: false,
            timestamp: new Date(),
            status: 'in_progress',
          },
          {
            id: 'task-3',
            content: 'Test task 3',
            completed: true,
            timestamp: new Date(),
            status: 'completed',
          },
        ],
      });
      const store = useCoreStore.getState();
      expect(store.hasActiveTasks()).toBe(true);
    });

    it('should return false when all tasks are completed', () => {
      useCoreStore.setState({
        tasks: [
          {
            id: 'task-1',
            content: 'Test task 1',
            completed: true,
            timestamp: new Date(),
            status: 'completed',
          },
          {
            id: 'task-2',
            content: 'Test task 2',
            completed: true,
            timestamp: new Date(),
            status: 'completed',
          },
        ],
      });
      const store = useCoreStore.getState();
      expect(store.hasActiveTasks()).toBe(false);
    });

    it('should return false when tasks have failed status', () => {
      useCoreStore.setState({
        tasks: [
          {
            id: 'task-1',
            content: 'Test task 1',
            completed: false,
            timestamp: new Date(),
            status: 'failed',
          },
        ],
      });
      const store = useCoreStore.getState();
      expect(store.hasActiveTasks()).toBe(false);
    });
  });
});
