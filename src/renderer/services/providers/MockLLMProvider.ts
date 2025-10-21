import { ChatMessage, Agent } from '@/entities';
import { LLMConfig, LLMProvider, StreamingCallbacks } from '../LLMService';
import { MockLLMService } from '../MockLLMService';

export class MockLLMProvider implements LLMProvider {
  constructor(_config: LLMConfig) {
    // Mock provider doesn't need configuration
  }

  async generateResponse(
    userMessage: string,
    agent: Agent,
    attachedResourceIds: string[],
    _chatHistory: ChatMessage[] = [],
    streamingCallbacks?: StreamingCallbacks
  ): Promise<string> {
    // Simulate streaming for mock provider
    const response = await MockLLMService.generateResponse(userMessage, agent, attachedResourceIds);

    if (streamingCallbacks) {
      // Simulate streaming by sending chunks
      const words = response.split(' ');
      let accumulated = '';

      for (let i = 0; i < words.length; i++) {
        accumulated += (i > 0 ? ' ' : '') + words[i];
        if (streamingCallbacks.onChunk) {
          streamingCallbacks.onChunk(accumulated);
        }
        // Small delay to simulate streaming
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (streamingCallbacks.onComplete) {
        streamingCallbacks.onComplete(response);
      }

      // Simulate token usage for mock provider
      if (streamingCallbacks.onResult) {
        const inputTokens = userMessage.split(' ').length * 2; // Rough estimate
        const outputTokens = response.split(' ').length * 2;
        const totalCost = (inputTokens * 0.003 + outputTokens * 0.015) / 1000; // Mock pricing

        streamingCallbacks.onResult({
          usage: {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
          total_cost_usd: totalCost,
        });
      }
    }

    return response;
  }
}
