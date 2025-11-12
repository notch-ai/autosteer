import React, { useEffect } from 'react';
import { UsageDashboard } from './UsageDashboard';
import { useMonitoringStore } from '@/stores';
import {
  KeyboardShortcuts,
  useKeyboardShortcut,
} from '@/commons/utils/keyboard/keyboard_shortcuts';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface UsageMonitorProps {
  onClose: () => void;
}

export const UsageMonitor: React.FC<UsageMonitorProps> = ({ onClose }) => {
  const { reset } = useMonitoringStore();

  // Handle escape key
  // Handle ESC key to close modal
  useKeyboardShortcut(KeyboardShortcuts.CLOSE_MODAL, () => {
    onClose();
  });

  // Cleanup monitoring store when modal closes
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  const handleOverlayClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000]"
      onClick={handleOverlayClick}
    >
      <div className="bg-background border border-border rounded-lg flex flex-col shadow-xl w-[90%] max-w-[1200px] max-h-[90vh]">
        <div className="flex items-center justify-end px-4 py-3 border-b border-border">
          <Button variant="ghost" size="icon-sm" onClick={onClose} title="Close Usage Monitor">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <UsageDashboard />
        </div>
      </div>
    </div>
  );
};
