import { Agent, AgentStatus, AgentType, ChatMessage } from '@/entities';
import { FileDataStoreService } from '@/services/FileDataStoreService';
import { MessageConverter } from '@/services/MessageConverter';
import { SessionManifestService } from '@/services/SessionManifestService';
import { AgentConfig } from '@/types/config.types';
import { IPC_CHANNELS } from '@/types/ipc.types';
import { MAX_TABS } from '@/constants/tabs';
import { IpcMainInvokeEvent, ipcMain } from 'electron';
import log from 'electron-log';
import { createReadStream } from 'fs';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';
import { v4 as uuidv4 } from 'uuid';

/**
 * Model pricing data (cost per 1M tokens)
 * Used to calculate token costs for various Claude models
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-5-sonnet-20240620': { input: 3.0, output: 15.0 },
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
  'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-3-5-haiku-20241022': { input: 1.0, output: 5.0 },
  // Claude 4 models
  'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
  'claude-opus-4-1-20250805': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
};

/**
 * AgentHandlers class
 * Handles all IPC communication for agent-related operations including CRUD operations,
 * session management, and chat history loading from Claude Code JSONL files.
 *
 * @remarks
 * This handler implements multi-agent session support, allowing up to 5 concurrent
 * Claude Code sessions per worktree with isolated contexts.
 *
 * Key responsibilities:
 * - Agent lifecycle management (create, read, update, delete)
 * - Session-to-agent mapping via SessionManifestService
 * - Chat history parsing from ~/.claude/projects/ JSONL files
 * - Token usage calculation and cost tracking
 * - Additional directory management for agents
 *
 * @example
 * ```typescript
 * const handlers = new AgentHandlers();
 * handlers.registerHandlers();
 * ```
 */
export class AgentHandlers {
  private fileDataStore: FileDataStoreService;
  private sessionManifest: SessionManifestService;

  constructor() {
    this.fileDataStore = FileDataStoreService.getInstance();
    this.sessionManifest = SessionManifestService.getInstance();
  }

