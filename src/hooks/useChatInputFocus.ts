import { useEffect, useRef } from 'react';
import { useAgentsStore } from '@/stores';
import { TERMINAL_TAB_ID, CHANGES_TAB_ID } from '@/constants/tabs';

export interface ChatInputFocusOptions {
  enabled?: boolean;
  debounceMs?: number;
  skipForTabs?: string[];
}

const DEFAULT_OPTIONS: Required<ChatInputFocusOptions> = {
  enabled: true,
  debounceMs: 150,
  skipForTabs: [TERMINAL_TAB_ID, CHANGES_TAB_ID],
};

export function useChatInputFocus(
  focusFn: (() => void) | null,
  options: ChatInputFocusOptions = {}
) {
  const { enabled, debounceMs, skipForTabs } = { ...DEFAULT_OPTIONS, ...options };
  const selectedAgentId = useAgentsStore((state) => state.selectedAgentId);
  const previousAgentIdRef = useRef<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled || !focusFn || !selectedAgentId) return;

    if (selectedAgentId === previousAgentIdRef.current) return;

    if (skipForTabs.includes(selectedAgentId)) {
      previousAgentIdRef.current = selectedAgentId;
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      focusFn();
      previousAgentIdRef.current = selectedAgentId;
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [selectedAgentId, enabled, focusFn, debounceMs, skipForTabs]);
}
