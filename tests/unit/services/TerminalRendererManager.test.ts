import { Terminal } from '@xterm/xterm';
import { CanvasAddon } from '@xterm/addon-canvas';
import { WebglAddon } from '@xterm/addon-webgl';
import { TerminalRendererManager } from '@/renderer/services/TerminalRendererManager';

// Mock the addons
jest.mock('@xterm/addon-canvas');
jest.mock('@xterm/addon-webgl');

describe('TerminalRendererManager', () => {
  let terminal: Terminal;
  let manager: TerminalRendererManager;
  let mockCanvasAddon: jest.Mocked<CanvasAddon>;
  let mockWebglAddon: jest.Mocked<WebglAddon>;

  beforeEach(() => {
    // Create a real terminal instance for testing
    terminal = new Terminal();

    // Create mock addon instances
    mockCanvasAddon = {
      activate: jest.fn(),
      dispose: jest.fn(),
    } as unknown as jest.Mocked<CanvasAddon>;

    mockWebglAddon = {
      activate: jest.fn(),
      dispose: jest.fn(),
    } as unknown as jest.Mocked<WebglAddon>;

    // Mock the addon constructors
    (CanvasAddon as jest.MockedClass<typeof CanvasAddon>).mockImplementation(() => mockCanvasAddon);
    (WebglAddon as jest.MockedClass<typeof WebglAddon>).mockImplementation(() => mockWebglAddon);

    // Mock terminal.loadAddon
    terminal.loadAddon = jest.fn();

    manager = new TerminalRendererManager();

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    terminal.dispose();
  });

  describe('Renderer Initialization', () => {
    describe('WebGL Renderer (First Choice)', () => {
      it('should successfully initialize WebGL renderer', () => {
        const result = manager.initializeRenderer(terminal);

        expect(WebglAddon).toHaveBeenCalledTimes(1);
        expect(terminal.loadAddon).toHaveBeenCalledWith(mockWebglAddon);
        expect(result).toBe('webgl');
      });

      it('should return webgl as active renderer type', () => {
        manager.initializeRenderer(terminal);

        const rendererType = manager.getActiveRendererType();
        expect(rendererType).toBe('webgl');
      });

      it('should not attempt Canvas fallback when WebGL succeeds', () => {
        manager.initializeRenderer(terminal);

        expect(CanvasAddon).not.toHaveBeenCalled();
      });
    });

    describe('Canvas Renderer (Fallback from WebGL)', () => {
      it('should fallback to Canvas when WebGL initialization fails', () => {
        // Mock WebGL failure
        (terminal.loadAddon as jest.Mock).mockImplementationOnce(() => {
          throw new Error('WebGL not supported');
        });

        const result = manager.initializeRenderer(terminal);

        expect(WebglAddon).toHaveBeenCalledTimes(1);
        expect(CanvasAddon).toHaveBeenCalledTimes(1);
        expect(terminal.loadAddon).toHaveBeenCalledTimes(2);
        expect(terminal.loadAddon).toHaveBeenLastCalledWith(mockCanvasAddon);
        expect(result).toBe('canvas');
      });

      it('should return canvas as active renderer type after fallback', () => {
        // Mock WebGL failure
        (terminal.loadAddon as jest.Mock).mockImplementationOnce(() => {
          throw new Error('WebGL not supported');
        });

        manager.initializeRenderer(terminal);

        const rendererType = manager.getActiveRendererType();
        expect(rendererType).toBe('canvas');
      });

      it('should log warning when falling back to Canvas', () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

        // Mock WebGL failure
        (terminal.loadAddon as jest.Mock).mockImplementationOnce(() => {
          throw new Error('WebGL not supported');
        });

        manager.initializeRenderer(terminal);

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('WebGL renderer failed'),
          expect.objectContaining({ error: 'WebGL not supported' })
        );

        consoleWarnSpy.mockRestore();
      });
    });

    describe('DOM Renderer (Fallback from Canvas)', () => {
      it('should fallback to DOM when both WebGL and Canvas fail', () => {
        // Mock both WebGL and Canvas failures
        (terminal.loadAddon as jest.Mock).mockImplementation(() => {
          throw new Error('Renderer not supported');
        });

        const result = manager.initializeRenderer(terminal);

        expect(WebglAddon).toHaveBeenCalledTimes(1);
        expect(CanvasAddon).toHaveBeenCalledTimes(1);
        expect(result).toBe('dom');
      });

      it('should return dom as active renderer type after both fallbacks', () => {
        // Mock both failures
        (terminal.loadAddon as jest.Mock).mockImplementation(() => {
          throw new Error('Renderer not supported');
        });

        manager.initializeRenderer(terminal);

        const rendererType = manager.getActiveRendererType();
        expect(rendererType).toBe('dom');
      });

      it('should log warning when falling back to DOM', () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

        // Mock both failures
        (terminal.loadAddon as jest.Mock).mockImplementation(() => {
          throw new Error('Renderer not supported');
        });

        manager.initializeRenderer(terminal);

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Canvas renderer failed'),
          expect.objectContaining({ error: 'Renderer not supported' })
        );
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Using DOM renderer'));

        consoleWarnSpy.mockRestore();
      });

      it('should not throw error when using DOM fallback', () => {
        // Mock both failures
        (terminal.loadAddon as jest.Mock).mockImplementation(() => {
          throw new Error('Renderer not supported');
        });

        expect(() => {
          manager.initializeRenderer(terminal);
        }).not.toThrow();
      });
    });
  });

  describe('Renderer Type Detection', () => {
    it('should return null before any renderer is initialized', () => {
      const rendererType = manager.getActiveRendererType();
      expect(rendererType).toBeNull();
    });

    it('should correctly identify WebGL renderer', () => {
      manager.initializeRenderer(terminal);

      expect(manager.getActiveRendererType()).toBe('webgl');
    });

    it('should correctly identify Canvas renderer', () => {
      // Mock WebGL failure
      (terminal.loadAddon as jest.Mock).mockImplementationOnce(() => {
        throw new Error('WebGL not supported');
      });

      manager.initializeRenderer(terminal);

      expect(manager.getActiveRendererType()).toBe('canvas');
    });

    it('should correctly identify DOM renderer', () => {
      // Mock both failures
      (terminal.loadAddon as jest.Mock).mockImplementation(() => {
        throw new Error('Renderer not supported');
      });

      manager.initializeRenderer(terminal);

      expect(manager.getActiveRendererType()).toBe('dom');
    });
  });

  describe('Error Handling', () => {
    it('should handle WebGL-specific errors gracefully', () => {
      (terminal.loadAddon as jest.Mock).mockImplementationOnce(() => {
        throw new Error('WebGL context lost');
      });

      const result = manager.initializeRenderer(terminal);

      expect(result).toBe('canvas'); // Should fallback to Canvas
    });

    it('should handle Canvas-specific errors gracefully', () => {
      // Mock WebGL failure
      (terminal.loadAddon as jest.Mock).mockImplementationOnce(() => {
        throw new Error('WebGL not supported');
      });

      // Mock Canvas failure
      (terminal.loadAddon as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Canvas rendering error');
      });

      const result = manager.initializeRenderer(terminal);

      expect(result).toBe('dom'); // Should fallback to DOM
    });

    it('should handle non-Error exceptions', () => {
      (terminal.loadAddon as jest.Mock).mockImplementationOnce(() => {
        throw 'String error'; // Non-Error exception
      });

      expect(() => {
        manager.initializeRenderer(terminal);
      }).not.toThrow();
    });
  });

  describe('Performance Considerations', () => {
    it('should only initialize renderer once per terminal', () => {
      manager.initializeRenderer(terminal);
      manager.initializeRenderer(terminal); // Second call

      // Should only attempt WebGL once (first call)
      expect(WebglAddon).toHaveBeenCalledTimes(1);
    });

    it('should track renderer state for quick lookups', () => {
      manager.initializeRenderer(terminal);

      // Multiple getActiveRendererType calls should be efficient
      const type1 = manager.getActiveRendererType();
      const type2 = manager.getActiveRendererType();
      const type3 = manager.getActiveRendererType();

      expect(type1).toBe(type2);
      expect(type2).toBe(type3);
    });
  });

  describe('Multiple Terminal Instances', () => {
    it('should support different renderers for different terminals', () => {
      const terminal2 = new Terminal();
      terminal2.loadAddon = jest.fn();

      // First terminal: WebGL succeeds
      manager.initializeRenderer(terminal);

      // Second terminal: WebGL fails, Canvas succeeds
      (terminal2.loadAddon as jest.Mock).mockImplementationOnce(() => {
        throw new Error('WebGL not supported');
      });
      manager.initializeRenderer(terminal2);

      // Both should be tracked independently
      expect(WebglAddon).toHaveBeenCalledTimes(2);
      expect(CanvasAddon).toHaveBeenCalledTimes(1);

      terminal2.dispose();
    });
  });

  describe('Logging', () => {
    it('should log successful WebGL initialization', () => {
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

      manager.initializeRenderer(terminal);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('WebGL renderer initialized successfully')
      );

      consoleInfoSpy.mockRestore();
    });

    it('should log successful Canvas initialization', () => {
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

      // Mock WebGL failure
      (terminal.loadAddon as jest.Mock).mockImplementationOnce(() => {
        throw new Error('WebGL not supported');
      });

      manager.initializeRenderer(terminal);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Canvas renderer initialized successfully')
      );

      consoleInfoSpy.mockRestore();
    });

    it('should include error details in warning logs', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const testError = new Error('Test WebGL error');
      (terminal.loadAddon as jest.Mock).mockImplementationOnce(() => {
        throw testError;
      });

      manager.initializeRenderer(terminal);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('WebGL renderer failed'),
        expect.objectContaining({ error: 'Test WebGL error' })
      );

      consoleWarnSpy.mockRestore();
    });
  });
});