  /**
   * Calculate token cost based on usage and model pricing
   * @param usage - Token usage object from Claude API response
   * @param model - Claude model identifier
   * @returns Total cost in USD (rounded to 6 decimal places)
   * @private
   *
   * @example
   * ```typescript
   * const cost = this.calculateTokenCost(
   *   { input_tokens: 1000, output_tokens: 500 },
   *   'claude-3-5-sonnet-20241022'
   * );
   * // Returns: 0.0105 (1000/1M * 3.0 + 500/1M * 15.0)
   * ```
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
   * Register all IPC handlers for agent operations
   * Sets up listeners for agent CRUD operations, session management, and chat history loading
   *
   * @remarks
   * Registered IPC channels:
   * - AGENTS_LOAD_ALL: Load all agents from config.json
   * - AGENTS_LOAD_BY_PROJECT: Load agents for a specific project/worktree
   * - AGENTS_CREATE: Create a new agent (max 5 per worktree)
   * - AGENTS_UPDATE: Update existing agent properties
   * - AGENTS_DELETE: Delete agent and clean up sessions
   * - AGENTS_UPDATE_SESSION: Map agent to Claude Code session
   * - AGENTS_SEARCH: Search agents by query string
   * - AGENTS_LOAD_CHAT_HISTORY: Load chat history from JSONL files
   * - agents:updateAdditionalDirectories: Update additional directories for agent
   * - agents:getAdditionalDirectories: Get additional directories for agent
   *
   * @public
   */
  registerHandlers(): void {
    // Load all agents
    ipcMain.handle(IPC_CHANNELS.AGENTS_LOAD_ALL, async () => {
      try {
        // Load agents from config.json
        const agentConfigs = await this.fileDataStore.getAgents();
        const agents = agentConfigs.map(this.convertConfigToAgent);

        log.info(`Loaded ${agents.length} agents`);
        return agents;
      } catch (error) {
        log.error('Failed to load agents:', error);
        throw error;
      }
    });

    // Load agents by project
    ipcMain.handle(
      IPC_CHANNELS.AGENTS_LOAD_BY_PROJECT,
      async (_event: IpcMainInvokeEvent, projectId: string) => {
        try {
          // Load agents for specific project
          const agentConfigs = await this.fileDataStore.getAgentsByProjectId(projectId);
          const agents = agentConfigs.map(this.convertConfigToAgent);

          log.info(`Loaded ${agents.length} agents for project ${projectId}`);
          return agents;
        } catch (error) {
          log.error('Failed to load agents by project:', error);
          throw error;
        }
      }
    );

    // Create agent
    ipcMain.handle(
      IPC_CHANNELS.AGENTS_CREATE,
      async (_event: IpcMainInvokeEvent, data: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) => {
        try {
          const agentData = { ...data };

          if (agentData.projectId) {
            const existingAgents = await this.fileDataStore.getAgentsByProjectId(
              agentData.projectId
            );
            if (existingAgents.length >= MAX_TABS) {
              throw new Error(
                `Maximum tab limit reached. Each worktree can have up to ${MAX_TABS} tabs.`
              );
            }

            // Don't override the title if one is already provided
            // The frontend now handles session name generation
          }

          // Generate a temporary UUID for the agent
          // The actual Claude session will be created on first message
          const agentId = uuidv4();

          const newAgent: Agent = {
            ...agentData,
            id: agentId,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          // Convert to config format and save
          const agentConfig = this.convertAgentToConfig(newAgent);
          await this.fileDataStore.addAgent(agentConfig);

          log.info(`Created new agent with ID: ${newAgent.id}, title: ${newAgent.title}`);
          return newAgent;
        } catch (error) {
          log.error('Failed to create agent:', error);
          throw error;
        }
      }
    );

    // Update agent
    ipcMain.handle(
      IPC_CHANNELS.AGENTS_UPDATE,
      async (_event: IpcMainInvokeEvent, id: string, updates: Partial<Agent>) => {
        try {
          // Extract claude_session_id from metadata if present
          let claude_session_id: string | undefined;
          if (
            updates.metadata &&
            typeof updates.metadata === 'object' &&
            'claude_session_id' in updates.metadata
          ) {
            claude_session_id = (updates.metadata as any).claude_session_id;
          }

          // Update in config.json
          await this.fileDataStore.updateAgent(id, {
            ...updates,
            ...(claude_session_id && { claude_session_id }),
            updated_at: new Date().toISOString(),
          });

          log.info(`Updated agent ${id}`);
        } catch (error) {
          log.error('Failed to update agent:', error);
          throw error;
        }
      }
    );

    // Delete agent
    ipcMain.handle(IPC_CHANNELS.AGENTS_DELETE, async (_event: IpcMainInvokeEvent, id: string) => {
      try {
        // Get the agent to find its worktree
        const agent = await this.fileDataStore.getAgent(id);
        if (agent) {
          // Clean up session manifest entry
          await this.sessionManifest.deleteAgentSessions(agent.project_id, id);
        }

        // Delete from config.json
        await this.fileDataStore.deleteAgent(id);

        log.info(`Deleted agent ${id}`);
      } catch (error) {
        log.error('Failed to delete session:', error);
        throw error;
      }
    });

    // Update agent session in manifest
    ipcMain.handle(
      IPC_CHANNELS.AGENTS_UPDATE_SESSION,
      async (
        _event: IpcMainInvokeEvent,
        worktreeId: string,
        agentId: string,
        sessionId: string
      ) => {
        try {
          await this.sessionManifest.updateAgentSession(worktreeId, agentId, sessionId);
          return { success: true };
        } catch (error) {
          log.error('Failed to update agent session:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update session',
          };
        }
      }
    );

    // Search agents
    ipcMain.handle(
      IPC_CHANNELS.AGENTS_SEARCH,
      async (_event: IpcMainInvokeEvent, query: string) => {
        try {
          // Search in config.json
          const agentConfigs = await this.fileDataStore.searchAgents(query);
          const results = agentConfigs.map(this.convertConfigToAgent);

          log.info(`Search found ${results.length} agents for query: ${query}`);
          return results;
        } catch (error) {
          log.error('Failed to search agents:', error);
          throw error;
        }
      }
    );

    // Load chat history from JSONL files
    ipcMain.handle(
      IPC_CHANNELS.AGENTS_LOAD_CHAT_HISTORY,
      async (_event: IpcMainInvokeEvent, agentId: string) => {
        try {
          // Get the agent to find its project path
          const agent = await this.fileDataStore.getAgent(agentId);
          if (!agent || !agent.project_id) {
            log.info(`No agent found or no project_id for agent ${agentId}`);
            return { messages: [], sessionId: null };
          }

          // Get the worktree for this project
          const worktrees = await this.fileDataStore.getWorktrees();
          const worktree = worktrees.find((w) => w.folder_name === agent.project_id);
          if (!worktree) {
            log.info(`No worktree found for project ${agent.project_id}`);
            return { messages: [], sessionId: null };
          }

          // Construct the Claude projects directory
          const homedir = os.homedir();
          const homedirFormatted = homedir.substring(1).replace(/[^a-zA-Z0-9]/g, '-');
          const projectDirName = `-${homedirFormatted}--autosteer-worktrees-${worktree.folder_name}`;
          const claudeProjectsDir = path.join(homedir, '.claude', 'projects', projectDirName);

          // Use SessionManifestService to get the correct session for this agent
          let jsonlFilePath: string;
          let actualSessionId: string | undefined;

          try {
            // Get the session ID from the manifest
            actualSessionId = await this.sessionManifest.getAgentSession(
              worktree.folder_name,
              agentId
            );

            log.info(
              `Session manifest lookup for agent ${agentId} in worktree ${worktree.folder_name}: ${actualSessionId}`
            );

            if (!actualSessionId) {
              // No session recorded yet - this is a new agent or first run
              log.info(`No session found in manifest for agent ${agentId}`);
              return { messages: [], sessionId: null };
            }

            // Build the path to the specific JSONL file
            jsonlFilePath = path.join(claudeProjectsDir, `${actualSessionId}.jsonl`);

            // Verify the file exists
            try {
              await fs.access(jsonlFilePath);
            } catch {
              log.warn(
                `JSONL file not found for session ${actualSessionId}, may have been deleted`
              );
              return { messages: [], sessionId: null };
            }
          } catch (err) {
            log.error(`Failed to read Claude projects directory: ${err}`);
            return { messages: [], sessionId: null };
          }

          // Read and parse the JSONL file
          const messages: ChatMessage[] = [];

          // Track pending permission requests by tool_use_id
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

          const fileStream = createReadStream(jsonlFilePath);
          const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity,
          });

          for await (const line of rl) {
            if (!line.trim()) continue;

            try {
              const data = JSON.parse(line);

              // Skip system init messages
              if (data.type === 'system' && data.subtype === 'init') {
                continue;
              }

              // Skip compact summary messages - these are internal context continuations
              if (data.isCompactSummary === true || data.isVisibleInTranscriptOnly === true) {
                continue;
              }

              // Skip compact command messages - we show compact_boundary instead
              if (
                data.message?.content &&
                typeof data.message.content === 'string' &&
                (data.message.content.includes('<command-name>/compact</command-name>') ||
                  data.message.content.includes('<local-command-stdout>Compacted '))
              ) {
                continue;
              }

              // Handle compact_boundary system messages - convert to assistant message
              if (data.type === 'system' && data.subtype === 'compact_boundary') {
                // Check both camelCase and snake_case
                const metadata = data.compactMetadata || data.compact_metadata;
                if (metadata) {
                  const compactText = `Compaction completed\n\nPre-compaction tokens: ${metadata.preTokens || metadata.pre_tokens}\n\nTrigger: ${metadata.trigger}`;
                  messages.push({
                    id: data.uuid || `compact-${Date.now()}`,
                    role: 'assistant',
                    content: compactText,
                    timestamp: new Date(data.timestamp || Date.now()),
                    attachedResources: [],
                    // Set a flag to indicate this is a compaction event that should reset context
                    isCompactionReset: true,
                  });
                }
                continue;
              }

              // Skip sidechain messages (subagent conversations)
              if (data.isSidechain === true) {
                continue;
              }

              // Process user and assistant messages
              if (
                data.type === 'user' ||
                data.type === 'assistant' ||
                data.role === 'user' ||
                data.role === 'assistant'
              ) {
                let content = '';
                let role: 'user' | 'assistant' = 'user';

                // Determine role - prioritize message.role over type
                if (data.message?.role === 'assistant' || data.type === 'assistant') {
                  role = 'assistant';
                } else if (data.message?.role === 'user' || data.type === 'user') {
                  role = 'user';
                }

                // Extract content and tool calls from various formats
                let toolCalls: any[] = [];

                if (data.content) {
                  // Direct content field
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

                        // Track Edit/Write tool uses that may require permissions
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
                  // Message.content field
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

                        // Track Edit/Write tool uses that may require permissions
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
                      // Skip "thinking" blocks - they don't contain visible content
                    });
                    content = textParts.join('\n');
                  }
                }

                // Handle tool results from user messages
                // Also detect permission denials and successful file changes
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

                        // Check for permission denial
                        if (
                          item.is_error &&
                          typeof item.content === 'string' &&
                          item.content.includes('Claude requested permissions')
                        ) {
                          hasPermissionDenial = true;
                        }

                        // Check for successful Edit/Write result with toolUseResult
                        if (
                          data.toolUseResult &&
                          item.tool_use_id &&
                          pendingPermissions.has(item.tool_use_id)
                        ) {
                          const permissionInfo = pendingPermissions.get(item.tool_use_id)!;

                          // Create a separate assistant message showing the accepted change
                          const permissionActionMessage: ChatMessage = {
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

                          // Clear the pending permission
                          pendingPermissions.delete(item.tool_use_id);
                        }
                      }
                    });
                  } else if (data.content && Array.isArray(data.content)) {
                    data.content.forEach((item: any) => {
                      if (item.type === 'tool_result') {
                        toolCalls.push({
                          type: 'tool_result',
                          tool_use_id: item.tool_use_id,
                          content: item.content,
                        });

                        // Check for permission denial
                        if (
                          item.is_error &&
                          typeof item.content === 'string' &&
                          item.content.includes('Claude requested permissions')
                        ) {
                          hasPermissionDenial = true;
                        }

                        // Check for successful Edit/Write result with toolUseResult
                        if (
                          data.toolUseResult &&
                          item.tool_use_id &&
                          pendingPermissions.has(item.tool_use_id)
                        ) {
                          const permissionInfo = pendingPermissions.get(item.tool_use_id)!;

                          // Create a separate assistant message showing the accepted change
                          const permissionActionMessage: ChatMessage = {
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

                          // Clear the pending permission
                          pendingPermissions.delete(item.tool_use_id);
                        }
                      }
                    });
                  }

                  // Skip this message entirely if it's a permission denial
                  if (hasPermissionDenial) {
                    continue;
                  }
                }

