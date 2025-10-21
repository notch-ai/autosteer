export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  fontFamily: string;
  vimMode: boolean;
  autoSave: boolean;
  autoPairBrackets: boolean;
  tabSize: number;
  wordWrap: boolean;
  showLineNumbers: boolean;
  showWhitespace: boolean;
  llmSettings: LLMSettings;
}

export interface LLMSettings {
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  apiKey?: string;
  baseUrl?: string;
}

export interface SettingsGroup {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  settings: Array<{
    key: string;
    label: string;
    type: 'toggle' | 'select' | 'number' | 'text';
    value: any;
    options?: Array<{ label: string; value: any }>;
    min?: number;
    max?: number;
    step?: number;
  }>;
}

export interface LLMSettingsProps {
  settings: LLMSettings;
  onChange: (settings: LLMSettings) => void;
  availableModels?: string[];
}

export interface ThemeToggleProps {
  theme: 'light' | 'dark' | 'system';
  onChange: (theme: 'light' | 'dark' | 'system') => void;
}

export interface VimModeIndicatorProps {
  enabled: boolean;
  mode?: 'normal' | 'insert' | 'visual' | 'command';
  onToggle?: () => void;
}

export interface UseVimModeOptions {
  enabled?: boolean;
  onModeChange?: (mode: string) => void;
  onCommand?: (command: string) => void;
}
