import { TokenCounts } from './TokenCounts';

/**
 * Represents a loaded usage entry with processed data
 */
export class LoadedUsageEntry {
  /**
   * Timestamp of the usage entry
   */
  timestamp: Date;

  /**
   * Token usage breakdown
   */
  usage: TokenCounts;

  /**
   * Cost in USD (null if not calculated)
   */
  costUSD: number | null;

  /**
   * Model identifier
   */
  model: string;

  /**
   * Version information
   */
  version?: string;

  /**
   * Usage limit reset time if encountered
   */
  usageLimitResetTime?: Date;

  /**
   * Message ID for deduplication
   */
  messageId?: string;

  /**
   * Request ID for deduplication
   */
  requestId?: string;

  /**
   * Whether this is an API error message
   */
  isApiErrorMessage?: boolean;

  /**
   * Source file path (for tracking session ID)
   */
  sourceFile?: string;

  constructor(data: {
    timestamp: Date;
    usage: TokenCounts;
    costUSD: number | null;
    model: string;
    version?: string;
    usageLimitResetTime?: Date;
    messageId?: string;
    requestId?: string;
    isApiErrorMessage?: boolean;
    sourceFile?: string;
  }) {
    this.timestamp = data.timestamp;
    this.usage = data.usage;
    this.costUSD = data.costUSD;
    this.model = data.model;
    if (data.version !== undefined) {
      this.version = data.version;
    }
    if (data.usageLimitResetTime !== undefined) {
      this.usageLimitResetTime = data.usageLimitResetTime;
    }
    if (data.messageId !== undefined) {
      this.messageId = data.messageId;
    }
    if (data.requestId !== undefined) {
      this.requestId = data.requestId;
    }
    if (data.isApiErrorMessage !== undefined) {
      this.isApiErrorMessage = data.isApiErrorMessage;
    }
    if (data.sourceFile !== undefined) {
      this.sourceFile = data.sourceFile;
    }
  }

  /**
   * Create a unique hash for deduplication
   */
  getUniqueHash(): string {
    return `${this.messageId || 'no-id'}_${this.requestId || 'no-request'}`;
  }

  /**
   * Get total tokens used
   */
  getTotalTokens(): number {
    return (
      this.usage.inputTokens +
      this.usage.outputTokens +
      this.usage.cacheCreationInputTokens +
      this.usage.cacheReadInputTokens
    );
  }

  /**
   * Check if this entry has valid token usage
   */
  hasValidUsage(): boolean {
    return this.getTotalTokens() > 0;
  }

  /**
   * Create from raw usage data
   */
  static fromUsageData(data: any): LoadedUsageEntry {
    const timestamp = new Date(data.timestamp);

    const usage = new TokenCounts({
      inputTokens: data.message?.usage?.input_tokens || 0,
      outputTokens: data.message?.usage?.output_tokens || 0,
      cacheCreationInputTokens: data.message?.usage?.cache_creation_input_tokens || 0,
      cacheReadInputTokens: data.message?.usage?.cache_read_input_tokens || 0,
    });

    // Extract usage limit reset time from error messages
    let usageLimitResetTime: Date | undefined;
    if (data.isApiErrorMessage && data.message?.content?.[0]?.text) {
      const match = data.message.content[0].text.match(
        /resets at (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/
      );
      if (match) {
        usageLimitResetTime = new Date(match[1]);
      }
    }

    const entryData: {
      timestamp: Date;
      usage: TokenCounts;
      costUSD: number | null;
      model: string;
      version?: string;
      usageLimitResetTime?: Date;
      messageId?: string;
      requestId?: string;
      isApiErrorMessage?: boolean;
      sourceFile?: string;
    } = {
      timestamp,
      usage,
      costUSD: data.message?.cost_usd || null,
      model: data.message?.model || 'unknown',
    };

    if (data.version !== undefined) {
      entryData.version = data.version;
    }
    if (usageLimitResetTime !== undefined) {
      entryData.usageLimitResetTime = usageLimitResetTime;
    }
    if (data.message?.id !== undefined) {
      entryData.messageId = data.message.id;
    }
    if (data.requestId !== undefined) {
      entryData.requestId = data.requestId;
    }
    if (data.isApiErrorMessage !== undefined) {
      entryData.isApiErrorMessage = data.isApiErrorMessage;
    }
    if (data.sourceFile !== undefined) {
      entryData.sourceFile = data.sourceFile;
    }

    return new LoadedUsageEntry(entryData);
  }
}
