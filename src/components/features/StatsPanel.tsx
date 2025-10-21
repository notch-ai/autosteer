import React from 'react';
import { useCoreStore } from '@/stores/core';
import { Icon } from './Icon';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface StatsPanelProps {
  projectId: string;
  className?: string;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ projectId, className }) => {
  const stats = useCoreStore((state) => state.worktreeStats[projectId]);

  // Format numbers with commas
  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  // Format cost with dollar sign and 2-4 decimal places
  const formatCost = (cost: number) => {
    if (cost === 0) return '$0.00';
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(2)}`;
  };

  if (!stats || stats.messageCount === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="info" size={20} />
            Session Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center text-center py-8">
            <Icon name="list" size={24} className="text-muted-foreground mb-2" />
            <p className="text-sm font-medium text-foreground mb-1">No messages sent yet</p>
            <p className="text-sm text-muted-foreground">
              Stats will appear after your first message
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalTokens =
    stats.totalInputTokens +
    stats.totalOutputTokens +
    stats.totalCacheCreationTokens +
    stats.totalCacheReadTokens;

  const StatRow: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="info" size={20} />
          Session Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <StatRow label="Messages" value={formatNumber(stats.messageCount)} />
          <StatRow label="Total Cost" value={formatCost(stats.totalCost)} />
          <StatRow label="Total Tokens" value={formatNumber(totalTokens)} />
        </div>

        <Separator />

        <div className="space-y-2">
          <StatRow label="Input" value={formatNumber(stats.totalInputTokens)} />
          <StatRow label="Output" value={formatNumber(stats.totalOutputTokens)} />

          {stats.totalCacheReadTokens > 0 && (
            <StatRow label="Cache Read" value={formatNumber(stats.totalCacheReadTokens)} />
          )}

          {stats.totalCacheCreationTokens > 0 && (
            <StatRow label="Cache Write" value={formatNumber(stats.totalCacheCreationTokens)} />
          )}
        </div>
      </CardContent>
    </Card>
  );
};
