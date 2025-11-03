import React, { useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface AnchoredModalProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
  children: React.ReactNode;
  className?: string;
  preferredPosition?: 'top' | 'bottom' | 'left' | 'right';
  offset?: number;
  matchAnchorWidth?: boolean;
}

export const AnchoredModal: React.FC<AnchoredModalProps> = ({
  isOpen,
  onClose,
  anchorRef,
  children,
  className = '',
  preferredPosition = 'bottom',
  matchAnchorWidth = false,
}) => {
  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(event.target as Node) && isOpen) {
        const popoverContent = document.querySelector('[data-radix-popover-content]');
        if (popoverContent && !popoverContent.contains(event.target as Node)) {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
    return undefined;
  }, [isOpen, onClose, anchorRef]);

  // Map legacy position to Radix side
  const sideMap: Record<string, 'top' | 'bottom' | 'left' | 'right'> = {
    top: 'top',
    bottom: 'bottom',
    left: 'left',
    right: 'right',
  };

  const side = sideMap[preferredPosition] || 'bottom';

  return (
    <Popover open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <PopoverTrigger asChild>
        <div style={{ display: 'none' }} />
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="start"
        className={`p-0 ${className}`}
        style={{
          width: matchAnchorWidth ? anchorRef.current?.offsetWidth : 'auto',
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="bg-background rounded-md overflow-hidden">{children}</div>
      </PopoverContent>
    </Popover>
  );
};
