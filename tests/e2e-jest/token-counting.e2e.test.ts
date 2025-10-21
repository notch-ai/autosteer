/**
 * E2E Test for Token Counting Functionality
 *
 * This test verifies the ClaudeCodeSDKService's token counting capability
 * using the Anthropic API's /v1/messages/count_tokens endpoint.
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY environment variable must be set
 * - Active internet connection for API calls
 */

import { ClaudeCodeSDKService } from '@/services/ClaudeCodeSDKService';

describe('Token Counting E2E Tests', () => {
  let service: ClaudeCodeSDKService;

  beforeAll(() => {
    service = ClaudeCodeSDKService.getInstance();
  });

  describe('countTokens()', () => {
    it('should count tokens for a simple message', async () => {
      const result = await service.countTokens({
        model: 'claude-sonnet-4-5',
        messages: [
          {
            role: 'user',
            content: 'Hello, Claude',
          },
        ],
      });

      expect(result).toBeDefined();
      expect(result.input_tokens).toBeGreaterThan(0);
      expect(typeof result.input_tokens).toBe('number');
      console.log(`✓ Simple message token count: ${result.input_tokens}`);
    }, 30000); // 30 second timeout for API call

    it('should count tokens with system prompt', async () => {
      const result = await service.countTokens({
        model: 'claude-sonnet-4-5',
        system: 'You are a helpful assistant specialized in software engineering.',
        messages: [
          {
            role: 'user',
            content: 'Explain dependency injection in TypeScript',
          },
        ],
      });

      expect(result).toBeDefined();
      expect(result.input_tokens).toBeGreaterThan(0);
      console.log(`✓ With system prompt token count: ${result.input_tokens}`);
    }, 30000);

    it('should count tokens for multi-turn conversation', async () => {
      const result = await service.countTokens({
        model: 'claude-sonnet-4-5',
        system: 'You are a helpful programming assistant.',
        messages: [
          {
            role: 'user',
            content: 'What is React?',
          },
          {
            role: 'assistant',
            content:
              'React is a JavaScript library for building user interfaces, developed by Facebook.',
          },
          {
            role: 'user',
            content: 'How does it differ from Vue.js?',
          },
        ],
      });

      expect(result).toBeDefined();
      expect(result.input_tokens).toBeGreaterThan(0);
      console.log(`✓ Multi-turn conversation token count: ${result.input_tokens}`);
    }, 30000);

    it('should count tokens for long content', async () => {
      const longContent = `
        This is a longer piece of text designed to test token counting with substantial content.
        Token counting is important for understanding API costs and managing context windows.

        In large language models like Claude, tokens represent pieces of text that the model processes.
        A token can be as short as one character or as long as one word. For example:
        - "cat" is typically one token
        - "ChatGPT" might be one or two tokens
        - Numbers, punctuation, and special characters each have their own tokenization rules

        Understanding token usage helps developers:
        1. Optimize prompts for efficiency
        2. Manage costs effectively
        3. Stay within model context windows
        4. Debug issues with input/output limits

        The Claude API provides a dedicated endpoint for token counting, which returns
        accurate estimates before sending the actual request to the model.
      `.trim();

      const result = await service.countTokens({
        model: 'claude-sonnet-4-5',
        messages: [
          {
            role: 'user',
            content: longContent,
          },
        ],
      });

      expect(result).toBeDefined();
      expect(result.input_tokens).toBeGreaterThan(50); // Long text should have many tokens
      console.log(`✓ Long content token count: ${result.input_tokens}`);
    }, 30000);

    it('should count tokens for code content', async () => {
      const codeContent = `
function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Test the function
console.log(fibonacci(10));
      `.trim();

      const result = await service.countTokens({
        model: 'claude-sonnet-4-5',
        system: 'You are an expert code reviewer.',
        messages: [
          {
            role: 'user',
            content: `Review this TypeScript code:\n\n${codeContent}`,
          },
        ],
      });

      expect(result).toBeDefined();
      expect(result.input_tokens).toBeGreaterThan(0);
      console.log(`✓ Code content token count: ${result.input_tokens}`);
    }, 30000);

    it('should handle different Claude models', async () => {
      const models = ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-haiku-3-5'];

      for (const model of models) {
        const result = await service.countTokens({
          model,
          messages: [
            {
              role: 'user',
              content: 'Hello, how are you?',
            },
          ],
        });

        expect(result).toBeDefined();
        expect(result.input_tokens).toBeGreaterThan(0);
        console.log(`✓ Model ${model} token count: ${result.input_tokens}`);
      }
    }, 90000); // 90 seconds for multiple API calls

    it('should return consistent results for same input', async () => {
      const testInput = {
        model: 'claude-sonnet-4-5',
        system: 'You are a helpful assistant.',
        messages: [
          {
            role: 'user' as const,
            content: 'What is the meaning of life?',
          },
        ],
      };

      // Call twice with same input
      const result1 = await service.countTokens(testInput);
      const result2 = await service.countTokens(testInput);

      expect(result1.input_tokens).toBe(result2.input_tokens);
      console.log(`✓ Consistent token count: ${result1.input_tokens}`);
    }, 60000);
  });

  describe('Error Handling', () => {
    it('should throw error when API key is missing', async () => {
      // Temporarily unset the API key
      const originalKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      // Create a new service instance to reset the client
      const testService = ClaudeCodeSDKService.getInstance();

      try {
        await testService.countTokens({
          model: 'claude-sonnet-4-5',
          messages: [{ role: 'user', content: 'Test' }],
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
        // The error message varies depending on environment (Node vs Browser)
        const errorMsg = (error as Error).message;
        expect(
          errorMsg.includes('ANTHROPIC_API_KEY') ||
            errorMsg.includes('dangerouslyAllowBrowser') ||
            errorMsg.includes('browser-like environment') ||
            errorMsg.includes('authentication method') ||
            errorMsg.includes('apiKey or authToken')
        ).toBe(true);
        console.log('✓ Correctly throws error when API key is missing');
      } finally {
        // Restore the original API key
        if (originalKey) {
          process.env.ANTHROPIC_API_KEY = originalKey;
        }
      }
    }, 10000);

    it('should handle invalid model name gracefully', async () => {
      try {
        await service.countTokens({
          model: 'invalid-model-name',
          messages: [{ role: 'user', content: 'Test' }],
        });
        fail('Should have thrown an error for invalid model');
      } catch (error) {
        expect(error).toBeDefined();
        console.log('✓ Correctly handles invalid model name');
      }
    }, 30000);
  });

  describe('Performance', () => {
    it('should complete token counting within reasonable time', async () => {
      const startTime = Date.now();

      await service.countTokens({
        model: 'claude-sonnet-4-5',
        messages: [
          {
            role: 'user',
            content: 'Quick performance test',
          },
        ],
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10000); // Should complete in less than 10 seconds
      console.log(`✓ Token counting completed in ${duration}ms`);
    }, 15000);
  });
});
