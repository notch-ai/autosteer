/**
 * Mock for electron-store
 * Provides a simple in-memory store implementation for testing
 */

class MockStore {
  constructor(options) {
    this.data = (options?.defaults ?? {});
  }

  get(key, defaultValue) {
    return Object.prototype.hasOwnProperty.call(this.data, key)
      ? this.data[key]
      : defaultValue;
  }

  set(key, value) {
    this.data[key] = value;
  }

  delete(key) {
    delete this.data[key];
  }

  clear() {
    this.data = {};
  }

  has(key) {
    return Object.prototype.hasOwnProperty.call(this.data, key);
  }

  store() {
    return { ...this.data };
  }
}

module.exports = MockStore;
module.exports.default = MockStore;
