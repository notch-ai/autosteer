import { attachResourceToChat, detachResourceFromChat } from '@/stores/resources.store';
import { useCallback } from 'react';

export const useResourceAttachment = () => {
  const handleAttachResources = useCallback(async (resourceIds: string[]) => {
    for (const id of resourceIds) {
      const resources = await window.electron?.resources?.getResources([id]);
      if (resources && resources.length > 0) {
        const resource = resources[0];
        attachResourceToChat(id, resource);
      } else {
        attachResourceToChat(id);
      }
    }
  }, []);

  const handleRemoveResource = useCallback((id: string) => {
    detachResourceFromChat(id);
  }, []);

  return {
    handleAttachResources,
    handleRemoveResource,
  };
};
