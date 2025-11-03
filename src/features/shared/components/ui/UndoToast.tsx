import { toastSuccess, toastError } from '@/components/ui/sonner';

const UNDO_DURATION = 7000; // 7 seconds (middle of 5-10s range)

export interface UndoToastOptions {
  message: string;
  onUndo: () => void | Promise<void>;
  undoLabel?: string;
}

export const showUndoToast = ({ message, onUndo, undoLabel = 'Undo' }: UndoToastOptions): void => {
  toastSuccess(message, {
    duration: UNDO_DURATION,
    action: {
      label: undoLabel,
      onClick: async () => {
        try {
          await onUndo();
          toastSuccess('Undo successful', { duration: 2000 });
        } catch (error) {
          toastError('Failed to undo operation', { duration: 3000 });
        }
      },
    },
    description: `Click "${undoLabel}" within ${UNDO_DURATION / 1000} seconds to revert`,
  });
};
