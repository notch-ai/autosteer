import { ChatMessage } from './ChatMessage';

export enum AgentStatus {
  DRAFT = 'draft',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export enum AgentType {
  TEXT = 'text',
  DOCUMENT = 'document',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  CODE = 'code',
  MIXED = 'mixed',
}

export interface Agent {
  id: string;
  title: string;
  content: string;
  preview: string;
  type: AgentType;
  status: AgentStatus;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  resourceIds: string[];
  projectId?: string;
  metadata?: Record<string, unknown>;
  chatHistory?: ChatMessage[];
}
