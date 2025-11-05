const mockTransports = {
  file: {
    level: false,
    format: '',
    maxSize: 0,
  },
  console: {
    level: false,
    format: '',
  },
};

const mockLog = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  silly: jest.fn(),
  log: jest.fn(),
  transports: mockTransports,
  initialize: jest.fn(),
  scope: jest.fn(() => mockLog),
};

const log = mockLog;

export default log;
export { log };
