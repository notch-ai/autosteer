/**
 * useFontVariables hook - Inject CSS variables for font configuration
 * Reads fontFamily from settings store and injects it into document CSS variables
 */

import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settings';

export const useFontVariables = (): void => {
  const fontFamily = useSettingsStore((state) => state.preferences.fontFamily);

  useEffect(() => {
    if (!fontFamily) return;

    // Inject CSS variable into document root
    // This overrides the default value in tailwind-tokens.css
    const root = document.documentElement;
    root.style.setProperty('--font-family-mono', fontFamily);

    console.log('[useFontVariables] Font CSS variable injected:', fontFamily);
  }, [fontFamily]);
};
