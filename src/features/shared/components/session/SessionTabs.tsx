import {
  KeyboardShortcuts,
  useKeyboardShortcut,
} from '@/commons/utils/keyboard/keyboard_shortcuts';
import { logger } from '@/commons/utils/logger';
import { cn } from '@/commons/utils/ui/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toastError } from '@/components/ui/sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MAX_TABS } from '@/constants/tabs';
import { ConfirmDialog } from '@/features/shared/components/ui/ConfirmDialog';
import { Icon } from '@/features/shared/components/ui/Icon';
import { useSessionTabs } from '@/hooks/useSessionTabs';
import { useAgentsStore, useChatStore, useSettingsStore } from '@/stores';
import { Bot, Eye, GitBranch, Terminal, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface SessionTabsProps {
  className?: string;
  onTabSwitch?: (tabId: string) => void;
  onNewSession?: () => void;
  onTabRenamed?: () => void;
  maxTabs?: number;
}

export const SessionTabs: React.FC<SessionTabsProps> = ({
  className,
  onTabSwitch,
  onNewSession,
  onTabRenamed,
  maxTabs = MAX_TABS,
}) => {
  const { tabs, activeTab, switchToTab, createNewTab, deleteAgent, isTabsEnabled } =
    useSessionTabs();
  const updateAgent = useAgentsStore((state) => state.updateAgent);
  const streamingStates = useChatStore((state) => state.streamingStates);
  const confirmSessionTabDeletion = useSettingsStore(
    (state) => state.preferences.confirmSessionTabDeletion ?? true
  );

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    tabId: string | null;
    agentName: string | null;
  }>({
    isOpen: false,
    tabId: null,
    agentName: null,
  });

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleTabSwitch = useCallback(
    (tabId: string) => {
      switchToTab(tabId);
      onTabSwitch?.(tabId);
    },
    [switchToTab, onTabSwitch, tabs]
  );

  const handleNewSession = useCallback(() => {
    if (tabs.length < maxTabs) {
      createNewTab();
      onNewSession?.();
    }
  }, [tabs.length, maxTabs, createNewTab, onNewSession]);

  const performTabDeletion = useCallback(
    async (tabId: string) => {
      try {
        const tab = tabs.find((t) => t.id === tabId);
        const agentTabs = tabs.filter((t) => t.tabType !== 'terminal' && t.tabType !== 'changes');
        const isLastAgentTab = agentTabs.length === 1;

        if (activeTab?.id === tabId && tabs.length > 1) {
          const currentIndex = tabs.findIndex((t) => t.id === tabId);
          const nextTab = tabs[currentIndex + 1] || tabs[0];

          if (nextTab?.id !== tabId) {
            await switchToTab(nextTab.id);
          }
        }

        // System tabs (terminal, changes, tools) cannot be deleted - handled by UI prevention
        // Only delete agent tabs
        if (tab?.tabType === 'agent') {
          await deleteAgent(tabId);
        }

        if (isLastAgentTab) {
          await createNewTab();
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete session';
        toastError(errorMessage);
      }
    },
    [tabs, activeTab, switchToTab, deleteAgent, createNewTab]
  );

  const handleCloseTab = useCallback(
    async (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation();
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;

      // Prevent closing persistent tabs (terminal, changes, tools)
      if (tab.tabType === 'terminal' || tab.tabType === 'changes' || tab.tabType === 'tools') {
        logger.debug('[SessionTabs] Cannot close persistent tab', {
          tabId,
          tabType: tab.tabType,
        });
        return;
      }

      if (confirmSessionTabDeletion) {
        setDeleteConfirm({
          isOpen: true,
          tabId,
          agentName: tab.agentName,
        });
      } else {
        await performTabDeletion(tabId);
      }
    },
    [tabs, confirmSessionTabDeletion, performTabDeletion]
  );

  const confirmDelete = useCallback(async () => {
    if (deleteConfirm.tabId) {
      await performTabDeletion(deleteConfirm.tabId);
      setDeleteConfirm({ isOpen: false, tabId: null, agentName: null });
    }
  }, [deleteConfirm.tabId, performTabDeletion]);

  const cancelDelete = useCallback(() => {
    setDeleteConfirm({ isOpen: false, tabId: null, agentName: null });
  }, []);

  const truncateName = useCallback((name: string, maxLength: number = 20) => {
    if (name.length <= maxLength) return name;
    return `${name.substring(0, maxLength - 3)}...`;
  }, []);

  const handleStartEdit = useCallback((e: React.MouseEvent, tabId: string, currentName: string) => {
    e.stopPropagation();
    setEditingTabId(tabId);
    setEditingTabName(currentName);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingTabId(null);
    setEditingTabName('');
  }, []);

  const handleSaveEdit = useCallback(
    async (tabId: string) => {
      const trimmedName = editingTabName.trim();

      // Don't allow empty names
      if (!trimmedName) {
        toastError('Tab name cannot be empty');
        return;
      }

      // Don't update if name hasn't changed
      const tab = tabs.find((t) => t.id === tabId);
      if (tab && trimmedName === tab.agentName) {
        handleCancelEdit();
        return;
      }

      try {
        // Update the agent title (skip for terminal tabs)
        if (tab?.tabType !== 'terminal') {
          await updateAgent(tabId, { title: trimmedName });
        }
        handleCancelEdit();

        // Focus chat input after rename (like creating a new tab)
        onTabRenamed?.();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to rename tab';
        toastError(errorMessage);
      }
    },
    [editingTabName, tabs, updateAgent, handleCancelEdit, onTabRenamed]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, tabId: string) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveEdit(tabId);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelEdit();
      }
    },
    [handleSaveEdit, handleCancelEdit]
  );

  // Focus input when editing starts
  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);

  const canAddNewTab = useMemo(() => tabs.length < maxTabs, [tabs.length, maxTabs]);

  // Keyboard shortcuts for tab navigation
  useKeyboardShortcut(
    [KeyboardShortcuts.TAB_1, KeyboardShortcuts.TAB_1_ALT],
    () => {
      if (tabs.length >= 1) switchToTab(tabs[0].id);
    },
    { enabled: isTabsEnabled }
  );

  useKeyboardShortcut(
    [KeyboardShortcuts.TAB_2, KeyboardShortcuts.TAB_2_ALT],
    () => {
      if (tabs.length >= 2) switchToTab(tabs[1].id);
    },
    { enabled: isTabsEnabled }
  );

  useKeyboardShortcut(
    [KeyboardShortcuts.TAB_3, KeyboardShortcuts.TAB_3_ALT],
    () => {
      if (tabs.length >= 3) switchToTab(tabs[2].id);
    },
    { enabled: isTabsEnabled }
  );

  useKeyboardShortcut(
    [KeyboardShortcuts.TAB_4, KeyboardShortcuts.TAB_4_ALT],
    () => {
      if (tabs.length >= 4) switchToTab(tabs[3].id);
    },
    { enabled: isTabsEnabled }
  );

  useKeyboardShortcut(
    [KeyboardShortcuts.TAB_5, KeyboardShortcuts.TAB_5_ALT],
    () => {
      if (tabs.length >= 5) switchToTab(tabs[4].id);
    },
    { enabled: isTabsEnabled }
  );

  useKeyboardShortcut(
    [KeyboardShortcuts.NEW_TAB, KeyboardShortcuts.NEW_TAB_ALT],
    () => {
      if (canAddNewTab) handleNewSession();
    },
    { enabled: isTabsEnabled && canAddNewTab }
  );

  useKeyboardShortcut(
    [KeyboardShortcuts.CLOSE_TAB, KeyboardShortcuts.CLOSE_TAB_ALT],
    useCallback(() => {
      if (
        activeTab &&
        tabs.length > 1 &&
        activeTab.tabType !== 'terminal' &&
        activeTab.tabType !== 'changes' &&
        activeTab.tabType !== 'tools'
      ) {
        if (confirmSessionTabDeletion) {
          setDeleteConfirm({
            isOpen: true,
            tabId: activeTab.id,
            agentName: activeTab.agentName,
          });
        } else {
          void performTabDeletion(activeTab.id);
        }
      }
    }, [activeTab, tabs.length, confirmSessionTabDeletion, performTabDeletion]),
    { enabled: isTabsEnabled && tabs.length > 1 }
  );

  useKeyboardShortcut(
    [KeyboardShortcuts.RENAME_TAB, KeyboardShortcuts.RENAME_TAB_ALT],
    () => {
      if (
        activeTab &&
        activeTab.tabType !== 'terminal' &&
        activeTab.tabType !== 'changes' &&
        activeTab.tabType !== 'tools' &&
        !editingTabId
      ) {
        setEditingTabId(activeTab.id);
        setEditingTabName(activeTab.agentName);
      }
    },
    { enabled: isTabsEnabled && !editingTabId }
  );

  // Tab cycling shortcuts - Next tab (Cmd+Opt+Right)
  useKeyboardShortcut(
    [KeyboardShortcuts.NEXT_TAB, KeyboardShortcuts.NEXT_TAB_ALT],
    () => {
      if (tabs.length <= 1 || !activeTab) {
        return;
      }

      const currentIndex = tabs.findIndex((tab) => tab.id === activeTab.id);
      if (currentIndex === -1) {
        return;
      }

      // Use modulo arithmetic for wrap-around: (current + 1) % length
      const nextIndex = (currentIndex + 1) % tabs.length;
      const nextTab = tabs[nextIndex];

      switchToTab(nextTab.id);
    },
    { enabled: isTabsEnabled && tabs.length > 1 }
  );

  // Tab cycling shortcuts - Previous tab (Cmd+Opt+Left)
  useKeyboardShortcut(
    [KeyboardShortcuts.PREV_TAB, KeyboardShortcuts.PREV_TAB_ALT],
    () => {
      if (tabs.length <= 1 || !activeTab) {
        return;
      }

      const currentIndex = tabs.findIndex((tab) => tab.id === activeTab.id);
      if (currentIndex === -1) {
        return;
      }

      // Use modulo arithmetic for wrap-around: (current - 1 + length) % length
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      const prevTab = tabs[prevIndex];

      switchToTab(prevTab.id);
    },
    { enabled: isTabsEnabled && tabs.length > 1 }
  );

  if (!isTabsEnabled) {
    return null;
  }

  const radixTabsValue = activeTab?.id || '';

  return (
    <div className={cn('pt-0', className)}>
      <div className="flex items-center gap-1.5 border-b border-border px-2 pb-1">
        <Tabs value={radixTabsValue} onValueChange={handleTabSwitch}>
          <TabsList className="inline-flex justify-start">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="relative group h-8 text-sm px-3 py-3"
                title={tab.agentName}
              >
                {editingTabId === tab.id && tab.tabType !== 'terminal' ? (
                  <div
                    className="flex items-center gap-2 pr-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {tab.tabType === 'changes' ? (
                      <GitBranch
                        style={{
                          width: 'var(--font-size-base)',
                          height: 'var(--font-size-base)',
                        }}
                        className="opacity-60"
                      />
                    ) : tab.tabType === 'tools' ? (
                      <Eye
                        style={{
                          width: 'var(--font-size-base)',
                          height: 'var(--font-size-base)',
                        }}
                        className="opacity-60"
                      />
                    ) : (
                      <Bot
                        style={{
                          width: 'var(--font-size-base)',
                          height: 'var(--font-size-base)',
                        }}
                        className={cn(
                          'opacity-60',
                          streamingStates.get(tab.id) && 'session-active-blink'
                        )}
                      />
                    )}
                    <Input
                      ref={inputRef}
                      value={editingTabName}
                      onChange={(e) => setEditingTabName(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, tab.id)}
                      onBlur={() => handleSaveEdit(tab.id)}
                      className="h-5 text-sm px-1.5 py-0 w-24 min-w-0"
                      autoFocus
                    />
                  </div>
                ) : (
                  <span
                    className={cn(
                      'flex items-center gap-2 pr-6',
                      tab.tabType !== 'terminal' &&
                        tab.tabType !== 'changes' &&
                        tab.tabType !== 'tools' &&
                        'cursor-text'
                    )}
                    onDoubleClick={
                      tab.tabType !== 'terminal' &&
                      tab.tabType !== 'changes' &&
                      tab.tabType !== 'tools'
                        ? (e) => handleStartEdit(e, tab.id, tab.agentName)
                        : undefined
                    }
                  >
                    {tab.tabType === 'terminal' ? (
                      <Terminal
                        style={{
                          width: 'var(--font-size-base)',
                          height: 'var(--font-size-base)',
                        }}
                        className="opacity-60"
                      />
                    ) : tab.tabType === 'changes' ? (
                      <GitBranch
                        style={{
                          width: 'var(--font-size-base)',
                          height: 'var(--font-size-base)',
                        }}
                        className="opacity-60"
                      />
                    ) : tab.tabType === 'tools' ? (
                      <Eye
                        style={{
                          width: 'var(--font-size-base)',
                          height: 'var(--font-size-base)',
                        }}
                        className="opacity-60"
                      />
                    ) : (
                      <Bot
                        style={{
                          width: 'var(--font-size-base)',
                          height: 'var(--font-size-base)',
                        }}
                        className={cn(
                          'opacity-60',
                          streamingStates.get(tab.id) && 'session-active-blink'
                        )}
                      />
                    )}
                    <span className="truncate">{truncateName(tab.agentName, 15)}</span>
                  </span>
                )}
                {tab.tabType !== 'terminal' &&
                  tab.tabType !== 'changes' &&
                  tab.tabType !== 'tools' && (
                    <span
                      onClick={(e) => handleCloseTab(e, tab.id)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-card-hover opacity-0 group-hover:opacity-100 group-data-[state=active]:opacity-100 cursor-pointer"
                      aria-label={`Close ${tab.agentName} tab`}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleCloseTab(e as any, tab.id);
                        }
                      }}
                    >
                      <X
                        style={{
                          width: 'var(--font-size-sm)',
                          height: 'var(--font-size-sm)',
                        }}
                      />
                    </span>
                  )}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="hidden">
              {/* Content is managed by ChatInterface, tabs are just for navigation */}
            </TabsContent>
          ))}
        </Tabs>

        {canAddNewTab && (
          <Button
            variant="outline"
            size="icon-sm"
            className="mx-4 bg-background shadow-xs"
            onClick={handleNewSession}
            title="New session (Cmd+T)"
            aria-label="Create new session"
          >
            <Icon name="plus" size={14} />
          </Button>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Session"
        message={`Are you sure you want to delete "${deleteConfirm.agentName || 'this session'}"? This will remove the agent and its conversation history.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        variant="danger"
      />
    </div>
  );
};
