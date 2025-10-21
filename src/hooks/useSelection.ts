import { useEffect, useState } from 'react';
import { SelectionService, SelectionState } from '@/renderer/services/SelectionService';

export const useSelection = () => {
  const selectionService = SelectionService.getInstance();
  const [state, setState] = useState<SelectionState>(selectionService.getState());

  useEffect(() => {
    const unsubscribe = selectionService.subscribe(setState);
    return unsubscribe;
  }, []);

  return {
    ...state,
    selectAgent: selectionService.selectAgent.bind(selectionService),
    selectResource: selectionService.selectResource.bind(selectionService),
    clearSelection: selectionService.clearSelection.bind(selectionService),
  };
};
