import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { glob } from 'glob';
import { UsageData } from '../interfaces/types';

/**
 * Expand tilde in path to home directory
 */
function expandPath(filePath: string): string {
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

/**
 * Find all usage files matching the pattern in the given paths
 */
export async function globUsageFiles(
  claudePaths: string[],
  filePattern: string
): Promise<string[]> {
  const files: string[] = [];

  for (const claudePath of claudePaths) {
    const expandedPath = expandPath(claudePath);

    try {
      const pattern = path.join(expandedPath, filePattern);
      const matches = await glob(pattern, {
        absolute: true,
        nodir: true,
      });
      files.push(...matches);
    } catch (error) {
      // Path might not exist, continue with next
      continue;
    }
  }

  return files;
}

/**
 * Get the earliest timestamp from a JSONL file
 */
export async function getEarliestTimestamp(filePath: string): Promise<Date | null> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content
      .trim()
      .split('\n')
      .filter((line) => line.trim());

    if (lines.length === 0) {
      return null;
    }

    // Parse first line
    const firstLine = JSON.parse(lines[0]) as UsageData;
    return new Date(firstLine.timestamp);
  } catch (error) {
    return null;
  }
}

/**
 * Parse a usage JSONL file and return all valid entries
 */
export async function parseUsageFile(filePath: string): Promise<UsageData[]> {
  const entries: UsageData[] = [];

  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content
      .trim()
      .split('\n')
      .filter((line) => line.trim());

    for (const line of lines) {
      try {
        const data = JSON.parse(line) as UsageData & { sourceFile?: string };
        // Add sourceFile to the data
        data.sourceFile = filePath;
        entries.push(data);
      } catch (error) {
        // Skip invalid JSON lines
        continue;
      }
    }
  } catch (error) {
    // File read error, return empty array
  }

  return entries;
}

/**
 * Sort files by their earliest timestamp
 */
export async function sortFilesByTimestamp(files: string[]): Promise<string[]> {
  const fileTimestamps: Map<string, Date> = new Map();

  // Get timestamps for all files
  for (const file of files) {
    const timestamp = await getEarliestTimestamp(file);
    if (timestamp) {
      fileTimestamps.set(file, timestamp);
    }
  }

  // Sort files by timestamp
  return files
    .filter((file) => fileTimestamps.has(file))
    .sort((a, b) => {
      const timeA = fileTimestamps.get(a)!;
      const timeB = fileTimestamps.get(b)!;
      return timeA.getTime() - timeB.getTime();
    });
}
