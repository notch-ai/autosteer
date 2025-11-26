import { useContextUsageStore } from '@/stores';
import { useMemo } from 'react';

interface ContextUsageIndicatorProps {
  agentId: string | null;
  inline?: boolean;
}

// Helper function to format token counts
const formatTokenCount = (count: number): string => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};

export const ContextUsageIndicator: React.FC<ContextUsageIndicatorProps> = ({
  agentId,
  inline = false,
}) => {
  // Subscribe to the entire agentContextUsage map to trigger re-renders
  const agentContextUsage = useContextUsageStore((state) => state.agentContextUsage);
  const getAgentContextUsage = useContextUsageStore((state) => state.getAgentContextUsage);

  const { usage, percentage, indicatorColor, primaryModel } = useMemo(() => {
    // Get success green color from CSS variable (#10b981)
    const successColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--base-success-alt')
      .trim();

    if (!agentId) {
      return { usage: null, percentage: 0, indicatorColor: successColor, primaryModel: null };
    }

    const usage = getAgentContextUsage(agentId);
    if (!usage || !usage.modelUsage || Object.keys(usage.modelUsage).length === 0) {
      return { usage: null, percentage: 0, indicatorColor: successColor, primaryModel: null };
    }

    // Find primary model (model with highest total token count)
    let primaryModel: string | null = null;
    let maxTokens = 0;

    for (const [modelName, modelData] of Object.entries(usage.modelUsage)) {
      // Context window = fresh input + cache creation (NOT cache reads or output)
      const totalTokens = modelData.inputTokens + modelData.cacheCreationInputTokens;

      if (totalTokens > maxTokens) {
        maxTokens = totalTokens;
        primaryModel = modelName;
      }
    }

    if (!primaryModel) {
      return { usage, percentage: 0, indicatorColor: successColor, primaryModel: null };
    }

    const modelData = usage.modelUsage[primaryModel];
    // Context window = fresh input + cache creation (NOT cache reads or output)
    const totalTokens = modelData.inputTokens + modelData.cacheCreationInputTokens;
    const percentage = (totalTokens / modelData.contextWindow) * 100;

    // Color-coded indicator - use CSS variables for theme colors
    let indicatorColor = successColor;
    if (percentage >= 80) {
      // Use destructive color for high usage
      indicatorColor = `rgb(${getComputedStyle(document.documentElement).getPropertyValue('--destructive').trim()})`;
    } else if (percentage >= 50) {
      // Use warning color for medium usage
      indicatorColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--base-warning')
        .trim();
    }

    return { usage, percentage, indicatorColor, primaryModel };
  }, [agentId, getAgentContextUsage, agentContextUsage]);

  if (!usage || !primaryModel) {
    return null;
  }

  const modelData = usage.modelUsage[primaryModel];
  // Context window = fresh input + cache creation (NOT cache reads or output)
  const totalTokens = modelData.inputTokens + modelData.cacheCreationInputTokens;

  // Inline compact version for toolbar
  if (inline) {
    return (
      <div className="flex items-center gap-1 text-sm">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: indicatorColor }} />
        <span style={{ color: indicatorColor }}>{percentage.toFixed(1)}%</span>
        <span className="text-muted-foreground/70">
          ({formatTokenCount(totalTokens)}/{formatTokenCount(modelData.contextWindow)})
        </span>
      </div>
    );
  }

  return null;
};
