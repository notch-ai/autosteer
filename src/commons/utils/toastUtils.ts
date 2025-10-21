import { toast as sonnerToast } from 'sonner';

// Default timers for toast notifications
const DEFAULT_SUCCESS_DURATION = 3000; // 3 seconds
const DEFAULT_ERROR_DURATION = 5000; // 5 seconds

// Toast options type for Sonner
export interface ToastOptions {
  duration?: number;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  cancel?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  onAutoClose?: () => void;
  dismissible?: boolean;
  id?: string | number;
}

// Re-export the toast object with explicit typing to avoid TypeScript issues
const success = (message: string, options?: ToastOptions): string | number => {
  return sonnerToast.success(message, {
    duration: DEFAULT_SUCCESS_DURATION,
    ...options,
  });
};

const error = (message: string, options?: ToastOptions): string | number => {
  return sonnerToast.error(message, {
    duration: DEFAULT_ERROR_DURATION,
    ...options,
  });
};

const info = (message: string, options?: ToastOptions): string | number => {
  return sonnerToast.info(message, {
    duration: DEFAULT_SUCCESS_DURATION,
    ...options,
  });
};

const warning = (message: string, options?: ToastOptions): string | number => {
  return sonnerToast.warning(message, {
    duration: DEFAULT_ERROR_DURATION,
    ...options,
  });
};

const dismiss = (toastId?: string | number): void => {
  sonnerToast.dismiss(toastId);
};

// Export as a namespace-like object
export const toast = {
  success,
  error,
  info,
  warning,
  dismiss,
};
