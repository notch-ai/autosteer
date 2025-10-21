import { Terminal as XTermTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import {
  TerminalLibraryAdapter,
  TerminalAdapterConfig,
  TerminalEventHandlers,
  TerminalBufferState,
} from '@/renderer/services/TerminalLibraryAdapter';

// Mock electron-log
jest.mock('electron-log', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock XTerm.js and addons
jest.mock('@xterm/xterm');
jest.mock('@xterm/addon-fit');
jest.mock('@xterm/addon-web-links');
jest.mock('@xterm/addon-search');

describe('TerminalLibraryAdapter', () => {
  let mockTerminal: jest.Mocked<XTermTerminal>;
  let mockFitAddon: jest.Mocked<FitAddon>;
  let mockWebLinksAddon: jest.Mocked<WebLinksAddon>;
  let mockSearchAddon: jest.Mocked<SearchAddon>;
  let mockElement: HTMLElement;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock terminal instance
    mockTerminal = {
      open: jest.fn(),
      write: jest.fn(),
      writeln: jest.fn(),
      clear: jest.fn(),
      reset: jest.fn(),
      focus: jest.fn(),
      blur: jest.fn(),
      resize: jest.fn(),
      dispose: jest.fn(),
      loadAddon: jest.fn(),
      onData: jest.fn(),
      onResize: jest.fn(),
      onTitleChange: jest.fn(),
      onBell: jest.fn(),
      onCursorMove: jest.fn(),
      onScroll: jest.fn(),
      cols: 80,
      rows: 24,
      buffer: {
        active: {
          length: 100,
          cursorX: 10,
          cursorY: 20,
          getLine: jest.fn((i: number) => ({
            translateToString: jest.fn(() => `Line ${i} content`),
          })),
        },
      },
    } as unknown as jest.Mocked<XTermTerminal>;

    // Mock terminal constructor
    (XTermTerminal as jest.MockedClass<typeof XTermTerminal>).mockImplementation(
      () => mockTerminal
    );

    // Create mock addons
    mockFitAddon = {
      fit: jest.fn(),
    } as unknown as jest.Mocked<FitAddon>;

    mockWebLinksAddon = {} as jest.Mocked<WebLinksAddon>;

    mockSearchAddon = {
      findNext: jest.fn(),
    } as unknown as jest.Mocked<SearchAddon>;

    // Mock addon constructors
    (FitAddon as jest.MockedClass<typeof FitAddon>).mockImplementation(() => mockFitAddon);
    (WebLinksAddon as jest.MockedClass<typeof WebLinksAddon>).mockImplementation(
      () => mockWebLinksAddon
    );
    (SearchAddon as jest.MockedClass<typeof SearchAddon>).mockImplementation(() => mockSearchAddon);

    // Create mock DOM element
    mockElement = document.createElement('div');
  });

  describe('Constructor', () => {
    it('should create terminal with default configuration', () => {
      new TerminalLibraryAdapter();

      expect(XTermTerminal).toHaveBeenCalledWith(
        expect.objectContaining({
          scrollback: 10000,
          fontSize: 14,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          cursorBlink: true,
          convertEol: true,
          theme: expect.objectContaining({
            background: '#1e1e1e',
            foreground: '#d4d4d4',
          }),
        })
      );

      expect(mockTerminal.loadAddon).toHaveBeenCalledTimes(3);
      expect(mockTerminal.loadAddon).toHaveBeenCalledWith(mockFitAddon);
      expect(mockTerminal.loadAddon).toHaveBeenCalledWith(mockWebLinksAddon);
      expect(mockTerminal.loadAddon).toHaveBeenCalledWith(mockSearchAddon);
    });

    it('should create terminal with custom configuration', () => {
      const customConfig: Partial<TerminalAdapterConfig> = {
        scrollback: 5000,
        fontSize: 16,
        fontFamily: 'Courier New',
        cursorBlink: false,
        theme: {
          background: '#000000',
          foreground: '#ffffff',
        },
      };

      new TerminalLibraryAdapter(customConfig);

      expect(XTermTerminal).toHaveBeenCalledWith(
        expect.objectContaining({
          scrollback: 5000,
          fontSize: 16,
          fontFamily: 'Courier New',
          cursorBlink: false,
          theme: expect.objectContaining({
            background: '#000000',
            foreground: '#ffffff',
          }),
        })
      );
    });

    it('should merge custom config with defaults', () => {
      const customConfig: Partial<TerminalAdapterConfig> = {
        scrollback: 15000,
      };

      new TerminalLibraryAdapter(customConfig);

      expect(XTermTerminal).toHaveBeenCalledWith(
        expect.objectContaining({
          scrollback: 15000,
          fontSize: 14, // Default
          fontFamily: 'Menlo, Monaco, "Courier New", monospace', // Default
        })
      );
    });
  });

  describe('attach', () => {
    it('should attach terminal to DOM element', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.attach(mockElement);

      expect(mockTerminal.open).toHaveBeenCalledWith(mockElement);
      expect(mockFitAddon.fit).toHaveBeenCalled();
    });

    it('should throw error when attaching disposed terminal', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.dispose();

      expect(() => adapter.attach(mockElement)).toThrow('Cannot attach disposed terminal');
      expect(mockTerminal.open).not.toHaveBeenCalled();
    });
  });

  describe('detach', () => {
    it('should detach terminal without disposing instance', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.attach(mockElement);
      adapter.detach();

      // Terminal should not be disposed
      expect(mockTerminal.dispose).not.toHaveBeenCalled();
      expect(adapter.isTerminalDisposed()).toBe(false);
    });
  });

  describe('write', () => {
    it('should write data to terminal', () => {
      const adapter = new TerminalLibraryAdapter();
      const testData = 'Hello, terminal!';
      adapter.write(testData);

      expect(mockTerminal.write).toHaveBeenCalledWith(testData);
    });

    it('should not write to disposed terminal', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.dispose();
      adapter.write('test');

      expect(mockTerminal.write).not.toHaveBeenCalled();
    });
  });

  describe('writeln', () => {
    it('should write line to terminal', () => {
      const adapter = new TerminalLibraryAdapter();
      const testData = 'Hello, terminal!';
      adapter.writeln(testData);

      expect(mockTerminal.writeln).toHaveBeenCalledWith(testData);
    });

    it('should not writeln to disposed terminal', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.dispose();
      adapter.writeln('test');

      expect(mockTerminal.writeln).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should clear terminal screen', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.clear();

      expect(mockTerminal.clear).toHaveBeenCalled();
    });

    it('should not clear disposed terminal', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.dispose();
      adapter.clear();

      expect(mockTerminal.clear).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset terminal to initial state', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.reset();

      expect(mockTerminal.reset).toHaveBeenCalled();
    });

    it('should not reset disposed terminal', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.dispose();
      adapter.reset();

      expect(mockTerminal.reset).not.toHaveBeenCalled();
    });
  });

  describe('focus', () => {
    it('should focus terminal', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.focus();

      expect(mockTerminal.focus).toHaveBeenCalled();
    });

    it('should not focus disposed terminal', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.dispose();
      adapter.focus();

      expect(mockTerminal.focus).not.toHaveBeenCalled();
    });
  });

  describe('blur', () => {
    it('should blur terminal', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.blur();

      expect(mockTerminal.blur).toHaveBeenCalled();
    });

    it('should not blur disposed terminal', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.dispose();
      adapter.blur();

      expect(mockTerminal.blur).not.toHaveBeenCalled();
    });
  });

  describe('fit', () => {
    it('should fit terminal to container', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.fit();

      expect(mockFitAddon.fit).toHaveBeenCalled();
    });

    it('should not fit disposed terminal', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.dispose();
      adapter.fit();

      expect(mockFitAddon.fit).not.toHaveBeenCalled();
    });
  });

  describe('resize', () => {
    it('should resize terminal', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.resize(100, 30);

      expect(mockTerminal.resize).toHaveBeenCalledWith(100, 30);
    });

    it('should not resize disposed terminal', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.dispose();
      adapter.resize(100, 30);

      expect(mockTerminal.resize).not.toHaveBeenCalled();
    });
  });

  describe('getDimensions', () => {
    it('should return terminal dimensions', () => {
      const adapter = new TerminalLibraryAdapter();
      (mockTerminal as any).cols = 100;
      (mockTerminal as any).rows = 30;

      const dimensions = adapter.getDimensions();

      expect(dimensions).toEqual({ cols: 100, rows: 30 });
    });
  });

  describe('getBufferState', () => {
    it('should capture terminal buffer state', () => {
      const adapter = new TerminalLibraryAdapter();
      (mockTerminal as any).cols = 80;
      (mockTerminal as any).rows = 24;

      const bufferState = adapter.getBufferState();

      expect(bufferState).toMatchObject({
        cursorX: 10,
        cursorY: 20,
        cols: 80,
        rows: 24,
      });
      expect(bufferState.scrollback).toHaveLength(100);
      expect(bufferState.content).toContain('Line 0 content');
    });

    it('should throw error when getting buffer state from disposed terminal', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.dispose();

      expect(() => adapter.getBufferState()).toThrow(
        'Cannot get buffer state from disposed terminal'
      );
    });
  });

  describe('restoreBufferState', () => {
    it('should restore terminal buffer state', () => {
      const adapter = new TerminalLibraryAdapter();
      const mockState: TerminalBufferState = {
        content: 'Line 1\nLine 2\nLine 3',
        cursorX: 5,
        cursorY: 2,
        scrollback: ['Line 1', 'Line 2', 'Line 3'],
        cols: 80,
        rows: 24,
      };

      adapter.restoreBufferState(mockState);

      expect(mockTerminal.clear).toHaveBeenCalled();
      expect(mockTerminal.writeln).toHaveBeenCalledTimes(3);
      expect(mockTerminal.writeln).toHaveBeenNthCalledWith(1, 'Line 1');
      expect(mockTerminal.writeln).toHaveBeenNthCalledWith(2, 'Line 2');
      expect(mockTerminal.writeln).toHaveBeenNthCalledWith(3, 'Line 3');
    });

    it('should throw error when restoring buffer state to disposed terminal', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.dispose();

      const mockState: TerminalBufferState = {
        content: 'test',
        cursorX: 0,
        cursorY: 0,
        scrollback: ['test'],
        cols: 80,
        rows: 24,
      };

      expect(() => adapter.restoreBufferState(mockState)).toThrow(
        'Cannot restore buffer state to disposed terminal'
      );
    });
  });

  describe('registerEventHandlers', () => {
    it('should register all event handlers', () => {
      const adapter = new TerminalLibraryAdapter();
      const handlers: TerminalEventHandlers = {
        onData: jest.fn(),
        onResize: jest.fn(),
        onTitleChange: jest.fn(),
        onBell: jest.fn(),
        onCursorMove: jest.fn(),
        onScroll: jest.fn(),
      };

      adapter.registerEventHandlers(handlers);

      expect(mockTerminal.onData).toHaveBeenCalledWith(handlers.onData);
      expect(mockTerminal.onResize).toHaveBeenCalled();
      expect(mockTerminal.onTitleChange).toHaveBeenCalledWith(handlers.onTitleChange);
      expect(mockTerminal.onBell).toHaveBeenCalledWith(handlers.onBell);
      expect(mockTerminal.onCursorMove).toHaveBeenCalledWith(handlers.onCursorMove);
      expect(mockTerminal.onScroll).toHaveBeenCalledWith(handlers.onScroll);
    });

    it('should register only provided handlers', () => {
      const adapter = new TerminalLibraryAdapter();
      const handlers: TerminalEventHandlers = {
        onData: jest.fn(),
      };

      adapter.registerEventHandlers(handlers);

      expect(mockTerminal.onData).toHaveBeenCalledWith(handlers.onData);
      expect(mockTerminal.onResize).not.toHaveBeenCalled();
    });

    it('should handle onResize with cols and rows', () => {
      const adapter = new TerminalLibraryAdapter();
      const onResizeMock = jest.fn();
      const handlers: TerminalEventHandlers = {
        onResize: onResizeMock,
      };

      // Mock onResize to capture the callback
      let resizeCallback: (event: { cols: number; rows: number }) => void = () => {};
      mockTerminal.onResize.mockImplementation((callback) => {
        resizeCallback = callback;
        return { dispose: jest.fn() };
      });

      adapter.registerEventHandlers(handlers);

      // Trigger the resize event
      resizeCallback({ cols: 100, rows: 30 });

      expect(onResizeMock).toHaveBeenCalledWith(100, 30);
    });

    it('should not register handlers on disposed terminal', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.dispose();

      const handlers: TerminalEventHandlers = {
        onData: jest.fn(),
      };

      adapter.registerEventHandlers(handlers);

      expect(mockTerminal.onData).not.toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('should search for text in terminal', () => {
      const adapter = new TerminalLibraryAdapter();
      mockSearchAddon.findNext.mockReturnValue(true);

      const result = adapter.search('test');

      expect(mockSearchAddon.findNext).toHaveBeenCalledWith('test', undefined);
      expect(result).toBe(true);
    });

    it('should search with options', () => {
      const adapter = new TerminalLibraryAdapter();
      mockSearchAddon.findNext.mockReturnValue(false);

      const options = { incremental: true, caseSensitive: true };
      const result = adapter.search('test', options);

      expect(mockSearchAddon.findNext).toHaveBeenCalledWith('test', options);
      expect(result).toBe(false);
    });

    it('should return false when searching disposed terminal', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.dispose();

      const result = adapter.search('test');

      expect(result).toBe(false);
      expect(mockSearchAddon.findNext).not.toHaveBeenCalled();
    });
  });

  describe('isTerminalDisposed', () => {
    it('should return false for active terminal', () => {
      const adapter = new TerminalLibraryAdapter();
      expect(adapter.isTerminalDisposed()).toBe(false);
    });

    it('should return true for disposed terminal', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.dispose();
      expect(adapter.isTerminalDisposed()).toBe(true);
    });
  });

  describe('getXTermInstance', () => {
    it('should return underlying XTerm instance', () => {
      const adapter = new TerminalLibraryAdapter();
      const instance = adapter.getXTermInstance();

      expect(instance).toBe(mockTerminal);
    });

    it('should throw error when accessing disposed terminal instance', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.dispose();

      expect(() => adapter.getXTermInstance()).toThrow('Cannot access disposed terminal instance');
    });
  });

  describe('dispose', () => {
    it('should dispose terminal and clean up resources', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.dispose();

      expect(mockTerminal.dispose).toHaveBeenCalled();
      expect(adapter.isTerminalDisposed()).toBe(true);
    });

    it('should handle multiple dispose calls gracefully', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.dispose();
      adapter.dispose();

      expect(mockTerminal.dispose).toHaveBeenCalledTimes(1);
    });

    it('should prevent operations after disposal', () => {
      const adapter = new TerminalLibraryAdapter();
      adapter.dispose();

      adapter.write('test');
      adapter.clear();
      adapter.focus();

      expect(mockTerminal.write).not.toHaveBeenCalled();
      expect(mockTerminal.clear).not.toHaveBeenCalled();
      expect(mockTerminal.focus).not.toHaveBeenCalled();
    });
  });

  describe('Lifecycle Independence', () => {
    it('should allow detach and reattach without losing state', () => {
      const adapter = new TerminalLibraryAdapter();

      // First attach
      adapter.attach(mockElement);
      expect(mockTerminal.open).toHaveBeenCalledTimes(1);

      // Write some data
      adapter.write('Hello, world!');
      expect(mockTerminal.write).toHaveBeenCalledWith('Hello, world!');

      // Detach (simulating React component unmount)
      adapter.detach();
      expect(mockTerminal.dispose).not.toHaveBeenCalled();

      // Reattach (simulating React component remount)
      const newElement = document.createElement('div');
      adapter.attach(newElement);
      expect(mockTerminal.open).toHaveBeenCalledTimes(2);
      expect(mockTerminal.open).toHaveBeenLastCalledWith(newElement);

      // Terminal should still be functional
      adapter.write('Still working!');
      expect(mockTerminal.write).toHaveBeenCalledWith('Still working!');
    });

    it('should preserve buffer state across detach/attach cycles', () => {
      const adapter = new TerminalLibraryAdapter();

      // Attach and write data
      adapter.attach(mockElement);
      adapter.write('Initial content');

      // Capture buffer state
      const bufferState = adapter.getBufferState();

      // Detach
      adapter.detach();

      // Reattach to new element
      const newElement = document.createElement('div');
      adapter.attach(newElement);

      // Restore buffer state
      adapter.restoreBufferState(bufferState);

      expect(mockTerminal.clear).toHaveBeenCalled();
      expect(mockTerminal.writeln).toHaveBeenCalledTimes(bufferState.scrollback.length);
    });
  });

  describe('Performance Requirements', () => {
    it('should support 10k line scrollback', () => {
      new TerminalLibraryAdapter();

      expect(XTermTerminal).toHaveBeenCalledWith(
        expect.objectContaining({
          scrollback: 10000,
        })
      );
    });

    it('should capture buffer state efficiently', () => {
      const adapter = new TerminalLibraryAdapter();
      (mockTerminal.buffer.active as any).length = 10000;

      const startTime = Date.now();
      const bufferState = adapter.getBufferState();
      const duration = Date.now() - startTime;

      // Should complete in reasonable time (test depends on mock, but verifies implementation)
      expect(bufferState.scrollback).toHaveLength(10000);
      expect(duration).toBeLessThan(1000); // Should be much faster, but allow overhead for mocks
    });
  });

  describe('Error Handling', () => {
    it('should handle missing buffer gracefully', () => {
      const adapter = new TerminalLibraryAdapter();
      // Simulate missing buffer
      (mockTerminal.buffer.active as any).getLine = jest.fn(() => null);

      const bufferState = adapter.getBufferState();

      expect(bufferState.scrollback).toHaveLength(0);
    });

    it('should handle empty scrollback restore', () => {
      const adapter = new TerminalLibraryAdapter();
      const emptyState: TerminalBufferState = {
        content: '',
        cursorX: 0,
        cursorY: 0,
        scrollback: [],
        cols: 80,
        rows: 24,
      };

      expect(() => adapter.restoreBufferState(emptyState)).not.toThrow();
      expect(mockTerminal.clear).toHaveBeenCalled();
      expect(mockTerminal.writeln).not.toHaveBeenCalled();
    });
  });
});
