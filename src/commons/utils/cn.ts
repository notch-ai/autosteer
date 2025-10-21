import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility for merging Tailwind CSS classes with proper precedence
 *
 * Combines:
 * - clsx for conditional classes and complex class logic
 * - tailwind-merge to handle conflicts (later classes win)
 *
 * @param inputs - Array of class values (strings, objects, arrays, etc.)
 * @returns Merged className string with proper Tailwind precedence
 *
 * @example
 * ```tsx
 * // Basic usage
 * cn('px-4 py-2', 'px-6') // → 'py-2 px-6' (px-6 wins)
 *
 * // Conditional classes
 * cn('bg-red-500', condition && 'bg-blue-500') // → conditional classes
 *
 * // Complex conditions
 * cn(['text-sm', 'font-bold'], { 'opacity-50': isDisabled }) // → complex conditions
 *
 * // Component with variants
 * cn(
 *   'rounded transition-colors', // base classes
 *   variant === 'primary' && 'bg-primary text-white',
 *   variant === 'secondary' && 'bg-surface text-text',
 *   size === 'sm' && 'px-3 py-1.5 text-sm',
 *   size === 'lg' && 'px-6 py-3 text-lg',
 *   className // allow overrides
 * )
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
