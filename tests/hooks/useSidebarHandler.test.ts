/**
 * useSidebarHandler Hook Unit Tests
 *
 * Comprehensive test coverage for sidebar handler logic.
 * Tests panel navigation, collapse state, active item tracking, and error handling.
 */

import { renderHook, act } from '@testing-library/react';
import { useSidebarHandler, NavigationError } from '@/hooks/useSidebarHandler';
import { useUIStore } from '@/stores';

jest.mock('@/stores', () => ({
  useUIStore: jest.fn(),
}));

const mockUseUIStore = useUIStore as jest.MockedFunction<typeof useUIStore>;

describe('useSidebarHandler', () => {
  let mockSetActivePanel: jest.Mock;
  let mockToggleSidebar: jest.Mock;

  const createMockStore = (
    overrides?: Partial<ReturnType<typeof useUIStore.getState>>
  ): ReturnType<typeof useUIStore.getState> => ({
    activePanel: 'chat' as const,
    sidebarCollapsed: false,
    detailPanelCollapsed: false,
    activeView: 'list' as const,
    leftPanelWidth: 280,
    rightPanelWidth: 320,
    showProjectCreation: false,
    tabState: null,
    changesTab: {
      selectedFile: null,
      panelSizes: { fileList: 30, diffViewer: 70 },
      scrollPosition: 0,
    },
    searchQuery: '',
    searchResults: [],
    isSearching: false,
    vimMode: { mode: 'NORMAL' as const, enabled: false },
    vimEnabled: false,
    selectedModel: 'claude-sonnet-4-5-20250929' as const,
    setActivePanel: mockSetActivePanel,
    toggleSidebar: mockToggleSidebar,
    toggleDetailPanel: jest.fn(),
    setActiveView: jest.fn(),
    setPanelWidth: jest.fn(),
    setShowProjectCreation: jest.fn(),
    setSearchQuery: jest.fn(),
    performSearch: jest.fn(),
    clearSearch: jest.fn(),
    updateVimState: jest.fn(),
    toggleVimMode: jest.fn(),
    setActiveTab: jest.fn(),
    addTab: jest.fn(),
    removeTab: jest.fn(),
    updateTabState: jest.fn(),
    setSelectedFile: jest.fn(),
    setChangesPanelSizes: jest.fn(),
    resetChangesTabState: jest.fn(),
    setSelectedModel: jest.fn(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockSetActivePanel = jest.fn();
    mockToggleSidebar = jest.fn();

    mockUseUIStore.mockImplementation((selector) => {
      const store = createMockStore();
      return selector(store as any);
    });
  });

  describe('Initialization', () => {
    it('should initialize with default state from UIStore', () => {
      const { result } = renderHook(() => useSidebarHandler());

      expect(result.current.activePanel).toBe('chat');
      expect(result.current.isCollapsed).toBe(false);
      expect(result.current.activeItem).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should initialize with collapsed state when UIStore is collapsed', () => {
      mockUseUIStore.mockImplementation((selector) => {
        const store = createMockStore({
          activePanel: 'projects' as const,
          sidebarCollapsed: true,
        });
        return selector(store as any);
      });

      const { result } = renderHook(() => useSidebarHandler());

      expect(result.current.isCollapsed).toBe(true);
      expect(result.current.activePanel).toBe('projects');
    });
  });

  describe('navigate', () => {
    it('should navigate to chat panel', () => {
      const { result } = renderHook(() => useSidebarHandler());

      act(() => {
        result.current.navigate('chat');
      });

      expect(mockSetActivePanel).toHaveBeenCalledWith('chat');
      expect(result.current.error).toBeNull();
    });

    it('should navigate to agents panel', () => {
      const { result } = renderHook(() => useSidebarHandler());

      act(() => {
        result.current.navigate('agents');
      });

      expect(mockSetActivePanel).toHaveBeenCalledWith('agents');
      expect(result.current.error).toBeNull();
    });

    it('should navigate to projects panel', () => {
      const { result } = renderHook(() => useSidebarHandler());

      act(() => {
        result.current.navigate('projects');
      });

      expect(mockSetActivePanel).toHaveBeenCalledWith('projects');
      expect(result.current.error).toBeNull();
    });

    it('should navigate to settings panel', () => {
      const { result } = renderHook(() => useSidebarHandler());

      act(() => {
        result.current.navigate('settings');
      });

      expect(mockSetActivePanel).toHaveBeenCalledWith('settings');
      expect(result.current.error).toBeNull();
    });

    it('should clear active item when switching panels', () => {
      let currentPanel: 'chat' | 'agents' | 'projects' | 'settings' = 'chat';

      mockUseUIStore.mockImplementation((selector) => {
        const store = createMockStore({
          activePanel: currentPanel,
          setActivePanel: (panel: typeof currentPanel) => {
            mockSetActivePanel(panel);
            currentPanel = panel;
          },
        });
        return selector(store as any);
      });

      const { result, rerender } = renderHook(() => useSidebarHandler());

      // Set an active item
      act(() => {
        result.current.setActiveItem('item-1');
      });

      expect(result.current.activeItem).toBe('item-1');

      // Navigate to different panel (this will update currentPanel)
      act(() => {
        result.current.navigate('projects');
      });

      // Rerender to pick up the new panel from store
      rerender();

      expect(result.current.activeItem).toBeNull();
    });

    it('should handle navigation to same panel without clearing item', () => {
      const { result } = renderHook(() => useSidebarHandler());

      act(() => {
        result.current.setActiveItem('item-1');
      });

      expect(result.current.activeItem).toBe('item-1');

      act(() => {
        result.current.navigate('chat');
      });

      expect(result.current.activeItem).toBe('item-1');
    });

    it('should throw NavigationError for invalid panel', () => {
      const { result } = renderHook(() => useSidebarHandler());

      act(() => {
        result.current.navigate('invalid' as any);
      });

      expect(result.current.error).toBe('Invalid panel: invalid');
      expect(mockSetActivePanel).not.toHaveBeenCalled();
    });

    it('should clear previous error on successful navigation', () => {
      const { result } = renderHook(() => useSidebarHandler());

      // Cause an error
      act(() => {
        result.current.navigate('invalid' as any);
      });

      expect(result.current.error).toBeTruthy();

      // Navigate successfully
      act(() => {
        result.current.navigate('projects');
      });

      expect(result.current.error).toBeNull();
      expect(mockSetActivePanel).toHaveBeenCalledWith('projects');
    });
  });

  describe('toggleCollapse', () => {
    it('should toggle sidebar from expanded to collapsed', () => {
      const { result } = renderHook(() => useSidebarHandler());

      expect(result.current.isCollapsed).toBe(false);

      act(() => {
        result.current.toggleCollapse();
      });

      expect(mockToggleSidebar).toHaveBeenCalledTimes(1);
    });

    it('should toggle sidebar from collapsed to expanded', () => {
      mockUseUIStore.mockImplementation((selector) => {
        const store = createMockStore({
          activePanel: 'chat' as const,
          sidebarCollapsed: true,
        });
        return selector(store as any);
      });

      const { result } = renderHook(() => useSidebarHandler());

      expect(result.current.isCollapsed).toBe(true);

      act(() => {
        result.current.toggleCollapse();
      });

      expect(mockToggleSidebar).toHaveBeenCalledTimes(1);
    });

    it('should toggle multiple times', () => {
      const { result } = renderHook(() => useSidebarHandler());

      act(() => {
        result.current.toggleCollapse();
        result.current.toggleCollapse();
        result.current.toggleCollapse();
      });

      expect(mockToggleSidebar).toHaveBeenCalledTimes(3);
    });
  });

  describe('setActiveItem', () => {
    it('should set active item to string value', () => {
      const { result } = renderHook(() => useSidebarHandler());

      act(() => {
        result.current.setActiveItem('project-123');
      });

      expect(result.current.activeItem).toBe('project-123');
    });

    it('should set active item to null', () => {
      const { result } = renderHook(() => useSidebarHandler());

      act(() => {
        result.current.setActiveItem('project-123');
      });

      expect(result.current.activeItem).toBe('project-123');

      act(() => {
        result.current.setActiveItem(null);
      });

      expect(result.current.activeItem).toBeNull();
    });

    it('should update active item when changed', () => {
      const { result } = renderHook(() => useSidebarHandler());

      act(() => {
        result.current.setActiveItem('item-1');
      });

      expect(result.current.activeItem).toBe('item-1');

      act(() => {
        result.current.setActiveItem('item-2');
      });

      expect(result.current.activeItem).toBe('item-2');
    });

    it('should handle rapid item changes', () => {
      const { result } = renderHook(() => useSidebarHandler());

      act(() => {
        result.current.setActiveItem('item-1');
        result.current.setActiveItem('item-2');
        result.current.setActiveItem('item-3');
      });

      expect(result.current.activeItem).toBe('item-3');
    });

    it('should track active item per panel', () => {
      mockUseUIStore.mockImplementation((selector) => {
        const store = createMockStore({
          activePanel: 'projects' as const,
          sidebarCollapsed: false,
        });
        return selector(store as any);
      });

      const { result } = renderHook(() => useSidebarHandler());

      act(() => {
        result.current.setActiveItem('project-xyz');
      });

      expect(result.current.activeItem).toBe('project-xyz');
      expect(result.current.activePanel).toBe('projects');
    });
  });

  describe('State Persistence', () => {
    it('should persist panel state through UIStore', () => {
      const { result } = renderHook(() => useSidebarHandler());

      act(() => {
        result.current.navigate('agents');
      });

      expect(mockSetActivePanel).toHaveBeenCalledWith('agents');
    });

    it('should persist collapse state through UIStore', () => {
      const { result } = renderHook(() => useSidebarHandler());

      act(() => {
        result.current.toggleCollapse();
      });

      expect(mockToggleSidebar).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle NavigationError correctly', () => {
      const { result } = renderHook(() => useSidebarHandler());

      act(() => {
        result.current.navigate('foo' as any);
      });

      expect(result.current.error).toContain('Invalid panel');
    });

    it('should not affect state on navigation error', () => {
      mockUseUIStore.mockImplementation((selector) => {
        const store = createMockStore({
          activePanel: 'chat' as const,
          sidebarCollapsed: false,
        });
        return selector(store as any);
      });

      const { result } = renderHook(() => useSidebarHandler());

      const initialPanel = result.current.activePanel;

      act(() => {
        result.current.navigate('invalid' as any);
      });

      expect(result.current.activePanel).toBe(initialPanel);
      expect(mockSetActivePanel).not.toHaveBeenCalled();
    });

    it('should preserve active item on navigation error', () => {
      const { result } = renderHook(() => useSidebarHandler());

      act(() => {
        result.current.setActiveItem('item-1');
      });

      expect(result.current.activeItem).toBe('item-1');

      act(() => {
        result.current.navigate('bad-panel' as any);
      });

      expect(result.current.activeItem).toBe('item-1');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete navigation workflow', () => {
      const { result } = renderHook(() => useSidebarHandler());

      // Start at chat
      expect(result.current.activePanel).toBe('chat');
      expect(result.current.isCollapsed).toBe(false);

      // Set active item in chat
      act(() => {
        result.current.setActiveItem('chat-1');
      });

      expect(result.current.activeItem).toBe('chat-1');

      // Navigate to projects
      mockUseUIStore.mockImplementation((selector) => {
        const store = createMockStore({
          activePanel: 'projects' as const,
          sidebarCollapsed: false,
        });
        return selector(store as any);
      });

      act(() => {
        result.current.navigate('projects');
      });

      // Active item should be cleared
      expect(result.current.activeItem).toBeNull();
    });

    it('should handle collapse while navigating', () => {
      const { result } = renderHook(() => useSidebarHandler());

      act(() => {
        result.current.navigate('settings');
        result.current.toggleCollapse();
      });

      expect(mockSetActivePanel).toHaveBeenCalledWith('settings');
      expect(mockToggleSidebar).toHaveBeenCalled();
    });

    it('should maintain state across panel switches', () => {
      let currentPanel: 'chat' | 'agents' | 'projects' | 'settings' = 'chat';

      mockUseUIStore.mockImplementation((selector) => {
        const store = createMockStore({
          activePanel: currentPanel,
          setActivePanel: (panel: typeof currentPanel) => {
            currentPanel = panel;
          },
        });
        return selector(store as any);
      });

      const { result, rerender } = renderHook(() => useSidebarHandler());

      expect(result.current.activePanel).toBe('chat');

      act(() => {
        result.current.navigate('agents');
        currentPanel = 'agents';
      });

      rerender();

      expect(result.current.activePanel).toBe('agents');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null setActiveItem gracefully', () => {
      const { result } = renderHook(() => useSidebarHandler());

      act(() => {
        result.current.setActiveItem(null);
      });

      expect(result.current.activeItem).toBeNull();
    });

    it('should handle empty string as active item', () => {
      const { result } = renderHook(() => useSidebarHandler());

      act(() => {
        result.current.setActiveItem('');
      });

      expect(result.current.activeItem).toBe('');
    });

    it('should handle very long item IDs', () => {
      const { result } = renderHook(() => useSidebarHandler());

      const longId = 'a'.repeat(1000);

      act(() => {
        result.current.setActiveItem(longId);
      });

      expect(result.current.activeItem).toBe(longId);
    });

    it('should handle rapid panel switches', () => {
      const { result } = renderHook(() => useSidebarHandler());

      act(() => {
        result.current.navigate('chat');
        result.current.navigate('agents');
        result.current.navigate('projects');
        result.current.navigate('settings');
      });

      expect(mockSetActivePanel).toHaveBeenCalledTimes(4);
      expect(mockSetActivePanel).toHaveBeenLastCalledWith('settings');
    });

    it('should handle UIStore selector changes', () => {
      const { result, rerender } = renderHook(() => useSidebarHandler());

      expect(result.current.activePanel).toBe('chat');

      mockUseUIStore.mockImplementation((selector) => {
        const store = createMockStore({
          activePanel: 'settings' as const,
          sidebarCollapsed: true,
        });
        return selector(store as any);
      });

      rerender();

      expect(result.current.activePanel).toBe('settings');
      expect(result.current.isCollapsed).toBe(true);
    });
  });

  describe('NavigationError', () => {
    it('should create NavigationError with correct name', () => {
      const error = new NavigationError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(NavigationError);
      expect(error.name).toBe('NavigationError');
      expect(error.message).toBe('Test error');
    });

    it('should be catchable as Error', () => {
      try {
        throw new NavigationError('Test');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toBe('Test');
      }
    });
  });

  describe('Callback Stability', () => {
    it('should maintain stable navigate reference', () => {
      const { result, rerender } = renderHook(() => useSidebarHandler());

      const navigate1 = result.current.navigate;

      rerender();

      const navigate2 = result.current.navigate;

      expect(navigate1).toBe(navigate2);
    });

    it('should maintain stable toggleCollapse reference', () => {
      const { result, rerender } = renderHook(() => useSidebarHandler());

      const toggleCollapse1 = result.current.toggleCollapse;

      rerender();

      const toggleCollapse2 = result.current.toggleCollapse;

      expect(toggleCollapse1).toBe(toggleCollapse2);
    });

    it('should maintain stable setActiveItem reference', () => {
      const { result, rerender } = renderHook(() => useSidebarHandler());

      const setActiveItem1 = result.current.setActiveItem;

      rerender();

      const setActiveItem2 = result.current.setActiveItem;

      expect(setActiveItem1).toBe(setActiveItem2);
    });
  });
});
