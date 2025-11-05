export default class Anthropic {
  apiKey: string;

  constructor(config: { apiKey: string }) {
    this.apiKey = config.apiKey;
  }

  messages = {
    create: jest.fn().mockResolvedValue({
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Mock response' }],
      model: 'claude-3-sonnet-20240229',
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 20 },
    }),
    stream: jest.fn(),
  };

  beta = {
    messages: {
      create: jest.fn().mockResolvedValue({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Mock response' }],
        model: 'claude-3-sonnet-20240229',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    },
  };
}
