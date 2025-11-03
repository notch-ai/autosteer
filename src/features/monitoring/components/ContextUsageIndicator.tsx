import { useContextUsageStore } from '@/stores';
import { useMemo } from 'react';
import { Circle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
    if (!agentId) {
      return { usage: null, percentage: 0, indicatorColor: 'text-green-500', primaryModel: null };
    }

    const usage = getAgentContextUsage(agentId);
    if (!usage || !usage.modelUsage || Object.keys(usage.modelUsage).length === 0) {
      return { usage: null, percentage: 0, indicatorColor: 'text-green-500', primaryModel: null };
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
      return { usage, percentage: 0, indicatorColor: 'text-green-500', primaryModel: null };
    }

    const modelData = usage.modelUsage[primaryModel];
    // Context window = fresh input + cache creation (NOT cache reads or output)
    const totalTokens = modelData.inputTokens + modelData.cacheCreationInputTokens;
    const percentage = (totalTokens / modelData.contextWindow) * 100;

    // Color-coded indicator
    let indicatorColor = 'text-green-500';
    if (percentage >= 80) {
      indicatorColor = 'text-red-500';
    } else if (percentage >= 50) {
      indicatorColor = 'text-yellow-500';
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
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-sm cursor-default">
              <Circle className={`w-3 h-3 ${indicatorColor} fill-current`} />
              <span className={indicatorColor}>{percentage.toFixed(1)}%</span>
              <span className="text-text-muted/70">
                ({formatTokenCount(totalTokens)}/{formatTokenCount(modelData.contextWindow)})
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" align="start" className="max-w-sm">
            <div className="space-y-2">
              <div className="font-semibold text-sm">Context Usage Details</div>
              {percentage >= 80 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded px-2 py-1.5 text-sm">
                  <div className="font-medium text-destructive mb-0.5">
                    ⚠️ Context limit approaching
                  </div>
                  <div className="text-text-muted">
                    Consider running <code className="bg-background px-1 rounded">/compact</code> to
                    free up space
                  </div>
                </div>
              )}
              {Object.entries(usage.modelUsage).map(([modelName, data]) => {
                // Context window = fresh input + cache creation (NOT cache reads or output)
                const modelTotal = data.inputTokens + data.cacheCreationInputTokens;
                const modelPercentage = (modelTotal / data.contextWindow) * 100;

                return (
                  <div key={modelName} className="space-y-1">
                    <div className="text-sm font-medium">{modelName}</div>
                    <div className="text-sm text-text-muted space-y-0.5 pl-2">
                      <div>Input: {formatTokenCount(data.inputTokens)}</div>
                      <div>Output: {formatTokenCount(data.outputTokens)}</div>
                      {data.cacheReadInputTokens > 0 && (
                        <div>Cache Read: {formatTokenCount(data.cacheReadInputTokens)}</div>
                      )}
                      {data.cacheCreationInputTokens > 0 && (
                        <div>Cache Write: {formatTokenCount(data.cacheCreationInputTokens)}</div>
                      )}
                      <div className="pt-0.5 border-t border-border mt-1">
                        Total: {formatTokenCount(modelTotal)}/{formatTokenCount(data.contextWindow)}{' '}
                        ({modelPercentage.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return null;
};
