/**
 * Mock for @xterm/addon-search
 */

const mockSearchAddonInstance = {
  findNext: jest.fn(),
  findPrevious: jest.fn(),
  dispose: jest.fn(),
};

export const SearchAddon = jest.fn().mockImplementation(() => mockSearchAddonInstance);

export default { SearchAddon };
