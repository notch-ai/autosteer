import React, { useRef, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import type { IconName } from './Icon';
import { Icon } from './Icon';

// Legacy interface for backward compatibility
export interface DropdownOption<T extends string = string> {
  value: T;
  label: string;
  icon?: IconName;
}

interface DropdownSelectorProps<T extends string = string> {
  options: DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  buttonIcon?: IconName;
  buttonTooltip?: string;
  className?: string;
  buttonClassName?: string;
  modalClassName?: string;
  buttonContent?: React.ReactNode;
}

/**
 * Legacy DropdownSelector component that preserves the original API while using the new UI dropdown internally.
 * This maintains backward compatibility for existing code while leveraging the new shadcn/ui components.
 */
export function DropdownSelector<T extends string = string>({
  options,
  value,
  onChange,
  buttonIcon,
  buttonTooltip,
  buttonClassName,
  modalClassName: _modalClassName = '',
  buttonContent,
}: DropdownSelectorProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const currentOption = options.find((opt) => opt.value === value);

  const handleSelect = (newValue: T) => {
    onChange(newValue);
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          ref={buttonRef}
          aria-label={buttonTooltip}
          data-tooltip={buttonTooltip}
          className={buttonClassName}
        >
          {buttonContent || (
            <Icon
              name={buttonIcon || currentOption?.icon || 'chevron-down'}
              className="text-text-muted hover:text-text"
            />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="py-1">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => handleSelect(option.value)}
            className="flex items-center gap-2 cursor-pointer"
          >
            {option.icon && (
              <span className="text-text-muted">
                <Icon name={option.icon} size={16} />
              </span>
            )}
            <span>{option.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
