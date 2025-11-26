import { cn } from '@/commons/utils';
import { logger } from '@/commons/utils/logger';
import { Button } from '@/components/ui/button';
import { StatusDisplay } from '@/features/shared/components/agent/StatusDisplay';
import { TraceTab } from '@/features/monitoring/components/TraceTab';
import React, { useState } from 'react';

interface MaximizeSessionTabProps {
  isActive: boolean;
}

type SubTabType = 'status' | 'trace';

export const MaximizeSessionTab: React.FC<MaximizeSessionTabProps> = ({ isActive }) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('status');

  const handleSubTabChange = (subTab: SubTabType) => {
    logger.debug('[MaximizeSessionTab] Switching sub-tab', {
      from: activeSubTab,
      to: subTab,
    });
    setActiveSubTab(subTab);
  };

  const subTabs: SubTabType[] = ['status', 'trace'];

  return (
    <div
      className={cn('absolute inset-0 flex flex-col bg-background', {
        'z-10 opacity-100': isActive,
        'z-0 opacity-0 pointer-events-none': !isActive,
      })}
    >
      {/* Lined Tabs Navigation */}
      <div className="border-b border-border">
        <nav className="flex space-x-8 px-6" aria-label="Maximize view tabs">
          {subTabs.map((tab) => (
            <Button
              key={tab}
              variant="ghost"
              onClick={() => handleSubTabChange(tab)}
              className={cn(
                'border-b-2 rounded-none py-4 px-1 text-sm font-medium transition-colors hover:bg-transparent',
                activeSubTab === tab
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Button>
          ))}
        </nav>
      </div>

      {/* Sub-tab Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeSubTab === 'status' && <StatusDisplay />}
        {activeSubTab === 'trace' && <TraceTab />}
      </div>
    </div>
  );
};
