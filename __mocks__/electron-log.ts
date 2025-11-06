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

interface MockLog {
  info: jest.Mock;
  error: jest.Mock;
  warn: jest.Mock;
  debug: jest.Mock;
  verbose: jest.Mock;
  silly: jest.Mock;
  log: jest.Mock;
  transports: typeof mockTransports;
  initialize: jest.Mock;
  scope: jest.Mock;
}

const mockLog: MockLog = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  silly: jest.fn(),
  log: jest.fn(),
  transports: mockTransports,
  initialize: jest.fn(),
  scope: jest.fn((): MockLog => mockLog),
};

const log = mockLog;

export default log;
export { log };
