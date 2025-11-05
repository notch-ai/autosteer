// IMPORTANT: All jest.mock() calls must be at the top before imports (Jest hoisting requirement)
// Note: Do NOT call jest.mock('electron') - moduleNameMapper in jest.config.js handles it via __mocks__/electron.js
// The moduleNameMapper takes precedence over jest.mock() declarations

jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
  }));
});

jest.mock('electron-updater', () => {
  const { EventEmitter } = require('events');
  const mockAutoUpdater = new EventEmitter();
  Object.assign(mockAutoUpdater, {
    autoDownload: false,
    autoInstallOnAppQuit: true,
    checkForUpdates: jest.fn(),
    downloadUpdate: jest.fn(),
    quitAndInstall: jest.fn(),
    setFeedURL: jest.fn(),
  });
  return {
    autoUpdater: mockAutoUpdater,
  };
});

jest.mock('semver', () => ({
  gt: jest.fn((v1: string, v2: string) => {
    const parseVersion = (v: string) => {
      const parts = v.split('.').map(Number);
      return parts[0] * 10000 + parts[1] * 100 + parts[2];
    };
    return parseVersion(v1) > parseVersion(v2);
  }),
}));

import { describe, it, expect } from '@jest/globals';
import { UpdateService } from '@/services/UpdateService';

describe('UpdateService Import Test', () => {
  it('should import UpdateService', () => {
    console.log('UpdateService:', UpdateService);
    expect(UpdateService).toBeDefined();
  });

  it('should create UpdateService instance', () => {
    const service = new UpdateService();
    console.log('service:', service);
    expect(service).toBeDefined();
  });
});
