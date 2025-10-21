/**
 * TodoActivityMonitorManager - Manages per-agent TodoActivityMonitor instances
 * This prevents state bleeding between agents by ensuring complete isolation
 */

import { TodoActivityMonitor } from './TodoActivityMonitor';

class TodoActivityMonitorManager {
  private monitors: Map<string, TodoActivityMonitor> = new Map();

  /**
   * Get or create a TodoActivityMonitor for a specific agent
   */
  getMonitorForAgent(agentId: string): TodoActivityMonitor {
    if (!this.monitors.has(agentId)) {
      const monitor = new TodoActivityMonitor();
      monitor.setWorktree(agentId); // Using setWorktree for backward compatibility
      this.monitors.set(agentId, monitor);
    }
    return this.monitors.get(agentId)!;
  }

  /**
   * Get or create a TodoActivityMonitor for a specific worktree (legacy)
   */
  getMonitorForWorktree(worktreeId: string): TodoActivityMonitor {
    return this.getMonitorForAgent(worktreeId);
  }

  /**
   * Clear a specific agent's monitor
   */
  clearAgent(agentId: string): void {
    const monitor = this.monitors.get(agentId);
    if (monitor) {
      monitor.clear();
      this.monitors.delete(agentId);
    }
  }

  /**
   * Clear a specific worktree's monitor (legacy)
   */
  clearWorktree(worktreeId: string): void {
    this.clearAgent(worktreeId);
  }

  /**
   * Clear all monitors
   */
  clearAll(): void {
    for (const monitor of this.monitors.values()) {
      monitor.clear();
    }
    this.monitors.clear();
  }

  /**
   * Get all active agent IDs
   */
  getActiveAgents(): string[] {
    return Array.from(this.monitors.keys());
  }

  /**
   * Get all active worktree IDs (legacy)
   */
  getActiveWorktrees(): string[] {
    return this.getActiveAgents();
  }
}

// Export singleton manager
export const todoActivityMonitorManager = new TodoActivityMonitorManager();

// Export a helper to get monitor for current agent (or worktree for backward compatibility)
export function getTodoMonitor(idOrWorktree: string | null): TodoActivityMonitor | null {
  if (!idOrWorktree) return null;
  // This will work for both agent IDs and worktree IDs
  return todoActivityMonitorManager.getMonitorForAgent(idOrWorktree);
}
