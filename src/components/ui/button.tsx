import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../../commons/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none',
  {
    variants: {
      variant: {
        // AutoSteer variants - matching the desktop app aesthetics
        default:
          'bg-button-special border border-border text-text hover:bg-surface-hover shadow-xs disabled:opacity-50',
        primary:
          'bg-button-special border border-border text-text hover:bg-surface-hover shadow-xs disabled:opacity-50', // Same as default
        secondary:
          'bg-surface text-text hover:bg-surface-hover border border-border disabled:opacity-50',
        ghost: 'bg-transparent text-text hover:bg-surface-hover disabled:opacity-50',
        destructive: 'bg-error text-white hover:bg-error/90 disabled:opacity-50',
        outline: 'border border-border bg-transparent hover:bg-surface-hover disabled:opacity-50',
        link: 'text-primary underline-offset-4 hover:underline disabled:opacity-50',
        // Brand variant - purple/blue gradient style
        brand:
          'bg-brand text-white hover:bg-brand-hover border-0 shadow-sm disabled:opacity-40 disabled:bg-brand/70',
        // Icon secondary - matches settings button style
        'icon-secondary':
          'bg-transparent text-text-muted hover:text-text hover:bg-surface-hover disabled:opacity-50',
        // Legacy variant mappings
        danger: 'bg-error text-white hover:bg-error/90 disabled:opacity-50', // Alias for destructive
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7 px-3 text-sm',
        lg: 'h-11 px-6 text-base',
        icon: 'h-9 w-9',
        'icon-sm': 'h-6 w-6',
        'icon-lg': 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, icon, iconPosition = 'left', children, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';

    const content = React.useMemo(() => {
      if (!icon) return children;

      // Icon is now a ReactNode, so we can use it directly
      const iconElement = icon;

      if (!children) return iconElement;

      return (
        <>
          {iconPosition === 'left' && (
            <>
              {iconElement}
              <span className="ml-2">{children}</span>
            </>
          )}
          {iconPosition === 'right' && (
            <>
              <span className="mr-2">{children}</span>
              {iconElement}
            </>
          )}
        </>
      );
    }, [icon, iconPosition, children]);

    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
        {content}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
