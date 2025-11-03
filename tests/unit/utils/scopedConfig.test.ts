/**
 * Tests for scoped configuration utility
 */

import { getScopedData, getScopedMcpConfig } from '@/utils/scopedConfig';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { existsSync } from 'fs';

// Mock electron-log
jest.mock('electron-log', () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock os module to allow mocking homedir
jest.mock('os', () => {
  const actualOs = jest.requireActual('os');
  return {
    ...actualOs,
    homedir: jest.fn(() => actualOs.homedir()),
  };
});

describe('scopedConfig', () => {
  let tempDir: string;
  let globalDir: string;
  let projectDir: string;
  let userDir: string;

  beforeEach(async () => {
    // Create temporary test directories
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scoped-config-test-'));
    globalDir = path.join(tempDir, 'global', '.claude');
    projectDir = path.join(tempDir, 'project', '.claude');
    userDir = path.join(tempDir, 'project', '.claude.local');

    await fs.mkdir(globalDir, { recursive: true });
    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(userDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    if (existsSync(tempDir)) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('getScopedData', () => {
    it('should return empty object when no config files exist', async () => {
      const result = await getScopedData('.mcp.json', {
        cwd: path.join(tempDir, 'project'),
      });

      expect(result).toEqual({});
    });

    it('should load global config', async () => {
      const globalConfig = {
        mcpServers: {
          global1: { command: 'test', args: ['arg1'] },
        },
      };

      await fs.writeFile(path.join(globalDir, '.mcp.json'), JSON.stringify(globalConfig));

      // Mock os.homedir to return our temp dir
      const mockHomedir = os.homedir as jest.MockedFunction<typeof os.homedir>;
      mockHomedir.mockReturnValue(path.join(tempDir, 'global'));

      const result = await getScopedData('.mcp.json', {
        cwd: path.join(tempDir, 'project'),
      });

      mockHomedir.mockRestore();

      expect(result).toEqual(globalConfig);
    });

    it('should merge project config over global config', async () => {
      const globalConfig = {
        mcpServers: {
          global1: { command: 'test', args: ['arg1'] },
        },
      };
      const projectConfig = {
        mcpServers: {
          project1: { command: 'test2', args: ['arg2'] },
        },
      };

      await fs.writeFile(path.join(globalDir, '.mcp.json'), JSON.stringify(globalConfig));
      await fs.writeFile(path.join(projectDir, '.mcp.json'), JSON.stringify(projectConfig));

      const mockHomedir = os.homedir as jest.MockedFunction<typeof os.homedir>;
      mockHomedir.mockReturnValue(path.join(tempDir, 'global'));

      const result = await getScopedData('.mcp.json', {
        cwd: path.join(tempDir, 'project'),
      });

      mockHomedir.mockRestore();

      expect(result).toEqual({
        mcpServers: {
          global1: { command: 'test', args: ['arg1'] },
          project1: { command: 'test2', args: ['arg2'] },
        },
      });
    });

    it('should merge user config over project and global configs', async () => {
      const globalConfig = {
        mcpServers: {
          global1: { command: 'test', args: ['arg1'] },
        },
      };
      const projectConfig = {
        mcpServers: {
          project1: { command: 'test2', args: ['arg2'] },
        },
      };
      const userConfig = {
        mcpServers: {
          user1: { command: 'test3', args: ['arg3'] },
        },
      };

      await fs.writeFile(path.join(globalDir, '.mcp.json'), JSON.stringify(globalConfig));
      await fs.writeFile(path.join(projectDir, '.mcp.json'), JSON.stringify(projectConfig));
      await fs.writeFile(path.join(userDir, '.mcp.json'), JSON.stringify(userConfig));

      const mockHomedir = os.homedir as jest.MockedFunction<typeof os.homedir>;
      mockHomedir.mockReturnValue(path.join(tempDir, 'global'));

      const result = await getScopedData('.mcp.json', {
        cwd: path.join(tempDir, 'project'),
      });

      mockHomedir.mockRestore();

      expect(result).toEqual({
        mcpServers: {
          global1: { command: 'test', args: ['arg1'] },
          project1: { command: 'test2', args: ['arg2'] },
          user1: { command: 'test3', args: ['arg3'] },
        },
      });
    });

    it('should override global server with same name in project config', async () => {
      const globalConfig = {
        mcpServers: {
          server1: { command: 'global-cmd', args: ['global-arg'] },
        },
      };
      const projectConfig = {
        mcpServers: {
          server1: { command: 'project-cmd', args: ['project-arg'] },
        },
      };

      await fs.writeFile(path.join(globalDir, '.mcp.json'), JSON.stringify(globalConfig));
      await fs.writeFile(path.join(projectDir, '.mcp.json'), JSON.stringify(projectConfig));

      const mockHomedir = os.homedir as jest.MockedFunction<typeof os.homedir>;
      mockHomedir.mockReturnValue(path.join(tempDir, 'global'));

      const result = await getScopedData('.mcp.json', {
        cwd: path.join(tempDir, 'project'),
      });

      mockHomedir.mockRestore();

      expect(result.mcpServers.server1).toEqual({
        command: 'project-cmd',
        args: ['project-arg'],
      });
    });

    it('should load from project root as well', async () => {
      const rootConfig = {
        mcpServers: {
          root1: { command: 'root-cmd', args: ['root-arg'] },
        },
      };

      await fs.writeFile(path.join(tempDir, 'project', '.mcp.json'), JSON.stringify(rootConfig));

      const mockHomedir = os.homedir as jest.MockedFunction<typeof os.homedir>;
      mockHomedir.mockReturnValue(path.join(tempDir, 'global'));

      const result = await getScopedData('.mcp.json', {
        cwd: path.join(tempDir, 'project'),
      });

      mockHomedir.mockRestore();

      expect(result).toEqual(rootConfig);
    });
  });

  describe('getScopedMcpConfig', () => {
    it('should be a convenience wrapper for .mcp.json', async () => {
      const config = {
        mcpServers: {
          test: { command: 'test', args: [] },
        },
      };

      await fs.writeFile(path.join(tempDir, 'project', '.mcp.json'), JSON.stringify(config));

      const mockHomedir = os.homedir as jest.MockedFunction<typeof os.homedir>;
      mockHomedir.mockReturnValue(path.join(tempDir, 'global'));

      const result = await getScopedMcpConfig({
        cwd: path.join(tempDir, 'project'),
      });

      mockHomedir.mockRestore();

      expect(result).toEqual(config);
    });
  });
});
