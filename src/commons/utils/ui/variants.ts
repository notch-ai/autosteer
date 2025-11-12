import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Button component variants using class-variance-authority
 *
 * This defines all possible button styles as a type-safe variant system.
 * Each variant combination generates the appropriate Tailwind classes.
 */
export const buttonVariants = cva(
  // Base classes applied to all button variants
  [
    'inline-flex items-center justify-center rounded font-medium',
    'transition-colors duration-fast',
    'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
  ],
  {
    variants: {
      variant: {
        primary: ['bg-primary hover:bg-primary-light text-background', 'shadow-sm hover:shadow-md'],
        secondary: [
          'bg-surface hover:bg-surface-hover text-text',
          'border border-border hover:border-primary',
        ],
        ghost: ['hover:bg-surface hover:text-text', 'text-text-muted hover:text-text'],
        danger: ['bg-danger hover:bg-red-600 text-white', 'shadow-sm hover:shadow-md'],
        success: ['bg-success hover:bg-green-600 text-white', 'shadow-sm hover:shadow-md'],
        warning: ['bg-warning hover:bg-orange-600 text-white', 'shadow-sm hover:shadow-md'],
        info: ['bg-info hover:bg-blue-600 text-white', 'shadow-sm hover:shadow-md'],
        outline: ['border border-border hover:bg-surface', 'text-text hover:text-text'],
        link: ['text-primary hover:text-primary-light underline-offset-4', 'hover:underline'],
      },
      size: {
        sm: ['h-8 px-3 text-sm', 'gap-1'],
        md: ['h-10 px-4 text-base', 'gap-2'],
        lg: ['h-12 px-6 text-lg', 'gap-2'],
        icon: ['h-10 w-10 p-0', 'shrink-0'],
        'icon-sm': ['h-8 w-8 p-0', 'shrink-0'],
        'icon-lg': ['h-12 w-12 p-0', 'shrink-0'],
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

/**
 * Input component variants
 */
export const inputVariants = cva(
  [
    'flex w-full rounded border border-border bg-surface',
    'px-sm py-xs text-base text-text',
    'placeholder:text-text-muted',
    'transition-colors duration-fast',
    'focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ],
  {
    variants: {
      size: {
        sm: ['h-8 px-2 py-1 text-sm'],
        md: ['h-10 px-sm py-xs text-base'],
        lg: ['h-12 px-md py-sm text-lg'],
      },
      variant: {
        default: [],
        error: [
          'border-danger focus:border-danger focus:ring-danger',
          'text-danger placeholder:text-red-400',
        ],
        success: ['border-success focus:border-success focus:ring-success', 'text-success'],
        warning: ['border-warning focus:border-warning focus:ring-warning', 'text-warning'],
      },
    },
    defaultVariants: {
      size: 'md',
      variant: 'default',
    },
  }
);

/**
 * Badge component variants
 */
export const badgeVariants = cva(
  [
    'inline-flex items-center rounded-full border px-xs py-2xs',
    'text-sm font-medium transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
  ],
  {
    variants: {
      variant: {
        default: ['border-transparent bg-surface-hover text-text-muted', 'hover:bg-surface'],
        secondary: ['border-transparent bg-surface text-text', 'hover:bg-surface-hover'],
        success: ['border-transparent bg-success text-white', 'hover:bg-green-600'],
        danger: ['border-transparent bg-danger text-white', 'hover:bg-red-600'],
        warning: ['border-transparent bg-warning text-white', 'hover:bg-orange-600'],
        info: ['border-transparent bg-info text-white', 'hover:bg-blue-600'],
        outline: ['border-border text-text', 'hover:bg-surface'],
      },
      size: {
        sm: ['px-1 py-0.5 text-sm'],
        md: ['px-xs py-2xs text-sm'],
        lg: ['px-sm py-xs text-sm'],
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

/**
 * Card component variants
 */
export const cardVariants = cva(
  ['rounded-lg border border-border bg-surface text-text', 'transition-all duration-base'],
  {
    variants: {
      variant: {
        default: [],
        elevated: ['shadow-md'],
        interactive: [
          'cursor-pointer hover:bg-surface-hover',
          'hover:shadow-md hover:-translate-y-px',
        ],
        outline: ['border-2'],
      },
      size: {
        sm: ['p-sm'],
        md: ['p-md'],
        lg: ['p-lg'],
        xl: ['p-xl'],
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

/**
 * Alert component variants
 */
export const alertVariants = cva(
  ['relative w-full rounded border px-md py-sm', 'flex items-start gap-sm'],
  {
    variants: {
      variant: {
        default: ['bg-surface border-border text-text'],
        success: ['bg-green-opacity-10 border-success text-success', '[&>svg]:text-success'],
        danger: ['bg-red-opacity-10 border-danger text-danger', '[&>svg]:text-danger'],
        warning: ['bg-orange-opacity-10 border-warning text-warning', '[&>svg]:text-warning'],
        info: ['bg-blue-opacity-10 border-info text-info', '[&>svg]:text-info'],
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

/**
 * Export variant prop types for TypeScript inference
 */
export type ButtonVariants = VariantProps<typeof buttonVariants>;
export type InputVariants = VariantProps<typeof inputVariants>;
export type BadgeVariants = VariantProps<typeof badgeVariants>;
export type CardVariants = VariantProps<typeof cardVariants>;
export type AlertVariants = VariantProps<typeof alertVariants>;
