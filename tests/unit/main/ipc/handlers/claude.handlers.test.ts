import { ipcMain } from 'electron';
import { ClaudeHandlers } from '@/main/ipc/handlers/claude.handlers';
import { IPC_CHANNELS } from '@/types/ipc.types';
import { FileDataStoreService } from '@/services/FileDataStoreService';
import { SessionManifestService } from '@/services/SessionManifestService';
import { McpAuthService } from '@/services/McpAuthService';
import { AgentStatus, AgentType } from '@/entities';

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

describe('ClaudeHandlers', () => {
  let handler: ClaudeHandlers;
  let mockFileDataStore: jest.Mocked<FileDataStoreService>;
  let mockSessionManifest: jest.Mocked<SessionManifestService>;
  let mockMcpAuthService: jest.Mocked<McpAuthService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFileDataStore = {
      getAgents: jest.fn(),
      getAgentsByProjectId: jest.fn(),
      addAgent: jest.fn(),
      updateAgent: jest.fn(),
      deleteAgent: jest.fn(),
      searchAgents: jest.fn(),
      getAgent: jest.fn(),
      getWorktrees: jest.fn(),
    } as any;

    mockSessionManifest = {
      updateAgentSession: jest.fn(),
      getAgentSession: jest.fn(),
      deleteAgentSessions: jest.fn(),
      updateAdditionalDirectories: jest.fn(),
      getAdditionalDirectories: jest.fn(),
    } as any;

    mockMcpAuthService = {
      captureAuthUrl: jest.fn(),
    } as any;

    (FileDataStoreService.getInstance as jest.Mock).mockReturnValue(mockFileDataStore);
    (SessionManifestService.getInstance as jest.Mock).mockReturnValue(mockSessionManifest);
    (McpAuthService.getInstance as jest.Mock).mockReturnValue(mockMcpAuthService);

    handler = new ClaudeHandlers();
  });

  describe('Agent Operations', () => {
    describe('registerHandlers', () => {
      it('should register all agent IPC channels', () => {
        handler.registerHandlers();

        expect(ipcMain.handle).toHaveBeenCalledWith(
          IPC_CHANNELS.AGENTS_LOAD_ALL,
          expect.any(Function)
        );
        expect(ipcMain.handle).toHaveBeenCalledWith(
          IPC_CHANNELS.AGENTS_LOAD_BY_PROJECT,
          expect.any(Function)
        );
        expect(ipcMain.handle).toHaveBeenCalledWith(
          IPC_CHANNELS.AGENTS_CREATE,
          expect.any(Function)
        );
        expect(ipcMain.handle).toHaveBeenCalledWith(
          IPC_CHANNELS.AGENTS_UPDATE,
          expect.any(Function)
        );
        expect(ipcMain.handle).toHaveBeenCalledWith(
          IPC_CHANNELS.AGENTS_DELETE,
          expect.any(Function)
        );
        expect(ipcMain.handle).toHaveBeenCalledWith(
          IPC_CHANNELS.AGENTS_UPDATE_SESSION,
          expect.any(Function)
        );
        expect(ipcMain.handle).toHaveBeenCalledWith(
          IPC_CHANNELS.AGENTS_SEARCH,
          expect.any(Function)
        );
        expect(ipcMain.handle).toHaveBeenCalledWith(
          IPC_CHANNELS.AGENTS_LOAD_CHAT_HISTORY,
          expect.any(Function)
        );
        expect(ipcMain.handle).toHaveBeenCalledWith(
          'agents:updateAdditionalDirectories',
          expect.any(Function)
        );
        expect(ipcMain.handle).toHaveBeenCalledWith(
          'agents:getAdditionalDirectories',
          expect.any(Function)
        );
      });
    });

    describe('agents:loadAll', () => {
      it('should load all agents successfully', async () => {
        handler.registerHandlers();

        const mockAgentConfigs = [
          {
            id: 'agent-1',
            title: 'Test Agent 1',
            content: 'Content 1',
            preview: 'Preview 1',
            type: 'agent',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: [],
            resource_ids: [],
            project_id: 'project-1',
          },
        ];

        mockFileDataStore.getAgents.mockResolvedValue(mockAgentConfigs as any);

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.AGENTS_LOAD_ALL
        );
        const handlerFn = handleCall[1];
        const result = await handlerFn();

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('agent-1');
        expect(result[0].title).toBe('Test Agent 1');
      });

      it('should handle errors when loading agents fails', async () => {
        handler.registerHandlers();

        mockFileDataStore.getAgents.mockRejectedValue(new Error('Load failed'));

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.AGENTS_LOAD_ALL
        );
        const handlerFn = handleCall[1];

        const result = await handlerFn();
        expect(result).toEqual({
          success: false,
          error: expect.stringContaining('Load failed'),
          message: expect.any(String),
        });
      });
    });

    describe('agents:loadByProject', () => {
      it('should load agents for specific project', async () => {
        handler.registerHandlers();

        const mockAgentConfigs = [
          {
            id: 'agent-1',
            title: 'Project Agent',
            content: 'Content',
            preview: 'Preview',
            type: 'agent',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: [],
            resource_ids: [],
            project_id: 'project-1',
          },
        ];

        mockFileDataStore.getAgentsByProjectId.mockResolvedValue(mockAgentConfigs as any);

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.AGENTS_LOAD_BY_PROJECT
        );
        const handlerFn = handleCall[1];
        const result = await handlerFn({}, 'project-1');

        expect(mockFileDataStore.getAgentsByProjectId).toHaveBeenCalledWith('project-1');
        expect(result).toHaveLength(1);
        expect(result[0].projectId).toBe('project-1');
      });
    });

    describe('agents:create', () => {
      it('should create a new agent successfully', async () => {
        handler.registerHandlers();

        const newAgentData = {
          title: 'New Agent',
          content: 'Agent content',
          preview: 'Preview',
          type: 'agent' as AgentType,
          status: 'active' as AgentStatus,
          tags: [],
          resourceIds: [],
          projectId: 'project-1',
        };

        mockFileDataStore.getAgentsByProjectId.mockResolvedValue([]);
        mockFileDataStore.addAgent.mockResolvedValue(undefined);

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.AGENTS_CREATE
        );
        const handlerFn = handleCall[1];
        const result = await handlerFn({}, newAgentData);

        expect(result).toHaveProperty('id');
        expect(result.title).toBe('New Agent');
        expect(mockFileDataStore.addAgent).toHaveBeenCalled();
      });

      it('should enforce tab limit (10 agents per worktree)', async () => {
        handler.registerHandlers();

        const newAgentData = {
          title: 'New Agent',
          content: 'Agent content',
          preview: 'Preview',
          type: 'agent' as AgentType,
          status: 'active' as AgentStatus,
          tags: [],
          resourceIds: [],
          projectId: 'project-1',
        };

        const existingAgents = Array(10)
          .fill(null)
          .map((_, i) => ({ id: `agent-${i}` }));
        mockFileDataStore.getAgentsByProjectId.mockResolvedValue(existingAgents as any);

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.AGENTS_CREATE
        );
        const handlerFn = handleCall[1];

        const result = await handlerFn({}, newAgentData);
        expect(result).toEqual({
          success: false,
          error: expect.stringContaining('Maximum tab limit reached'),
          message: expect.any(String),
        });
      });
    });

    describe('agents:update', () => {
      it('should update an existing agent', async () => {
        handler.registerHandlers();

        const updates = {
          title: 'Updated Agent',
          status: 'archived' as AgentStatus,
        };

        mockFileDataStore.updateAgent.mockResolvedValue(undefined);

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.AGENTS_UPDATE
        );
        const handlerFn = handleCall[1];
        await handlerFn({}, 'agent-1', updates);

        expect(mockFileDataStore.updateAgent).toHaveBeenCalledWith(
          'agent-1',
          expect.objectContaining({
            title: 'Updated Agent',
            status: 'archived',
          })
        );
      });
    });

    describe('agents:delete', () => {
      it('should delete an agent and clean up sessions', async () => {
        handler.registerHandlers();

        const mockAgent = {
          id: 'agent-1',
          project_id: 'project-1',
        };

        mockFileDataStore.getAgent.mockResolvedValue(mockAgent as any);
        mockFileDataStore.deleteAgent.mockResolvedValue(undefined);
        mockSessionManifest.deleteAgentSessions.mockResolvedValue(undefined);

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.AGENTS_DELETE
        );
        const handlerFn = handleCall[1];
        await handlerFn({}, 'agent-1');

        expect(mockSessionManifest.deleteAgentSessions).toHaveBeenCalledWith(
          'project-1',
          'agent-1'
        );
        expect(mockFileDataStore.deleteAgent).toHaveBeenCalledWith('agent-1');
      });
    });

    describe('agents:updateSession', () => {
      it('should update agent session mapping', async () => {
        handler.registerHandlers();

        mockSessionManifest.updateAgentSession.mockResolvedValue(undefined);

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.AGENTS_UPDATE_SESSION
        );
        const handlerFn = handleCall[1];
        const result = await handlerFn({}, 'worktree-1', 'agent-1', 'session-1');

        expect(mockSessionManifest.updateAgentSession).toHaveBeenCalledWith(
          'worktree-1',
          'agent-1',
          'session-1'
        );
        expect(result).toEqual({ success: true });
      });

      it('should handle session update errors', async () => {
        handler.registerHandlers();

        mockSessionManifest.updateAgentSession.mockRejectedValue(
          new Error('Session update failed')
        );

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.AGENTS_UPDATE_SESSION
        );
        const handlerFn = handleCall[1];
        const result = await handlerFn({}, 'worktree-1', 'agent-1', 'session-1');

        expect(result).toEqual({
          success: false,
          error: expect.stringContaining('Session update failed'),
          message: expect.any(String),
        });
      });
    });

    describe('agents:search', () => {
      it('should search agents by query', async () => {
        handler.registerHandlers();

        const mockResults = [
          {
            id: 'agent-1',
            title: 'Test Agent',
            content: 'Content',
            preview: 'Preview',
            type: 'agent',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: [],
            resource_ids: [],
            project_id: 'project-1',
          },
        ];

        mockFileDataStore.searchAgents.mockResolvedValue(mockResults as any);

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.AGENTS_SEARCH
        );
        const handlerFn = handleCall[1];
        const result = await handlerFn({}, 'test');

        expect(mockFileDataStore.searchAgents).toHaveBeenCalledWith('test');
        expect(result).toHaveLength(1);
      });
    });

    describe('agents:updateAdditionalDirectories', () => {
      it('should update additional directories for an agent', async () => {
        handler.registerHandlers();

        const directories = ['/path/to/dir1', '/path/to/dir2'];
        mockSessionManifest.updateAdditionalDirectories.mockResolvedValue(undefined);

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'agents:updateAdditionalDirectories'
        );
        const handlerFn = handleCall[1];
        const result = await handlerFn({}, 'worktree-1', 'agent-1', directories);

        expect(mockSessionManifest.updateAdditionalDirectories).toHaveBeenCalledWith(
          'worktree-1',
          'agent-1',
          directories
        );
        expect(result).toEqual({ success: true });
      });
    });

    describe('agents:getAdditionalDirectories', () => {
      it('should get additional directories for an agent', async () => {
        handler.registerHandlers();

        const directories = ['/path/to/dir1'];
        mockSessionManifest.getAdditionalDirectories.mockResolvedValue(directories);

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'agents:getAdditionalDirectories'
        );
        const handlerFn = handleCall[1];
        const result = await handlerFn({}, 'worktree-1', 'agent-1');

        expect(mockSessionManifest.getAdditionalDirectories).toHaveBeenCalledWith(
          'worktree-1',
          'agent-1'
        );
        expect(result).toEqual({ success: true, directories });
      });
    });
  });

  describe('MCP Operations', () => {
    describe('mcp:authenticate-server', () => {
      it('should register MCP authentication handler', () => {
        handler.registerHandlers();

        expect(ipcMain.handle).toHaveBeenCalledWith(
          'mcp:authenticate-server',
          expect.any(Function)
        );
      });

      it('should handle missing MCP configuration file', async () => {
        handler.registerHandlers();

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === 'mcp:authenticate-server'
        );
        const handlerFn = handleCall[1];
        const result = await handlerFn({}, 'test-server', '/nonexistent/project');

        expect(result).toEqual({
          success: false,
          error: 'MCP configuration file not found',
          message: expect.any(String),
        });
      });
    });
  });

  describe('Slash Command Operations', () => {
    describe('slash-commands:load', () => {
      it('should register slash commands loader', () => {
        handler.registerHandlers();

        expect(ipcMain.handle).toHaveBeenCalledWith(
          IPC_CHANNELS.SLASH_COMMANDS_LOAD,
          expect.any(Function)
        );
      });

      it('should load slash commands from local and user directories', async () => {
        handler.registerHandlers();

        const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
          (call) => call[0] === IPC_CHANNELS.SLASH_COMMANDS_LOAD
        );
        const handlerFn = handleCall[1];
        const result = await handlerFn({}, '/path/to/project');

        expect(Array.isArray(result)).toBe(true);
      });
    });
  });

  describe('Validation Configuration (Phase 2 - NOTCH-1489)', () => {
    let originalNodeEnv: string | undefined;

    beforeEach(() => {
      originalNodeEnv = process.env.NODE_ENV;
      jest.resetModules();
    });

    afterEach(() => {
      if (originalNodeEnv !== undefined) {
        process.env.NODE_ENV = originalNodeEnv;
      } else {
        delete process.env.NODE_ENV;
      }
    });

    describe('Development Environment', () => {
      it('should validate messages in development mode', () => {
        process.env.NODE_ENV = 'development';
        const { isValidationEnabled } = require('@/config/validation.config');

        expect(isValidationEnabled()).toBe(true);
      });

      it('should validate messages in development', async () => {
        process.env.NODE_ENV = 'development';
        jest.resetModules();

        const { ClaudeHandlers } = require('@/main/ipc/handlers/claude.handlers');
        const testHandler = new ClaudeHandlers();

        // Access private method via any cast for testing
        const validateMessage = (testHandler as any).validateChatMessage.bind(testHandler);

        const validMessage = {
          id: 'test-id',
          role: 'user' as const,
          content: 'test content',
          timestamp: new Date(),
          attachedResources: [],
        };

        const result = validateMessage(validMessage);

        expect(result).toBe(true);
        // Note: Validation success no longer logs to reduce noise
      });

      it('should reject invalid messages in development', async () => {
        process.env.NODE_ENV = 'development';
        jest.resetModules();

        const log = require('electron-log');
        const { ClaudeHandlers } = require('@/main/ipc/handlers/claude.handlers');
        const testHandler = new ClaudeHandlers();

        const validateMessage = (testHandler as any).validateChatMessage.bind(testHandler);

        const invalidMessage = {
          id: '',
          role: 'user' as const,
          content: 'test',
          timestamp: new Date(),
          attachedResources: [],
        };

        const result = validateMessage(invalidMessage);

        expect(result).toBe(false);
        expect(log.warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid message'),
          expect.any(Object)
        );
      });

      it('should warn about invalid role in development', () => {
        process.env.NODE_ENV = 'development';
        jest.resetModules();

        const log = require('electron-log');
        const { ClaudeHandlers } = require('@/main/ipc/handlers/claude.handlers');
        const testHandler = new ClaudeHandlers();

        const validateMessage = (testHandler as any).validateChatMessage.bind(testHandler);

        const invalidRoleMessage = {
          id: 'test-id',
          role: 'invalid' as any,
          content: 'test',
          timestamp: new Date(),
          attachedResources: [],
        };

        const result = validateMessage(invalidRoleMessage);

        expect(result).toBe(false);
        expect(log.warn).toHaveBeenCalledWith(
          expect.stringContaining('invalid role'),
          expect.objectContaining({ role: 'invalid' })
        );
      });
    });

    describe('Production Environment', () => {
      it('should skip validation in production mode', () => {
        process.env.NODE_ENV = 'production';
        jest.resetModules();

        const { isValidationEnabled } = require('@/config/validation.config');

        expect(isValidationEnabled()).toBe(false);
      });

      it('should accept all messages in production without validation', () => {
        process.env.NODE_ENV = 'production';
        jest.resetModules();

        const log = require('electron-log');
        const { ClaudeHandlers } = require('@/main/ipc/handlers/claude.handlers');
        const testHandler = new ClaudeHandlers();

        const validateMessage = (testHandler as any).validateChatMessage.bind(testHandler);

        const invalidMessage = {
          id: '',
          role: 'invalid' as any,
          content: 123,
          timestamp: 'not-a-date',
          attachedResources: [],
        };

        const result = validateMessage(invalidMessage);

        expect(result).toBe(true);
        expect(log.warn).not.toHaveBeenCalled();
        expect(log.debug).not.toHaveBeenCalled();
      });

      it('should not log validation summary in production', () => {
        process.env.NODE_ENV = 'production';
        jest.resetModules();

        const { isValidationEnabled } = require('@/config/validation.config');
        const log = require('electron-log');

        expect(isValidationEnabled()).toBe(false);

        if (isValidationEnabled()) {
          log.info('Should not be called in production');
        }

        expect(log.info).not.toHaveBeenCalledWith(
          expect.stringContaining('Chat history loaded with validation'),
          expect.any(Object)
        );
      });
    });

    describe('Validation Rules', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'development';
        jest.resetModules();
      });

      it('should validate id field', () => {
        const { ClaudeHandlers } = require('@/main/ipc/handlers/claude.handlers');
        const testHandler = new ClaudeHandlers();
        const validateMessage = (testHandler as any).validateChatMessage.bind(testHandler);

        const noId = {
          role: 'user' as const,
          content: 'test',
          timestamp: new Date(),
          attachedResources: [],
        };

        expect(validateMessage(noId)).toBe(false);
      });

      it('should validate content type', () => {
        const { ClaudeHandlers } = require('@/main/ipc/handlers/claude.handlers');
        const testHandler = new ClaudeHandlers();
        const validateMessage = (testHandler as any).validateChatMessage.bind(testHandler);

        const nonStringContent = {
          id: 'test',
          role: 'user' as const,
          content: 123 as any,
          timestamp: new Date(),
          attachedResources: [],
        };

        expect(validateMessage(nonStringContent)).toBe(false);
      });

      it('should validate timestamp', () => {
        const { ClaudeHandlers } = require('@/main/ipc/handlers/claude.handlers');
        const testHandler = new ClaudeHandlers();
        const validateMessage = (testHandler as any).validateChatMessage.bind(testHandler);

        const invalidTimestamp = {
          id: 'test',
          role: 'user' as const,
          content: 'test',
          timestamp: 'not-a-date' as any,
          attachedResources: [],
        };

        expect(validateMessage(invalidTimestamp)).toBe(false);
      });
    });
  });
});
