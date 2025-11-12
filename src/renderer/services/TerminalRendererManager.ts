import { Terminal } from '@xterm/xterm';
import { CanvasAddon } from '@xterm/addon-canvas';
import { WebglAddon } from '@xterm/addon-webgl';

/**
 * Type of terminal renderer
 */
export type RendererType = 'webgl' | 'canvas' | 'dom';

/**
 * TerminalRendererManager - Manages WebGL → Canvas → DOM fallback rendering
 *
 * @see docs/terminal-persistence-architecture.md for terminal architecture
 */
export class TerminalRendererManager {
  private rendererTypes: Map<Terminal, RendererType> = new Map();

  /**
   * Initialize the best available renderer for a terminal instance
   *
   * Attempts renderers in order: WebGL → Canvas → DOM
   * Returns the active renderer type for telemetry/debugging
   *
   * @param terminal The XTerm.js terminal instance
   * @returns The active renderer type
   */
  initializeRenderer(terminal: Terminal): RendererType {
    // Skip if already initialized for this terminal
    const existingRenderer = this.rendererTypes.get(terminal);
    if (existingRenderer !== undefined) {
      console.debug('[TerminalRendererManager] Renderer already initialized', {
        type: existingRenderer,
      });
      return existingRenderer;
    }

    // Try WebGL first (fastest option)
    if (this.tryWebGL(terminal)) {
      this.rendererTypes.set(terminal, 'webgl');
      console.info('[TerminalRendererManager] WebGL renderer initialized successfully');
      return 'webgl';
    }

    // Fallback to Canvas (fast option)
    if (this.tryCanvas(terminal)) {
      this.rendererTypes.set(terminal, 'canvas');
      console.info('[TerminalRendererManager] Canvas renderer initialized successfully');
      return 'canvas';
    }

    // Final fallback to DOM (compatible option)
    this.rendererTypes.set(terminal, 'dom');
    console.warn('[TerminalRendererManager] Using DOM renderer as final fallback');
    return 'dom';
  }

  /**
   * Get the currently active renderer type
   * @returns The active renderer type, or null if not initialized
   */
  getActiveRendererType(): RendererType | null {
    // For single-terminal use case, return the first (and likely only) renderer type
    const entries = Array.from(this.rendererTypes.values());
    return entries.length > 0 ? entries[0] : null;
  }

  /**
   * Try to initialize WebGL renderer
   * @param terminal The terminal instance
   * @returns true if successful, false otherwise
   */
  private tryWebGL(terminal: Terminal): boolean {
    try {
      const webglAddon = new WebglAddon();
      terminal.loadAddon(webglAddon);
      console.debug('[TerminalRendererManager] WebGL renderer loaded successfully');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('[TerminalRendererManager] WebGL renderer failed, trying Canvas fallback', {
        error: errorMessage,
      });
      return false;
    }
  }

  /**
   * Try to initialize Canvas renderer
   * @param terminal The terminal instance
   * @returns true if successful, false otherwise
   */
  private tryCanvas(terminal: Terminal): boolean {
    try {
      const canvasAddon = new CanvasAddon();
      terminal.loadAddon(canvasAddon);
      console.debug('[TerminalRendererManager] Canvas renderer loaded successfully');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('[TerminalRendererManager] Canvas renderer failed, falling back to DOM', {
        error: errorMessage,
      });
      return false;
    }
  }
}
