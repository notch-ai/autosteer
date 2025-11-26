import { useChatStore } from '@/stores';
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronRight } from 'lucide-react';
import React, { useEffect } from 'react';
import { VariableSizeList as List } from 'react-window';
import { useVirtualScrollState } from '@/hooks';

export interface TraceTabProps {
  agentId?: string;
}

export const TraceTab: React.FC<TraceTabProps> = ({ agentId: propAgentId }) => {
  const traceEntries = useChatStore((state) => state.traceEntries);
  const storeActiveChat = useChatStore((state) => state.activeChat);
  const activeChat = propAgentId || storeActiveChat;

  const chatTraces = activeChat ? traceEntries.get(activeChat) || [] : [];

  const { expandedItems, toggleExpanded, getRowHeight, listRef } = useVirtualScrollState(
    chatTraces,
    (entry) => entry.id,
    (entry, isExpanded) => {
      // Base height for collapsed entry (2 lines: time + snippet)
      const baseHeight = 60;
      // Additional height when expanded (full JSON)
      const expandedHeight = isExpanded
        ? Math.min(
            // Estimate: ~15px per line of JSON, with a minimum of 100px
            Math.max(100, JSON.stringify(entry.message, null, 2).split('\n').length * 15),
            // Cap at 600px to prevent extremely tall entries
            600
          )
        : 0;
      return baseHeight + expandedHeight;
    }
  );

  useEffect(() => {
    // Scroll to bottom when new traces are added
    if (listRef.current && chatTraces.length > 0) {
      listRef.current.scrollToItem(chatTraces.length - 1, 'end');
    }
  }, [chatTraces.length, listRef]);

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getMessageSnippet = (message: any): string => {
    try {
      const json = JSON.stringify(message);
      return json.length > 100 ? json.substring(0, 100) + '...' : json;
    } catch (error) {
      return '[Unable to stringify message]';
    }
  };

  const formatMessage = (message: any): string => {
    try {
      // Use custom replacer to handle circular references and limit string length
      const seen = new WeakSet();
      const MAX_STRING_LENGTH = 10000; // Limit individual string values to 10k chars

      const replacer = (_key: string, value: any) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular Reference]';
          }
          seen.add(value);
        }
        // Truncate very long string values
        if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
          return (
            value.substring(0, MAX_STRING_LENGTH) +
            `... [truncated ${value.length - MAX_STRING_LENGTH} chars]`
          );
        }
        return value;
      };

      const formatted = JSON.stringify(message, replacer, 2);

      // If the entire JSON is extremely large, add a warning
      if (formatted.length > 100000) {
        return (
          formatted.substring(0, 100000) + '\n\n... [Message truncated - total size exceeds 100KB]'
        );
      }

      return formatted;
    } catch (error) {
      return `[Error formatting message: ${error}]`;
    }
  };

  if (chatTraces.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No trace messages yet
      </div>
    );
  }

  const TraceRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const entry = chatTraces[index];
    const isExpanded = expandedItems.has(entry.id);

    const handleContentMouseDown = (e: React.MouseEvent) => {
      e.stopPropagation();
    };

    const handleContentClick = (e: React.MouseEvent) => {
      e.stopPropagation();
    };

    return (
      <div style={style} className="border-b border-border">
        {/* Header: time, direction icon, tags, chevron - clickable to expand/collapse */}
        <div
          className="flex items-center gap-2 px-1.5 py-0.5 cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => toggleExpanded(entry.id)}
        >
          <span className="text-xs font-mono flex-shrink-0 min-w-[60px]">
            {formatTimestamp(entry.timestamp)}
          </span>
          {entry.direction === 'to' ? (
            <ArrowUpRight className="h-3 w-3 text-blue-500 flex-shrink-0" />
          ) : (
            <ArrowDownRight className="h-3 w-3 text-green-500 flex-shrink-0" />
          )}
          {entry.message.type && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-background border border-border flex-shrink-0">
              {entry.message.type}
            </span>
          )}
          {entry.message.subtype && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-background border border-border flex-shrink-0">
              {entry.message.subtype}
            </span>
          )}
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 flex-shrink-0 ml-auto" />
          ) : (
            <ChevronRight className="h-3 w-3 flex-shrink-0 ml-auto" />
          )}
        </div>

        {/* Content: message snippet or full JSON (not clickable, copyable) */}
        {isExpanded ? (
          <div
            className="px-1.5 py-0.5"
            onMouseDown={handleContentMouseDown}
            onClick={handleContentClick}
          >
            <div className="h-[580px] overflow-auto border border-border rounded-md bg-muted/30">
              <pre
                className="text-xs font-mono p-2 whitespace-pre-wrap break-words"
                style={{ userSelect: 'text' }}
              >
                <code>{formatMessage(entry.message)}</code>
              </pre>
            </div>
          </div>
        ) : (
          <div className="px-1.5 py-0.5">
            <span className="text-xs font-mono text-muted-foreground truncate block">
              {getMessageSnippet(entry.message)}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full" style={{ userSelect: 'text' }}>
      <List
        ref={listRef}
        height={window.innerHeight - 200} // Adjust based on container
        itemCount={chatTraces.length}
        itemSize={getRowHeight}
        width="100%"
      >
        {TraceRow}
      </List>
    </div>
  );
};
