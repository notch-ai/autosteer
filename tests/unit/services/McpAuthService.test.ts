/**
 * Tests for McpAuthService
 * Comprehensive test coverage for MCP authentication operations
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { McpAuthService, McpServerConfig } from '@/services/McpAuthService';
import { EventEmitter } from 'events';

// Mock child_process spawn
jest.mock('child_process');

describe('McpAuthService', () => {
  let service: McpAuthService;
  let mockProcess: MockChildProcess;

  // Mock ChildProcess that extends EventEmitter
  class MockChildProcess extends EventEmitter {
    stdout = new EventEmitter();
    stderr = new EventEmitter();
    killed = false;
    exitCode: number | null = null;

    kill() {
      console.log('[McpAuthService Test] MockChildProcess.kill() called');
      if (!this.killed) {
        this.killed = true;
        // Don't emit exit - let the test control that
      }
    }
  }

  beforeEach(() => {
    console.log('[McpAuthService Test] Setting up test');
    jest.clearAllMocks();

    // Create mock process instance
    mockProcess = new MockChildProcess();

    // Mock spawn to return our mock process
    const { spawn } = require('child_process');
    (spawn as jest.Mock).mockReturnValue(mockProcess);

    // Get singleton instance
    service = McpAuthService.getInstance();
  });

  afterEach(() => {
    console.log('[McpAuthService Test] Cleaning up test');
    service.cleanupAll();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      console.log('[McpAuthService Test] Testing singleton pattern');
      const instance1 = McpAuthService.getInstance();
      const instance2 = McpAuthService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('captureAuthUrl - stdio transport', () => {
    it('should capture OAuth URL from stdout for stdio server', async () => {
      console.log('[McpAuthService Test] Testing OAuth URL capture from stdout');
      const serverName = 'test-stdio-server';
      const config: McpServerConfig = {
        type: 'stdio',
        command: 'npx',
        args: ['@modelcontextprotocol/server-linear'],
        env: { LINEAR_API_KEY: 'test-key' },
      };

      const authPromise = service.captureAuthUrl(serverName, config);

      // Simulate OAuth URL output
      const authUrl = 'https://example.com/oauth?code=abc123';
      mockProcess.stdout.emit(
        'data',
        Buffer.from(`Please authorize this client by visiting: ${authUrl}`)
      );

      const result = await authPromise;

      expect(result).toEqual({
        serverName,
        authUrl,
      });
    });

    it('should capture OAuth URL from stderr for stdio server', async () => {
      console.log('[McpAuthService Test] Testing OAuth URL capture from stderr');
      const serverName = 'test-server';
      const config: McpServerConfig = {
        command: 'npx',
        args: ['@modelcontextprotocol/server-notion'],
      };

      const authPromise = service.captureAuthUrl(serverName, config);

      // Simulate OAuth URL in stderr
      const authUrl = 'https://notion.com/oauth?state=xyz';
      mockProcess.stderr.emit(
        'data',
        Buffer.from(`Please authorize this client by visiting: ${authUrl}\n`)
      );

      const result = await authPromise;

      expect(result.serverName).toBe(serverName);
      expect(result.authUrl).toBe(authUrl);
    });

    it('should handle already authenticated server', async () => {
      console.log('[McpAuthService Test] Testing already authenticated server');
      const serverName = 'authenticated-server';
      const config: McpServerConfig = {
        command: 'npx',
        args: ['@modelcontextprotocol/server-linear'],
      };

      const authPromise = service.captureAuthUrl(serverName, config);

      // Simulate successful authentication message
      mockProcess.stdout.emit('data', Buffer.from('Authenticated successfully'));

      const result = await authPromise;

      expect(result).toEqual({
        serverName,
        authUrl: null,
      });
    });

    it('should handle spawn error', async () => {
      console.log('[McpAuthService Test] Testing spawn error handling');
      const serverName = 'error-server';
      const config: McpServerConfig = {
        command: 'invalid-command',
        args: [],
      };

      const authPromise = service.captureAuthUrl(serverName, config);

      // Simulate spawn error
      mockProcess.emit('error', new Error('Command not found'));

      const result = await authPromise;

      expect(result.serverName).toBe(serverName);
      expect(result.authUrl).toBeNull();
      expect(result.error).toContain('Failed to spawn mcp-remote');
    });

    it('should handle non-zero exit code', async () => {
      console.log('[McpAuthService Test] Testing non-zero exit code');
      const serverName = 'exit-error-server';
      const config: McpServerConfig = {
        command: 'npx',
        args: ['@modelcontextprotocol/server-linear'],
      };

      const authPromise = service.captureAuthUrl(serverName, config);

      // Simulate process exit with error code
      mockProcess.emit('exit', 1);

      const result = await authPromise;

      expect(result.serverName).toBe(serverName);
      expect(result.authUrl).toBeNull();
      expect(result.error).toBe('Process exited with code 1');
    });

    it('should handle zero exit code without auth URL', async () => {
      console.log('[McpAuthService Test] Testing zero exit code without auth URL');
      const serverName = 'clean-exit-server';
      const config: McpServerConfig = {
        command: 'npx',
        args: ['@modelcontextprotocol/server-linear'],
      };

      const authPromise = service.captureAuthUrl(serverName, config);

      // Simulate clean exit
      mockProcess.emit('exit', 0);

      const result = await authPromise;

      expect(result).toEqual({
        serverName,
        authUrl: null,
      });
    });

    it('should handle timeout', async () => {
      console.log('[McpAuthService Test] Testing timeout handling');
      const serverName = 'timeout-server';
      const config: McpServerConfig = {
        command: 'npx',
        args: ['@modelcontextprotocol/server-linear'],
      };

      // Use fake timers to control timeout
      jest.useFakeTimers();

      const authPromise = service.captureAuthUrl(serverName, config);

      // Fast-forward time past the timeout
      jest.advanceTimersByTime(30000);

      const result = await authPromise;

      expect(result.serverName).toBe(serverName);
      expect(result.authUrl).toBeNull();
      expect(result.error).toBe('Timeout waiting for auth URL');

      jest.useRealTimers();
    });

    it('should cleanup process after timeout', async () => {
      console.log('[McpAuthService Test] Testing cleanup after timeout');
      const serverName = 'cleanup-timeout-server';
      const config: McpServerConfig = {
        command: 'npx',
        args: ['@modelcontextprotocol/server-linear'],
      };

      jest.useFakeTimers();

      const authPromise = service.captureAuthUrl(serverName, config);

      // Fast-forward time past the timeout
      jest.advanceTimersByTime(30000);

      await authPromise;

      expect(mockProcess.killed).toBe(true);

      jest.useRealTimers();
    });
  });

  describe('captureAuthUrl - http transport', () => {
    it('should use mcp-remote for http server', async () => {
      console.log('[McpAuthService Test] Testing http server with mcp-remote');
      const serverName = 'http-transport-server';
      const config: McpServerConfig = {
        type: 'http',
        url: 'https://api.example.com/mcp',
        headers: {
          Authorization: 'Bearer token123',
          'X-Custom-Header': 'value',
        },
      };

      const authPromise = service.captureAuthUrl(serverName, config);

      // Simulate successful authentication
      mockProcess.stdout.emit('data', Buffer.from('Authenticated successfully'));

      await authPromise;

      const { spawn } = require('child_process');
      expect(spawn).toHaveBeenCalledWith(
        'npx',
        ['@anthropic-ai/mcp-remote', 'https://api.example.com/mcp'],
        expect.objectContaining({
          env: expect.objectContaining({
            MCP_HEADER_AUTHORIZATION: 'Bearer token123',
            MCP_HEADER_X_CUSTOM_HEADER: 'value',
          }),
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      );
    });

    it('should handle http server OAuth URL', async () => {
      console.log('[McpAuthService Test] Testing http server OAuth URL');
      const serverName = 'http-oauth-server';
      const config: McpServerConfig = {
        type: 'http',
        url: 'https://api.notion.com/mcp',
      };

      const authPromise = service.captureAuthUrl(serverName, config);

      const authUrl = 'https://notion.com/oauth/authorize?client_id=abc';
      mockProcess.stdout.emit(
        'data',
        Buffer.from(`Please authorize this client by visiting: ${authUrl}`)
      );

      const result = await authPromise;

      expect(result).toEqual({
        serverName,
        authUrl,
      });
    });

    it('should use mcp-remote for sse server', async () => {
      console.log('[McpAuthService Test] Testing sse server with mcp-remote');
      const serverName = 'sse-server';
      const config: McpServerConfig = {
        type: 'sse',
        url: 'https://api.example.com/sse',
      };

      const authPromise = service.captureAuthUrl(serverName, config);

      mockProcess.stdout.emit('data', Buffer.from('Authenticated successfully'));

      await authPromise;

      const { spawn } = require('child_process');
      expect(spawn).toHaveBeenCalledWith(
        'npx',
        ['@anthropic-ai/mcp-remote', 'https://api.example.com/sse'],
        expect.objectContaining({
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      );
    });
  });

  describe('cleanup and process management', () => {
    it('should cleanup specific server process', async () => {
      console.log('[McpAuthService Test] Testing cleanup of specific server');
      const serverName = 'cleanup-server';
      const config: McpServerConfig = {
        command: 'npx',
        args: ['@modelcontextprotocol/server-linear'],
      };

      const authPromise = service.captureAuthUrl(serverName, config);

      // Trigger cleanup by emitting success
      mockProcess.stdout.emit('data', Buffer.from('Authenticated successfully'));

      await authPromise;

      expect(mockProcess.killed).toBe(true);
    });

    it('should cleanup before starting new auth for same server', async () => {
      console.log('[McpAuthService Test] Testing cleanup before new auth');
      const serverName = 'reauth-server';
      const config: McpServerConfig = {
        command: 'npx',
        args: ['@modelcontextprotocol/server-linear'],
      };

      // First auth attempt
      const authPromise1 = service.captureAuthUrl(serverName, config);
      mockProcess.stdout.emit('data', Buffer.from('Authenticated successfully'));
      await authPromise1;

      const firstProcess = mockProcess;

      // Create new mock process for second attempt
      mockProcess = new MockChildProcess();
      const { spawn } = require('child_process');
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      // Second auth attempt
      const authPromise2 = service.captureAuthUrl(serverName, config);
      mockProcess.stdout.emit('data', Buffer.from('Authenticated successfully'));
      await authPromise2;

      // First process should have been cleaned up
      expect(firstProcess.killed).toBe(true);
    });

    it('should cleanup all active processes', async () => {
      console.log('[McpAuthService Test] Testing cleanupAll');
      const config: McpServerConfig = {
        command: 'npx',
        args: ['@modelcontextprotocol/server-linear'],
      };

      // Start multiple auth processes
      const authPromise1 = service.captureAuthUrl('server1', config);
      const process1 = mockProcess;

      mockProcess = new MockChildProcess();
      const { spawn } = require('child_process');
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      const authPromise2 = service.captureAuthUrl('server2', config);
      const process2 = mockProcess;

      // Complete both auths
      process1.stdout.emit('data', Buffer.from('Authenticated successfully'));
      process2.stdout.emit('data', Buffer.from('Authenticated successfully'));

      await Promise.all([authPromise1, authPromise2]);

      // Reset for new processes
      mockProcess = new MockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      service.captureAuthUrl('server3', config);
      const process3 = mockProcess;

      // Cleanup all
      service.cleanupAll();

      expect(process3.killed).toBe(true);
    });

    it('should not error when killing already killed process', () => {
      console.log('[McpAuthService Test] Testing cleanup of already killed process');
      mockProcess.killed = true;

      // Should not throw
      expect(() => service.cleanupAll()).not.toThrow();
    });
  });

  describe('environment variable handling', () => {
    it('should pass custom environment variables for stdio server', async () => {
      console.log('[McpAuthService Test] Testing custom env vars for stdio server');
      const serverName = 'env-server';
      const config: McpServerConfig = {
        command: 'npx',
        args: ['@modelcontextprotocol/server-linear'],
        env: {
          LINEAR_API_KEY: 'test-api-key',
          CUSTOM_VAR: 'custom-value',
        },
      };

      const authPromise = service.captureAuthUrl(serverName, config);

      mockProcess.stdout.emit('data', Buffer.from('Authenticated successfully'));

      await authPromise;

      const { spawn } = require('child_process');
      expect(spawn).toHaveBeenCalledWith(
        'npx',
        ['@modelcontextprotocol/server-linear'],
        expect.objectContaining({
          env: expect.objectContaining({
            LINEAR_API_KEY: 'test-api-key',
            CUSTOM_VAR: 'custom-value',
          }),
        })
      );
    });

    it('should convert http headers to env vars', async () => {
      console.log('[McpAuthService Test] Testing http headers to env vars conversion');
      const serverName = 'header-server';
      const config: McpServerConfig = {
        type: 'http',
        url: 'https://api.example.com',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'secret123',
        },
      };

      const authPromise = service.captureAuthUrl(serverName, config);

      mockProcess.stdout.emit('data', Buffer.from('Authenticated successfully'));

      await authPromise;

      const { spawn } = require('child_process');
      expect(spawn).toHaveBeenCalledWith(
        'npx',
        ['@anthropic-ai/mcp-remote', 'https://api.example.com'],
        expect.objectContaining({
          env: expect.objectContaining({
            MCP_HEADER_CONTENT_TYPE: 'application/json',
            MCP_HEADER_X_API_KEY: 'secret123',
          }),
        })
      );
    });
  });

  describe('OAuth URL pattern matching', () => {
    it('should extract URL with various protocols', async () => {
      console.log('[McpAuthService Test] Testing URL extraction');
      const serverName = `url-test-${Date.now()}`;
      const config: McpServerConfig = {
        command: 'npx',
        args: ['test-server'],
      };

      const authPromise = service.captureAuthUrl(serverName, config);
      mockProcess.stdout.emit(
        'data',
        Buffer.from('Please authorize this client by visiting: https://secure.example.com/oauth')
      );
      const result = await authPromise;

      expect(result.authUrl).toBe('https://secure.example.com/oauth');
    });

    it('should extract URL with query parameters', async () => {
      console.log('[McpAuthService Test] Testing URL extraction with query params');
      const serverName = 'query-server';
      const config: McpServerConfig = {
        command: 'npx',
        args: ['test-server'],
      };

      const authPromise = service.captureAuthUrl(serverName, config);

      const complexUrl =
        'https://example.com/oauth?client_id=abc&redirect_uri=https://localhost:3000&state=xyz123';
      mockProcess.stdout.emit(
        'data',
        Buffer.from(`Please authorize this client by visiting: ${complexUrl}`)
      );

      const result = await authPromise;

      expect(result.authUrl).toBe(complexUrl);
    });

    it('should handle multiple URLs in output and capture first', async () => {
      console.log('[McpAuthService Test] Testing multiple URLs in output');
      const serverName = 'multi-url-server';
      const config: McpServerConfig = {
        command: 'npx',
        args: ['test-server'],
      };

      const authPromise = service.captureAuthUrl(serverName, config);

      mockProcess.stdout.emit(
        'data',
        Buffer.from('Please authorize this client by visiting: https://first.com/auth')
      );
      // Second URL should be ignored
      mockProcess.stdout.emit(
        'data',
        Buffer.from('Please authorize this client by visiting: https://second.com/auth')
      );

      const result = await authPromise;

      expect(result.authUrl).toBe('https://first.com/auth');
    });
  });

  describe('edge cases', () => {
    it('should handle output without auth URL or success message', async () => {
      console.log('[McpAuthService Test] Testing output without auth URL');
      const serverName = 'no-url-server';
      const config: McpServerConfig = {
        command: 'npx',
        args: ['test-server'],
      };

      jest.useFakeTimers();

      const authPromise = service.captureAuthUrl(serverName, config);

      mockProcess.stdout.emit('data', Buffer.from('Some random output'));
      mockProcess.stderr.emit('data', Buffer.from('Some error message'));

      // Should timeout
      jest.advanceTimersByTime(30000);

      const result = await authPromise;

      expect(result.error).toBe('Timeout waiting for auth URL');

      jest.useRealTimers();
    });

    it('should handle empty stdout/stderr buffers', async () => {
      console.log('[McpAuthService Test] Testing empty buffers');
      const serverName = 'empty-buffer-server';
      const config: McpServerConfig = {
        command: 'npx',
        args: ['test-server'],
      };

      jest.useFakeTimers();

      const authPromise = service.captureAuthUrl(serverName, config);

      mockProcess.stdout.emit('data', Buffer.from(''));
      mockProcess.stderr.emit('data', Buffer.from(''));

      jest.advanceTimersByTime(30000);

      const result = await authPromise;

      expect(result.error).toBe('Timeout waiting for auth URL');

      jest.useRealTimers();
    });

    it('should only resolve once even with multiple events', async () => {
      console.log('[McpAuthService Test] Testing single resolution with multiple events');
      const serverName = 'multi-event-server';
      const config: McpServerConfig = {
        command: 'npx',
        args: ['test-server'],
      };

      const authPromise = service.captureAuthUrl(serverName, config);

      // Emit multiple success events
      mockProcess.stdout.emit('data', Buffer.from('Authenticated successfully'));
      mockProcess.stdout.emit('data', Buffer.from('Authenticated successfully'));
      mockProcess.emit('exit', 0);

      const result = await authPromise;

      expect(result).toEqual({
        serverName,
        authUrl: null,
      });
    });
  });
});
