import * as React from 'react';
import { useTheme } from '@/commons/contexts/ThemeContext';
import { Toaster as Sonner, toast } from 'sonner';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Helper functions to create toasts with icons
const toastSuccess = (message: string, data?: any) =>
  toast(
    <div className="flex items-center gap-3">
      <CheckCircle2 className="w-5 h-5 text-green flex-shrink-0" />
      <span>{message}</span>
    </div>,
    {
      ...data,
      dismissible: false,
      closeButton: false,
    }
  );

const toastError = (message: string, data?: any) =>
  toast(
    <div className="flex items-center gap-3">
      <XCircle className="w-5 h-5 text-red flex-shrink-0" />
      <span>{message}</span>
    </div>,
    {
      ...data,
      dismissible: false,
      closeButton: false,
    }
  );

const toastWarning = (message: string, data?: any) =>
  toast(
    <div className="flex items-center gap-3">
      <AlertTriangle className="w-5 h-5 text-orange flex-shrink-0" />
      <span>{message}</span>
    </div>,
    {
      ...data,
      dismissible: false,
      closeButton: false,
    }
  );

const toastInfo = (message: string, data?: any) =>
  toast(
    <div className="flex items-center gap-3">
      <Info className="w-5 h-5 text-blue flex-shrink-0" />
      <span>{message}</span>
    </div>,
    {
      ...data,
      dismissible: false,
      closeButton: false,
    }
  );

const Toaster = ({ ...props }: ToasterProps) => {
  const { activeTheme } = useTheme();

  return (
    <Sonner
      theme={activeTheme}
      className="toaster group"
      icons={{
        success: null,
        error: null,
        warning: null,
        info: null,
        loading: null,
      }}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-button-special group-[.toaster]:text-text group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:rounded-md',
          description: 'group-[.toast]:text-text-secondary',
          actionButton:
            'group-[.toast]:bg-surface-hover group-[.toast]:text-text group-[.toast]:border group-[.toast]:border-border hover:group-[.toast]:bg-surface-active',
          cancelButton:
            'group-[.toast]:bg-transparent group-[.toast]:text-text-secondary group-[.toast]:border group-[.toast]:border-border hover:group-[.toast]:bg-surface-hover',
          // Remove variant-specific background colors since we're using button-special background for all
          success: '',
          error: '',
          warning: '',
          info: '',
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast, toastSuccess, toastError, toastWarning, toastInfo };
