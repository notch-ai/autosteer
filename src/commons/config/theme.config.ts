/**
 * Theme configuration for the app
 * This file controls the visual theme settings including icon sets
 */

export interface ThemeConfig {
  iconSet: 'default' | 'pixelart';
  iconBasePath?: string;
}

export const themeConfig: ThemeConfig = {
  // Set to 'pixelart' to use the night pixel art icons
  // Set to 'default' to use the original line icons
  iconSet: 'pixelart',
  iconBasePath: '../assets/icons/',
};

// Icon name mappings for pixel art icons
// Maps original icon names to pixel art icon filenames
export const pixelArtIconMap: Record<string, string> = {
  // File type icons
  text: 'file',
  document: 'file',
  image: 'image',
  video: 'video',
  audio: 'music',
  code: 'code',
  mixed: 'folder',

  // Status icons
  draft: 'edit',
  'in-progress': 'loader',
  review: 'eye',
  completed: 'check',
  archived: 'archive',

  // Navigation icons
  'chevron-left': 'chevron-left',
  'chevron-right': 'chevron-right',
  'chevron-down': 'chevron-down',
  'chevron-up': 'chevron-up',

  // Action icons
  search: 'search',
  close: 'close',
  plus: 'plus',
  export: 'download',
  import: 'upload',
  settings: 'settings',

  // View icons
  grid: 'grid',
  list: 'list',

  // Theme icons
  sun: 'sun',
  moon: 'moon',
  computer: 'device-laptop',

  // Status indicators
  check: 'check',
  warning: 'warning-box',
  error: 'alert',
  info: 'info-box',

  // Other icons
  pin: 'pin',
  attachment: 'paperclip',
  tag: 'tag',
  calendar: 'calendar',
  clock: 'clock',
  edit: 'edit',
  delete: 'trash',
  share: 'share',
  copy: 'copy',
  download: 'download',
  upload: 'upload',
  folder: 'folder',
  file: 'file',
};
