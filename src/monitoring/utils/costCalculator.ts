import { LoadedUsageEntry } from '@/entities';

/**
 * Pricing data for different models
 * Prices are per 1M tokens
 */
const PRICING_DATA: Record<string, { input: number; output: number }> = {
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-5-sonnet-20240620': { input: 3.0, output: 15.0 },
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
  'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-3-5-haiku-20241022': { input: 1.0, output: 5.0 },
  // Claude 4 models
  'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
  'claude-opus-4-1-20250805': { input: 15.0, output: 75.0 },
  'claude-opus-4-5-20251101': { input: 5.0, output: 25.0 },
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
  // Default fallback
  default: { input: 3.0, output: 15.0 },
};

/**
 * Calculate cost for a usage entry based on token counts
 */
export function calculateCostForEntry(entry: LoadedUsageEntry): number {
  const pricing = PRICING_DATA[entry.model] || PRICING_DATA.default;

  // Calculate costs per component
  const inputCost = (entry.usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (entry.usage.outputTokens / 1_000_000) * pricing.output;

  // Cache tokens use the same pricing as input tokens
  const cacheCreationCost = (entry.usage.cacheCreationInputTokens / 1_000_000) * pricing.input;
  const cacheReadCost = (entry.usage.cacheReadInputTokens / 1_000_000) * pricing.input;

  // Total cost
  const totalCost = inputCost + outputCost + cacheCreationCost + cacheReadCost;

  // Round to reasonable precision (6 decimal places)
  return Math.round(totalCost * 1_000_000) / 1_000_000;
}

/**
 * Format cost as USD string
 */
export function formatCostUSD(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(6)}`;
  } else if (cost < 1) {
    return `$${cost.toFixed(4)}`;
  } else {
    return `$${cost.toFixed(2)}`;
  }
}

/**
 * Get pricing info for a model
 */
export function getModelPricing(model: string): { input: number; output: number } {
  return PRICING_DATA[model] || PRICING_DATA.default;
}