                // Skip system reminders
                if (content && content.includes('Caveat: The messages below were generated')) {
                  continue;
                }

                // Skip user messages that are actually just tool results
                if (
                  role === 'user' &&
                  !content &&
                  data.message?.content?.[0]?.type === 'tool_result'
                ) {
                  continue;
                }

                // Skip empty user messages (these are tool results, not real user input)
                if (role === 'user' && !content) {
                  continue;
                }

                // Keep raw tool calls before processing
                let rawToolCalls: any[] = [];

                // Track if this message has a TodoWrite tool call
                let messageTodos: any[] | undefined;

                // For assistant messages with tool calls, process them for simplified display
                if (role === 'assistant' && toolCalls.length > 0) {
                  // Keep a copy of raw tool calls for TodoActivityMonitor
                  rawToolCalls = [...toolCalls];

                  // Check for TodoWrite tool calls before filtering
                  for (const tc of toolCalls) {
                    if (tc.type === 'tool_use' && tc.name === 'TodoWrite' && tc.input?.todos) {
                      messageTodos = tc.input.todos;
                      break;
                    }
                  }

                  // Extract just the names for simplified display
                  // Use MessageConverter for consistent tool description formatting across the app
                  const simplifiedToolCalls = toolCalls
                    .filter((tc) => tc.type === 'tool_use')
                    .map((tc) => {
                      // Skip TodoWrite from tool calls display
                      if (tc.name === 'TodoWrite') {
                        return null;
                      }

                      const description = MessageConverter.formatToolDescription(tc.name, tc.input);

                      return {
                        type: 'tool_use' as const,
                        name: tc.name,
                        ...(description && { description }),
                      };
                    })
                    .filter((tc): tc is NonNullable<typeof tc> => tc !== null); // Remove null entries (TodoWrite)

                  // If there's no content, check if we can merge with previous assistant message
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

                    // Also preserve raw tool calls when merging
                    if (!lastMessage.toolCalls) {
                      lastMessage.toolCalls = [];
                    }
                    lastMessage.toolCalls.push(...rawToolCalls);

                    // Also merge the todos if present
                    if (messageTodos) {
                      lastMessage.latestTodos = messageTodos;
                    }

                    continue;
                  }

