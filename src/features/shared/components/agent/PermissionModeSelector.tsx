import { cn } from '@/commons/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PERMISSION_MODES, PermissionMode } from '@/types/permission.types';
import React, { useState } from 'react';
import type { IconName } from '@/features/shared/components/ui/Icon';
import { Icon } from '@/features/shared/components/ui/Icon';

interface PermissionModeSelectorProps {
  mode: PermissionMode;
  onChange: (mode: PermissionMode) => void;
  className?: string;
  disabled?: boolean;
}

export const PermissionModeSelector: React.FC<PermissionModeSelectorProps> = ({
  mode,
  onChange,
  className,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentMode = PERMISSION_MODES.find((m) => m.value === mode) || PERMISSION_MODES[1]; // Default to Edit

  const handleModeChange = (newMode: PermissionMode) => {
    onChange(newMode);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="icon-secondary"
          size="icon"
          disabled={disabled}
          className={className}
          title={`Permission: ${currentMode.label}`}
        >
          <Icon name={currentMode.icon as IconName} size={15} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2 bg-background border border-border" align="start">
        <div className="space-y-1">
          {PERMISSION_MODES.map((option) => {
            const isActive = mode === option.value;
            return (
              <Button
                key={option.value}
                variant="ghost"
                size="sm"
                onClick={() => handleModeChange(option.value)}
                className={cn('w-full justify-start', isActive && 'bg-surface-active text-primary')}
              >
                <Icon name={option.icon as IconName} size={16} />
                <span className="ml-2">{option.label}</span>
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};
