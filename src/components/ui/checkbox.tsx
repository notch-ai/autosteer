'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { FaCheck } from 'react-icons/fa';
import { useTheme } from '@/commons/contexts/ThemeContext';

import { cn } from '@/commons/utils';

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => {
  const { activeTheme } = useTheme();
  const isNightMode = activeTheme === 'dark';

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        // AutoSteer styling - matching desktop app aesthetics with larger padding
        'peer h-5 w-5 shrink-0 rounded-sm border ring-offset-background',
        'border-gray-400 bg-white', // More visible gray border when unchecked
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'disabled:cursor-default disabled:opacity-50',
        // Conditional styling based on theme
        {
          // Day theme: primary bg with white check
          'data-[state=checked]:bg-primary data-[state=checked]:text-white data-[state=checked]:border-primary':
            !isNightMode,
          // Night theme: white bg with black check
          'data-[state=checked]:bg-white data-[state=checked]:text-black data-[state=checked]:border-gray-400':
            isNightMode,
        },
        'hover:border-gray-500 transition-colors duration-150',
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className={cn('flex items-center justify-center text-current')}>
        <FaCheck className="h-3 w-3" style={{ strokeWidth: 2 }} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
