/**
 * IPC Handler Index
 *
 * Centralized exports for all IPC handlers.
 * Provides clean imports and maintains single source of truth for handler registration.
 *
 * Usage:
 * ```typescript
 * import { ClaudeHandlers, SystemHandlers } from './handlers';
 * ```
 *
 * @module handlers
 */

// Phase 4 - IPC Simplification (NOTCH-1465)
// Domain-based handlers consolidating specialized handlers

// Domain handlers (All 4 completed ✅)
export { ClaudeHandlers } from './claude.handlers';
export { ProjectHandlers } from './project.handlers';
export { GitHandlers } from './git.handlers';
export { SystemHandlers } from './system.handlers';
