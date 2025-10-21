import { CCUsageMonitor } from '@/monitoring/adapters/CCUsageMonitor';
import { SessionBlock } from '@/entities/SessionBlock';
import { UserMonitor } from '@/monitoring/interfaces/UserMonitor';
import { MonitoringConfig } from '@/monitoring/interfaces/types';
import { BrowserWindow } from 'electron';
import { logger } from '@/commons/utils/logger';

class MonitoringService {
  private monitor: UserMonitor | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private config: MonitoringConfig = {
    sessionHours: 5,
    costMode: 'auto',
    debug: false,
  };

  initialize(config?: Partial<MonitoringConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.monitor = new CCUsageMonitor(this.config);
    logger.info('Monitoring service initialized');
  }

  async getActiveSession(): Promise<SessionBlock | null> {
    if (!this.monitor) {
      throw new Error('Monitoring service not initialized');
    }
    const activeBlock = await this.monitor.getActiveBlock();
    return activeBlock;
  }

  async getAllSessions(): Promise<SessionBlock[]> {
    if (!this.monitor) {
      throw new Error('Monitoring service not initialized');
    }
    return this.monitor.getAllBlocks();
  }

  startPolling(intervalMs: number = 30000): void {
    if (this.pollingInterval) {
      this.stopPolling();
    }

    this.pollingInterval = setInterval(async () => {
      try {
        const activeSession = await this.getActiveSession();
        // Send update to all renderer windows
        if (activeSession) {
          logger.info('Active session updated:', activeSession.id);
          BrowserWindow.getAllWindows().forEach((window) => {
            window.webContents.send('monitoring:sessionUpdate', {
              type: 'active',
              session: activeSession,
            });
          });
        }
      } catch (error) {
        logger.error('Error polling monitoring data:', error);
      }
    }, intervalMs);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  dispose(): void {
    this.stopPolling();
    if (this.monitor && Symbol.dispose in this.monitor) {
      this.monitor[Symbol.dispose]();
    }
    this.monitor = null;
  }
}

export const monitoringService = new MonitoringService();
