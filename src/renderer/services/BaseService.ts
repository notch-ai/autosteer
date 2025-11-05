/**
 * BaseService - Abstract base class for all services
 * Provides automatic error handling for service operations
 */

import { globalErrorHandler } from './GlobalErrorHandler';

export abstract class BaseService {
  protected readonly serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  /**
   * Execute an async operation with automatic error handling
   */
  protected async execute<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      globalErrorHandler.handle(error, {
        subsystem: 'service',
        service: this.serviceName,
        operation: operationName,
      });
      throw error;
    }
  }

  /**
   * Execute a sync operation with automatic error handling
   */
  protected executeSync<T>(operation: () => T, operationName: string): T {
    try {
      return operation();
    } catch (error) {
      globalErrorHandler.handle(error, {
        subsystem: 'service',
        service: this.serviceName,
        operation: operationName,
      });
      throw error;
    }
  }

  /**
   * Execute an operation with custom error context
   */
  protected async executeWithContext<T>(
    operation: () => Promise<T>,
    context: Record<string, any>
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      globalErrorHandler.handle(error, {
        subsystem: 'service',
        service: this.serviceName,
        ...context,
      });

      throw error;
    }
  }

  /**
   * Execute multiple operations in parallel with error handling
   */
  protected async executeParallel<T>(
    operations: Array<{
      operation: () => Promise<T>;
      name: string;
    }>
  ): Promise<T[]> {
    return Promise.all(operations.map(({ operation, name }) => this.execute(operation, name)));
  }

  /**
   * Execute an operation with retry logic
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxAttempts: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === maxAttempts) {
          globalErrorHandler.handle(lastError, {
            subsystem: 'service',
            service: this.serviceName,
            operation: operationName,
            attempts: maxAttempts,
            finalAttempt: true,
          });
        }

        if (attempt < maxAttempts) {
          await this.delay(delayMs);
        }
      }
    }

    throw lastError || new Error('Unknown error in executeWithRetry');
  }

  /**
   * Helper method to create a delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get service name (for debugging/logging)
   */
  getServiceName(): string {
    return this.serviceName;
  }
}
