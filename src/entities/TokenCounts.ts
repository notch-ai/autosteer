/**
 * Token usage breakdown by type
 */
export class TokenCounts {
  /**
   * Number of input tokens
   */
  inputTokens: number;

  /**
   * Number of output tokens
   */
  outputTokens: number;

  /**
   * Number of cache creation input tokens
   */
  cacheCreationInputTokens: number;

  /**
   * Number of cache read input tokens
   */
  cacheReadInputTokens: number;

  constructor(data?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  }) {
    this.inputTokens = data?.inputTokens || 0;
    this.outputTokens = data?.outputTokens || 0;
    this.cacheCreationInputTokens = data?.cacheCreationInputTokens || 0;
    this.cacheReadInputTokens = data?.cacheReadInputTokens || 0;
  }

  /**
   * Get total number of tokens
   */
  getTotal(): number {
    return (
      this.inputTokens +
      this.outputTokens +
      this.cacheCreationInputTokens +
      this.cacheReadInputTokens
    );
  }

  /**
   * Add another TokenCounts to this one
   */
  add(other: TokenCounts): void {
    this.inputTokens += other.inputTokens;
    this.outputTokens += other.outputTokens;
    this.cacheCreationInputTokens += other.cacheCreationInputTokens;
    this.cacheReadInputTokens += other.cacheReadInputTokens;
  }

  /**
   * Create a copy of this TokenCounts
   */
  clone(): TokenCounts {
    return new TokenCounts({
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      cacheCreationInputTokens: this.cacheCreationInputTokens,
      cacheReadInputTokens: this.cacheReadInputTokens,
    });
  }

  /**
   * Reset all counts to zero
   */
  reset(): void {
    this.inputTokens = 0;
    this.outputTokens = 0;
    this.cacheCreationInputTokens = 0;
    this.cacheReadInputTokens = 0;
  }

  /**
   * Check if all counts are zero
   */
  isEmpty(): boolean {
    return this.getTotal() === 0;
  }
}
