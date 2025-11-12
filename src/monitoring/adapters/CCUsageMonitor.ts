import { LoadedUsageEntry, SessionBlock } from '@/entities';
import { logger } from '@/commons/utils/logger';
import { UserMonitor } from '../interfaces/UserMonitor';
import { MonitoringConfig, UsageData } from '../interfaces/types';
import { calculateCostForEntry } from '../utils/costCalculator';
import {
  getEarliestTimestamp,
  globUsageFiles,
  parseUsageFile,
  sortFilesByTimestamp,
} from '../utils/fileUtils';
import { identifySessionBlocks } from '../utils/sessionIdentifier';

/**
 * Claude Code Usage Monitor implementation
 * Monitors usage data from Claude Code's JSONL files with incremental loading
 */
export class CCUsageMonitor implements UserMonitor {
  private config: MonitoringConfig;
  private fileTimestamps: Map<string, Date> = new Map();
  private processedHashes: Set<string> = new Set();
  private entries: LoadedUsageEntry[] = [];

  constructor(config?: MonitoringConfig) {
    this.config = {
      sessionHours: config?.sessionHours || 5,
      costMode: config?.costMode || 'auto',
      filePattern: config?.filePattern || '**/*.jsonl',
      debug: config?.debug || false,
    };
  }

  /**
   * Get the currently active session block
   */
  async getActiveBlock(): Promise<SessionBlock | null> {
    await this.loadNewEntries();

    const blocks = identifySessionBlocks(this.entries, {
      sessionHours: this.config.sessionHours!,
    });

    // Find the active block
    const activeBlock = blocks.find((block) => block.isActive);
    return activeBlock || null;
  }

  /**
   * Get all session blocks
   */
  async getAllBlocks(): Promise<SessionBlock[]> {
    await this.loadNewEntries();

    return identifySessionBlocks(this.entries, {
      sessionHours: this.config.sessionHours!,
    });
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.fileTimestamps.clear();
    this.processedHashes.clear();
    this.entries = [];

    if (this.config.debug) {
      logger.debug('[CCUsageMonitor] Cache cleared');
    }
  }

  /**
   * Dispose of resources
   */
  [Symbol.dispose](): void {
    this.clearCache();
  }

  /**
   * Load new entries from files (incremental loading)
   */
  private async loadNewEntries(): Promise<void> {
    // Get all usage files
    const files = await globUsageFiles(this.config.claudePaths!, this.config.filePattern!);

    if (files.length === 0) {
      if (this.config.debug) {
        logger.debug(
          '[CCUsageMonitor] No usage files found in paths:',
          this.config.claudePaths,
          'with pattern:',
          this.config.filePattern
        );
      }
      return;
    }

    // Sort files by timestamp
    const sortedFiles = await sortFilesByTimestamp(files);

    // Process each file
    for (const file of sortedFiles) {
      const fileTimestamp = await getEarliestTimestamp(file);
      if (!fileTimestamp) continue;

      // Check if file has been modified since last check
      const lastTimestamp = this.fileTimestamps.get(file);
      if (lastTimestamp && fileTimestamp <= lastTimestamp) {
        continue; // Skip unchanged files
      }

      // Parse the file
      const usageData = await parseUsageFile(file);

      // Process new entries
      for (const data of usageData) {
        const entry = this.processUsageData(data);
        if (entry) {
          this.entries.push(entry);
        }
      }

      // Update file timestamp
      this.fileTimestamps.set(file, fileTimestamp);
    }

    // Sort entries by timestamp
    this.entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (this.config.debug) {
      logger.debug(`[CCUsageMonitor] Loaded ${this.entries.length} total entries`);
    }
  }

  /**
   * Process raw usage data into LoadedUsageEntry
   */
  private processUsageData(data: UsageData): LoadedUsageEntry | null {
    try {
      // Create entry from usage data
      const entry = LoadedUsageEntry.fromUsageData(data);

      // Check for duplicates
      const hash = entry.getUniqueHash();
      if (this.processedHashes.has(hash)) {
        return null;
      }
      this.processedHashes.add(hash);

      // Skip entries with no usage
      if (!entry.hasValidUsage()) {
        return null;
      }

      // Calculate cost if needed
      if (entry.costUSD === null && this.config.costMode !== 'display') {
        entry.costUSD = calculateCostForEntry(entry);
      }

      return entry;
    } catch (error) {
      if (this.config.debug) {
        logger.error('[CCUsageMonitor] Error processing usage data:', error);
      }
      return null;
    }
  }
}
