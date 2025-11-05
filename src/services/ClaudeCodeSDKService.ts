/**
 * Claude Code SDK service using @anthropic-ai/claude-agent-sdk
 * Replaces CLI-based implementation for better performance and reliability
 */

import type { ClaudeCodeMessage, ClaudeCodeQueryOptions } from '@/types/claudeCode.types';
import type { FileChangeMessage } from '@/types/fileChange.types';
import { extractFileChanges, isFileChangeMessage } from '@/types/fileChange.types';
import { getScopedMcpConfig } from '@/utils/scopedConfig';
import { Options, Query, SDKMessage, query } from '@anthropic-ai/claude-agent-sdk';
import Anthropic from '@anthropic-ai/sdk';
import log from 'electron-log';
import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class ClaudeCodeSDKService {
  private static instance: ClaudeCodeSDKService;
  private sessionMap: Map<string, string> = new Map(); // agentId -> claudeSessionId
  private activeQueries: Map<string, Query> = new Map(); // queryId -> Query
  private authCheckedSessions: Set<string> = new Set(); // Track sessions where auth has been checked
  private anthropicClient: Anthropic | null = null;

  private constructor() {
    log.debug('[SDK Service] Initialized');
  }

  static getInstance(): ClaudeCodeSDKService {
    if (!ClaudeCodeSDKService.instance) {
      ClaudeCodeSDKService.instance = new ClaudeCodeSDKService();
    }
    return ClaudeCodeSDKService.instance;
  }

  /**
   * Initialize a new Claude Code session
   * @param workingDirectory - Working directory for the session
   * @param model - Optional model to use for the session
   * @returns Promise<string> - Claude session ID
   */
  static async initializeSession(workingDirectory?: string, model?: string): Promise<string> {
    const service = ClaudeCodeSDKService.getInstance();
    const queryId = uuidv4();
    const sessionId = uuidv4();

    try {
      let actualSessionId: string | undefined;

      for await (const message of service.queryClaudeCode(queryId, {
        prompt: 'Session initialized. Ready to assist.',
        sessionId,
        options: {
          maxTurns: 1,
          cwd: workingDirectory || process.cwd(),
          ...(model && { model }), // Pass the model if provided
        },
      })) {
        if (message.type === 'system' && message.subtype === 'init' && message.session_id) {
          actualSessionId = message.session_id;
        }

        if (message.type === 'result' && message.subtype === 'success') {
          if (!actualSessionId && message.session_id) {
            actualSessionId = message.session_id;
          }
        }
      }

      if (!actualSessionId) {
        throw new Error('No session ID received from Claude Code SDK');
      }

      return actualSessionId;
    } catch (error) {
      log.error('[SDK Service] Failed to initialize session:', error);
      throw new Error(
        `Failed to initialize Claude Code session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Query Claude Code SDK and yield messages as they arrive
   * @param queryId - Unique identifier for this query
   * @param queryOptions - Query configuration including prompt, sessionId, attachments
   * @yields ClaudeCodeMessage - Messages in CLI-compatible format
   */
  async *queryClaudeCode(
    queryId: string,
    queryOptions: ClaudeCodeQueryOptions
  ): AsyncGenerator<ClaudeCodeMessage, void, unknown> {
    const { prompt, sessionId, attachments, options = {} } = queryOptions;

    // Handle file attachments
    let modifiedPrompt = prompt;
    let tempDir: string | undefined;

    try {
      if (attachments && attachments.length > 0) {
        // Create temporary directory for attachments
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-attachments-'));

        // Save attachments as files and build prompt
        const attachmentPaths: string[] = [];

        for (const attachment of attachments) {
          const filename =
            attachment.filename ||
            `attachment_${Date.now()}${this.getExtensionFromMimeType(attachment.media_type)}`;
          const filePath = path.join(tempDir, filename);

          // Decode base64 and save to file
          const buffer = Buffer.from(attachment.data, 'base64');
          await fs.writeFile(filePath, buffer);

          attachmentPaths.push(filePath);
        }

        // Modify prompt to reference attachments
        modifiedPrompt = `${prompt}\n\nAttached files:\n${attachmentPaths.map((p) => `- ${p}`).join('\n')}\n\nPlease use the Read tool to examine these files.`;

        // Ensure Read tool is allowed
        if (!options.allowedTools?.includes('Read')) {
          options.allowedTools = [...(options.allowedTools || []), 'Read'];
        }
      }

      // Convert slash command format from /command:subcommand to /command/subcommand
      modifiedPrompt = modifiedPrompt.replace(/^\/([a-zA-Z0-9]+):([a-zA-Z0-9]+)/, '/$1/$2');

      // Handle session resumption
      // IMPORTANT: Check options.resume FIRST (passed from renderer), then fall back to sessionMap
      let resumeSessionId: string | undefined;
      if (options.resume) {
        // Resume session ID explicitly passed from renderer (from loadChatHistory)
        resumeSessionId = options.resume;
      } else if (sessionId) {
        // Fall back to internal session map
        const claudeSessionId = this.sessionMap.get(sessionId);
        if (claudeSessionId) {
          resumeSessionId = claudeSessionId;
        }
      }

      // Load additional directories from session manifest
      let additionalDirectories: string[] = [];
      if (sessionId && options.cwd) {
        // Import SessionManifestService
        const { SessionManifestService } = await import('./SessionManifestService');
        const sessionManifestService = SessionManifestService.getInstance();

        // Get the worktree ID from options.cwd (extract folder name)
        const worktreeId = path.basename(options.cwd);
        if (worktreeId) {
          additionalDirectories = await sessionManifestService.getAdditionalDirectories(
            worktreeId,
            sessionId
          );
        }
      }

      // Load MCP servers from scoped configuration
      const scopedConfig = await getScopedMcpConfig({
        cwd: options.cwd || process.cwd(),
        debug: true, // Enable debug logging for manual testing
      });
      const mcpServers = scopedConfig.mcpServers;

      // Build SDK options
      // The SDK includes a bundled CLI at node_modules/@anthropic-ai/claude-agent-sdk/cli.js
      // In packaged apps, we need to use the unpacked path
      let cliPath = require.resolve('@anthropic-ai/claude-agent-sdk/cli.js');

      // If running in asar, replace with unpacked path
      if (cliPath.includes('.asar')) {
        cliPath = cliPath.replace(/\.asar([/\\])/, '.asar.unpacked$1');
        log.debug('[SDK Service] Using unpacked CLI path:', cliPath);
      }

      const sdkOptions: Options = {
        pathToClaudeCodeExecutable: cliPath,
        // IMPORTANT: settingSources controls which settings/commands are loaded
        // 'project' = load from {cwd}/.claude/commands/
        // 'local' = load from {cwd}/.claude/ (git-ignored local settings)
        // 'user' = load from ~/.claude/commands/
        settingSources: ['project', 'local', 'user'],
        // Set MCP timeout to 5 seconds (authenticated servers should connect quickly)
        env: {
          ...process.env,
          MCP_TIMEOUT: '5000',
        },
        // Add additionalDirectories if available
        ...(additionalDirectories.length > 0 && { additionalDirectories }),
        // Add MCP servers from scoped configuration if available
        ...(mcpServers && Object.keys(mcpServers).length > 0 && { mcpServers }),
      };

      if (resumeSessionId) {
        sdkOptions.resume = resumeSessionId;
      }

      if (options.permissionMode) {
        sdkOptions.permissionMode = options.permissionMode as any;
      }

      if (options.maxTurns !== null && options.maxTurns !== undefined) {
        sdkOptions.maxTurns = options.maxTurns;
      }

      if (options.systemPrompt) {
        sdkOptions.systemPrompt = options.systemPrompt;
      }

      if (options.allowedTools && options.allowedTools.length > 0) {
        sdkOptions.allowedTools = options.allowedTools;
      }

      // ALWAYS set the model from options if provided (app's selected model takes precedence)
      if (options.model) {
        sdkOptions.model = options.model;
        log.info('[SDK Service] Using model from app settings:', options.model);
      } else {
        log.info('[SDK Service] No model specified, will use Claude Code default settings');
      }

      // Set working directory if provided
      if (options.cwd) {
        const homedir = os.homedir();
        let cwd = options.cwd;
        if (cwd.startsWith('~')) {
          cwd = path.join(homedir, cwd.slice(1));
        }
        if (!path.isAbsolute(cwd)) {
          cwd = path.join(homedir, '.autosteer', 'worktrees', cwd);
        }

        const autosteerDir = path.join(homedir, '.autosteer');
        const worktreesDir = path.join(autosteerDir, 'worktrees');

        if (!existsSync(autosteerDir)) {
          await fs.mkdir(autosteerDir, { recursive: true });
        }
        if (!existsSync(worktreesDir)) {
          await fs.mkdir(worktreesDir, { recursive: true });
        }

        if (!existsSync(cwd)) {
          if (existsSync(worktreesDir)) {
            cwd = worktreesDir;
          } else {
            cwd = process.cwd();
          }
        }

        sdkOptions.cwd = cwd;
      }

      // Log the query details before sending
      log.info('[SDK Service] Sending query with configuration:', {
        model: sdkOptions.model || 'default',
        maxTurns: sdkOptions.maxTurns,
        permissionMode: sdkOptions.permissionMode,
        cwd: sdkOptions.cwd,
        hasSystemPrompt: !!sdkOptions.systemPrompt,
        hasAttachments: !!(attachments && attachments.length > 0),
        resumeSessionId: !!resumeSessionId,
      });

      // Start SDK query with correct format: {prompt, options}
      const result = query({
        prompt: modifiedPrompt,
        options: sdkOptions,
      });

      this.activeQueries.set(queryId, result);

      const actualSessionId = sessionId || uuidv4();

      try {
        // Yield messages as they arrive
        for await (const sdkMessage of result) {
          // Adapt SDK message to CLI-compatible format
          const cliMessage = this.adaptSDKMessageToCLI(sdkMessage, sessionId);

          // Store session mapping on init message
          if (
            cliMessage.type === 'system' &&
            cliMessage.subtype === 'init' &&
            sessionId &&
            cliMessage.session_id
          ) {
            this.sessionMap.set(sessionId, cliMessage.session_id);

            // Track MCP server authentication check (only once per session)
            const currentSessionId = cliMessage.session_id || '';
            if (!this.authCheckedSessions.has(currentSessionId)) {
              this.authCheckedSessions.add(currentSessionId);
            }
          }

          // Ensure session_id is set
          cliMessage.session_id = cliMessage.session_id || actualSessionId;

          // Parse file change messages
          const fileChangeMessage = this.parseFileChangeMessage(cliMessage);
          if (fileChangeMessage) {
            // Store the file change message in the original message
            (cliMessage as any).__fileChangeMessage = fileChangeMessage;
          }

          // Handle permission denials in result messages
          if (
            cliMessage.type === 'result' &&
            cliMessage.permission_denials &&
            Array.isArray(cliMessage.permission_denials) &&
            cliMessage.permission_denials.length > 0
          ) {
            // Process ALL permission denials (no filtering)
            // This handles: Edit, Write, Bash, WebFetch, WebSearch, AND all MCP tools
            const denial = cliMessage.permission_denials[0];

            // Determine description based on tool type
            let description: string;
            if (denial.tool_name === 'Bash') {
              description = (denial.tool_input.command as string) || 'command';
            } else if (denial.tool_name === 'WebFetch') {
              description = (denial.tool_input.url as string) || 'URL';
            } else if (denial.tool_name === 'WebSearch') {
              description = (denial.tool_input.query as string) || 'query';
            } else {
              // Edit/Write
              description = (denial.tool_input.file_path as string) || 'file';
            }

            const permissionRequest: any = {
              tool_name: denial.tool_name,
              tool_use_id: denial.tool_use_id,
              file_path: (denial.tool_input.file_path as string) || description,
              message: `Permission required to ${denial.tool_name.toLowerCase()} ${description}`,
            };

            // Add tool-specific parameters
            if (denial.tool_input.old_string) {
              permissionRequest.old_string = denial.tool_input.old_string;
            }
            if (denial.tool_input.new_string) {
              permissionRequest.new_string = denial.tool_input.new_string;
            }
            if (denial.tool_input.content) {
              permissionRequest.content = denial.tool_input.content;
            }
            if (denial.tool_input.command) {
              permissionRequest.command = denial.tool_input.command;
            }
            if (denial.tool_input.url) {
              permissionRequest.url = denial.tool_input.url;
            }
            if (denial.tool_input.query) {
              permissionRequest.query = denial.tool_input.query;
            }

            (cliMessage as any).__permissionRequest = permissionRequest;
          }

          yield cliMessage;
        }
      } catch (iterationError) {
        // Yield an error message before throwing
        const errorMessage =
          iterationError instanceof Error ? iterationError.message : String(iterationError);

        // Map common error messages to error types
        let errorType: 'api_error' | 'authentication_error' = 'api_error';
        if (
          errorMessage.includes('Invalid API key') ||
          errorMessage.includes('authentication') ||
          errorMessage.includes('Please run /login')
        ) {
          errorType = 'authentication_error';
        }

        yield {
          type: 'error',
          error: {
            type: errorType,
            message: errorMessage,
          },
          is_error: true,
          session_id: sessionId || actualSessionId,
        } as ClaudeCodeMessage;

        throw iterationError;
      } finally {
        this.activeQueries.delete(queryId);
      }
    } catch (error) {
      this.activeQueries.delete(queryId);

      if (tempDir) {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }

      throw error;
    } finally {
      if (tempDir) {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }

  /**
   * Abort an active query by queryId
   * @param queryId - Query to abort
   */
  abortQuery(queryId: string): void {
    const query = this.activeQueries.get(queryId);
    if (query) {
      query.interrupt();
      this.activeQueries.delete(queryId);
      log.debug('[SDK Service] Aborted query:', queryId);
    }
  }

  /**
   * Get Claude session ID for a given agent session ID
   * @param sessionId - Agent session ID
   * @returns string | undefined - Claude session ID if exists
   */
  getSessionId(sessionId: string): string | undefined {
    return this.sessionMap.get(sessionId);
  }

  /**
   * Clear all session mappings
   */
  clearSessions(): void {
    this.sessionMap.clear();
    log.debug('[SDK Service] Cleared all sessions');
  }

  /**
   * Clear specific session mapping
   * @param entryId - Agent session ID to clear
   */
  clearSessionForEntry(entryId: string): boolean {
    const hasSession = this.sessionMap.has(entryId);
    if (hasSession) {
      this.sessionMap.delete(entryId);
      log.debug('[SDK Service] Cleared session for entry:', entryId);
    }
    return hasSession;
  }

  /**
   * Set session mapping for an agent
   * @param agentId - Agent ID
   * @param claudeSessionId - Claude session ID
   */
  setSessionMapping(agentId: string, claudeSessionId: string): void {
    this.sessionMap.set(agentId, claudeSessionId);
  }

  /**
   * Initialize Anthropic client for token counting
   * @private
   */
  private initializeAnthropicClient(): void {
    if (!this.anthropicClient) {
      // Get API key from environment
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is not set');
      }
      this.anthropicClient = new Anthropic({ apiKey });
      log.debug('[SDK Service] Initialized Anthropic client for token counting');
    }
  }

  /**
   * Count tokens for a given model, system prompt, and messages
   * Uses Claude's token counting API endpoint
   * @param params - Token counting parameters
   * @returns Promise<number> - Estimated token count
   */
  async countTokens(params: {
    model: string;
    system?: string;
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>;
  }): Promise<{ input_tokens: number }> {
    this.initializeAnthropicClient();

    if (!this.anthropicClient) {
      throw new Error('Failed to initialize Anthropic client');
    }

    // Call the token counting endpoint
    // Only include system if it's defined (exactOptionalPropertyTypes requirement)
    const countParams: {
      model: string;
      system?: string;
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    } = {
      model: params.model,
      messages: params.messages,
    };

    if (params.system) {
      countParams.system = params.system;
    }

    const response = await this.anthropicClient.messages.countTokens(countParams);

    return response;
  }

  /**
   * Adapt SDK message format to CLI-compatible format
   * @param message - SDK message
   * @param sessionId - Agent session ID (optional)
   * @returns ClaudeCodeMessage - CLI-compatible message
   */
  private adaptSDKMessageToCLI(message: SDKMessage, sessionId?: string): ClaudeCodeMessage {
    // SDK messages come in various formats - we need to map them to CLI format
    const sdkMsg = message as any;

    // Determine message type and structure based on SDK message properties
    // Handle both old format (system/init) and new format (init)
    if (sdkMsg.type === 'init' || (sdkMsg.type === 'system' && sdkMsg.subtype === 'init')) {
      return {
        type: 'system',
        subtype: 'init',
        session_id: sdkMsg.session_id || sdkMsg.sessionId,
        cwd: sdkMsg.cwd,
        tools: sdkMsg.tools,
        mcp_servers: sdkMsg.mcp_servers,
        model: sdkMsg.model,
        permissionMode: sdkMsg.permissionMode,
        apiKeySource: sdkMsg.apiKeySource,
        slash_commands: sdkMsg.slash_commands || [],
        output_style: sdkMsg.output_style,
        agents: sdkMsg.agents,
      };
    }

    if (sdkMsg.type === 'message' || sdkMsg.event === 'message') {
      return {
        type: 'message',
        role: sdkMsg.role || 'assistant',
        content: sdkMsg.content || sdkMsg.text,
        message: sdkMsg.message,
        thinking: sdkMsg.thinking,
        session_id: sessionId || '',
      };
    }

    if (sdkMsg.type === 'tool_call' || sdkMsg.event === 'tool_use') {
      return {
        type: 'tool',
        subtype: 'call',
        content: sdkMsg.content || sdkMsg.tool_use,
        tool_calls: sdkMsg.tool_calls || [sdkMsg],
        session_id: sessionId || '',
      };
    }

    if (sdkMsg.type === 'tool_result' || sdkMsg.event === 'tool_result') {
      return {
        type: 'tool',
        subtype: 'result',
        content: sdkMsg.content || sdkMsg.result,
        tool_results: sdkMsg.tool_results || [sdkMsg],
        parent_tool_use_id: sdkMsg.parent_tool_use_id || sdkMsg.tool_use_id,
        result: sdkMsg.result,
        session_id: sessionId || '',
      };
    }

    if (sdkMsg.type === 'result' || sdkMsg.event === 'result') {
      const resultMessage: any = {
        type: 'result',
        subtype: sdkMsg.subtype || 'success',
        session_id: sdkMsg.session_id || sessionId,
        num_turns: sdkMsg.num_turns,
        duration_ms: sdkMsg.duration_ms,
        total_cost_usd: sdkMsg.total_cost_usd,
        usage: sdkMsg.usage,
        modelUsage: sdkMsg.modelUsage,
        server_tool_use: sdkMsg.server_tool_use,
        permission_denials: sdkMsg.permission_denials,
        result: sdkMsg.result,
        stop_reason: sdkMsg.stop_reason,
        stop_sequence: sdkMsg.stop_sequence,
        request_id: sdkMsg.request_id,
        is_error: sdkMsg.is_error,
      };

      // Parse error from result message if is_error is true
      if (sdkMsg.is_error && sdkMsg.result) {
        const errorText = sdkMsg.result.toLowerCase();
        let errorType: string = 'api_error';

        // Map error text to error types based on Claude documentation
        if (errorText.includes('invalid api key') || errorText.includes('please run /login')) {
          errorType = 'authentication_error';
        } else if (errorText.includes('rate limit')) {
          errorType = 'rate_limit_error';
        } else if (
          errorText.includes('overloaded') ||
          errorText.includes('temporarily overloaded')
        ) {
          errorType = 'overloaded_error';
        } else if (errorText.includes('permission')) {
          errorType = 'permission_error';
        } else if (errorText.includes('not found')) {
          errorType = 'not_found_error';
        } else if (errorText.includes('request too large') || errorText.includes('too large')) {
          errorType = 'request_too_large';
        } else if (errorText.includes('invalid request')) {
          errorType = 'invalid_request_error';
        } else if (sdkMsg.subtype === 'error_during_execution') {
          errorType = 'api_error';
        }

        resultMessage.error = {
          type: errorType,
          message: sdkMsg.result,
        };
      }

      return resultMessage;
    }

    if (sdkMsg.type === 'error' || sdkMsg.event === 'error') {
      return {
        type: 'error',
        error: sdkMsg.error || sdkMsg.message,
        is_error: true,
        session_id: sessionId || '',
      };
    }

    // Handle compact_boundary system message
    if (sdkMsg.type === 'system' && sdkMsg.subtype === 'compact_boundary') {
      return {
        type: 'system',
        subtype: 'compact_boundary',
        session_id: sdkMsg.session_id || sessionId || '',
        uuid: sdkMsg.uuid,
        compact_metadata: sdkMsg.compact_metadata,
      };
    }

    // Default fallback - pass through as-is
    return {
      type: sdkMsg.type || 'unknown',
      content: sdkMsg.content || sdkMsg.text,
      session_id: sessionId,
      ...sdkMsg,
    };
  }

  /**
   * Get file extension from MIME type for attachment handling
   * @param mimeType - MIME type string
   * @returns string - File extension (e.g., '.png')
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeMap: Record<string, string> = {
      // Images
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/bmp': '.bmp',
      'image/svg+xml': '.svg',
      // Documents
      'text/plain': '.txt',
      'text/markdown': '.md',
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      // Code
      'text/javascript': '.js',
      'application/x-typescript': '.ts',
      'text/x-python': '.py',
      'text/x-java': '.java',
      'text/html': '.html',
      'text/css': '.css',
      'application/json': '.json',
    };

    return mimeMap[mimeType] || '.bin';
  }

  /**
   * Parse file change message from Claude Code output
   */
  parseFileChangeMessage(message: string | ClaudeCodeMessage): FileChangeMessage | null {
    try {
      const parsedMessage = typeof message === 'string' ? JSON.parse(message) : message;

      if (isFileChangeMessage(parsedMessage)) {
        const fileChanges = extractFileChanges(parsedMessage);

        if (fileChanges && fileChanges.length > 0) {
          const fileChangeMessage: FileChangeMessage = {
            type: parsedMessage.type || 'file_change_request',
            fileChanges,
            sessionId: (parsedMessage as any).session_id || parsedMessage.sessionId || '',
            messageId:
              (parsedMessage as any).message_id ||
              parsedMessage.messageId ||
              (parsedMessage as any).id ||
              uuidv4(),
            timestamp: Date.now(),
            raw: parsedMessage,
          };

          return fileChangeMessage;
        }
      }

      return null;
    } catch (error) {
      log.debug('[SDK Service] Failed to parse file change message:', error);
      return null;
    }
  }
}
