import * as React from 'react';
import { useTheme } from '@/commons/contexts/ThemeContext';
import { Toaster as Sonner, toast } from 'sonner';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Helper functions to create toasts with icons
const toastSuccess = (message: string, data?: any) =>
  toast(
    <div className="flex items-center gap-3">
      <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
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
      <XCircle className="w-5 h-5 text-danger flex-shrink-0" />
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
      <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
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
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:rounded-md',
          description: 'group-[.toast]:text-foreground-secondary',
          actionButton:
            'group-[.toast]:bg-card-hover group-[.toast]:text-foreground group-[.toast]:border group-[.toast]:border-border hover:group-[.toast]:bg-card-active',
          cancelButton:
            'group-[.toast]:bg-transparent group-[.toast]:text-foreground-secondary group-[.toast]:border group-[.toast]:border-border hover:group-[.toast]:bg-card-hover',
          // Remove variant-specific background colors since we're using white background for all
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
