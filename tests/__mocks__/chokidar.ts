/**
 * Mock for chokidar file watcher library
 * Used in tests to avoid actual file system watching
 */

export class FSWatcher {
  on = jest.fn().mockReturnThis();
  close = jest.fn().mockResolvedValue(undefined);
  add = jest.fn().mockReturnThis();
  unwatch = jest.fn().mockReturnThis();
  getWatched = jest.fn().mockReturnValue({});
}

export const watch = jest.fn(() => new FSWatcher());

export default {
  watch,
  FSWatcher,
};
