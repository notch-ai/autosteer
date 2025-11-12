/**
 * Claude Code CLI Service
 *
 * Direct interface to the Claude Code CLI for executing AI-powered coding tasks.
 * Handles process spawning, streaming output parsing, session management, and
 * permission request handling.
 *
 * @remarks
 * This service replaces the TypeScript SDK to avoid spawn issues in Electron's
 * main process. It communicates with the Claude Code CLI via stdio streams and
 * parses JSON-formatted streaming responses.
 *
 * Key features:
 * - Session persistence and resumption
 * - Streaming output with real-time message parsing
 * - Permission request detection and handling
 * - File change detection and notification
 * - Multi-session support with agent-to-session mapping
 * - Attachment handling via temporary files
 *
 * @example
 * ```typescript
 * const service = ClaudeCodeCLIService.getInstance();
 * const queryId = uuidv4();
 *
 * for await (const message of service.queryClaudeCode(queryId, {
 *   prompt: 'Implement feature X',
 *   sessionId: agentId,
 *   options: { cwd: '/path/to/project' }
 * })) {
 *   console.log('Message:', message);
 * }
 * ```
 */

import { ChildProcessWithoutNullStreams, execSync, spawn } from 'child_process';
import log from 'electron-log';
import fixPath from 'fix-path';
import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/commons/utils/logger';
import type { FileChangeMessage, FileChange, FileChangeDebugInfo } from '@/types/fileChange.types';
import { isFileChangeMessage, extractFileChanges } from '@/types/fileChange.types';

/**
 * File attachment for Claude Code queries
 * Supports images, documents, code files, and other file types
 */
export interface Attachment {
  /** Type classification of the attachment */
  type: 'image' | 'document' | 'code' | 'other';
  /** MIME type of the attachment */
  media_type: string;
  /** Base64-encoded file data */
  data: string;
  /** Optional filename for the attachment */
  filename?: string;
}

/**
 * Options for Claude Code query execution
 */
export interface ClaudeCodeQueryOptions {
  /** The prompt/instruction to send to Claude Code */
  prompt: string;
  /** Optional Anthropic API key (if not using default) */
  apiKey?: string;
  /** Session ID for resuming conversations (maps to agent ID) */
  sessionId?: string;
  /** File attachments to include with the query */
  attachments?: Attachment[];
  /** Additional execution options */
  options?: {
    /** Maximum number of turns for the conversation */
    maxTurns?: number;
    /** Custom system prompt to override default */
    systemPrompt?: string;
    /** Whitelist of allowed Claude Code tools */
    allowedTools?: string[];
    /** Claude model to use (e.g., 'claude-sonnet-4-5-20250929') */
    model?: string;
    /** Working directory for the Claude Code session */
    cwd?: string;
    /** Maximum thinking tokens for extended thinking mode */
    maxThinkingTokens?: number;
    /** Permission mode: 'ask', 'bypassPermissions', or 'readOnly' */
    permissionMode?: string;
    /** Resume token for continuing a session */
    resume?: string;
  };
}

// Anthropic message format (nested in assistant messages)
export interface AnthropicMessage {
  id: string;
  type: 'message';
  role: 'user' | 'assistant' | 'system';
  model: string;
  content: Array<{
    type: 'text' | 'tool_use' | 'tool_result';
    text?: string;
    tool_use?: {
      id: string;
      name: string;
      input: Record<string, unknown>;
    };
    tool_result?: unknown;
  }>;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    output_tokens: number;
    service_tier?: string;
  };
}

// MCP Server info
export interface MCPServer {
  name: string;
  status: string;
}

export interface PermissionRequest {
  tool_name: string;
  tool_use_id: string;
  file_path: string;
  old_string?: string;
  new_string?: string;
  content?: string;
  command?: string;
  url?: string;
  query?: string;
  message: string;
}

