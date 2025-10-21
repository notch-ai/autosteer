export type StreamingEventType =
  | 'content'
  | 'tool_use'
  | 'tool_result'
  | 'thinking'
  | 'error'
  | 'system';

export interface StreamingEvent {
  id: string;
  type: StreamingEventType;
  timestamp: Date;
  content?: string;
  toolName?: string;
  toolInput?: any;
  toolResult?: string;
  isError?: boolean;
  metadata?: any;
}

export interface ContentEvent extends StreamingEvent {
  type: 'content';
  content: string;
}

export interface ToolUseEvent extends StreamingEvent {
  type: 'tool_use';
  toolName: string;
  toolInput: any;
}

export interface ToolResultEvent extends StreamingEvent {
  type: 'tool_result';
  toolName: string;
  toolResult: string;
  isError: boolean;
}

export interface ThinkingEvent extends StreamingEvent {
  type: 'thinking';
  content: string;
}

export interface ErrorEvent extends StreamingEvent {
  type: 'error';
  content: string;
  isError: true;
}

export interface SystemEvent extends StreamingEvent {
  type: 'system';
  content: string;
  metadata?: any;
}
