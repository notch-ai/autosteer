import { useCallback, useEffect, useRef } from 'react';

/**
 * useChatScroll - Simple scroll management for chat with z-index stacking
 *
 * Single Source of Truth: Browser DOM (elements stay mounted with z-index)
 * Derived State: Compute "at bottom" on-demand, don't store
 * No Duplication: Browser automatically preserves scroll positions
 *
 * Scroll Rules:
 * 1. ✅ Start at bottom on first render
 * 2. ✅ Browser stores position automatically (z-index keeps DOM mounted)
 * 3. ✅ Scroll to bottom when message sent (caller responsibility)
 * 4. ✅ Auto-scroll for new messages when at bottom (sticky-bottom)
 * 5. ✅ Browser restores position on tab switch (z-index keeps DOM mounted)
 * 6. ✅ Focus handled separately
 *
 * ## Critical Implementation Detail: Render-Phase Scroll Capture
 *
 * The auto-scroll logic must check if user is "at bottom" BEFORE React renders new
 * message content. Otherwise, the growing scrollHeight pushes the user outside the
 * threshold even if they were within range before content arrived.
 *
 * **React Rendering Timeline:**
 * ```
 * 1. State updates (new message arrives)
 * 2. Component re-renders (render phase) ← Capture scroll position HERE
 * 3. React commits DOM changes (scrollHeight grows)
 * 4. useEffect runs ← Use captured position HERE
 * ```
 *
 * **Example Problem Without Render-Phase Capture:**
 * ```
 * Before message: distanceFromBottom = 100px (within 300px threshold ✅)
 * After message:   distanceFromBottom = 600px (outside 300px threshold ❌)
 *                  └─ New content added 500px, pushing user away
 * ```
 *
 * **Solution:**
 * We capture `wasAtBottomBeforeRenderRef` during render phase (step 2) by checking
 * `isAtBottom()` outside the useEffect. This happens BEFORE React updates the DOM,
 * so we read the scroll position before scrollHeight grows.
 *
 * @param messages - Message array to trigger auto-scroll
 * @param isActive - Whether this chat tab is currently visible
 * @param options - Configuration options
 */
interface UseChatScrollOptions {
  /** Threshold in pixels to consider "at bottom" */
  bottomThreshold?: number;
  /** Whether this tab is currently active */
  isActive: boolean;
}

