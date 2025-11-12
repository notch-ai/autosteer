import { useSlashCommandLogic } from '@/components/common/useSlashCommandLogic';
import { usePickerKeyboardNav } from '@/hooks/usePickerKeyboardNav';
import { useCallback, useEffect, useRef } from 'react';

export interface SlashCommand {
  command: string;
  label: string;
  description: string;
  icon: string;
  action?: () => void;
  content?: string;
}

export interface UseSlashCommandsProps {
  query: string;
  isOpen: boolean;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  onTabSelect?: (command: SlashCommand) => void;
}

export interface UseSlashCommandsReturn {
  filteredCommands: SlashCommand[];
  selectedIndex: number;
  setSelectedIndex: (index: number | ((prev: number) => number)) => void;
  pickerRef: React.RefObject<HTMLDivElement>;
  handleClickOutside: () => void;
}

/**
 * Business logic hook for SlashCommands component
 *
 * Responsibilities:
 * - Load and filter slash commands based on query
 * - Handle keyboard navigation (delegated to usePickerKeyboardNav)
 * - Handle click outside to close
 * - Manage selected index state
 *
 * Architecture:
 * - Uses useSlashCommandLogic for command loading and filtering
 * - Uses usePickerKeyboardNav for keyboard navigation
 * - Provides pickerRef for DOM containment validation
 *
 * @see usePickerKeyboardNav for keyboard navigation pattern
 * @see useSlashCommandLogic for command loading pattern
 */
export const useSlashCommands = ({
  query,
  isOpen,
  onSelect,
  onClose,
  onTabSelect,
}: UseSlashCommandsProps): UseSlashCommandsReturn => {
  const pickerRef = useRef<HTMLDivElement>(null);

  // Load and filter commands
  const { filteredCommands } = useSlashCommandLogic(query);

  // Keyboard navigation
  const { selectedIndex, setSelectedIndex } = usePickerKeyboardNav({
    items: filteredCommands,
    isOpen,
    pickerRef,
    onSelect,
    onClose,
    ...(onTabSelect && { onTabSelect }),
    enableLogging: false,
    componentName: 'SlashCommands',
  });

  // Handle clicks outside the picker
  const handleClickOutside = useCallback(() => {
    const handleClick = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    return handleClick;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClick = handleClickOutside();
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isOpen, handleClickOutside]);

  return {
    filteredCommands,
    selectedIndex,
    setSelectedIndex,
    pickerRef,
    handleClickOutside,
  };
};
