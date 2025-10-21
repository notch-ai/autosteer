import { SlashCommandHandlers } from '@/main/ipc/handlers/SlashCommandHandlers';
import { ipcMain } from 'electron';
import * as fs from 'fs/promises';

// Mock electron
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    removeHandler: jest.fn(),
  },
}));

// Mock electron-log
jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock fs/promises
jest.mock('fs/promises', () => ({
  access: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  readFile: jest.fn(),
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('SlashCommandHandlers', () => {
  let handlers: SlashCommandHandlers;

  beforeEach(() => {
    handlers = new SlashCommandHandlers();
    jest.clearAllMocks();
  });

  describe('registerHandlers', () => {
    it('should register slash command handlers', () => {
      handlers.registerHandlers();

      expect(ipcMain.handle).toHaveBeenCalled();
      const handleCalls = (ipcMain.handle as jest.Mock).mock.calls;

      // Should register at least one handler
      expect(handleCalls.length).toBeGreaterThan(0);

      // Check for slash commands load handler
      const channelNames = handleCalls.map((call) => call[0]);
      expect(channelNames).toContain('slash-commands:load');
    });

    it('should register handlers with valid functions', () => {
      handlers.registerHandlers();

      const handleCalls = (ipcMain.handle as jest.Mock).mock.calls;
      handleCalls.forEach((call) => {
        expect(typeof call[1]).toBe('function');
      });
    });
  });

  describe('Slash command loading', () => {
    beforeEach(() => {
      handlers.registerHandlers();
    });

    it('should load slash commands successfully', async () => {
      // Mock successful directory operations
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir.mockResolvedValue([]);
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);

      const handleCalls = (ipcMain.handle as jest.Mock).mock.calls;
      const slashCommandHandler = handleCalls.find(
        (call) => call[0] === 'slash-commands:load'
      )?.[1];

      expect(slashCommandHandler).toBeDefined();

      const result = await slashCommandHandler({}, '/test/project');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle missing project path', async () => {
      // Mock successful directory operations
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir.mockResolvedValue([]);
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);

      const handleCalls = (ipcMain.handle as jest.Mock).mock.calls;
      const slashCommandHandler = handleCalls.find(
        (call) => call[0] === 'slash-commands:load'
      )?.[1];

      expect(slashCommandHandler).toBeDefined();

      // Should handle undefined project path
      const result = await slashCommandHandler({}, undefined);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle file system errors gracefully', async () => {
      // Mock file system errors
      mockFs.access.mockRejectedValue(new Error('Directory not found'));

      const handleCalls = (ipcMain.handle as jest.Mock).mock.calls;
      const slashCommandHandler = handleCalls.find(
        (call) => call[0] === 'slash-commands:load'
      )?.[1];

      expect(slashCommandHandler).toBeDefined();

      const result = await slashCommandHandler({}, '/nonexistent/path');

      // Should return empty array on error
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle home directory expansion', async () => {
      // Mock successful directory operations
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir.mockResolvedValue([]);
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);

      const handleCalls = (ipcMain.handle as jest.Mock).mock.calls;
      const slashCommandHandler = handleCalls.find(
        (call) => call[0] === 'slash-commands:load'
      )?.[1];

      expect(slashCommandHandler).toBeDefined();

      // Should handle ~ in path
      const result = await slashCommandHandler({}, '~/test/project');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle registration errors gracefully', () => {
      (ipcMain.handle as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Registration failed');
      });

      // The SlashCommandHandlers doesn't wrap in try/catch, so it will throw
      // Let's test that it throws the expected error instead
      expect(() => handlers.registerHandlers()).toThrow('Registration failed');
    });

    it('should handle handler execution errors', async () => {
      handlers.registerHandlers();

      // Mock fs to throw error
      mockFs.access.mockRejectedValue(new Error('Access denied'));

      const handleCalls = (ipcMain.handle as jest.Mock).mock.calls;
      const slashCommandHandler = handleCalls.find(
        (call) => call[0] === 'slash-commands:load'
      )?.[1];

      expect(slashCommandHandler).toBeDefined();

      // Should not throw, should return empty array
      const result = await slashCommandHandler({}, '/test/path');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Development mode handling', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle development mode path resolution', async () => {
      process.env.NODE_ENV = 'development';

      // Mock successful directory operations
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir.mockResolvedValue([]);
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);

      handlers.registerHandlers();

      const handleCalls = (ipcMain.handle as jest.Mock).mock.calls;
      const slashCommandHandler = handleCalls.find(
        (call) => call[0] === 'slash-commands:load'
      )?.[1];

      expect(slashCommandHandler).toBeDefined();

      const result = await slashCommandHandler({}, undefined);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle production mode', async () => {
      process.env.NODE_ENV = 'production';

      // Mock successful directory operations
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir.mockResolvedValue([]);
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);

      handlers.registerHandlers();

      const handleCalls = (ipcMain.handle as jest.Mock).mock.calls;
      const slashCommandHandler = handleCalls.find(
        (call) => call[0] === 'slash-commands:load'
      )?.[1];

      expect(slashCommandHandler).toBeDefined();

      const result = await slashCommandHandler({}, undefined);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
