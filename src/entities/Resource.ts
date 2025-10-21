export enum ResourceType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  CODE = 'code',
  ARCHIVE = 'archive',
  OTHER = 'other',
}

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  path: string;
  url?: string;
  size: number;
  mimeType: string;
  thumbnail?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    pages?: number;
    language?: string;
    [key: string]: unknown;
  };
}
