import { Resource } from '@/entities';
import { logger } from '@/commons/utils/logger';
import { ipcService } from '@/renderer/services/IpcService';
import { useCoreStore } from '@/stores';
import { useCallback } from 'react';

export const useResources = () => {
  const resources = useCoreStore((state) => state.resources);
  const resourcesLoading = useCoreStore((state) => state.resourcesLoading);
  const loadResources = useCoreStore((state) => state.loadResources);
  const uploadResource = useCoreStore((state) => state.uploadResource);

  const resourcesArray = Array.from(resources.values());

  // Enhanced upload with file dialog
  const handleUploadFile = useCallback(async () => {
    try {
      const paths = await ipcService.dialog.openFile({
        properties: ['openFile', 'multiSelections'],
        filters: [
          {
            name: 'All Supported',
            extensions: [
              'jpg',
              'jpeg',
              'png',
              'gif',
              'pdf',
              'doc',
              'docx',
              'txt',
              'md',
              'mp4',
              'mp3',
            ],
          },
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'] },
          { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'md'] },
          { name: 'Videos', extensions: ['mp4', 'avi', 'mov', 'wmv'] },
          { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (!paths || paths.length === 0) {
        return [];
      }

      const uploadedResources: Resource[] = [];

      for (const path of paths) {
        const fileName = path.split('/').pop() || 'unknown';
        const extension = fileName.split('.').pop()?.toLowerCase() || '';

        // Determine MIME type from extension
        let mimeType = 'application/octet-stream';
        if (['jpg', 'jpeg'].includes(extension)) {
          mimeType = 'image/jpeg';
        } else if (extension === 'png') {
          mimeType = 'image/png';
        } else if (extension === 'svg') {
          mimeType = 'image/svg+xml';
        }

        // Create a mock File object with path
        const file = {
          path,
          name: fileName,
          type: mimeType,
          size: 0,
          lastModified: Date.now(),
        } as any;

        const resource = await uploadResource(file);
        uploadedResources.push(resource);
      }

      return uploadedResources;
    } catch (error) {
      logger.error('Failed to upload files:', error);
      throw error;
    }
  }, [uploadResource]);

  // Enhanced delete with confirmation
  const handleDeleteResource = useCallback(
    async (id: string, skipConfirmation = false) => {
      try {
        const resource = resources.get(id);
        if (!resource) {
          throw new Error('Resource not found');
        }

        if (!skipConfirmation) {
          const result = await ipcService.dialog.message({
            type: 'warning',
            title: 'Delete Resource',
            message: `Are you sure you want to delete "${resource.name}"?`,
            buttons: ['Cancel', 'Delete'],
            defaultId: 0,
            cancelId: 0,
          });

          if (result.response !== 1) {
            return false;
          }
        }

        if (window.electron?.resources) {
          await window.electron.resources.deleteResource(id);
        }
        return true;
      } catch (error) {
        logger.error('Failed to delete resource:', error);
        throw error;
      }
    },
    [resources]
  );

  // Open resource in native application
  const handleOpenResource = useCallback(async (id: string) => {
    try {
      if (window.electron?.resources) {
        await window.electron.resources.openResource(id);
      }
    } catch (error) {
      logger.error('Failed to open resource:', error);
      throw error;
    }
  }, []);

  // Get resource preview URL
  const getResourcePreview = useCallback(async (id: string): Promise<string | null> => {
    try {
      return await ipcService.resources.preview(id);
    } catch (error) {
      logger.error('Failed to get resource preview:', error);
      return null;
    }
  }, []);

  // Download resource
  const downloadResource = useCallback(
    async (id: string) => {
      try {
        const resource = resources.get(id);
        if (!resource) {
          throw new Error('Resource not found');
        }

        const savePath = await ipcService.dialog.saveFile({
          defaultPath: resource.name,
        });

        if (!savePath) {
          return;
        }

        // Copy resource to selected location
        const content = await ipcService.file.open(resource.path);
        await ipcService.file.save(savePath, content);
      } catch (error) {
        logger.error('Failed to download resource:', error);
        throw error;
      }
    },
    [resources]
  );

  return {
    // State
    resources: resourcesArray,
    resourcesMap: resources,
    loading: resourcesLoading,
    error: null,

    // Actions
    loadResources,
    uploadFile: handleUploadFile,
    uploadResource,
    deleteResource: handleDeleteResource,
    openResource: handleOpenResource,
    getResourcePreview,
    downloadResource,
  };
};
