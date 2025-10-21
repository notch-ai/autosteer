import { Agent, AgentType } from '@/entities';

/**
 * Mock LLM Service for simulating AI responses
 */
export class MockLLMService {
  private static readonly DELAY_MIN = 1000;
  private static readonly DELAY_MAX = 3000;

  /**
   * Generate a mock response based on the user message and agent context
   */
  static async generateResponse(
    userMessage: string,
    agent: Agent,
    attachedResourceIds: string[] = []
  ): Promise<string> {
    // Simulate API delay
    const delay = Math.random() * (this.DELAY_MAX - this.DELAY_MIN) + this.DELAY_MIN;
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Generate contextual responses based on agent type and content
    const responses = this.getContextualResponses(agent, userMessage, attachedResourceIds);

    // Return a random response from the pool
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Generate contextual responses based on agent type and content
   */
  private static getContextualResponses(
    agent: Agent,
    userMessage: string,
    attachedResourceIds: string[]
  ): string[] {
    const baseResponses: string[] = [];

    // Add responses based on agent type
    switch (agent.type) {
      case AgentType.CODE:
        baseResponses.push(
          `I can see this is a code agent titled "${agent.title}". The code appears to be well-structured. Would you like me to explain any specific part?`,
          `Looking at this code, I notice it's organized into clear sections. Is there a particular function or logic you'd like to discuss?`,
          `This code agent contains interesting implementation details. What aspects would you like to explore further?`
        );
        break;

      case AgentType.DOCUMENT:
        baseResponses.push(
          `I'm analyzing the document "${agent.title}". It covers several important topics. What would you like to know more about?`,
          `This document provides comprehensive information. Which section interests you the most?`,
          `Based on the document content, I can help you understand specific concepts or summarize key points.`
        );
        break;

      case AgentType.IMAGE:
        baseResponses.push(
          `I can see the image "${agent.title}". What would you like to know about it?`,
          `This image contains visual information that might be relevant to your work. How can I help you analyze it?`,
          `Looking at this image, I can help describe its contents or discuss its relevance to your project.`
        );
        break;

      default:
        baseResponses.push(
          `I'm reviewing the agent "${agent.title}". What specific aspects would you like to discuss?`,
          `This agent contains interesting content. How can I assist you with it?`,
          `I've analyzed the agent content. What questions do you have?`
        );
    }

    // Add responses based on user message keywords
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('explain')) {
      baseResponses.push(
        `Let me explain the key concepts in this ${agent.type} agent...`,
        `I'll break down the main ideas for you...`,
        `Here's a detailed explanation of what this agent contains...`
      );
    }

    if (lowerMessage.includes('help')) {
      baseResponses.push(
        `I'm here to help! Based on this ${agent.type} agent, I can assist with...`,
        `Of course! Let me help you understand this better...`,
        `I'd be happy to help. What specific aspect needs clarification?`
      );
    }

    if (lowerMessage.includes('summary') || lowerMessage.includes('summarize')) {
      baseResponses.push(
        `Here's a concise summary of the key points in "${agent.title}"...`,
        `Let me summarize the main takeaways from this agent...`,
        `The essential points from this ${agent.type} agent are...`
      );
    }

    // Add responses about attached resources
    if (attachedResourceIds.length > 0) {
      baseResponses.push(
        `I see you've attached ${attachedResourceIds.length} resource(s). Let me incorporate those into my analysis...`,
        `Taking into account the attached resources, here's my perspective...`,
        `The attached resources provide additional context. Based on both the agent and these resources...`
      );
    }

    // Add some generic contextual responses
    baseResponses.push(
      `Based on the content of "${agent.title}", ${this.generateInsight(agent)}`,
      `Analyzing this ${agent.type} agent, I notice ${this.generateObservation(agent)}`,
      `Regarding your question about this agent: ${this.generateAnswer(userMessage)}`
    );

    return baseResponses;
  }

  /**
   * Generate a mock insight based on agent
   */
  private static generateInsight(_agent: Agent): string {
    const insights = [
      'there are several interesting patterns worth exploring',
      'the structure follows best practices for this type of content',
      'this could be enhanced with additional context or examples',
      'the main concepts are clearly presented',
      'there are opportunities for further development',
    ];

    return insights[Math.floor(Math.random() * insights.length)];
  }

  /**
   * Generate a mock observation
   */
  private static generateObservation(_agent: Agent): string {
    const observations = [
      'the content is well-organized and easy to follow',
      'there are clear connections between different sections',
      'the key information is prominently featured',
      'this aligns with current best practices',
      'the approach taken here is quite effective',
    ];

    return observations[Math.floor(Math.random() * observations.length)];
  }

  /**
   * Generate a mock answer snippet
   */
  private static generateAnswer(_userMessage: string): string {
    const answers = [
      'Let me provide you with a detailed analysis.',
      'I can offer several perspectives on this.',
      'There are multiple ways to approach this question.',
      'Based on my analysis, here are my thoughts.',
      'I have some suggestions that might be helpful.',
    ];

    return answers[Math.floor(Math.random() * answers.length)];
  }
}
