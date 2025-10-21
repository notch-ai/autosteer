import { cn } from '@/commons/utils';
import { ChevronRight, CircleStop } from 'lucide-react';
import React from 'react';
import { Button } from '../ui/button';

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
          className="bg-red text-white border-0 shadow-sm h-7 w-8 hover:bg-red-600 dark:hover:bg-red-700"
        >
          <CircleStop className="h-5 w-5 stroke-2" />
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
          <ChevronRight className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
};
