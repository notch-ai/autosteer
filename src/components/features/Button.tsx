import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Button as UIButton, type ButtonProps as UIButtonProps } from '../ui/button';
import { cn } from '../../commons/utils/cn';
import { Loader2 } from 'lucide-react';

// Legacy button variants for backward compatibility
const buttonVariants = cva(
  // Base styles that match the global button styles
  [
    // Layout & Display
    'inline-flex items-center justify-center gap-2',
    // Typography
    'font-medium text-sm leading-none select-none no-underline',
    // Spacing
    'px-4 py-2',
    // Border
    'border border-transparent',
    // Border radius (using Tailwind's rounded-md which is 6px)
    'rounded-md',
    // Interaction
    'cursor-pointer transition-all duration-150',
    // Position for ripple effect
    'relative overflow-hidden',
    // Focus states
    'focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2',
    // Active state
    'active:translate-y-px',
    // Disabled state
    'disabled:opacity-50 disabled:cursor-default disabled:transform-none',
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-primary text-background',
          'hover:bg-primary-hover hover:shadow-sm',
          'disabled:hover:bg-primary disabled:hover:shadow-none',
        ],
        secondary: ['bg-surface text-text', 'hover:bg-surface-hover', 'disabled:hover:bg-surface'],
        ghost: [
          'bg-transparent text-text',
          'hover:bg-surface-hover',
          'disabled:hover:bg-transparent',
        ],
        danger: ['bg-danger text-white', 'hover:bg-danger/90', 'disabled:hover:bg-danger'],
      },
      size: {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base',
        icon: 'p-0 w-8 h-8',
        'icon-sm': 'p-0 w-6 h-6 min-h-6',
        'icon-lg': 'p-0 w-10 h-10 min-h-10',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'md',
    },
  }
);

// Enhanced button interface with icons and loading state
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
  loadingText?: string;
}

// Map legacy variants to new UI component variants
const mapVariantToUI = (variant: ButtonProps['variant']): UIButtonProps['variant'] => {
  switch (variant) {
    case 'primary':
      return 'primary';
    case 'secondary':
      return 'secondary';
    case 'ghost':
      return 'ghost';
    case 'danger':
      return 'destructive';
    default:
      return 'ghost';
  }
};

// Map legacy sizes to new UI component sizes
const mapSizeToUI = (size: ButtonProps['size']): UIButtonProps['size'] => {
  switch (size) {
    case 'sm':
      return 'sm';
    case 'md':
      return 'default';
    case 'lg':
      return 'lg';
    case 'icon':
      return 'icon';
    case 'icon-sm':
      return 'icon-sm';
    case 'icon-lg':
      return 'icon-lg';
    default:
      return 'default';
  }
};

/**
 * Enhanced Button component with icons and loading state.
 * Extends the shadcn/ui button with additional features while maintaining backward compatibility.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      leftIcon,
      rightIcon,
      loading,
      loadingText,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    // Convert legacy variant and size to new UI component props
    const uiVariant = mapVariantToUI(variant);
    const uiSize = mapSizeToUI(size);

    // Determine disabled state (disabled or loading)
    const isDisabled = disabled || loading;

    return (
      <UIButton
        ref={ref}
        variant={uiVariant}
        size={uiSize}
        asChild={asChild}
        disabled={isDisabled}
        className={cn(className)}
        {...props}
      >
        {/* Loading spinner or left icon */}
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {!loading && leftIcon && <span className="mr-2">{leftIcon}</span>}

        {/* Content */}
        {loading && loadingText ? loadingText : children}

        {/* Right icon */}
        {!loading && rightIcon && <span className="ml-2">{rightIcon}</span>}
      </UIButton>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
