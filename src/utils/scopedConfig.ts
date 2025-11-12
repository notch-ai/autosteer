/**
 * Utility for loading and merging scoped configuration files
 * Following Claude Code's scope overlay rules:
 * - User scope: <project>/.claude.local/ (git-ignored, highest precedence)
 *
 * Overlay rules: user > project > global
 */

import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import log from 'electron-log';
import * as os from 'os';
import * as path from 'path';

export interface ScopedConfigOptions {
  /**
   * Current working directory (project root)
   */
  cwd?: string;
  /**
   * Enable debug logging
   */
  debug?: boolean;
}

/**
 * Deep merge two objects
 * Later object takes precedence for conflicts
 * Arrays are replaced, not concatenated
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        // Recursively merge objects
        result[key] = deepMerge(targetValue, sourceValue);
      } else if (sourceValue !== undefined) {
        // Override arrays, primitives, and null values
        result[key] = sourceValue as any;
      }
    }
  }

  return result;
}

/**
 * Load and parse JSON file safely
 */
async function loadJsonFile<T = any>(filePath: string): Promise<T | null> {
  try {
    if (!existsSync(filePath)) {
      return null;
    }

    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    log.warn(`[ScopedConfig] Failed to load ${filePath}:`, error);
    return null;
  }
}

/**
 * Get scoped configuration data by merging global, project, and user configs
 *
 * @param filename - Configuration filename (e.g., '.mcp.json', 'settings.json')
 * @param options - Configuration options
 * @returns Merged configuration object
 *
 * @example
 * ```ts
 * const config = await getScopedData('.mcp.json', { cwd: '/path/to/project' });
 * const mcpServers = config.mcpServers || {};
 * ```
 */
export async function getScopedData<T extends Record<string, any> = Record<string, any>>(
  filename: string,
  options: ScopedConfigOptions = {}
): Promise<T> {
  const { cwd = process.cwd(), debug = false } = options;
  const homedir = os.homedir();

  // Define scope paths
  const globalPath = path.join(homedir, '.claude', filename);
  const projectPath = path.join(cwd, '.claude', filename);
  const userPath = path.join(cwd, '.claude.local', filename);

  // Also check root of project for convenience (e.g., .mcp.json at root)
  const rootPath = path.join(cwd, filename);

  if (debug) {
    log.debug('[ScopedConfig] Loading scoped configuration:', {
      filename,
      cwd,
      globalPath,
      projectPath,
      userPath,
      rootPath,
    });
  }

  // Load all config files in order
  const [globalConfig, projectConfig, rootConfig, userConfig] = await Promise.all([
    loadJsonFile<T>(globalPath),
    loadJsonFile<T>(projectPath),
    loadJsonFile<T>(rootPath),
    loadJsonFile<T>(userPath),
  ]);

  if (debug) {
    log.debug('[ScopedConfig] Loaded configs:', {
      hasGlobal: !!globalConfig,
      hasProject: !!projectConfig,
      hasRoot: !!rootConfig,
      hasUser: !!userConfig,
    });
  }

  // Merge in order: global -> project -> root -> user (user has highest precedence)
  let merged = {} as T;

  if (globalConfig) {
    merged = deepMerge(merged, globalConfig);
    if (debug) log.debug('[ScopedConfig] After global merge:', merged);
  }

  if (projectConfig) {
    merged = deepMerge(merged, projectConfig);
    if (debug) log.debug('[ScopedConfig] After project merge:', merged);
  }

  if (rootConfig) {
    merged = deepMerge(merged, rootConfig);
    if (debug) log.debug('[ScopedConfig] After root merge:', merged);
  }

  if (userConfig) {
    merged = deepMerge(merged, userConfig);
    if (debug) log.debug('[ScopedConfig] After user merge:', merged);
  }

  if (debug) {
    log.debug('[ScopedConfig] Final merged config:', merged);
  }

  return merged;
}

/**
 * Get scoped MCP server configuration
 * Convenience wrapper around getScopedData for .mcp.json
 */
export async function getScopedMcpConfig(
  options: ScopedConfigOptions = {}
): Promise<{ mcpServers?: Record<string, any> }> {
  return getScopedData<{ mcpServers?: Record<string, any> }>('.mcp.json', options);
}
