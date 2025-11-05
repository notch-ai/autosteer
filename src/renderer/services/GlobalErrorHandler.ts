/**
 * GlobalErrorHandler - Centralized error handling for renderer process
 * Provides automatic logging, toast notifications, and error deduplication
 */

import { logger } from '@/commons/utils/logger';
import { toast } from 'sonner';

export interface ErrorContext {
  subsystem: 'react' | 'service' | 'ipc' | 'handler' | 'store';
  component?: string;
  service?: string;
  operation?: string;
  channel?: string;
  state?: any;
  componentStack?: string;
  [key: string]: any;
}

export interface ErrorReport {
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  userMessage: string;
}

export class GlobalErrorHandler {
  private static instance: GlobalErrorHandler;
  private recentErrors = new Map<string, number>();
  private readonly DEDUPE_WINDOW = 5000;
  private errorReports: ErrorReport[] = [];
  private readonly MAX_REPORTS = 100;

  /**
   * Get singleton instance
   */
  static getInstance(): GlobalErrorHandler {
    if (!this.instance) {
      this.instance = new GlobalErrorHandler();
    }
    return this.instance;
  }

  /**
   * Main error handling entry point
   * Called by ErrorBoundary, BaseService, IPC wrapper, and store middleware
   */
  handle(error: unknown, context: ErrorContext): void {
    // Ensure we have an Error object
    const errorObj = this.normalizeError(error);

    // Check for duplicate errors
    const errorKey = `${errorObj.message}-${context.subsystem}`;
    const lastTime = this.recentErrors.get(errorKey);
    const now = Date.now();

    if (lastTime && now - lastTime < this.DEDUPE_WINDOW) {
      logger.debug('[GlobalErrorHandler] Duplicate error suppressed', {
        error: errorObj.message,
        context,
      });
      return;
    }

    this.recentErrors.set(errorKey, now);

    // Clean up old dedupe entries
    this.cleanupDedupeMap();

    // Process the error
    const report = this.processError(errorObj, context);

    // Store report for debugging
    this.storeReport(report);

    // Log the error
    this.logError(report);

    // Show toast notification
    this.showToast(report);

    // Optional: Report to analytics/monitoring
    this.reportToMonitoring(report);
  }

  /**
   * Process error into structured report
   */
  private processError(error: Error, context: ErrorContext): ErrorReport {
    const severity = this.assessSeverity(error, context);
    const userMessage = this.getUserFriendlyMessage(error, context);

    return {
      error: {
        name: error.name,
        message: error.message,
        ...(error.stack ? { stack: error.stack } : {}),
      },
      context,
      severity,
      timestamp: new Date().toISOString(),
      userMessage,
    };
  }

  /**
   * Normalize various error types to Error object
   */
  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    if (typeof error === 'string') {
      return new Error(error);
    }

    if (error && typeof error === 'object' && 'message' in error) {
      const err = new Error(String(error.message));
      if ('name' in error) err.name = String(error.name);
      if ('stack' in error) err.stack = String(error.stack);
      return err;
    }

