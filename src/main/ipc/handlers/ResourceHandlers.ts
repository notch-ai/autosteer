import { ipcMain, IpcMainInvokeEvent, shell } from 'electron';
import { Resource, ResourceType } from '@/entities';
import { IPC_CHANNELS } from '@/types/ipc.types';
import log from 'electron-log';
import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';

interface ResourceStore {
  resources: Resource[];
}

interface UploadMetadata {
  mimeType?: string;
  width?: number;
  height?: number;
  duration?: number;
  pages?: number;
  language?: string;
  [key: string]: string | number | boolean | undefined;
}

export class ResourceHandlers {
  private store: Store<ResourceStore>;
  private resourcesPath: string;

  constructor() {
    this.store = new Store<ResourceStore>({
      name: 'resources',
      defaults: {
        resources: [],
      },
    });

    // Create resources directory in app data
    this.resourcesPath = path.join(app.getPath('userData'), 'resources');
    // Handle the promise properly
    void this.ensureResourcesDirectory();
  }

  private async ensureResourcesDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.resourcesPath, { recursive: true });
    } catch (error) {
      log.error('Failed to create resources directory:', error as Error);
    }
  }

  private getResourceType(mimeType: string, extension: string): ResourceType {
    if (mimeType.startsWith('image/')) return ResourceType.IMAGE;
    if (mimeType.startsWith('video/')) return ResourceType.VIDEO;
    if (mimeType.startsWith('audio/')) return ResourceType.AUDIO;

    const codeExtensions = [
      '.js',
      '.ts',
      '.tsx',
      '.jsx',
      '.py',
      '.java',
      '.cpp',
      '.c',
      '.h',
      '.css',
      '.html',
      '.json',
      '.xml',
    ];
    if (codeExtensions.includes(extension)) return ResourceType.CODE;

    const documentExtensions = ['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf'];
    if (documentExtensions.includes(extension)) return ResourceType.DOCUMENT;

    const archiveExtensions = ['.zip', '.rar', '.7z', '.tar', '.gz'];
    if (archiveExtensions.includes(extension)) return ResourceType.ARCHIVE;

    return ResourceType.OTHER;
  }

  registerHandlers(): void {
    // Load resources by IDs
    ipcMain.handle(
      IPC_CHANNELS.RESOURCES_LOAD_BY_IDS,
      (_event: IpcMainInvokeEvent, ids: string[]): Resource[] => {
        try {
          const allResources = this.store.get('resources', []);
          const resources = allResources.filter((r) => ids.includes(r.id));
          log.info(`Loaded ${resources.length} resources`);
          return resources;
        } catch (error) {
          log.error('Failed to load resources:', error);
          throw error;
        }
      }
    );

    // Upload resource
    ipcMain.handle(
      IPC_CHANNELS.RESOURCES_UPLOAD,
      async (
        _event: IpcMainInvokeEvent,
        filePath: string,
        metadata?: UploadMetadata
      ): Promise<Resource> => {
        try {
          const stats = await fs.stat(filePath);
          const fileName = path.basename(filePath);
          const extension = path.extname(filePath).toLowerCase();
          const mimeType = metadata?.mimeType || 'application/octet-stream';

          // Copy file to resources directory
          const resourceId = uuidv4();
          const resourceFileName = `${resourceId}${extension}`;
          const resourcePath = path.join(this.resourcesPath, resourceFileName);

          await fs.copyFile(filePath, resourcePath);

          const newResource: Resource = {
            id: resourceId,
            name: fileName,
            type: this.getResourceType(mimeType, extension),
            path: resourcePath,
            size: stats.size,
            mimeType,
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: metadata || {},
          };

          const resources = this.store.get('resources', []);
          resources.push(newResource);
          this.store.set('resources', resources);

          log.info(`Uploaded resource: ${newResource.id}`);
          return newResource;
        } catch (error) {
          log.error('Failed to upload resource:', error);
          throw error;
        }
      }
    );

    // Delete resource
    ipcMain.handle(
      IPC_CHANNELS.RESOURCES_DELETE,
      async (_event: IpcMainInvokeEvent, id: string): Promise<void> => {
        try {
          const resources = this.store.get('resources', []);
          const resource = resources.find((r) => r.id === id);

          if (!resource) {
            throw new Error(`Resource not found: ${id}`);
          }

          // Delete file from disk
          try {
            await fs.unlink(resource.path);
          } catch (error) {
            log.warn(`Failed to delete resource file: ${resource.path}`, error as Error);
          }

          // Remove from store
          const filtered = resources.filter((r) => r.id !== id);
          this.store.set('resources', filtered);

          log.info(`Deleted resource: ${id}`);
          return;
        } catch (error) {
          log.error('Failed to delete resource:', error);
          throw error;
        }
      }
    );

    // Open resource
    ipcMain.handle(
      IPC_CHANNELS.RESOURCES_OPEN,
      async (_event: IpcMainInvokeEvent, resourcePath: string): Promise<void> => {
        try {
          await shell.openPath(resourcePath);
          log.info(`Opened resource: ${resourcePath}`);
        } catch (error) {
          log.error('Failed to open resource:', error);
          throw error;
        }
      }
    );

    // Preview resource (return base64 for images)
    ipcMain.handle(
      IPC_CHANNELS.RESOURCES_PREVIEW,
      async (_event: IpcMainInvokeEvent, id: string): Promise<string> => {
        try {
          const resources = this.store.get('resources', []);
          const resource = resources.find((r) => r.id === id);

          if (!resource) {
            throw new Error(`Resource not found: ${id}`);
          }

          // Read file and return as base64 data URL for all file types
          const buffer = await fs.readFile(resource.path);
          const base64 = buffer.toString('base64');
          return `data:${resource.mimeType};base64,${base64}`;
        } catch (error) {
          log.error('Failed to preview resource:', error);
          throw error;
        }
      }
    );
  }
}
