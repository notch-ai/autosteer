import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { VimState } from '@/stores/vimStore';
import { useSettingsStore } from '@/stores/settings';
import { SearchResult } from './types';
import { TabState, SessionTab, ChangesTabState, MaximizeTab } from '@/types/ui.types';
import { ModelOption, DEFAULT_MODEL } from '@/types/model.types';
import { MAX_TABS } from '@/constants/tabs';
import { logger } from '@/commons/utils/logger';

// UIStore Interface (TRD Section 2.3.2)
export interface UIStore {
  // Layout State
  sidebarCollapsed: boolean;
  detailPanelCollapsed: boolean;
  activeView: 'list' | 'grid' | 'board';
  leftPanelWidth: number;
  rightPanelWidth: number;

  // Panel State
  activePanel: 'chat' | 'agents' | 'projects' | 'settings';
  showProjectCreation: boolean;

  // Tab State
  tabState: TabState | null;

  // Maximize Tabs State (1:1 mapping with session tabs)
  maximizeTabs: Map<string, MaximizeTab>;
  maximizeTabsVersion: number; // Counter to force re-renders when Map changes

  // Changes Tab State
  changesTab: ChangesTabState;

  // Search State
  searchQuery: string;
  searchResults: SearchResult[];
  isSearching: boolean;

  // Vim State
  vimMode: VimState;
  vimEnabled: boolean;

  // Model State
  selectedModel: ModelOption;

  // UI Actions
  toggleSidebar: () => void;
  toggleDetailPanel: () => void;
  setActiveView: (view: 'list' | 'grid' | 'board') => void;
  setPanelWidth: (panel: 'left' | 'right', width: number) => void;
  setActivePanel: (panel: 'chat' | 'agents' | 'projects' | 'settings') => void;
  setShowProjectCreation: (show: boolean) => void;

  // Search Actions
  setSearchQuery: (query: string) => void;
  performSearch: (query: string) => Promise<void>;
  clearSearch: () => void;

  // Vim Actions
  updateVimState: (updates: Partial<VimState>) => void;
  toggleVimMode: () => void;

  // Tab Actions
  setActiveTab: (tabId: string) => void;
  addTab: (agentId: string) => void;
  removeTab: (tabId: string) => void;
  updateTabState: (tabs: SessionTab[]) => void;

  // Maximize Tab Actions
  addMaximizeTab: (
    sessionId: string,
    projectId: string,
    content: string,
    metadata?: { sessionName?: string }
  ) => void;
  removeMaximizeTab: (sessionId: string) => void;
  updateMaximizeTab: (sessionId: string, updates: Partial<MaximizeTab>) => void;
  getMaximizeTab: (sessionId: string) => MaximizeTab | undefined;

  // Changes Tab Actions
  setSelectedFile: (filePath: string | null) => void;
  setChangesPanelSizes: (sizes: { fileList: number; diffViewer: number }) => void;
  resetChangesTabState: () => void;

  // Model Actions
  setSelectedModel: (model: ModelOption) => void;
}

// Default Vim state
const defaultVimState: VimState = {
  mode: 'NORMAL',
  enabled: false,
};

