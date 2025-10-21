/**
 * IPC handlers for attachment operations
 * Handles file saving in main process to work around IPC serialization limits
 */

import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

interface SaveAttachmentParams {
  id: string;
  data: string; // base64
  filename: string;
  type: 'image' | 'document' | 'code' | 'other';
  mediaType: string;
}

interface SavedAttachment {
  id: string;
  filepath: string;
  type: 'image' | 'document' | 'code' | 'other';
  mediaType: string;
  filename: string;
}

// Store saved attachments by query session
const attachmentSessions = new Map<string, SavedAttachment[]>();

export function registerAttachmentHandlers(): void {
  /**
   * Save attachments for a query session
   * Returns file paths that can be passed to Claude Code
   */
  ipcMain.handle(
    'attachments:save-for-session',
    async (_event, sessionId: string, attachments: SaveAttachmentParams[]) => {
      try {
        // Create temporary directory for this session
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-session-'));
        const savedAttachments: SavedAttachment[] = [];

        for (const attachment of attachments) {
          const filename =
            attachment.filename ||
            `${attachment.type}_${attachment.id}${getExtensionFromMimeType(attachment.mediaType)}`;
          const filepath = path.join(tempDir, filename);

          // Decode base64 and save to file
          const buffer = Buffer.from(attachment.data, 'base64');
          await fs.writeFile(filepath, buffer);

          savedAttachments.push({
            id: attachment.id,
            filepath,
            type: attachment.type,
            mediaType: attachment.mediaType,
            filename: attachment.filename,
          });
        }

        // Store for this session
        attachmentSessions.set(sessionId, savedAttachments);

        return {
          success: true,
          tempDir,
          attachments: savedAttachments,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  /**
   * Get saved attachments for a session
   */
  ipcMain.handle('attachments:get-for-session', async (_event, sessionId: string) => {
    return attachmentSessions.get(sessionId) || [];
  });

  /**
   * Clean up attachments for a session
   */
  ipcMain.handle('attachments:cleanup-session', async (_event, sessionId: string) => {
    const attachments = attachmentSessions.get(sessionId);
    if (attachments && attachments.length > 0) {
      // Get directory from first attachment
      const dir = path.dirname(attachments[0].filepath);

      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }

      attachmentSessions.delete(sessionId);
    }

    return { success: true };
  });
}

function getExtensionFromMimeType(mimeType: string): string {
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
  };
  return mimeToExt[mimeType] || '.bin';
}
