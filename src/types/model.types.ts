/**
 * Model types for Claude Code SDK integration
 */

import type { IconName } from '@/features/shared/components/ui/Icon';

export type ModelOption =
  | 'claude-opus-4-20250514'
  | 'claude-opus-4-1-20250805'
  | 'claude-opus-4-5-20251101'
  | 'claude-sonnet-4-20250514'
  | 'claude-sonnet-4-5-20250929'
  | 'claude-haiku-4-5-20251001';

export interface ModelConfig {
  value: ModelOption;
  label: string;
  description: string;
  icon?: IconName;
}

export const MODEL_OPTIONS: ModelConfig[] = [
  {
    value: 'claude-sonnet-4-5-20250929',
    label: 'Sonnet 4.5',
    description: 'Best model for complex agents and coding',
    icon: 'circle',
  },
  {
    value: 'claude-opus-4-5-20251101',
    label: 'Opus 4.5',
    description: 'Latest Opus model with improved performance and efficiency',
    icon: 'circle',
  },
  {
    value: 'claude-opus-4-1-20250805',
    label: 'Opus 4.1',
    description: 'Exceptional model for specialized complex tasks',
    icon: 'circle',
  },
  {
    value: 'claude-opus-4-20250514',
    label: 'Opus 4',
    description: 'Previous flagship model',
    icon: 'circle-half-stroke',
  },
  {
    value: 'claude-sonnet-4-20250514',
    label: 'Sonnet 4',
    description: 'High-performance model',
    icon: 'clock',
  },
  {
    value: 'claude-haiku-4-5-20251001',
    label: 'Haiku 4.5',
    description: 'Fastest model with near-frontier intelligence',
    icon: 'zap',
  },
];

export const DEFAULT_MODEL: ModelOption = 'claude-sonnet-4-5-20250929';
