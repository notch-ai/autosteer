/**
 * Permission mode types for Claude Code SDK integration
 */

import type { IconName } from '@/features/shared/components/ui/Icon';

export type PermissionMode = 'plan' | 'acceptEdits' | 'bypassPermissions' | 'default';

export interface PermissionModeOption {
  value: PermissionMode;
  label: string;
  description: string;
  icon?: IconName;
}

export const PERMISSION_MODES: PermissionModeOption[] = [
  {
    value: 'plan',
    label: 'Plan',
    description: 'Review changes before applying',
    icon: 'document',
  },
  {
    value: 'acceptEdits',
    label: 'Edit',
    description: 'Accept edits automatically',
    icon: 'edit',
  },
  {
    value: 'bypassPermissions',
    label: 'Bypass Permissions',
    description: 'Skip all permission checks',
    icon: 'check',
  },
  {
    value: 'default',
    label: 'Default',
    description: 'Use system default permissions',
    icon: 'archive',
  },
];

export const DEFAULT_PERMISSION_MODE: PermissionMode = 'acceptEdits';
