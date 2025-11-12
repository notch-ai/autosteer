import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatStore } from '@/stores';
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronRight } from 'lucide-react';
import React, { useEffect } from 'react';
import { VariableSizeList as List } from 'react-window';
import { useVirtualScrollState } from '@/hooks';

export const TraceTab: React.FC = () => {
  const traceEntries = useChatStore((state) => state.traceEntries);
  const activeChat = useChatStore((state) => state.activeChat);

  const chatTraces = activeChat ? traceEntries.get(activeChat) || [] : [];

  const { expandedItems, toggleExpanded, getRowHeight, listRef } = useVirtualScrollState(
    chatTraces,
    (entry) => entry.id,
    (entry, isExpanded) => {
      // Base height for collapsed entry (2 lines: time + snippet)
      const baseHeight = 60;
      // Additional height when expanded (full JSON)
      const expandedHeight = isExpanded ? Math.min(entry.message ? 300 : 100, 500) : 0;
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
    const json = JSON.stringify(message);
    return json.length > 100 ? json.substring(0, 100) + '...' : json;
  };

  if (chatTraces.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        No trace messages yet
      </div>
    );
  }

  const TraceRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const entry = chatTraces[index];
    const isExpanded = expandedItems.has(entry.id);

    return (
      <div style={style} className="border-b border-border">
        {/* First line: time, direction icon, tags */}
        <div className="flex items-center gap-2 px-1.5 py-0.5">
          <span className="text-[10px] font-mono flex-shrink-0 min-w-[60px]">
            {formatTimestamp(entry.timestamp)}
          </span>
          {entry.direction === 'to' ? (
            <ArrowUpRight className="h-3 w-3 text-blue-500 flex-shrink-0" />
          ) : (
            <ArrowDownRight className="h-3 w-3 text-green-500 flex-shrink-0" />
          )}
          {entry.message.type && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border flex-shrink-0">
              {entry.message.type}
            </span>
          )}
          {entry.message.subtype && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border flex-shrink-0">
              {entry.message.subtype}
            </span>
          )}
        </div>

        {/* Second line: chevron + message snippet or full JSON */}
        <div
          className="flex items-start gap-2 px-1.5 py-0.5 cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => toggleExpanded(entry.id)}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 flex-shrink-0 mt-0.5" />
          ) : (
            <ChevronRight className="h-3 w-3 flex-shrink-0 mt-0.5" />
          )}
          {isExpanded ? (
            <ScrollArea className="max-h-[400px] flex-1">
              <pre className="text-[10px] font-mono p-2">
                <code>{JSON.stringify(entry.message, null, 2)}</code>
              </pre>
            </ScrollArea>
          ) : (
            <span className="text-[10px] font-mono truncate flex-1">
              {getMessageSnippet(entry.message)}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full">
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
