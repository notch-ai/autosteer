/**
 * MCP Store - MCP Servers Management
 *
 * Handles Model Context Protocol (MCP) server tracking per agent
 *
 * Key features:
 * - Track MCP servers available to each agent
 * - Store MCP server configurations
 * - Associate servers with specific agents/sessions
 * - Query available MCP tools and resources
 *
 * @see docs/guides-architecture.md - Store Architecture
 */

import { logger } from '@/commons/utils/logger';
import { enableMapSet } from 'immer';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Enable MapSet plugin for Immer
enableMapSet();

// DevTools configuration - only in development
const withDevtools = process.env.NODE_ENV === 'development' ? devtools : (f: any) => f;

/**
 * MCPServer Interface
 * Represents an MCP server configuration
 */
export interface MCPServer {
  name: string;
  url?: string;
  type?: string;
  status?: 'connected' | 'failed' | 'pending' | 'needs-auth';
  tools?: string[];
  resources?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * MCPStore Interface
 * Defines all state and actions for MCP servers management
 */
export interface MCPStore {
  // ==================== STATE ====================

  // MCP Servers State
  mcpServers: Map<string, MCPServer[]>;

  // ==================== ACTIONS ====================

  // MCP Servers Actions
  setMCPServers: (agentId: string, servers: MCPServer[]) => void;
  getMCPServers: (agentId: string) => MCPServer[] | undefined;
  clearMCPServers: (agentId: string) => void;
  clearAllMCPServers: () => void;
}

/**
 * MCP Store
 * Manages MCP servers for all agents
 */
export const useMCPStore = create<MCPStore>()(
  withDevtools(
    immer<MCPStore>((set, get) => ({
      // ==================== STATE ====================

      mcpServers: new Map(),

      // ==================== ACTIONS ====================

      setMCPServers: (agentId: string, servers: MCPServer[]) => {
        set((state) => {
          state.mcpServers.set(agentId, servers);
        });

        logger.debug(`[MCPStore] Set ${servers.length} MCP servers for agent ${agentId}`);
      },

      getMCPServers: (agentId: string) => {
        return get().mcpServers.get(agentId);
      },

      clearMCPServers: (agentId: string) => {
        set((state) => {
          state.mcpServers.delete(agentId);
        });

        logger.debug(`[MCPStore] Cleared MCP servers for agent ${agentId}`);
      },

      clearAllMCPServers: () => {
        set((state) => {
          state.mcpServers.clear();
        });

        logger.info('[MCPStore] Cleared all MCP servers');
      },
    })),
    { name: 'mcp-store', trace: true }
  )
);

/**
 * React Hooks for MCP
 * Convenient hooks for accessing MCP state
 */

export const useMCPServers = (agentId?: string) => {
  return useMCPStore((state) =>
    agentId ? state.mcpServers.get(agentId) : Array.from(state.mcpServers.values()).flat()
  );
};

export const useMCPActions = () => {
  return useMCPStore((state) => ({
    setMCPServers: state.setMCPServers,
    getMCPServers: state.getMCPServers,
    clearMCPServers: state.clearMCPServers,
    clearAllMCPServers: state.clearAllMCPServers,
  }));
};
