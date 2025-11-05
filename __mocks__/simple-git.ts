export const simpleGit = jest.fn(() => ({
  log: jest.fn().mockResolvedValue({ latest: null }),
  status: jest.fn().mockResolvedValue({ files: [] }),
  diff: jest.fn().mockResolvedValue(''),
  diffSummary: jest.fn().mockResolvedValue({ files: [] }),
  add: jest.fn().mockResolvedValue(undefined),
  commit: jest.fn().mockResolvedValue({}),
  push: jest.fn().mockResolvedValue(undefined),
  pull: jest.fn().mockResolvedValue(undefined),
  fetch: jest.fn().mockResolvedValue(undefined),
  checkout: jest.fn().mockResolvedValue(undefined),
  branch: jest.fn().mockResolvedValue({ all: [], current: 'main' }),
  raw: jest.fn().mockResolvedValue(''),
}));

export default simpleGit;

export interface SimpleGit {
  log: jest.Mock;
  status: jest.Mock;
  diff: jest.Mock;
  diffSummary: jest.Mock;
  add: jest.Mock;
  commit: jest.Mock;
  push: jest.Mock;
  pull: jest.Mock;
  fetch: jest.Mock;
  checkout: jest.Mock;
  branch: jest.Mock;
  raw: jest.Mock;
}
