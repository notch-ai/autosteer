import { cn } from '@/commons/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MODEL_OPTIONS, ModelOption } from '@/types/model.types';
import React, { useState } from 'react';

interface ModelSelectorProps {
  model: ModelOption;
  onChange: (model: ModelOption) => void;
  disabled?: boolean;
  className?: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  model,
  onChange,
  disabled = false,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentModel = MODEL_OPTIONS.find((m) => m.value === model) || MODEL_OPTIONS[2]; // Default to Sonnet 4

  const handleModelChange = (newModel: ModelOption) => {
    onChange(newModel);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn(
            'text-sm font-medium text-text-muted hover:text-text h-9 w-[88px]',
            className
          )}
          title={`Model: ${currentModel.label}`}
        >
          {currentModel.label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2 bg-background border border-border" align="start">
        <div className="space-y-1">
          {MODEL_OPTIONS.map((option) => {
            const isActive = model === option.value;
            return (
              <Button
                key={option.value}
                variant="ghost"
                size="sm"
                onClick={() => handleModelChange(option.value)}
                className={cn('w-full justify-start', isActive && 'bg-surface-active text-primary')}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};
