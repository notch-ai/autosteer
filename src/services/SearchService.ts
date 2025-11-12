import { Index } from 'flexsearch';

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
    });

    this.items = items;
  }

  /**
   * Search with three-tier strategy
   */
  public search(query: string, getSearchFields: (item: T) => string[]): T[] {
    if (!query || query.trim().length === 0) {
      return this.items;
    }

    const normalizedQuery = this.config.caseSensitive ? query : query.toLowerCase();

    // Tier 1: Exact match (highest priority)
    const exactMatches = this.findExactMatches(normalizedQuery, getSearchFields);
    if (exactMatches.length > 0) {
      return exactMatches;
    }

    // Check if query has structure (hyphens/colons)
    const hasStructure = query.includes('-') || query.includes(':');

    // Tier 2: FlexSearch fuzzy matching (skip for structured queries)
    if (this.index && !hasStructure) {
      const results = this.index.search(normalizedQuery, {
        limit: this.config.limit || 20,
      });

      const fuzzyMatches = results.map((id) => this.items[Number(id)]).filter(Boolean);

      if (fuzzyMatches.length > 0) {
        return fuzzyMatches;
      }
    }

    // Tier 3: Fallback includes matching
    const fallbackMatches = this.items.filter((item) => {
      const fields = getSearchFields(item);
      return fields.some((field) => {
        const normalizedField = this.config.caseSensitive ? field : field.toLowerCase();
        return normalizedField.includes(normalizedQuery);
      });
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
