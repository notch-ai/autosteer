/**
 * AgentHandlers Test Suite
 * Tests for IPC agent handler operations including CRUD, session management, and chat history
 */

import { AgentHandlers } from '@/main/ipc/handlers/AgentHandlers';
import { FileDataStoreService } from '@/services/FileDataStoreService';
import { SessionManifestService } from '@/services/SessionManifestService';
import { IPC_CHANNELS } from '@/types/ipc.types';
import { ipcMain } from 'electron';
import { createTestAgents } from '../../../../factories';

// Mock dependencies
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
  },
  app: {
    getPath: jest.fn(() => '/mock/path'),
  },
  BrowserWindow: {
    fromWebContents: jest.fn(() => ({
      webContents: {
        isDestroyed: jest.fn(() => false),
        send: jest.fn(),
      },
    })),
  },
}));

jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('@/services/FileDataStoreService');
jest.mock('@/services/SessionManifestService');

describe('AgentHandlers', () => {
  let agentHandlers: AgentHandlers;
  let mockFileDataStore: jest.Mocked<FileDataStoreService>;
  let mockSessionManifest: jest.Mocked<SessionManifestService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock instances
    mockFileDataStore = {
      getAgents: jest.fn(),
      getAgentsByProjectId: jest.fn(),
      getAgent: jest.fn(),
      addAgent: jest.fn(),
      updateAgent: jest.fn(),
      deleteAgent: jest.fn(),
      searchAgents: jest.fn(),
      getWorktrees: jest.fn(),
    } as unknown as jest.Mocked<FileDataStoreService>;

    mockSessionManifest = {
      getAgentSession: jest.fn(),
      updateAgentSession: jest.fn(),
      deleteAgentSessions: jest.fn(),
      updateAdditionalDirectories: jest.fn(),
      getAdditionalDirectories: jest.fn(),
    } as unknown as jest.Mocked<SessionManifestService>;

    // Mock getInstance methods
    (FileDataStoreService.getInstance as jest.Mock) = jest.fn(() => mockFileDataStore);
    (SessionManifestService.getInstance as jest.Mock) = jest.fn(() => mockSessionManifest);

    agentHandlers = new AgentHandlers();
    console.log('[AgentHandlers Test] Initialized test suite');
  });

  describe('registerHandlers', () => {
    it('should register all IPC handlers', () => {
      agentHandlers.registerHandlers();

      expect(ipcMain.handle).toHaveBeenCalledWith(
        IPC_CHANNELS.AGENTS_LOAD_ALL,
        expect.any(Function)
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        IPC_CHANNELS.AGENTS_LOAD_BY_PROJECT,
        expect.any(Function)
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.AGENTS_CREATE, expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.AGENTS_UPDATE, expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.AGENTS_DELETE, expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith(
        IPC_CHANNELS.AGENTS_UPDATE_SESSION,
        expect.any(Function)
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.AGENTS_SEARCH, expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith(
        IPC_CHANNELS.AGENTS_LOAD_CHAT_HISTORY,
        expect.any(Function)
      );

      console.log('[AgentHandlers Test] All IPC handlers registered');
    });

    it('should register additional directory handlers', () => {
      agentHandlers.registerHandlers();

      expect(ipcMain.handle).toHaveBeenCalledWith(
        'agents:updateAdditionalDirectories',
        expect.any(Function)
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        'agents:getAdditionalDirectories',
        expect.any(Function)
      );

      console.log('[AgentHandlers Test] Additional directory handlers registered');
    });
  });

  describe('AGENTS_LOAD_ALL handler', () => {
    it('should load all agents from config', async () => {
      const mockAgents = createTestAgents(3);
      const mockAgentConfigs = mockAgents.map((agent) => ({
        id: agent.id,
        title: agent.title,
        content: agent.content,
        preview: agent.preview,
        type: agent.type,
        status: agent.status,
        project_id: agent.projectId || '',
        created_at: agent.createdAt.toISOString(),
        updated_at: agent.updatedAt.toISOString(),
        tags: agent.tags,
        resource_ids: agent.resourceIds,
      }));

      mockFileDataStore.getAgents.mockResolvedValue(mockAgentConfigs);

      agentHandlers.registerHandlers();
      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === IPC_CHANNELS.AGENTS_LOAD_ALL
      );
      const handler = handleCall[1];
      const result = await handler();

      expect(mockFileDataStore.getAgents).toHaveBeenCalled();
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('title');

      console.log('[AgentHandlers Test] Successfully loaded all agents');
    });

    it('should return error object when loading agents fails', async () => {
      const error = new Error('Failed to load agents');
      mockFileDataStore.getAgents.mockRejectedValue(error);

      agentHandlers.registerHandlers();
      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === IPC_CHANNELS.AGENTS_LOAD_ALL
      );
      const handler = handleCall[1];

      // Create a mock event
      const mockEvent = {
        sender: {
          id: 1,
          isDestroyed: () => false,
        },
      };

      const result = await handler(mockEvent);

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      console.error('[AgentHandlers Test] Error handled correctly:', error.message);
    });
  });

  describe('AGENTS_CREATE handler', () => {
    it('should create a new agent', async () => {
      const newAgentData = {
        title: 'New Test Agent',
        content: 'Test content',
        preview: 'Test preview',
        type: 'assistant' as const,
        status: 'active' as const,
        projectId: 'test-project',
        tags: [],
        resourceIds: [],
      };

      mockFileDataStore.getAgentsByProjectId.mockResolvedValue([]);
      mockFileDataStore.addAgent.mockResolvedValue();

      agentHandlers.registerHandlers();
      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === IPC_CHANNELS.AGENTS_CREATE
      );
      const handler = handleCall[1];
      const result = await handler({}, newAgentData);

      expect(mockFileDataStore.addAgent).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
      expect(result.title).toBe('New Test Agent');

      console.log('[AgentHandlers Test] Agent created successfully:', result.id);
    });

    it.skip('should enforce maximum tab limit', async () => {
      const existingAgents = createTestAgents(10);
      const mockConfigs = existingAgents.map((agent) => ({
        id: agent.id,
        title: agent.title,
        content: agent.content,
        preview: agent.preview,
        type: agent.type,
        status: agent.status,
        project_id: agent.projectId || '',
        created_at: agent.createdAt.toISOString(),
        updated_at: agent.updatedAt.toISOString(),
        tags: agent.tags,
        resource_ids: agent.resourceIds,
      }));

      mockFileDataStore.getAgentsByProjectId.mockResolvedValue(mockConfigs);

      agentHandlers.registerHandlers();
      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === IPC_CHANNELS.AGENTS_CREATE
      );
      const handler = handleCall[1];

      await expect(
        handler(
          {},
          {
            title: 'Sixth Agent',
            content: 'Test',
            preview: 'Test',
            type: 'assistant',
            status: 'active',
            projectId: 'test-project',
            tags: [],
            resourceIds: [],
          }
        )
      ).rejects.toThrow('Maximum tab limit reached');

      console.log('[AgentHandlers Test] Maximum tab limit enforced');
    });
  });

  describe('AGENTS_UPDATE handler', () => {
    it('should update an existing agent', async () => {
      mockFileDataStore.updateAgent.mockResolvedValue();

      agentHandlers.registerHandlers();
      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === IPC_CHANNELS.AGENTS_UPDATE
      );
      const handler = handleCall[1];

      await handler({}, 'test-agent-id', { title: 'Updated Title' });

      expect(mockFileDataStore.updateAgent).toHaveBeenCalledWith(
        'test-agent-id',
        expect.objectContaining({
          title: 'Updated Title',
        })
      );

      console.log('[AgentHandlers Test] Agent updated successfully');
    });
  });

  describe('AGENTS_DELETE handler', () => {
    it('should delete an agent and clean up sessions', async () => {
      const mockAgent = {
        id: 'test-agent-id',
        project_id: 'test-project',
        title: 'Test Agent',
        content: 'Test',
        preview: 'Test',
        type: 'assistant',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tags: [],
        resource_ids: [],
      };

      mockFileDataStore.getAgent.mockResolvedValue(mockAgent);
      mockFileDataStore.deleteAgent.mockResolvedValue();
      mockSessionManifest.deleteAgentSessions.mockResolvedValue();

      agentHandlers.registerHandlers();
      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === IPC_CHANNELS.AGENTS_DELETE
      );
      const handler = handleCall[1];

      await handler({}, 'test-agent-id');

      expect(mockSessionManifest.deleteAgentSessions).toHaveBeenCalledWith(
        'test-project',
        'test-agent-id'
      );
      expect(mockFileDataStore.deleteAgent).toHaveBeenCalledWith('test-agent-id');

      console.log('[AgentHandlers Test] Agent deleted and sessions cleaned up');
    });
  });

  describe('AGENTS_SEARCH handler', () => {
    it('should search agents by query', async () => {
      const mockAgents = createTestAgents(2);
      const mockConfigs = mockAgents.map((agent) => ({
        id: agent.id,
        title: agent.title,
        content: agent.content,
        preview: agent.preview,
        type: agent.type,
        status: agent.status,
        project_id: agent.projectId || '',
        created_at: agent.createdAt.toISOString(),
        updated_at: agent.updatedAt.toISOString(),
        tags: agent.tags,
        resource_ids: agent.resourceIds,
      }));

      mockFileDataStore.searchAgents.mockResolvedValue(mockConfigs);

      agentHandlers.registerHandlers();
      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === IPC_CHANNELS.AGENTS_SEARCH
      );
      const handler = handleCall[1];

      const result = await handler({}, 'test query');

      expect(mockFileDataStore.searchAgents).toHaveBeenCalledWith('test query');
      expect(result).toHaveLength(2);

      console.log('[AgentHandlers Test] Agent search completed successfully');
    });
  });
});