                  // Store simplified tool calls separately
                  toolCalls = simplifiedToolCalls;
                }

                // Check if this is a "Previous Conversation" message that needs parsing
                if (content.startsWith('Previous Conversation:')) {
                  // Parse the conversation history
                  const lines = content.split('\n').slice(1); // Skip the "Previous Conversation:" line
                  let lastMessage = { role: '', content: '' };

                  for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) continue;

                    if (trimmedLine.startsWith('User: ')) {
                      const userContent = trimmedLine.substring(6);
                      if (userContent && !userContent.includes('Session initialized')) {
                        // Check for duplicate messages
                        if (lastMessage.role === 'user' && lastMessage.content === userContent) {
                          continue; // Skip duplicate
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
                        // Check for duplicate messages
                        if (
                          lastMessage.role === 'assistant' &&
                          lastMessage.content === assistantContent
                        ) {
                          continue; // Skip duplicate
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

                  // Now add the actual user message (the part after "User: " at the end)
                  const lastUserMatch = content.match(/\n\nUser: (.+)$/);
                  if (lastUserMatch) {
                    const finalUserContent = lastUserMatch[1];
                    // Only add if it's not a duplicate of the last message
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

                // For assistant messages without content and without tool calls, skip them entirely
                // or merge with previous assistant message if it has the same message ID
                if (role === 'assistant' && !content && toolCalls.length === 0) {
                  // Check if we should merge with previous assistant message
                  if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
                    const lastMessage = messages[messages.length - 1];

                    // If this message has the same ID (from data.message?.id), merge token usage
                    if (data.message?.usage) {
                      // Update token usage on the previous message
                      const usage = data.message.usage;
                      lastMessage.tokenUsage = {
                        inputTokens: usage.input_tokens || 0,
                        outputTokens: usage.output_tokens || 0,
                        cacheCreationInputTokens: usage.cache_creation_input_tokens,
                        cacheReadInputTokens: usage.cache_read_input_tokens,
                      };

                      // Calculate cost if we have a model
                      if (data.message?.model) {
                        const model = data.message.model as string;
                        lastMessage.tokenUsage.totalCost = this.calculateTokenCost(usage, model);
                      }
                    }
                    continue; // Skip adding this as a separate message
                  }
                  // Otherwise skip entirely if it's an orphaned empty assistant message
                  continue;
                }

                // For assistant messages with only tool calls and no content,
                // set a placeholder content to ensure the message is displayed
                if (role === 'assistant' && !content && toolCalls.length > 0) {
                  content = ''; // Empty content is fine, the tool calls will be displayed
                }

                const message: ChatMessage = {
                  id: data.uuid || `msg-${Date.now()}-${Math.random()}`,
                  role: role,
                  content: content,
                  timestamp: new Date(data.timestamp || Date.now()),
                  attachedResources: [],
                  ...(role === 'assistant' &&
                    toolCalls.length > 0 && { simplifiedToolCalls: toolCalls }),
                  ...(role === 'assistant' &&
                    rawToolCalls.length > 0 && { toolCalls: rawToolCalls }),
                  ...(messageTodos && { latestTodos: messageTodos }),
                };

                // Add token usage and metadata if available (for assistant messages)
                if (role === 'assistant' && data.message) {
                  // Extract token usage
                  if (data.message.usage) {
                    const usage = data.message.usage;
                    message.tokenUsage = {
                      inputTokens: usage.input_tokens || 0,
                      outputTokens: usage.output_tokens || 0,
                      cacheCreationInputTokens: usage.cache_creation_input_tokens,
                      cacheReadInputTokens: usage.cache_read_input_tokens,
                    };

                    // Calculate cost if we have a model
                    if (data.message.model) {
                      const model = data.message.model as string;
                      message.tokenUsage.totalCost = this.calculateTokenCost(usage, model);
                    }
                  }

                  // Extract stop_reason (critical for detecting incomplete sessions)
                  if ('stop_reason' in data.message) {
                    message.stopReason = data.message.stop_reason;
                  }

                  // Extract stop_sequence
                  if ('stop_sequence' in data.message) {
                    message.stopSequence = data.message.stop_sequence;
                  }

                  // Extract request_id
                  if (data.requestId) {
                    message.requestId = data.requestId;
                  }
                }

                messages.push(message);
              }
            } catch (e) {
              log.warn(`Failed to parse line in JSONL file: ${e}`);
            }
          }

          return { messages, sessionId: actualSessionId };
        } catch (error) {
          log.error('Failed to load chat history:', error);
          throw error;
        }
      }
    );

    // Update additional directories for an agent
    ipcMain.handle(
      'agents:updateAdditionalDirectories',
      async (
        _event: IpcMainInvokeEvent,
        worktreeId: string,
        agentId: string,
        directories: string[]
      ) => {
        try {
          await this.sessionManifest.updateAdditionalDirectories(worktreeId, agentId, directories);
          return { success: true };
        } catch (error) {
          log.error('Failed to update additional directories:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }
    );

    // Get additional directories for an agent
    ipcMain.handle(
      'agents:getAdditionalDirectories',
      async (_event: IpcMainInvokeEvent, worktreeId: string, agentId: string) => {
        try {
          const directories = await this.sessionManifest.getAdditionalDirectories(
            worktreeId,
            agentId
          );
          return { success: true, directories };
        } catch (error) {
          log.error('Failed to get additional directories:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            directories: [],
          };
        }
      }
    );
  }

  /**
   * Convert AgentConfig (stored format) to Agent (runtime format)
   * @param config - Agent configuration from config.json
   * @returns Agent entity object
   * @private
   *
   * @remarks
   * Performs data transformation:
   * - Converts ISO date strings to Date objects
   * - Maps snake_case properties to camelCase
   * - Parses chat history if present
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
   * @param agent - Agent entity object
   * @returns Agent configuration for config.json
   * @private
   *
   * @remarks
   * Performs data transformation:
   * - Converts Date objects to ISO date strings
   * - Maps camelCase properties to snake_case
   * - Serializes chat history if present
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
      config.chat_history = agent.chatHistory.map((msg: ChatMessage) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        ...(msg.attachedResources && { attachedResources: msg.attachedResources }),
      }));
    }

    return config;
  }
}
