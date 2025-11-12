/**
 * Validation Types for Message Validation Layer
 * Defines error types, validation results, and validation metadata
 */

import type { ComputedMessage } from '@/stores/chat.selectors';

/**
 * Validation method used to process the message
 */
export type ValidationMethod = 'strict' | 'relaxed' | 'partial' | 'failed';

/**
 * Validation error information
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  path?: string[];
}

/**
 * Validation metadata extracted from message
 */
export interface ValidationMetadata {
  correlationId: string;
  sessionId: string;
  sequenceNumber?: number;
  isStreaming?: boolean;
  isReplay?: boolean;
  isCompactionReset?: boolean;
  totalCost?: number;
  parentToolUseId?: string | null;
  timestamp?: string;
  sdkVersion?: string; // SDK version from trace logs for version compatibility checks
}

/**
 * Result of message validation
 */
export interface ValidationResult {
  /**
   * Whether the message passed validation
   * True if message was successfully parsed (strict, relaxed, or partial)
   * False only if all parsing attempts failed
   */
  isValid: boolean;

  /**
   * The converted ChatMessage (null if message shouldn't be displayed or validation failed)
   */
  chatMessage: ComputedMessage | null;

  /**
   * Validation method that succeeded (or 'failed' if none succeeded)
   */
  validationMethod: ValidationMethod;

  /**
   * Metadata extracted from the message
   */
  metadata?: ValidationMetadata;

  /**
   * Validation errors (only present if isValid is false)
   */
  errors?: string[];

  /**
   * Validation warnings (present when fallback methods were used)
   */
  warnings?: string[];
}

/**
 * Options for message validation
 */
export interface ValidationOptions {
  /**
   * Enable strict validation (reject messages with missing optional fields)
   */
  strict?: boolean;

  /**
   * Enable progressive fallback (try relaxed schema and partial extraction)
   */
  enableFallback?: boolean;

  /**
   * Generate correlation ID if missing
   */
  generateCorrelationId?: boolean;

  /**
   * Track sequence numbers across validation calls
   */
  trackSequenceNumbers?: boolean;
}

/**
 * Batch validation result
 */
export interface BatchValidationResult {
  /**
   * Individual validation results for each message
   */
  results: ValidationResult[];

  /**
   * Summary statistics
   */
  summary: {
    total: number;
    valid: number;
    invalid: number;
    strict: number;
    relaxed: number;
    partial: number;
    failed: number;
  };
}
