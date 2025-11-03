import React, { useEffect, useState } from 'react';
import { useMonitoringStore } from '@/stores';
import { SessionBlock } from '@/entities/SessionBlock';
import { formatCostUSD } from '@/monitoring/utils/costCalculator';
import { UsageStats } from './UsageStats';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const UsageDashboard: React.FC = () => {
  const { isInitialized, activeSession, error, initialize, fetchActiveSession } =
    useMonitoringStore();

  const [selectedSession, setSelectedSession] = useState<SessionBlock | null>(null);
  const [allSessions, setAllSessions] = useState<SessionBlock[]>([]);

  useEffect(() => {
    if (!isInitialized) {
      initialize().then(() => {
        fetchActiveSession();
      });
    }
  }, [isInitialized, initialize, fetchActiveSession]);

  useEffect(() => {
    // Update sessions list when active session changes
    if (activeSession) {
      setAllSessions((prev) => {
        const exists = prev.find((s) => s.id === activeSession.id);
        if (exists) {
          return prev.map((s) => (s.id === activeSession.id ? activeSession : s));
        }
        return [...prev, activeSession];
      });
    }
  }, [activeSession]);

  const calculateTotalStats = () => {
    const totalTokens = allSessions.reduce(
      (sum: number, session: SessionBlock) => sum + session.getTotalTokens(),
      0
    );
    const totalCost = allSessions.reduce(
      (sum: number, session: SessionBlock) => sum + session.costUSD,
      0
    );
    const totalDuration = allSessions.reduce(
      (sum: number, session: SessionBlock) => sum + session.getDuration(),
      0
    );

    return {
      sessions: allSessions.length,
      tokens: totalTokens,
      cost: totalCost,
      durationHours: Math.round((totalDuration / 1000 / 60 / 60) * 10) / 10,
    };
  };

  const formatSessionTime = (session: SessionBlock) => {
    const date = new Date(session.startTime);
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const today = new Date();

    if (date.toDateString() === today.toDateString()) {
      return `Today at ${time}`;
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${time}`;
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` at ${time}`;
  };

  if (error) {
    return (
      <div>
        <div>
          <h3>Unable to load usage data</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const stats = calculateTotalStats();

  return (
    <div>
      <h2>Claude Code Usage Monitor</h2>

      <Tabs defaultValue="current" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="current">Current Session</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="current">
          <UsageStats />
        </TabsContent>

        <TabsContent value="history">
          <div>
            <div>
              <div>Total Sessions</div>
              <div>{stats.sessions}</div>
            </div>
            <div>
              <div>Total Tokens</div>
              <div>{stats.tokens.toLocaleString()}</div>
            </div>
            <div>
              <div>Total Cost</div>
              <div>{formatCostUSD(stats.cost)}</div>
            </div>
            <div>
              <div>Total Time</div>
              <div>{stats.durationHours}h</div>
            </div>
          </div>

          <div>
            <h3>Session History</h3>
            <div>
              {allSessions.map((session) => (
                <div key={session.id} onClick={() => setSelectedSession(session)}>
                  <div>
                    <span>{formatSessionTime(session)}</span>
                    {session.isActive && <span>Active</span>}
                    {session.isGap && <span>Gap</span>}
                  </div>
                  <div>
                    <span>{session.getTotalTokens().toLocaleString()} tokens</span>
                    <span>{formatCostUSD(session.costUSD)}</span>
                    <span>{Math.round(session.getDuration() / 1000 / 60)} min</span>
                  </div>
                  <div>
                    {session.models.slice(0, 2).map((model, idx) => (
                      <span key={idx}>{model}</span>
                    ))}
                    {session.models.length > 2 && <span>+{session.models.length - 2}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedSession && (
            <div>
              <h3>Session Details</h3>
              <div>
                <div>
                  <span>Session ID:</span>
                  <span>{selectedSession.id}</span>
                </div>
                <div>
                  <span>Start Time:</span>
                  <span>{new Date(selectedSession.startTime).toLocaleString()}</span>
                </div>
                <div>
                  <span>End Time:</span>
                  <span>
                    {new Date(
                      selectedSession.actualEndTime || selectedSession.endTime
                    ).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span>Messages:</span>
                  <span>{selectedSession.entries.length}</span>
                </div>
                <div>
                  <h4>Token Breakdown</h4>
                  <div>
                    <div>Input: {selectedSession.tokenCounts.inputTokens.toLocaleString()}</div>
                    <div>Output: {selectedSession.tokenCounts.outputTokens.toLocaleString()}</div>
                    <div>
                      Cache Creation:{' '}
                      {selectedSession.tokenCounts.cacheCreationInputTokens.toLocaleString()}
                    </div>
                    <div>
                      Cache Read:{' '}
                      {selectedSession.tokenCounts.cacheReadInputTokens.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
