// Theme setup for testing

// Mock theme configuration
global.matchMedia =
  global.matchMedia ||
  function (query: string) {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };
  };

// Mock CSS custom properties
Object.defineProperty(document.documentElement, 'style', {
  value: {
    setProperty: jest.fn(),
    getPropertyValue: jest.fn(),
  },
  writable: true,
});
