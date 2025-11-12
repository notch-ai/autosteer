import React, { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useModalEscape } from '@/hooks/useModalEscape';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { FormButton } from '@/features/shared/components/ui/FormButton';
import { cn } from '@/commons/utils/ui/cn';

// Legacy interface for backward compatibility
export interface ModalFooterAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
}

export interface ModalProps {
  isOpen?: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: 'small' | 'medium' | 'large';
  showCloseButton?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  // New props for integrated footer buttons
  primaryAction?: ModalFooterAction;
  secondaryAction?: ModalFooterAction;
  className?: string;
  preventCloseOnBackdrop?: boolean;
  preventCloseOnEscape?: boolean;
}

/**
 * Legacy Modal component that preserves the original API while using the new UI dialog internally.
 * This maintains backward compatibility for existing code while leveraging the new shadcn/ui components.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen = true,
  onClose,
  title,
  description,
  size = 'medium',
  showCloseButton = true,
  children,
  footer,
  primaryAction,
  secondaryAction,
  className = '',
  preventCloseOnBackdrop = false,
  preventCloseOnEscape = false,
}) => {
  // Handle ESC key to close modal - only if not prevented
  useModalEscape(preventCloseOnEscape ? () => {} : onClose, preventCloseOnEscape);

  const sizeClasses = {
    small: 'w-[90%] max-w-[480px]',
    medium: 'w-[90%] max-w-[720px]',
    large: 'w-[90%] max-w-[960px]',
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !preventCloseOnBackdrop) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          sizeClasses[size],
          'max-h-[80vh]',
          // Hide the default close button if showCloseButton is false
          !showCloseButton && '[&>button]:hidden',
          className
        )}
        // Prevent backdrop close if configured
        {...(preventCloseOnBackdrop && {
          onPointerDownOutside: (e) => e.preventDefault(),
        })}
        {...(preventCloseOnEscape && {
          onEscapeKeyDown: (e) => e.preventDefault(),
        })}
      >
        {title && (
          <DialogHeader className="px-6 py-4 pr-16">
            <DialogTitle className="text-lg font-semibold text-text">{title}</DialogTitle>
            {description && (
              <DialogDescription className="text-sm text-text-muted mt-2">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
        )}

        {/* Custom close button positioned like the legacy modal if showCloseButton is false but we want to show one */}
        {showCloseButton && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute right-6 top-4 z-10"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        {/* Main content */}
        <div className="flex-1 overflow-y-auto px-6 pt-0 pb-6">{children}</div>

        {/* Footer */}
        {(footer || primaryAction || secondaryAction) && (
          <DialogFooter className="flex justify-end gap-3 px-6 py-6 border-t border-border">
            {footer ? (
              footer
            ) : (
              <>
                {secondaryAction && (
                  <FormButton
                    onClick={secondaryAction.onClick}
                    disabled={secondaryAction.disabled || false}
                    loading={secondaryAction.loading || false}
                    loadingText={secondaryAction.loadingText}
                    variant={secondaryAction.variant || 'secondary'}
                  >
                    {secondaryAction.label}
                  </FormButton>
                )}
                {primaryAction && (
                  <FormButton
                    onClick={primaryAction.onClick}
                    disabled={primaryAction.disabled || false}
                    loading={primaryAction.loading || false}
                    loadingText={primaryAction.loadingText}
                    variant={primaryAction.variant || 'primary'}
                  >
                    {primaryAction.label}
                  </FormButton>
                )}
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
