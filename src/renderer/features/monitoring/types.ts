export interface UsageMetrics {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  averageResponseTime: number;
  errorRate: number;
  successRate: number;
  lastUpdated: number;
}

export interface SessionData {
  sessionId: string;
  startTime: number;
  endTime?: number;
  requests: RequestData[];
  metrics: UsageMetrics;
}

export interface RequestData {
  id: string;
  timestamp: number;
  model: string;
  prompt: string;
  response?: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  cost: number;
  duration: number;
  status: 'success' | 'error' | 'pending';
  error?: string;
}

export interface MonitoringConfig {
  enabled: boolean;
  sampleRate: number;
  retentionDays: number;
  alertThresholds: {
    errorRate: number;
    responseTime: number;
    costPerDay: number;
  };
}

export interface UsageDashboardProps {
  metrics: UsageMetrics;
  sessions: SessionData[];
  config: MonitoringConfig;
  onConfigChange?: (config: MonitoringConfig) => void;
}

export interface UsageMonitorProps {
  sessionId: string;
  onMetricsUpdate?: (metrics: UsageMetrics) => void;
}

export interface RequestTimingProps {
  request: RequestData;
  showDetails?: boolean;
}
