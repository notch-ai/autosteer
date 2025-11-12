/**
 * Message Error Handlers
 *
 * Handles message validation, streaming, and permission errors with:
 * - Structured logging using commons logger
 * - Toast notifications via useToast hook
 * - Error batching to prevent toast fatigue
 * - Error tracking per agent for chat store integration
 *
 * @see docs/guides-architecture.md - Error handling patterns
 */

import { logger } from '@/commons/utils/logger';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Error context for validation errors
 */
export interface ValidationErrorContext {
  messageId?: string;
  agentId?: string;
  toastDuration?: number;
  [key: string]: any;
}

/**
 * Error context for streaming errors
 */
export interface StreamingErrorContext {
  sessionId?: string;
  agentId?: string;
  toastDuration?: number;
  [key: string]: any;
}

/**
 * Error context for permission errors
 */
export interface PermissionErrorContext {
  toolName?: string;
  filePath?: string;
  agentId?: string;
  toastDuration?: number;
  [key: string]: any;
}

/**
 * Tracked error entry
 */
interface ErrorEntry {
  message: string;
  context: Record<string, any>;
  timestamp: number;
}

/**
 * Toast function signature from useToast hook
 */
type ToastFunction = (
  message: string,
  type: 'error' | 'warning' | 'info',
  duration?: number
) => void;

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_TOAST_DURATION = 5000; // 5 seconds
const ERROR_BATCH_WINDOW = 1000; // 1 second batching window
const MAX_BATCHED_ERRORS = 100; // Maximum errors to batch

// ============================================================================
// MESSAGE ERROR HANDLERS
// ============================================================================

/**
 * Message Error Handlers
 *
 * Centralized error handling for message operations with:
 * - Commons logger integration for structured logging
 * - Toast notifications for user feedback
 * - Error batching to prevent notification spam
 * - Per-agent error tracking
 */
export class MessageErrorHandlers {
  private showToast: ToastFunction;
  private batchedErrors: ErrorEntry[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private agentErrors: Map<string, ErrorEntry[]> = new Map();

  constructor(showToast: ToastFunction) {
    this.showToast = showToast;
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Handle validation errors
   *
   * @param error - Error object or message
   * @param context - Error context with messageId, agentId, etc.
   */
  handleValidationError(error: unknown, context: ValidationErrorContext = {}): void {
    const errorMessage = this.extractErrorMessage(error);
    const timestamp = Date.now();

    // Log error with context
    logger.error('[MessageErrorHandlers] Validation error', {
      error: errorMessage,
      timestamp,
      ...context,
    });

    // Track error per agent if agentId provided
    if (context.agentId) {
      this.trackAgentError(context.agentId, errorMessage, context);
    }

    // Batch error for toast notification
    this.batchError(errorMessage, context);
  }

  /**
   * Handle streaming errors
   *
   * @param error - Error object or message
   * @param context - Error context with sessionId, agentId, etc.
   */
  handleStreamingError(error: unknown, context: StreamingErrorContext = {}): void {
    const errorMessage = this.extractErrorMessage(error);
    const timestamp = Date.now();

    // Log error with context
    logger.error('[MessageErrorHandlers] Streaming error', {
      error: errorMessage,
      timestamp,
      ...context,
    });

    // Track error per agent if agentId provided
    if (context.agentId) {
      this.trackAgentError(context.agentId, errorMessage, context);
    }

    // Show immediate toast for streaming errors (critical)
    this.showToast(errorMessage, 'error', context.toastDuration || DEFAULT_TOAST_DURATION);
  }

  /**
   * Handle permission errors
   *
   * @param error - Error object or message
   * @param context - Error context with toolName, filePath, etc.
   */
  handlePermissionError(error: unknown, context: PermissionErrorContext = {}): void {
    const errorMessage = this.extractErrorMessage(error);
    const timestamp = Date.now();

    // Log error with context
    logger.error('[MessageErrorHandlers] Permission error', {
      error: errorMessage,
      timestamp,
      ...context,
    });

    // Track error per agent if agentId provided
    if (context.agentId) {
      this.trackAgentError(context.agentId, errorMessage, context);
    }

    // Show immediate toast for permission errors (requires user action)
    this.showToast(errorMessage, 'error', context.toastDuration || DEFAULT_TOAST_DURATION);
  }

  /**
   * Get batched errors for "View Details" action
   *
   * @returns Array of batched error entries
   */
  getBatchedErrors(): ErrorEntry[] {
    return [...this.batchedErrors];
  }

  /**
   * Get errors for a specific agent
   *
   * @param agentId - Agent ID
   * @returns Array of error entries for the agent
   */
  getErrorsForAgent(agentId: string): ErrorEntry[] {
    return this.agentErrors.get(agentId) || [];
  }

  /**
   * Clear errors for a specific agent
   *
   * @param agentId - Agent ID
   */
  clearAgentErrors(agentId: string): void {
    this.agentErrors.delete(agentId);
  }

  /**
   * Clear all tracked errors
   */
  clearAllErrors(): void {
    this.agentErrors.clear();
    this.batchedErrors = [];
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Extract error message from various error types
   *
   * @param error - Error object, string, or any value
   * @returns Extracted error message
   */
  private extractErrorMessage(error: unknown): string {
    if (typeof error === 'string') {
      return error;
    }

    if (error instanceof Error) {
      return error.message;
    }

    if (error && typeof error === 'object' && 'message' in error) {
      return String(error.message);
    }

    return 'Unknown error';
  }

  /**
   * Track error per agent for chat store integration
   *
   * @param agentId - Agent ID
   * @param message - Error message
   * @param context - Error context
   */
  private trackAgentError(agentId: string, message: string, context: Record<string, any>): void {
    const errors = this.agentErrors.get(agentId) || [];
    errors.push({
      message,
      context,
      timestamp: Date.now(),
    });
    this.agentErrors.set(agentId, errors);
  }

  /**
   * Batch error for toast notification
   *
   * Batches multiple errors within ERROR_BATCH_WINDOW to prevent toast fatigue
   *
   * @param message - Error message
   * @param context - Error context
   */
  private batchError(message: string, context: Record<string, any>): void {
    // Add to batch
    this.batchedErrors.push({
      message,
      context,
      timestamp: Date.now(),
    });

    // Limit batch size to prevent memory issues
    if (this.batchedErrors.length > MAX_BATCHED_ERRORS) {
      this.batchedErrors = this.batchedErrors.slice(-MAX_BATCHED_ERRORS);
    }

    // If this is the first error in the batch, schedule the flush
    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.flushBatch(context.toastDuration);
      }, ERROR_BATCH_WINDOW);
    }
  }

  /**
   * Flush batched errors and show toast notification
   *
   * @param toastDuration - Optional custom toast duration
   */
  private flushBatch(toastDuration?: number): void {
    const errorCount = this.batchedErrors.length;

    if (errorCount === 0) {
      this.batchTimeout = null;
      return;
    }

    if (errorCount === 1) {
      // Single error - show specific message
      this.showToast(
        this.batchedErrors[0].message,
        'error',
        toastDuration || DEFAULT_TOAST_DURATION
      );
    } else {
      // Multiple errors - show batched message
      this.showToast(
        `${errorCount} validation errors occurred`,
        'error',
        toastDuration || DEFAULT_TOAST_DURATION
      );
    }

    // Reset batch timeout (batch is kept for "View Details" until clearAllErrors)
    this.batchTimeout = null;
  }
}
