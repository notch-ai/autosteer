import { isValidationEnabled } from '@/config/validation.config';
import { CHANGES_TAB_ID, MAX_TABS, TERMINAL_TAB_ID } from '@/constants/tabs';
import { Agent, AgentStatus, AgentType } from '@/entities';
import { FileDataStoreService } from '@/services/FileDataStoreService';
import { McpAuthService, McpServerConfig } from '@/services/McpAuthService';
import { SessionManifestService } from '@/services/SessionManifestService';
import { ComputedMessage, formatToolDescription } from '@/stores/chat.selectors';
import { AgentConfig } from '@/types/config.types';
import { IPC_CHANNELS, SlashCommand } from '@/types/ipc.types';
import { IpcMainInvokeEvent, shell } from 'electron';
import log from 'electron-log';
import { createReadStream, existsSync, readFileSync } from 'fs';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';
import { v4 as uuidv4 } from 'uuid';
import { registerSafeHandler } from '../safeHandlerWrapper';

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-5-sonnet-20240620': { input: 3.0, output: 15.0 },
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
  'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-3-5-haiku-20241022': { input: 1.0, output: 5.0 },
  'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
  'claude-opus-4-1-20250805': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
};

/**
 * ClaudeHandlers class
 * Consolidated IPC handler for Claude Code operations including agent management,
 * MCP server authentication, and slash command discovery.
 *
 * @remarks
 * This handler consolidates functionality from:
 * - AgentHandlers.ts (agent CRUD, chat history, sessions)
 * - McpHandlers.ts (MCP server authentication)
 * - SlashCommandHandlers.ts (slash command discovery)
 *
 * Key responsibilities:
 * - Agent lifecycle management with multi-session support (up to 5 per worktree)
 * - Claude Code session-to-agent mapping
 * - Chat history parsing from JSONL files
 * - MCP server OAuth2 authentication flow
 *
 * @example
 * ```typescript
 * const handlers = new ClaudeHandlers();
 * handlers.registerHandlers();
 * ```
 */
export class ClaudeHandlers {
  private fileDataStore: FileDataStoreService;
  private sessionManifest: SessionManifestService;
  private mcpAuthService: McpAuthService;

  constructor() {
    this.fileDataStore = FileDataStoreService.getInstance();
    this.sessionManifest = SessionManifestService.getInstance();
    this.mcpAuthService = McpAuthService.getInstance();
  }

  /**
   * Calculate token cost based on usage and model pricing
   */
  private calculateTokenCost(usage: any, model: string): number {
    const pricing = MODEL_PRICING[model] || { input: 15.0, output: 75.0 };

    const inputCost = ((usage.input_tokens || 0) / 1_000_000) * pricing.input;
    const outputCost = ((usage.output_tokens || 0) / 1_000_000) * pricing.output;
    const cacheCreationCost =
      ((usage.cache_creation_input_tokens || 0) / 1_000_000) * pricing.input;
    const cacheReadCost = ((usage.cache_read_input_tokens || 0) / 1_000_000) * pricing.input;

    const totalCost = inputCost + outputCost + cacheCreationCost + cacheReadCost;
    return Math.round(totalCost * 1_000_000) / 1_000_000;
  }

  /**
   * Validate ChatMessage structure
   * Only runs in development/test environments for early warning
   *
   * @param message - The ChatMessage to validate
   * @returns true if valid, false otherwise
   */
  private validateChatMessage(message: ComputedMessage): boolean {
    if (!isValidationEnabled()) {
      return true;
    }

    // Validate required fields
    if (!message.id || typeof message.id !== 'string') {
      log.warn('[ClaudeHandlers] Invalid message: missing or invalid id', { message });
      return false;
    }

    if (message.role !== 'user' && message.role !== 'assistant') {
      log.warn('[ClaudeHandlers] Invalid message: invalid role', { role: message.role });
      return false;
    }

    if (typeof message.content !== 'string') {
      log.warn('[ClaudeHandlers] Invalid message: content must be string', {
        contentType: typeof message.content,
      });
      return false;
    }

    if (!(message.timestamp instanceof Date) || isNaN(message.timestamp.getTime())) {
      log.warn('[ClaudeHandlers] Invalid message: invalid timestamp', {
        timestamp: message.timestamp,
      });
      return false;
    }

    return true;
  }

