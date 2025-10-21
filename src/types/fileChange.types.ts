/**
 * File change notification types for Claude Code integration
 * Phase 1: Message structure debugging and type definitions
 */

/**
 * Main file change message from Claude Code
 * This is the top-level message that contains file changes
 */
export interface FileChangeMessage {
  type: 'file_change_request' | 'file_changes' | 'permission_request';
  fileChanges: FileChange[];
  sessionId: string;
  messageId: string;
  timestamp?: number;
  // Additional fields for debugging unknown message formats
  raw?: unknown;
}

/**
 * Individual file change details
 */
export interface FileChange {
  filePath: string;
  changeType: 'create' | 'modify' | 'delete' | 'rename';
  oldContent?: string;
  newContent?: string;
  diff?: string;
  // For rename operations
  newPath?: string;
  // Additional metadata
  fileType?: string;
  size?: number;
}

/**
 * User response to file change request
 */
export interface FileChangeResponse {
  messageId: string;
  action: 'accept' | 'reject';
  sessionId: string;
  timestamp: number;
  // Optional user comment
  comment?: string;
}

/**
 * File change notification state
 */
export interface FileChangeState {
  pendingChanges: Map<string, FileChangeMessage>;
  processingMessageIds: Set<string>;
  responseHistory: FileChangeResponse[];
}

/**
 * Debug information for message structure analysis
 */
export interface FileChangeDebugInfo {
  messageType: string;
  messageStructure: Record<string, unknown>;
  timestamp: number;
  sessionId: string;
  parseSuccess: boolean;
  parseError?: string;
  rawMessage?: string;
}

/**
 * Type guard to check if a message is a file change message
 */
export function isFileChangeMessage(message: unknown): message is FileChangeMessage {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const msg = message as any;

  // Check for various possible message type patterns
  const hasValidType =
    msg.type === 'file_change_request' ||
    msg.type === 'file_changes' ||
    msg.type === 'permission_request' ||
    (msg.type === 'tool_use' && msg.tool_name === 'file_edit');

  // Check for file changes array or similar structure
  const hasFileChanges =
    Array.isArray(msg.fileChanges) ||
    Array.isArray(msg.changes) ||
    Array.isArray(msg.files) ||
    (msg.content && typeof msg.content === 'object' && Array.isArray(msg.content.fileChanges));

  return hasValidType || hasFileChanges;
}

/**
 * Extract file changes from various message formats
 */
export function extractFileChanges(message: unknown): FileChange[] | null {
  if (!message || typeof message !== 'object') {
    return null;
  }

  const msg = message as any;

  // Try different possible locations for file changes
  const possibleChanges =
    msg.fileChanges ||
    msg.changes ||
    msg.files ||
    msg.content?.fileChanges ||
    msg.content?.changes ||
    msg.message?.fileChanges;

  if (!Array.isArray(possibleChanges)) {
    return null;
  }

  // Normalize to our FileChange format
  return possibleChanges
    .map((change: any) => ({
      filePath: change.filePath || change.path || change.file || change.filename,
      changeType: change.changeType || change.type || change.action || 'modify',
      oldContent: change.oldContent || change.old_content || change.before,
      newContent: change.newContent || change.new_content || change.after || change.content,
      diff: change.diff || change.patch,
      newPath: change.newPath || change.new_path || change.renamed_to,
      fileType: change.fileType || change.file_type || change.mime_type,
      size: change.size || change.file_size,
    }))
    .filter((change: FileChange) => change.filePath); // Filter out invalid entries
}
