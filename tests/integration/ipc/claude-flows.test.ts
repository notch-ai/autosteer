/**
 * Integration Tests - Claude Code Flows
 *
 * Tests end-to-end renderer → IPC → service flows for Claude Code operations
 * including agent creation, MCP tool execution, and slash command processing.
 */

import { ClaudeHandlers } from '@/main/ipc/handlers/claude.handlers';
import { FileDataStoreService } from '@/services/FileDataStoreService';
import { SessionManifestService } from '@/services/SessionManifestService';
import { McpAuthService } from '@/services/McpAuthService';
import { AgentType, AgentStatus } from '@/entities';
import { ipcMain } from 'electron';

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
  },
  shell: {
    openExternal: jest.fn(),
  },
}));

jest.mock('@/services/FileDataStoreService');
jest.mock('@/services/SessionManifestService');
jest.mock('@/services/McpAuthService');
jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('Integration: Claude Code Flows', () => {
  let claudeHandlers: ClaudeHandlers;
  let fileDataStore: jest.Mocked<FileDataStoreService>;
  let sessionManifest: jest.Mocked<SessionManifestService>;
  let mcpAuthService: jest.Mocked<McpAuthService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock FileDataStoreService with actual methods used by handlers
    fileDataStore = {
      getAgentsByProjectId: jest.fn(),
      addAgent: jest.fn(),
      updateAgent: jest.fn(),
      deleteAgent: jest.fn(),
      getAgent: jest.fn(),
    } as any;

    // Mock SessionManifestService
    sessionManifest = {
      updateAgentSession: jest.fn(),
      getAgentSession: jest.fn(),
      deleteAgentSessions: jest.fn(),
    } as any;

    // Mock McpAuthService
    mcpAuthService = {
      authenticateServer: jest.fn(),
      getAuthenticatedServers: jest.fn(),
    } as any;

    (FileDataStoreService.getInstance as jest.Mock).mockReturnValue(fileDataStore);
    (SessionManifestService.getInstance as jest.Mock).mockReturnValue(sessionManifest);
    (McpAuthService.getInstance as jest.Mock).mockReturnValue(mcpAuthService);

    claudeHandlers = new ClaudeHandlers();
    claudeHandlers.registerHandlers();
  });

  describe('Agent Creation Flow', () => {
    it('should create agent end-to-end', async () => {
      // Mock successful agent creation
      fileDataStore.getAgentsByProjectId.mockResolvedValue([]);
      fileDataStore.addAgent.mockResolvedValue(undefined);

      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'agents:create'
      );
      expect(handleCall).toBeDefined();

      const handler = handleCall![1];
      const result = await handler({} as any, {
        projectId: 'proj-1',
        title: 'Test Agent',
        content: 'Test content',
        type: AgentType.CODE,
        status: AgentStatus.DRAFT,
        tags: [],
        resourceIds: [],
        preview: 'Test preview',
      });

      expect(result.id).toBeDefined();
      expect(result.title).toBe('Test Agent');
      expect(fileDataStore.addAgent).toHaveBeenCalled();
      expect(fileDataStore.getAgentsByProjectId).toHaveBeenCalledWith('proj-1');
    });

    it('should handle agent creation errors', async () => {
      fileDataStore.getAgentsByProjectId.mockResolvedValue([]);
      fileDataStore.addAgent.mockRejectedValue(new Error('Database error'));

      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'agents:create'
      );
      const handler = handleCall![1];

      const result = await handler({} as any, {
        projectId: 'proj-1',
        title: 'Test Agent',
        content: 'Test content',
        type: AgentType.CODE,
        status: AgentStatus.DRAFT,
        tags: [],
        resourceIds: [],
        preview: 'Test preview',
      });

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Database error'),
        message: expect.any(String),
      });
    });
  });

  describe('Agent List Flow', () => {
    it('should load agents list end-to-end', async () => {
      const mockAgentConfigs = [
        {
          id: 'agent-1',
          project_id: 'proj-1',
          title: 'Agent 1',
          content: 'Content',
          preview: 'Preview',
          type: AgentType.CODE,
          status: AgentStatus.DRAFT,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tags: [],
          resource_ids: [],
        },
      ];

      fileDataStore.getAgentsByProjectId.mockResolvedValue(mockAgentConfigs as any);

      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'agents:loadByProject'
      );
      const handler = handleCall![1];

      const result = await handler({} as any, 'proj-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('agent-1');
      expect(fileDataStore.getAgentsByProjectId).toHaveBeenCalledWith('proj-1');
    });
  });

  describe('Agent Update Flow', () => {
    it('should update agent successfully', async () => {
      fileDataStore.updateAgent.mockResolvedValue(undefined);

      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'agents:update'
      );
      const handler = handleCall![1];

      await handler({} as any, 'agent-1', {
        title: 'Updated Title',
      });

      expect(fileDataStore.updateAgent).toHaveBeenCalledWith('agent-1', expect.any(Object));
    });

    it('should handle update errors', async () => {
      fileDataStore.updateAgent.mockRejectedValue(new Error('Update failed'));

      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'agents:update'
      );
      const handler = handleCall![1];

      const result = await handler({} as any, 'agent-1', { title: 'Updated Title' });

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Update failed'),
        message: expect.any(String),
      });
    });
  });

  describe('Agent Delete Flow', () => {
    it('should delete agent and clean up sessions', async () => {
      fileDataStore.getAgent.mockResolvedValue({
        id: 'agent-1',
        project_id: 'proj-1',
      } as any);
      fileDataStore.deleteAgent.mockResolvedValue(undefined);
      sessionManifest.deleteAgentSessions.mockResolvedValue(undefined);

      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'agents:delete'
      );
      const handler = handleCall![1];

      await handler({} as any, 'agent-1');

      expect(fileDataStore.getAgent).toHaveBeenCalledWith('agent-1');
      expect(sessionManifest.deleteAgentSessions).toHaveBeenCalledWith('proj-1', 'agent-1');
      expect(fileDataStore.deleteAgent).toHaveBeenCalledWith('agent-1');
    });
  });
});
