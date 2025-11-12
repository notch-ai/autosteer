/**
 * Global chat interface refs registry
 * Used for keyboard shortcuts that need to access refs from any component
 */

export interface ChatInterfaceRef {
  focus: () => void;
}

// Module-level singleton Map for chat interface refs
const globalChatInterfaceRefs = new Map<string, ChatInterfaceRef | null>();

export const GlobalChatRefs = {
  /**
   * Register a chat interface ref
   */
  set(agentId: string, ref: ChatInterfaceRef | null): void {
    globalChatInterfaceRefs.set(agentId, ref);
  },

  /**
   * Get a chat interface ref
   */
  get(agentId: string): ChatInterfaceRef | null {
    return globalChatInterfaceRefs.get(agentId) || null;
  },

  /**
   * Check if a ref exists
   */
  has(agentId: string): boolean {
    return globalChatInterfaceRefs.has(agentId);
  },

  /**
   * Remove a ref
   */
  delete(agentId: string): void {
    globalChatInterfaceRefs.delete(agentId);
  },

  /**
   * Get all registered agent IDs
   */
  getAgentIds(): string[] {
    return Array.from(globalChatInterfaceRefs.keys());
  },
};
