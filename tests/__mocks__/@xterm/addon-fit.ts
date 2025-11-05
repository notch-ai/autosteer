/**
 * Mock for @xterm/addon-fit
 */

const mockFitAddonInstance = {
  fit: jest.fn(),
  proposeDimensions: jest.fn(() => ({ cols: 80, rows: 24 })),
  dispose: jest.fn(),
};

export const FitAddon = jest.fn().mockImplementation(() => mockFitAddonInstance);

export default { FitAddon };