  /**
   * Convert AgentConfig (stored format) to Agent (runtime format)
   */
  private convertConfigToAgent(config: AgentConfig): Agent {
    const agent: Agent = {
      id: config.id,
      title: config.title,
      content: config.content,
      preview: config.preview,
      type: config.type as AgentType,
      status: config.status as AgentStatus,
      createdAt: new Date(config.created_at),
      updatedAt: new Date(config.updated_at),
      tags: config.tags,
      resourceIds: config.resource_ids,
      projectId: config.project_id,
    };

    if (config.metadata) {
      agent.metadata = config.metadata;
    }

    if (config.chat_history) {
      agent.chatHistory = config.chat_history.map((msg: any) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        ...(msg.attachedResources && { attachedResources: msg.attachedResources }),
      }));
    }

    return agent;
  }

  /**
   * Convert Agent (runtime format) to AgentConfig (stored format)
   */
  private convertAgentToConfig(agent: Agent): AgentConfig {
    const config: AgentConfig = {
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
    };

    if (agent.metadata) {
      config.metadata = agent.metadata;
    }

    if (agent.chatHistory) {
      config.chat_history = agent.chatHistory.map((msg: ComputedMessage) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        ...(msg.attachedResources && { attachedResources: msg.attachedResources }),
      }));
    }

    return config;
  }

  /**
   * Load slash commands from a directory structure
   */
  private async loadCommandsFromDirectory(
    dirPath: string,
    source: 'local' | 'user',
    baseDir: string = dirPath,
    prefix: string = ''
  ): Promise<SlashCommand[]> {
    const commands: SlashCommand[] = [];

    try {
      await fs.access(dirPath);
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);

        if (item.isDirectory()) {
          const subPrefix = prefix ? `${prefix}:${item.name}` : item.name;
          const subCommands = await this.loadCommandsFromDirectory(
            itemPath,
            source,
            baseDir,
            subPrefix
          );
          commands.push(...subCommands);
        } else if (item.isFile() && item.name.endsWith('.md')) {
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
      // eslint-disable-next-line no-empty
    } catch (dirError) {}

    return commands;
  }

  /**
   * Extract description from markdown command file
   */
  private extractDescription(content: string): string {
    if (content.startsWith('---')) {
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        const descriptionMatch = frontmatter.match(/^description:\s*(.+)$/m);
        if (descriptionMatch) {
          return descriptionMatch[1].trim();
        }
      }
    }

    const lines = content.split('\n');
    let inFrontmatter = false;

    for (const line of lines) {
      if (line.trim() === '---') {
        inFrontmatter = !inFrontmatter;
        continue;
      }
      if (inFrontmatter) {
        continue;
      }

      const cleanLine = line
        .replace(/^#+\s*/, '')
        .replace(/^\*+\s*/, '')
        .replace(/^-+\s*/, '')
        .replace(/^<!--.*-->$/, '')
        .trim();

      if (cleanLine.length > 0) {
        return cleanLine;
      }
    }

    return 'No description available';
  }

  /**
   * Register all IPC handlers for Claude Code operations
   */
  registerHandlers(): void {
    // Agent: Load all agents
    registerSafeHandler(
      IPC_CHANNELS.AGENTS_LOAD_ALL,
      async (_event: IpcMainInvokeEvent) => {
        const agentConfigs = await this.fileDataStore.getAgents();
        const agents = agentConfigs.map(this.convertConfigToAgent);
        return agents;
      },
      { operationName: 'Load all agents' }
    );

    // Agent: Load agents by project
    registerSafeHandler(
      IPC_CHANNELS.AGENTS_LOAD_BY_PROJECT,
      async (_event: IpcMainInvokeEvent, projectId: string) => {
        const agentConfigs = await this.fileDataStore.getAgentsByProjectId(projectId);
        const agents = agentConfigs.map(this.convertConfigToAgent);
        return agents;
      },
      { operationName: 'Load agents by project' }
    );

    // Agent: Create agent
    registerSafeHandler(
      IPC_CHANNELS.AGENTS_CREATE,
      async (_event: IpcMainInvokeEvent, data: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) => {
        const agentData = { ...data };

        if (agentData.projectId) {
          const existingAgents = await this.fileDataStore.getAgentsByProjectId(agentData.projectId);
          if (existingAgents.length >= MAX_TABS) {
            throw new Error(
              `Maximum tab limit reached. Each worktree can have up to ${MAX_TABS} tabs.`
            );
          }
        }

        const agentId = uuidv4();
        const newAgent: Agent = {
          ...agentData,
          id: agentId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const agentConfig = this.convertAgentToConfig(newAgent);
        await this.fileDataStore.addAgent(agentConfig);

        return newAgent;
      },
      { operationName: 'Create agent' }
    );

    // Agent: Update agent
    registerSafeHandler(
      IPC_CHANNELS.AGENTS_UPDATE,
      async (_event: IpcMainInvokeEvent, id: string, updates: Partial<Agent>) => {
        let claude_session_id: string | undefined;
        if (
          updates.metadata &&
          typeof updates.metadata === 'object' &&
          'claude_session_id' in updates.metadata
        ) {
          claude_session_id = (updates.metadata as any).claude_session_id;
        }

        await this.fileDataStore.updateAgent(id, {
          ...updates,
          ...(claude_session_id && { claude_session_id }),
          updated_at: new Date().toISOString(),
        });
      },
      { operationName: 'Update agent' }
    );

    // Agent: Delete agent
    registerSafeHandler(
      IPC_CHANNELS.AGENTS_DELETE,
      async (_event: IpcMainInvokeEvent, id: string) => {
        const agent = await this.fileDataStore.getAgent(id);
        if (agent) {
          await this.sessionManifest.deleteAgentSessions(agent.project_id, id);
        }

        await this.fileDataStore.deleteAgent(id);
      },
      { operationName: 'Delete agent' }
    );

    // Agent: Update session mapping
    registerSafeHandler(
      IPC_CHANNELS.AGENTS_UPDATE_SESSION,
      async (
        _event: IpcMainInvokeEvent,
        worktreeId: string,
        agentId: string,
        sessionId: string
      ) => {
        await this.sessionManifest.updateAgentSession(worktreeId, agentId, sessionId);
        return { success: true };
      },
      { operationName: 'Update agent session' }
    );

    // Agent: Search agents
    registerSafeHandler(
      IPC_CHANNELS.AGENTS_SEARCH,
      async (_event: IpcMainInvokeEvent, query: string) => {
        const agentConfigs = await this.fileDataStore.searchAgents(query);
        const results = agentConfigs.map(this.convertConfigToAgent);
        return results;
      },
      { operationName: 'Search agents' }
    );

    // Agent: Load chat history (implementation from AgentHandlers.ts lines 285-874)
    registerSafeHandler(
      IPC_CHANNELS.AGENTS_LOAD_CHAT_HISTORY,
      async (_event: IpcMainInvokeEvent, agentId: string) => {
        // Skip system tabs (terminal-tab, changes-tab) - they don't have chat history
        if (agentId === TERMINAL_TAB_ID || agentId === CHANGES_TAB_ID) {
          return { messages: [], sessionId: null };
        }

        const agent = await this.fileDataStore.getAgent(agentId);
        if (!agent || !agent.project_id) {
          return { messages: [], sessionId: null };
        }

        const worktrees = await this.fileDataStore.getWorktrees();
        const worktree = worktrees.find((w) => w.folder_name === agent.project_id);
        if (!worktree) {
          log.info(`[ClaudeHandlers] No worktree found for project ${agent.project_id}`);
          return { messages: [], sessionId: null };
        }

        const homedir = os.homedir();
        const homedirFormatted = homedir.substring(1).replace(/[^a-zA-Z0-9]/g, '-');
        const projectDirName = `-${homedirFormatted}--autosteer-worktrees-${worktree.folder_name}`;
        const claudeProjectsDir = path.join(homedir, '.claude', 'projects', projectDirName);

        let jsonlFilePath: string;
        let actualSessionId: string | undefined;

        try {
          actualSessionId = await this.sessionManifest.getAgentSession(
            worktree.folder_name,
            agentId
          );

          if (!actualSessionId) {
            return { messages: [], sessionId: null };
          }

          jsonlFilePath = path.join(claudeProjectsDir, `${actualSessionId}.jsonl`);

          try {
            await fs.access(jsonlFilePath);
          } catch {
            log.warn(
              `[ClaudeHandlers] JSONL file not found for session ${actualSessionId}, may have been deleted`
            );
            return { messages: [], sessionId: null };
          }
        } catch (err) {
          log.error(`[ClaudeHandlers] Failed to read Claude projects directory: ${err}`);
          return { messages: [], sessionId: null };
        }

        // Load SDK messages from JSONL file
        const sdkMessages: any[] = [];
        const fileStream = createReadStream(jsonlFilePath);
        const rl = readline.createInterface({
          input: fileStream,
          crlfDelay: Infinity,
        });

        for await (const line of rl) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            sdkMessages.push(data);
          } catch (e) {
            log.warn(`[ClaudeHandlers] Failed to parse JSONL line: ${e}`);
          }
        }

        // Transform SDK messages to ChatMessage format
        const messages: ComputedMessage[] = [];
        const pendingPermissions = new Map<
          string,
          {
            tool_name: string;
            file_path: string;
            old_string?: string;
            new_string?: string;
            content?: string;
          }
        >();

        for (const sdkMsg of sdkMessages) {
          try {
            // Use sdkMsg directly (already typed as any from JSONL parsing)
            const data = sdkMsg;

            if (data.type === 'system' && data.subtype === 'init') {
              continue;
            }

            if (data.isCompactSummary === true || data.isVisibleInTranscriptOnly === true) {
              continue;
            }

            if (
              data.message?.content &&
              typeof data.message.content === 'string' &&
              (data.message.content.includes('<command-name>/compact</command-name>') ||
                data.message.content.includes('<local-command-stdout>Compacted '))
            ) {
              continue;
            }

            if (data.type === 'system' && data.subtype === 'compact_boundary') {
              const metadata = data.compactMetadata || data.compact_metadata;
              if (metadata) {
                const compactText = `Compaction completed\n\nPre-compaction tokens: ${metadata.preTokens || metadata.pre_tokens}\n\nTrigger: ${metadata.trigger}`;
                messages.push({
                  id: data.uuid || `compact-${Date.now()}`,
                  role: 'assistant',
                  content: compactText,
                  timestamp: new Date(data.timestamp || Date.now()),
                  attachedResources: [],
                  isCompactionReset: true,
                });
              }
              continue;
            }

            if (data.isSidechain === true) {
              continue;
            }

            if (
              data.type === 'user' ||
              data.type === 'assistant' ||
              data.role === 'user' ||
              data.role === 'assistant'
            ) {
              let content = '';
              let role: 'user' | 'assistant' = 'user';

              if (data.message?.role === 'assistant' || data.type === 'assistant') {
                role = 'assistant';
              } else if (data.message?.role === 'user' || data.type === 'user') {
                role = 'user';
              }

              let toolCalls: any[] = [];

              if (data.content) {
                if (typeof data.content === 'string') {
                  content = data.content;
                } else if (Array.isArray(data.content)) {
                  const textParts: string[] = [];
                  data.content.forEach((item: any) => {
                    if (typeof item === 'string') {
                      textParts.push(item);
                    } else if (item.type === 'text' && item.text) {
                      textParts.push(item.text);
                    } else if (item.type === 'tool_use') {
                      toolCalls.push({
                        type: 'tool_use',
                        id: item.id,
                        name: item.name,
                        input: item.input,
                        parent_tool_use_id: data.parent_tool_use_id || null,
                      });

                      if ((item.name === 'Edit' || item.name === 'Write') && item.input) {
                        pendingPermissions.set(item.id, {
                          tool_name: item.name,
                          file_path: item.input.file_path || '',
                          old_string: item.input.old_string,
                          new_string: item.input.new_string,
                          content: item.input.content,
                        });
                      }
                    }
                  });
                  content = textParts.join('\n');
                }
              } else if (data.message && data.message.content) {
                if (typeof data.message.content === 'string') {
                  content = data.message.content;
                } else if (Array.isArray(data.message.content)) {
                  const textParts: string[] = [];
                  data.message.content.forEach((item: any) => {
                    if (typeof item === 'string') {
                      textParts.push(item);
                    } else if (item.type === 'text' && item.text) {
                      textParts.push(item.text);
                    } else if (item.type === 'tool_use') {
                      toolCalls.push({
                        type: 'tool_use',
                        id: item.id,
                        name: item.name,
                        input: item.input,
                        parent_tool_use_id: data.parent_tool_use_id || null,
                      });

                      if ((item.name === 'Edit' || item.name === 'Write') && item.input) {
                        pendingPermissions.set(item.id, {
                          tool_name: item.name,
                          file_path: item.input.file_path || '',
                          old_string: item.input.old_string,
                          new_string: item.input.new_string,
                          content: item.input.content,
                        });
                      }
                    }
                  });
                  content = textParts.join('\n');
                }
              }

              if (data.type === 'user' || data.role === 'user') {
                let hasPermissionDenial = false;

                if (data.message?.content && Array.isArray(data.message.content)) {
                  data.message.content.forEach((item: any) => {
                    if (item.type === 'tool_result') {
                      toolCalls.push({
                        type: 'tool_result',
                        tool_use_id: item.tool_use_id,
                        content: item.content,
                      });

                      if (
                        item.is_error &&
                        typeof item.content === 'string' &&
                        item.content.includes('Claude requested permissions')
                      ) {
                        hasPermissionDenial = true;
                      }

                      if (
                        data.toolUseResult &&
                        item.tool_use_id &&
                        pendingPermissions.has(item.tool_use_id)
                      ) {
                        const permissionInfo = pendingPermissions.get(item.tool_use_id)!;

                        const permissionActionMessage: ComputedMessage = {
                          id: `permission-approved-${data.uuid || Date.now()}`,
                          role: 'assistant',
                          content: '',
                          timestamp: new Date(data.timestamp || Date.now()),
                          attachedResources: [],
                          permissionAction: {
                            type: 'accepted',
                            file_path: data.toolUseResult.filePath || permissionInfo.file_path,
                            old_string: data.toolUseResult.oldString || permissionInfo.old_string,
                            new_string: data.toolUseResult.newString || permissionInfo.new_string,
                            content: permissionInfo.content,
                            timestamp: new Date(data.timestamp || Date.now()),
                          },
                        };

                        messages.push(permissionActionMessage);
                        pendingPermissions.delete(item.tool_use_id);
                      }
                    }
                  });
                }

                if (hasPermissionDenial) {
                  continue;
                }
              }

              if (content && content.includes('Caveat: The messages below were generated')) {
                continue;
              }

              if (
                role === 'user' &&
                !content &&
                data.message?.content?.[0]?.type === 'tool_result'
              ) {
                continue;
              }

              if (role === 'user' && !content) {
                continue;
              }

              let rawToolCalls: any[] = [];
              let messageTodos: any[] | undefined;

              if (role === 'assistant' && toolCalls.length > 0) {
                rawToolCalls = [...toolCalls];

                for (const tc of toolCalls) {
                  if (tc.type === 'tool_use' && tc.name === 'TodoWrite' && tc.input?.todos) {
                    messageTodos = tc.input.todos;
                    break;
                  }
                }

                const simplifiedToolCalls = toolCalls
                  .filter((tc) => tc.type === 'tool_use')
                  .map((tc) => {
                    if (tc.name === 'TodoWrite') {
                      return null;
                    }

                    const description = formatToolDescription(tc.name, tc.input);

                    return {
                      type: 'tool_use' as const,
                      name: tc.name,
                      ...(description && { description }),
                    };
                  })
                  .filter((tc): tc is NonNullable<typeof tc> => tc !== null);

                if (
                  !content &&
                  messages.length > 0 &&
                  messages[messages.length - 1].role === 'assistant'
                ) {
                  const lastMessage = messages[messages.length - 1];
                  if (!lastMessage.simplifiedToolCalls) {
                    lastMessage.simplifiedToolCalls = [];
                  }
                  lastMessage.simplifiedToolCalls.push(...simplifiedToolCalls);

                  if (!lastMessage.toolCalls) {
                    lastMessage.toolCalls = [];
                  }
                  lastMessage.toolCalls.push(...rawToolCalls);

                  if (messageTodos) {
                    lastMessage.latestTodos = messageTodos;
                  }

                  continue;
                }

                toolCalls = simplifiedToolCalls;
              }

              if (content.startsWith('Previous Conversation:')) {
                const lines = content.split('\n').slice(1);
                let lastMessage = { role: '', content: '' };

                for (const line of lines) {
                  const trimmedLine = line.trim();
                  if (!trimmedLine) continue;

                  if (trimmedLine.startsWith('User: ')) {
                    const userContent = trimmedLine.substring(6);
                    if (userContent && !userContent.includes('Session initialized')) {
                      if (lastMessage.role === 'user' && lastMessage.content === userContent) {
                        continue;
                      }
                      messages.push({
                        id: `msg-${Date.now()}-${Math.random()}`,
                        role: 'user',
                        content: userContent,
                        timestamp: new Date(data.timestamp || Date.now()),
                        attachedResources: [],
                      });
                      lastMessage = { role: 'user', content: userContent };
                    }
                  } else if (trimmedLine.startsWith('Assistant: ')) {
                    const assistantContent = trimmedLine.substring(11);
                    if (assistantContent) {
                      if (
                        lastMessage.role === 'assistant' &&
                        lastMessage.content === assistantContent
                      ) {
                        continue;
                      }
                      messages.push({
                        id: `msg-${Date.now()}-${Math.random()}`,
                        role: 'assistant',
                        content: assistantContent,
                        timestamp: new Date(data.timestamp || Date.now()),
                        attachedResources: [],
                      });
                      lastMessage = { role: 'assistant', content: assistantContent };
                    }
                  }
                }

                const lastUserMatch = content.match(/\n\nUser: (.+)$/);
                if (lastUserMatch) {
                  const finalUserContent = lastUserMatch[1];
                  if (lastMessage.role !== 'user' || lastMessage.content !== finalUserContent) {
                    messages.push({
                      id: data.uuid || `msg-${Date.now()}-${Math.random()}`,
                      role: 'user',
                      content: finalUserContent,
                      timestamp: new Date(data.timestamp || Date.now()),
                      attachedResources: [],
                    });
                  }
                }
                continue;
              }

              if (role === 'assistant' && !content && toolCalls.length === 0) {
                if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
                  const lastMessage = messages[messages.length - 1];

                  if (data.message?.usage) {
                    const usage = data.message.usage;
                    lastMessage.tokenUsage = {
                      inputTokens: usage.input_tokens || 0,
                      outputTokens: usage.output_tokens || 0,
                      cacheCreationInputTokens: usage.cache_creation_input_tokens,
                      cacheReadInputTokens: usage.cache_read_input_tokens,
                    };

                    if (data.message?.model) {
                      const model = data.message.model as string;
                      lastMessage.tokenUsage.totalCost = this.calculateTokenCost(usage, model);
                    }
                  }
                  continue;
                }
                continue;
              }

              if (role === 'assistant' && !content && toolCalls.length > 0) {
                content = '';
              }

              const message: ComputedMessage = {
                id: data.uuid || `msg-${Date.now()}-${Math.random()}`,
                role: role,
                content: content,
                timestamp: new Date(data.timestamp || Date.now()),
                attachedResources: [],
                ...(role === 'assistant' &&
                  toolCalls.length > 0 && { simplifiedToolCalls: toolCalls }),
                ...(role === 'assistant' && rawToolCalls.length > 0 && { toolCalls: rawToolCalls }),
                ...(messageTodos && { latestTodos: messageTodos }),
              };

              if (role === 'assistant' && data.message) {
                if (data.message.usage) {
                  const usage = data.message.usage;
                  message.tokenUsage = {
                    inputTokens: usage.input_tokens || 0,
                    outputTokens: usage.output_tokens || 0,
                    cacheCreationInputTokens: usage.cache_creation_input_tokens,
                    cacheReadInputTokens: usage.cache_read_input_tokens,
                  };

                  if (data.message.model) {
                    const model = data.message.model as string;
                    message.tokenUsage.totalCost = this.calculateTokenCost(usage, model);
                  }
                }

                if ('stop_reason' in data.message) {
                  message.stopReason = data.message.stop_reason;
                }

                if ('stop_sequence' in data.message) {
                  message.stopSequence = data.message.stop_sequence;
                }

                if (data.requestId) {
                  message.requestId = data.requestId;
                }
              }

              // Validate message structure (only in development)
              if (this.validateChatMessage(message)) {
                messages.push(message);
              }
            }
          } catch (e) {
            log.warn(`[ClaudeHandlers] Failed to parse line in JSONL file: ${e}`);
          }
        }

        // Log validation summary (only in development)
        if (isValidationEnabled()) {
          log.info('[ClaudeHandlers] Chat history loaded with validation', {
            totalMessages: messages.length,
            sessionId: actualSessionId,
          });
        }

        return { messages, sessionId: actualSessionId };
      },
      { operationName: 'Load chat history' }
    );

    // Agent: Update additional directories
    registerSafeHandler(
      'agents:updateAdditionalDirectories',
      async (
        _event: IpcMainInvokeEvent,
        worktreeId: string,
        agentId: string,
        directories: string[]
      ) => {
        await this.sessionManifest.updateAdditionalDirectories(worktreeId, agentId, directories);
        return { success: true };
      },
      { operationName: 'Update additional directories' }
    );

    // Agent: Get additional directories
    registerSafeHandler(
      'agents:getAdditionalDirectories',
      async (_event: IpcMainInvokeEvent, worktreeId: string, agentId: string) => {
        const directories = await this.sessionManifest.getAdditionalDirectories(
          worktreeId,
          agentId
        );
        return { success: true, directories };
      },
      { operationName: 'Get additional directories' }
    );

    // MCP: Authenticate server
    registerSafeHandler(
      'mcp:authenticate-server',
      async (_event: IpcMainInvokeEvent, serverName: string, projectPath: string) => {
        const mcpConfigPath = path.join(projectPath, '.mcp.json');
        if (!existsSync(mcpConfigPath)) {
          throw new Error('MCP configuration file not found');
        }

        const mcpConfigContent = readFileSync(mcpConfigPath, 'utf-8');
        const mcpConfig = JSON.parse(mcpConfigContent);

        const serverConfig = mcpConfig.mcpServers?.[serverName];
        if (!serverConfig) {
          throw new Error(`Server "${serverName}" not found in MCP configuration`);
        }

        const mcpServerConfig: McpServerConfig = serverConfig;
        const authResult = await this.mcpAuthService.captureAuthUrl(serverName, mcpServerConfig);

        if (authResult.error) {
          throw new Error(authResult.error);
        }

        if (authResult.authUrl) {
          await shell.openExternal(authResult.authUrl);
        }

        return { success: true };
      },
      { operationName: 'Authenticate MCP server' }
    );

    // Slash Commands: Load commands
    registerSafeHandler(
      IPC_CHANNELS.SLASH_COMMANDS_LOAD,
      async (_event: IpcMainInvokeEvent, projectPath?: string) => {
        const commands: SlashCommand[] = [];

        let baseDir: string = process.cwd();

        if (projectPath) {
          baseDir = projectPath;
        } else if (process.env.NODE_ENV === 'development') {
          let currentDir = path.resolve(__dirname, '../../../..');
          let foundClaudeDir = false;

          for (let i = 0; i < 5; i++) {
            const claudeCommandsPath = path.join(currentDir, '.claude', 'commands');
            try {
              await fs.access(claudeCommandsPath);
              baseDir = currentDir;
              foundClaudeDir = true;
              break;
            } catch {
              currentDir = path.join(currentDir, '..');
            }
          }

          if (!foundClaudeDir) {
            baseDir = process.cwd();
          }
        } else {
          baseDir = process.cwd();
        }

        if (baseDir.startsWith('~')) {
          baseDir = path.join(os.homedir(), baseDir.slice(1));
        }

        const localCommandsPath = path.join(baseDir, '.claude', 'commands');
        const localCommands = await this.loadCommandsFromDirectory(
          localCommandsPath,
          'local',
          localCommandsPath,
          ''
        );
        commands.push(...localCommands);

        const userCommandsPath = path.join(os.homedir(), '.claude', 'commands');
        const userCommands = await this.loadCommandsFromDirectory(
          userCommandsPath,
          'user',
          userCommandsPath,
          ''
        );
        commands.push(...userCommands);

        return commands;
      },
      { operationName: 'Load slash commands' }
    );
  }
}
