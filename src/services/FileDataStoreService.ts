import { logger } from '@/commons/utils/logger';
import { AgentConfig, AppConfig, AutosteerConfig, WorktreeConfig } from '@/types/config.types';
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const fsPromises = {
  mkdir: promisify(fs.mkdir),
  readFile: promisify(fs.readFile),
  writeFile: promisify(fs.writeFile),
  access: promisify(fs.access),
  stat: promisify(fs.stat),
  rm: promisify(fs.rm),
  rename: promisify(fs.rename),
};

export class FileDataStoreService {
  private static instance: FileDataStoreService;
  private static initialized: boolean = false;
  private appDir: string; // Always ~/.autosteer (for app.json)
  private appConfigPath: string; // Always ~/.autosteer/app.json
  private dataDir: string; // Project directory (from app.json or default to ~/.autosteer)
  private worktreesDir: string;
  private configPath: string;
  private writeQueue: Promise<void> = Promise.resolve();

  private constructor() {
    // App directory is always at ~/.autosteer
    this.appDir = path.join(app.getPath('home'), '.autosteer');
    this.appConfigPath = path.join(this.appDir, 'app.json');

    // Data directory defaults to ~/.autosteer (will be updated from app.json)
    this.dataDir = this.appDir;
    this.worktreesDir = path.join(this.dataDir, 'worktrees');
    this.configPath = path.join(this.dataDir, 'config.json');
  }

  static getInstance(): FileDataStoreService {
    if (!FileDataStoreService.instance) {
      FileDataStoreService.instance = new FileDataStoreService();
    }
    return FileDataStoreService.instance;
  }

  /**
   * Initialize the service by loading custom project directory from app.json if set.
   * This should be called once at app startup.
   */
  static async initialize(): Promise<FileDataStoreService> {
    const instance = FileDataStoreService.getInstance();

    if (FileDataStoreService.initialized) {
      return instance;
    }

    try {
      // Ensure ~/.autosteer exists for app.json
      await fsPromises.mkdir(instance.appDir, { recursive: true });

      // Read app.json to check for custom projectDirectory
      try {
        await fsPromises.access(instance.appConfigPath, fs.constants.F_OK);
        const content = await fsPromises.readFile(instance.appConfigPath, 'utf-8');
        const appConfig = JSON.parse(content) as AppConfig;

        // If a custom project directory is set, use it
        if (appConfig.projectDirectory) {
          const customDir = appConfig.projectDirectory;
          logger.info(`Loading custom project directory from app.json: ${customDir}`);
          instance.setDataDirectory(customDir);

          // Ensure the custom directory exists
          await instance.ensureDirectories();
        } else {
          logger.info('Using default project directory: ~/.autosteer');
        }
      } catch (error) {
        // app.json doesn't exist yet or can't be read - use default
        logger.info('app.json not found, using default project directory: ~/.autosteer');
      }

      FileDataStoreService.initialized = true;
    } catch (error) {
      logger.error('Error during FileDataStoreService initialization:', error);
    }

    return instance;
  }

  /**
   * Read app.json (always at ~/.autosteer/app.json)
   */
  async readAppConfig(): Promise<AppConfig> {
    try {
      await fsPromises.access(this.appConfigPath, fs.constants.F_OK);
      const content = await fsPromises.readFile(this.appConfigPath, 'utf-8');
      return JSON.parse(content) as AppConfig;
    } catch (error) {
      // Return default config if file doesn't exist
      return {};
    }
  }

  /**
   * Write app.json (always at ~/.autosteer/app.json)
   */
  async writeAppConfig(config: AppConfig): Promise<void> {
    try {
      await fsPromises.mkdir(this.appDir, { recursive: true });
      const content = JSON.stringify(config, null, 2);
      await fsPromises.writeFile(this.appConfigPath, content, 'utf-8');
      logger.info(`app.json written to: ${this.appConfigPath}`);
    } catch (error) {
      logger.error('Failed to write app.json:', error);
      throw error;
    }
  }

  getDataDirectory(): string {
    return this.dataDir;
  }

  setDataDirectory(newDataDir: string): void {
    this.dataDir = newDataDir;
    this.worktreesDir = path.join(this.dataDir, 'worktrees');
    this.configPath = path.join(this.dataDir, 'config.json');
    logger.info(`Data directory updated to: ${this.dataDir}`);
  }

  getWorktreesDirectory(): string {
    return this.worktreesDir;
  }

