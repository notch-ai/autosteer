export const ClaudeCodeProvider = jest.fn().mockImplementation(() => ({
  generateResponse: jest.fn().mockResolvedValue('Mocked response'),
  stopStreaming: jest.fn(),
}));
