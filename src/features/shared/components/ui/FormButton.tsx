import React from 'react';
import { ClipLoader } from 'react-spinners';
import { Button as UIButton } from '@/components/ui/button';
import { cn } from '@/commons/utils';

// Legacy interface for backward compatibility
export interface FormButtonProps {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string | undefined;
  children: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

// Map legacy variants to new UI component variants
const mapVariantToUI = (variant: FormButtonProps['variant']) => {
  switch (variant) {
    case 'primary':
      return 'brand'; // Use brand variant for primary
    case 'secondary':
      return 'outline';
    case 'danger':
      return 'destructive';
    default:
      return 'brand';
  }
};

// Map legacy sizes to new UI component sizes
const mapSizeToUI = (size: FormButtonProps['size']) => {
  switch (size) {
    case 'small':
      return 'sm';
    case 'medium':
      return 'default';
    case 'large':
      return 'lg';
    default:
      return 'default';
  }
};

/**
 * Legacy FormButton component that preserves the original API while using the new UI button internally.
 * This maintains backward compatibility for existing code while leveraging the new shadcn/ui components.
 * The main difference from Button is the loading state handling and specific styling for forms.
 */
export const FormButton: React.FC<FormButtonProps> = ({
  onClick,
  disabled = false,
  loading = false,
  loadingText,
  children,
  type = 'button',
  variant = 'primary',
  size = 'medium',
  className = '',
}) => {
  const isDisabled = disabled || loading;
  const uiVariant = mapVariantToUI(variant);
  const uiSize = mapSizeToUI(size);

  return (
    <UIButton
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      variant={uiVariant}
      size={uiSize}
      className={cn(
        // Additional styles for legacy compatibility
        'flex items-center justify-center gap-2',
        'shadow-sm transition-all',
        className
      )}
    >
      {loading ? (
        <>
          <ClipLoader size={16} color="#ffffff" />
          {loadingText && <span>{loadingText}</span>}
        </>
      ) : (
        children
      )}
    </UIButton>
  );
};
