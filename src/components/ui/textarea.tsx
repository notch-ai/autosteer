import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../../commons/utils';

const textareaVariants = cva(
  [
    // Base styles matching chat input
    'flex w-full rounded-lg text-sm',
    'px-3 py-2',
    'text-text',
    'transition-shadow duration-150', // Only transition shadow
    'placeholder:text-text-muted',
    // Disabled styles
    'disabled:cursor-default disabled:opacity-60',
    // Default resize behavior
    'resize-y',
  ],
  {
    variants: {
      variant: {
        default: [
          // Chat input style as default
          'border border-border', // Gray border like input
          'bg-background', // White background
          'outline-none', // No outline ever
          'ring-0', // No ring ever
          'shadow-none', // No shadow by default
          'focus:shadow-xs', // Shadow only when active
          'focus-visible:ring-0', // No focus-visible ring
          // No hover effect
        ],
        filled: 'bg-surface border border-border',
        ghost: 'bg-transparent border-transparent',
      },
      size: {
        sm: 'min-h-15 text-sm',
        default: 'min-h-20 text-sm',
        lg: 'min-h-30 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <textarea
        className={cn(textareaVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea, textareaVariants };
