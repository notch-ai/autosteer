import React, { useState } from 'react';
import { Button } from './Button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Icon, IconName } from './Icon';
import { cn } from '@/commons/utils';

export interface IconButtonProps {
  icon: IconName;
  tooltip?: string;
  onClick?: () => void;
  className?: string;
  size?: 'small' | 'medium' | 'large';
  // For dropdown behavior
  dropdown?: {
    options: Array<{
      value: string;
      label: string;
      icon?: IconName;
    }>;
    value?: string;
    onChange: (value: string) => void;
  };
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  tooltip,
  onClick,
  className = '',
  size = 'medium',
  dropdown,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  // Map legacy sizes to UI button sizes
  const buttonSizeMap = {
    small: 'icon-sm' as const,
    medium: 'icon' as const,
    large: 'icon-lg' as const,
  };

  const handleClick = () => {
    if (dropdown) {
      setIsDropdownOpen(!isDropdownOpen);
    } else if (onClick) {
      onClick();
    }
  };

  const handleDropdownSelect = (value: string) => {
    dropdown?.onChange(value);
    setIsDropdownOpen(false);
  };

  const handleOpenChange = (open: boolean) => {
    setIsDropdownOpen(open);
    // Blur the button when the popover closes to remove focus ring
    if (!open && buttonRef.current) {
      buttonRef.current.blur();
    }
  };

  if (dropdown) {
    return (
      <Popover open={isDropdownOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            ref={buttonRef}
            variant="ghost"
            size={buttonSizeMap[size]}
            leftIcon={<Icon name={icon} />}
            className={className}
            title={tooltip}
            aria-label={tooltip}
            onClick={handleClick}
          />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2 bg-background border border-border" align="start">
          <div className="space-y-1">
            {dropdown.options.map((option) => {
              const isActive = dropdown.value === option.value;
              return (
                <Button
                  key={option.value}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDropdownSelect(option.value)}
                  className={cn(
                    'w-full justify-start',
                    isActive && 'bg-surface-active text-primary'
                  )}
                >
                  {option.icon && <Icon name={option.icon} size={16} />}
                  <span className="ml-2">{option.label}</span>
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Button
      variant="ghost"
      size={buttonSizeMap[size]}
      leftIcon={<Icon name={icon} />}
      className={className}
      title={tooltip}
      aria-label={tooltip}
      onClick={onClick}
    />
  );
};
