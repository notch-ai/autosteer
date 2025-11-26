/**
 * useFontSizeVariables hook - Inject CSS variables for font size configuration
 * Reads fontSize from settings store and injects it into document CSS variables
 * Pattern matches useFontVariables.ts for consistency
 *
 * Uses a modular type scale based on rem units (root em) for consistent scaling:
 * - rem units are always relative to the root <html> element
 * - Prevents inheritance issues where em compounds based on parent font sizes
 * - Ensures consistent font sizes throughout the entire application
 *
 * Scale:
 * - xs: 0.75rem (75% of base) - small labels, captions
 * - sm: 0.875rem (87.5% of base) - secondary text, small buttons
 * - base: 1rem (100% of base) - body text, primary content
 * - md: 1.125rem (112.5% of base) - emphasized text
 * - lg: 1.25rem (125% of base) - subheadings
 * - xl: 1.5rem (150% of base) - headings
 * - 2xl: 1.875rem (187.5% of base) - large headings
 * - 3xl: 2.25rem (225% of base) - hero text
 *
 * Base sizes: small=12px, medium=13px, large=14px
 */

import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settings';

// Font size mapping - base sizes in pixels
const FONT_SIZE_BASE_MAP: Record<'small' | 'medium' | 'large', number> = {
  small: 12,
  medium: 13,
  large: 14,
};

export const useFontSizeVariables = (): void => {
  const fontSize = useSettingsStore((state) => state.preferences.fontSize);

  useEffect(() => {
    if (!fontSize) return;

    // Get base font size in pixels
    const baseSizePx = FONT_SIZE_BASE_MAP[fontSize];

    // Set root font size on <html> element - this defines what 1rem equals
    // All rem-based sizes will be calculated from this root value
    const root = document.documentElement;
    root.style.fontSize = `${baseSizePx}px`;

    // Calculate all font sizes using rem units (relative to root)
    // Using rem ensures consistent sizing across all nesting levels
    root.style.setProperty('--font-size-xs', `${baseSizePx * 0.75}px`); // 75% of base
    root.style.setProperty('--font-size-sm', `${baseSizePx * 0.875}px`); // 87.5% of base
    root.style.setProperty('--font-size-base', `${baseSizePx}px`); // 100% of base
    root.style.setProperty('--font-size-md', `${baseSizePx * 1.125}px`); // 112.5% of base
    root.style.setProperty('--font-size-lg', `${baseSizePx * 1.25}px`); // 125% of base
    root.style.setProperty('--font-size-xl', `${baseSizePx * 1.5}px`); // 150% of base
    root.style.setProperty('--font-size-2xl', `${baseSizePx * 1.875}px`); // 187.5% of base
    root.style.setProperty('--font-size-3xl', `${baseSizePx * 2.25}px`); // 225% of base

    console.log(
      '[useFontSizeVariables] Font size CSS variables injected with base:',
      `${baseSizePx}px`,
      '(set on html root)'
    );
  }, [fontSize]);
};
