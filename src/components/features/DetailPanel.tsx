import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, Info } from 'lucide-react';
import React from 'react';
import { StatusDisplay } from './StatusDisplay';
import { TodoActivityTracker } from './TodoActivityTracker';
import { TraceTab } from './TraceTab';

interface DetailPanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const DetailPanel: React.FC<DetailPanelProps> = ({ collapsed, onToggleCollapse }) => {
  if (collapsed) {
    return (
      <aside className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Button
            variant="icon-secondary"
            size="icon"
            onClick={onToggleCollapse}
            aria-label="Expand Task Manager"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col items-center gap-4 mt-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Session Info"
              onClick={onToggleCollapse}
            >
              <Info className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="h-full flex flex-col">
      <Tabs defaultValue="todos" className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-1.5 border-b border-border px-2 pb-1">
          <TabsList className="inline-flex justify-start">
            <TabsTrigger value="todos" className="h-6 text-sm px-2.5 py-1">
              Todo
            </TabsTrigger>
            <TabsTrigger value="status" className="h-6 text-sm px-2.5 py-1">
              Status
            </TabsTrigger>
            <TabsTrigger value="trace" className="h-6 text-sm px-2.5 py-1">
              Trace
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="todos" className="flex-1 overflow-auto mt-0">
          <div className="py-2 px-3 h-full">
            <TodoActivityTracker />
          </div>
        </TabsContent>

        <TabsContent
          value="status"
          className="flex-1 overflow-y-auto overflow-x-hidden mt-0"
          tabIndex={-1}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
        >
          <div
            className="py-2 px-3 status-panel-wrapper"
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onMouseMove={(e) => e.stopPropagation()}
          >
            <StatusDisplay />
          </div>
        </TabsContent>

        <TabsContent value="trace" className="flex-1 overflow-auto mt-0">
          <div className="py-2 px-3 h-full">
            <TraceTab />
          </div>
        </TabsContent>
      </Tabs>
    </aside>
  );
};
