/**
 * useResourceActions Hook
 * Provides access to resource actions (load, upload, attach, detach)
 */

import { useResourcesStore, attachResourceToChat, detachResourceFromChat } from '@/stores';
import { useCallback } from 'react';

export function useResourceActions() {
  const loadResources = useResourcesStore((state) => state.loadResources);
  const uploadResource = useResourcesStore((state) => state.uploadResource);

  return {
    loadResources: useCallback(loadResources, [loadResources]),
    uploadResource: useCallback(uploadResource, [uploadResource]),
    attachResource: useCallback(attachResourceToChat, []),
    detachResource: useCallback(detachResourceFromChat, []),
  };
}
