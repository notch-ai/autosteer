/**
 * Resources Store - Resource Management State
 *
 * Handles file resource uploads, attachments, and management
 *
 * Key features:
 * - Resource CRUD operations
 * - File upload via Electron IPC
 * - Attachment management per chat
 * - Resource metadata tracking
 *
 * @see docs/guides-architecture.md - Resource Management Architecture
 */

import { Resource } from '@/entities';
import { enableMapSet } from 'immer';
import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Attachment } from './types';

// Enable MapSet plugin for Immer to work with Map objects
enableMapSet();

// DevTools configuration - only in development
const withDevtools = process.env.NODE_ENV === 'development' ? devtools : (f: any) => f;

/**
 * ResourcesStore Interface
 * Defines all state and actions for resource management
 */
export interface ResourcesStore {
  // ==================== STATE ====================

  resources: Map<string, Resource>; // All resources indexed by ID
  resourcesLoading: boolean; // Loading state

  // ==================== SELECTORS ====================

  getResource: (id: string) => Resource | undefined;
  getAllResources: () => Resource[];

  // ==================== ACTIONS ====================

  loadResources: () => Promise<void>;
  uploadResource: (file: File) => Promise<Resource>;
  addResource: (resource: Resource) => void;
  deleteResource: (id: string) => void;
}

/**
 * Create ResourcesStore with Zustand + Immer + DevTools
 *
 * Uses:
 * - Zustand for reactive state management
 * - Immer for immutable updates with mutable syntax
 * - DevTools for debugging in development
 * - Map for O(1) resource lookups by ID
 */
export const useResourcesStore = create<ResourcesStore>()(
  withDevtools(
    immer<ResourcesStore>((set, get) => ({
      // ==================== INITIAL STATE ====================

      resources: new Map(),
      resourcesLoading: false,

      // ==================== SELECTORS ====================

      /**
       * Get a resource by ID
       * @param id - Resource ID
       * @returns Resource or undefined
       */
      getResource: (id: string) => {
        const state = get();
        return state.resources.get(id);
      },

      /**
       * Get all resources as an array
       * @returns Array of all resources
       */
      getAllResources: () => {
        const state = get();
        return Array.from(state.resources.values());
      },

      // ==================== ACTIONS ====================

      /**
       * Load all resources from service
       * Currently a placeholder for future implementation
       */
      loadResources: async () => {
        set((state) => {
          state.resourcesLoading = true;
        });

        try {
          // TODO: Load resources from service
          // Simulate async operation for testability
          await new Promise((resolve) => setTimeout(resolve, 0));

          const resourcesArray: Resource[] = [];
          set((state) => {
            state.resources = new Map(resourcesArray.map((resource) => [resource.id, resource]));
            state.resourcesLoading = false;
          });
        } catch (error) {
          set((state) => {
            state.resourcesLoading = false;
          });
        }
      },

      /**
       * Upload a file resource via Electron IPC
       * @param file - File object to upload
       * @returns Uploaded resource
       * @throws Error if upload fails
       */
      uploadResource: async (file: File) => {
        try {
          if (!window.electron?.resources) {
            throw new Error('Electron IPC not available');
          }

          // Extract file path from File object
          const filePath = (file as any).path || file.name;
          const metadata = {
            mimeType: file.type,
            size: file.size,
            lastModified: file.lastModified,
          };

          const resource = await window.electron.resources?.uploadResources?.(filePath, metadata);

          // Store resource in the Map
          set((state) => {
            state.resources.set(resource.id, resource);
          });

          return resource;
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to upload resource');
        }
      },

      /**
       * Add a resource to the store
       * @param resource - Resource to add
       */
      addResource: (resource: Resource) => {
        set((state) => {
          state.resources.set(resource.id, resource);
        });
      },

      /**
       * Delete a resource from the store
       * @param id - Resource ID to delete
       */
      deleteResource: (id: string) => {
        set((state) => {
          state.resources.delete(id);
        });
      },
    })),
    {
      name: 'resources-store',
      trace: process.env.NODE_ENV === 'development',
    }
  )
);

/**
 * Attachment Management Functions
 * These functions integrate resources with chat attachments
 */

/**
 * Attach a resource to the active chat
 * @param id - Resource ID
 * @param resource - Optional resource object (if not already in store)
 */
export function attachResourceToChat(id: string, resource?: Resource) {
  const resourcesStore = useResourcesStore.getState();

  // If resource is provided, store it first
  if (resource) {
    resourcesStore.addResource(resource);
  }

  const resourceData = resource || resourcesStore.getResource(id);
  if (!resourceData) {
    return;
  }

  // Import chat store to attach to active chat
  import('./chat.store').then(({ useChatStore }) => {
    const chatStore = useChatStore.getState();
    const { activeChat } = chatStore;
    if (!activeChat) {
      return;
    }

    useChatStore.setState((state) => {
      const attachments = state.attachments.get(activeChat) || [];
      const attachment: Attachment = {
        id: nanoid(),
        resourceId: id,
        name: resourceData.name,
        type: resourceData.type,
        size: resourceData.size,
      };
      state.attachments.set(activeChat, [...attachments, attachment]);
      return state;
    });
  });
}

/**
 * Detach a resource from the active chat
 * @param id - Resource ID to detach
 */
export function detachResourceFromChat(id: string) {
  import('./chat.store').then(({ useChatStore }) => {
    const chatStore = useChatStore.getState();
    const { activeChat } = chatStore;
    if (!activeChat) return;

    useChatStore.setState((state) => {
      const attachments = state.attachments.get(activeChat) || [];
      const filtered = attachments.filter((att: Attachment) => att.resourceId !== id);
      state.attachments.set(activeChat, filtered);
      return state;
    });
  });
}
