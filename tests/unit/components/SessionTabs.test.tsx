/**
 * SessionTabs Component Tests
 * Tests for tab navigation with keyboard shortcuts including cycling with Cmd+Opt+Left/Right
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SessionTabs } from '@/components/features/SessionTabs';
import { useSessionTabs } from '@/hooks/useSessionTabs';
import type { SessionTab } from '@/types/ui.types';

// Mock dependencies
jest.mock('@/hooks/useSessionTabs');
jest.mock('@/stores/core');
jest.mock('@/components/ui/sonner', () => ({
  toastSuccess: jest.fn(),
  toastError: jest.fn(),
}));

// Import mocked modules
import { useCoreStore } from '@/stores/core';

describe('SessionTabs - Tab Cycling Navigation', () => {
  const mockSwitchToTab = jest.fn();
  const mockCreateNewTab = jest.fn();
  const mockCloseTab = jest.fn();
  const mockDeleteAgent = jest.fn();
  const mockUpdateAgent = jest.fn();

  const createMockTab = (id: string, name: string, isActive = false): SessionTab => ({
    id,
    agentId: id,
    agentName: name,
    agentType: 'general',
    isActive,
    sessionId: `session-${id}`,
    lastAccessed: new Date(),
    tabType: 'agent',
  });

  const mockTabs: SessionTab[] = [
    createMockTab('tab1', 'Agent 1', true),
    createMockTab('tab2', 'Agent 2'),
    createMockTab('tab3', 'Agent 3'),
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    console.log('[TEST SETUP] Initializing SessionTabs test');

    (useCoreStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        updateAgent: mockUpdateAgent,
      };
      return selector(state);
    });

    (useSessionTabs as jest.Mock).mockReturnValue({
      tabs: mockTabs,
      activeTab: mockTabs[0],
      switchToTab: mockSwitchToTab,
      createNewTab: mockCreateNewTab,
      closeTab: mockCloseTab,
      deleteAgent: mockDeleteAgent,
      isTabsEnabled: true,
    });
  });

  describe('Tab Cycling with Cmd+Opt+Left/Right', () => {
    it('should cycle to next tab with Cmd+Opt+Right', async () => {
      console.log('[TEST] Testing NEXT_TAB shortcut (Cmd+Opt+Right)');
      render(<SessionTabs />);

      const event = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        metaKey: true,
        altKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);

      await waitFor(() => {
        expect(mockSwitchToTab).toHaveBeenCalledWith('tab2');
        console.log('[TEST] ✓ Cycled to next tab successfully');
      });
    });

    it('should cycle to previous tab with Cmd+Opt+Left', async () => {
      console.log('[TEST] Testing PREV_TAB shortcut (Cmd+Opt+Left)');
      (useSessionTabs as jest.Mock).mockReturnValue({
        tabs: mockTabs,
        activeTab: mockTabs[1],
        switchToTab: mockSwitchToTab,
        createNewTab: mockCreateNewTab,
        closeTab: mockCloseTab,
        deleteAgent: mockDeleteAgent,
        isTabsEnabled: true,
      });

      render(<SessionTabs />);

      const event = new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        metaKey: true,
        altKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);

      await waitFor(() => {
        expect(mockSwitchToTab).toHaveBeenCalledWith('tab1');
        console.log('[TEST] ✓ Cycled to previous tab successfully');
      });
    });

    it('should wrap to first tab when cycling next from last tab', async () => {
      console.log('[TEST] Testing wrap-around: last → first');
      (useSessionTabs as jest.Mock).mockReturnValue({
        tabs: mockTabs,
        activeTab: mockTabs[2],
        switchToTab: mockSwitchToTab,
        createNewTab: mockCreateNewTab,
        closeTab: mockCloseTab,
        deleteAgent: mockDeleteAgent,
        isTabsEnabled: true,
      });

      render(<SessionTabs />);

      const event = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        metaKey: true,
        altKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);

      await waitFor(() => {
        expect(mockSwitchToTab).toHaveBeenCalledWith('tab1');
        console.log('[TEST] ✓ Wrapped to first tab using modulo arithmetic');
      });
    });

    it('should wrap to last tab when cycling previous from first tab', async () => {
      console.log('[TEST] Testing wrap-around: first → last');
      render(<SessionTabs />);

      const event = new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        metaKey: true,
        altKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);

      await waitFor(() => {
        expect(mockSwitchToTab).toHaveBeenCalledWith('tab3');
        console.log('[TEST] ✓ Wrapped to last tab using modulo arithmetic');
      });
    });

    it('should not cycle when only one tab exists', async () => {
      console.log('[TEST] Testing edge case: single tab');
      (useSessionTabs as jest.Mock).mockReturnValue({
        tabs: [mockTabs[0]],
        activeTab: mockTabs[0],
        switchToTab: mockSwitchToTab,
        createNewTab: mockCreateNewTab,
        closeTab: mockCloseTab,
        deleteAgent: mockDeleteAgent,
        isTabsEnabled: true,
      });

      render(<SessionTabs />);

      const event = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        metaKey: true,
        altKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);

      await waitFor(() => {
        expect(mockSwitchToTab).not.toHaveBeenCalled();
        console.log('[TEST] ✓ No cycling with single tab');
      });
    });

    it('should not cycle when no tabs exist', async () => {
      console.log('[TEST] Testing edge case: zero tabs');
      (useSessionTabs as jest.Mock).mockReturnValue({
        tabs: [],
        activeTab: null,
        switchToTab: mockSwitchToTab,
        createNewTab: mockCreateNewTab,
        closeTab: mockCloseTab,
        deleteAgent: mockDeleteAgent,
        isTabsEnabled: true,
      });

      render(<SessionTabs />);

      const event = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        metaKey: true,
        altKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);

      await waitFor(() => {
        expect(mockSwitchToTab).not.toHaveBeenCalled();
        console.log('[TEST] ✓ No cycling with zero tabs');
      });
    });
  });

  describe('Direct Tab Navigation (Cmd+1-5)', () => {
    it('should navigate to tab 2 with Cmd+2', async () => {
      console.log('[TEST] Testing direct navigation: Cmd+2');
      render(<SessionTabs />);

      const event = new KeyboardEvent('keydown', {
        key: '2',
        metaKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);

      await waitFor(() => {
        expect(mockSwitchToTab).toHaveBeenCalledWith('tab2');
        console.log('[TEST] ✓ Direct navigation to tab 2');
      });
    });

    it('should not navigate when tab index does not exist', async () => {
      console.log('[TEST] Testing non-existent tab navigation');
      render(<SessionTabs />);

      const event = new KeyboardEvent('keydown', {
        key: '5',
        metaKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);

      await waitFor(() => {
        expect(mockSwitchToTab).not.toHaveBeenCalled();
        console.log('[TEST] ✓ Ignored shortcut for non-existent tab');
      });
    });
  });

  describe('Tab Management Shortcuts', () => {
    it('should create new tab with Cmd+T', async () => {
      console.log('[TEST] Testing new tab creation: Cmd+T');
      render(<SessionTabs maxTabs={5} />);

      const event = new KeyboardEvent('keydown', {
        key: 't',
        metaKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);

      await waitFor(() => {
        expect(mockCreateNewTab).toHaveBeenCalled();
        console.log('[TEST] ✓ New tab created');
      });
    });

    it('should close tab with Cmd+W', async () => {
      console.log('[TEST] Testing tab close: Cmd+W');
      render(<SessionTabs />);

      const event = new KeyboardEvent('keydown', {
        key: 'w',
        metaKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);

      await waitFor(() => {
        expect(mockCloseTab).toHaveBeenCalledWith('tab1');
        console.log('[TEST] ✓ Tab closed');
      });
    });

    it('should not create tab at max limit', async () => {
      console.log('[TEST] Testing max tabs limit');
      const fiveTabs = [
        createMockTab('tab1', 'Agent 1', true),
        createMockTab('tab2', 'Agent 2'),
        createMockTab('tab3', 'Agent 3'),
        createMockTab('tab4', 'Agent 4'),
        createMockTab('tab5', 'Agent 5'),
      ];

      (useSessionTabs as jest.Mock).mockReturnValue({
        tabs: fiveTabs,
        activeTab: fiveTabs[0],
        switchToTab: mockSwitchToTab,
        createNewTab: mockCreateNewTab,
        closeTab: mockCloseTab,
        deleteAgent: mockDeleteAgent,
        isTabsEnabled: true,
      });

      render(<SessionTabs maxTabs={5} />);

      const event = new KeyboardEvent('keydown', {
        key: 't',
        metaKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);

      await waitFor(() => {
        expect(mockCreateNewTab).not.toHaveBeenCalled();
        console.log('[TEST] ✓ Tab creation blocked at max limit');
      });
    });
  });

  describe('Cross-Platform Support', () => {
    it('should support Ctrl+Alt shortcuts on non-Mac platforms', async () => {
      console.log('[TEST] Testing Ctrl+Alt shortcuts for Windows/Linux');
      render(<SessionTabs />);

      const event = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        ctrlKey: true,
        altKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);

      await waitFor(() => {
        expect(mockSwitchToTab).toHaveBeenCalledWith('tab2');
        console.log('[TEST] ✓ Ctrl+Alt shortcut works on non-Mac');
      });
    });
  });

  describe('Edge Cases and Disabled States', () => {
    it('should render nothing when tabs are disabled', () => {
      console.log('[TEST] Testing disabled tabs state');
      (useSessionTabs as jest.Mock).mockReturnValue({
        tabs: mockTabs,
        activeTab: mockTabs[0],
        switchToTab: mockSwitchToTab,
        createNewTab: mockCreateNewTab,
        closeTab: mockCloseTab,
        deleteAgent: mockDeleteAgent,
        isTabsEnabled: false,
      });

      const { container } = render(<SessionTabs />);
      expect(container.firstChild).toBeNull();
      console.log('[TEST] ✓ Nothing rendered when disabled');
    });

    it('should have proper ARIA labels for accessibility', () => {
      console.log('[TEST] Testing accessibility: ARIA labels');
      render(<SessionTabs />);

      const newSessionButton = screen.getByLabelText('Create new session');
      expect(newSessionButton).toBeInTheDocument();
      console.log('[TEST] ✓ ARIA labels present');
    });
  });

  describe('Last Session Deletion', () => {
    it('should allow deleting the first tab when multiple tabs exist', () => {
      console.log('[TEST] Testing delete button visibility on first tab with multiple tabs');
      render(<SessionTabs />);

      // Find the first agent tab by text
      const firstTab = screen.getByText('Agent 1').closest('[role="tab"]');
      expect(firstTab).toBeInTheDocument();

      // The close button should be visible (even for the first agent tab)
      if (firstTab) {
        const closeButton = firstTab.querySelector('[aria-label*="Close"]');
        expect(closeButton).toBeInTheDocument();
      }
      console.log('[TEST] ✓ Delete button visible on first tab');
    });

    it('should create new session when deleting the last agent tab', async () => {
      console.log('[TEST] Testing auto-creation when deleting last agent tab');
      // Only one agent tab (terminal and changes tabs don't count as deletable agent tabs)
      const singleAgentTab = [createMockTab('tab1', 'Agent 1', true)];
      const mockDeleteAgentResolved = jest.fn().mockResolvedValue(undefined);

      (useSessionTabs as jest.Mock).mockReturnValue({
        tabs: singleAgentTab,
        activeTab: singleAgentTab[0],
        switchToTab: mockSwitchToTab,
        createNewTab: mockCreateNewTab,
        closeTab: mockCloseTab,
        deleteAgent: mockDeleteAgentResolved,
        isTabsEnabled: true,
      });

      render(<SessionTabs />);

      // Click the delete button
      const firstTab = screen.getByText('Agent 1').closest('[role="tab"]');
      expect(firstTab).toBeInTheDocument();

      if (firstTab) {
        const closeButton = firstTab.querySelector('[aria-label*="Close"]');
        expect(closeButton).toBeInTheDocument();

        if (closeButton) {
          fireEvent.click(closeButton);

          // Confirm deletion in the dialog
          const confirmButton = await screen.findByText('Delete');
          fireEvent.click(confirmButton);

          await waitFor(() => {
            expect(mockDeleteAgentResolved).toHaveBeenCalledWith('tab1');
            expect(mockCreateNewTab).toHaveBeenCalled();
            console.log('[TEST] ✓ New session created after deleting last agent tab');
          });
        }
      }
    });

    it('should show delete button on last agent tab', () => {
      console.log('[TEST] Testing delete button visibility on single agent tab');
      const singleAgentTab = [createMockTab('tab1', 'Agent 1', true)];

      (useSessionTabs as jest.Mock).mockReturnValue({
        tabs: singleAgentTab,
        activeTab: singleAgentTab[0],
        switchToTab: mockSwitchToTab,
        createNewTab: mockCreateNewTab,
        closeTab: mockCloseTab,
        deleteAgent: mockDeleteAgent,
        isTabsEnabled: true,
      });

      render(<SessionTabs />);

      const firstTab = screen.getByText('Agent 1').closest('[role="tab"]');
      expect(firstTab).toBeInTheDocument();

      if (firstTab) {
        const closeButton = firstTab.querySelector('[aria-label*="Close"]');
        expect(closeButton).toBeInTheDocument();
      }
      console.log('[TEST] ✓ Delete button visible on last agent tab');
    });
  });
});
