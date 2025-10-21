import { spawn, ChildProcess } from 'child_process';

/**
 * MCP Server configuration supporting multiple transport types
 * - stdio: Local process (e.g., npx commands)
 * - http: Remote HTTP server (e.g., Linear, Notion)
 * - sse: Remote SSE server (deprecated, use http instead)
 */
export type McpServerConfig =
  | {
      type?: 'stdio';
      command: string;
      args: string[];
      env?: Record<string, string>;
    }
  | {
      type: 'http';
      url: string;
      headers?: Record<string, string>;
    }
  | {
      type: 'sse';
      url: string;
      headers?: Record<string, string>;
    };

export interface McpAuthResult {
  serverName: string;
  authUrl: string | null;
  error?: string;
}

export class McpAuthService {
  private static instance: McpAuthService;
  private activeProcesses: Map<string, ChildProcess> = new Map();

  private constructor() {}

  public static getInstance(): McpAuthService {
    if (!McpAuthService.instance) {
      McpAuthService.instance = new McpAuthService();
    }
    return McpAuthService.instance;
  }

  /**
   * Capture OAuth URL for an MCP server by spawning mcp-remote
   * @param serverName - Name of the MCP server (from .mcp.json)
   * @param mcpConfig - Server configuration
   * @returns Promise<McpAuthResult> - Object containing serverName and authUrl
   */
  public async captureAuthUrl(
    serverName: string,
    mcpConfig: McpServerConfig
  ): Promise<McpAuthResult> {
    return new Promise<McpAuthResult>((resolve) => {
      this.cleanup(serverName);

      // Determine command and args based on transport type
      let command: string;
      let args: string[];
      let env: NodeJS.ProcessEnv;

      if (mcpConfig.type === 'http' || mcpConfig.type === 'sse') {
        // For HTTP/SSE servers, use mcp-remote as proxy
        command = 'npx';
        args = ['@anthropic-ai/mcp-remote', mcpConfig.url];
        env = { ...process.env };

        // Add headers as environment variables if present
        if (mcpConfig.headers) {
          Object.entries(mcpConfig.headers).forEach(([key, value]) => {
            env[`MCP_HEADER_${key.toUpperCase().replace(/-/g, '_')}`] = value;
          });
        }
      } else {
        // For stdio servers, use command directly
        command = mcpConfig.command;
        args = mcpConfig.args;
        env = { ...process.env, ...mcpConfig.env };
      }

      const mcpProcess = spawn(command, args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.activeProcesses.set(serverName, mcpProcess);

      let resolved = false;
      const timeout = 30000;

      const checkForAuthUrl = (output: string) => {
        if (output.includes('Please authorize this client by visiting:')) {
          const urlMatch = output.match(/(https:\/\/[^\s]+)/);
          if (urlMatch && !resolved) {
            resolved = true;
            resolve({ serverName, authUrl: urlMatch[1] });
          }
        }

        if (output.includes('successfully') || output.includes('Authenticated')) {
          if (!resolved) {
            resolved = true;
            this.cleanup(serverName);
            resolve({ serverName, authUrl: null });
          }
        }
      };

      mcpProcess.stdout.on('data', (data: Buffer) => {
        checkForAuthUrl(data.toString());
      });

      mcpProcess.stderr.on('data', (data: Buffer) => {
        checkForAuthUrl(data.toString());
      });

      mcpProcess.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          this.cleanup(serverName);
          resolve({
            serverName,
            authUrl: null,
            error: `Failed to spawn mcp-remote: ${error.message}`,
          });
        }
      });

      mcpProcess.on('exit', (code) => {
        this.cleanup(serverName);

        if (!resolved) {
          resolved = true;
          if (code === 0) {
            resolve({ serverName, authUrl: null });
          } else {
            resolve({
              serverName,
              authUrl: null,
              error: `Process exited with code ${code}`,
            });
          }
        }
      });

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.cleanup(serverName);
          resolve({
            serverName,
            authUrl: null,
            error: 'Timeout waiting for auth URL',
          });
        }
      }, timeout);
    });
  }

  /**
   * Clean up process for a server
   */
  private cleanup(serverName: string): void {
    const process = this.activeProcesses.get(serverName);
    if (process && !process.killed) {
      process.kill();
    }
    this.activeProcesses.delete(serverName);
  }

  /**
   * Clean up all active processes
   */
  public cleanupAll(): void {
    this.activeProcesses.forEach((_, serverName) => {
      this.cleanup(serverName);
    });
  }
}
