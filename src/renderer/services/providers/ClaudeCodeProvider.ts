import { Agent, ResourceType } from '@/entities';
import { ComputedMessage } from '@/stores/chat.selectors';
import {} from '@/stores/chat.selectors';
import { PermissionMode } from '@/types/permission.types';
import { ConversationOptions } from '@/types/streaming.types';
import { logger } from '@/commons/utils/logger';
import { Attachment, ClaudeStreamingCallbacks, claudeCodeService } from '../ClaudeCodeService';
import { ipcService } from '../IpcService';
import { LLMConfig, LLMProvider, StreamingCallbacks } from '../LLMService';

export class ClaudeCodeProvider implements LLMProvider {
  private abortController: AbortController | null = null;

  constructor(_config: LLMConfig) {
    // Claude Code uses local authentication - no API key needed
  }

  // Method to stop current streaming
  stopStreaming(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async generateResponse(
    userMessage: string,
    agent: Agent,
    attachedResourceIds: string[],
    _chatHistory: ComputedMessage[] = [],
    streamingCallbacks?: StreamingCallbacks,
    options?: {
      permissionMode?: PermissionMode;
      workingDirectory?: string;
      projectId?: string;
      model?: string;
    }
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const executeGeneration = async () => {
        try {
          let responseContent = '';
          let isComplete = false;

          // Create abort controller for this request
          this.abortController = new AbortController();

          // Load attached resources and prepare attachments for Claude Code
          const attachments = await this.prepareAttachments(attachedResourceIds);

          // Save attachments to disk in main process and get file paths
          let modifiedMessage = userMessage;
          let attachmentFilePaths: Array<{ filepath: string; type: string; filename: string }> = [];

          if (attachments.length > 0) {
            // Generate a unique session ID for this query
            const querySessionId = `query_${agent.id}_${Date.now()}`;

            // Save attachments in main process
            const saveResult = await window.electron?.ipcRenderer.invoke(
              'attachments:save-for-session',
              querySessionId,
              attachments.map((a) => ({
                id: crypto.randomUUID(),
                data: a.data,
                filename: a.filename,
                type: a.type,
                mediaType: a.media_type,
              }))
            );

            if (saveResult?.success && saveResult.attachments) {
              attachmentFilePaths = saveResult.attachments;

              // Build file references like Python implementation
              const fileInfo: string[] = [];
              const filesByType: Record<string, Array<{ filepath: string; filename: string }>> = {};

              for (const attachment of attachmentFilePaths) {
                if (!filesByType[attachment.type]) {
                  filesByType[attachment.type] = [];
                }
                filesByType[attachment.type].push({
                  filepath: attachment.filepath,
                  filename: attachment.filename,
                });
              }

              // Format file information
              if (filesByType.image) {
                fileInfo.push('Images:');
                filesByType.image.forEach((f) => fileInfo.push(`  - ${f.filename}: ${f.filepath}`));
              }
              if (filesByType.document) {
                fileInfo.push('\nDocuments:');
                filesByType.document.forEach((f) =>
                  fileInfo.push(`  - ${f.filename}: ${f.filepath}`)
                );
              }
              if (filesByType.code) {
                fileInfo.push('\nCode files:');
                filesByType.code.forEach((f) => fileInfo.push(`  - ${f.filename}: ${f.filepath}`));
              }
              if (filesByType.other) {
                fileInfo.push('\nOther files:');
                filesByType.other.forEach((f) => fileInfo.push(`  - ${f.filename}: ${f.filepath}`));
              }

              // Modify message to include file paths
              const fileReferences = fileInfo.join('\n');
              modifiedMessage = `${userMessage}\n\nI've attached the following files for you to analyze:\n\n${fileReferences}\n\nPlease use the Read tool to view these files and incorporate them into your response.`;

              // Schedule cleanup after response
              streamingCallbacks?.onComplete &&
                (function (originalOnComplete) {
                  streamingCallbacks.onComplete = function (finalContent: string) {
                    // Clean up attachments
                    window.electron?.ipcRenderer
                      .invoke('attachments:cleanup-session', querySessionId)
                      .catch((err) => logger.error('Failed to cleanup attachments:', err));
                    // Call original callback
                    originalOnComplete(finalContent);
                  };
                })(streamingCallbacks.onComplete);
            }
          }

          // Build the full context message
          const contextMessage = modifiedMessage;

          // Determine working directory - fallback to projectId if workingDirectory not provided
          let workingDirectory = options?.workingDirectory;
          if (!workingDirectory && options?.projectId) {
            // Use projectId to construct worktree path
            const homedir = require('os').homedir();
            workingDirectory = `${homedir}/.autosteer/worktrees/${options.projectId}`;
          }

          // Configure conversation options
          const conversationOptions: ConversationOptions = {
            // system_prompt: this.buildSystemPrompt(agent),
            max_thinking_tokens: 32768,
            permission_mode: options?.permissionMode || 'acceptEdits',
            ...(workingDirectory && { cwd: workingDirectory }),
            ...(options?.model && { model: options.model }),
            // Note: File attachments in Claude Code SDK work differently than our Python service
            // We'll include attachment content in the prompt for now
          };

          // Configure streaming callbacks
          const claudeCallbacks: ClaudeStreamingCallbacks = {
            onChunk: (chunk) => {
              if (chunk.isNewMessage) {
                responseContent = chunk.content;
              } else {
                responseContent += chunk.content;
              }
              if (streamingCallbacks?.onChunk) {
                streamingCallbacks.onChunk(chunk);
              }
            },
            onComplete: (finalContent) => {
              responseContent = finalContent;
              isComplete = true;
              // Call the complete callback if provided
              if (streamingCallbacks?.onComplete) {
                streamingCallbacks.onComplete(finalContent);
              }
            },
            onError: (error) => {
              // Call the error callback if provided
              if (streamingCallbacks?.onError) {
                streamingCallbacks.onError(error);
              }
              reject(error);
            },
            onSystem: async (message) => {
              // Capture Claude session ID on first message
              if (message.type === 'system' && message.subtype === 'init' && message.session_id) {
                // Update the agent with the Claude session ID
                try {
                  if (window.electron?.agents) {
                    await window.electron.agents.update(agent.id, {
                      metadata: {
                        ...agent.metadata,
                        claude_session_id: message.session_id,
                      },
                    });
                  }
                } catch (error) {
                  // Failed to update agent with session ID
                }
              }
            },
            onToolUse: (message) => {
              // Pass through tool usage to streaming callbacks
              if (streamingCallbacks?.onToolUse) {
                streamingCallbacks.onToolUse(message);
              }
            },
            onToolResult: (message) => {
              // Pass through tool results to streaming callbacks
              if (streamingCallbacks?.onToolResult) {
                streamingCallbacks.onToolResult(message);
              }
            },
            onResult: (result) => {
              // Pass the result data through streaming callbacks
              if (streamingCallbacks?.onResult) {
                streamingCallbacks.onResult(result);
              }

              // When we receive the result message, resolve the promise
              if (isComplete) {
                resolve(responseContent);
              }
            },
          };

          // Query Claude Code SDK
          await claudeCodeService.queryWithStreaming(
            contextMessage,
            {
              // Don't pass API key - local Claude Code uses CLI authentication
              abortController: this.abortController,
              sessionId: agent.id, // Use agent ID as session ID
              conversationOptions,
              ...(options?.projectId && { projectId: options.projectId }), // Pass projectId for worktree context
              // attachments, // TODO: Fix IPC serialization for large base64 data
            },
            claudeCallbacks
          );
        } catch (error) {
          // Clear abort controller
          this.abortController = null;
          reject(error);
        }
      };

      // Execute the async logic
      executeGeneration().catch(reject);
    });
  }

  private async prepareAttachments(resourceIds: string[]): Promise<Attachment[]> {
    if (!resourceIds || resourceIds.length === 0) {
      return [];
    }

    const attachments: Attachment[] = [];

    try {
      // Load resources metadata
      const resources = await ipcService.resources.loadByIds(resourceIds);

      for (const resource of resources) {
        try {
          // Get the resource preview/content
          const previewData = await ipcService.resources.preview(resource.id);

          if (previewData) {
            let data: string;
            let mediaType = resource.mimeType || 'application/octet-stream';

            // If it's already a data URL, extract the base64 part
            if (previewData.startsWith('data:')) {
              const base64Start = previewData.indexOf(',');
              data = previewData.substring(base64Start + 1);
              // Extract mime type from data URL if available
              const mimeMatch = previewData.match(/^data:([^;]+);/);
              if (mimeMatch) {
                mediaType = mimeMatch[1];
              }
            } else {
              // If it's raw content, encode to base64
              data = btoa(previewData);
            }

            // Determine attachment type
            let type: 'image' | 'document' | 'code' | 'other' = 'other';
            if (resource.type === ResourceType.IMAGE || mediaType.startsWith('image/')) {
              type = 'image';
            } else if (
              resource.type === ResourceType.DOCUMENT ||
              resource.name.endsWith('.txt') ||
              resource.name.endsWith('.md') ||
              resource.name.endsWith('.pdf') ||
              resource.name.endsWith('.doc') ||
              resource.name.endsWith('.docx')
            ) {
              type = 'document';
            } else if (
              resource.type === ResourceType.CODE ||
              resource.name.match(
                /\.(js|ts|py|java|c|cpp|cs|rb|go|rs|php|swift|kt|scala|r|sql|sh|bash|zsh|ps1|css|html|xml|json|yaml|yml|toml|ini|cfg|conf)$/
              )
            ) {
              type = 'code';
            }

            attachments.push({
              type,
              media_type: mediaType,
              data,
              filename: resource.name,
            });
          }
        } catch (error) {
          logger.error(`Failed to prepare attachment ${resource.id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Failed to prepare attachments:', error);
    }

    return attachments;
  }
}