    return new Error(String(error));
  }

  /**
   * Log error with full context
   */
  private logError(report: ErrorReport): void {
    logger.error('[GlobalErrorHandler] Error handled', {
      error: report.error,
      context: report.context,
      severity: report.severity,
      timestamp: report.timestamp,
    });
  }

  /**
   * Show user-friendly toast notification
   */
  private showToast(report: ErrorReport): void {
    const { userMessage, severity, context } = report;

    // Determine toast configuration based on severity
    const toastConfig = {
      duration: this.getToastDuration(severity),
      description: this.getToastDescription(context),
    };

    // Show appropriate toast type
    switch (severity) {
      case 'critical':
        toast.error(userMessage, {
          ...toastConfig,
          closeButton: true,
        });
        break;

      case 'high':
        toast.error(userMessage, toastConfig);
        break;

      case 'medium':
        toast.error(userMessage, {
          ...toastConfig,
          duration: toastConfig.duration - 2000,
        });
        break;

      case 'low':
        toast.warning(userMessage, {
          ...toastConfig,
          duration: 3000,
        });
        break;
    }
  }

  /**
   * Assess error severity based on type and context
   */
  private assessSeverity(
    error: Error,
    context: ErrorContext
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Critical: Main process or system-level errors
    if (context.subsystem === 'handler') {
      return 'critical';
    }

    // High: Network, auth, or data errors
    if (error.name === 'NetworkError' || error.name === 'AuthError') {
      return 'high';
    }

    if (
      error.message.toLowerCase().includes('authentication') ||
      error.message.toLowerCase().includes('permission') ||
      error.message.toLowerCase().includes('unauthorized')
    ) {
      return 'high';
    }

    // High: IPC errors
    if (context.subsystem === 'ipc') {
      return 'high';
    }

    // Medium: Business logic or validation errors
    if (
      error.name === 'ValidationError' ||
      error.message.toLowerCase().includes('invalid') ||
      error.message.toLowerCase().includes('required')
    ) {
      return 'medium';
    }

    // Medium: Service errors
    if (context.subsystem === 'service') {
      return 'medium';
    }

    // Low: UI/React errors (often recoverable)
    if (context.subsystem === 'react') {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Generate user-friendly error message
   */
  private getUserFriendlyMessage(error: Error, context: ErrorContext): string {
    // Check for known error types
    const errorMappings: Record<string, string> = {
      NetworkError: 'Unable to connect. Please check your internet connection.',
      ValidationError: 'Invalid input. Please check your data and try again.',
      AuthError: 'Authentication failed. Please sign in again.',
      TimeoutError: 'Operation timed out. Please try again.',
      PermissionError: 'Permission denied. Please check your access rights.',
      NotFoundError: 'The requested resource was not found.',
      RateLimitError: 'Too many requests. Please wait a moment and try again.',
    };

    if (errorMappings[error.name]) {
      return errorMappings[error.name];
    }

    // Check for common error message patterns
    const message = error.message.toLowerCase();

    if (message.includes('timeout')) {
      return 'Operation timed out. Please try again.';
    }

    if (message.includes('network') || message.includes('fetch')) {
      return 'Network error. Please check your connection.';
    }

    if (message.includes('permission') || message.includes('denied')) {
      return 'Permission denied. Please check your access rights.';
    }

    if (message.includes('not found') || message.includes('404')) {
      return 'The requested resource was not found.';
    }

    if (message.includes('invalid') || message.includes('validation')) {
      return 'Invalid input. Please check your data and try again.';
    }

    if (message.includes('authentication') || message.includes('unauthorized')) {
      return 'Authentication required. Please sign in.';
    }

    if (message.includes('rate limit') || message.includes('too many')) {
      return 'Too many requests. Please wait a moment and try again.';
    }

    // Context-specific messages
    if (context.operation) {
      return `Failed to ${context.operation}. Please try again.`;
    }

    if (context.component) {
      return `An error occurred in ${context.component}. Please refresh and try again.`;
    }

    if (context.service) {
      return `Service error in ${context.service}. Please try again.`;
    }

    // Generic fallback
    return 'An unexpected error occurred. Please try again.';
  }

  /**
   * Get toast duration based on severity
   */
  private getToastDuration(severity: 'low' | 'medium' | 'high' | 'critical'): number {
    switch (severity) {
      case 'critical':
        return 10000; // 10 seconds
      case 'high':
        return 7000; // 7 seconds
      case 'medium':
        return 5000; // 5 seconds
      case 'low':
        return 3000; // 3 seconds
      default:
        return 5000;
    }
  }

  /**
   * Get toast description based on context
   */
  private getToastDescription(context: ErrorContext): string | undefined {
    if (context.operation) {
      return `Operation: ${context.operation}`;
    }

    if (context.component) {
      return `Component: ${context.component}`;
    }

    if (context.service) {
      return `Service: ${context.service}`;
    }

    if (context.channel) {
      return `Channel: ${context.channel}`;
    }

    return undefined;
  }

  /**
   * Clean up old entries from dedupe map
   */
  private cleanupDedupeMap(): void {
    const now = Date.now();
    const cutoff = now - this.DEDUPE_WINDOW * 2; // Keep 2x the window

    for (const [key, time] of this.recentErrors.entries()) {
      if (time < cutoff) {
        this.recentErrors.delete(key);
      }
    }
  }

  /**
   * Store error report for debugging/metrics
   */
  private storeReport(report: ErrorReport): void {
    this.errorReports.push(report);

    // Keep only last N reports
    if (this.errorReports.length > this.MAX_REPORTS) {
      this.errorReports.shift();
    }
  }

  /**
   * Report to monitoring service (placeholder for future implementation)
   */
  private reportToMonitoring(report: ErrorReport): void {
    // TODO: Implement when monitoring service is added
    // Could send to Sentry, LogRocket, etc.

    // For now, just log critical errors
    if (report.severity === 'critical') {
      logger.warn('[GlobalErrorHandler] Critical error occurred', {
        error: report.error.message,
        context: report.context.subsystem,
      });
    }
  }

  /**
   * Get recent error reports (for debugging)
   */
  getRecentErrors(): ErrorReport[] {
    return [...this.errorReports];
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorReports = [];
    this.recentErrors.clear();
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    bySeverity: Record<string, number>;
    bySubsystem: Record<string, number>;
    recentCount: number;
  } {
    const stats = {
      total: this.errorReports.length,
      bySeverity: {} as Record<string, number>,
      bySubsystem: {} as Record<string, number>,
      recentCount: this.recentErrors.size,
    };

    for (const report of this.errorReports) {
      // Count by severity
      stats.bySeverity[report.severity] = (stats.bySeverity[report.severity] || 0) + 1;

      // Count by subsystem
      stats.bySubsystem[report.context.subsystem] =
        (stats.bySubsystem[report.context.subsystem] || 0) + 1;
    }

    return stats;
  }
}

// Export singleton instance
export const globalErrorHandler = GlobalErrorHandler.getInstance();
