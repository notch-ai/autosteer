/**
 * MessageValidator - Message Validation Layer
 * Validates SDK messages using Zod schemas with progressive fallback
 *
 * Validation Strategy:
 * 1. Strict Validation: Try Anthropic SDK types first with strict Zod schema
 * 2. Relaxed Validation: Fallback to relaxed schema if strict fails
 * 3. Partial Extraction: Extract minimal valid data as last resort
 * 4. Error Logging: Log all validation errors without throwing
 *
 * Features:
 * - Progressive fallback for robust parsing
 * - Correlation ID tracking and generation
 * - Sequence number validation
 * - Structured error reporting via logger
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { ComputedMessage } from '@/stores/chat.selectors';
import type {
  ValidationResult,
  ValidationOptions,
  ValidationMetadata,
  BatchValidationResult,
} from '@/types/validation.types';
import { logger } from '@/commons/utils/logger';
import { SdkVersionManager } from './SdkVersionManager';
import {
  StrictSDKMessageSchema,
  RelaxedSDKMessageSchema,
  SDKUserMessageSchema,
  SDKAssistantMessageSchema,
  SDKStreamEventSchema,
} from '@/types/sdk.schemas';

/**
 * Sequence number tracker for validation
 */
let sequenceCounter = 0;

/**
 * Session-specific state tracking
 */
interface SessionState {
  sequenceCounter: number;
  lastActivity: Date;
  messageCount: number;
}

/**
 * Type alias for validated SDK messages
 * Using unknown to avoid type issues with complex union types
 */
type ValidatedSDKMessage = Record<string, unknown>;

/**
 * MessageValidator - Main validation service
 */
export class MessageValidator {
  /**
   * Session-specific state for tracking sequence numbers and activity
   */
  private static sessionState: Map<string, SessionState> = new Map();

  /**
   * QueryManager instances for session lifecycle coordination
   */
  private static queryManagers: Set<any> = new Set();
  /**
   * Validate a single SDK message with progressive fallback
   */
  static validate(message: unknown, options: ValidationOptions = {}): ValidationResult {
    const {
      strict = false,
      enableFallback = true,
      generateCorrelationId = true,
      trackSequenceNumbers = true,
    } = options;

    // Strict validation
    try {
      const parsed = StrictSDKMessageSchema.parse(message);
      const result = this.convertToValidationResult(parsed, 'strict', trackSequenceNumbers);

      if (generateCorrelationId && !result.metadata?.correlationId) {
        result.metadata = result.metadata || this.createMetadata(parsed);
        result.metadata.correlationId = uuidv4();
      }

      // Check SDK version compatibility
      this.checkSdkVersionCompatibility(result);

      logger.debug('[MessageValidator] Strict validation succeeded', {
        messageType: (parsed as any).type,
        correlationId: result.metadata?.correlationId,
      });

      return result;
    } catch (strictError) {
      if (strict) {
        return this.createErrorResult(strictError, message);
      }

      logger.debug('[MessageValidator] Strict validation failed, trying relaxed schema', {
        error: String(strictError),
      });
    }

    // Relaxed validation
    if (enableFallback) {
      try {
        const parsed = RelaxedSDKMessageSchema.parse(message);
        const result = this.convertToValidationResult(parsed, 'relaxed', trackSequenceNumbers);

        if (generateCorrelationId && !result.metadata?.correlationId) {
          result.metadata = result.metadata || this.createMetadata(parsed);
          result.metadata.correlationId = uuidv4();
        }

        result.warnings = ['Used relaxed validation due to missing optional fields'];

        // Check SDK version compatibility
        this.checkSdkVersionCompatibility(result);

        logger.debug('[MessageValidator] Relaxed validation succeeded', {
          messageType: (parsed as any).type,
          correlationId: result.metadata?.correlationId,
        });

        return result;
      } catch (relaxedError) {
        logger.debug('[MessageValidator] Relaxed validation failed, trying partial extraction', {
          error: String(relaxedError),
        });
      }

      // Partial extraction
      try {
        const result = this.partialExtract(message as any, trackSequenceNumbers);

        if (generateCorrelationId && !result.metadata?.correlationId) {
          result.metadata = result.metadata || ({} as ValidationMetadata);
          result.metadata.correlationId = uuidv4();
          result.metadata.sessionId = (message as any).session_id || 'unknown';
        }

        result.warnings = ['Used partial extraction due to validation failures'];

        logger.warn('[MessageValidator] Used partial extraction', {
          correlationId: result.metadata?.correlationId,
        });

        return result;
      } catch (partialError) {
        logger.error('[MessageValidator] All validation methods failed', {
          error: String(partialError),
          message: JSON.stringify(message).substring(0, 200),
        });
      }
    }

    // Complete failure
    return this.createErrorResult(new Error('All validation methods failed'), message);
  }

