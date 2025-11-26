import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../commons/utils';

const inputVariants = cva(
  [
    // Base styles matching create worktree modal
    'w-full',
    'px-3 py-2',
    'border border-border rounded',
    'text-foreground text-sm',
    'transition-all duration-150',
    'outline-none',
    // Focus styles - clean without ring
    'focus:outline-none',
    // Disabled styles
    'disabled:cursor-default disabled:text-muted-foreground disabled:opacity-50',
    // Placeholder
    'placeholder:text-muted-foreground',
    // File input styles
    'file:border-0 file:bg-transparent file:text-sm file:font-medium',
  ],
  {
    variants: {
      variant: {
        default: '', // No hover border change
        filled: 'bg-card-hover',
        ghost: 'bg-transparent border-transparent',
      },
      size: {
        sm: 'h-8 px-2 py-1 text-sm',
        default: 'h-10 px-3 py-2 text-sm',
        lg: 'h-12 px-4 py-3 text-base',
      },
      state: {
        default: '',
        error: 'border-error focus:border-error',
        success: 'border-success focus:border-success',
      },
      hasValue: {
        true: 'bg-background',
        false: 'bg-card',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      state: 'default',
      hasValue: false,
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      variant,
      size,
      state,
      hasValue: hasValueProp,
      leftIcon,
      rightIcon,
      value,
      defaultValue,
      disabled,
      readOnly,
      onChange,
      ...props
    },
    ref
  ) => {
    // Track internal value for uncontrolled inputs
    const [internalValue, setInternalValue] = React.useState(defaultValue || '');

    // Handle onChange to track internal value
    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setInternalValue(e.target.value);
        onChange?.(e);
      },
      [onChange]
    );

    // Determine if input has value
    const hasValue =
      hasValueProp !== undefined
        ? hasValueProp
        : value !== undefined
          ? value !== null && value !== ''
          : internalValue !== '';

    // Build the final className
    const inputClassName = cn(
      inputVariants({ variant, size, state, hasValue }),
      // Handle disabled/readonly background
      (disabled || readOnly) && 'bg-card',
      className
    );

    if (leftIcon || rightIcon) {
      return (
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            ref={ref}
            value={value}
            defaultValue={defaultValue}
            onChange={handleChange}
            disabled={disabled}
            readOnly={readOnly}
            className={cn(inputClassName, leftIcon && 'pl-10', rightIcon && 'pr-10')}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              {rightIcon}
            </div>
          )}
        </div>
      );
    }

    return (
      <input
        type={type}
        ref={ref}
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        disabled={disabled}
        readOnly={readOnly}
        className={inputClassName}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input, inputVariants };
