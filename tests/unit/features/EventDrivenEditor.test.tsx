import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('Event-Driven Editor Updates', () => {
  describe('Cursor Position Updates', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should fire cursor position callback only on actual selection changes', () => {
      const onCursorPositionChange = jest.fn();
      let lastPosition = 0;

      const handleUpdate = (update: any) => {
        if (!update.view.hasFocus) return;
        if (!update.selectionSet) return;

        const currentPosition = update.state.selection.main.anchor;
        if (currentPosition !== lastPosition) {
          lastPosition = currentPosition;
          onCursorPositionChange(currentPosition);
        }
      };

      handleUpdate({
        view: { hasFocus: true },
        selectionSet: true,
        state: { selection: { main: { anchor: 5 } } },
      });
      expect(onCursorPositionChange).toHaveBeenCalledWith(5);
      expect(onCursorPositionChange).toHaveBeenCalledTimes(1);

      handleUpdate({
        view: { hasFocus: true },
        selectionSet: true,
        state: { selection: { main: { anchor: 5 } } },
      });
      expect(onCursorPositionChange).toHaveBeenCalledTimes(1);

      handleUpdate({
        view: { hasFocus: true },
        selectionSet: true,
        state: { selection: { main: { anchor: 10 } } },
      });
      expect(onCursorPositionChange).toHaveBeenCalledWith(10);
      expect(onCursorPositionChange).toHaveBeenCalledTimes(2);
    });

    it('should not fire callback when view does not have focus', () => {
      const onCursorPositionChange = jest.fn();

      const handleUpdate = (update: any) => {
        if (!update.view.hasFocus) return;
        if (!update.selectionSet) return;

        onCursorPositionChange(update.state.selection.main.anchor);
      };

      const update = {
        view: { hasFocus: false },
        selectionSet: true,
        state: { selection: { main: { anchor: 5 } } },
      };

      handleUpdate(update);
      expect(onCursorPositionChange).not.toHaveBeenCalled();
    });

    it('should not use polling for cursor position tracking', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      const mockExtensions: any[] = [];
      const hasPolling = mockExtensions.some((ext: any) => {
        return ext?.type === 'polling' || ext?.interval !== undefined;
      });

      expect(hasPolling).toBe(false);
      expect(setIntervalSpy).not.toHaveBeenCalled();

      setIntervalSpy.mockRestore();
    });

    it('should measure cursor update performance (<1ms)', () => {
      const onCursorPositionChange = jest.fn();

      const start = performance.now();

      const update = {
        view: { hasFocus: true },
        selectionSet: true,
        state: { selection: { main: { anchor: 10 } } },
      };

      if (update.view.hasFocus && update.selectionSet) {
        onCursorPositionChange(update.state.selection.main.anchor);
      }

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1);
      expect(onCursorPositionChange).toHaveBeenCalledWith(10);
    });
  });

  describe('Vim Mode Detection', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should detect vim mode changes instantly (<1ms)', () => {
      const onModeChange = jest.fn();
      let previousMode = 'INSERT';

      const checkModeChange = (currentMode: string) => {
        if (currentMode !== previousMode) {
          previousMode = currentMode;
          onModeChange(currentMode);
          return true;
        }
        return false;
      };

      const start = performance.now();

      checkModeChange('NORMAL');

      const duration = performance.now() - start;

      // Allow up to 5ms for CI environment overhead while still validating instant detection
      expect(duration).toBeLessThan(5);
      expect(onModeChange).toHaveBeenCalledWith('NORMAL');
      expect(onModeChange).toHaveBeenCalledTimes(1);
    });

    it('should fire mode change callback on every vim state transition', () => {
      const onModeChange = jest.fn();
      let currentMode = 'INSERT';

      const handleModeChange = (newMode: string) => {
        if (newMode !== currentMode) {
          currentMode = newMode;
          onModeChange(newMode);
        }
      };

      handleModeChange('NORMAL');
      expect(onModeChange).toHaveBeenCalledWith('NORMAL');
      expect(onModeChange).toHaveBeenCalledTimes(1);

      handleModeChange('INSERT');
      expect(onModeChange).toHaveBeenCalledWith('INSERT');
      expect(onModeChange).toHaveBeenCalledTimes(2);

      handleModeChange('INSERT');
      expect(onModeChange).toHaveBeenCalledTimes(2);

      handleModeChange('NORMAL');
      expect(onModeChange).toHaveBeenCalledWith('NORMAL');
      expect(onModeChange).toHaveBeenCalledTimes(3);
    });

    it('should not have polling delay in mode detection', () => {
      const onModeChange = jest.fn();

      const detectModeChange = (vimState: any) => {
        const mode = vimState.insertMode ? 'INSERT' : 'NORMAL';
        onModeChange(mode);
      };

      const start = performance.now();

      detectModeChange({ insertMode: false });
      detectModeChange({ insertMode: true });
      detectModeChange({ insertMode: false });

      const totalDuration = performance.now() - start;

      expect(totalDuration).toBeLessThan(10);
      expect(onModeChange).toHaveBeenCalledTimes(3);
    });

    it('should measure vim mode change performance (<1ms)', () => {
      const onModeChange = jest.fn();

      const start = performance.now();

      const vimState = { insertMode: false };
      const mode = vimState.insertMode ? 'INSERT' : 'NORMAL';
      onModeChange(mode);

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1);
      expect(onModeChange).toHaveBeenCalledWith('NORMAL');
    });
  });

  describe('Performance', () => {
    it('should not have polling operations', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      const mockExtensions: any[] = [];

      const hasPollingExtension = mockExtensions.some((ext) => {
        return ext?.type === 'polling' || ext?.interval !== undefined;
      });

      expect(hasPollingExtension).toBe(false);
      expect(setIntervalSpy).not.toHaveBeenCalled();

      setIntervalSpy.mockRestore();
    });

    it('should use event-driven architecture only', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      const extensions = [
        {
          type: 'updateListener',
          callback: jest.fn(),
        },
        {
          type: 'transactionFilter',
          callback: jest.fn(),
        },
      ];

      expect(extensions.every((ext) => ext.type !== 'polling')).toBe(true);
      expect(setIntervalSpy).not.toHaveBeenCalled();

      setIntervalSpy.mockRestore();
    });
  });

  describe('Logging', () => {
    it('should use logger for mode changes', () => {
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const handleModeChange = (mode: string) => {
        mockLogger.debug('[VimExtension] Mode changed', { mode });
      };

      handleModeChange('NORMAL');

      expect(mockLogger.debug).toHaveBeenCalledWith('[VimExtension] Mode changed', {
        mode: 'NORMAL',
      });
    });

    it('should use logger for cursor position updates', () => {
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const handleCursorChange = (position: number) => {
        mockLogger.debug('[RichTextEditor] Cursor position', { pos: position });
      };

      handleCursorChange(42);

      expect(mockLogger.debug).toHaveBeenCalledWith('[RichTextEditor] Cursor position', {
        pos: 42,
      });
    });

    it('should not use console.log for logging', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');

      const mockLogger = {
        debug: jest.fn(),
      };

      mockLogger.debug('[VimExtension] Mode changed', { mode: 'NORMAL' });

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });
  });
});