export interface PermissionDenial {
  tool_name: string;
  tool_use_id: string;
  tool_input: {
    file_path: string;
    old_string?: string;
    new_string?: string;
    content?: string;
    [key: string]: unknown;
  };
}

export interface ClaudeCodeMessage {
  type: string;
  subtype?: string;
  role?: 'user' | 'assistant' | 'system';
  content?: string | Record<string, unknown>;
  session_id?: string;
  message?: string | Record<string, unknown> | AnthropicMessage;
  duration_ms?: number;
  is_error?: boolean;
  total_cost_usd?: number;
  thinking?: string;
  tool_calls?: any[];
  tool_results?: any[];
  error?: string | Record<string, unknown>;
  status?: string;
  metadata?: Record<string, unknown>;
  parent_tool_use_id?: string | null;
  result?: string;
  usage?: Record<string, unknown>;
  // Init message specific fields
  cwd?: string;
  tools?: string[];
  mcp_servers?: MCPServer[];
  model?: string;
  permissionMode?: string;
  apiKeySource?: string;
  // Result message specific fields
  num_turns?: number;
  server_tool_use?: {
    web_search_requests: number;
  };
  permission_denials?: PermissionDenial[];
  // Permission request field
  __permissionRequest?: PermissionRequest;
}

export class ClaudeCodeCLIService {
  private static instance: ClaudeCodeCLIService;
  private sessionMap: Map<string, string> = new Map();
  private activeProcesses: Map<string, ChildProcessWithoutNullStreams> = new Map();
  private claudePath: string | null = null;

  constructor() {
    // Only call fixPath in non-test environments
    if (typeof fixPath === 'function') {
      fixPath();
    }
  }

  static getInstance(): ClaudeCodeCLIService {
    if (!ClaudeCodeCLIService.instance) {
      ClaudeCodeCLIService.instance = new ClaudeCodeCLIService();
    }
    return ClaudeCodeCLIService.instance;
  }

  private findClaudeExecutable(): string {
    if (this.claudePath) {
      return this.claudePath;
    }

    try {
      const whichCommand = process.platform === 'win32' ? 'where claude' : 'which claude';
      execSync(whichCommand, { encoding: 'utf8' }).trim();
      this.claudePath = 'claude';
      return this.claudePath;
    } catch (error) {
      log.error(
        '[Claude Code] Claude executable not found. Please install: npm install -g @anthropic-ai/claude-code'
      );
      return 'claude';
    }
  }

  /**
   * Initialize a new Claude Code session
   *
   * Creates a new Claude Code session by spawning the CLI with a minimal initialization
   * prompt. Returns the session ID that can be used to resume the session later.
   *
   * @param workingDirectory - Optional working directory for the session
   * @returns Promise resolving to the Claude Code session ID
   * @throws Error if Claude Code CLI is not installed or session creation fails
   *
   * @example
   * ```typescript
   * const sessionId = await ClaudeCodeCLIService.initializeSession('/path/to/project');
   * console.log('Session created:', sessionId);
   * ```
   */
  static async initializeSession(workingDirectory?: string): Promise<string> {
    const service = ClaudeCodeCLIService.getInstance();

    const claudeExe = service.findClaudeExecutable();
    try {
      execSync(`${claudeExe} --version`, { encoding: 'utf8' });
    } catch (error) {
      throw new Error(
        'Claude Code CLI is not installed or not in PATH. Please install: npm install -g @anthropic-ai/claude-code'
      );
    }
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
        throw new Error('No session ID received from Claude Code');
      }

