/**
 * Monitoring Feature Types
 * Type definitions for monitoring and usage tracking components
 */

export interface UsageDashboardProps {
  className?: string;
  timeRange?: 'hour' | 'day' | 'week' | 'month';
}

export interface UsageMonitorProps {
  className?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UsageStatsProps {
  className?: string;
  showDetails?: boolean;
}

export interface RequestTimingProps {
  requestId: string;
  startTime: number;
  endTime?: number;
  className?: string;
}

export interface SessionTimeTrackingProps {
  sessionId: string;
  className?: string;
}

// Usage data types
export interface UsageMetrics {
  requests: number;
  tokens: number;
  cost: number;
  timeRange: string;
  timestamp: Date;
}

export interface RequestTiming {
  id: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  endpoint: string;
  status: 'pending' | 'success' | 'error';
}

export interface SessionData {
  id: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  requests: number;
  tokens: number;
  cost: number;
}

export interface UsageStats {
  today: UsageMetrics;
  week: UsageMetrics;
  month: UsageMetrics;
  total: UsageMetrics;
}

export interface MonitoringConfig {
  enabled: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
  showNotifications: boolean;
}
