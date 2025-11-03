/**
 * Settings Feature Types
 * Type definitions for settings-related components and functionality
 */

import React from 'react';

export interface LLMSettingsProps {
  className?: string;
}

export interface ThemeToggleProps {
  className?: string;
  variant?: 'default' | 'icon';
}

export interface DevModeToggleProps {
  className?: string;
}

export interface VimModeIndicatorProps {
  className?: string;
  isVisible?: boolean;
  enabled?: boolean;
  mode?: 'normal' | 'insert' | 'visual' | 'command' | 'NORMAL' | 'INSERT';
  onToggle?: () => void;
}

// Hook types
export interface UseVimModeOptions {
  enabled?: boolean;
  onToggle?: (enabled: boolean) => void;
}

export interface UseVimModeReturn {
  isEnabled: boolean;
  toggle: () => void;
  enable: () => void;
  disable: () => void;
}

// Settings data types
export interface LLMProvider {
  id: string;
  name: string;
  models: string[];
  apiKeyRequired: boolean;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  vimMode: boolean;
  devMode: boolean;
  llmProvider: string;
  llmModel: string;
  apiKeys: Record<string, string>;
}

export interface SettingsGroup {
  id: string;
  title: string;
  description?: string;
  settings: SettingItem[];
}

export interface SettingItem {
  id: string;
  type: 'toggle' | 'select' | 'input' | 'custom';
  label: string;
  description?: string;
  value: unknown;
  options?: Array<{ label: string; value: string }>;
  component?: React.ComponentType<unknown>;
}
