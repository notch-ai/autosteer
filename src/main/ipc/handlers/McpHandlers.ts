import { ipcMain, IpcMainInvokeEvent, shell } from 'electron';
import log from 'electron-log/main';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { McpAuthService, McpServerConfig } from '@/services/McpAuthService';

const logger = log;

export class McpHandlers {
  private mcpAuthService: McpAuthService;

  constructor() {
    this.mcpAuthService = McpAuthService.getInstance();
  }

  registerHandlers(): void {
    ipcMain.handle('mcp:authenticate-server', this.handleAuthenticateServer.bind(this));
  }

  /**
   * Handle user-initiated MCP server authentication
   * Triggered when user clicks "Authenticate Now" button in UI
   */
  private async handleAuthenticateServer(
    _event: IpcMainInvokeEvent,
    serverName: string,
    projectPath: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const mcpConfigPath = join(projectPath, '.mcp.json');
      if (!existsSync(mcpConfigPath)) {
        throw new Error('MCP configuration file not found');
      }

      const mcpConfigContent = readFileSync(mcpConfigPath, 'utf-8');
      const mcpConfig = JSON.parse(mcpConfigContent);

      const serverConfig = mcpConfig.mcpServers?.[serverName];
      if (!serverConfig) {
        throw new Error(`Server "${serverName}" not found in MCP configuration`);
      }

      // Pass the server config directly - McpAuthService handles all transport types
      const mcpServerConfig: McpServerConfig = serverConfig;

      const authResult = await this.mcpAuthService.captureAuthUrl(serverName, mcpServerConfig);

      if (authResult.error) {
        throw new Error(authResult.error);
      }

      if (authResult.authUrl) {
        await shell.openExternal(authResult.authUrl);
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[MCP Handler] Authentication failed for ${serverName}:`, error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
