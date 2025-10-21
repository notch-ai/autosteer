import { useEffect } from 'react';

/**
 * Hook to handle ESC key press to close modals
 * @param onClose - Function to call when ESC is pressed
 * @param isDisabled - Optional flag to disable the ESC handler (e.g., while saving)
 */
export function useModalEscape(onClose: () => void, isDisabled = false): void {
  useEffect(() => {
    if (isDisabled) return () => {}; // Return empty cleanup function

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, isDisabled]);
}