  /**
   * Validate multiple messages in batch
   */
  static validateBatch(messages: unknown[], options: ValidationOptions = {}): ValidationResult[] {
    return messages.map((message) => this.validate(message, options));
  }

  /**
   * Validate batch and return summary statistics
   */
  static validateBatchWithSummary(
    messages: unknown[],
    options: ValidationOptions = {}
  ): BatchValidationResult {
    const results = this.validateBatch(messages, options);

    const summary = {
      total: results.length,
      valid: results.filter((r) => r.isValid).length,
      invalid: results.filter((r) => !r.isValid).length,
      strict: results.filter((r) => r.validationMethod === 'strict').length,
      relaxed: results.filter((r) => r.validationMethod === 'relaxed').length,
      partial: results.filter((r) => r.validationMethod === 'partial').length,
      failed: results.filter((r) => r.validationMethod === 'failed').length,
    };

    return { results, summary };
  }

  /**
   * Convert validated SDK message to ChatMessage
   */
  private static convertToValidationResult(
    sdkMessage: ValidatedSDKMessage,
    validationMethod: 'strict' | 'relaxed',
    trackSequenceNumbers: boolean
  ): ValidationResult {
    const metadata = this.createMetadata(sdkMessage);

    if (trackSequenceNumbers) {
      const sessionId = (sdkMessage as any).session_id;
      if (sessionId) {
        // Use session-specific sequence number
        metadata.sequenceNumber = this.updateSessionState(sessionId);
      } else {
        // Fallback to global counter for messages without session_id
        metadata.sequenceNumber = ++sequenceCounter;
      }
    }

    // Convert to ChatMessage based on message type
    const chatMessage = this.convertToChatMessage(sdkMessage);

    return {
      isValid: true,
      chatMessage,
      validationMethod,
      metadata,
    };
  }

  /**
   * Convert SDK message to ChatMessage format
   */
  private static convertToChatMessage(sdkMessage: ValidatedSDKMessage): ComputedMessage | null {
    const messageType = (sdkMessage as any).type;

    // System messages and result messages don't create ChatMessages
    if (messageType === 'system' || messageType === 'result') {
      return null;
    }

    // User message
    if (messageType === 'user') {
      const userMsg = sdkMessage as z.infer<typeof SDKUserMessageSchema>;
      const content =
        typeof userMsg.message.content === 'string'
          ? userMsg.message.content
          : userMsg.message.content
              .filter((block: any) => block.type === 'text')
              .map((block: any) => block.text)
              .join('\n');

      return {
        id: userMsg.uuid,
        role: 'user',
        content,
        timestamp: new Date(),
      };
    }

    // Assistant message
    if (messageType === 'assistant') {
      const assistantMsg = sdkMessage as z.infer<typeof SDKAssistantMessageSchema>;
      const textContent = assistantMsg.message.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as any).text)
        .join('\n');

      const toolUsages = assistantMsg.message.content
        .filter((block) => block.type === 'tool_use')
        .map((block) => {
          const toolBlock = block;
          return {
            id: toolBlock.id,
            name: toolBlock.name,
            input: toolBlock.input,
          };
        });

      const chatMsg: ComputedMessage = {
        id: assistantMsg.message.id,
        role: 'assistant',
        content: textContent || 'No text content',
        timestamp: new Date(),
        stopReason: assistantMsg.message.stop_reason as any,
        stopSequence: assistantMsg.message.stop_sequence,
      };

