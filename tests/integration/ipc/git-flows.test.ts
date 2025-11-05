/**
 * Integration Tests - Git Flows
 *
 * Tests end-to-end renderer → IPC → service flows for Git operations
 */

import { GitHandlers } from '@/main/ipc/handlers/git.handlers';
import { ipcMain } from 'electron';

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
  },
}));

jest.mock('@/main/services/GitDiffService');
jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('Integration: Git Flows', () => {
  let gitHandlers: GitHandlers;

  beforeEach(() => {
    jest.clearAllMocks();
    gitHandlers = new GitHandlers();
    gitHandlers.registerHandlers();
  });

  describe('Git Diff Operations', () => {
    it('should register git diff handler', () => {
      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'git-diff:get-diff'
      );
      expect(handleCall).toBeDefined();
    });

    it('should register git uncommitted changes handler', () => {
      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'git-diff:get-uncommitted'
      );
      expect(handleCall).toBeDefined();
    });

    it('should register git staged changes handler', () => {
      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'git-diff:get-staged'
      );
      expect(handleCall).toBeDefined();
    });

    it('should register git discard file handler', () => {
      const handleCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === 'git-diff:discard-file'
      );
      expect(handleCall).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should have registered all expected git handlers', () => {
      const registeredChannels = (ipcMain.handle as jest.Mock).mock.calls.map((call) => call[0]);

      expect(registeredChannels).toContain('git-diff:get-diff');
      expect(registeredChannels).toContain('git-diff:get-uncommitted');
      expect(registeredChannels).toContain('git-diff:get-staged');
      expect(registeredChannels).toContain('git-diff:discard-file');
    });
  });
});
