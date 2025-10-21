export interface CommandMenuItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  category?: string;
  metadata?: any;
}

export interface UseCommandMenuOptions {
  items: CommandMenuItem[];
  onSelect: (item: CommandMenuItem) => void;
  onClose: () => void;
  onTabComplete?: (item: CommandMenuItem) => void;
  isOpen: boolean;
}

export interface UseCommandMenuReturn {
  handleItemClick: (item: CommandMenuItem) => void;
}

export const useCommandMenu = ({ onSelect }: UseCommandMenuOptions): UseCommandMenuReturn => {
  const handleItemClick = (item: CommandMenuItem) => {
    onSelect(item);
  };

  return {
    handleItemClick,
  };
};
