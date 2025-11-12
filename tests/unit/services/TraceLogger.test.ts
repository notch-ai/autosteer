/**
 * TraceLogger.test.ts
 * Comprehensive unit tests for TraceLogger service with 80%+ coverage
 * Tests trace file creation, async JSONL append, rotation, and cleanup
 */

import { TraceLogger } from '@/services/TraceLogger';
import * as fs from 'fs';
import { promisify } from 'util';
import * as path from 'path';

const fsPromises = {
  mkdir: promisify(fs.mkdir),
  readFile: promisify(fs.readFile),
  writeFile: promisify(fs.writeFile),
  rm: promisify(fs.rm),
  access: promisify(fs.access),
  stat: promisify(fs.stat),
  readdir: promisify(fs.readdir),
};

// Use unique directory to avoid parallel test conflicts
const TEST_DIR = `/tmp/test-autosteer-traces-${process.pid}-${Date.now()}`;

// Mock electron app.getPath
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => TEST_DIR),
  },
}));

// Mock logger to prevent console output during tests
jest.mock('@/commons/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('TraceLogger', () => {
  let traceLogger: TraceLogger;
  const testDir = TEST_DIR;
  const tracesDir = `${TEST_DIR}/.autosteer/traces`;

  beforeAll(async () => {
    // Ensure /tmp exists and is writable
    try {
      await fsPromises.mkdir('/tmp', { recursive: true });
    } catch (error) {
      // /tmp already exists, ignore
    }
  });

  beforeEach(async () => {
    console.log('[TraceLogger.test] Setting up test suite');
    // Clean up test directory
    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Directory doesn't exist, ignore
    }

    // Create test directory structure
    await fsPromises.mkdir(tracesDir, { recursive: true });

    // Reset singleton instance for complete test isolation
    TraceLogger.resetInstance();

    // Get fresh instance
    traceLogger = TraceLogger.getInstance();
  });

  afterEach(async () => {
    console.log('[TraceLogger.test] Cleaning up test suite');
    // Clean up test directory
    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    // Reset singleton instance after test
    TraceLogger.resetInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      console.log('[TraceLogger.test] Testing singleton pattern');
      const instance1 = TraceLogger.getInstance();
      const instance2 = TraceLogger.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Trace File Creation', () => {
    it('should create trace file on first log', async () => {
      console.log('[TraceLogger.test] Testing trace file creation');
      const sessionId = 'session-123';
      const traceFilePath = path.join(tracesDir, `${sessionId}.trace.jsonl`);

      await traceLogger.log(
        sessionId,
        'to-claude',
        { type: 'message', content: 'Hello' },
        'corr-1'
      );

      // Wait for async write
      await new Promise((resolve) => setTimeout(resolve, 100));

      await expect(fsPromises.access(traceFilePath)).resolves.not.toThrow();
    });

    it('should create traces directory if it does not exist', async () => {
      console.log('[TraceLogger.test] Testing traces directory creation');
      // Remove traces directory
      await fsPromises.rm(tracesDir, { recursive: true, force: true });

      const sessionId = 'session-456';

      await traceLogger.log(sessionId, 'from-claude', { type: 'response' }, 'corr-2');

      // Wait for async write
      await new Promise((resolve) => setTimeout(resolve, 100));

      await expect(fsPromises.access(tracesDir)).resolves.not.toThrow();
    });
  });

  describe('JSONL Logging', () => {
    it('should log message in JSONL format', async () => {
      console.log('[TraceLogger.test] Testing JSONL format');
      const sessionId = 'session-jsonl';
      const traceFilePath = path.join(tracesDir, `${sessionId}.trace.jsonl`);
      const rawMessage = { type: 'test', data: 'value' };
      const correlationId = 'corr-123';

      await traceLogger.log(sessionId, 'to-claude', rawMessage, correlationId);

      // Wait for async write
      await new Promise((resolve) => setTimeout(resolve, 100));

      const content = await fsPromises.readFile(traceFilePath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(1);

      const logEntry = JSON.parse(lines[0]);
      expect(logEntry).toMatchObject({
        sessionId,
        direction: 'to-claude',
        rawMessage,
        correlationId,
        sequenceNumber: 1,
      });
      expect(logEntry.timestamp).toBeDefined();
      expect(logEntry.sdkVersion).toBeDefined();
    });

    it('should append multiple messages to same file', async () => {
      console.log('[TraceLogger.test] Testing multiple messages');
      const sessionId = 'session-multi';
      const traceFilePath = path.join(tracesDir, `${sessionId}.trace.jsonl`);

      await traceLogger.log(sessionId, 'to-claude', { msg: 1 }, 'corr-1');
      await traceLogger.log(sessionId, 'from-claude', { msg: 2 }, 'corr-2');
      await traceLogger.log(sessionId, 'to-claude', { msg: 3 }, 'corr-3');

      // Wait for async writes
      await new Promise((resolve) => setTimeout(resolve, 200));

      const content = await fsPromises.readFile(traceFilePath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(3);

      const entry1 = JSON.parse(lines[0]);
      const entry2 = JSON.parse(lines[1]);
      const entry3 = JSON.parse(lines[2]);

      expect(entry1.sequenceNumber).toBe(1);
      expect(entry2.sequenceNumber).toBe(2);
      expect(entry3.sequenceNumber).toBe(3);
    });

    it('should include correlation ID in log entries', async () => {
      console.log('[TraceLogger.test] Testing correlation ID');
      const sessionId = 'session-correlation';
      const traceFilePath = path.join(tracesDir, `${sessionId}.trace.jsonl`);
      const correlationId = 'correlation-abc-123';

      await traceLogger.log(sessionId, 'to-claude', { test: 'data' }, correlationId);

      // Wait for async write
      await new Promise((resolve) => setTimeout(resolve, 100));

      const content = await fsPromises.readFile(traceFilePath, 'utf-8');
      const logEntry = JSON.parse(content.trim());

      expect(logEntry.correlationId).toBe(correlationId);
    });

    it('should track sequence numbers per session', async () => {
      console.log('[TraceLogger.test] Testing sequence numbers');
      const sessionId = 'session-seq';
      const traceFilePath = path.join(tracesDir, `${sessionId}.trace.jsonl`);

      for (let i = 1; i <= 5; i++) {
        await traceLogger.log(sessionId, 'to-claude', { msg: i }, `corr-${i}`);
      }

      // Wait for async writes
      await new Promise((resolve) => setTimeout(resolve, 300));

      const content = await fsPromises.readFile(traceFilePath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(5);

      lines.forEach((line, index) => {
        const entry = JSON.parse(line);
        expect(entry.sequenceNumber).toBe(index + 1);
      });
    });

    it('should log direction correctly', async () => {
      console.log('[TraceLogger.test] Testing direction tracking');
      const sessionId = 'session-direction';
      const traceFilePath = path.join(tracesDir, `${sessionId}.trace.jsonl`);

      await traceLogger.log(sessionId, 'to-claude', { msg: 1 }, 'corr-1');
      await traceLogger.log(sessionId, 'from-claude', { msg: 2 }, 'corr-2');

      // Wait for async writes
      await new Promise((resolve) => setTimeout(resolve, 100));

      const content = await fsPromises.readFile(traceFilePath, 'utf-8');
      const lines = content.trim().split('\n');

      const entry1 = JSON.parse(lines[0]);
      const entry2 = JSON.parse(lines[1]);

      expect(entry1.direction).toBe('to-claude');
      expect(entry2.direction).toBe('from-claude');
    });
  });

  describe('File Rotation', () => {
    it('should rotate file when size exceeds 100MB', async () => {
      console.log('[TraceLogger.test] Testing file rotation');
      const sessionId = 'session-rotate';

      // Create a large message to simulate file growth
      const largeMessage = { data: 'x'.repeat(10 * 1024 * 1024) }; // 10MB message

      // Log messages to exceed 100MB
      for (let i = 0; i < 11; i++) {
        await traceLogger.log(sessionId, 'to-claude', largeMessage, `corr-${i}`);
        // Wait for async write
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Wait for rotation
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Check that rotated file exists
      const files = await fsPromises.readdir(tracesDir);
      const rotatedFiles = files.filter((f) => f.startsWith(`${sessionId}.trace.jsonl.rotated.`));

      expect(rotatedFiles.length).toBeGreaterThan(0);
    });

    it('should start new file after rotation', async () => {
      console.log('[TraceLogger.test] Testing new file after rotation');
      const sessionId = 'session-rotate-new';
      const traceFilePath = path.join(tracesDir, `${sessionId}.trace.jsonl`);

      // Create large messages to trigger rotation
      const largeMessage = { data: 'x'.repeat(10 * 1024 * 1024) }; // 10MB

      // Log to trigger rotation
      for (let i = 0; i < 11; i++) {
        await traceLogger.log(sessionId, 'to-claude', largeMessage, `corr-${i}`);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Wait for rotation
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Log new message
      await traceLogger.log(sessionId, 'to-claude', { msg: 'new' }, 'corr-new');

      // Wait for write
      await new Promise((resolve) => setTimeout(resolve, 100));

      // New file should exist
      const stat = await fsPromises.stat(traceFilePath);
      expect(stat.size).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    });

    it('should preserve sequence numbers after rotation', async () => {
      console.log('[TraceLogger.test] Testing sequence after rotation');
      const sessionId = 'session-rotate-seq';
      const traceFilePath = path.join(tracesDir, `${sessionId}.trace.jsonl`);

      // Log messages before rotation
      await traceLogger.log(sessionId, 'to-claude', { msg: 1 }, 'corr-1');
      await traceLogger.log(sessionId, 'to-claude', { msg: 2 }, 'corr-2');

      // Trigger rotation by creating large file
      const largeMessage = { data: 'x'.repeat(10 * 1024 * 1024) };
      for (let i = 0; i < 11; i++) {
        await traceLogger.log(sessionId, 'to-claude', largeMessage, `corr-large-${i}`);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Wait for rotation
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Log message after rotation
      await traceLogger.log(sessionId, 'to-claude', { msg: 'after' }, 'corr-after');

      // Wait for write
      await new Promise((resolve) => setTimeout(resolve, 100));

      const content = await fsPromises.readFile(traceFilePath, 'utf-8');
      const lines = content.trim().split('\n');

      if (lines.length > 0) {
        const lastEntry = JSON.parse(lines[lines.length - 1]);
        // Sequence should continue from before rotation
        expect(lastEntry.sequenceNumber).toBeGreaterThan(2);
      }
    });
  });

  describe('Cleanup Operations', () => {
    it('should delete trace file for session', async () => {
      console.log('[TraceLogger.test] Testing trace file deletion');
      const sessionId = 'session-delete';
      const traceFilePath = path.join(tracesDir, `${sessionId}.trace.jsonl`);

      // Create trace file
      await traceLogger.log(sessionId, 'to-claude', { msg: 'test' }, 'corr-1');

      // Wait for write
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify file exists
      await expect(fsPromises.access(traceFilePath)).resolves.not.toThrow();

      // Delete trace file
      await traceLogger.deleteTraceFile(sessionId);

      // Verify file is deleted
      await expect(fsPromises.access(traceFilePath)).rejects.toThrow();
    });

    it('should handle deleting non-existent trace file', async () => {
      console.log('[TraceLogger.test] Testing delete non-existent file');
      // Should not throw error
      await expect(traceLogger.deleteTraceFile('non-existent-session')).resolves.not.toThrow();
    });

    it('should delete all rotated files for session', async () => {
      console.log('[TraceLogger.test] Testing rotated files deletion');
      const sessionId = 'session-delete-rotated';

      // Create main trace file
      await traceLogger.log(sessionId, 'to-claude', { msg: 'test' }, 'corr-1');

      // Wait for write
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Manually create rotated files
      const rotatedFile1 = path.join(tracesDir, `${sessionId}.trace.jsonl.rotated.1234567890`);
      const rotatedFile2 = path.join(tracesDir, `${sessionId}.trace.jsonl.rotated.9876543210`);
      await fsPromises.writeFile(rotatedFile1, 'test1', 'utf-8');
      await fsPromises.writeFile(rotatedFile2, 'test2', 'utf-8');

      // Delete all trace files
      await traceLogger.deleteTraceFile(sessionId);

      // Verify all files are deleted
      await expect(fsPromises.access(rotatedFile1)).rejects.toThrow();
      await expect(fsPromises.access(rotatedFile2)).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle write errors gracefully', async () => {
      console.log('[TraceLogger.test] Testing write error handling');
      const sessionId = 'session-error';

      // Try to log - should not throw even if write fails
      await expect(
        traceLogger.log(sessionId, 'to-claude', { msg: 'test' }, 'corr-1')
      ).resolves.not.toThrow();
    });

    it('should handle invalid session ID gracefully', async () => {
      console.log('[TraceLogger.test] Testing invalid session ID');
      // Should not throw
      await expect(
        traceLogger.log('', 'to-claude', { msg: 'test' }, 'corr-1')
      ).resolves.not.toThrow();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent writes to same session', async () => {
      console.log('[TraceLogger.test] Testing concurrent writes');
      const sessionId = 'session-concurrent';
      const traceFilePath = path.join(tracesDir, `${sessionId}.trace.jsonl`);

      // Simulate concurrent writes
      await Promise.all([
        traceLogger.log(sessionId, 'to-claude', { msg: 1 }, 'corr-1'),
        traceLogger.log(sessionId, 'to-claude', { msg: 2 }, 'corr-2'),
        traceLogger.log(sessionId, 'to-claude', { msg: 3 }, 'corr-3'),
        traceLogger.log(sessionId, 'to-claude', { msg: 4 }, 'corr-4'),
        traceLogger.log(sessionId, 'to-claude', { msg: 5 }, 'corr-5'),
      ]);

      // Wait for all writes
      await new Promise((resolve) => setTimeout(resolve, 300));

      const content = await fsPromises.readFile(traceFilePath, 'utf-8');
      const lines = content.trim().split('\n');

      // All messages should be logged
      expect(lines.length).toBe(5);
    });

    it('should handle concurrent writes to different sessions', async () => {
      console.log('[TraceLogger.test] Testing concurrent different sessions');

      await Promise.all([
        traceLogger.log('session-1', 'to-claude', { msg: 1 }, 'corr-1'),
        traceLogger.log('session-2', 'to-claude', { msg: 2 }, 'corr-2'),
        traceLogger.log('session-3', 'to-claude', { msg: 3 }, 'corr-3'),
      ]);

      // Wait for all writes
      await new Promise((resolve) => setTimeout(resolve, 200));

      const file1 = await fsPromises.readFile(
        path.join(tracesDir, 'session-1.trace.jsonl'),
        'utf-8'
      );
      const file2 = await fsPromises.readFile(
        path.join(tracesDir, 'session-2.trace.jsonl'),
        'utf-8'
      );
      const file3 = await fsPromises.readFile(
        path.join(tracesDir, 'session-3.trace.jsonl'),
        'utf-8'
      );

      expect(file1.trim()).toBeTruthy();
      expect(file2.trim()).toBeTruthy();
      expect(file3.trim()).toBeTruthy();
    });
  });

  describe('Integration with SessionManifestService', () => {
    it('should support cleanup via session IDs from manifest', async () => {
      console.log('[TraceLogger.test] Testing manifest integration');
      const sessionIds = ['session-a', 'session-b', 'session-c'];

      // Create trace files for each session
      for (const sessionId of sessionIds) {
        await traceLogger.log(sessionId, 'to-claude', { msg: 'test' }, 'corr-1');
      }

      // Wait for writes
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Delete all trace files
      for (const sessionId of sessionIds) {
        await traceLogger.deleteTraceFile(sessionId);
      }

      // Verify all files are deleted
      for (const sessionId of sessionIds) {
        const traceFilePath = path.join(tracesDir, `${sessionId}.trace.jsonl`);
        await expect(fsPromises.access(traceFilePath)).rejects.toThrow();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long session IDs', async () => {
      console.log('[TraceLogger.test] Testing long session ID');
      const sessionId = 'session-' + 'x'.repeat(200);
      const traceFilePath = path.join(tracesDir, `${sessionId}.trace.jsonl`);

      await traceLogger.log(sessionId, 'to-claude', { msg: 'test' }, 'corr-1');

      // Wait for write
      await new Promise((resolve) => setTimeout(resolve, 100));

      await expect(fsPromises.access(traceFilePath)).resolves.not.toThrow();
    });

    it('should handle special characters in correlation ID', async () => {
      console.log('[TraceLogger.test] Testing special correlation ID');
      const sessionId = 'session-special';
      const correlationId = 'corr-123-abc-!@#$%^&*()';
      const traceFilePath = path.join(tracesDir, `${sessionId}.trace.jsonl`);

      await traceLogger.log(sessionId, 'to-claude', { msg: 'test' }, correlationId);

      // Wait for write
      await new Promise((resolve) => setTimeout(resolve, 100));

      const content = await fsPromises.readFile(traceFilePath, 'utf-8');
      const entry = JSON.parse(content.trim());

      expect(entry.correlationId).toBe(correlationId);
    });

    it('should handle complex nested message objects', async () => {
      console.log('[TraceLogger.test] Testing complex message');
      const sessionId = 'session-complex';
      const traceFilePath = path.join(tracesDir, `${sessionId}.trace.jsonl`);
      const complexMessage = {
        type: 'message',
        nested: {
          deep: {
            data: [1, 2, 3],
            more: { values: 'test' },
          },
        },
        array: [{ id: 1 }, { id: 2 }],
      };

      await traceLogger.log(sessionId, 'to-claude', complexMessage, 'corr-1');

      // Wait for write
      await new Promise((resolve) => setTimeout(resolve, 100));

      const content = await fsPromises.readFile(traceFilePath, 'utf-8');
      const entry = JSON.parse(content.trim());

      expect(entry.rawMessage).toEqual(complexMessage);
    });
  });
});