      // Only add tokenUsage if usage data exists and has values
      if (assistantMsg.message.usage) {
        const usage = assistantMsg.message.usage;
        chatMsg.tokenUsage = {};

        if (usage.input_tokens !== undefined) {
          chatMsg.tokenUsage.inputTokens = usage.input_tokens;
        }
        if (usage.output_tokens !== undefined) {
          chatMsg.tokenUsage.outputTokens = usage.output_tokens;
        }
        if (usage.cache_creation_input_tokens !== undefined) {
          chatMsg.tokenUsage.cacheCreationInputTokens = usage.cache_creation_input_tokens;
        }
        if (usage.cache_read_input_tokens !== undefined) {
          chatMsg.tokenUsage.cacheReadInputTokens = usage.cache_read_input_tokens;
        }
      }

      // Only add toolUsages if there are tools
      if (toolUsages.length > 0) {
        chatMsg.toolUsages = toolUsages;
      }

      return chatMsg;
    }

    // Stream event
    if (messageType === 'stream_event') {
      const streamMsg = sdkMessage as z.infer<typeof SDKStreamEventSchema>;
      const deltaText = streamMsg.event.delta?.text || '';

      return {
        id: streamMsg.uuid,
        role: 'assistant',
        content: deltaText,
        timestamp: new Date(),
      };
    }

    return null;
  }

  /**
   * Create metadata from SDK message
   */
  private static createMetadata(sdkMessage: ValidatedSDKMessage): ValidationMetadata {
    const metadata: ValidationMetadata = {
      correlationId: (sdkMessage as any).uuid || uuidv4(),
      sessionId: (sdkMessage as any).session_id,
      parentToolUseId: (sdkMessage as any).parent_tool_use_id,
      timestamp: new Date().toISOString(),
    };

    // Add type-specific metadata
    const messageType = (sdkMessage as any).type;

    if (messageType === 'stream_event') {
      metadata.isStreaming = true;
    }

    if (messageType === 'user' && (sdkMessage as any).isReplay) {
      metadata.isReplay = true;
    }

    if (messageType === 'system' && (sdkMessage as any).subtype === 'compact_boundary') {
      metadata.isCompactionReset = true;
    }

    if (messageType === 'result') {
      metadata.totalCost = (sdkMessage as any).total_cost_usd;
    }

    return metadata;
  }

  /**
   * Partial extraction - last resort for malformed messages
   */
  private static partialExtract(message: any, trackSequenceNumbers: boolean): ValidationResult {
    const metadata: ValidationMetadata = {
      correlationId: message.uuid || uuidv4(),
      sessionId: message.session_id || 'unknown',
      timestamp: new Date().toISOString(),
    };

    if (trackSequenceNumbers) {
      const sessionId = message.session_id;
      if (sessionId) {
        // Use session-specific sequence number
        metadata.sequenceNumber = this.updateSessionState(sessionId);
      } else {
        // Fallback to global counter for messages without session_id
        metadata.sequenceNumber = ++sequenceCounter;
      }
    }

    // Try to extract minimal ChatMessage
    let chatMessage: ComputedMessage | null = null;

    try {
      if (message.type === 'user' && message.message) {
        const content =
          typeof message.message.content === 'string'
            ? message.message.content
            : typeof message.message === 'string'
              ? message.message
              : 'Invalid content';

        chatMessage = {
          id: message.uuid || uuidv4(),
          role: 'user',
          content,
          timestamp: new Date(),
        };
      } else if (message.type === 'assistant' && message.message) {
        const content =
          typeof message.message.content === 'string'
            ? message.message.content
            : Array.isArray(message.message.content)
              ? message.message.content
                  .filter((b: any) => b?.type === 'text')
                  .map((b: any) => b.text)
                  .join('\n') || 'No text content'
              : 'Invalid content';

        chatMessage = {
          id: message.message.id || message.uuid || uuidv4(),
          role: 'assistant',
          content,
          timestamp: new Date(),
        };
      }
    } catch (extractError) {
      logger.error('[MessageValidator] Partial extraction failed', {
        error: String(extractError),
      });
    }

    return {
      isValid: chatMessage !== null,
      chatMessage,
      validationMethod: 'partial',
      metadata,
    };
  }

  /**
   * Create error result for validation failure
   */
  private static createErrorResult(error: unknown, message: unknown): ValidationResult {
    const errorMessage =
      error instanceof z.ZodError
        ? error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
        : String(error);

    logger.error('[MessageValidator] Validation failed', {
      error: errorMessage,
      messagePreview: JSON.stringify(message).substring(0, 200),
    });

    return {
      isValid: false,
      chatMessage: null,
      validationMethod: 'failed',
      errors: [errorMessage],
    };
  }

  /**
   * Reset sequence counter (useful for testing)
   */
  static resetSequenceCounter(): void {
    sequenceCounter = 0;
  }

  /**
   * Reset all session state (useful for testing)
   */
  static resetAllSessions(): void {
    this.sessionState.clear();
    sequenceCounter = 0;
  }

  /**
   * Register a QueryManager instance for session lifecycle coordination
   *
   * Sets up a wildcard listener pattern to handle session-closed events
   * for any session that gets created.
   */
  static registerQueryManager(queryManager: any): void {
    this.queryManagers.add(queryManager);

    // Store reference for setting up listeners when sessions are created
    logger.debug('[MessageValidator] Registered QueryManager', {
      queryManagerCount: this.queryManagers.size,
    });
  }

  /**
   * Unregister a QueryManager instance
   */
  static unregisterQueryManager(queryManager: any): void {
    this.queryManagers.delete(queryManager);
    logger.debug('[MessageValidator] Unregistered QueryManager', {
      queryManagerCount: this.queryManagers.size,
    });
  }

  /**
   * Get or create session state for a session ID
   */
  private static getOrCreateSessionState(sessionId: string): SessionState {
    let state = this.sessionState.get(sessionId);
    if (!state) {
      state = {
        sequenceCounter: 0,
        lastActivity: new Date(),
        messageCount: 0,
      };
      this.sessionState.set(sessionId, state);

      // Set up listeners for session-closed events from all registered QueryManagers
      this.queryManagers.forEach((queryManager) => {
        queryManager.on(`session-closed:${sessionId}`, () => {
          this.cleanupSession(sessionId);
        });
      });

      logger.debug('[MessageValidator] Created session state', { sessionId });
    }
    return state;
  }

  /**
   * Update session state after validation
   */
  private static updateSessionState(sessionId: string): number {
    const state = this.getOrCreateSessionState(sessionId);
    state.lastActivity = new Date();
    state.messageCount++;
    state.sequenceCounter++;
    return state.sequenceCounter;
  }

  /**
   * Cleanup session state when session is closed
   */
  static cleanupSession(sessionId: string): void {
    const state = this.sessionState.get(sessionId);
    if (state) {
      logger.info('[MessageValidator] Cleaning up session state', {
        sessionId,
        messageCount: state.messageCount,
        lastActivity: state.lastActivity,
      });
      this.sessionState.delete(sessionId);
    }
  }

  /**
   * Get session state for debugging/monitoring
   */
  static getSessionState(sessionId: string): SessionState | undefined {
    return this.sessionState.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  static getActiveSessions(): string[] {
    return Array.from(this.sessionState.keys());
  }

  /**
   * Check SDK version compatibility and add warnings if needed
   */
  private static checkSdkVersionCompatibility(result: ValidationResult): void {
    const sdkVersionManager = SdkVersionManager.getInstance();

    // Extract SDK version from message if available
    const messageVersion = result.metadata?.sdkVersion;

    if (messageVersion) {
      const { warnings } = sdkVersionManager.checkVersionCompatibility(messageVersion);

      if (warnings.length > 0) {
        result.warnings = result.warnings || [];
        result.warnings.push(...warnings);

        logger.debug('[MessageValidator] SDK version compatibility warnings', {
          messageVersion,
          currentVersion: sdkVersionManager.getCurrentVersion(),
          warnings,
        });
      }
    }
  }
}
