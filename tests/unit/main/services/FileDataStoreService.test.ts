import { FileDataStoreService } from '@/services/FileDataStoreService';
import * as fs from 'fs';
import { WorktreeConfig, AutosteerConfig, AgentConfig } from '@/types/config.types';

// Mock electron app
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/mock/home'),
  },
}));

// Mock fs
jest.mock('fs', () => ({
  constants: {
    F_OK: 0,
  },
  mkdir: jest.fn((_path, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    callback?.(null);
  }),
  readFile: jest.fn((_path, encoding, callback) => {
    if (typeof encoding === 'function') {
      callback = encoding;
      encoding = 'utf-8';
    }
    callback?.(null, '{}');
  }),
  writeFile: jest.fn((_path, _data, encoding, callback) => {
    if (typeof encoding === 'function') {
      callback = encoding;
      encoding = 'utf-8';
    }
    callback?.(null);
  }),
  access: jest.fn((_path, mode, callback) => {
    if (typeof mode === 'function') {
      callback = mode;
      mode = 0;
    }
    callback?.(null);
  }),
  stat: jest.fn((_path, callback) => {
    callback?.(null, { isDirectory: () => true });
  }),
  rm: jest.fn((_path, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    callback?.(null);
  }),
  rename: jest.fn((_oldPath, _newPath, callback) => {
    callback?.(null);
  }),
}));