  async ensureDirectories(): Promise<void> {
    try {
      await fsPromises.mkdir(this.dataDir, { recursive: true });
      await fsPromises.mkdir(this.worktreesDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create autosteer directories:', error);
      throw error;
    }
  }

  async configExists(): Promise<boolean> {
    try {
      await fsPromises.access(this.configPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async readConfig(): Promise<AutosteerConfig> {
    try {
      const exists = await this.configExists();
      if (!exists) {
        // Create the config file with empty worktrees if it doesn't exist
        const emptyConfig: AutosteerConfig = {
          worktrees: [],
          settings: { vimMode: false },
        };
        await this.writeConfig(emptyConfig);
        return emptyConfig;
      }

      const content = await fsPromises.readFile(this.configPath, 'utf-8');

      // Validate JSON parsing
      let parsedConfig: AutosteerConfig;
      try {
        parsedConfig = JSON.parse(content) as AutosteerConfig;
      } catch (parseError) {
        logger.error('Config file is corrupted, backing up and creating new one:', parseError);
        // Backup corrupted file
        const backupPath = `${this.configPath}.backup.${Date.now()}`;
        await fsPromises.writeFile(backupPath, content, 'utf-8');
        logger.info(`Corrupted config backed up to: ${backupPath}`);

        // Create fresh config
        const emptyConfig: AutosteerConfig = {
          worktrees: [],
          settings: { vimMode: false },
        };
        await this.writeConfig(emptyConfig);
        return emptyConfig;
      }

      // Validate config structure
      if (!parsedConfig.worktrees) {
        parsedConfig.worktrees = [];
      }
      if (!Array.isArray(parsedConfig.worktrees)) {
        logger.warn('Invalid worktrees format, resetting to empty array');
        parsedConfig.worktrees = [];
      }

      // Filter out invalid/empty worktrees (those missing required fields)
      const validWorktrees = parsedConfig.worktrees.filter((wt) => {
        const isValid = wt.git_repo && wt.branch_name && wt.folder_name;
        if (!isValid) {
          logger.warn('[readConfig] Removing invalid worktree:', {
            git_repo: wt.git_repo || 'MISSING',
            branch_name: wt.branch_name || 'MISSING',
            folder_name: wt.folder_name || 'MISSING',
          });
        }
        return isValid;
      });

      if (validWorktrees.length !== parsedConfig.worktrees.length) {
        parsedConfig.worktrees = validWorktrees;
      }

      return parsedConfig;
    } catch (error) {
      logger.error('Failed to read config:', error);
      // Try to create an empty config file
      const emptyConfig: AutosteerConfig = {
        worktrees: [],
        settings: { vimMode: false },
      };
      try {
        await this.writeConfig(emptyConfig);
      } catch (writeError) {
        logger.error('Failed to create config file:', writeError);
      }
      return emptyConfig;
    }
  }

  async writeConfig(config: AutosteerConfig): Promise<void> {
    // Queue the write operation to prevent concurrent writes
    this.writeQueue = this.writeQueue
      .then(async () => {
        try {
          await this.ensureDirectories();

          // Validate config before writing
          if (!config.worktrees || !Array.isArray(config.worktrees)) {
            logger.error('Invalid config structure, aborting write');
            throw new Error('Invalid config structure: worktrees must be an array');
          }
          const content = JSON.stringify(config, null, 2);
          // Write to a temp file first, then rename for atomic operation
          const tempPath = `${this.configPath}.tmp.${Date.now()}`;
          await fsPromises.writeFile(tempPath, content, 'utf-8');

          // Use atomic rename
          await fsPromises.rename(tempPath, this.configPath);
          logger.debug('Config written successfully');
        } catch (error) {
          logger.error('Failed to write config:', error);
          throw error;
        }
      })
      .catch((error) => {
        logger.error('Write queue error:', error);
        throw error;
      });

    return this.writeQueue;
  }

  async addWorktree(worktree: WorktreeConfig): Promise<void> {
    logger.info('[addWorktree] Adding worktree:', JSON.stringify(worktree, null, 2));

    // Validate worktree has required fields
    if (!worktree.git_repo || !worktree.branch_name || !worktree.folder_name) {
      const error = new Error(
        `Invalid worktree data: missing required fields. Received: ${JSON.stringify(worktree)}`
      );
      logger.error('[addWorktree] Validation failed:', error.message);
      throw error;
    }

    const config = await this.readConfig();

    // Check if worktree already exists
    const existingIndex = config.worktrees.findIndex((w) => w.folder_name === worktree.folder_name);

    if (existingIndex >= 0) {
      // Update existing worktree
      logger.info('[addWorktree] Updating existing worktree at index:', existingIndex);
      config.worktrees[existingIndex] = worktree;
    } else {
      // Add new worktree
      logger.info('[addWorktree] Adding new worktree');
      config.worktrees.push(worktree);
    }

    // Clean up any orphaned agents that belong to this worktree
    // This handles cases where a worktree is recreated with the same name
    if (config.agents) {
      config.agents = config.agents.filter((agent) => agent.project_id !== worktree.folder_name);
    }

    logger.info('[addWorktree] Writing config with worktrees:', config.worktrees.length);
    await this.writeConfig(config);
    logger.info('[addWorktree] Worktree added successfully');
  }

  async removeWorktree(folderName: string): Promise<void> {
    const config = await this.readConfig();

    // Remove the worktree
    config.worktrees = config.worktrees.filter((w) => w.folder_name !== folderName);

    // Clean up all agents associated with this worktree
    if (config.agents) {
      config.agents = config.agents.filter((agent) => agent.project_id !== folderName);
    }

    // Clean up projects from the store
    if (config.store && config.store.projects && Array.isArray(config.store.projects)) {
      const projects = config.store.projects;
      config.store.projects = projects.filter((project: any) => project.folderName !== folderName);
    }

    // Clean up recent projects
    if (config.recentProjects && Array.isArray(config.recentProjects)) {
      config.recentProjects = config.recentProjects.filter((project) => project !== folderName);
    }

    // Clean up any other potential references in the store
    if (config.store) {
      // Remove any worktree-specific data stored by folder name
      Object.keys(config.store).forEach((key) => {
        if (key.includes(folderName)) {
          delete config.store![key];
        }
      });
    }

    await this.writeConfig(config);
  }

  async deleteWorktreeDirectory(folderName: string): Promise<void> {
    try {
      const worktreePath = path.join(this.worktreesDir, folderName);
      // Check if directory exists before attempting to delete
      const exists = await this.worktreeExists(folderName);
      if (exists) {
        await fsPromises.rm(worktreePath, { recursive: true, force: true });
      }
    } catch (error) {
      logger.error('Failed to delete worktree directory:', error);
      throw error;
    }
  }

  async worktreeExists(folderName: string): Promise<boolean> {
    try {
      const worktreePath = path.join(this.worktreesDir, folderName);
      await fsPromises.access(worktreePath, fs.constants.F_OK);
      const stat = await fsPromises.stat(worktreePath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  async getWorktrees(): Promise<WorktreeConfig[]> {
    const config = await this.readConfig();
    return config.worktrees || [];
  }

  getWorktreePath(folderName: string): string {
    return path.join(this.worktreesDir, folderName);
  }

  getMainRepoPath(repoUrl: string): string {
    // Extract repo name from URL
    const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'repo';

    // Main repos are stored in ~/.autosteer/repos/
    const reposDir = path.join(this.dataDir, 'repos');
    return path.join(reposDir, repoName);
  }

  async ensureReposDirectory(): Promise<void> {
    const reposDir = path.join(this.dataDir, 'repos');
    await fsPromises.mkdir(reposDir, { recursive: true });
  }

  // Agent management methods
  async getAgents(): Promise<AgentConfig[]> {
    const config = await this.readConfig();
    return config.agents || [];
  }

  async getAgentsByProjectId(projectId: string): Promise<AgentConfig[]> {
    const agents = await this.getAgents();
    return agents.filter((agent) => agent.project_id === projectId);
  }

  async getAgent(agentId: string): Promise<AgentConfig | undefined> {
    const agents = await this.getAgents();
    return agents.find((agent) => agent.id === agentId);
  }

  async addAgent(agent: AgentConfig): Promise<void> {
    const config = await this.readConfig();
    if (!config.agents) {
      config.agents = [];
    }
    config.agents.push(agent);

    // Also add the agent ID to the worktree's agent_ids array
    const worktree = config.worktrees.find((w) => w.folder_name === agent.project_id);
    if (worktree) {
      if (!worktree.agent_ids) {
        worktree.agent_ids = [];
      }
      if (!worktree.agent_ids.includes(agent.id)) {
        worktree.agent_ids.push(agent.id);
      }
    }

    await this.writeConfig(config);
  }

  async updateAgent(agentId: string, updates: Partial<AgentConfig>): Promise<void> {
    const config = await this.readConfig();
    if (!config.agents) {
      return;
    }

    const agentIndex = config.agents.findIndex((a) => a.id === agentId);
    if (agentIndex !== -1) {
      config.agents[agentIndex] = {
        ...config.agents[agentIndex],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      await this.writeConfig(config);
    }
  }

  async deleteAgent(agentId: string): Promise<void> {
    const config = await this.readConfig();

    // Remove agent from agents array
    if (config.agents) {
      config.agents = config.agents.filter((a) => a.id !== agentId);
    }

    // Remove agent ID from all worktrees
    config.worktrees.forEach((worktree) => {
      if (worktree.agent_ids) {
        worktree.agent_ids = worktree.agent_ids.filter((id) => id !== agentId);
      }
    });

    await this.writeConfig(config);
  }

  async searchAgents(query: string): Promise<AgentConfig[]> {
    const agents = await this.getAgents();
    const lowercaseQuery = query.toLowerCase();

    return agents.filter((agent) => {
      const titleMatch = agent.title.toLowerCase().includes(lowercaseQuery);
      const contentMatch = agent.content.toLowerCase().includes(lowercaseQuery);
      const tagMatch = agent.tags.some((tag) => tag.toLowerCase().includes(lowercaseQuery));

      return titleMatch || contentMatch || tagMatch;
    });
  }
}
