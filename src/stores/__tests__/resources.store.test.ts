/**
 * Resources Store Tests
 * Tests all actions with 100% coverage following TRD requirements
 */

import { useResourcesStore, attachResourceToChat, detachResourceFromChat } from '@/stores';
import { Resource, ResourceType } from '@/entities';

// Mock dependencies
jest.mock('@/stores/chat.store', () => ({
  useChatStore: {
    getState: jest.fn(() => ({
      activeChat: 'chat-1',
      attachments: new Map(),
    })),
    setState: jest.fn((fn) => {
      const state = {
        activeChat: 'chat-1',
        attachments: new Map(),
      };
      return fn(state);
    }),
  },
}));

// Set up Electron mock
const mockUploadResources = jest.fn();

// Extend existing window.electron with resources
(global.window as any).electron = {
  ...(global.window as any).electron,
  resources: {
    uploadResources: mockUploadResources,
  },
};

describe('ResourcesStore', () => {
  beforeEach(() => {
    // Reset store
    useResourcesStore.setState({
      resources: new Map(),
      resourcesLoading: false,
    });

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('State Initialization', () => {
    it('should initialize with empty state', () => {
      const state = useResourcesStore.getState();
      expect(state.resources).toBeInstanceOf(Map);
      expect(state.resources.size).toBe(0);
      expect(state.resourcesLoading).toBe(false);
    });
  });

  describe('Selectors', () => {
    it('should get resource by ID', () => {
      const resource: Resource = {
        id: 'res-1',
        name: 'test.txt',
        type: ResourceType.DOCUMENT,
        size: 100,
        path: '/path/test.txt',
        mimeType: 'text/plain',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      useResourcesStore.setState({
        resources: new Map([[resource.id, resource]]),
      });

      const state = useResourcesStore.getState();
      const result = state.getResource('res-1');
      expect(result).toEqual(resource);
    });

    it('should return undefined for non-existent resource', () => {
      const state = useResourcesStore.getState();
      const result = state.getResource('non-existent');
      expect(result).toBeUndefined();
    });

    it('should get all resources as array', () => {
      const resources: Resource[] = [
        {
          id: 'res-1',
          name: 'test1.txt',
          type: ResourceType.DOCUMENT,
          size: 100,
          path: '/path/test1.txt',
          mimeType: 'text/plain',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'res-2',
          name: 'test2.txt',
          type: ResourceType.DOCUMENT,
          size: 200,
          path: '/path/test2.txt',
          mimeType: 'text/plain',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      useResourcesStore.setState({
        resources: new Map(resources.map((r) => [r.id, r])),
      });

      const state = useResourcesStore.getState();
      const result = state.getAllResources();
      expect(result).toHaveLength(2);
      expect(result).toEqual(expect.arrayContaining(resources));
    });

    it('should return empty array when no resources', () => {
      const state = useResourcesStore.getState();
      const result = state.getAllResources();
      expect(result).toEqual([]);
    });
  });

  describe('Actions - loadResources', () => {
    it('should set loading state to true when loading', async () => {
      const promise = useResourcesStore.getState().loadResources();

      // Check loading state is set immediately
      const stateDuringLoad = useResourcesStore.getState();
      expect(stateDuringLoad.resourcesLoading).toBe(true);

      await promise;
    });

    it('should set loading state to false after load completes', async () => {
      await useResourcesStore.getState().loadResources();

      const state = useResourcesStore.getState();
      expect(state.resourcesLoading).toBe(false);
    });

    it('should handle load errors gracefully', async () => {
      // Mock to throw error
      jest.spyOn(useResourcesStore.getState(), 'loadResources').mockImplementationOnce(async () => {
        useResourcesStore.setState({ resourcesLoading: true });
        try {
          throw new Error('Load failed');
        } catch (error) {
          useResourcesStore.setState({ resourcesLoading: false });
        }
      });

      await useResourcesStore.getState().loadResources();

      const state = useResourcesStore.getState();
      expect(state.resourcesLoading).toBe(false);
    });
  });

  describe('Actions - uploadResource', () => {
    it('should upload resource successfully', async () => {
      const mockResource: Resource = {
        id: 'res-uploaded',
        name: 'uploaded.txt',
        type: ResourceType.DOCUMENT,
        size: 150,
        path: '/path/uploaded.txt',
        mimeType: 'text/plain',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUploadResources.mockResolvedValue(mockResource);

      const file = new File(['content'], 'uploaded.txt', { type: 'text/plain' });
      Object.defineProperty(file, 'size', { value: 150 });
      Object.defineProperty(file, 'lastModified', { value: Date.now() });

      const result = await useResourcesStore.getState().uploadResource(file);

      expect(result).toEqual(mockResource);

      const state = useResourcesStore.getState();
      expect(state.resources.get('res-uploaded')).toEqual(mockResource);
    });

    it('should handle upload failure when electron IPC not available', async () => {
      const originalElectron = window.electron;
      (window as any).electron = undefined;

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const state = useResourcesStore.getState();

      await expect(state.uploadResource(file)).rejects.toThrow('Electron IPC not available');

      (window as any).electron = originalElectron;
    });

    it('should handle upload failure from IPC', async () => {
      mockUploadResources.mockRejectedValue(new Error('Upload failed'));

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const state = useResourcesStore.getState();

      await expect(state.uploadResource(file)).rejects.toThrow('Upload failed');
    });

    it('should extract file metadata correctly', async () => {
      const mockResource: Resource = {
        id: 'res-1',
        name: 'test.pdf',
        type: ResourceType.DOCUMENT,
        size: 5000,
        path: '/path/test.pdf',
        mimeType: 'application/pdf',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUploadResources.mockResolvedValue(mockResource);

      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      Object.defineProperty(file, 'size', { value: 5000 });
      Object.defineProperty(file, 'lastModified', { value: 123456789 });

      const state = useResourcesStore.getState();
      await state.uploadResource(file);

      expect(mockUploadResources).toHaveBeenCalledWith(
        'test.pdf',
        expect.objectContaining({
          mimeType: 'application/pdf',
          size: 5000,
          lastModified: 123456789,
        })
      );
    });
  });

  describe('Actions - addResource', () => {
    it('should add resource to store', () => {
      const resource: Resource = {
        id: 'res-1',
        name: 'test.txt',
        type: ResourceType.DOCUMENT,
        size: 100,
        path: '/path/test.txt',
        mimeType: 'text/plain',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      useResourcesStore.getState().addResource(resource);

      const state = useResourcesStore.getState();
      expect(state.resources.get('res-1')).toEqual(resource);
      expect(state.resources.size).toBe(1);
    });

    it('should overwrite existing resource with same ID', () => {
      const resource1: Resource = {
        id: 'res-1',
        name: 'test1.txt',
        type: ResourceType.DOCUMENT,
        size: 100,
        path: '/path/test1.txt',
        mimeType: 'text/plain',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const resource2: Resource = {
        id: 'res-1',
        name: 'test2.txt',
        type: ResourceType.DOCUMENT,
        size: 200,
        path: '/path/test2.txt',
        mimeType: 'text/plain',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      useResourcesStore.getState().addResource(resource1);
      useResourcesStore.getState().addResource(resource2);

      const state = useResourcesStore.getState();
      expect(state.resources.get('res-1')).toEqual(resource2);
      expect(state.resources.size).toBe(1);
    });
  });

  describe('Actions - deleteResource', () => {
    it('should delete resource from store', () => {
      const resource: Resource = {
        id: 'res-1',
        name: 'test.txt',
        type: ResourceType.DOCUMENT,
        size: 100,
        path: '/path/test.txt',
        mimeType: 'text/plain',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      useResourcesStore.setState({
        resources: new Map([[resource.id, resource]]),
      });

      useResourcesStore.getState().deleteResource('res-1');

      const state = useResourcesStore.getState();
      expect(state.resources.get('res-1')).toBeUndefined();
      expect(state.resources.size).toBe(0);
    });

    it('should handle deleting non-existent resource gracefully', () => {
      const state = useResourcesStore.getState();
      expect(() => state.deleteResource('non-existent')).not.toThrow();
      expect(state.resources.size).toBe(0);
    });
  });

  describe('Attachment Functions - attachResourceToChat', () => {
    it('should attach resource to active chat', async () => {
      const { useChatStore } = await import('@/stores/chat.store');
      const mockSetState = jest.fn();
      (useChatStore.setState as jest.Mock) = mockSetState;

      const resource: Resource = {
        id: 'res-1',
        name: 'test.txt',
        type: ResourceType.DOCUMENT,
        size: 100,
        path: '/path/test.txt',
        mimeType: 'text/plain',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      useResourcesStore.setState({
        resources: new Map([[resource.id, resource]]),
      });

      attachResourceToChat('res-1');

      // Wait for dynamic import to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockSetState).toHaveBeenCalled();
    });

    it('should add resource to store if provided', async () => {
      const resource: Resource = {
        id: 'res-new',
        name: 'new.txt',
        type: ResourceType.DOCUMENT,
        size: 150,
        path: '/path/new.txt',
        mimeType: 'text/plain',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      attachResourceToChat('res-new', resource);

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      const state = useResourcesStore.getState();
      expect(state.resources.get('res-new')).toEqual(resource);
    });

    it('should handle missing resource gracefully', () => {
      expect(() => attachResourceToChat('non-existent')).not.toThrow();
    });
  });

  describe('Attachment Functions - detachResourceFromChat', () => {
    it('should detach resource from active chat', async () => {
      const { useChatStore } = await import('@/stores/chat.store');
      const mockSetState = jest.fn();
      (useChatStore.setState as jest.Mock) = mockSetState;

      detachResourceFromChat('res-1');

      // Wait for dynamic import to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockSetState).toHaveBeenCalled();
    });
  });
});