      return actualSessionId;
    } catch (error) {
      log.error('[Claude Code] Failed to initialize session:', error);
      throw new Error(
        `Failed to initialize Claude Code session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Query Claude Code CLI and stream responses
   *
   * Spawns the Claude Code CLI process and yields parsed messages as they arrive.
   * Supports session resumption, file attachments, permission requests, and more.
   *
   * @param queryId - Unique identifier for this query (used for abort tracking)
   * @param queryOptions - Query configuration including prompt, session, and options
   * @yields ClaudeCodeMessage objects as they are parsed from CLI output
   *
   * @remarks
   * This is an async generator that streams messages in real-time:
   * - system/init: Session initialization with metadata
   * - user/assistant: Conversation messages
   * - result: Final result with usage statistics
   * - Permission requests are detected and marked with __permissionRequest
   * - File changes are detected and marked with __fileChangeMessage
   *
   * @example
   * ```typescript
   * const queryId = uuidv4();
   * for await (const message of service.queryClaudeCode(queryId, {
   *   prompt: 'Fix the bug in auth.ts',
   *   sessionId: agentId,
   *   options: { cwd: '/project/path' }
   * })) {
   *   if (message.type === 'assistant') {
   *     console.log('Assistant:', message.content);
   *   }
   * }
   * ```
   */
  async *queryClaudeCode(
    queryId: string,
    queryOptions: ClaudeCodeQueryOptions
  ): AsyncGenerator<ClaudeCodeMessage, void, unknown> {
    const { prompt, sessionId, attachments, options = {} } = queryOptions;

    logger.debug('[DEBUG queryClaudeCode] Starting with:', {
      queryId,
      sessionId,
      promptLength: prompt.length,
      hasAttachments: !!attachments?.length,
      options,
    });

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
      // This handles the case where modifiedPrompt.stripped is in the format "/[alpha-numeric]:[alpha-numeric]"
      modifiedPrompt = modifiedPrompt.replace(/^\/([a-zA-Z0-9]+):([a-zA-Z0-9]+)/, '/$1/$2');

      // Handle session resumption
      // If we have a sessionId (which is actually the agent ID), use it for resumption
      if (sessionId) {
        // Check if we have a Claude session ID mapped to this agent ID
        const claudeSessionId = this.sessionMap.get(sessionId);
        if (claudeSessionId) {
          logger.debug(
            `[DEBUG queryClaudeCode] Setting CLI : session ID ${sessionId} with Claude session ID ${claudeSessionId}`
          );
          // Resume existing session
          options.resume = claudeSessionId;
        }
        // If no mapping exists yet, Claude will create a new session
        // and we'll capture it in the init message
      }

      // Build command arguments
      const args = ['--print', modifiedPrompt, '--output-format', 'stream-json', '--verbose'];

      // Only add resume if we have a session ID and it's not the first message
      // The session might not exist if Claude was restarted or the session expired
      if (options.resume) {
        args.push('--resume', options.resume);
      }

      if (options.permissionMode) {
        args.push('--permission-mode', options.permissionMode);
      }

      if (options.maxTurns) {
        args.push('--max-turns', options.maxTurns.toString());
      }

      if (options.systemPrompt) {
        args.push('--system-prompt', options.systemPrompt);
      }

      if (options.allowedTools && options.allowedTools.length > 0) {
        args.push('--allowedTools', options.allowedTools.join(','));
      }

      if (options.model) {
        args.push('--model', options.model);
      }

      const homedir = os.homedir();
      const spawnOptions: any = {
        stdio: ['inherit', 'pipe', 'pipe'],
        env: {
          ...process.env,
          HOME: homedir,
        },
      };

      // Set working directory if provided
      if (options.cwd) {
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
          require('fs').mkdirSync(autosteerDir, { recursive: true });
        }
        if (!existsSync(worktreesDir)) {
          require('fs').mkdirSync(worktreesDir, { recursive: true });
        }

        if (!existsSync(cwd)) {
          if (existsSync(worktreesDir)) {
            cwd = worktreesDir;
          } else {
            cwd = process.cwd();
          }
        }

        spawnOptions.cwd = cwd;
      }

      const claudeExe = this.findClaudeExecutable();
      logger.debug(
        `[DEBUG queryClaudeCode] Spawning Claude with: '${claudeExe} ${args.join(' ')}' with cwd: ${spawnOptions.cwd}`
      );

      let child: ChildProcessWithoutNullStreams;
      try {
        child = spawn(claudeExe, args, spawnOptions);
      } catch (error) {
        log.error('[Claude Code] Failed to spawn claude:', error);
        throw new Error(
          `Failed to spawn Claude CLI. Please ensure Claude Code is installed: npm install -g @anthropic-ai/claude-code`
        );
      }

      this.activeProcesses.set(queryId, child);

      // Track stderr and process errors to throw after the stream completes
      let stderrError: Error | null = null;
      let processError: Error | null = null;

      child.stderr.on('data', (data) => {
        const stderr = data.toString();
        logger.debug('[DEBUG queryClaudeCode] stderr:', stderr);
        if (stderr.includes('No conversation found with session ID')) {
          if (sessionId) {
            this.sessionMap.delete(sessionId);
          }
          stderrError = new Error(`No conversation found with session ID: ${sessionId}`);
        }
      });

      // Add raw stdout listener to debug
      child.stdout.on('data', (data) => {
        const stdout = data.toString();
        logger.debug('[DEBUG queryClaudeCode] Raw stdout chunk:', stdout.substring(0, 200));
      });

      const rl = readline.createInterface({
        input: child.stdout,
        crlfDelay: Infinity,
      });

      const actualSessionId = sessionId || uuidv4();

      child.on('error', (error) => {
        logger.error('[DEBUG queryClaudeCode] Child process error:', error);
        log.error('[Claude Code] Child process error:', error);
        this.activeProcesses.delete(queryId);
        processError = error;
        // Close the readline interface to exit the loop
        rl.close();
      });

      child.on('exit', (code, signal) => {
        logger.debug(
          '[DEBUG queryClaudeCode] Child process exited with code:',
          code,
          'signal:',
          signal
        );
        this.activeProcesses.delete(queryId);
      });

      try {
        let messageCount = 0;
        let lineCount = 0;
        // Track tool inputs for permission requests
        const toolInputMap = new Map<string, any>();

        for await (const line of rl) {
          lineCount++;
          logger.debug('[DEBUG queryClaudeCode] Line #' + lineCount + ':', line.substring(0, 100));
          if (line.trim()) {
            try {
              const message = JSON.parse(line) as ClaudeCodeMessage;
              messageCount++;
              logger.debug('[DEBUG queryClaudeCode] Message #' + messageCount + ':', {
                type: message.type,
                subtype: message.subtype,
                hasContent: !!message.content,
                hasMessage: !!message.message,
              });

              if (
                message.type === 'assistant' &&
                message.message &&
                typeof message.message === 'object'
              ) {
                const anthropicMsg = message.message as AnthropicMessage;

                if (anthropicMsg.content && Array.isArray(anthropicMsg.content)) {
                  for (const content of anthropicMsg.content) {
                    if (content.type === 'tool_use' && content.tool_use) {
                      const toolUse = content.tool_use;

                      if (toolUse.id && toolUse.input) {
                        toolInputMap.set(toolUse.id, {
                          name: toolUse.name,
                          input: toolUse.input,
                        });
                      }
                    }
                  }
                }
              }

              // Check for permission requests in tool_result messages
              if (
                message.type === 'user' &&
                message.message &&
                typeof message.message === 'object'
              ) {
                const userMsg = message.message as any;
                if (userMsg.content && Array.isArray(userMsg.content)) {
                  for (const content of userMsg.content) {
                    if (content.type === 'tool_result' && content.is_error && content.content) {
                      const errorMsg = content.content.toString();
                      if (errorMsg.includes('Claude requested permissions')) {
                        const filePathMatch = errorMsg.match(/to write to (.+?),/);
                        const filePath = filePathMatch ? filePathMatch[1] : '';
                        const toolInfo = toolInputMap.get(content.tool_use_id);

                        const permissionRequest: PermissionRequest = {
                          tool_name: toolInfo?.name || 'Edit',
                          tool_use_id: content.tool_use_id,
                          file_path: filePath,
                          message: errorMsg,
                          ...(toolInfo?.input?.old_string && {
                            old_string: toolInfo.input.old_string,
                          }),
                          ...(toolInfo?.input?.new_string && {
                            new_string: toolInfo.input.new_string,
                          }),
                          ...(toolInfo?.input?.content && { content: toolInfo.input.content }),
                        };

                        message.__permissionRequest = permissionRequest;
                      }
                    }
                  }
                }
              }

              // Check for file change messages and log them
              const fileChangeMessage = this.parseFileChangeMessage(message);
              if (fileChangeMessage) {
                logger.warn('[FileChange] Detected file change request:', {
                  messageId: fileChangeMessage.messageId,
                  sessionId: fileChangeMessage.sessionId,
                  fileCount: fileChangeMessage.fileChanges.length,
                  files: fileChangeMessage.fileChanges.map((fc) => ({
                    path: fc.filePath,
                    type: fc.changeType,
                    hasOldContent: !!fc.oldContent,
                    hasNewContent: !!fc.newContent,
                    hasDiff: !!fc.diff,
                  })),
                });

                // Store the file change message in the original message for downstream processing
                (message as any).__fileChangeMessage = fileChangeMessage;
              }

              if (
                message.type === 'result' &&
                message.permission_denials &&
                Array.isArray(message.permission_denials) &&
                message.permission_denials.length > 0
              ) {
                const editDenials = message.permission_denials.filter(
                  (d) => d.tool_name === 'Edit' || d.tool_name === 'Write'
                );

                if (editDenials.length > 0) {
                  const denial = editDenials[0];
                  message.__permissionRequest = {
                    tool_name: denial.tool_name,
                    tool_use_id: denial.tool_use_id,
                    file_path: denial.tool_input.file_path,
                    message: `Permission required to ${denial.tool_name.toLowerCase()} ${denial.tool_input.file_path}`,
                    ...(denial.tool_input.old_string && {
                      old_string: denial.tool_input.old_string,
                    }),
                    ...(denial.tool_input.new_string && {
                      new_string: denial.tool_input.new_string,
                    }),
                    ...(denial.tool_input.content && { content: denial.tool_input.content }),
                  };
                }
              }

              if (
                message.type === 'system' &&
                message.subtype === 'init' &&
                sessionId &&
                message.session_id
              ) {
                this.sessionMap.set(sessionId, message.session_id);
              }

              // Only auto-fill session_id for non-result messages
              // Result messages should preserve the absence of session_id for error detection
              if (message.type !== 'result') {
                message.session_id = message.session_id || actualSessionId;
              }
              yield message;
            } catch (e) {
              logger.debug('[DEBUG queryClaudeCode] Failed to parse line:', line.substring(0, 100));
              logger.debug('[DEBUG queryClaudeCode] Parse error:', e);
              // Skip unparseable lines
            }
          }
        }
        logger.debug(
          '[DEBUG queryClaudeCode] Stream complete, total lines:',
          lineCount,
          'messages:',
          messageCount
        );

        // Throw process error or stderr error if one was captured
        if (processError) {
          throw processError;
        }
        if (stderrError) {
          throw stderrError;
        }
      } finally {
        this.activeProcesses.delete(queryId);

        if (tempDir) {
          fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        }
      }
    } catch (error) {
      this.activeProcesses.delete(queryId);

      if (tempDir) {
        fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }

      throw error;
    }
  }

  /**
   * Abort a specific query
   */
  abortQuery(queryId: string): void {
    const process = this.activeProcesses.get(queryId);
    if (process) {
      process.kill();
      this.activeProcesses.delete(queryId);
    }
  }

  /**
   * Clear all sessions
   */
  clearSessions(): void {
    this.sessionMap.clear();
  }

  /**
   * Clear session for a specific entry
   */
  clearSessionForEntry(entryId: string): boolean {
    const hasSession = this.sessionMap.has(entryId);
    if (hasSession) {
      this.sessionMap.delete(entryId);
    }
    return hasSession;
  }

  /**
   * Get session ID for an entry
   */
  getSessionId(entryId: string): string | undefined {
    return this.sessionMap.get(entryId);
  }

  /**
   * Set session mapping for an agent
   */
  setSessionMapping(agentId: string, claudeSessionId: string): void {
    logger.debug(
      `[DEBUG queryClaudeCode] Setting session mapping for agent ${agentId} with Claude session ID ${claudeSessionId}`
    );
    this.sessionMap.set(agentId, claudeSessionId);
  }

  /**
   * Parse file change message from Claude Code output
   * Comprehensive debugging and message structure analysis
   */
  parseFileChangeMessage(message: string | ClaudeCodeMessage): FileChangeMessage | null {
    try {
      // First, log the raw message for debugging
      this.logMessageStructure(message, 'parseFileChangeMessage');

      // If it's a string, try to parse it
      const parsedMessage = typeof message === 'string' ? JSON.parse(message) : message;

      // Check if this is a file change message using our type guard
      if (isFileChangeMessage(parsedMessage)) {
        // Extract file changes using our flexible extractor
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
            raw: parsedMessage, // Store raw message for debugging
          };

          logger.info('[FileChange] Successfully parsed file change message:', {
            messageId: fileChangeMessage.messageId,
            fileCount: fileChangeMessage.fileChanges.length,
            files: fileChangeMessage.fileChanges.map((f) => f.filePath),
          });

          return fileChangeMessage;
        }
      }

      // Check if it's a tool use message that might contain file changes
      if (parsedMessage.type === 'assistant' && parsedMessage.tool_calls) {
        for (const toolCall of parsedMessage.tool_calls) {
          if (
            toolCall.name === 'file_edit' ||
            toolCall.name === 'write_file' ||
            toolCall.name === 'edit_file'
          ) {
            const fileChange: FileChange = {
              filePath: toolCall.input?.path || toolCall.input?.file_path || '',
              changeType: toolCall.name === 'write_file' ? 'create' : 'modify',
              newContent: toolCall.input?.content || toolCall.input?.new_content || '',
              oldContent: toolCall.input?.old_content || '',
            };

            if (fileChange.filePath) {
              const fileChangeMessage: FileChangeMessage = {
                type: 'file_change_request',
                fileChanges: [fileChange],
                sessionId: parsedMessage.session_id || '',
                messageId: parsedMessage.message_id || toolCall.id || uuidv4(),
                timestamp: Date.now(),
                raw: parsedMessage,
              };

              logger.info('[FileChange] Parsed tool_use file change:', {
                messageId: fileChangeMessage.messageId,
                toolName: toolCall.name,
                filePath: fileChange.filePath,
              });

              return fileChangeMessage;
            }
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('[FileChange] Failed to parse file change message:', error);
      return null;
    }
  }

  /**
   * Log message structure for debugging
   * Comprehensive message structure analysis
   */
  logMessageStructure(message: any, context: string = 'MessageDebug'): void {
    const debugInfo: FileChangeDebugInfo = {
      messageType: typeof message,
      messageStructure: {},
      timestamp: Date.now(),
      sessionId: message?.session_id || message?.sessionId || 'unknown',
      parseSuccess: false,
      ...(typeof message === 'string' ? { rawMessage: message.substring(0, 500) } : {}),
    };

    try {
      // Parse if string
      const parsed = typeof message === 'string' ? JSON.parse(message) : message;

      // Extract message structure
      debugInfo.messageStructure = {
        type: parsed.type,
        subtype: parsed.subtype,
        role: parsed.role,
        hasContent: !!parsed.content,
        contentType: typeof parsed.content,
        hasMessage: !!parsed.message,
        messageType: typeof parsed.message,
        hasToolCalls: !!parsed.tool_calls,
        toolCallsCount: Array.isArray(parsed.tool_calls) ? parsed.tool_calls.length : 0,
        hasToolResults: !!parsed.tool_results,
        toolResultsCount: Array.isArray(parsed.tool_results) ? parsed.tool_results.length : 0,
        hasFileChanges: !!(parsed.fileChanges || parsed.changes || parsed.files),
        keys: Object.keys(parsed),
      };

      // Check for nested file change indicators
      if (parsed.content && typeof parsed.content === 'object') {
        debugInfo.messageStructure.contentKeys = Object.keys(parsed.content);
      }

      if (parsed.message && typeof parsed.message === 'object') {
        debugInfo.messageStructure.messageKeys = Object.keys(parsed.message);
      }

      // Log tool calls details if present
      if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
        debugInfo.messageStructure.toolCalls = parsed.tool_calls.map((tool: any) => ({
          name: tool.name,
          type: tool.type,
          hasInput: !!tool.input,
          inputKeys: tool.input ? Object.keys(tool.input) : [],
        }));
      }

      debugInfo.parseSuccess = true;

      // Log with different levels based on relevance
      const isLikelyFileChange =
        isFileChangeMessage(parsed) ||
        (parsed.tool_calls &&
          parsed.tool_calls.some(
            (t: any) => t.name === 'file_edit' || t.name === 'write_file' || t.name === 'edit_file'
          )) ||
        parsed.type === 'permission_request';

      if (isLikelyFileChange) {
        logger.warn(`[${context}] Potential file change message detected:`, debugInfo);
      } else {
        logger.debug(`[${context}] Message structure:`, debugInfo);
      }
    } catch (error) {
      debugInfo.parseError = error instanceof Error ? error.message : String(error);
      logger.debug(`[${context}] Failed to parse message structure:`, debugInfo);
    }
  }

  /**
   * Handle file change response from user
   * Response forwarding to Claude Code
   */
  async handleFileChangeResponse(messageId: string, action: 'accept' | 'reject'): Promise<void> {
    logger.info('[FileChange] Handling user response:', { messageId, action });

    // We just log the response
    // This will forward the response to Claude Code
    logger.warn('[FileChange] Response handling not yet implemented (logging only):', {
      messageId,
      action,
    });
  }

  /**
   * Handle permission approval by sending a continuation message with bypassPermissions
   * This allows the pending edit to proceed
   */
  async *approvePermissionAndContinue(
    queryId: string,
    sessionId: string,
    options: ClaudeCodeQueryOptions['options'] = {}
  ): AsyncGenerator<ClaudeCodeMessage, void, unknown> {
    logger.info('[Permission] Approving permission and continuing session:', {
      queryId,
      sessionId,
    });

    // Send a continuation message with bypassPermissions enabled
    // This will allow the pending edit to proceed
    yield* this.queryClaudeCode(queryId, {
      prompt: 'Continue with the approved changes.',
      sessionId,
      options: {
        ...options,
        permissionMode: 'bypassPermissions',
      },
    });
  }

  /**
   * Reject a permission request by aborting the query or sending a rejection message
   */
  async *rejectPermission(
    queryId: string,
    sessionId: string,
    options: ClaudeCodeQueryOptions['options'] = {}
  ): AsyncGenerator<ClaudeCodeMessage, void, unknown> {
    logger.info('[Permission] Rejecting permission:', {
      queryId,
      sessionId,
    });

    // Send a message to cancel the change
    yield* this.queryClaudeCode(queryId, {
      prompt: 'Cancel that change. Do not make any edits.',
      sessionId,
      options,
    });
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
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
      // Default
    };
    return mimeToExt[mimeType] || '.bin';
  }
}