// Mock promisify
jest.mock('util', () => ({
  promisify: jest.fn((fn) => {
    // Return a promisified version of the function
    return (...args: any[]) => {
      return new Promise((resolve, reject) => {
        fn(...args, (err: any, result: any) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    };
  }),
}));

describe('FileDataStoreService', () => {
  let service: FileDataStoreService;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance
    (FileDataStoreService as any).instance = undefined;

    // Reset all fs mocks to default successful behavior
    (fs.mkdir as unknown as jest.Mock).mockImplementation((_path, options, callback) => {
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      callback?.(null);
    });

    (fs.readFile as unknown as jest.Mock).mockImplementation((_path, encoding, callback) => {
      if (typeof encoding === 'function') {
        callback = encoding;
        encoding = 'utf-8';
      }
      callback?.(null, '{}');
    });

    (fs.writeFile as unknown as jest.Mock).mockImplementation(
      (_path, _data, encoding, callback) => {
        if (typeof encoding === 'function') {
          callback = encoding;
          encoding = 'utf-8';
        }
        callback?.(null);
      }
    );

    (fs.access as unknown as jest.Mock).mockImplementation((_path, mode, callback) => {
      if (typeof mode === 'function') {
        callback = mode;
        mode = 0;
      }
      callback?.(null);
    });

    (fs.stat as unknown as jest.Mock).mockImplementation((_path, callback) => {
      callback?.(null, { isDirectory: () => true });
    });

    (fs.rm as unknown as jest.Mock).mockImplementation((_path, options, callback) => {
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      callback?.(null);
    });

    service = FileDataStoreService.getInstance();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = FileDataStoreService.getInstance();
      const instance2 = FileDataStoreService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getDataDirectory', () => {
    it('should return data directory path', () => {
      expect(service.getDataDirectory()).toBe('/mock/home/.autosteer');
    });
  });

  describe('getWorktreesDirectory', () => {
    it('should return worktrees directory path', () => {
      expect(service.getWorktreesDirectory()).toBe('/mock/home/.autosteer/worktrees');
    });
  });

  describe('ensureDirectories', () => {
    it('should create directories', async () => {
      await service.ensureDirectories();
      expect(fs.mkdir).toHaveBeenCalledWith(
        '/mock/home/.autosteer',
        { recursive: true },
        expect.any(Function)
      );
      expect(fs.mkdir).toHaveBeenCalledWith(
        '/mock/home/.autosteer/worktrees',
        { recursive: true },
        expect.any(Function)
      );
    });

    it('should throw error if mkdir fails', async () => {
      const error = new Error('mkdir failed');
      (fs.mkdir as unknown as jest.Mock).mockImplementation((_path, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        callback?.(error);
      });

      await expect(service.ensureDirectories()).rejects.toThrow('mkdir failed');
      // With new error handling, errors bubble up instead of being logged locally
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('configExists', () => {
    it('should return true if config exists', async () => {
      const result = await service.configExists();
      expect(result).toBe(true);
      expect(fs.access).toHaveBeenCalled();
    });

    it('should return false if config does not exist', async () => {
      (fs.access as unknown as jest.Mock).mockImplementation((_path, mode, callback) => {
        if (typeof mode === 'function') {
          callback = mode;
        }
        callback?.(new Error('File not found'));
      });

      const result = await service.configExists();
      expect(result).toBe(false);
    });
  });

  describe('readConfig', () => {
    it('should read existing config', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [
          {
            folder_name: 'test',
            git_repo: 'https://github.com/test/repo.git',
            branch_name: 'main',
          },
        ],
        settings: { vimMode: true },
      };
      (fs.readFile as unknown as jest.Mock).mockImplementation((_path, encoding, callback) => {
        if (typeof encoding === 'function') {
          callback = encoding;
        }
        callback?.(null, JSON.stringify(mockConfig));
      });

      const config = await service.readConfig();
      expect(config).toEqual(mockConfig);
    });

    it('should create empty config if not exists', async () => {
      (fs.access as unknown as jest.Mock).mockImplementation((_path, mode, callback) => {
        if (typeof mode === 'function') {
          callback = mode;
        }
        callback?.(new Error('File not found'));
      });

      const config = await service.readConfig();
      expect(config).toEqual({
        worktrees: [],
        settings: { vimMode: false },
      });
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should return empty config on read error', async () => {
      (fs.readFile as unknown as jest.Mock).mockImplementation((_path, encoding, callback) => {
        if (typeof encoding === 'function') {
          callback = encoding;
        }
        callback?.(new Error('Read error'));
      });

      const config = await service.readConfig();
      expect(config).toEqual({
        worktrees: [],
        settings: { vimMode: false },
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to read config:', expect.any(Error));
    });

    it('should handle write error when creating empty config', async () => {
      (fs.readFile as unknown as jest.Mock).mockImplementation((_path, encoding, callback) => {
        if (typeof encoding === 'function') {
          callback = encoding;
        }
        callback?.(new Error('Read error'));
      });
      (fs.writeFile as unknown as jest.Mock).mockImplementation(
        (_path, _data, encoding, callback) => {
          if (typeof encoding === 'function') {
            callback = encoding;
          }
          callback?.(new Error('Write error'));
        }
      );

      const config = await service.readConfig();
      expect(config).toEqual({
        worktrees: [],
        settings: { vimMode: false },
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to create config file:',
        expect.any(Error)
      );
    });
  });

  describe('writeConfig', () => {
    it('should write config successfully', async () => {
      const config: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
      };

      await service.writeConfig(config);
      // Should write to temp file first
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/\/mock\/home\/\.autosteer\/config\.json\.tmp\.\d+/),
        JSON.stringify(config, null, 2),
        'utf-8',
        expect.any(Function)
      );
      // Then rename to final location
      expect(fs.rename).toHaveBeenCalledWith(
        expect.stringMatching(/\/mock\/home\/\.autosteer\/config\.json\.tmp\.\d+/),
        '/mock/home/.autosteer/config.json',
        expect.any(Function)
      );
    });

    it('should throw error on write failure', async () => {
      const error = new Error('Write failed');
      (fs.writeFile as unknown as jest.Mock).mockImplementation(
        (_path, _data, encoding, callback) => {
          if (typeof encoding === 'function') {
            callback = encoding;
          }
          callback?.(error);
        }
      );

      const config: AutosteerConfig = { worktrees: [], settings: { vimMode: false } };
      await expect(service.writeConfig(config)).rejects.toThrow('Write failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to write config:', error);
    });
  });

  describe('addWorktree', () => {
    it('should add new worktree', async () => {
      const existingConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
      };
      (fs.readFile as unknown as jest.Mock).mockImplementation((_path, encoding, callback) => {
        if (typeof encoding === 'function') {
          callback = encoding;
        }
        callback?.(null, JSON.stringify(existingConfig));
      });

      const newWorktree: WorktreeConfig = {
        folder_name: 'test-worktree',
        git_repo: 'https://github.com/test/repo.git',
        branch_name: 'main',
      };

      await service.addWorktree(newWorktree);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('test-worktree'),
        'utf-8',
        expect.any(Function)
      );
    });

    it('should update existing worktree', async () => {
      const existingWorktree: WorktreeConfig = {
        folder_name: 'test-worktree',
        git_repo: 'https://github.com/test/old-repo.git',
        branch_name: 'main',
      };
      const existingConfig: AutosteerConfig = {
        worktrees: [existingWorktree],
        settings: { vimMode: false },
      };
      (fs.readFile as unknown as jest.Mock).mockImplementation((_path, encoding, callback) => {
        if (typeof encoding === 'function') {
          callback = encoding;
        }
        callback?.(null, JSON.stringify(existingConfig));
      });

      const updatedWorktree: WorktreeConfig = {
        folder_name: 'test-worktree',
        git_repo: 'https://github.com/test/new-repo.git',
        branch_name: 'main',
      };

      await service.addWorktree(updatedWorktree);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('new-repo'),
        'utf-8',
        expect.any(Function)
      );
    });

    it('should clean up orphaned agents', async () => {
      const existingConfig: AutosteerConfig = {
        worktrees: [],
        agents: [
          {
            id: 'agent-1',
            project_id: 'test-worktree',
            title: 'Test Agent',
            content: 'Content',
            preview: 'Preview',
            type: 'agent',
            status: 'active',
            tags: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            resource_ids: [],
          },
        ],
        settings: { vimMode: false },
      };
      (fs.readFile as unknown as jest.Mock).mockImplementation((_path, encoding, callback) => {
        if (typeof encoding === 'function') {
          callback = encoding;
        }
        callback?.(null, JSON.stringify(existingConfig));
      });

      const newWorktree: WorktreeConfig = {
        folder_name: 'test-worktree',
        git_repo: 'https://github.com/test/repo.git',
        branch_name: 'main',
      };

      await service.addWorktree(newWorktree);

      // Check that writeFile was called with config that has no agents
      const writeCall = (fs.writeFile as unknown as jest.Mock).mock.calls[0];
      const writtenConfig = JSON.parse(writeCall[1]);
      expect(writtenConfig.agents).toEqual([]);
    });
  });

  describe('removeWorktree', () => {
    it('should remove worktree and associated agents', async () => {
      const existingConfig: AutosteerConfig = {
        worktrees: [
          { folder_name: 'worktree1', git_repo: 'url1', branch_name: 'main' },
          { folder_name: 'worktree2', git_repo: 'url2', branch_name: 'main' },
        ],
        agents: [
          {
            id: 'agent-1',
            project_id: 'worktree1',
            title: 'Agent 1',
            preview: 'Preview',
            type: 'agent',
            status: 'active',
            content: 'Content',
            tags: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            resource_ids: [],
          },
          {
            id: 'agent-2',
            project_id: 'worktree2',
            title: 'Agent 2',
            preview: 'Preview',
            type: 'agent',
            status: 'active',
            content: 'Content',
            tags: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            resource_ids: [],
          },
        ],
        settings: { vimMode: false },
      };
      (fs.readFile as unknown as jest.Mock).mockImplementation((_path, encoding, callback) => {
        if (typeof encoding === 'function') {
          callback = encoding;
        }
        callback?.(null, JSON.stringify(existingConfig));
      });

      await service.removeWorktree('worktree1');

      const writeCall = (fs.writeFile as unknown as jest.Mock).mock.calls[0];
      const writtenConfig = JSON.parse(writeCall[1]);
      expect(writtenConfig.worktrees).toHaveLength(1);
      expect(writtenConfig.worktrees[0].folder_name).toBe('worktree2');
      expect(writtenConfig.agents).toHaveLength(1);
      expect(writtenConfig.agents[0].id).toBe('agent-2');
    });
  });

  describe('deleteWorktreeDirectory', () => {
    it('should delete existing worktree directory', async () => {
      await service.deleteWorktreeDirectory('test-worktree');
      expect(fs.rm).toHaveBeenCalledWith(
        '/mock/home/.autosteer/worktrees/test-worktree',
        { recursive: true, force: true },
        expect.any(Function)
      );
    });

    it('should not throw if directory does not exist', async () => {
      (fs.access as unknown as jest.Mock).mockImplementation((_path, mode, callback) => {
        if (typeof mode === 'function') {
          callback = mode;
        }
        callback?.(new Error('Not found'));
      });

      await expect(service.deleteWorktreeDirectory('non-existent')).resolves.not.toThrow();
    });

    it('should throw error on deletion failure', async () => {
      const error = new Error('Delete failed');
      (fs.rm as unknown as jest.Mock).mockImplementation((_path, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        callback?.(error);
      });

      await expect(service.deleteWorktreeDirectory('test-worktree')).rejects.toThrow(
        'Delete failed'
      );
      // With new error handling, errors bubble up instead of being logged locally
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('worktreeExists', () => {
    it('should return true for existing directory', async () => {
      const result = await service.worktreeExists('test-worktree');
      expect(result).toBe(true);
    });

    it('should return false for non-existent directory', async () => {
      (fs.access as unknown as jest.Mock).mockImplementation((_path, mode, callback) => {
        if (typeof mode === 'function') {
          callback = mode;
        }
        callback?.(new Error('Not found'));
      });

      const result = await service.worktreeExists('non-existent');
      expect(result).toBe(false);
    });

    it('should return false for non-directory', async () => {
      (fs.stat as unknown as jest.Mock).mockImplementation((_path, callback) => {
        callback?.(null, { isDirectory: () => false });
      });

      const result = await service.worktreeExists('not-a-directory');
      expect(result).toBe(false);
    });
  });

  describe('getWorktrees', () => {
    it('should return worktrees from config', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [
          { folder_name: 'worktree1', git_repo: 'url1', branch_name: 'main' },
          { folder_name: 'worktree2', git_repo: 'url2', branch_name: 'main' },
        ],
        settings: { vimMode: false },
      };
      (fs.readFile as unknown as jest.Mock).mockImplementation((_path, encoding, callback) => {
        if (typeof encoding === 'function') {
          callback = encoding;
        }
        callback?.(null, JSON.stringify(mockConfig));
      });

      const worktrees = await service.getWorktrees();
      expect(worktrees).toEqual(mockConfig.worktrees);
    });

    it('should return empty array if no worktrees', async () => {
      const mockConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
      };
      (fs.readFile as unknown as jest.Mock).mockImplementation((_path, encoding, callback) => {
        if (typeof encoding === 'function') {
          callback = encoding;
        }
        callback?.(null, JSON.stringify(mockConfig));
      });

      const worktrees = await service.getWorktrees();
      expect(worktrees).toEqual([]);
    });
  });

  describe('path helpers', () => {
    it('should get worktree path', () => {
      const path = service.getWorktreePath('test-worktree');
      expect(path).toBe('/mock/home/.autosteer/worktrees/test-worktree');
    });

    it('should get main repo path', () => {
      const path = service.getMainRepoPath('https://github.com/user/repo.git');
      expect(path).toBe('/mock/home/.autosteer/repos/repo');
    });

    it('should handle repo URL without .git', () => {
      const path = service.getMainRepoPath('https://github.com/user/repo');
      expect(path).toBe('/mock/home/.autosteer/repos/repo');
    });

    it('should handle malformed repo URL', () => {
      const path = service.getMainRepoPath('invalid-url');
      expect(path).toBe('/mock/home/.autosteer/repos/invalid-url');
    });
  });

  describe('ensureReposDirectory', () => {
    it('should create repos directory', async () => {
      await service.ensureReposDirectory();
      expect(fs.mkdir).toHaveBeenCalledWith(
        '/mock/home/.autosteer/repos',
        { recursive: true },
        expect.any(Function)
      );
    });
  });

  describe('agent management', () => {
    const mockAgent: AgentConfig = {
      id: 'agent-1',
      project_id: 'project-1',
      title: 'Test Agent',
      content: 'Agent content',
      preview: 'Agent preview',
      type: 'agent',
      status: 'active',
      tags: ['tag1', 'tag2'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      resource_ids: [],
    };

    describe('getAgents', () => {
      it('should return all agents', async () => {
        const mockConfig: AutosteerConfig = {
          worktrees: [],
          agents: [mockAgent],
          settings: { vimMode: false },
        };
        (fs.readFile as unknown as jest.Mock).mockImplementation((_path, encoding, callback) => {
          if (typeof encoding === 'function') {
            callback = encoding;
          }
          callback?.(null, JSON.stringify(mockConfig));
        });

        const agents = await service.getAgents();
        expect(agents).toEqual([mockAgent]);
      });

      it('should return empty array if no agents', async () => {
        const mockConfig: AutosteerConfig = {
          worktrees: [],
          settings: { vimMode: false },
        };
        (fs.readFile as unknown as jest.Mock).mockImplementation((_path, encoding, callback) => {
          if (typeof encoding === 'function') {
            callback = encoding;
          }
          callback?.(null, JSON.stringify(mockConfig));
        });

        const agents = await service.getAgents();
        expect(agents).toEqual([]);
      });
    });

    describe('getAgentsByProjectId', () => {
      it('should return agents for specific project', async () => {
        const mockConfig: AutosteerConfig = {
          worktrees: [],
          agents: [mockAgent, { ...mockAgent, id: 'agent-2', project_id: 'project-2' }],
          settings: { vimMode: false },
        };
        (fs.readFile as unknown as jest.Mock).mockImplementation((_path, encoding, callback) => {
          if (typeof encoding === 'function') {
            callback = encoding;
          }
          callback?.(null, JSON.stringify(mockConfig));
        });

        const agents = await service.getAgentsByProjectId('project-1');
        expect(agents).toHaveLength(1);
        expect(agents[0].id).toBe('agent-1');
      });
    });

    describe('getAgent', () => {
      it('should return specific agent by ID', async () => {
        const mockConfig: AutosteerConfig = {
          worktrees: [],
          agents: [mockAgent],
          settings: { vimMode: false },
        };
        (fs.readFile as unknown as jest.Mock).mockImplementation((_path, encoding, callback) => {
          if (typeof encoding === 'function') {
            callback = encoding;
          }
          callback?.(null, JSON.stringify(mockConfig));
        });

        const agent = await service.getAgent('agent-1');
        expect(agent).toEqual(mockAgent);
      });

      it('should return undefined if agent not found', async () => {
        const mockConfig: AutosteerConfig = {
          worktrees: [],
          agents: [],
          settings: { vimMode: false },
        };
        (fs.readFile as unknown as jest.Mock).mockImplementation((_path, encoding, callback) => {
          if (typeof encoding === 'function') {
            callback = encoding;
          }
          callback?.(null, JSON.stringify(mockConfig));
        });

        const agent = await service.getAgent('non-existent');
        expect(agent).toBeUndefined();
      });
    });

    describe('addAgent', () => {
      it('should add new agent', async () => {
        const mockConfig: AutosteerConfig = {
          worktrees: [{ folder_name: 'project-1', git_repo: 'url', branch_name: 'main' }],
          settings: { vimMode: false },
        };
        (fs.readFile as unknown as jest.Mock).mockImplementation((_path, encoding, callback) => {
          if (typeof encoding === 'function') {
            callback = encoding;
          }
          callback?.(null, JSON.stringify(mockConfig));
        });

        await service.addAgent(mockAgent);

        const writeCall = (fs.writeFile as unknown as jest.Mock).mock.calls[0];
        const writtenConfig = JSON.parse(writeCall[1]);
        expect(writtenConfig.agents).toHaveLength(1);
        expect(writtenConfig.agents[0]).toEqual(mockAgent);
        expect(writtenConfig.worktrees[0].agent_ids).toContain('agent-1');
      });

      it('should handle worktree without agent_ids array', async () => {
        const mockConfig: AutosteerConfig = {
          worktrees: [{ folder_name: 'project-1', git_repo: 'url', branch_name: 'main' }],
          agents: [],
          settings: { vimMode: false },
        };
        (fs.readFile as unknown as jest.Mock).mockImplementation((_path, encoding, callback) => {
          if (typeof encoding === 'function') {
            callback = encoding;
          }
          callback?.(null, JSON.stringify(mockConfig));
        });

        await service.addAgent(mockAgent);

        const writeCall = (fs.writeFile as unknown as jest.Mock).mock.calls[0];
        const writtenConfig = JSON.parse(writeCall[1]);
        expect(writtenConfig.worktrees[0].agent_ids).toEqual(['agent-1']);
      });
    });

    describe('updateAgent', () => {
      it('should update existing agent', async () => {
        const mockConfig: AutosteerConfig = {
          worktrees: [],
          agents: [mockAgent],
          settings: { vimMode: false },
        };
        (fs.readFile as unknown as jest.Mock).mockImplementation((_path, encoding, callback) => {
          if (typeof encoding === 'function') {
            callback = encoding;
          }
          callback?.(null, JSON.stringify(mockConfig));
        });

        await service.updateAgent('agent-1', { title: 'Updated Title' });

        const writeCall = (fs.writeFile as unknown as jest.Mock).mock.calls[0];
        const writtenConfig = JSON.parse(writeCall[1]);
        expect(writtenConfig.agents[0].title).toBe('Updated Title');
        expect(writtenConfig.agents[0].updated_at).toBeDefined();
      });

      it('should do nothing if agent not found', async () => {
        const mockConfig: AutosteerConfig = {
          worktrees: [],
          agents: [],
          settings: { vimMode: false },
        };
        (fs.readFile as unknown as jest.Mock).mockImplementation((_path, encoding, callback) => {
          if (typeof encoding === 'function') {
            callback = encoding;
          }
          callback?.(null, JSON.stringify(mockConfig));
        });

        await service.updateAgent('non-existent', { title: 'Updated' });
        expect(fs.writeFile).not.toHaveBeenCalled();
      });
    });

    describe('deleteAgent', () => {
      it('should delete agent and remove from worktrees', async () => {
        const mockConfig: AutosteerConfig = {
          worktrees: [
            {
              folder_name: 'project-1',
              git_repo: 'url',
              branch_name: 'main',
              agent_ids: ['agent-1', 'agent-2'],
            },
          ],
          agents: [mockAgent, { ...mockAgent, id: 'agent-2' }],
          settings: { vimMode: false },
        };
        (fs.readFile as unknown as jest.Mock).mockImplementation((_path, encoding, callback) => {
          if (typeof encoding === 'function') {
            callback = encoding;
          }
          callback?.(null, JSON.stringify(mockConfig));
        });

        await service.deleteAgent('agent-1');

        const writeCall = (fs.writeFile as unknown as jest.Mock).mock.calls[0];
        const writtenConfig = JSON.parse(writeCall[1]);
        expect(writtenConfig.agents).toHaveLength(1);
        expect(writtenConfig.agents[0].id).toBe('agent-2');
        expect(writtenConfig.worktrees[0].agent_ids).toEqual(['agent-2']);
      });
    });

    describe('searchAgents', () => {
      it('should search by title', async () => {
        const mockConfig: AutosteerConfig = {
          worktrees: [],
          agents: [mockAgent, { ...mockAgent, id: 'agent-2', title: 'Other Agent' }],
          settings: { vimMode: false },
        };
        (fs.readFile as unknown as jest.Mock).mockImplementation((_path, encoding, callback) => {
          if (typeof encoding === 'function') {
            callback = encoding;
          }
          callback?.(null, JSON.stringify(mockConfig));
        });

        const results = await service.searchAgents('Test');
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe('agent-1');
      });

      it('should search by content', async () => {
        const mockConfig: AutosteerConfig = {
          worktrees: [],
          agents: [
            { ...mockAgent, content: 'Special content here' },
            { ...mockAgent, id: 'agent-2', content: 'Other content' },
          ],
          settings: { vimMode: false },
        };
        (fs.readFile as unknown as jest.Mock).mockImplementation((_path, encoding, callback) => {
          if (typeof encoding === 'function') {
            callback = encoding;
          }
          callback?.(null, JSON.stringify(mockConfig));
        });

        const results = await service.searchAgents('Special');
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe('agent-1');
      });

      it('should search by tags', async () => {
        const mockConfig: AutosteerConfig = {
          worktrees: [],
          agents: [
            { ...mockAgent, tags: ['special-tag'] },
            { ...mockAgent, id: 'agent-2', tags: ['other-tag'] },
          ],
          settings: { vimMode: false },
        };
        (fs.readFile as unknown as jest.Mock).mockImplementation((_path, encoding, callback) => {
          if (typeof encoding === 'function') {
            callback = encoding;
          }
          callback?.(null, JSON.stringify(mockConfig));
        });

        const results = await service.searchAgents('special');
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe('agent-1');
      });

      it('should be case-insensitive', async () => {
        const mockConfig: AutosteerConfig = {
          worktrees: [],
          agents: [mockAgent],
          settings: { vimMode: false },
        };
        (fs.readFile as unknown as jest.Mock).mockImplementation((_path, encoding, callback) => {
          if (typeof encoding === 'function') {
            callback = encoding;
          }
          callback?.(null, JSON.stringify(mockConfig));
        });

        const results = await service.searchAgents('TEST AGENT');
        expect(results).toHaveLength(1);
      });
    });
  });
});
