import { logger } from '@/commons/utils/logger';
import { ComputedMessage } from '@/stores/chat.selectors';

/**
 * MessageHeightEstimator - Caches and estimates message heights for virtual scrolling
 *
 * Provides height estimation for messages before they're rendered, and caches
 * actual measured heights for more accurate future estimates.
 *
 */
export class MessageHeightEstimator {
  private cache = new Map<string, number>();
  private readonly BASE_HEIGHT = 80; // Header + padding
  private readonly LINE_HEIGHT = 24;
  private readonly CHARS_PER_LINE = 80;
  private readonly TOOL_HEIGHT = 40; // Height per tool

  /**
   * Estimate the height of a message based on its content
   * Returns cached height if available, otherwise calculates estimate
   */
  estimate(message: ComputedMessage): number {
    const cached = this.cache.get(message.id);
    if (cached !== undefined) {
      return cached;
    }

    // Calculate estimated height based on content
    const contentLines = this.calculateContentLines(message.content);
    const toolsHeight = this.calculateToolsHeight(message.toolCalls?.length ?? 0);

    const estimated = this.BASE_HEIGHT + contentLines * this.LINE_HEIGHT + toolsHeight;

    logger.debug('[MessageHeightEstimator] Estimated height', {
      messageId: message.id,
      height: estimated,
      contentLines,
      toolsHeight,
    });

    this.cache.set(message.id, estimated);
    return estimated;
  }

  /**
   * Update the cache with the actual measured height of a message
   */
  measure(messageId: string, actualHeight: number): void {
    const previousHeight = this.cache.get(messageId);
    this.cache.set(messageId, actualHeight);

    logger.debug('[MessageHeightEstimator] Measured height', {
      messageId,
      actual: actualHeight,
      previous: previousHeight,
      delta: previousHeight ? actualHeight - previousHeight : null,
    });
  }

  /**
   * Clear the entire cache
   */
  clearCache(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.debug('[MessageHeightEstimator] Cache cleared', { previousSize: size });
  }

  /**
   * Get the current cache size (for debugging/monitoring)
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Calculate the number of lines needed for content
   */
  private calculateContentLines(content: string): number {
    if (!content) return 1;

    // Count explicit newlines
    const explicitLines = content.split('\n').length;

    // Estimate wrapped lines based on character count
    const charCount = content.length;
    const wrappedLines = Math.ceil(charCount / this.CHARS_PER_LINE);

    // Use the larger of the two estimates
    return Math.max(explicitLines, wrappedLines);
  }

  /**
   * Calculate height contribution from tools
   */
  private calculateToolsHeight(toolCount: number): number {
    return toolCount * this.TOOL_HEIGHT;
  }
}
