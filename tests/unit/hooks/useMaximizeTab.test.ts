import { renderHook, act } from '@testing-library/react';
import { useMaximizeTab } from '@/hooks/useMaximizeTab';
import { useUIStore } from '@/stores';
import { MAXIMIZE_TAB_PREFIX } from '@/constants/tabs';

jest.mock('@/stores', () => ({
  useUIStore: jest.fn(),
}));

describe('useMaximizeTab', () => {
  const TEST_PROJECT_ID = 'test-project-1';
  let mockMaximizeTabs: Map<string, any>;
  let mockAddMaximizeTab: ReturnType<typeof jest.fn>;
  let mockRemoveMaximizeTab: ReturnType<typeof jest.fn>;
  let mockUpdateMaximizeTab: ReturnType<typeof jest.fn>;
  let mockGetMaximizeTab: ReturnType<typeof jest.fn>;

  beforeEach(() => {
    mockMaximizeTabs = new Map();
    mockAddMaximizeTab = jest.fn((sessionId, projectId, content, metadata?) => {
      const tab = {
        id: `${MAXIMIZE_TAB_PREFIX}${sessionId}`,
        sessionId,
        projectId,
        content,
        timestamp: Date.now(),
        ...metadata,
      };
      mockMaximizeTabs.set(sessionId, tab);
    });
    mockRemoveMaximizeTab = jest.fn((sessionId) => {
      mockMaximizeTabs.delete(sessionId);
    });
    mockUpdateMaximizeTab = jest.fn((sessionId, updates) => {
      const tab = mockMaximizeTabs.get(sessionId);
      if (tab) {
        mockMaximizeTabs.set(sessionId, { ...tab, ...updates });
      }
    });
    mockGetMaximizeTab = jest.fn((sessionId) => {
      return mockMaximizeTabs.get(sessionId);
    });

    (useUIStore as any).mockImplementation((selector: any) => {
      const state = {
        addMaximizeTab: mockAddMaximizeTab,
        removeMaximizeTab: mockRemoveMaximizeTab,
        updateMaximizeTab: mockUpdateMaximizeTab,
        getMaximizeTab: mockGetMaximizeTab,
      };
      return selector(state);
    });
  });

  describe('Hook Initialization', () => {
    it('should return maximize tab functions', () => {
      const { result } = renderHook(() => useMaximizeTab());

      expect(result.current.createMaximizeTab).toBeDefined();
      expect(result.current.closeMaximizeTab).toBeDefined();
      expect(result.current.hasMaximizeTab).toBeDefined();
      expect(result.current.getMaximizeTabId).toBeDefined();
      expect(result.current.switchSubTab).toBeDefined();
    });
  });

  describe('Create Maximize Tab', () => {
    it('should create maximize tab with 1:1 session mapping', () => {
      const { result } = renderHook(() => useMaximizeTab());
      const sessionId = 'session-123';

      let tabId: string | null = null;
      act(() => {
        tabId = result.current.createMaximizeTab(sessionId, TEST_PROJECT_ID);
      });

      expect(mockAddMaximizeTab).toHaveBeenCalledWith(sessionId, TEST_PROJECT_ID, '', undefined);
      expect(tabId).toBe(`maximize-${sessionId}`);
    });

    it('should return null when tab already exists', () => {
      const { result } = renderHook(() => useMaximizeTab());
      const sessionId = 'session-123';

      act(() => {
        result.current.createMaximizeTab(sessionId, TEST_PROJECT_ID);
      });

      let secondTabId: string | null = null;
      act(() => {
        secondTabId = result.current.createMaximizeTab(sessionId, TEST_PROJECT_ID);
      });

      expect(secondTabId).toBeNull();
      expect(mockAddMaximizeTab).toHaveBeenCalledTimes(1);
    });

    it('should sync session name to maximize tab', () => {
      const { result } = renderHook(() => useMaximizeTab());
      const sessionId = 'session-123';
      const sessionName = 'Swift River';

      act(() => {
        result.current.createMaximizeTab(sessionId, TEST_PROJECT_ID, sessionName);
      });

      expect(mockAddMaximizeTab).toHaveBeenCalledWith(
        sessionId,
        TEST_PROJECT_ID,
        '',
        expect.objectContaining({ sessionName: 'Swift River' })
      );
    });
  });

  describe('Close Maximize Tab', () => {
    it('should close maximize tab by session ID', () => {
      const { result } = renderHook(() => useMaximizeTab());
      const sessionId = 'session-123';

      act(() => {
        result.current.createMaximizeTab(sessionId, TEST_PROJECT_ID);
      });

      act(() => {
        result.current.closeMaximizeTab(sessionId);
      });

      expect(mockRemoveMaximizeTab).toHaveBeenCalledWith(sessionId);
      expect(mockMaximizeTabs.has(sessionId)).toBe(false);
    });

    it('should auto-close maximize tab when original session closes', () => {
      const { result } = renderHook(() => useMaximizeTab());
      const sessionId = 'session-123';

      act(() => {
        result.current.createMaximizeTab(sessionId, TEST_PROJECT_ID);
      });

      act(() => {
        result.current.closeMaximizeTab(sessionId);
      });

      expect(mockRemoveMaximizeTab).toHaveBeenCalledWith(sessionId);
    });
  });

  describe('Has Maximize Tab', () => {
    it('should return true when session has maximize tab', () => {
      const { result } = renderHook(() => useMaximizeTab());
      const sessionId = 'session-123';

      act(() => {
        result.current.createMaximizeTab(sessionId, TEST_PROJECT_ID);
      });

      expect(result.current.hasMaximizeTab(sessionId)).toBe(true);
    });

    it('should return false when session has no maximize tab', () => {
      const { result } = renderHook(() => useMaximizeTab());
      expect(result.current.hasMaximizeTab('session-456')).toBe(false);
    });
  });

  describe('Get Maximize Tab ID', () => {
    it('should return maximize tab ID for session', () => {
      const { result } = renderHook(() => useMaximizeTab());
      const sessionId = 'session-123';

      act(() => {
        result.current.createMaximizeTab(sessionId, TEST_PROJECT_ID);
      });

      const tabId = result.current.getMaximizeTabId(sessionId);
      expect(tabId).toBe(`maximize-${sessionId}`);
    });

    it('should return null for non-existent maximize tab', () => {
      const { result } = renderHook(() => useMaximizeTab());
      const tabId = result.current.getMaximizeTabId('session-456');
      expect(tabId).toBeNull();
    });
  });

  describe('Switch Sub Tab', () => {
    it('should switch to todos sub-tab', () => {
      const { result } = renderHook(() => useMaximizeTab());
      const sessionId = 'session-123';

      act(() => {
        result.current.createMaximizeTab(sessionId, TEST_PROJECT_ID);
      });

      act(() => {
        result.current.switchSubTab(sessionId, 'todos');
      });

      expect(mockUpdateMaximizeTab).toHaveBeenCalledWith(sessionId, { activeSubTab: 'todos' });
    });

    it('should switch to status sub-tab', () => {
      const { result } = renderHook(() => useMaximizeTab());
      const sessionId = 'session-123';

      act(() => {
        result.current.createMaximizeTab(sessionId, TEST_PROJECT_ID);
      });

      act(() => {
        result.current.switchSubTab(sessionId, 'status');
      });

      expect(mockUpdateMaximizeTab).toHaveBeenCalledWith(sessionId, { activeSubTab: 'status' });
    });

    it('should switch to trace sub-tab', () => {
      const { result } = renderHook(() => useMaximizeTab());
      const sessionId = 'session-123';

      act(() => {
        result.current.createMaximizeTab(sessionId, TEST_PROJECT_ID);
      });

      act(() => {
        result.current.switchSubTab(sessionId, 'trace');
      });

      expect(mockUpdateMaximizeTab).toHaveBeenCalledWith(sessionId, { activeSubTab: 'trace' });
    });
  });
});
