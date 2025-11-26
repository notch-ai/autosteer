import { describe, it, expect, beforeEach } from '@jest/globals';
import { useUIStore } from '@/stores/ui';
import { DEFAULT_MODEL } from '@/types/model.types';

describe('UIStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useUIStore.setState({
      sidebarCollapsed: false,
      detailPanelCollapsed: false,
      activeView: 'list',
      leftPanelWidth: 280,
      rightPanelWidth: 320,
      activePanel: 'chat',
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
      vimMode: { mode: 'NORMAL', enabled: false },
      vimEnabled: false,
      selectedModel: DEFAULT_MODEL,
    });
  });

  describe('Layout State', () => {
    it('should initialize with correct default layout state', () => {
      const state = useUIStore.getState();
      expect(state.sidebarCollapsed).toBe(false);
      expect(state.detailPanelCollapsed).toBe(false);
      expect(state.activeView).toBe('list');
      expect(state.leftPanelWidth).toBe(280);
      expect(state.rightPanelWidth).toBe(320);
    });

    it('should toggle sidebar collapsed state', () => {
      const { toggleSidebar } = useUIStore.getState();

      toggleSidebar();
      expect(useUIStore.getState().sidebarCollapsed).toBe(true);

      toggleSidebar();
      expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    });

    it('should toggle detail panel collapsed state', () => {
      const { toggleDetailPanel } = useUIStore.getState();

      toggleDetailPanel();
      expect(useUIStore.getState().detailPanelCollapsed).toBe(true);

      toggleDetailPanel();
      expect(useUIStore.getState().detailPanelCollapsed).toBe(false);
    });

    it('should set active view', () => {
      const { setActiveView } = useUIStore.getState();

      setActiveView('grid');
      expect(useUIStore.getState().activeView).toBe('grid');

      setActiveView('board');
      expect(useUIStore.getState().activeView).toBe('board');

      setActiveView('list');
      expect(useUIStore.getState().activeView).toBe('list');
    });

    it('should set left panel width', () => {
      const { setPanelWidth } = useUIStore.getState();

      setPanelWidth('left', 320);
      expect(useUIStore.getState().leftPanelWidth).toBe(320);

      setPanelWidth('left', 400);
      expect(useUIStore.getState().leftPanelWidth).toBe(400);
    });

    it('should set right panel width', () => {
      const { setPanelWidth } = useUIStore.getState();

      setPanelWidth('right', 400);
      expect(useUIStore.getState().rightPanelWidth).toBe(400);

      setPanelWidth('right', 280);
      expect(useUIStore.getState().rightPanelWidth).toBe(280);
    });
  });

  describe('Panel State', () => {
    it('should initialize with chat as active panel', () => {
      const state = useUIStore.getState();
      expect(state.activePanel).toBe('chat');
      expect(state.showProjectCreation).toBe(false);
    });

    it('should set active panel', () => {
      const { setActivePanel } = useUIStore.getState();

      setActivePanel('agents');
      expect(useUIStore.getState().activePanel).toBe('agents');

      setActivePanel('projects');
      expect(useUIStore.getState().activePanel).toBe('projects');

      setActivePanel('settings');
      expect(useUIStore.getState().activePanel).toBe('settings');
    });

    it('should toggle project creation visibility', () => {
      const { setShowProjectCreation } = useUIStore.getState();

      setShowProjectCreation(true);
      expect(useUIStore.getState().showProjectCreation).toBe(true);

      setShowProjectCreation(false);
      expect(useUIStore.getState().showProjectCreation).toBe(false);
    });
  });

  describe('Search State', () => {
    it('should initialize with empty search state', () => {
      const state = useUIStore.getState();
      expect(state.searchQuery).toBe('');
      expect(state.searchResults).toEqual([]);
      expect(state.isSearching).toBe(false);
    });

    it('should set search query', () => {
      const { setSearchQuery } = useUIStore.getState();

      setSearchQuery('test query');
      expect(useUIStore.getState().searchQuery).toBe('test query');
    });

    it('should perform search and update state', async () => {
      const { performSearch } = useUIStore.getState();

      const searchPromise = performSearch('test');

      // Should set isSearching to true during search
      expect(useUIStore.getState().isSearching).toBe(true);
      expect(useUIStore.getState().searchQuery).toBe('test');

      await searchPromise;

      // Should set isSearching to false after search completes
      expect(useUIStore.getState().isSearching).toBe(false);
    });

    it('should clear search state', () => {
      const { setSearchQuery, clearSearch } = useUIStore.getState();

      setSearchQuery('test query');
      useUIStore.setState({
        searchResults: [{ id: '1', type: 'agent', title: 'Test', preview: 'Test preview' }],
      });

      clearSearch();

      const state = useUIStore.getState();
      expect(state.searchQuery).toBe('');
      expect(state.searchResults).toEqual([]);
      expect(state.isSearching).toBe(false);
    });
  });

  describe('Vim State', () => {
    it('should initialize with vim disabled', () => {
      const state = useUIStore.getState();
      expect(state.vimEnabled).toBe(false);
      expect(state.vimMode).toEqual({ mode: 'NORMAL', enabled: false });
    });

    it('should update vim state', () => {
      const { updateVimState } = useUIStore.getState();

      updateVimState({ mode: 'INSERT', enabled: true });

      const state = useUIStore.getState();
      expect(state.vimMode.mode).toBe('INSERT');
      expect(state.vimMode.enabled).toBe(true);
    });

    it('should toggle vim mode', () => {
      const { toggleVimMode } = useUIStore.getState();

      toggleVimMode();
      expect(useUIStore.getState().vimEnabled).toBe(true);

      toggleVimMode();
      expect(useUIStore.getState().vimEnabled).toBe(false);
    });

    it('should reset vim state when disabled', () => {
      const { updateVimState, toggleVimMode } = useUIStore.getState();

      // Enable vim and change mode
      updateVimState({ mode: 'INSERT', enabled: true });
      useUIStore.setState({ vimEnabled: true });

      // Disable vim
      toggleVimMode();

      const state = useUIStore.getState();
      expect(state.vimEnabled).toBe(false);
      expect(state.vimMode).toEqual({ mode: 'NORMAL', enabled: false });
    });
  });

  describe('Tab State', () => {
    it('should initialize with null tab state', () => {
      const state = useUIStore.getState();
      expect(state.tabState).toBeNull();
    });

    it('should set active tab', () => {
      const { setActiveTab, updateTabState } = useUIStore.getState();

      // First initialize tab state
      updateTabState([
        {
          id: 'tab-1',
          agentId: 'agent-1',
          sessionId: 'session-1',
          agentName: 'Tab 1',
          agentType: 'text',
          isActive: false,
          lastAccessed: new Date(),
        },
        {
          id: 'tab-2',
          agentId: 'agent-2',
          sessionId: 'session-2',
          agentName: 'Tab 2',
          agentType: 'text',
          isActive: false,
          lastAccessed: new Date(),
        },
      ]);

      setActiveTab('tab-2');

      const state = useUIStore.getState();
      expect(state.tabState?.activeTabId).toBe('tab-2');
      expect(state.tabState?.tabs[1].isActive).toBe(true);
    });

    it('should remove tab', () => {
      const { removeTab, updateTabState } = useUIStore.getState();

      updateTabState([
        {
          id: 'tab-1',
          agentId: 'agent-1',
          sessionId: 'session-1',
          agentName: 'Tab 1',
          agentType: 'text',
          isActive: true,
          lastAccessed: new Date(),
        },
        {
          id: 'tab-2',
          agentId: 'agent-2',
          sessionId: 'session-2',
          agentName: 'Tab 2',
          agentType: 'text',
          isActive: false,
          lastAccessed: new Date(),
        },
      ]);

      removeTab('tab-1');

      const state = useUIStore.getState();
      expect(state.tabState?.tabs).toHaveLength(1);
      expect(state.tabState?.tabs[0].id).toBe('tab-2');
    });

    it('should update active tab when removing current active tab', () => {
      const { removeTab, updateTabState } = useUIStore.getState();

      updateTabState([
        {
          id: 'tab-1',
          agentId: 'agent-1',
          sessionId: 'session-1',
          agentName: 'Tab 1',
          agentType: 'text',
          isActive: false,
          lastAccessed: new Date(),
        },
        {
          id: 'tab-2',
          agentId: 'agent-2',
          sessionId: 'session-2',
          agentName: 'Tab 2',
          agentType: 'text',
          isActive: false,
          lastAccessed: new Date(),
        },
      ]);

      useUIStore.setState({
        tabState: {
          ...useUIStore.getState().tabState!,
          activeTabId: 'tab-1',
        },
      });

      removeTab('tab-1');

      const state = useUIStore.getState();
      expect(state.tabState?.activeTabId).toBe('tab-2');
    });
  });

  describe('Changes Tab State', () => {
    it('should initialize with default changes tab state', () => {
      const state = useUIStore.getState();
      expect(state.changesTab).toEqual({
        selectedFile: null,
        panelSizes: { fileList: 30, diffViewer: 70 },
        scrollPosition: 0,
      });
    });

    it('should set selected file', () => {
      const { setSelectedFile } = useUIStore.getState();

      setSelectedFile('/path/to/file.ts');
      expect(useUIStore.getState().changesTab.selectedFile).toBe('/path/to/file.ts');

      setSelectedFile(null);
      expect(useUIStore.getState().changesTab.selectedFile).toBeNull();
    });

    it('should set changes panel sizes', () => {
      const { setChangesPanelSizes } = useUIStore.getState();

      setChangesPanelSizes({ fileList: 40, diffViewer: 60 });
      expect(useUIStore.getState().changesTab.panelSizes).toEqual({
        fileList: 40,
        diffViewer: 60,
      });
    });

    it('should reset changes tab state', () => {
      const { setSelectedFile, setChangesPanelSizes, resetChangesTabState } = useUIStore.getState();

      // Modify state
      setSelectedFile('/path/to/file.ts');
      setChangesPanelSizes({ fileList: 50, diffViewer: 50 });

      // Reset
      resetChangesTabState();

      const state = useUIStore.getState();
      expect(state.changesTab).toEqual({
        selectedFile: null,
        panelSizes: { fileList: 30, diffViewer: 70 },
        scrollPosition: 0,
      });
    });
  });

  describe('Model State', () => {
    it('should initialize with default model', () => {
      const state = useUIStore.getState();
      expect(state.selectedModel).toBe(DEFAULT_MODEL);
    });

    it('should set selected model', () => {
      const { setSelectedModel } = useUIStore.getState();

      const customModel = 'claude-opus-4-20250514' as const;

      setSelectedModel(customModel);
      expect(useUIStore.getState().selectedModel).toEqual(customModel);
    });
  });

  describe('ActiveTabId Persistence', () => {
    it('should update activeTabId in tabState when setActiveTab is called', () => {
      const { setActiveTab, updateTabState } = useUIStore.getState();

      // Initialize tab state with multiple tabs
      updateTabState([
        {
          id: 'tab-1',
          agentId: 'agent-1',
          sessionId: 'session-1',
          agentName: 'Tab 1',
          agentType: 'text',
          isActive: false,
          lastAccessed: new Date(),
        },
        {
          id: 'tab-2',
          agentId: 'agent-2',
          sessionId: 'session-2',
          agentName: 'Tab 2',
          agentType: 'text',
          isActive: false,
          lastAccessed: new Date(),
        },
      ]);

      // Set active tab
      setActiveTab('tab-2');

      // Verify activeTabId is updated
      const state = useUIStore.getState();
      expect(state.tabState?.activeTabId).toBe('tab-2');
    });

    it('should retrieve activeTabId for current project', () => {
      const { updateTabState } = useUIStore.getState();

      // Initialize tab state with active tab
      updateTabState([
        {
          id: 'tab-1',
          agentId: 'agent-1',
          sessionId: 'session-1',
          agentName: 'Tab 1',
          agentType: 'text',
          isActive: false,
          lastAccessed: new Date(),
        },
      ]);

      useUIStore.setState({
        tabState: {
          ...useUIStore.getState().tabState!,
          activeTabId: 'tab-1',
        },
      });

      // Verify we can retrieve activeTabId
      const state = useUIStore.getState();
      expect(state.tabState?.activeTabId).toBe('tab-1');
    });

    it('should update tabs isActive property when activeTabId changes', () => {
      const { setActiveTab, updateTabState } = useUIStore.getState();

      // Initialize with tab-1 active
      updateTabState([
        {
          id: 'tab-1',
          agentId: 'agent-1',
          sessionId: 'session-1',
          agentName: 'Tab 1',
          agentType: 'text',
          isActive: true,
          lastAccessed: new Date(),
        },
        {
          id: 'tab-2',
          agentId: 'agent-2',
          sessionId: 'session-2',
          agentName: 'Tab 2',
          agentType: 'text',
          isActive: false,
          lastAccessed: new Date(),
        },
      ]);

      useUIStore.setState({
        tabState: {
          ...useUIStore.getState().tabState!,
          activeTabId: 'tab-1',
        },
      });

      // Switch to tab-2
      setActiveTab('tab-2');

      // Verify both activeTabId and isActive are updated correctly
      const state = useUIStore.getState();
      expect(state.tabState?.activeTabId).toBe('tab-2');
      expect(state.tabState?.tabs[0].isActive).toBe(false);
      expect(state.tabState?.tabs[1].isActive).toBe(true);
    });

    it('should initialize tabState when setting active tab on null tabState', () => {
      const { setActiveTab } = useUIStore.getState();

      // Reset to null tabState
      useUIStore.setState({ tabState: null });

      // Attempt to set active tab
      setActiveTab('tab-1');

      // Verify tabState is initialized with the active tab
      const state = useUIStore.getState();
      expect(state.tabState).not.toBeNull();
      expect(state.tabState?.activeTabId).toBe('tab-1');
      expect(state.tabState?.tabs).toEqual([]);
    });
  });
});
