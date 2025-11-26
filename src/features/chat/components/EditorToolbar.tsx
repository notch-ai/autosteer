import { cn } from '@/commons/utils';
import { ChevronUp } from 'lucide-react';
import React from 'react';
import { Button } from '@/components/ui/button';

export interface EditorToolbarProps {
  onSend: () => void;
  canSend: boolean;
  disabled?: boolean;
  isStreaming?: boolean;
  onStopStreaming?: (() => void) | undefined;
  className?: string;
}

/**
 * Feature component for EditorToolbar
 * Provides send and attach controls
 */
export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  onSend,
  canSend,
  disabled = false,
  isStreaming = false,
  onStopStreaming,
  className = '',
}) => {
  return (
    <div
      className={`flex items-center justify-end gap-1.5 py-3 px-4 ${className}`}
      data-testid="editor-toolbar"
    >
      {/* Send/Stop button */}
      {isStreaming && onStopStreaming ? (
        <Button
          size="icon-lg"
          onClick={onStopStreaming}
          title="Stop streaming"
          className="bg-danger text-white border-0 shadow-sm h-7 w-8 hover:bg-danger/90"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
          </svg>
        </Button>
      ) : (
        <Button
          variant="brand"
          size="icon-lg"
          onClick={onSend}
          disabled={disabled || !canSend}
          title="Send message"
          className={cn(
            'h-7 w-8',
            canSend && 'bg-brand text-white hover:bg-brand-hover border-brand'
          )}
        >
          <ChevronUp className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
};