export const useChatScroll = <T extends { id: string; content?: string }>(
  messages: T[],
  { bottomThreshold = 50, isActive }: UseChatScrollOptions
) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);
  const previousMessageCountRef = useRef(messages.length);
  const lastMessageContentRef = useRef<string>('');
  const lastMessageIdRef = useRef<string>('');
  const effectRunCountRef = useRef(0);

  // Track previous values to detect what changed
  const prevMessagesRef = useRef(messages);
  const prevIsActiveRef = useRef(isActive);

  // Track if user was at bottom BEFORE React renders new content
  const wasAtBottomBeforeRenderRef = useRef(true);

  // Debug: Log scroll element properties
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      console.log('[useChatScroll] Scroll element connected:', {
        tagName: el.tagName,
        className: el.className,
        scrollTop: el.scrollTop,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        offsetHeight: el.offsetHeight,
        overflow: window.getComputedStyle(el).overflow,
        overflowY: window.getComputedStyle(el).overflowY,
        position: window.getComputedStyle(el).position,
      });
    } else {
      console.log('[useChatScroll] No scroll element connected yet');
    }
  }, [scrollRef.current]);

  /**
   * Check if scroll is at bottom (derived state - computed on-demand)
   */
  const isAtBottom = useCallback((): boolean => {
    if (!scrollRef.current) {
      console.log('[useChatScroll] isAtBottom: no scrollRef');
      return true;
    }

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    if (scrollHeight === 0 || clientHeight === 0) {
      console.log('[useChatScroll] isAtBottom: zero dimensions', {
        scrollHeight,
        clientHeight,
      });
      return false;
    }

    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    const atBottom = distanceFromBottom <= bottomThreshold;
    console.log('[useChatScroll] isAtBottom check:', {
      scrollTop,
      scrollHeight,
      clientHeight,
      distanceFromBottom,
      bottomThreshold,
      atBottom,
    });
    return atBottom;
  }, [bottomThreshold]);

  /**
   * Scroll to bottom (for rules 1 and 3)
   */
  const scrollToBottom = useCallback(() => {
    if (!scrollRef.current) {
      console.log('[useChatScroll] scrollToBottom: no scrollRef');
      return;
    }

    console.log('[useChatScroll] scrollToBottom called, scheduling RAF');
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        const beforeScroll = scrollRef.current.scrollTop;
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        console.log('[useChatScroll] scrollToBottom executed:', {
          beforeScroll,
          afterScroll: scrollRef.current.scrollTop,
          scrollHeight: scrollRef.current.scrollHeight,
        });
      }
    });
  }, []);

  /**
   * Rule 1: Start at bottom on first render
   */
  useEffect(() => {
    console.log('[useChatScroll] Initial scroll effect', {
      hasScrollRef: !!scrollRef.current,
      initialized: initializedRef.current,
      isActive,
    });

    if (!scrollRef.current || initializedRef.current || !isActive) return;

    const element = scrollRef.current;
    console.log('[useChatScroll] Scheduling initial scroll to bottom');
    requestAnimationFrame(() => {
      if (element.scrollHeight > 0) {
        element.scrollTop = element.scrollHeight;
        initializedRef.current = true;
        console.log('[useChatScroll] Initial scroll completed', {
          scrollTop: element.scrollTop,
          scrollHeight: element.scrollHeight,
        });
      } else {
        console.log('[useChatScroll] Initial scroll skipped - zero scrollHeight');
      }
    });
  }, [isActive]);

  /**
   * Capture scroll position on every render (before React updates DOM)
   * This runs synchronously during render, capturing state before new content affects layout
   */
  if (scrollRef.current && isActive) {
    wasAtBottomBeforeRenderRef.current = isAtBottom();
  }

  /**
   * Rule 4: Auto-scroll for new messages when at bottom (sticky-bottom)
   * Rules 2, 5: Browser handles automatically via z-index stacking
   *
   * Triggers on:
   * - New message added (length change)
   * - Content update during streaming (same message ID, different content)
   */
  useEffect(() => {
    effectRunCountRef.current += 1;

    // Detect what changed to trigger this effect
    const messagesArrayChanged = messages !== prevMessagesRef.current;
    const isActiveChanged = isActive !== prevIsActiveRef.current;

    console.log('[useChatScroll] Effect triggered', {
      runCount: effectRunCountRef.current,
      isActive,
      messageCount: messages.length,
      hasMessages: messages.length > 0,
      triggerReasons: {
        messagesArrayChanged,
        isActiveChanged,
        callbacks: 'isAtBottom/scrollToBottom might have changed',
      },
    });

    // Update tracking refs
    prevMessagesRef.current = messages;
    prevIsActiveRef.current = isActive;

    // Only active tabs should auto-scroll
    if (!isActive) {
      console.log('[useChatScroll] Skipping: tab not active');
      return;
    }

    // Capture previous values BEFORE any logic
    const prevMessageCount = previousMessageCountRef.current;
    const prevLastMessageId = lastMessageIdRef.current;
    const prevLastMessageContent = lastMessageContentRef.current;

    // Get the last message
    const lastMessage = messages[messages.length - 1];
    const currentContent = lastMessage?.content || '';
    const currentId = lastMessage?.id || '';

    // Check if new messages were added OR content of last message changed (streaming)
    const newMessagesAdded = messages.length > prevMessageCount;
    const contentChanged =
      currentId === prevLastMessageId && currentContent !== prevLastMessageContent;

    console.log('[useChatScroll] Message array state:', {
      totalMessages: messages.length,
      messageIds: messages.map((m) => m.id),
      lastMessageId: currentId,
      lastMessageContentPreview: currentContent.slice(0, 100) + '...',
    });

    console.log('[useChatScroll] Change detection:', {
      newMessagesAdded,
      contentChanged,
      currentMessageCount: messages.length,
      previousMessageCount: prevMessageCount,
      currentId,
      prevLastMessageId,
      currentIdMatchesPrevious: currentId === prevLastMessageId,
      contentLengthCurrent: currentContent.length,
      contentLengthPrevious: prevLastMessageContent.length,
      contentLengthChanged: currentContent.length !== prevLastMessageContent.length,
    });

    // Update refs AFTER checking for changes
    previousMessageCountRef.current = messages.length;
    lastMessageContentRef.current = currentContent;
    lastMessageIdRef.current = currentId;

    // Skip if no changes
    if (!newMessagesAdded && !contentChanged) {
      console.log('[useChatScroll] Skipping: no changes detected');
      return;
    }

    // IMPORTANT: Use the captured scroll position from BEFORE React rendered new content
    // wasAtBottomBeforeRenderRef was set during render phase (before DOM update)
    // This prevents new content growth from pushing user outside threshold
    const wasAtBottom = wasAtBottomBeforeRenderRef.current;

    // Check current position after render for debugging
    const currentAtBottom = isAtBottom();

    console.log('[useChatScroll] Changes detected, checking if at bottom...', {
      hasScrollRef: !!scrollRef.current,
      wasAtBottomBeforeRender: wasAtBottom,
      currentAtBottomAfterRender: currentAtBottom,
      scrollRefElement: scrollRef.current
        ? {
            scrollTop: scrollRef.current.scrollTop,
            scrollHeight: scrollRef.current.scrollHeight,
            clientHeight: scrollRef.current.clientHeight,
          }
        : null,
    });

    // Auto-scroll only if user was at bottom before content grew (sticky-bottom behavior)
    if (wasAtBottom) {
      console.log('[useChatScroll] User at bottom, scheduling auto-scroll');
      // Double RAF ensures DOM is fully updated before scrolling
      let rafId2: number | undefined;

      const rafId1 = requestAnimationFrame(() => {
        console.log('[useChatScroll] First RAF executed');
        rafId2 = requestAnimationFrame(() => {
          console.log('[useChatScroll] Second RAF executed, calling scrollToBottom');
          // Already determined we were at bottom before new message
          // No need to check again - just scroll
          scrollToBottom();
        });
      });

      return () => {
        cancelAnimationFrame(rafId1);
        if (rafId2) cancelAnimationFrame(rafId2);
      };
    } else {
      console.log('[useChatScroll] User not at bottom, skipping auto-scroll');
    }

    return undefined;
  }, [messages, isActive, isAtBottom, scrollToBottom]);

  // Return minimal interface
  return {
    scrollRef,
    scrollToBottom,
    isAtBottom,
  };
};
