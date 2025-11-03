import React, { useEffect } from 'react';
import { useMonitoringStore } from '@/stores';
import { formatCostUSD } from '@/monitoring/utils/costCalculator';

export const UsageStats: React.FC = () => {
  const { isInitialized, activeSession, error, initialize, fetchActiveSession } =
    useMonitoringStore();

  useEffect(() => {
    // Initialize monitoring on component mount
    if (!isInitialized) {
      initialize().then(() => {
        fetchActiveSession();
      });
    }

    // Set up polling interval
    const interval = setInterval(() => {
      if (isInitialized) {
        fetchActiveSession();
      }
    }, 30000); // Poll every 30 seconds

    // Cleanup on unmount
    return () => {
      clearInterval(interval);
    };
  }, [isInitialized, initialize, fetchActiveSession]);

  if (error) {
    return (
      <div>
        <div>Error: {error}</div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div>
        <div>No active session</div>
      </div>
    );
  }

  const totalTokens = activeSession.getTotalTokens();
  const duration = activeSession.getDuration();
  const durationMinutes = Math.round(duration / 1000 / 60);

  return (
    <div>
      <div>
        <h3>Current Session</h3>
        {activeSession.isActive && <span>Active</span>}
      </div>

      <div>
        <div>
          <div>Duration</div>
          <div>{durationMinutes} min</div>
        </div>

        <div>
          <div>Total Tokens</div>
          <div>{totalTokens.toLocaleString()}</div>
        </div>

        <div>
          <div>Cost</div>
          <div>{formatCostUSD(activeSession.costUSD)}</div>
        </div>

        <div>
          <div>Models</div>
          <div>
            {activeSession.models.map((model, index) => (
              <span key={index}>{model}</span>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h4>Token Breakdown</h4>
        <div>
          <div>
            <span>Input:</span>
            <span>{activeSession.tokenCounts.inputTokens.toLocaleString()}</span>
          </div>
          <div>
            <span>Output:</span>
            <span>{activeSession.tokenCounts.outputTokens.toLocaleString()}</span>
          </div>
          {activeSession.tokenCounts.cacheCreationInputTokens > 0 && (
            <div>
              <span>Cache Creation:</span>
              <span>{activeSession.tokenCounts.cacheCreationInputTokens.toLocaleString()}</span>
            </div>
          )}
          {activeSession.tokenCounts.cacheReadInputTokens > 0 && (
            <div>
              <span>Cache Read:</span>
              <span>{activeSession.tokenCounts.cacheReadInputTokens.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {activeSession.usageLimitResetTime && (
        <div>
          <div>
            Usage limit resets at: {new Date(activeSession.usageLimitResetTime).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
};
