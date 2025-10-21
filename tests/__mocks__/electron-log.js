// Mock for electron-log
const mockLog = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  silly: jest.fn(),
  transports: {
    file: {
      resolvePathFn: jest.fn(),
      level: 'debug',
      format: '[{y}-{m}-{d} {h}:{i}:{s}] [{processType}] [{level}] {text}',
      maxSize: 5 * 1024 * 1024,
      archiveLogFn: jest.fn()
    },
    console: {
      level: 'debug',
      format: '[{h}:{i}:{s}] [{level}] {text}'
    }
  },
  catchErrors: jest.fn()
};

module.exports = mockLog;
module.exports.default = mockLog;