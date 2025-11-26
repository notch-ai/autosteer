/**
 * Projects Store Tests
 * Tests all actions with 100% coverage following TRD requirements
 */

import { useProjectsStore } from '@/stores';
import { useAgentsStore } from '@/stores';

// Mock dependencies
jest.mock('@/commons/utils/project/session_name_generator', () => ({
  generateSessionName: jest.fn(() => 'Session 1'),
}));
jest.mock('@/stores/agents.store');
jest.mock('@/stores/chat.store', () => ({
  useChatStore: {
    getState: jest.fn(() => ({
      activeChat: null,
      streamingStates: new Map(),
      streamingMessages: new Map(),
    })),
    setState: jest.fn(),
  },
}));
jest.mock('@/stores/slashcommands.store', () => ({
  useSlashCommandsStore: {
    getState: jest.fn(() => ({
      loadSlashCommands: jest.fn(),
    })),
  },
}));
jest.mock('@/stores/terminal.store', () => ({
  useTerminalStore: {
    getState: jest.fn(() => ({
      getTerminalSession: jest.fn(() => null),
      removeTerminal: jest.fn(),
      removeTerminalSession: jest.fn(),
      getTerminalsForProject: jest.fn(() => []),
    })),
  },
}));

// Set up Electron mock once
global.window = {
  electron: {
    worktree: {
      getAll: jest.fn(),
      getDataDirectory: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    agents: {
      create: jest.fn(),
    },
    terminal: {
      list: jest.fn(),
    },
    ipc: {
      invoke: jest.fn(),
    },
  },
} as any;

describe('ProjectsStore', () => {
  beforeEach(() => {
    // Reset store
    useProjectsStore.setState({
      projects: new Map(),
      selectedProjectId: null,
      projectsLoading: false,
      projectsError: null,
    });

    // Reset all mocks
    jest.clearAllMocks();
    (window.electron.terminal.list as jest.Mock).mockResolvedValue([]);

    // Setup default mocks
    (useAgentsStore.getState as jest.Mock).mockReturnValue({
      agents: new Map(),
      selectedAgentId: null,
      selectAgent: jest.fn(),
      createAgent: jest.fn().mockResolvedValue({ id: 'agent-1', title: 'Session 1' }),
    });
  });

  describe('State Initialization', () => {
    it('should initialize with empty state', () => {
      const state = useProjectsStore.getState();
      expect(state.projects).toBeInstanceOf(Map);
      expect(state.projects.size).toBe(0);
      expect(state.selectedProjectId).toBeNull();
      expect(state.projectsLoading).toBe(false);
      expect(state.projectsError).toBeNull();
    });
  });

  describe('Selectors', () => {
    it('should get selected project', () => {
      const project = {
        id: 'proj-1',
        name: 'Test Project',
        githubRepo: 'user/repo',
        branchName: 'main',
        localPath: '/path',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      useProjectsStore.setState({
        projects: new Map([['proj-1', project]]),
        selectedProjectId: 'proj-1',
      });

      expect(useProjectsStore.getState().getSelectedProject()).toEqual(project);
    });

    it('should return null when no project selected', () => {
      expect(useProjectsStore.getState().getSelectedProject()).toBeNull();
    });

    it('should get project by ID', () => {
      const project = {
        id: 'proj-1',
        name: 'Test',
        localPath: '/',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      useProjectsStore.setState({
        projects: new Map([['proj-1', project]]),
      });

      expect(useProjectsStore.getState().getProject('proj-1')).toEqual(project);
      expect(useProjectsStore.getState().getProject('non-existent')).toBeUndefined();
    });
  });

  describe('loadProjects', () => {
    it('should load projects from Electron IPC', async () => {
      const mockWorktrees = [
        {
          git_repo: 'user/repo1',
          branch_name: 'main',
          folder_name: 'repo1-main',
        },
      ];

      (window.electron.worktree.getAll as jest.Mock).mockResolvedValue(mockWorktrees);
      (window.electron.worktree.getDataDirectory as jest.Mock).mockResolvedValue('/data');

      await useProjectsStore.getState().loadProjects();

      const state = useProjectsStore.getState();
      expect(state.projects.size).toBe(1);
      expect(state.projectsLoading).toBe(false);
      expect(state.projectsError).toBeNull();
    });

    it('should handle load errors', async () => {
      (window.electron.worktree.getAll as jest.Mock).mockRejectedValue(new Error('Load failed'));

      await useProjectsStore.getState().loadProjects();

      expect(useProjectsStore.getState().projectsError).toBe('Load failed');
      expect(useProjectsStore.getState().projectsLoading).toBe(false);
    });
  });

  describe('createProject', () => {
    it('should create project successfully', async () => {
      (window.electron.worktree.create as jest.Mock).mockResolvedValue({
        success: true,
        localPath: '/path',
        folderName: 'repo-main',
      });
      (window.electron.agents.create as jest.Mock).mockResolvedValue({
        id: 'agent-1',
        title: 'Session 1',
      });

      const config = {
        name: 'Test Project',
        githubRepo: 'user/repo',
        branchName: 'main',
      };

      const project = await useProjectsStore.getState().createProject(config);

      expect(project.name).toBe('Test Project');
      expect(useProjectsStore.getState().projects.has(project.id)).toBe(true);
    });

    it('should handle creation errors', async () => {
      (window.electron.worktree.create as jest.Mock).mockResolvedValue({
        success: false,
        message: 'Creation failed',
      });

      await expect(
        useProjectsStore.getState().createProject({
          name: 'Test',
          githubRepo: 'user/repo',
          branchName: 'main',
        })
      ).rejects.toThrow('Creation failed');
    });
  });

  describe('deleteProject', () => {
    it('should delete project successfully', async () => {
      const project = {
        id: 'proj-1',
        name: 'Test',
        folderName: 'test-folder',
        localPath: '/',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      useProjectsStore.setState({
        projects: new Map([['proj-1', project]]),
        selectedProjectId: 'proj-1',
      });

      (window.electron.worktree.delete as jest.Mock).mockResolvedValue({ success: true });

      await useProjectsStore.getState().deleteProject('proj-1');

      expect(useProjectsStore.getState().projects.has('proj-1')).toBe(false);
      expect(useProjectsStore.getState().selectedProjectId).toBeNull();
    });

    it('should handle delete errors', async () => {
      const project = {
        id: 'proj-1',
        name: 'Test',
        folderName: 'test',
        localPath: '/',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      useProjectsStore.setState({ projects: new Map([['proj-1', project]]) });

      (window.electron.worktree.delete as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Delete failed',
      });

      await expect(useProjectsStore.getState().deleteProject('proj-1')).rejects.toThrow(
        'Delete failed'
      );
    });
  });
});
