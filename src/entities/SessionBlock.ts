import { LoadedUsageEntry } from './LoadedUsageEntry';
import { TokenCounts } from './TokenCounts';

/**
 * Represents a session block - a time-grouped collection of usage entries
 */
export class SessionBlock {
  /**
   * Unique identifier (ISO string of block start time)
   */
  id: string;

  /**
   * Session ID (UUID from the Claude Code session file)
   */
  sessionId?: string;

  /**
   * Start time of the session block
   */
  startTime: Date;

  /**
   * End time of the session block (typically startTime + sessionHours)
   */
  endTime: Date;

  /**
   * Actual end time based on the last entry's timestamp
   */
  actualEndTime?: Date;

  /**
   * Whether this block is currently active
   */
  isActive: boolean;

  /**
   * Whether this is a gap block (no entries)
   */
  isGap?: boolean;

  /**
   * Entries within this session block
   */
  entries: LoadedUsageEntry[];

  /**
   * Aggregated token counts for the block
   */
  tokenCounts: TokenCounts;

  /**
   * Total cost in USD for the block
   */
  costUSD: number;

  /**
   * Unique models used in this block
   */
  models: string[];

  /**
   * Usage limit reset time if encountered
   */
  usageLimitResetTime?: Date;

  constructor(data: {
    id: string;
    sessionId?: string;
    startTime: Date;
    endTime: Date;
    actualEndTime?: Date;
    isActive: boolean;
    isGap?: boolean;
    entries?: LoadedUsageEntry[];
    tokenCounts?: TokenCounts;
    costUSD?: number;
    models?: string[];
    usageLimitResetTime?: Date;
  }) {
    this.id = data.id;
    if (data.sessionId !== undefined) {
      this.sessionId = data.sessionId;
    }
    this.startTime = data.startTime;
    this.endTime = data.endTime;
    if (data.actualEndTime !== undefined) {
      this.actualEndTime = data.actualEndTime;
    }
    this.isActive = data.isActive;
    if (data.isGap !== undefined) {
      this.isGap = data.isGap;
    }
    this.entries = data.entries || [];
    this.tokenCounts =
      data.tokenCounts ||
      new TokenCounts({
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      });
    this.costUSD = data.costUSD || 0;
    this.models = data.models || [];
    if (data.usageLimitResetTime !== undefined) {
      this.usageLimitResetTime = data.usageLimitResetTime;
    }
  }

  /**
   * Add an entry to this session block
   */
  addEntry(entry: LoadedUsageEntry): void {
    this.entries.push(entry);

    // Update token counts
    this.tokenCounts.inputTokens += entry.usage.inputTokens;
    this.tokenCounts.outputTokens += entry.usage.outputTokens;
    this.tokenCounts.cacheCreationInputTokens += entry.usage.cacheCreationInputTokens;
    this.tokenCounts.cacheReadInputTokens += entry.usage.cacheReadInputTokens;

    // Update cost
    if (entry.costUSD !== null) {
      this.costUSD += entry.costUSD;
    }

    // Update models
    if (!this.models.includes(entry.model)) {
      this.models.push(entry.model);
    }

    // Update actual end time
    if (!this.actualEndTime || entry.timestamp > this.actualEndTime) {
      this.actualEndTime = entry.timestamp;
    }

    // Update usage limit reset time
    if (
      entry.usageLimitResetTime &&
      (!this.usageLimitResetTime || entry.usageLimitResetTime > this.usageLimitResetTime)
    ) {
      this.usageLimitResetTime = entry.usageLimitResetTime;
    }
  }

  /**
   * Get the duration of this session block in milliseconds
   */
  getDuration(): number {
    const end = this.actualEndTime || this.endTime;
    return end.getTime() - this.startTime.getTime();
  }

  /**
   * Get the total number of tokens used
   */
  getTotalTokens(): number {
    return (
      this.tokenCounts.inputTokens +
      this.tokenCounts.outputTokens +
      this.tokenCounts.cacheCreationInputTokens +
      this.tokenCounts.cacheReadInputTokens
    );
  }
}
