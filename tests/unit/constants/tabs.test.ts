import { MAX_TABS, TERMINAL_TAB_ID, CHANGES_TAB_ID, MAXIMIZE_TAB_PREFIX } from '@/constants/tabs';

describe('Tab Constants', () => {
  it('should export MAX_TABS constant', () => {
    expect(MAX_TABS).toBe(10);
  });

  it('should export TERMINAL_TAB_ID constant', () => {
    expect(TERMINAL_TAB_ID).toBe('terminal-tab');
  });

  it('should export CHANGES_TAB_ID constant', () => {
    expect(CHANGES_TAB_ID).toBe('changes-tab');
  });

  it('should export MAXIMIZE_TAB_PREFIX constant', () => {
    expect(MAXIMIZE_TAB_PREFIX).toBe('maximize-');
    expect(typeof MAXIMIZE_TAB_PREFIX).toBe('string');
  });

  it('should use MAXIMIZE_TAB_PREFIX to generate unique maximize tab IDs', () => {
    const sessionId = 'session-123';
    const maximizeTabId = `${MAXIMIZE_TAB_PREFIX}${sessionId}`;

    expect(maximizeTabId).toBe('maximize-session-123');
    expect(maximizeTabId.startsWith(MAXIMIZE_TAB_PREFIX)).toBe(true);
  });
});
