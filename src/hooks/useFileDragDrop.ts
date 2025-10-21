import { logger } from '@/commons/utils/logger';
import { useCallback, useRef, useState } from 'react';

interface UseFileDragDropProps {
  onFilesDropped: (filePaths: string[]) => void;
  disabled?: boolean;
}

interface UseFileDragDropReturn {
  isDragging: boolean;
  dragHandlers: {
    onDragEnter: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
}

/**
 * Custom hook for handling file drag and drop functionality
 */
export const useFileDragDrop = ({
  onFilesDropped,
  disabled = false,
}: UseFileDragDropProps): UseFileDragDropReturn => {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();

      if (disabled) return;

      // Clear any pending leave timeout
      if (leaveTimeoutRef.current) {
        clearTimeout(leaveTimeoutRef.current);
        leaveTimeoutRef.current = null;
      }

      dragDepthRef.current += 1;

      if (dragDepthRef.current === 1) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();

      if (disabled) return;

      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

      // Use timeout to allow drop event to fire first
      if (dragDepthRef.current === 0) {
        leaveTimeoutRef.current = setTimeout(() => {
          setIsDragging(false);
        }, 50);
      }
    },
    [disabled]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();

      if (disabled) {
        e.dataTransfer.dropEffect = 'none';
        return;
      }

      // Set the dropEffect to indicate this is a copy operation
      e.dataTransfer.dropEffect = 'copy';
    },
    [disabled]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();

      if (disabled) return;

      // Clear any pending leave timeout
      if (leaveTimeoutRef.current) {
        clearTimeout(leaveTimeoutRef.current);
        leaveTimeoutRef.current = null;
      }

      // Always reset dragging state and depth on drop
      dragDepthRef.current = 0;
      setIsDragging(false);

      try {
        const files = e.dataTransfer.files;

        if (files && files.length > 0) {
          const filePaths: string[] = [];

          // Extract file paths from the dropped files using Electron 38+ webUtils API
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
              // Use webUtils.getPathForFile (Electron 38+)
              const filePath = (window.electron.file as any)?.getPathForFile?.(file);
              if (filePath) {
                filePaths.push(filePath);
              } else {
                logger.warn('[useFileDragDrop] File path not available for file:', file.name);
              }
            } catch (error) {
              logger.error('[useFileDragDrop] Error getting file path:', error);
            }
          }

          if (filePaths.length > 0) {
            onFilesDropped(filePaths);
          } else {
            logger.warn('[useFileDragDrop] No file paths could be extracted from dropped files');
          }
        }
      } catch (error) {
        logger.error('[useFileDragDrop] Error handling dropped files:', error);
      }
    },
    [disabled, onFilesDropped]
  );

  return {
    isDragging,
    dragHandlers: {
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    },
  };
};
