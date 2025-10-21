/**
 * Token usage breakdown by type
 */
export interface TokenCounts {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

/**
 * Raw usage data from Claude's JSONL files
 */
export interface UsageData {
  timestamp: string; // ISO format
  version?: string;
  message: {
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
    model?: string;
    id?: string;
    content?: Array<{ text?: string }>;
  };
  costUSD?: number;
  requestId?: string;
  isApiErrorMessage?: boolean;
}

/**
 * Configuration for the monitoring system
 */
export interface MonitoringConfig {
  /**
   * Paths to Claude data directories
   * Default: ["~/.config/claude/projects/", "~/.claude/projects/"]
   */
  claudePaths?: string[];

  /**
   * Session duration in hours
   * Default: 5
   */
  sessionHours?: number;

  /**
   * Cost calculation mode
   * - 'display': Use pre-calculated costUSD from data
   * - 'calculate': Always calculate from tokens
   * - 'auto': Use costUSD if available, otherwise calculate
   * Default: 'auto'
   */
  costMode?: 'display' | 'calculate' | 'auto';

  /**
   * File glob pattern for usage files
   * Default: "**\/*.jsonl"
   */
  filePattern?: string;

  /**
   * Enable debug logging
   * Default: false
   */
  debug?: boolean;
}
