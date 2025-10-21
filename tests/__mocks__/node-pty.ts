/**
 * Mock for node-pty module
 * This avoids issues with native bindings in tests
 */

export const spawn = jest.fn();
export const IPty = jest.fn();

export default {
  spawn,
  IPty,
};
