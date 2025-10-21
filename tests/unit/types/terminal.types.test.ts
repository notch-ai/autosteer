import {
  Terminal,
  TerminalTab,
  TerminalState,
  TerminalResizeParams,
  TerminalWriteParams,
} from '@/types/terminal.types';

describe('Terminal Types', () => {
  describe('Terminal interface', () => {
    it('should define terminal properties correctly', () => {
      const terminal: Terminal = {
        id: 'terminal-1',
        pid: 1234,
        title: 'Terminal 1',
        isActive: true,
        createdAt: new Date(),
        lastAccessed: new Date(),
        shell: '/bin/zsh',
        cwd: '/home/user',
        size: { cols: 80, rows: 24 },
        status: 'running',
      };

      expect(terminal.id).toBe('terminal-1');
      expect(terminal.pid).toBe(1234);
      expect(terminal.title).toBe('Terminal 1');
      expect(terminal.isActive).toBe(true);
      expect(terminal.shell).toBe('/bin/zsh');
      expect(terminal.cwd).toBe('/home/user');
      expect(terminal.size.cols).toBe(80);
      expect(terminal.size.rows).toBe(24);
      expect(terminal.status).toBe('running');
    });

    it('should allow optional properties', () => {
      const terminal: Terminal = {
        id: 'terminal-1',
        pid: 1234,
        title: 'Terminal 1',
        isActive: false,
        createdAt: new Date(),
        lastAccessed: new Date(),
        shell: '/bin/bash',
        cwd: '/home/user',
        size: { cols: 80, rows: 24 },
        status: 'stopped',
      };

      expect(terminal.status).toBe('stopped');
    });
  });

  describe('TerminalTab interface', () => {
    it('should extend SessionTab correctly', () => {
      const terminalTab: TerminalTab = {
        id: 'tab-1',
        agentId: '', // Empty for terminal tabs
        agentName: 'Terminal',
        agentType: 'terminal',
        isActive: true,
        sessionId: 'terminal-1',
        lastAccessed: new Date(),
        terminalId: 'terminal-1',
        pid: 1234,
      };

      expect(terminalTab.agentType).toBe('terminal');
      expect(terminalTab.terminalId).toBe('terminal-1');
      expect(terminalTab.pid).toBe(1234);
      expect(terminalTab.agentId).toBe('');
    });
  });

  describe('TerminalState interface', () => {
    it('should define terminal store state correctly', () => {
      const state: TerminalState = {
        terminals: new Map([
          [
            'terminal-1',
            {
              id: 'terminal-1',
              pid: 1234,
              title: 'Terminal 1',
              isActive: true,
              createdAt: new Date(),
              lastAccessed: new Date(),
              shell: '/bin/zsh',
              cwd: '/home/user',
              size: { cols: 80, rows: 24 },
              status: 'running',
            },
          ],
        ]),
        activeTerminalId: 'terminal-1',
        maxTerminals: 10,
      };

      expect(state.terminals.size).toBe(1);
      expect(state.activeTerminalId).toBe('terminal-1');
      expect(state.maxTerminals).toBe(10);
      expect(state.terminals.get('terminal-1')?.pid).toBe(1234);
    });
  });

  describe('Terminal IPC parameter types', () => {
    it('should define TerminalResizeParams correctly', () => {
      const params: TerminalResizeParams = {
        terminalId: 'terminal-1',
        cols: 120,
        rows: 30,
      };

      expect(params.terminalId).toBe('terminal-1');
      expect(params.cols).toBe(120);
      expect(params.rows).toBe(30);
    });

    it('should define TerminalWriteParams correctly', () => {
      const params: TerminalWriteParams = {
        terminalId: 'terminal-1',
        data: 'ls -la\n',
      };

      expect(params.terminalId).toBe('terminal-1');
      expect(params.data).toBe('ls -la\n');
    });
  });
});
