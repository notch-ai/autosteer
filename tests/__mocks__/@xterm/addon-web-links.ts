/**
 * Mock for @xterm/addon-web-links
 */

const mockWebLinksAddonInstance = {
  dispose: jest.fn(),
};

export const WebLinksAddon = jest.fn().mockImplementation(() => mockWebLinksAddonInstance);

export default { WebLinksAddon };
