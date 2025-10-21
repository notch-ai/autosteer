import { SessionBlock, LoadedUsageEntry } from '@/entities';
import * as path from 'path';

interface SessionIdentifierOptions {
  sessionHours: number;
}

/**
 * Extract session ID (UUID) from file path
 */
function extractSessionId(filePath: string): string | undefined {
  const basename = path.basename(filePath, '.jsonl');
  // Check if it's a valid UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(basename) ? basename : undefined;
}

/**
 * Identify session blocks from a list of entries
 */
export function identifySessionBlocks(
  entries: LoadedUsageEntry[],
  options: SessionIdentifierOptions
): SessionBlock[] {
  if (entries.length === 0) {
    return [];
  }

  const { sessionHours } = options;
  const sessionMs = sessionHours * 60 * 60 * 1000;
  const blocks: SessionBlock[] = [];
  const now = new Date();

  // Sort entries by timestamp
  const sortedEntries = [...entries].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Group entries into session blocks
  for (const entry of sortedEntries) {
    const blockStart = floorToHour(entry.timestamp);
    const blockEnd = new Date(blockStart.getTime() + sessionMs);
    const blockId = blockStart.toISOString();

    // Find existing block or create new one
    let block = blocks.find((b) => b.id === blockId);
    if (!block) {
      const isActive = blockEnd > now;

      // Extract session ID from the first entry's source file
      const sessionId = entry.sourceFile ? extractSessionId(entry.sourceFile) : undefined;

      const blockData: {
        id: string;
        sessionId?: string;
        startTime: Date;
        endTime: Date;
        isActive: boolean;
        isGap: boolean;
      } = {
        id: blockId,
        startTime: blockStart,
        endTime: blockEnd,
        isActive,
        isGap: false,
      };

      if (sessionId !== undefined) {
        blockData.sessionId = sessionId;
      }

      block = new SessionBlock(blockData);
      blocks.push(block);
    }

    // Add entry to block
    block.addEntry(entry);
  }

  // Fill gaps between blocks
  const blocksWithGaps = fillGapBlocks(blocks, sessionMs, now);

  // Sort blocks by start time (newest first)
  return blocksWithGaps.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
}

/**
 * Floor a date to the nearest hour
 */
function floorToHour(date: Date): Date {
  const floored = new Date(date);
  floored.setMinutes(0, 0, 0);
  return floored;
}

/**
 * Fill gaps between session blocks
 */
function fillGapBlocks(blocks: SessionBlock[], sessionMs: number, now: Date): SessionBlock[] {
  if (blocks.length === 0) {
    return blocks;
  }

  const result: SessionBlock[] = [];
  const sortedBlocks = [...blocks].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  // Add first block
  result.push(sortedBlocks[0]);

  // Fill gaps between consecutive blocks
  for (let i = 1; i < sortedBlocks.length; i++) {
    const prevBlock = sortedBlocks[i - 1];
    const currBlock = sortedBlocks[i];

    // Check if there's a gap
    const gapStart = prevBlock.endTime;
    const gapEnd = currBlock.startTime;

    if (gapEnd > gapStart) {
      // Create gap blocks
      let currentGapStart = gapStart;
      while (currentGapStart < gapEnd) {
        const currentGapEnd = new Date(
          Math.min(currentGapStart.getTime() + sessionMs, gapEnd.getTime())
        );

        const gapBlock = new SessionBlock({
          id: currentGapStart.toISOString(),
          startTime: currentGapStart,
          endTime: currentGapEnd,
          isActive: currentGapEnd > now,
          isGap: true,
        });

        result.push(gapBlock);
        currentGapStart = currentGapEnd;
      }
    }

    result.push(currBlock);
  }

  return result;
}
