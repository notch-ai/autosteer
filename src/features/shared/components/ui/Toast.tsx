import React, { useEffect, useState } from 'react';
import { toast, toastSuccess, toastError, toastWarning, toastInfo } from '@/components/ui/sonner';

// Legacy types for backward compatibility
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  onDismiss: (id: string) => void;
}

/**
 * Legacy Toast component that preserves the original API while using the new UI sonner internally.
 * This maintains backward compatibility for existing code while leveraging the new shadcn/ui components.
 */
export const Toast: React.FC<ToastProps> = ({ id, message, type, duration = 5000, onDismiss }) => {
  const [, setIsExiting] = useState(false);

  useEffect(() => {
    // Use the new sonner toast system instead of custom implementation
    let toastId: string | number;

    switch (type) {
      case 'success':
        toastId = toastSuccess(message, { duration });
        break;
      case 'error':
        toastId = toastError(message, { duration });
        break;
      case 'warning':
        toastId = toastWarning(message, { duration });
        break;
      case 'info':
        toastId = toastInfo(message, { duration });
        break;
      default:
        toastId = toast(message, { duration });
    }

    // Handle dismissal
    const timer = setTimeout(() => {
      handleDismiss();
    }, duration);

    return () => {
      clearTimeout(timer);
      if (toastId) {
        toast.dismiss(toastId);
      }
    };
  }, [duration, message, type]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(id);
    }, 300); // Match animation duration
  };

  // For backward compatibility, render nothing as sonner handles the display
  // The actual toast is shown via the sonner system in useEffect
  return null;
};

interface ToastContainerProps {
  toasts: Array<{
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
  }>;
  onDismiss: (id: string) => void;
}

/**
 * Legacy ToastContainer component for backward compatibility.
 * In the new system, the Toaster component from ui/sonner handles this automatically.
 */
export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

// Export helper functions for easy migration to the new toast system
export { toast, toastSuccess, toastError, toastWarning, toastInfo };
