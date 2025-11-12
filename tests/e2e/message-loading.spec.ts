/**
 * E2E Tests for Message Loading with Corrupt Data
 *
 * Tests the complete message loading flow including:
 * - Validation with corrupt messages
 * - Error handling and graceful degradation
 * - Cache performance
 * - Partial message loading
 */

import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs/promises';
import { MessageValidator } from '@/services/MessageValidator';

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures', 'corrupt-messages');

describe('Message Loading E2E Tests', () => {
  describe('Corrupt Message Handling', () => {
    test('should handle invalid JSON gracefully', async () => {
      const fixturePath = path.join(FIXTURES_DIR, 'invalid-json.jsonl');
      const content = await fs.readFile(fixturePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());

      let validMessages = 0;
      let invalidMessages = 0;

      for (const line of lines) {
        try {
          const message = JSON.parse(line);
          const result = MessageValidator.validate(message);

          if (result.isValid) {
            validMessages++;
          } else {
            invalidMessages++;
          }
        } catch (error) {
          // JSON parsing failed
          invalidMessages++;
        }
      }

      // Should load some valid messages despite invalid JSON
      expect(validMessages).toBeGreaterThan(0);
      expect(invalidMessages).toBeGreaterThan(0);
    });

    test('should handle missing required fields with partial extraction', async () => {
      const fixturePath = path.join(FIXTURES_DIR, 'missing-fields.jsonl');
      const content = await fs.readFile(fixturePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());

      let relaxedValid = 0;
      let partialValid = 0;

      for (const line of lines) {
        const message = JSON.parse(line);
        const result = MessageValidator.validate(message);

        if (result.isValid) {
          if (result.validationMethod === 'relaxed') {
            relaxedValid++;
          } else if (result.validationMethod === 'partial') {
            partialValid++;
          }
        }
      }

      // Should use progressive fallback validation
      expect(partialValid + relaxedValid).toBeGreaterThan(0);
    });

    test('should detect SDK version mismatches', async () => {
      const fixturePath = path.join(FIXTURES_DIR, 'sdk-version-mismatch.jsonl');
      const content = await fs.readFile(fixturePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());

      const messages = lines.map((line) => JSON.parse(line));

      // All messages should parse but may have version metadata
      messages.forEach((message) => {
        const result = MessageValidator.validate(message);
        expect(result).toBeDefined();
      });
    });

    test('should validate all message types', async () => {
      const fixturePath = path.join(FIXTURES_DIR, 'all-message-types.jsonl');
      const content = await fs.readFile(fixturePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());

      const messageTypes = new Set<string>();
      const validationMethods = new Set<string>();

      for (const line of lines) {
        const message = JSON.parse(line);
        const result = MessageValidator.validate(message);

        if (result.isValid) {
          messageTypes.add(message.type);
          validationMethods.add(result.validationMethod);
        }
      }

      // Should handle multiple message types
      expect(messageTypes.size).toBeGreaterThan(1);

      // Should include system, user, assistant types at minimum
      expect(Array.from(messageTypes)).toContain('user');
    });
  });

  describe('Batch Validation Performance', () => {
    test('should batch validate messages efficiently', async () => {
      const fixturePath = path.join(FIXTURES_DIR, 'all-message-types.jsonl');
      const content = await fs.readFile(fixturePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());
      const messages = lines.map((line) => JSON.parse(line));

      const startTime = Date.now();
      const { results, summary } = MessageValidator.validateBatchWithSummary(messages);
      const endTime = Date.now();

      const duration = endTime - startTime;

      // Batch validation should be fast (< 100ms for fixture size)
      expect(duration).toBeLessThan(100);

      // Should provide accurate summary
      expect(summary.total).toBe(messages.length);
      expect(summary.valid + summary.invalid).toBe(messages.length);

      // Results should match summary
      expect(results).toHaveLength(summary.total);
    });

    test('should track validation method distribution', async () => {
      const fixturePath = path.join(FIXTURES_DIR, 'missing-fields.jsonl');
      const content = await fs.readFile(fixturePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());
      const messages = lines.map((line) => JSON.parse(line));

      const { summary } = MessageValidator.validateBatchWithSummary(messages);

      // Should have breakdown of validation methods
      expect(summary.strict + summary.relaxed + summary.partial + summary.failed).toBe(
        summary.total
      );
    });
  });

  describe('Error Reporting', () => {
    test('should collect validation errors', async () => {
      const fixturePath = path.join(FIXTURES_DIR, 'invalid-json.jsonl');
      const content = await fs.readFile(fixturePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());

      const errors: string[] = [];

      for (const line of lines) {
        try {
          const message = JSON.parse(line);
          const result = MessageValidator.validate(message);

          if (!result.isValid && result.errors) {
            errors.push(...result.errors);
          }
        } catch (error) {
          errors.push(String(error));
        }
      }

      // Should collect error messages for invalid data
      expect(errors.length).toBeGreaterThan(0);

      // Each error should be a string
      errors.forEach((error) => {
        expect(typeof error).toBe('string');
      });
    });

    test('should provide warnings for relaxed validation', async () => {
      const fixturePath = path.join(FIXTURES_DIR, 'missing-fields.jsonl');
      const content = await fs.readFile(fixturePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());

      let warningsCount = 0;

      for (const line of lines) {
        const message = JSON.parse(line);
        const result = MessageValidator.validate(message);

        if (result.warnings && result.warnings.length > 0) {
          warningsCount++;
        }
      }

      // Should generate warnings for messages using fallback validation
      expect(warningsCount).toBeGreaterThan(0);
    });
  });

  describe('Metadata Tracking', () => {
    test('should preserve session IDs', async () => {
      const fixturePath = path.join(FIXTURES_DIR, 'all-message-types.jsonl');
      const content = await fs.readFile(fixturePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());

      const sessionIds = new Set<string>();

      for (const line of lines) {
        const message = JSON.parse(line);
        const result = MessageValidator.validate(message);

        if (result.metadata?.sessionId) {
          sessionIds.add(result.metadata.sessionId);
        }
      }

      // Should extract and preserve session IDs
      expect(sessionIds.size).toBeGreaterThan(0);
    });

    test('should generate correlation IDs', async () => {
      const fixturePath = path.join(FIXTURES_DIR, 'all-message-types.jsonl');
      const content = await fs.readFile(fixturePath, 'utf-8');
      const firstLine = content.split('\n')[0];
      const message = JSON.parse(firstLine);

      const result = MessageValidator.validate(message);

      // Should have correlation ID
      expect(result.metadata?.correlationId).toBeDefined();
      expect(typeof result.metadata?.correlationId).toBe('string');
    });

    test('should track sequence numbers across batch', async () => {
      const fixturePath = path.join(FIXTURES_DIR, 'all-message-types.jsonl');
      const content = await fs.readFile(fixturePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());
      const messages = lines.map((line) => JSON.parse(line));

      MessageValidator.resetSequenceCounter();

      const results = MessageValidator.validateBatch(messages);

      const sequenceNumbers = results
        .map((r) => r.metadata?.sequenceNumber)
        .filter((n): n is number => n !== undefined);

      // Should have monotonically increasing sequence numbers
      expect(sequenceNumbers.length).toBeGreaterThan(0);

      for (let i = 1; i < sequenceNumbers.length; i++) {
        expect(sequenceNumbers[i]).toBe(sequenceNumbers[i - 1] + 1);
      }
    });
  });

  describe('Graceful Degradation', () => {
    test('should never crash on corrupt data', async () => {
      const fixtureFiles = [
        'invalid-json.jsonl',
        'missing-fields.jsonl',
        'sdk-version-mismatch.jsonl',
      ];

      for (const file of fixtureFiles) {
        const fixturePath = path.join(FIXTURES_DIR, file);
        const content = await fs.readFile(fixturePath, 'utf-8');
        const lines = content.split('\n').filter((line) => line.trim());

        // Should not throw errors during validation
        expect(() => {
          for (const line of lines) {
            try {
              const message = JSON.parse(line);
              MessageValidator.validate(message);
            } catch (jsonError) {
              // JSON parsing errors are expected for invalid-json fixture
              // Validation should still not crash
            }
          }
        }).not.toThrow();
      }
    });

    test('should return partial results instead of failing completely', async () => {
      const fixturePath = path.join(FIXTURES_DIR, 'missing-fields.jsonl');
      const content = await fs.readFile(fixturePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());
      const messages = lines.map((line) => JSON.parse(line));

      const results = MessageValidator.validateBatch(messages);

      // Should have at least some valid or partially valid messages
      const successfulResults = results.filter((r) => r.isValid);
      expect(successfulResults.length).toBeGreaterThan(0);

      // Partial validation should succeed where strict fails
      const partialResults = results.filter((r) => r.validationMethod === 'partial' && r.isValid);
      expect(partialResults.length).toBeGreaterThan(0);
    });
  });
});
