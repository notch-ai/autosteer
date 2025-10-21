export interface Settings {
  theme: 'light' | 'dark' | 'system';
  autoStart: boolean;
  minimizeToTray: boolean;
  checkForUpdates: boolean;
  telemetry: boolean;
  vimMode: boolean;
  customSettings?: Record<string, unknown>;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  autoStart: false,
  minimizeToTray: true,
  checkForUpdates: true,
  telemetry: false,
  vimMode: true,
  customSettings: {},
};
