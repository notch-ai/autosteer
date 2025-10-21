/**
 * Mock for uuid module
 */

export const v4 = jest.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9));
export const v1 = jest.fn(() => 'test-uuid-v1');

export default {
  v4,
  v1,
};
