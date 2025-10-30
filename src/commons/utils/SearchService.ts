import { Index } from 'flexsearch';
import { logger } from './logger';

/**
 * SearchService - Unified FlexSearch implementation for git repos, files, and slash commands
 *
 * Features:
 * - Three-tier search strategy: exact match -> fuzzy (FlexSearch) -> fallback includes
 * - Fuzzy search enabled with context-aware matching
 * - Comprehensive logging for debugging
 * - Special handling for structured queries (with hyphens/colons)
 */

export interface SearchConfig {
  name: string; // For logging: 'SlashCommand', 'FileMentions', 'GitRepo'
  limit?: number;
  caseSensitive?: boolean;
}

// Simplified constraint - T can be any type
export class SearchService<T> {
  private index: Index | null = null;
  private items: T[] = [];
  private config: SearchConfig;

  constructor(config: SearchConfig) {
    this.config = {
      limit: 20,
      caseSensitive: false,
      ...config,
    };
  }

  /**
   * Initialize the FlexSearch index with items
   */
  public initializeIndex(items: T[], getSearchText: (item: T) => string): void {
    logger.debug(`[${this.config.name}] Initializing FlexSearch index:`, {
      totalItems: items.length,
      config: {
        tokenize: 'full',
        resolution: 9,
        fuzzySearch: 'enabled (context-aware)',
      },
    });

    // Create FlexSearch index with fuzzy search enabled
    this.index = new Index({
      tokenize: 'full',
      resolution: 9,
      context: {
        resolution: 3,
        depth: 2,
        bidirectional: true,
      },
    });

    // Index all items
    items.forEach((item, idx) => {
      const searchText = getSearchText(item);
      this.index!.add(idx, searchText);

      // Log first few items for debugging
      if (idx < 3) {
        logger.debug(`[${this.config.name}] Indexed item [${idx}]:`, {
          searchText: searchText.substring(0, 100), // Truncate for readability
        });
      }
    });

    this.items = items;
    logger.debug(`[${this.config.name}] FlexSearch index initialized successfully`);
  }

  /**
   * Search with three-tier strategy
   */
  public search(query: string, getSearchFields: (item: T) => string[]): T[] {
    if (!query || query.trim().length === 0) {
      return this.items;
    }

    const normalizedQuery = this.config.caseSensitive ? query : query.toLowerCase();

    logger.debug(`[${this.config.name}] Searching for query:`, {
      query,
      totalItems: this.items.length,
    });

    // Tier 1: Exact match (highest priority)
    const exactMatches = this.findExactMatches(normalizedQuery, getSearchFields);
    if (exactMatches.length > 0) {
      logger.debug(`[${this.config.name}] Found exact matches:`, {
        count: exactMatches.length,
      });
      return exactMatches;
    }

    // Check if query has structure (hyphens/colons)
    const hasStructure = query.includes('-') || query.includes(':');

    // Tier 2: FlexSearch fuzzy matching (skip for structured queries)
    if (this.index && !hasStructure) {
      logger.debug(`[${this.config.name}] Using FlexSearch fuzzy matching:`, {
        query: normalizedQuery,
        config: {
          tokenize: 'full',
          resolution: 9,
          context: {
            resolution: 3,
            depth: 2,
            bidirectional: true,
          },
          fuzzyEnabled: true,
        },
      });

      const results = this.index.search(normalizedQuery, {
        limit: this.config.limit || 20,
      });

      logger.debug(`[${this.config.name}] FlexSearch raw results:`, {
        resultCount: results.length,
        resultIndices: results,
      });

      const fuzzyMatches = results.map((id) => this.items[Number(id)]).filter(Boolean);

      if (fuzzyMatches.length > 0) {
        // Log the first 5 matches with their search fields for debugging
        const matchDetails = fuzzyMatches.slice(0, 5).map((item: T, idx: number) => {
          const fields = getSearchFields(item);
          return {
            index: idx,
            searchableFields: fields,
            item: JSON.stringify(item).substring(0, 100), // Truncate for readability
          };
        });

        logger.debug(`[${this.config.name}] Found fuzzy matches:`, {
          count: fuzzyMatches.length,
          sampleMatches: matchDetails,
          fuzzyMatchingEnabled: true,
        });
        return fuzzyMatches;
      } else {
        logger.debug(`[${this.config.name}] FlexSearch returned no results`, {
          query: normalizedQuery,
          willUseFallback: true,
        });
      }
    } else if (hasStructure) {
      logger.debug(`[${this.config.name}] Structured query detected, skipping FlexSearch:`, {
        query,
        reason: 'Contains hyphens or colons - using fallback for exact phrase matching',
      });
    }

    // Tier 3: Fallback includes matching
    logger.debug(`[${this.config.name}] No FlexSearch matches, using fallback includes matching`);

    const fallbackMatches = this.items.filter((item) => {
      const fields = getSearchFields(item);
      return fields.some((field) => {
        const normalizedField = this.config.caseSensitive ? field : field.toLowerCase();
        return normalizedField.includes(normalizedQuery);
      });
    });

    logger.debug(`[${this.config.name}] Fallback matches:`, {
      count: fallbackMatches.length,
    });

    return fallbackMatches;
  }

  private findExactMatches(normalizedQuery: string, getSearchFields: (item: T) => string[]): T[] {
    return this.items.filter((item) => {
      const fields = getSearchFields(item);
      return fields.some((field) => {
        const normalizedField = this.config.caseSensitive ? field : field.toLowerCase();
        return normalizedField === normalizedQuery;
      });
    });
  }
}
