import { IPC_CHANNELS, SlashCommand } from '@/types/ipc.types';
import { IpcMainInvokeEvent, ipcMain } from 'electron';
import log from 'electron-log';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

export class SlashCommandHandlers {
  registerHandlers(): void {
    ipcMain.handle(
      IPC_CHANNELS.SLASH_COMMANDS_LOAD,
      async (_event: IpcMainInvokeEvent, projectPath?: string) => {
        try {
          const commands: SlashCommand[] = [];

          let baseDir: string = process.cwd(); // Default to current working directory

          if (projectPath) {
            // Use the provided project path (worktree directory)
            baseDir = projectPath;
          } else if (process.env.NODE_ENV === 'development') {
            // In dev mode, look for .claude/commands in the monorepo
            let currentDir = path.resolve(__dirname, '../../../..'); // Should be autosteer dir
            let foundClaudeDir = false;

            // Look up the directory tree for .claude/commands
            for (let i = 0; i < 5; i++) {
              const claudeCommandsPath = path.join(currentDir, '.claude', 'commands');
              try {
                await fs.access(claudeCommandsPath);
                baseDir = currentDir;
                foundClaudeDir = true;
                break;
              } catch {
                // Directory doesn't exist, try parent
                currentDir = path.join(currentDir, '..');
              }
            }

            if (!foundClaudeDir) {
              // Fallback to current working directory
              baseDir = process.cwd();
            }
          } else {
            // Fallback to current working directory
            baseDir = process.cwd();
          }

          // Resolve ~ to home directory if present
          if (baseDir.startsWith('~')) {
            baseDir = path.join(os.homedir(), baseDir.slice(1));
          }

          log.info(`Loading slash commands from base directory: ${baseDir}`);

          // Load from local .claude/commands directory
          const localCommandsPath = path.join(baseDir, '.claude', 'commands');
          const localCommands = await this.loadCommandsFromDirectory(
            localCommandsPath,
            'local',
            localCommandsPath,
            ''
          );
          commands.push(...localCommands);

          // Load from user home ~/.claude/commands directory
          const userCommandsPath = path.join(os.homedir(), '.claude', 'commands');
          const userCommands = await this.loadCommandsFromDirectory(
            userCommandsPath,
            'user',
            userCommandsPath,
            ''
          );
          commands.push(...userCommands);

          // Don't filter any commands - let them all through
          // The frontend already has built-in formatting commands like /h1, /h2, /divider
          // Custom commands from .claude/commands/ should be shown alongside them

          return commands;
        } catch (error) {
          log.error('Failed to load slash commands:', error);
          throw error;
        }
      }
    );
  }

  private async loadCommandsFromDirectory(
    dirPath: string,
    source: 'local' | 'user',
    baseDir: string = dirPath,
    prefix: string = ''
  ): Promise<SlashCommand[]> {
    const commands: SlashCommand[] = [];

    try {
      // Check if directory exists
      await fs.access(dirPath);

      // Read all items in the directory
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);

        if (item.isDirectory()) {
          // Recursively load commands from subdirectory
          const subPrefix = prefix ? `${prefix}:${item.name}` : item.name;
          const subCommands = await this.loadCommandsFromDirectory(
            itemPath,
            source,
            baseDir,
            subPrefix
          );
          commands.push(...subCommands);
        } else if (item.isFile() && item.name.endsWith('.md')) {
          // Load markdown file
          try {
            const content = await fs.readFile(itemPath, 'utf-8');
            const baseName = path.basename(item.name, '.md');
            const trigger = prefix ? `${prefix}:${baseName}` : baseName;
            const description = this.extractDescription(content);

            commands.push({
              trigger,
              description,
              content,
              source,
            });
          } catch (fileError) {
            log.error(`Failed to load command file ${itemPath}:`, fileError);
          }
        }
      }
    } catch (dirError) {
      // Directory doesn't exist or can't be accessed - this is OK
      log.debug(`Command directory ${dirPath} not accessible`);
    }

    return commands;
  }

  private extractDescription(content: string): string {
    // Check if content has YAML frontmatter
    if (content.startsWith('---')) {
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        // Look for description field in frontmatter
        const descriptionMatch = frontmatter.match(/^description:\s*(.+)$/m);
        if (descriptionMatch) {
          return descriptionMatch[1].trim();
        }
      }
    }

    // Fallback: Split content into lines
    const lines = content.split('\n');

    // Find the first non-empty line after stripping markdown syntax and frontmatter
    let inFrontmatter = false;
    for (const line of lines) {
      // Skip frontmatter section
      if (line.trim() === '---') {
        inFrontmatter = !inFrontmatter;
        continue;
      }
      if (inFrontmatter) {
        continue;
      }

      // Remove markdown headers and trim
      const cleanLine = line
        .replace(/^#+\s*/, '') // Remove headers
        .replace(/^\*+\s*/, '') // Remove bullet points
        .replace(/^-+\s*/, '') // Remove dashes
        .replace(/^<!--.*-->$/, '') // Remove HTML comments
        .trim();

      if (cleanLine.length > 0) {
        return cleanLine;
      }
    }

    return 'No description available';
  }
}
