import React, { useState } from 'react';
import { logger } from '@/commons/utils/logger';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/commons/utils';

export type EditorMode = 'Plan' | 'Edit';

interface PlanEditModeIndicatorProps {
  className?: string;
  editMode?: boolean;
  onEditModeChange?: (mode: boolean) => void;
}

const modeOptions = [
  { value: true, label: 'Edit' },
  { value: false, label: 'Plan' },
];

export const PlanEditModeIndicator: React.FC<PlanEditModeIndicatorProps> = ({
  editMode = true,
  onEditModeChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const mode: EditorMode = editMode ? 'Edit' : 'Plan';

  const handleModeChange = (newEditMode: boolean) => {
    logger.debug(`Editor mode changed to: ${newEditMode ? 'Edit' : 'Plan'}`);
    onEditModeChange?.(newEditMode);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="icon-secondary"
          size="icon"
          title={`Current mode: ${mode}. Click to change.`}
          aria-label={`Current mode: ${mode}. Click to switch between Plan and Edit modes.`}
        >
          <span className="text-sm font-medium">{mode}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2 bg-background border border-border" align="start">
        <div className="space-y-1">
          {modeOptions.map((option) => {
            const isActive = editMode === option.value;
            return (
              <Button
                key={option.label}
                variant="ghost"
                size="sm"
                onClick={() => handleModeChange(option.value)}
                className={cn('w-full justify-start', isActive && 'bg-card-active text-primary')}
              >
                <span>{option.label}</span>
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};
