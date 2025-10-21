import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Input as UIInput, type InputProps as UIInputProps } from '../ui/input';
import { cn } from '../../commons/utils/cn';

// Legacy input variants for backward compatibility
const inputVariants = cva(
  [
    // Base styles
    'w-full',
    'px-3 py-2',
    'border border-border rounded',
    'text-text',
    'transition-all duration-fast',
    'outline-none',
    // Focus styles - removed border color changes
    'focus:outline-none',
    // Disabled styles
    'disabled:cursor-default disabled:text-text-muted',
    // Placeholder
    'placeholder:text-text-muted',
  ],
  {
    variants: {
      variant: {
        default: '',
        filled: 'bg-surface-hover',
        ghost: 'bg-transparent border-transparent hover:border-border',
      },
      size: {
        sm: 'px-2 py-1 text-sm',
        md: 'px-3 py-2 text-sm',
        lg: 'px-4 py-3 text-base',
      },
      state: {
        default: '',
        error: 'border-danger',
        success: 'border-success',
      },
      hasValue: {
        true: 'bg-background',
        false: 'bg-surface',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      state: 'default',
      hasValue: false,
    },
  }
);

// Legacy interface for backward compatibility
export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: boolean;
  success?: boolean;
}

// Map legacy variants to new UI component variants
const mapVariantToUI = (variant: InputProps['variant']): UIInputProps['variant'] => {
  switch (variant) {
    case 'default':
      return 'default';
    case 'filled':
      return 'filled';
    case 'ghost':
      return 'ghost';
    default:
      return 'default';
  }
};

// Map legacy sizes to new UI component sizes
const mapSizeToUI = (size: InputProps['size']): UIInputProps['size'] => {
  switch (size) {
    case 'sm':
      return 'sm';
    case 'md':
      return 'default';
    case 'lg':
      return 'lg';
    default:
      return 'default';
  }
};

// Map legacy states to new UI component states
const mapStateToUI = (state: InputProps['state']): UIInputProps['state'] => {
  switch (state) {
    case 'error':
      return 'error';
    case 'success':
      return 'success';
    default:
      return 'default';
  }
};

/**
 * Legacy Input component that preserves the original API while using the new UI input internally.
 * This maintains backward compatibility for existing code while leveraging the new shadcn/ui components.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant,
      size,
      state,
      hasValue: hasValueProp,
      leftIcon,
      rightIcon,
      error,
      success,
      value,
      disabled,
      readOnly,
      ...props
    },
    ref
  ) => {
    // Determine if input has value for hasValue prop compatibility
    const hasValue =
      hasValueProp !== undefined
        ? hasValueProp
        : value !== undefined && value !== null && value !== '';

    // Convert legacy props to new UI component props
    const uiVariant = mapVariantToUI(variant);
    const uiSize = mapSizeToUI(size);

    // Determine state from error/success props or explicit state prop
    const finalState = error ? 'error' : success ? 'success' : state;
    const uiState = mapStateToUI(finalState);

    return (
      <UIInput
        ref={ref}
        variant={uiVariant}
        size={uiSize}
        state={uiState}
        hasValue={hasValue}
        leftIcon={leftIcon}
        rightIcon={rightIcon}
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        className={cn(className)}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

// Legacy Textarea component using the same variants
export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      variant,
      size,
      state,
      hasValue: hasValueProp,
      resize = 'vertical',
      value,
      disabled,
      readOnly,
      ...props
    },
    ref
  ) => {
    const hasValue =
      hasValueProp !== undefined
        ? hasValueProp
        : value !== undefined && value !== null && value !== '';

    const resizeClasses = {
      none: 'resize-none',
      vertical: 'resize-y',
      horizontal: 'resize-x',
      both: 'resize',
    };

    return (
      <textarea
        ref={ref}
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        className={cn(
          inputVariants({ variant, size, state, hasValue }),
          resizeClasses[resize],
          (disabled || readOnly) && 'bg-surface',
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

// Legacy Select component with custom arrow
export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'>,
    VariantProps<typeof inputVariants> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, variant, size, state, children, value, disabled, ...props }, ref) => {
    const hasValue = value !== undefined && value !== null && value !== '';

    return (
      <div className="relative">
        <select
          ref={ref}
          value={value}
          disabled={disabled}
          className={cn(
            inputVariants({ variant, size, state, hasValue }),
            'appearance-none pr-10',
            disabled && 'bg-surface',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    );
  }
);
Select.displayName = 'Select';

export { Input, Textarea, Select, inputVariants };