// DevTools configuration - only in development
// DevTools configuration - only in development
// Support both main process (Node.js) and renderer process (Vite)
const isDevelopment =
  (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') ||
  (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development');
const withDevtools = isDevelopment ? devtools : (f: any) => f;

export const useUIStore = create<UIStore>()(
  withDevtools(
    immer<UIStore>((set, _get) => ({
      // Layout State
      sidebarCollapsed: false,
      detailPanelCollapsed: false,
      activeView: 'list',
      leftPanelWidth: 280,
      rightPanelWidth: 320,

      // Panel State
      activePanel: 'chat',
      showProjectCreation: false,

      // Tab State
      tabState: null,

      // Maximize Tabs State
      maximizeTabs: new Map(),
      maximizeTabsVersion: 0,

      // Changes Tab State
      changesTab: {
        selectedFile: null,
        panelSizes: { fileList: 30, diffViewer: 70 },
        scrollPosition: 0,
      },

      // Search State
      searchQuery: '',
      searchResults: [],
      isSearching: false,

      // Vim State
      vimMode: defaultVimState,
      vimEnabled: false,

      // Model State - Initialize with default from settings or fallback
      selectedModel: useSettingsStore.getState()?.preferences?.defaultModel || DEFAULT_MODEL,

      // UI Actions
      toggleSidebar: () => {
        set((state) => {
          state.sidebarCollapsed = !state.sidebarCollapsed;
        });
      },

      toggleDetailPanel: () => {
        set((state) => {
          state.detailPanelCollapsed = !state.detailPanelCollapsed;
        });
      },

      setActiveView: (view: 'list' | 'grid' | 'board') => {
        set((state) => {
          state.activeView = view;
        });
      },

      setPanelWidth: (panel: 'left' | 'right', width: number) => {
        set((state) => {
          if (panel === 'left') {
            state.leftPanelWidth = width;
          } else {
            state.rightPanelWidth = width;
          }
        });
      },

      setActivePanel: (panel: 'chat' | 'agents' | 'projects' | 'settings') => {
        set((state) => {
          state.activePanel = panel;
        });
      },

      setShowProjectCreation: (show: boolean) => {
        set((state) => {
          state.showProjectCreation = show;
        });
      },

      // Search Actions
      setSearchQuery: (query: string) => {
        set((state) => {
          state.searchQuery = query;
        });
      },

      performSearch: async (query: string) => {
        set((state) => {
          state.isSearching = true;
          state.searchQuery = query;
        });

        try {
          // TODO: Implement actual search logic
          // This would call search services for agents, projects, resources
          const mockResults: SearchResult[] = [];

          // Simulate API delay
          await new Promise((resolve) => setTimeout(resolve, 300));

          set((state) => {
            state.searchResults = mockResults;
            state.isSearching = false;
          });
        } catch (error) {
          set((state) => {
            state.isSearching = false;
            state.searchResults = [];
          });
        }
      },

      clearSearch: () => {
        set((state) => {
          state.searchQuery = '';
          state.searchResults = [];
          state.isSearching = false;
        });
      },

      // Vim Actions
      updateVimState: (updates: Partial<VimState>) => {
        set((state) => {
          state.vimMode = { ...state.vimMode, ...updates };
        });
      },

      toggleVimMode: () => {
        set((state) => {
          state.vimEnabled = !state.vimEnabled;
          if (!state.vimEnabled) {
            // Reset vim state when disabled
            state.vimMode = defaultVimState;
          }
        });
      },

      // Tab Actions
      setActiveTab: (tabId: string) => {
        logger.debug('[ui.store] setActiveTab called', {
          tabId,
          hasTabState: !!_get().tabState,
          currentActiveTab: _get().tabState?.activeTabId,
        });

        set((state) => {
          if (state.tabState) {
            // CRITICAL: Create a new tabState object to trigger Zustand shallow comparison
            state.tabState = {
              ...state.tabState,
              activeTabId: tabId,
              tabs: state.tabState.tabs.map((tab) => ({
                ...tab,
                isActive: tab.id === tabId,
              })),
            };
            logger.debug('[ui.store] Active tab updated', { newActiveTab: tabId });
          } else {
            // Initialize tabState if it doesn't exist
            logger.debug('[ui.store] Initializing tabState with activeTabId', { tabId });
            state.tabState = {
              tabs: [],
              activeTabId: tabId,
              maxTabs: MAX_TABS,
            };
          }
        });
      },

      addTab: (_agentId: string) => {
        set((state) => {
          if (!state.tabState) {
            state.tabState = {
              tabs: [],
              activeTabId: '',
              maxTabs: MAX_TABS,
            };
          }
          // Tab creation will be handled by the agent creation flow
          // This is just a placeholder for the action
        });
      },

      removeTab: (tabId: string) => {
        set((state) => {
          if (state.tabState) {
            state.tabState.tabs = state.tabState.tabs.filter((tab) => tab.id !== tabId);
            if (state.tabState.activeTabId === tabId && state.tabState.tabs.length > 0) {
              state.tabState.activeTabId = state.tabState.tabs[0].id;
            }
          }
        });
      },

      updateTabState: (tabs: SessionTab[]) => {
        set((state) => {
          if (!state.tabState) {
            state.tabState = {
              tabs: [],
              activeTabId: '',
              maxTabs: MAX_TABS,
            };
          }
          state.tabState.tabs = tabs;
          // REMOVED: Auto-selection logic - let useSessionTabs.loadActiveTab handle it
          // This was causing Tools tab to be overwritten by tabs[0] on app startup
        });
      },

      // Maximize Tab Actions
      addMaximizeTab: (
        sessionId: string,
        projectId: string,
        _content: string,
        metadata?: { sessionName?: string }
      ) => {
        // Alert removed - function is being called

        const maximizeTab: MaximizeTab = {
          id: `maximize-${sessionId}`,
          agentId: sessionId,
          agentName: metadata?.sessionName || 'Tools',
          agentType: 'maximize',
          sessionId,
          ...(metadata?.sessionName && { sessionName: metadata.sessionName }),
          tabType: 'maximize',
          parentSessionId: sessionId,
          projectId,
          isActive: true,
          persistent: true,
          lastAccessed: new Date(),
        };

        logger.debug('[ui.store] Adding maximize tab to state', {
          sessionId,
          tabId: maximizeTab.id,
          currentSize: _get().maximizeTabs.size,
          persistent: true,
        });

        // CRITICAL: With immer, we must use a function to mutate the draft state
        set((draft) => {
          // Create a completely new Map instance
          const newMap = new Map(draft.maximizeTabs);
          newMap.set(sessionId, maximizeTab);

          // Replace the Map with the new instance (this MUST trigger change detection)
          draft.maximizeTabs = newMap;
          draft.maximizeTabsVersion = (draft.maximizeTabsVersion || 0) + 1;

          logger.debug('[ui.store] Inside set draft mutation', {
            mapSize: newMap.size,
            hasNewTab: newMap.has(sessionId),
            version: draft.maximizeTabsVersion,
          });
        });

        logger.debug('[ui.store] After set complete', {
          mapSize: _get().maximizeTabs.size,
          hasNewTab: _get().maximizeTabs.has(sessionId),
          version: _get().maximizeTabsVersion,
        });

        logger.info('[ui.store] Maximize tab added', {
          sessionId,
          newSize: _get().maximizeTabs.size,
          allTabs: Array.from(_get().maximizeTabs.keys()),
          persistent: true,
        });
      },

      removeMaximizeTab: (sessionId: string) => {
        logger.debug('[ui.store] Removing maximize tab', { sessionId });
        set((state) => {
          const newMap = new Map(state.maximizeTabs);
          newMap.delete(sessionId);
          state.maximizeTabs = newMap;
        });
        logger.info('[ui.store] Maximize tab removed', {
          sessionId,
          remainingSize: _get().maximizeTabs.size,
        });
      },

      updateMaximizeTab: (sessionId: string, updates: Partial<MaximizeTab>) => {
        logger.debug('[ui.store] Updating maximize tab', { sessionId, updates });
        set((state) => {
          const tab = state.maximizeTabs.get(sessionId);
          if (tab) {
            const newMap = new Map(state.maximizeTabs);
            newMap.set(sessionId, { ...tab, ...updates });
            state.maximizeTabs = newMap;
            logger.debug('[ui.store] Maximize tab updated successfully', { sessionId });
          } else {
            logger.warn('[ui.store] Cannot update non-existent maximize tab', { sessionId });
          }
        });
      },

      getMaximizeTab: (sessionId: string) => {
        return _get().maximizeTabs.get(sessionId);
      },

      // Changes Tab Actions
      setSelectedFile: (filePath: string | null) => {
        set((state) => {
          state.changesTab.selectedFile = filePath;
        });
      },

      setChangesPanelSizes: (sizes: { fileList: number; diffViewer: number }) => {
        set((state) => {
          state.changesTab.panelSizes = sizes;
        });
      },

      resetChangesTabState: () => {
        set((state) => {
          state.changesTab = {
            selectedFile: null,
            panelSizes: { fileList: 30, diffViewer: 70 },
            scrollPosition: 0,
          };
        });
      },

      // Model Actions
      setSelectedModel: (model: ModelOption) => {
        set((state) => {
          state.selectedModel = model;
        });
      },
    })),
    {
      name: 'ui-store',
      trace: true, // Enable action tracing
    }
  )
);

// Helper to sync selected model with settings on initialization
export const syncModelWithSettings = () => {
  const defaultModel = useSettingsStore.getState().preferences.defaultModel;
  if (defaultModel) {
    useUIStore.getState().setSelectedModel(defaultModel);
  }
};
