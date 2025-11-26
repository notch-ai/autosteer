import { IpcMainInvokeEvent } from 'electron';
import log from 'electron-log';
import Store from 'electron-store';
import { existsSync } from 'fs';
import { launchIDE } from 'launch-ide';
import { isAbsolute, normalize, resolve } from 'path';
import which from 'which';
import { registerSafeHandler } from '../safeHandlerWrapper';

interface IdeStore {
  preferredEditor?: string;
  detectedEditors: string[];
  lastDetectionTime?: number;
}

interface IdeDetectResponse {
  editors: string[];
  preferred?: string;
}

interface IdeOpenFileRequest {
  file: string;
  line?: number;
  column?: number;
  editor?: string;
}

/**
 * IdeHandlers class
 * Handles IDE detection and file opening operations
 *
 * Key responsibilities:
 * - Detect available IDEs on the system
 * - Store and retrieve user's preferred editor
 * - Open files at specific line/column in chosen IDE
 * - Validate file paths for security
 */
export class IdeHandlers {
  private store: Store<IdeStore>;
  private readonly DETECTION_CACHE_MS = 60000; // Cache for 1 minute

  private readonly EDITOR_COMMANDS = [
    'code',
    'cursor',
    'windsurf',
    'webstorm',
    'phpstorm',
    'pycharm',
    'idea',
    'subl',
    'atom',
    'vim',
    'nvim',
    'emacs',
    'zed',
  ];

  constructor() {
    this.store = new Store<IdeStore>({
      name: 'ide-settings',
      defaults: {
        detectedEditors: [],
      },
    });
  }

  /**
   * Validate and normalize file path for security
   */
  private validateFilePath(filePath: string): string {
    try {
      // Normalize path
      const normalized = normalize(resolve(filePath));

      // Check for path traversal attempts
      if (normalized.includes('..')) {
        throw new Error('Path traversal not allowed');
      }

      // Verify it's absolute
      if (!isAbsolute(normalized)) {
        throw new Error('Only absolute paths allowed');
      }

      // Check file exists
      if (!existsSync(normalized)) {
        throw new Error('File does not exist');
      }

      return normalized;
    } catch (error) {
      log.error('[IdeHandlers] File path validation failed:', error);
      throw error;
    }
  }

  /**
   * Validate line and column numbers
   */
  private validatePosition(line?: number, column?: number): void {
    if (line !== undefined && (!Number.isInteger(line) || line < 1)) {
      throw new Error('Line must be a positive integer');
    }
    if (column !== undefined && (!Number.isInteger(column) || column < 1)) {
      throw new Error('Column must be a positive integer');
    }
  }

  /**
   * Detect available editors
   * Uses caching to avoid repeated detection
   */
  private async detectEditors(): Promise<string[]> {
    const lastDetection = this.store.get('lastDetectionTime');
    const now = Date.now();

    // Use cached results if fresh
    if (lastDetection && now - lastDetection < this.DETECTION_CACHE_MS) {
      const cached = this.store.get('detectedEditors', []);
      if (cached.length > 0) {
        return cached;
      }
    }

    try {
      // Check which editor commands are available in PATH
      const detectedEditors: string[] = [];

      for (const command of this.EDITOR_COMMANDS) {
        try {
          await which(command);
          detectedEditors.push(command);
        } catch {
          // Command not found, skip it
        }
      }

      this.store.set('detectedEditors', detectedEditors);
      this.store.set('lastDetectionTime', now);

      return detectedEditors;
    } catch (error) {
      log.error('[IdeHandlers] Failed to detect editors:', error);
      // Return empty array on error rather than failing
      return [];
    }
  }

  /**
   * Register all IPC handlers for IDE operations
   */
  registerHandlers(): void {
    // Detect available IDEs
    registerSafeHandler(
      'ide:detect',
      async (__event: IpcMainInvokeEvent): Promise<IdeDetectResponse> => {
        const editors = await this.detectEditors();
        const preferred = this.store.get('preferredEditor');

        return {
          editors,
          preferred,
        };
      },
      { operationName: 'Detect IDEs' }
    );

    // Set preferred IDE
    registerSafeHandler(
      'ide:setPreferred',
      async (__event: IpcMainInvokeEvent, editor: string): Promise<{ success: boolean }> => {
        log.info('[IdeHandlers] Setting preferred editor:', editor);
        this.store.set('preferredEditor', editor);
        return { success: true };
      },
      { operationName: 'Set preferred IDE' }
    );

    // Open file in IDE
    registerSafeHandler(
      'ide:openFile',
      async (
        __event: IpcMainInvokeEvent,
        request: IdeOpenFileRequest
      ): Promise<{ success: boolean; error?: string }> => {
        try {
          const { file, line = 1, column = 1, editor } = request;

          // Validate inputs
          const validatedPath = this.validateFilePath(file);
          this.validatePosition(line, column);

          // Get target editor
          const targetEditor = editor || this.store.get('preferredEditor');

          log.info('[IdeHandlers] Opening file in editor:', {
            file: validatedPath,
            line,
            column,
            editor: targetEditor,
          });

          // Use launch-ide to open file
          await launchIDE({
            file: validatedPath,
            line,
            column,
            editor: targetEditor,
            method: 'reuse', // Reuse existing window
            onError: (file, error) => {
              log.error('[IdeHandlers] Failed to open file:', { file, error });
            },
          });

          return { success: true };
        } catch (error) {
          log.error('[IdeHandlers] Failed to open file:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
      { operationName: 'Open file in IDE' }
    );
  }
}
