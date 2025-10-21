/**
 * Application settings and configuration
 * Phase 1: Core API Integration - Claude Code mode configuration
 */

export interface AppSettings {
  claudeCodeMode: 'local' | 'api';
  aiServiceUrl: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  claudeCodeMode: (process.env.CLAUDE_CODE_MODE as 'local' | 'api') || 'local',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8001',
};

export function getAppSettings(): AppSettings {
  return {
    claudeCodeMode: (process.env.CLAUDE_CODE_MODE as 'local' | 'api') || 'local',
    aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8001',
  };
}
