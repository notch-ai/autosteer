import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatStore } from '@/stores';
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronRight } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

export const TraceTab: React.FC = () => {
  const traceEntries = useChatStore((state) => state.traceEntries);
  const activeChat = useChatStore((state) => state.activeChat);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  const chatTraces = activeChat ? traceEntries.get(activeChat) || [] : [];

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [chatTraces.length]);

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

  const toggleExpanded = (id: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (chatTraces.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        No trace messages yet
      </div>
    );
  }

  return (
    <ScrollArea ref={scrollAreaRef} className="h-full">
      <div className="space-y-0">
        {chatTraces.map((entry) => {
          const isExpanded = expandedEntries.has(entry.id);
          return (
            <div key={entry.id} className="border-b border-border last:border-b-0">
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
                  <pre className="text-[10px] font-mono p-2 overflow-x-auto flex-1">
                    <code>{JSON.stringify(entry.message, null, 2)}</code>
                  </pre>
                ) : (
                  <span className="text-[10px] font-mono truncate flex-1">
                    {getMessageSnippet(entry.message)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
};
